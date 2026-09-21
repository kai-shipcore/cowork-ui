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
            <dt>Requester</dt>
            <dd>{personName(request.requesterId)}</dd>
          </div>
          <div>
            <dt>Assignee</dt>
            <dd>{personName(request.assigneeId)}</dd>
          </div>
          <div>
            <dt>Reviewer</dt>
            <dd>{personName(request.reviewerId)}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{request.dueDate} (LA)</dd>
          </div>
        </dl>
        <p className="ops-preserve">{request.description}</p>
        {request.reference && (
          <p>
            Related work:{' '}
            {request.referencePath ? (
              <Link to={request.referencePath}>{request.reference}</Link>
            ) : (
              request.reference
            )}
          </p>
        )}
        <p className="ops-muted">
          Revision {request.revision} · Last changed{' '}
          {new Date(request.updatedAt).toLocaleString('en-US')}
        </p>
      </section>
      <section className="ops-panel">
        <h2>Actions & comments</h2>
        <p>
          Record the work performed or rejection reason when changing status.
          Approval requests require supporting documents.
        </p>
        <label>
          Content
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
            Notify
            <select
              value={mention}
              onChange={(event) => {
                setMention(event.target.value);
              }}
            >
              <option value="">No mention</option>
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
            Add comment
          </Button>
        </div>
        {transitions.length ? (
          <div className="ops-actions">
            <label>
              Next status
              <select
                value={nextStatus}
                onChange={(event) => {
                  const status = transitions.find(
                    (entry) => entry === event.target.value,
                  );
                  setNextStatus(status ?? '');
                }}
              >
                <option value="">Select an option</option>
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
              Change status
            </Button>
          </div>
        ) : (
          <p className="ops-muted">
            The assigned owner or reviewer handles the next step for the current
            status.
          </p>
        )}
      </section>
      <section className="ops-panel">
        <h2>Review documents & versions</h2>
        <p>
          Using the same document name adds a new version. Documents cannot be
          edited during review.
        </p>
        {request.documents.length === 0 && <p>No documents added yet.</p>}
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
                {latest ? 'Latest' : 'Previous version'} ·{' '}
                {entry.approvedAt ? 'Approved' : 'Not approved'} ·{' '}
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
              Document name
              <Input
                name="name"
                required
                maxLength={160}
                placeholder="Example: Fitting results report"
              />
            </label>
            <label>
              Document URL
              <Input name="url" type="url" required placeholder="https://…" />
            </label>
            <Button variant="outline" disabled={saving}>
              Add document
            </Button>
          </form>
        )}
      </section>
      <section className="ops-panel">
        <h2>Activity history</h2>
        <ol className="ops-timeline">
          {request.events
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.id}>
                <strong>{event.message}</strong>
                <span>
                  {personName(event.actorId)} ·{' '}
                  {new Date(event.at).toLocaleString('en-US')}
                </span>
                {event.mentions.length > 0 && (
                  <small>
                    Notifications: {event.mentions.map(personName).join(', ')}
                  </small>
                )}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
