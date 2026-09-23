import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  approvalEntityPath,
  approvalEntityTitle,
  decideApprovalRequest,
} from '@/shared/domain/approval/approval-actions';
import {
  describeDecisionEffect,
  pendingTasksFor,
  requestProgress,
  STEP_TYPE_LABELS,
  userLabel,
  type PendingTask,
} from '@/shared/domain/approval/approval-model';
import { ApprovalStatusChip } from '@/shared/domain/approval/approval-status-chip';
import { useApprovalActor } from '@/shared/domain/approval/use-approval-actor';
import type { ApprovalRequest } from '@/shared/types/db-workflow';
import { useWorkbenchStore, type WorkbenchState } from '@/app/workbench-store';
import '@/shared/domain/approval/approval.css';

const AGING_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ApprovalInboxProps {
  /** Tasks waiting for the reader, or requests the reader submitted. */
  mode: 'awaiting' | 'requested';
  query: string;
}

interface InboxRow {
  request: ApprovalRequest;
  task?: PendingTask;
}

/**
 * Approval work inside My Tasks: quick decisions on review steps, and a link
 * into the entity for anything that deserves a closer look.
 */
export function ApprovalInbox({ mode, query }: ApprovalInboxProps) {
  const state = useWorkbenchStore();
  const actorId = useApprovalActor();
  const navigate = useNavigate();
  const [commentFor, setCommentFor] = useState<string>();
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const rows: InboxRow[] =
    mode === 'awaiting'
      ? pendingTasksFor(
          actorId,
          state.approvalRequests,
          state.approvalSteps,
          state.approvalAssignments,
        ).map((task) => ({ request: task.request, task }))
      : state.approvalRequests
          .filter((request) => request.requestedBy === actorId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((request) => ({ request }));

  const titleOf = (request: ApprovalRequest) =>
    approvalEntityTitle(state, request);

  const visible = rows.filter((row) =>
    `${titleOf(row.request)} ${userLabel(state.appUsers, row.request.requestedBy)} ${row.request.note ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  function decide(
    task: PendingTask,
    decision: 'APPROVED' | 'REJECTED',
    text: string,
  ): void {
    const transform = (latest: WorkbenchState) =>
      decideApprovalRequest(
        latest,
        task.assignment.id,
        actorId,
        decision,
        text,
      );
    try {
      transform(state);
      state.updateWorkbench((latest) => {
        try {
          return transform(latest);
        } catch {
          return latest;
        }
      });
      setErrors((current) => ({ ...current, [task.request.id]: '' }));
      setCommentFor(undefined);
      setComment('');
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [task.request.id]:
          error instanceof Error ? error.message : 'Unable to decide.',
      }));
    }
  }

  function open(request: ApprovalRequest): void {
    // React Router handles route errors; the click does not await navigation.
    void navigate(approvalEntityPath(request));
  }

  return (
    <div className="ops-panel approval-inbox">
      <h2>
        {mode === 'awaiting' ? 'Approvals awaiting me' : 'My approval requests'}
      </h2>
      <p className="ops-muted">
        {mode === 'awaiting'
          ? 'Your open tasks on SKU registrations and research handoffs. Approve here, or open the record to check it first.'
          : 'Requests you submitted. Open one to follow the route, cancel it, or resubmit after a rejection.'}
      </p>
      {visible.length === 0 && (
        <p className="ops-muted">
          {mode === 'awaiting'
            ? 'Nothing is waiting for your approval.'
            : 'You have not submitted any approval requests.'}
        </p>
      )}
      {visible.map(({ request, task }) => {
        const progress = requestProgress(
          request,
          state.approvalSteps,
          state.approvalAssignments,
          state.appUsers,
        );
        const aging =
          request.status === 'PENDING' &&
          Date.now() - new Date(request.createdAt).getTime() >
            AGING_DAYS * DAY_MS;
        const error = errors[request.id];
        return (
          <article
            className={`approval-inbox-row${aging ? ' is-aging' : ''}`}
            key={task?.assignment.id ?? request.id}
          >
            <div className="approval-inbox-main">
              <strong>{titleOf(request)}</strong>
              <small>
                Requested by {userLabel(state.appUsers, request.requestedBy)} ·{' '}
                {request.createdAt.slice(0, 10)} · {progress.label}
                {progress.detail ? ` · ${progress.detail}` : ''}
                {aging ? ` · waiting ${String(AGING_DAYS)}+ days` : ''}
              </small>
              {request.note && <small>“{request.note}”</small>}
              {task && (
                <div className="approval-inbox-meta">
                  <span>
                    {STEP_TYPE_LABELS[task.step.type]} ·{' '}
                    {task.step.completionRule === 'ANY'
                      ? 'first decision counts'
                      : 'everyone must approve'}
                  </span>
                  <span>{describeDecisionEffect(task)}</span>
                </div>
              )}
              {error && (
                <p role="alert" className="approval-error">
                  {error}
                </p>
              )}
            </div>
            <div className="approval-inbox-actions">
              {mode === 'requested' && (
                <ApprovalStatusChip status={request.status} />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  open(request);
                }}
              >
                Open
              </Button>
              {task && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-expanded={commentFor === request.id}
                    onClick={() => {
                      setCommentFor(
                        commentFor === request.id ? undefined : request.id,
                      );
                      setComment('');
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      decide(task, 'APPROVED', '');
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
            {task && commentFor === request.id && (
              <div className="approval-inbox-comment">
                <textarea
                  rows={2}
                  maxLength={2000}
                  aria-label="Rejection reason"
                  placeholder="Reason for rejection · the requester reads this"
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                  }}
                />
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCommentFor(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      decide(task, 'REJECTED', comment.trim());
                    }}
                  >
                    Confirm rejection
                  </Button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
