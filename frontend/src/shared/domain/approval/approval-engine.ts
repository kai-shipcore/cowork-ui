import type {
  ApprovalAssignment,
  ApprovalCompletionRule,
  ApprovalGrant,
  ApprovalRequest,
  ApprovalStep,
  ApprovalType,
} from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';

/** The slices of workbench state the approval engine reads and writes. */
export interface ApprovalEngineState {
  appUsers: readonly AppUser[];
  approvalTypes: readonly ApprovalType[];
  approvalGrants: readonly ApprovalGrant[];
  approvalRequests: readonly ApprovalRequest[];
  approvalSteps: readonly ApprovalStep[];
  approvalAssignments: readonly ApprovalAssignment[];
}

export type ApprovalRoute = readonly {
  type: ApprovalStep['type'];
  users: readonly string[];
  /** Defaults to ALL. */
  completionRule?: ApprovalCompletionRule;
}[];

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

/** `Omit` on a union must distribute, or the entity-specific branches collapse. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** What a feature supplies when it submits; the engine adds id, status and time. */
export type ApprovalRequestDraft = DistributiveOmit<
  ApprovalRequest,
  'id' | 'status' | 'createdAt' | 'closedAt'
>;

export interface ApprovalTask {
  request: ApprovalRequest;
  step: ApprovalStep;
  assignment: ApprovalAssignment;
}

export interface ApprovalDecisionResult<S> {
  state: S;
  request: ApprovalRequest;
  /** The request after this decision: still open, fully approved, or rejected. */
  outcome: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function requireCondition(
  value: unknown,
  message: string,
): asserts value {
  if (!value) throw new Error(message);
}

export function isActiveUser(state: ApprovalEngineState, id: string): boolean {
  return state.appUsers.some(
    (user) => user.id === id && user.status === 'ACTIVE',
  );
}

/** An active person with an active grant for the step's action on this type. */
export function isGranted(
  state: ApprovalEngineState,
  userId: string,
  approvalTypeId: string,
  stepType: ApprovalStep['type'],
): boolean {
  return (
    isActiveUser(state, userId) &&
    state.approvalGrants.some(
      (grant) =>
        grant.appUserId === userId &&
        grant.approvalTypeId === approvalTypeId &&
        grant.status === 'ACTIVE' &&
        (stepType === 'FINAL' ? grant.canFinalApprove : grant.canForward),
    )
  );
}

/** The assignment with its step and request, whatever their statuses. */
export function findTask(
  state: ApprovalEngineState,
  assignmentId: string,
): ApprovalTask | undefined {
  const assignment = state.approvalAssignments.find(
    (row) => row.id === assignmentId,
  );
  const step = state.approvalSteps.find(
    (row) => row.id === assignment?.approvalRequestStepId,
  );
  const request = state.approvalRequests.find(
    (row) => row.id === step?.approvalRequestId,
  );
  return assignment && step && request
    ? { request, step, assignment }
    : undefined;
}

/**
 * Opens a request with a frozen route: FORWARD steps first, exactly one FINAL
 * step last, every person granted for their step. One open or approved request
 * per entity and type at a time.
 */
export function submitApproval<S extends ApprovalEngineState>(
  state: S,
  draft: ApprovalRequestDraft,
  route: ApprovalRoute,
): S {
  requireCondition(
    state.approvalTypes.some(
      (type) => type.id === draft.approvalTypeId && type.status === 'ACTIVE',
    ),
    'This approval type is inactive.',
  );
  requireCondition(
    isActiveUser(state, draft.requestedBy),
    'An active requester is required.',
  );
  requireCondition(
    !state.approvalRequests.some(
      (row) =>
        row.approvalTypeId === draft.approvalTypeId &&
        row.entityType === draft.entityType &&
        row.entityId === draft.entityId &&
        (row.status === 'PENDING' || row.status === 'APPROVED'),
    ),
    'An active or approved request already exists.',
  );
  requireCondition(
    route.length > 0 &&
      route[route.length - 1]?.type === 'FINAL' &&
      route.filter((step) => step.type === 'FINAL').length === 1,
    'Exactly one FINAL step is required at the end.',
  );
  requireCondition(
    route.every(
      (step) =>
        step.users.length > 0 &&
        new Set(step.users).size === step.users.length &&
        step.users.every((user) =>
          isGranted(state, user, draft.approvalTypeId, step.type),
        ),
    ),
    'Assign active approvers with the required permissions for each step.',
  );
  const now = new Date().toISOString();
  const request: ApprovalRequest = {
    ...draft,
    id: crypto.randomUUID(),
    status: 'PENDING',
    createdAt: now,
  };
  const steps: ApprovalStep[] = route.map((step, index) => ({
    id: crypto.randomUUID(),
    approvalRequestId: request.id,
    stepNumber: index + 1,
    type: step.type,
    completionRule: step.completionRule ?? 'ALL',
    status: index === 0 ? 'PENDING' : 'WAITING',
    activatedAt: index === 0 ? now : undefined,
  }));
  return {
    ...state,
    approvalRequests: [...state.approvalRequests, request],
    approvalSteps: [...state.approvalSteps, ...steps],
    approvalAssignments: [
      ...state.approvalAssignments,
      ...steps.flatMap((step, index) =>
        (route[index]?.users ?? []).map((user) => ({
          id: crypto.randomUUID(),
          approvalRequestStepId: step.id,
          assignedTo: user,
          status: 'PENDING' as const,
        })),
      ),
    ],
  };
}

/**
 * Records one person's decision. ALL steps close when everyone approved; ANY
 * steps close on the first decision and cancel the other tasks. A rejection
 * closes the whole request and every later step.
 */
export function decideApproval<S extends ApprovalEngineState>(
  state: S,
  assignmentId: string,
  actor: string,
  decision: ApprovalDecision,
  comment: string,
): ApprovalDecisionResult<S> {
  const task = findTask(state, assignmentId);
  requireCondition(
    task?.assignment.status === 'PENDING' &&
      task.step.status === 'PENDING' &&
      task.request.status === 'PENDING',
    'This is not the current approval step.',
  );
  const { request, step, assignment } = task;
  requireCondition(
    assignment.assignedTo === actor &&
      isGranted(state, actor, request.approvalTypeId, step.type),
    'An assigned approver with valid step permissions is required.',
  );
  requireCondition(
    decision !== 'REJECTED' || comment.trim(),
    'Enter a rejection reason.',
  );
  const now = new Date().toISOString();
  const assignments = state.approvalAssignments.map((row) =>
    row.id === assignment.id
      ? {
          ...row,
          status: decision,
          decidedBy: actor,
          decidedAt: now,
          comment: comment.trim(),
        }
      : row,
  );
  const allApproved = assignments
    .filter((row) => row.approvalRequestStepId === step.id)
    .every((row) => row.status === 'APPROVED');
  const stepApproved =
    decision === 'APPROVED' &&
    ((step.completionRule ?? 'ALL') === 'ANY' || allApproved);
  const rejected = decision === 'REJECTED';
  const final = stepApproved && step.type === 'FINAL';
  const relatedSteps = new Set(
    state.approvalSteps
      .filter((row) => row.approvalRequestId === request.id)
      .map((row) => row.id),
  );
  const nextStep = state.approvalSteps
    .filter(
      (row) =>
        row.approvalRequestId === request.id &&
        row.stepNumber > step.stepNumber,
    )
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .find((row) => row.status === 'WAITING');
  const requestStatus = rejected ? 'REJECTED' : final ? 'APPROVED' : 'PENDING';
  const nextRequests = state.approvalRequests.map((row): ApprovalRequest =>
    row.id === request.id && requestStatus !== 'PENDING'
      ? { ...row, status: requestStatus, closedAt: now }
      : row,
  );
  return {
    outcome: requestStatus,
    request: nextRequests.find((row) => row.id === request.id) ?? request,
    state: {
      ...state,
      approvalRequests: nextRequests,
      approvalAssignments: assignments.map((row) =>
        row.status === 'PENDING' &&
        ((rejected && relatedSteps.has(row.approvalRequestStepId)) ||
          (stepApproved && row.approvalRequestStepId === step.id))
          ? { ...row, status: 'CANCELLED' }
          : row,
      ),
      approvalSteps: state.approvalSteps.map((row) =>
        row.id === step.id && (stepApproved || rejected)
          ? {
              ...row,
              status: rejected ? 'REJECTED' : 'APPROVED',
              closedAt: now,
            }
          : rejected && relatedSteps.has(row.id) && row.status === 'WAITING'
            ? { ...row, status: 'CANCELLED', closedAt: now }
            : stepApproved && row.id === nextStep?.id
              ? { ...row, status: 'PENDING', activatedAt: now }
              : row,
      ),
    },
  };
}

/** The requester withdraws a pending request; decisions already made stay on record. */
export function cancelApproval<S extends ApprovalEngineState>(
  state: S,
  requestId: string,
  actor: string,
): S {
  const request = state.approvalRequests.find((row) => row.id === requestId);
  requireCondition(
    request?.status === 'PENDING',
    'Only a pending request can be cancelled.',
  );
  requireCondition(
    request.requestedBy === actor,
    'Only the requester can cancel this request.',
  );
  const now = new Date().toISOString();
  const openSteps = new Set(
    state.approvalSteps
      .filter(
        (row) =>
          row.approvalRequestId === request.id &&
          (row.status === 'PENDING' || row.status === 'WAITING'),
      )
      .map((row) => row.id),
  );
  return {
    ...state,
    approvalRequests: state.approvalRequests.map((row) =>
      row.id === request.id
        ? { ...row, status: 'CANCELLED', closedAt: now }
        : row,
    ),
    approvalSteps: state.approvalSteps.map((row) =>
      openSteps.has(row.id)
        ? { ...row, status: 'CANCELLED', closedAt: now }
        : row,
    ),
    approvalAssignments: state.approvalAssignments.map((row) =>
      openSteps.has(row.approvalRequestStepId) && row.status === 'PENDING'
        ? { ...row, status: 'CANCELLED' }
        : row,
    ),
  };
}
