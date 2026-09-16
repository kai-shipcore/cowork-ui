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
      setMessage('처리를 저장했습니다.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '처리할 수 없습니다.',
      );
    }
  }
  const toggle = (users: string[], id: string) =>
    users.includes(id) ? users.filter((user) => user !== id) : [...users, id];
  return (
    <section className="shape-section">
      <h3>단계별 승인</h3>
      <p>
        현재 사용자:{' '}
        {state.appUsers.find((user) => user.id === CURRENT_USER_ID)?.name ??
          CURRENT_USER_ID}
        . 동일 단계의 모든 승인자가 승인해야 다음 단계로 진행합니다.
      </p>
      {canSubmit && (
        <>
          {(['FORWARD', 'FINAL'] as const).map((type) => (
            <fieldset key={type}>
              <legend>
                {type} 승인자 {type === 'FORWARD' ? '(선택 단계)' : '(필수)'}
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
            {current ? '새 승인 요청으로 재상신' : '승인 경로 확정·상신'}
          </Button>
          <p>
            승인자가 없으면 실제 서버 권한 연결이 필요합니다. 개발 환경에서는
            아래 모의 권한으로 흐름만 검증할 수 있습니다.
          </p>
        </>
      )}
      <label>
        결정 사유 (반려 필수){' '}
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
            <summary>상신 당시 데이터</summary>
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
                              승인
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
                              반려 · 이력 보존
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
          기존 승인 기록입니다. 새 단계별 승인 이력을 임의 생성하지 않습니다.
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
      <summary>개발 환경 전용 · 로컬 모의 권한 설정</summary>
      <p>
        실제 인증·권한이 아닙니다. 이 브라우저의 테스트 데이터만 변경하며 서버
        승인 권한을 부여하지 않습니다.
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
