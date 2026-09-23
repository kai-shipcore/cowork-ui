import type { ActivityEntry } from '@coverland-engineering/ui/activity/activity';
import type {
  ApprovalAssignment,
  ApprovalCompletionRule,
  ApprovalGrant,
  ApprovalRequest,
  ApprovalStep,
} from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';

/** One step while the submitter is still composing the route. */
export interface ApprovalRouteStepDraft {
  id: string;
  type: ApprovalStep['type'];
  completionRule: ApprovalCompletionRule;
  userIds: readonly string[];
}

/** Request status plus the two states an entity has before or without a request. */
export type EntityApprovalStatus =
  ApprovalRequest['status'] | 'NOT_SUBMITTED' | 'LEGACY_APPROVED';

export const APPROVAL_STATUS_LABELS: Record<EntityApprovalStatus, string> = {
  NOT_SUBMITTED: 'Not submitted',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  LEGACY_APPROVED: 'Approved (legacy)',
};

export const APPROVAL_STATUS_TONES = {
  NOT_SUBMITTED: 'neutral',
  PENDING: 'progress',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  LEGACY_APPROVED: 'success',
} as const;

export const ASSIGNMENT_STATUS_TONES = {
  PENDING: 'progress',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
} as const;

export const STEP_TYPE_LABELS: Record<ApprovalStep['type'], string> = {
  FORWARD: 'Review',
  FINAL: 'Final approval',
};

export function userLabel(users: readonly AppUser[], id: string): string {
  return users.find((user) => user.id === id)?.name ?? id;
}

/** Active users holding an active grant for the step's action on this type. */
export function grantedUsers(
  users: readonly AppUser[],
  grants: readonly ApprovalGrant[],
  approvalTypeId: string,
  stepType: ApprovalStep['type'],
): AppUser[] {
  return users.filter(
    (user) =>
      user.status === 'ACTIVE' &&
      grants.some(
        (grant) =>
          grant.appUserId === user.id &&
          grant.approvalTypeId === approvalTypeId &&
          grant.status === 'ACTIVE' &&
          (stepType === 'FINAL' ? grant.canFinalApprove : grant.canForward),
      ),
  );
}

export function newRouteStep(
  type: ApprovalStep['type'],
  userIds: readonly string[] = [],
  completionRule: ApprovalCompletionRule = 'ALL',
): ApprovalRouteStepDraft {
  return { id: crypto.randomUUID(), type, completionRule, userIds };
}

export interface RoutePreset {
  id: string;
  label: string;
  description: string;
  steps: readonly ApprovalRouteStepDraft[];
}

/** The routes from the approval guide, filled with whoever currently holds the grants. */
export function routePresets(
  forwarders: readonly AppUser[],
  finalApprovers: readonly AppUser[],
): RoutePreset[] {
  const finalIds = finalApprovers.map((user) => user.id);
  const firstFinal = finalIds.slice(0, 1);
  const reviewerIds = forwarders
    .map((user) => user.id)
    .filter((id) => !finalIds.includes(id));
  return [
    {
      id: 'quick',
      label: 'Quick sign-off',
      description: 'One final approver, nothing else.',
      steps: [newRouteStep('FINAL', firstFinal)],
    },
    {
      id: 'any-final',
      label: 'Any final approver',
      description: 'Every final approver is asked; the first decision counts.',
      steps: [newRouteStep('FINAL', finalIds, 'ANY')],
    },
    {
      id: 'review-then-final',
      label: 'Review, then sign-off',
      description: 'All reviewers check first, then any final approver signs.',
      steps: [
        newRouteStep(
          'FORWARD',
          reviewerIds.length ? reviewerIds : forwarders.map((u) => u.id),
        ),
        newRouteStep('FINAL', finalIds, 'ANY'),
      ],
    },
  ];
}

/** Mirrors the server rules so the submit button can explain what is missing. */
export function validateRoute(
  steps: readonly ApprovalRouteStepDraft[],
  users: readonly AppUser[],
  grants: readonly ApprovalGrant[],
  approvalTypeId: string,
): string | undefined {
  const finals = steps.filter((step) => step.type === 'FINAL');
  if (finals.length !== 1 || steps[steps.length - 1]?.type !== 'FINAL')
    return 'The route needs exactly one final approval step at the end.';
  for (const [index, step] of steps.entries()) {
    const label = `Step ${String(index + 1)}`;
    if (step.userIds.length === 0) return `${label} needs at least one person.`;
    if (new Set(step.userIds).size !== step.userIds.length)
      return `${label} lists the same person twice.`;
    const allowed = new Set(
      grantedUsers(users, grants, approvalTypeId, step.type).map((u) => u.id),
    );
    const unqualified = step.userIds.find((id) => !allowed.has(id));
    if (unqualified)
      return `${userLabel(users, unqualified)} cannot act on ${label}.`;
  }
  return undefined;
}

/** Plain-language reading of a step's rule, for the builder and the stepper. */
export function describeStep(
  step: Pick<ApprovalRouteStepDraft, 'type' | 'completionRule' | 'userIds'>,
  users: readonly AppUser[],
): string {
  const names = step.userIds.map((id) => userLabel(users, id));
  if (names.length === 0) return 'No one assigned yet.';
  const action =
    step.type === 'FINAL'
      ? 'gives the final approval'
      : 'reviews and passes on';
  if (names.length === 1) return `${names[0] ?? ''} ${action}.`;
  return step.completionRule === 'ANY'
    ? `${names.join(' or ')}: the first decision settles this step.`
    : `${names.join(' and ')} must all approve.`;
}

export interface RequestProgress {
  /** "Step 1 of 2 · Review" while pending; a closed status label otherwise. */
  label: string;
  /** Who still has to act, or who closed it. */
  detail: string;
}

export function requestProgress(
  request: ApprovalRequest,
  steps: readonly ApprovalStep[],
  assignments: readonly ApprovalAssignment[],
  users: readonly AppUser[],
): RequestProgress {
  const route = steps
    .filter((step) => step.approvalRequestId === request.id)
    .sort((a, b) => a.stepNumber - b.stepNumber);
  if (request.status === 'PENDING') {
    const current = route.find((step) => step.status === 'PENDING');
    if (!current) return { label: 'Pending', detail: '' };
    const waiting = assignments
      .filter(
        (row) =>
          row.approvalRequestStepId === current.id && row.status === 'PENDING',
      )
      .map((row) => userLabel(users, row.assignedTo));
    return {
      label: `Step ${String(current.stepNumber)} of ${String(route.length)} · ${STEP_TYPE_LABELS[current.type]}`,
      detail: waiting.length ? `Waiting on ${waiting.join(', ')}` : '',
    };
  }
  const decider = assignments.find(
    (row) =>
      route.some((step) => step.id === row.approvalRequestStepId) &&
      row.status === request.status,
  );
  return {
    label: APPROVAL_STATUS_LABELS[request.status],
    detail: decider
      ? `${userLabel(users, decider.decidedBy ?? decider.assignedTo)} · ${(decider.decidedAt ?? '').slice(0, 10)}`
      : (request.closedAt ?? '').slice(0, 10),
  };
}

export interface PendingTask {
  request: ApprovalRequest;
  step: ApprovalStep;
  assignment: ApprovalAssignment;
  /** Other people in the same step who have not decided yet. */
  othersPending: readonly string[];
}

/** The reader's inbox: open assignments on open steps of pending requests. */
export function pendingTasksFor(
  userId: string,
  requests: readonly ApprovalRequest[],
  steps: readonly ApprovalStep[],
  assignments: readonly ApprovalAssignment[],
): PendingTask[] {
  return assignments.flatMap((assignment) => {
    if (assignment.assignedTo !== userId || assignment.status !== 'PENDING')
      return [];
    const step = steps.find(
      (row) =>
        row.id === assignment.approvalRequestStepId && row.status === 'PENDING',
    );
    const request = requests.find(
      (row) => row.id === step?.approvalRequestId && row.status === 'PENDING',
    );
    if (!step || !request) return [];
    return [
      {
        request,
        step,
        assignment,
        othersPending: assignments
          .filter(
            (row) =>
              row.approvalRequestStepId === step.id &&
              row.status === 'PENDING' &&
              row.id !== assignment.id,
          )
          .map((row) => row.assignedTo),
      },
    ];
  });
}

/** What the reader's decision does, so the buttons carry no surprises. */
export function describeDecisionEffect(task: PendingTask): string {
  const rule = task.step.completionRule ?? 'ALL';
  const isFinal = task.step.type === 'FINAL';
  if (rule === 'ANY')
    return isFinal
      ? 'ANY rule: your decision closes this step and the request.'
      : 'ANY rule: your decision closes this step and opens the next one.';
  if (task.othersPending.length)
    return `ALL rule: this step also waits for ${String(task.othersPending.length)} more decision${task.othersPending.length > 1 ? 's' : ''}.`;
  return isFinal
    ? 'You are the last approver: approving completes the request.'
    : 'You are the last reviewer: approving opens the next step.';
}

/** Timeline entries for one request: system events plus approver comments. */
export function approvalActivity(
  request: ApprovalRequest,
  steps: readonly ApprovalStep[],
  assignments: readonly ApprovalAssignment[],
  users: readonly AppUser[],
): ActivityEntry[] {
  const route = steps.filter((step) => step.approvalRequestId === request.id);
  const stepIds = new Set(route.map((step) => step.id));
  const entries: ActivityEntry[] = [
    {
      id: `${request.id}-submitted`,
      type: 'USER_COMMENT',
      author: userLabel(users, request.requestedBy),
      authorId: request.requestedBy,
      message: request.note
        ? `Submitted for approval — ${request.note}`
        : 'Submitted for approval',
      createdAt: request.createdAt,
    },
  ];
  for (const step of route) {
    if (step.activatedAt && step.stepNumber > 1)
      entries.push({
        id: `${step.id}-opened`,
        type: 'SYSTEM_LOG',
        message: `Step ${String(step.stepNumber)} (${STEP_TYPE_LABELS[step.type]}) opened`,
        createdAt: step.activatedAt,
      });
  }
  for (const assignment of assignments) {
    if (!stepIds.has(assignment.approvalRequestStepId)) continue;
    if (
      (assignment.status === 'APPROVED' || assignment.status === 'REJECTED') &&
      assignment.decidedAt
    ) {
      const verb = assignment.status === 'APPROVED' ? 'Approved' : 'Rejected';
      entries.push({
        id: `${assignment.id}-decision`,
        type: 'USER_COMMENT',
        author: userLabel(users, assignment.decidedBy ?? assignment.assignedTo),
        authorId: assignment.decidedBy ?? assignment.assignedTo,
        message: assignment.comment ? `${verb} — ${assignment.comment}` : verb,
        createdAt: assignment.decidedAt,
      });
    }
  }
  if (request.closedAt && request.status !== 'PENDING')
    entries.push({
      id: `${request.id}-closed`,
      type: 'SYSTEM_LOG',
      message: `Request ${APPROVAL_STATUS_LABELS[request.status].toLowerCase()}`,
      createdAt: request.closedAt,
    });
  return entries;
}
