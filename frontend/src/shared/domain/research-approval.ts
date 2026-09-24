import type { ApprovalRequest } from '@/shared/types/db-workflow';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import type { WorkbenchState } from '@/app/workbench-store';
import {
  cancelApproval,
  decideApproval,
  findTask,
  requireCondition,
  submitApproval,
  type ApprovalDecision,
  type ApprovalRoute,
} from './approval/approval-engine';

/** Sign-off on whether a completed vehicle research combination becomes a development project. */
export const RESEARCH_APPROVAL_TYPE = 'VEHICLE_RESEARCH_HANDOFF';

/**
 * Whether a researched combination moves to development. Derived from its
 * latest handoff request: nothing asked yet, under review, pushed (approved)
 * or held (rejected). A cancelled request leaves it unasked, and a combination
 * that already has a development project counts as pushed.
 */
export type ResearchDisposition = 'PENDING' | 'REVIEWING' | 'PUSH' | 'HOLD';

export type ResearchApprovalConfiguration = VehicleConfiguration & {
  sourceConfigurationId?: string;
  productLabel?: string;
};

export const RESEARCH_DISPOSITION_LABELS: Record<ResearchDisposition, string> =
  {
    PENDING: 'Not requested',
    REVIEWING: 'Approval pending',
    PUSH: 'Push',
    HOLD: 'On hold',
  };

export const RESEARCH_DISPOSITION_TONES = {
  PENDING: 'neutral',
  REVIEWING: 'progress',
  PUSH: 'success',
  HOLD: 'warning',
} as const;

export function researchRequestsFor(
  requests: readonly ApprovalRequest[],
  configurationId: string,
): ApprovalRequest[] {
  return requests
    .filter(
      (row) =>
        row.entityType === 'VEHICLE_RESEARCH' &&
        row.entityId === configurationId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function researchDisposition(
  requests: readonly ApprovalRequest[],
  configuration: Pick<VehicleConfiguration, 'id' | 'projectGroupIds'>,
): ResearchDisposition {
  const latest = researchRequestsFor(requests, configuration.id)
    .slice(-1)
    .pop();
  switch (latest?.status) {
    case 'APPROVED':
      return 'PUSH';
    case 'REJECTED':
      return 'HOLD';
    case 'PENDING':
      return 'REVIEWING';
    default:
      return configuration.projectGroupIds.length ? 'PUSH' : 'PENDING';
  }
}

/** Development may start only for complete research whose handoff was approved. */
export function canStartDevelopment(
  configuration: Pick<VehicleConfiguration, 'researchStatus'>,
  disposition: ResearchDisposition,
): boolean {
  return (
    ['COMPLETE', 'COMPLETED'].includes(configuration.researchStatus) &&
    disposition === 'PUSH'
  );
}

export function researchSnapshot(
  configuration: ResearchApprovalConfiguration,
): string {
  return JSON.stringify({
    sourceConfigurationId: configuration.sourceConfigurationId,
    productLabel: configuration.productLabel,
    productTypeId: configuration.productTypeId,
    vehicle: configuration.vehicle,
    vehicleClass: configuration.vehicleClass,
    options: configuration.options,
    researchStatus: configuration.researchStatus,
  });
}

/** Asks the approvers whether this completed combination goes to development. */
export function submitResearchApproval(
  state: WorkbenchState,
  configurationOrId: ResearchApprovalConfiguration | string,
  actor: string,
  route: ApprovalRoute,
  note = '',
): WorkbenchState {
  const configuration =
    typeof configurationOrId === 'string'
      ? state.configurations.find((row) => row.id === configurationOrId)
      : configurationOrId;
  requireCondition(configuration, 'Research configuration not found.');
  requireCondition(
    ['COMPLETE', 'COMPLETED'].includes(configuration.researchStatus),
    'Research must be complete before requesting the project handoff.',
  );
  return submitApproval(
    state,
    {
      approvalTypeId: RESEARCH_APPROVAL_TYPE,
      entityType: 'VEHICLE_RESEARCH',
      entityId: configuration.id,
      requestedBy: actor,
      submittedData: { snapshot: researchSnapshot(configuration) },
      ...(note.trim() ? { note: note.trim() } : {}),
    },
    route,
  );
}

/**
 * One approver's decision. Final approval marks the configuration active for
 * development; a rejection puts it on hold. The reason lives on the assignment.
 */
export function decideResearchApproval(
  state: WorkbenchState,
  assignmentId: string,
  actor: string,
  decision: ApprovalDecision,
  comment: string,
): WorkbenchState {
  const result = decideApproval(state, assignmentId, actor, decision, comment);
  const task = findTask(state, assignmentId);
  requireCondition(
    task?.request.entityType === 'VEHICLE_RESEARCH',
    'This is not a research handoff approval.',
  );
  if (result.outcome === 'PENDING') return result.state;
  const status = result.outcome === 'APPROVED' ? 'ACTIVE' : 'ON_HOLD';
  return {
    ...result.state,
    configurations: result.state.configurations.map((row) =>
      row.id === task.request.entityId ? { ...row, status } : row,
    ),
  };
}

/** The requester withdraws a pending handoff request. */
export function cancelResearchApproval(
  state: WorkbenchState,
  requestId: string,
  actor: string,
): WorkbenchState {
  return cancelApproval(state, requestId, actor);
}
