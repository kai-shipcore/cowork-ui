import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  decideProductApproval,
  PRODUCT_APPROVAL_TYPE,
  submitProductApproval,
} from '@/shared/domain/product-approval';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore, type WorkbenchState } from '@/app/workbench-store';

export function ProductApprovalPanel({
  registrationId,
}: {
  registrationId: string;
}) {
  const state = useWorkbenchStore();
  const [forward, setForward] = useState<string[]>([]);
  const [final, setFinal] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const requests = state.approvalRequests.filter(
    (row) => row.entityId === registrationId,
  );
  const current = requests.length ? requests[requests.length - 1] : undefined;
  const registration = state.registrations.find(
    (row) => row.id === registrationId,
  );
  const canSubmit =
    !registration?.approvedAt &&
    (!current ||
      current.status === 'REJECTED' ||
      current.status === 'CANCELLED');
  function run(transform: (value: WorkbenchState) => WorkbenchState) {
    try {
      transform(state);
      state.updateWorkbench((latest) => {
        try {
          return transform(latest);
        } catch {
          return latest;
        }
      });
      setMessage('Action saved.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to complete this action.',
      );
    }
  }
  const toggle = (users: string[], id: string) =>
    users.includes(id) ? users.filter((user) => user !== id) : [...users, id];
  return (
    <section className="shape-section">
      <h3>Stage approvals</h3>
      <p>
        Current user:{' '}
        {state.appUsers.find((user) => user.id === CURRENT_USER_ID)?.name ??
          CURRENT_USER_ID}
        . All approvers in the current step must approve before proceeding.
      </p>
      {canSubmit && (
        <>
          {(['FORWARD', 'FINAL'] as const).map((type) => (
            <fieldset key={type}>
              <legend>
                {type} Approver{' '}
                {type === 'FORWARD' ? '(Optional step)' : '(Required)'}
              </legend>
              {state.appUsers
                .filter(
                  (user) =>
                    user.status === 'ACTIVE' &&
                    state.approvalGrants.some(
                      (grant) =>
                        grant.appUserId === user.id &&
                        grant.approvalTypeId === PRODUCT_APPROVAL_TYPE &&
                        grant.status === 'ACTIVE' &&
                        (type === 'FINAL'
                          ? grant.canFinalApprove
                          : grant.canForward),
                    ),
                )
                .map((user) => (
                  <label key={user.id}>
                    <input
                      type="checkbox"
                      checked={(type === 'FINAL' ? final : forward).includes(
                        user.id,
                      )}
                      onChange={() => {
                        if (type === 'FINAL') setFinal(toggle(final, user.id));
                        else setForward(toggle(forward, user.id));
                      }}
                    />{' '}
                    {user.name}{' '}
                  </label>
                ))}
            </fieldset>
          ))}
          <Button
            onClick={() => {
              run((latest) =>
                submitProductApproval(latest, registrationId, CURRENT_USER_ID, [
                  ...(forward.length
                    ? [{ type: 'FORWARD' as const, users: forward }]
                    : []),
                  { type: 'FINAL', users: final },
                ]),
              );
            }}
          >
            {current
              ? 'Resubmit as a new approval request'
              : 'Confirm route and submit for approval'}
          </Button>
          <p>
            If no approvers are available, real server permissions must be
            connected. In development, use the mock permissions below to test
            the flow only.
          </p>
        </>
      )}
      <label>
        Decision reason (required for rejection){' '}
        <input
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
        />
      </label>
      {requests.map((request) => (
        <article key={request.id}>
          <h4>
            {request.createdAt} · {request.status}
          </h4>
          <details>
            <summary>Snapshot at submission</summary>
            <pre className="overflow-auto whitespace-pre-wrap">
              {request.submittedData.snapshot}
            </pre>
          </details>
          {state.approvalSteps
            .filter((step) => step.approvalRequestId === request.id)
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((step) => (
              <div key={step.id}>
                <strong>
                  {step.stepNumber}. {step.type} · {step.status}
                </strong>
                {state.approvalAssignments
                  .filter(
                    (assignment) =>
                      assignment.approvalRequestStepId === step.id,
                  )
                  .map((assignment) => (
                    <p key={assignment.id}>
                      {state.appUsers.find(
                        (user) => user.id === assignment.assignedTo,
                      )?.name ?? assignment.assignedTo}{' '}
                      · {assignment.status} · {assignment.decidedAt} ·{' '}
                      {assignment.comment}
                      {step.status === 'PENDING' &&
                        assignment.status === 'PENDING' &&
                        assignment.assignedTo === CURRENT_USER_ID && (
                          <>
                            <Button
                              onClick={() => {
                                run((latest) =>
                                  decideProductApproval(
                                    latest,
                                    assignment.id,
                                    CURRENT_USER_ID,
                                    'APPROVED',
                                    comment,
                                  ),
                                );
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                run((latest) =>
                                  decideProductApproval(
                                    latest,
                                    assignment.id,
                                    CURRENT_USER_ID,
                                    'REJECTED',
                                    comment,
                                  ),
                                );
                              }}
                            >
                              Reject · Preserve history
                            </Button>
                          </>
                        )}
                    </p>
                  ))}
              </div>
            ))}
        </article>
      ))}
      {registration?.approvedAt && !requests.length && (
        <p>
          This is a legacy approval record. New step-by-step approval history is
          not fabricated.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function LocalApprovalGrants() {
  const { appUsers, approvalGrants, updateWorkbench } = useWorkbenchStore();
  if (!import.meta.env.DEV) return null;
  return (
    <details className="shape-section">
      <summary>Development only · Local mock permissions</summary>
      <p>
        These are not real authentication or permissions. They affect only
        browser test data and do not grant server approval access.
      </p>
      {appUsers
        .filter((user) => user.status === 'ACTIVE')
        .map((user) => (
          <fieldset key={user.id}>
            <legend>{user.name}</legend>
            {(['canForward', 'canFinalApprove'] as const).map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={approvalGrants.some(
                    (grant) =>
                      grant.appUserId === user.id &&
                      grant.approvalTypeId === PRODUCT_APPROVAL_TYPE &&
                      grant.status === 'ACTIVE' &&
                      grant[key],
                  )}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateWorkbench((state) => {
                      const existing = state.approvalGrants.find(
                        (grant) =>
                          grant.appUserId === user.id &&
                          grant.approvalTypeId === PRODUCT_APPROVAL_TYPE,
                      );
                      const flags = {
                        canForward:
                          existing?.status === 'ACTIVE' && existing.canForward,
                        canFinalApprove:
                          existing?.status === 'ACTIVE' &&
                          existing.canFinalApprove,
                        [key]: checked,
                      };
                      const enabled = flags.canForward || flags.canFinalApprove;
                      if (!existing && !enabled) return state;
                      return {
                        ...state,
                        approvalGrants: existing
                          ? state.approvalGrants.map((grant) =>
                              grant.id === existing.id
                                ? enabled
                                  ? { ...grant, ...flags, status: 'ACTIVE' }
                                  : { ...grant, status: 'INACTIVE' }
                                : grant,
                            )
                          : [
                              ...state.approvalGrants,
                              {
                                id: crypto.randomUUID(),
                                appUserId: user.id,
                                approvalTypeId: PRODUCT_APPROVAL_TYPE,
                                ...flags,
                                status: 'ACTIVE',
                              },
                            ],
                      };
                    });
                  }}
                />
                {key === 'canForward' ? 'FORWARD' : 'FINAL'}{' '}
              </label>
            ))}
          </fieldset>
        ))}
    </details>
  );
}
