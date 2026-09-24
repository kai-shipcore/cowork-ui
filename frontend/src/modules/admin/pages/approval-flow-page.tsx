import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  approvalEntityPath,
  approvalEntityTitle,
} from '@/shared/domain/approval/approval-actions';
import {
  requestProgress,
  userLabel,
} from '@/shared/domain/approval/approval-model';
import { ApprovalStatusChip } from '@/shared/domain/approval/approval-status-chip';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ApprovalAdministration } from '../approval-administration';
import { ApprovalRouteTemplateCard } from '../approval-route-template-card';
import '../admin.css';
import '@/shared/domain/approval/approval.css';

const REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

/** Approval flow management: types, grants, and every request in flight. */
export function ApprovalFlowPage() {
  const navigate = useNavigate();
  const state = useWorkbenchStore();
  const {
    approvalRequests,
    approvalSteps,
    approvalAssignments,
    appUsers,
    approvalTypes,
  } = state;
  const [typeId, setTypeId] = useState(approvalTypes[0]?.id ?? '');
  const pending = approvalRequests
    .filter((request) => request.status === 'PENDING')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <section className="admin-page">
      <PageHeader
        description="Per approval type: who may review or finally approve, the default steps a request starts with, and the requests currently moving through their routes"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'approval_type' },
                { name: 'user_x_approval_type_grant' },
                { name: 'approval_request' },
                { name: 'approval_request_step' },
                { name: 'approval_request_step_assignment' },
              ]
            : undefined
        }
      />
      <ApprovalAdministration
        key={typeId}
        approvalTypeId={typeId}
        onApprovalTypeChange={setTypeId}
      />
      {typeId && (
        <ApprovalRouteTemplateCard key={typeId} approvalTypeId={typeId} />
      )}
      <section className="admin-card" aria-labelledby="approval-flow-requests">
        <header>
          <div>
            <h2 id="approval-flow-requests">Requests in flight</h2>
            <p>
              Every open request with its current step. Decisions are made by
              the assignees from their inbox or the record itself.
            </p>
          </div>
        </header>
        <div className="admin-stats">
          {REQUEST_STATUSES.map((status) => (
            <div className="admin-stat" key={status}>
              <strong>
                {
                  approvalRequests.filter(
                    (request) => request.status === status,
                  ).length
                }
              </strong>
              <span>
                {status.charAt(0) + status.slice(1).toLowerCase()} requests
              </span>
            </div>
          ))}
        </div>
        {pending.length === 0 ? (
          <p className="admin-muted">No requests are waiting for a decision.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Requested by</th>
                <th scope="col">Progress</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.map((request) => {
                const progress = requestProgress(
                  request,
                  approvalSteps,
                  approvalAssignments,
                  appUsers,
                );
                return (
                  <tr key={request.id}>
                    <td>
                      <strong>{approvalEntityTitle(state, request)}</strong>
                      {request.note && <small>“{request.note}”</small>}
                    </td>
                    <td>
                      {userLabel(appUsers, request.requestedBy)}
                      <br />
                      <small>{request.createdAt.slice(0, 10)}</small>
                    </td>
                    <td>
                      <ApprovalStatusChip
                        status={request.status}
                        detail={[progress.label, progress.detail]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // React Router handles route errors; the click does not await navigation.
                          void navigate(approvalEntityPath(request));
                        }}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
