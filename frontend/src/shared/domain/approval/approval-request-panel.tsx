import { useState, type ReactNode } from 'react';
import { Activity } from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Ban, RotateCcw, Send } from 'lucide-react';
import type { ApprovalRequest } from '@/shared/types/db-workflow';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  ApprovalDecisionPanel,
  type ApprovalDecision,
} from './approval-decision-panel';
import type { ApprovalRoute } from './approval-engine';
import {
  approvalActivity,
  newRouteStep,
  pendingTasksFor,
  requestProgress,
  userLabel,
  validateRoute,
  type ApprovalRouteStepDraft,
} from './approval-model';
import { ApprovalRouteBuilder } from './approval-route-builder';
import { ApprovalRouteStepper } from './approval-route-stepper';
import { templateSteps } from './approval-route-template';
import { ApprovalStatusChip } from './approval-status-chip';
import { useApprovalActor } from './use-approval-actor';
import { useApprovalRouteTemplates } from './use-approval-route-templates';
import './approval.css';

interface ApprovalRequestPanelProps {
  approvalTypeId: string;
  /** Every request raised for this entity, oldest first. */
  requests: readonly ApprovalRequest[];
  /** Whether a new request may be submitted right now. */
  canSubmit: boolean;
  /** Why nothing can be submitted, shown when no request exists yet. */
  blockedMessage?: string;
  /** Extra control beside the blocked message, for example to lift the block. */
  emptyAction?: ReactNode;
  submitTitle: string;
  /** What is being approved, shown at the top of the submit dialog. */
  submitSummary: ReactNode;
  initialSubmitOpen?: boolean;
  /** Each action returns an error message, or nothing when it succeeded. */
  onSubmit: (route: ApprovalRoute, note: string) => string | undefined;
  onDecide: (
    assignmentId: string,
    decision: ApprovalDecision,
    comment: string,
  ) => string | undefined;
  onCancel: (requestId: string) => string | undefined;
}

/**
 * Approval state of one entity, whatever its type: submit with a route, follow
 * the route, decide when it is your turn, cancel or resubmit, and read the
 * history of every attempt. The owning feature supplies the domain actions.
 */
export function ApprovalRequestPanel({
  approvalTypeId,
  requests,
  canSubmit,
  blockedMessage,
  emptyAction,
  submitTitle,
  submitSummary,
  initialSubmitOpen = false,
  onSubmit,
  onDecide,
  onCancel,
}: ApprovalRequestPanelProps) {
  const { appUsers, approvalGrants, approvalSteps, approvalAssignments } =
    useWorkbenchStore();
  const actorId = useApprovalActor();
  const templates = useApprovalRouteTemplates();
  const defaultSteps = templateSteps(templates.records, approvalTypeId);
  const current = requests.slice(-1).pop();
  const older = requests.slice(0, -1).reverse();

  /**
   * Where the route editor starts: the earlier request's frozen route when
   * resubmitting, otherwise the type's default steps from Approval Flow
   * Management, otherwise an empty final step.
   */
  function routeOf(
    request: ApprovalRequest | undefined,
  ): readonly ApprovalRouteStepDraft[] {
    if (!request) return defaultSteps ?? [newRouteStep('FINAL')];
    const steps = approvalSteps
      .filter((step) => step.approvalRequestId === request.id)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) =>
        newRouteStep(
          step.type,
          approvalAssignments
            .filter((row) => row.approvalRequestStepId === step.id)
            .map((row) => row.assignedTo),
          step.completionRule ?? 'ALL',
        ),
      );
    return steps.length ? steps : [newRouteStep('FINAL')];
  }

  const [submitOpen, setSubmitOpen] = useState(initialSubmitOpen && canSubmit);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [route, setRoute] = useState<readonly ApprovalRouteStepDraft[]>(() =>
    routeOf(current),
  );
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const routeError = validateRoute(
    route,
    appUsers,
    approvalGrants,
    approvalTypeId,
  );
  const myTask = current
    ? pendingTasksFor(actorId, [current], approvalSteps, approvalAssignments)[0]
    : undefined;
  const rejection = current
    ? approvalAssignments.find(
        (row) =>
          row.status === 'REJECTED' &&
          approvalSteps.some(
            (step) =>
              step.id === row.approvalRequestStepId &&
              step.approvalRequestId === current.id,
          ),
      )
    : undefined;
  const progress = (request: ApprovalRequest) =>
    requestProgress(request, approvalSteps, approvalAssignments, appUsers);

  function submit(): void {
    const error = onSubmit(
      route.map((step) => ({
        type: step.type,
        users: step.userIds,
        completionRule: step.completionRule,
      })),
      note,
    );
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitOpen(false);
    setSubmitError('');
    setNote('');
    setMessage('Submitted for approval.');
  }

  function decide(decision: ApprovalDecision, comment: string): void {
    if (!myTask) return;
    const error = onDecide(myTask.assignment.id, decision, comment);
    if (error) {
      setDecisionError(error);
      return;
    }
    setDecisionError('');
    setMessage(decision === 'APPROVED' ? 'Approved.' : 'Rejected.');
  }

  function cancel(): void {
    if (!current) return;
    const error = onCancel(current.id);
    setCancelOpen(false);
    setMessage(error ?? 'Request cancelled.');
  }

  function renderHistory(request: ApprovalRequest) {
    return (
      <Activity
        entries={approvalActivity(
          request,
          approvalSteps,
          approvalAssignments,
          appUsers,
        )}
        title="Approval history"
        emptyMessage="No decisions yet."
        systemAuthorLabel="Coverland System"
      />
    );
  }

  return (
    <div className="approval-panel">
      {current ? (
        <>
          <div className="approval-panel-summary">
            <ApprovalStatusChip
              status={current.status}
              detail={[progress(current).label, progress(current).detail]
                .filter(Boolean)
                .join(' · ')}
            />
            <dl>
              <dt>Submitted by</dt>
              <dd>
                {userLabel(appUsers, current.requestedBy)} ·{' '}
                {current.createdAt.slice(0, 16).replace('T', ' ')}
              </dd>
              {current.note && (
                <>
                  <dt>Note</dt>
                  <dd>{current.note}</dd>
                </>
              )}
            </dl>
            <div className="approval-panel-actions">
              {current.status === 'PENDING' &&
                current.requestedBy === actorId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCancelOpen(true);
                    }}
                  >
                    <Ban /> Cancel request
                  </Button>
                )}
              {canSubmit && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setRoute(routeOf(current));
                    setSubmitOpen(true);
                  }}
                >
                  <RotateCcw /> Fix and resubmit
                </Button>
              )}
            </div>
          </div>
          {current.status === 'REJECTED' && rejection && (
            <div className="approval-panel-rejection" role="note">
              <strong>
                Rejected by{' '}
                {userLabel(
                  appUsers,
                  rejection.decidedBy ?? rejection.assignedTo,
                )}
              </strong>
              {rejection.comment ?? 'No reason was given.'}
            </div>
          )}
          <ApprovalRouteStepper
            request={current}
            steps={approvalSteps}
            assignments={approvalAssignments}
            users={appUsers}
          />
          {myTask && (
            <ApprovalDecisionPanel
              key={myTask.assignment.id}
              task={myTask}
              error={decisionError}
              onDecide={decide}
            />
          )}
          {renderHistory(current)}
          {older.map((request) => (
            <details key={request.id}>
              <summary>
                Earlier request · {request.createdAt.slice(0, 10)} ·{' '}
                {progress(request).label}
              </summary>
              <div>
                <ApprovalRouteStepper
                  request={request}
                  steps={approvalSteps}
                  assignments={approvalAssignments}
                  users={appUsers}
                />
                {renderHistory(request)}
              </div>
            </details>
          ))}
        </>
      ) : (
        <div className="approval-panel-empty">
          {canSubmit ? (
            <>
              <p>
                Not submitted for approval yet. Choose who reviews and who gives
                the final approval, then submit.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setSubmitOpen(true);
                }}
              >
                <Send /> Submit for approval
              </Button>
            </>
          ) : (
            <>
              <p>{blockedMessage ?? 'Nothing to approve right now.'}</p>
              {emptyAction}
            </>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="dialog-note">
          {message}
        </p>
      )}

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>{submitTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody className="approval-panel">
            {submitSummary}
            {!current && defaultSteps && (
              <p className="approval-route-note">
                Steps pre-filled from the default route for this approval type
                (Admin Tools → Approval Flow Management). Adjust them if this
                request needs a different route.
              </p>
            )}
            <ApprovalRouteBuilder
              users={appUsers}
              grants={approvalGrants}
              approvalTypeId={approvalTypeId}
              requesterId={actorId}
              steps={route}
              onChange={setRoute}
            />
            <label className="approval-submit-note">
              Note for the approvers (optional)
              <textarea
                rows={2}
                maxLength={2000}
                value={note}
                placeholder="What is being decided and why"
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </label>
            {(Boolean(routeError) || submitError.length > 0) && (
              <p role="alert" className="approval-error">
                {submitError.length > 0 ? submitError : routeError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={routeError !== undefined}
              onClick={submit}
            >
              <Send /> Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this approval request?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="dialog-note">
              Open tasks are withdrawn. Decisions already made stay on record,
              and you can submit a new request afterwards.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelOpen(false);
              }}
            >
              Keep request
            </Button>
            <Button variant="destructive" onClick={cancel}>
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
