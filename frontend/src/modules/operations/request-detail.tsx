import { useState, type SyntheticEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Link } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import {
  allowedTransitions,
  PEOPLE,
  personName,
  STATUS_NAMES,
  TEAM_NAMES,
  type RequestStatus,
  type WorkRequest,
} from './operations-model';

export function RequestDetail({ request }: { request: WorkRequest }) {
  const { actor, act, saving } = useOperations();
  const [note, setNote] = useState('');
  const [mention, setMention] = useState('');
  const [nextStatus, setNextStatus] = useState<RequestStatus | ''>('');
  const transitions = allowedTransitions(request, actor.id);
  async function changeStatus() {
    if (
      nextStatus &&
      (await act(request.id, request.revision, {
        kind: 'status',
        status: nextStatus,
        note,
      }))
    ) {
      setNote('');
      setNextStatus('');
    }
  }
  async function comment() {
    if (
      await act(request.id, request.revision, {
        kind: 'comment',
        note,
        mentions: mention ? [mention] : [],
      })
    ) {
      setNote('');
      setMention('');
    }
  }
  function formText(data: FormData, key: string): string {
    const value = data.get(key);
    return typeof value === 'string' ? value : '';
  }

  async function document(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    if (
      await act(request.id, request.revision, {
        kind: 'document',
        name: formText(data, 'name'),
        url: formText(data, 'url'),
      })
    )
      element.reset();
  }
  const editableDocuments =
    [request.assigneeId, request.requesterId].includes(actor.id) &&
    ['submitted', 'active', 'blocked', 'rejected'].includes(request.status);
  return (
    <div className="ops-detail">
      <section className="ops-panel">
        <div className="ops-heading">
          <h2>{request.title}</h2>
          <span className="ops-status">{STATUS_NAMES[request.status]}</span>
        </div>
        <p>
          {TEAM_NAMES[request.sourceTeam]} → {TEAM_NAMES[request.targetTeam]} ·{' '}
          {request.category}
        </p>
        <dl className="ops-facts">
          <div>
            <dt>요청자</dt>
            <dd>{personName(request.requesterId)}</dd>
          </div>
          <div>
            <dt>처리 담당자</dt>
            <dd>{personName(request.assigneeId)}</dd>
          </div>
          <div>
            <dt>검토자</dt>
            <dd>{personName(request.reviewerId)}</dd>
          </div>
          <div>
            <dt>마감일</dt>
            <dd>{request.dueDate} (LA)</dd>
          </div>
        </dl>
        <p className="ops-preserve">{request.description}</p>
        {request.reference && (
          <p>
            관련 업무:{' '}
            {request.referencePath ? (
              <Link to={request.referencePath}>{request.reference}</Link>
            ) : (
              request.reference
            )}
          </p>
        )}
        <p className="ops-muted">
          수정 버전 {request.revision} · 최종 변경{' '}
          {new Date(request.updatedAt).toLocaleString()}
        </p>
      </section>
      <section className="ops-panel">
        <h2>업무 처리 · 댓글</h2>
        <p>
          상태 변경 시 처리 내용 또는 반려 사유를 기록하세요. 승인 요청에는 검토
          자료가 필요합니다.
        </p>
        <label>
          내용
          <textarea
            maxLength={2000}
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
        <div className="ops-actions">
          <label>
            알림 대상
            <select
              value={mention}
              onChange={(event) => {
                setMention(event.target.value);
              }}
            >
              <option value="">멘션 없음</option>
              {PEOPLE.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!note.trim() || saving}
            variant="outline"
            onClick={() => {
              void comment();
            }}
          >
            댓글 등록
          </Button>
        </div>
        {transitions.length ? (
          <div className="ops-actions">
            <label>
              다음 상태
              <select
                value={nextStatus}
                onChange={(event) => {
                  const status = transitions.find(
                    (entry) => entry === event.target.value,
                  );
                  setNextStatus(status ?? '');
                }}
              >
                <option value="">선택하세요</option>
                {transitions.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_NAMES[status]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!nextStatus || !note.trim() || saving}
              onClick={() => {
                void changeStatus();
              }}
            >
              상태 변경
            </Button>
          </div>
        ) : (
          <p className="ops-muted">
            현재 상태의 담당자 또는 검토자가 다음 단계를 처리합니다.
          </p>
        )}
      </section>
      <section className="ops-panel">
        <h2>검토 자료 · 버전</h2>
        <p>
          같은 자료 이름으로 등록하면 새 버전이 추가됩니다. 검토 중인 자료는
          수정할 수 없습니다.
        </p>
        {request.documents.length === 0 && <p>아직 등록한 자료가 없습니다.</p>}
        {request.documents.map((entry) => {
          const latest = !request.documents.some(
            (other) =>
              other.name === entry.name && other.version > entry.version,
          );
          return (
            <div className="ops-row" key={entry.id}>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                {entry.name} · v{entry.version}
              </a>
              <span>
                {latest ? '최신' : '이전 버전'} ·{' '}
                {entry.approvedAt ? '승인됨' : '미승인'} ·{' '}
                {personName(entry.uploadedBy)}
              </span>
            </div>
          );
        })}
        {editableDocuments && (
          <form
            className="ops-form"
            onSubmit={(event) => {
              void document(event);
            }}
          >
            <label>
              자료 이름
              <Input
                name="name"
                required
                maxLength={160}
                placeholder="예: 피팅 결과 보고서"
              />
            </label>
            <label>
              문서 URL
              <Input name="url" type="url" required placeholder="https://…" />
            </label>
            <Button variant="outline" disabled={saving}>
              자료 등록
            </Button>
          </form>
        )}
      </section>
      <section className="ops-panel">
        <h2>활동 기록</h2>
        <ol className="ops-timeline">
          {request.events
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.id}>
                <strong>{event.message}</strong>
                <span>
                  {personName(event.actorId)} ·{' '}
                  {new Date(event.at).toLocaleString()}
                </span>
                {event.mentions.length > 0 && (
                  <small>
                    알림: {event.mentions.map(personName).join(', ')}
                  </small>
                )}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
