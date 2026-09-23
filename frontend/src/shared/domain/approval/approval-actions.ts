import { ROUTES } from '@/constants/routes';
import type { ApprovalRequest } from '@/shared/types/db-workflow';
import type { WorkbenchState } from '@/app/workbench-store';
import {
  cancelProductApproval,
  decideProductApproval,
} from '../product-approval';
import {
  cancelResearchApproval,
  decideResearchApproval,
} from '../research-approval';
import {
  findTask,
  requireCondition,
  type ApprovalDecision,
} from './approval-engine';

/** Routes a decision to the feature that owns the request's entity type. */
export function decideApprovalRequest(
  state: WorkbenchState,
  assignmentId: string,
  actor: string,
  decision: ApprovalDecision,
  comment: string,
): WorkbenchState {
  const task = findTask(state, assignmentId);
  requireCondition(task, 'This is not the current approval step.');
  return task.request.entityType === 'VEHICLE_RESEARCH'
    ? decideResearchApproval(state, assignmentId, actor, decision, comment)
    : decideProductApproval(state, assignmentId, actor, decision, comment);
}

export function cancelApprovalRequest(
  state: WorkbenchState,
  requestId: string,
  actor: string,
): WorkbenchState {
  const request = state.approvalRequests.find((row) => row.id === requestId);
  requireCondition(request, 'Approval request not found.');
  return request.entityType === 'VEHICLE_RESEARCH'
    ? cancelResearchApproval(state, requestId, actor)
    : cancelProductApproval(state, requestId, actor);
}

/** "SKU registration · VPR-0001 · 2 SKUs" or "Research → project handoff · 2023–2026 Toyota RAV4 · c01". */
export function approvalEntityTitle(
  state: Pick<
    WorkbenchState,
    'approvalTypes' | 'registrationItems' | 'configurations'
  >,
  request: ApprovalRequest,
): string {
  const typeName =
    state.approvalTypes.find((row) => row.id === request.approvalTypeId)
      ?.name ?? request.approvalTypeId;
  if (request.entityType === 'VEHICLE_RESEARCH') {
    const configuration = state.configurations.find(
      (row) => row.id === request.entityId,
    );
    return `${typeName} · ${configuration?.vehicle ?? 'Vehicle'} · ${request.entityId}`;
  }
  const skuCount = state.registrationItems.filter(
    (item) => item.registrationId === request.entityId,
  ).length;
  return `${typeName} · ${request.entityId} · ${String(skuCount)} SKU${skuCount === 1 ? '' : 's'}`;
}

/** Where the entity behind a request is reviewed. */
export function approvalEntityPath(request: ApprovalRequest): string {
  return request.entityType === 'VEHICLE_RESEARCH'
    ? `${ROUTES.vehicleResearch}/${encodeURIComponent(request.entityId)}`
    : `${ROUTES.productRegistrations}?review=${encodeURIComponent(request.entityId)}`;
}
