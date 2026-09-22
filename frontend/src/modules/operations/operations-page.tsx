import { useState, type ChangeEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { RdPerformance } from '@/modules/rd-workspace/rd-performance';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  isOpen,
  isOverdue,
  personName,
  requestLink,
  STATUS_NAMES,
  TEAM_IDS,
  TEAM_NAMES,
  teamFromLocation,
  today,
} from './operations-model';
import { PersonalSettings } from './personal-settings';
import {
  loadPersonalSettings,
  visiblePersonalNotifications,
} from './personal-settings-model';
import { ReportViewTabs } from './report-view-tabs';
import { RequestDetail } from './request-detail';
import { RequestForm } from './request-form';
import { useRdActions } from './use-rd-actions';
import './operations.css';
import './personal-settings.css';

function download(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function OperationsPage() {
  const { snapshot, actor, restore, previousBackup, saving } = useOperations();
  const location = useLocation();
  const { requestId } = useParams();
  const [params, setParams] = useSearchParams();
  const team = teamFromLocation(location.pathname, location.search);
  const query = params.get('q') ?? '';
  const view = params.get('view') ?? 'assigned';
  const filter = params.get('filter') ?? 'all';
  const [backup, setBackup] = useState<unknown>();
  const [backupMessage, setBackupMessage] = useState('');
  const {
    exportSnapshot,
    storageMessage,
    projects,
    masterProducts,
    approvalAssignments,
    approvalSteps,
    approvalRequests,
  } = useWorkbenchStore();
  const myApprovalEntityIds = new Set(
    approvalAssignments
      .filter(
        (entry) => entry.assignedTo === actor.id && entry.status === 'PENDING',
      )
      .flatMap((entry) => {
        const step = approvalSteps.find(
          (candidate) =>
            candidate.id === entry.approvalRequestStepId &&
            candidate.status === 'PENDING',
        );
        const approval = approvalRequests.find(
          (candidate) =>
            candidate.id === step?.approvalRequestId &&
            candidate.status === 'PENDING',
        );
        return approval ? [approval.entityId] : [];
      }),
  );
  const rd = useRdActions();
  const section = location.pathname.split('/')[2] ?? 'tasks';
  const personal = loadPersonalSettings(actor);
  const notifications = visiblePersonalNotifications(
    snapshot.requests,
    actor.id,
    personal.settings,
  );
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  }
  const visible = snapshot.requests
    .filter((request) => {
      if (
        section === 'tasks' &&
        (view === 'assigned'
          ? request.assigneeId !== actor.id
          : view === 'approvals'
            ? request.reviewerId !== actor.id || request.status !== 'review'
            : request.requesterId !== actor.id)
      )
        return false;
      if (
        section !== 'tasks' &&
        section !== 'search' &&
        request.targetTeam !== team &&
        request.sourceTeam !== team
      )
        return false;
      if (params.get('target') && request.targetTeam !== params.get('target'))
        return false;
      if (params.get('category') && request.category !== params.get('category'))
        return false;
      if (filter === 'overdue' && !isOverdue(request)) return false;
      if (
        filter === 'today' &&
        (!isOpen(request) || request.dueDate !== today())
      )
        return false;
      if (filter === 'open' && !isOpen(request)) return false;
      if (filter === 'waiting' && request.status !== 'blocked') return false;
      if (filter === 'review' && request.status !== 'review') return false;
      if (filter === 'done' && request.status !== 'done') return false;
      return [
        request.title,
        request.id,
        request.reference,
        request.description,
        personName(request.assigneeId),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        a.dueDate.localeCompare(b.dueDate),
    );
  async function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('Select a backup file under 10 MB.');
      const parsed: unknown = JSON.parse(await file.text());
      setBackup(parsed);
      setBackupMessage(
        'File loaded. Restore validates the full format and preserves existing IDs.',
      );
    } catch {
      setBackup(undefined);
      setBackupMessage('Unable to read the backup. Check the JSON file.');
    }
  }
  const titles: Record<string, string> = {
    tasks: 'My Tasks · Inbox',
    requests: 'Team Requests',
    notifications: 'Notifications · My activity',
    search: 'Global Search',
    reports: 'Work Reports',
    settings: 'Personal Settings',
  };
  if (requestId) {
    const request = snapshot.requests.find((entry) => entry.id === requestId);
    return (
      <section className="ops">
        <Link to={'/work/requests?team=' + team}>← Request list</Link>
        {request ? (
          <RequestDetail key={request.id} request={request} />
        ) : (
          <p>Request not found. Check the list.</p>
        )}
      </section>
    );
  }
  const content =
    section === 'notifications' ? (
      <div className="ops-panel">
        <h2>Requests, mentions, and status updates addressed to me</h2>
        <p>
          Filtered by your notification preferences.{' '}
          <Link to={'/work/settings?team=' + team + '#notifications'}>
            Edit notification preferences
          </Link>
        </p>
        {personal.error && <p role="alert">{personal.error}</p>}
        {notifications.map(({ request, event }) => (
          <div className="ops-row" key={event.id}>
            <Link to={requestLink(request.id, team)}>
              {request.title} · {event.message}
            </Link>
            <span>
              {personName(event.actorId)} ·{' '}
              {new Date(event.at).toLocaleString('en-US')}
            </span>
          </div>
        ))}
        {!notifications.length && (
          <p>No activity matches the selected notification types.</p>
        )}
      </div>
    ) : section === 'settings' ? (
      <PersonalSettings key={actor.id} actor={actor}>
        <div className="ops-panel ops-form">
          <h2>Demo work data backup</h2>
          <p>
            Export team requests, comments, document links, and activity as
            JSON. Existing R&D data is separate and is not included.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              download(
                JSON.stringify(snapshot, null, 2),
                'coverland-requests-' + today() + '.json',
              );
            }}
          >
            Export current requests
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                const previous = previousBackup();
                if (previous)
                  download(previous, 'coverland-requests-previous.json');
                else setBackupMessage('No previous save is available yet.');
              } catch {
                setBackupMessage('Unable to read the previous save.');
              }
            }}
          >
            Export previous save
          </Button>
          <label>
            Backup file
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void readBackup(event);
              }}
            />
          </label>
          <p role="status">{backupMessage}</p>
          <Button
            disabled={!backup || saving}
            onClick={() => {
              void restore(backup).then((success) => {
                if (success) {
                  setBackup(undefined);
                  setBackupMessage(
                    'Restored new requests. Existing records were preserved.',
                  );
                }
              });
            }}
          >
            Restore missing requests
          </Button>
          <h2>R&D data backup</h2>
          <p>
            {storageMessage} · Export the current R&D data snapshot. This file
            cannot be restored with the request backup tool.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              download(exportSnapshot(), 'coverland-rd-' + today() + '.json');
            }}
          >
            Export R&D data
          </Button>
          <h2>Production connection readiness</h2>
          <p>
            Company Google sign-in: awaiting setup · Shared API/database: not
            connected · Role selection is for testing only. Enter real company
            data only after production integration.
          </p>
        </div>
      </PersonalSettings>
    ) : (
      <>
        {section === 'reports' && (
          <div className="ops-panel">
            <h2>Requests by team</h2>
            <p>
              Source: All requests stored in this browser · Last change{' '}
              {new Date(snapshot.updatedAt).toLocaleString('en-US')} ·
              Completion rate = Completed / All except cancelled
            </p>
            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Receiving team</th>
                    <th>Open requests</th>
                    <th>Overdue</th>
                    <th>Pending approval</th>
                    <th>Completion rate</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_IDS.map((id) => {
                    const rows = snapshot.requests.filter(
                      (request) =>
                        request.targetTeam === id &&
                        request.status !== 'cancelled',
                    );
                    const done = rows.filter(
                      (request) => request.status === 'done',
                    ).length;
                    return (
                      <tr key={id}>
                        <td>{TEAM_NAMES[id]}</td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=open'
                            }
                          >
                            {rows.filter(isOpen).length}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=overdue'
                            }
                          >
                            {rows.filter(isOverdue).length}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=review'
                            }
                          >
                            {
                              rows.filter(
                                (request) => request.status === 'review',
                              ).length
                            }
                          </Link>
                        </td>
                        <td>
                          {rows.length
                            ? String(Math.round((done / rows.length) * 100)) +
                              '%'
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="ops-panel">
          <div className="ops-actions">
            <label>
              Search
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  update('q', event.target.value);
                }}
                placeholder="Request · SKU · Project · Assignee"
              />
            </label>
            {section === 'tasks' && (
              <label>
                Inbox
                <select
                  value={view}
                  onChange={(event) => {
                    update('view', event.target.value);
                  }}
                >
                  <option value="assigned">Assigned to me</option>
                  <option value="approvals">Awaiting my approval</option>
                  <option value="requested">Requested by me</option>
                </select>
              </label>
            )}
            <label>
              Status
              <select
                value={filter}
                onChange={(event) => {
                  update('filter', event.target.value);
                }}
              >
                <option value="all">All</option>
                <option value="open">Incomplete</option>
                <option value="today">Due today</option>
                <option value="overdue">Overdue</option>
                <option value="waiting">Awaiting response</option>
                <option value="review">Pending approval</option>
                <option value="done">Completed</option>
              </select>
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setParams({ team });
              }}
            >
              Clear filters
            </Button>
          </div>
          <div className="ops-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Work / References</th>
                  <th>Status</th>
                  <th>From → To</th>
                  <th>Assignee</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link to={requestLink(request.id, team)}>
                        {request.title}
                      </Link>
                      <small>
                        {request.reference} · {request.priority}
                      </small>
                    </td>
                    <td>{STATUS_NAMES[request.status]}</td>
                    <td>
                      {TEAM_NAMES[request.sourceTeam]} →{' '}
                      {TEAM_NAMES[request.targetTeam]}
                    </td>
                    <td>{personName(request.assigneeId)}</td>
                    <td className={isOverdue(request) ? 'ops-danger' : ''}>
                      {request.dueDate}
                      {isOverdue(request) && ' · Overdue'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="ops-empty">
                No work matches these filters. Change the filters or create a
                request.
              </p>
            )}
          </div>
        </div>
        {section === 'search' && (
          <div className="ops-panel">
            <h2>Product SKUs</h2>
            {masterProducts
              .filter((product) =>
                (product.sku + ' ' + product.fNumber)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 50)
              .map((product) => (
                <div className="ops-row" key={product.id}>
                  <Link
                    to={'/products?product=' + encodeURIComponent(product.id)}
                  >
                    {product.sku} · {product.fNumber}
                  </Link>
                  <span>{product.status}</span>
                </div>
              ))}
            <h2>R&D projects</h2>
            {projects
              .filter((project) =>
                (project.id + ' ' + project.vehicle)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 50)
              .map((project) => (
                <div className="ops-row" key={project.id}>
                  <Link
                    to={
                      '/vehicle-projects?project=' +
                      encodeURIComponent(project.id)
                    }
                  >
                    {project.id} · {project.vehicle}
                  </Link>
                  <span>{project.stage}</span>
                </div>
              ))}
            <p className="ops-muted">
              Up to 50 results · Search by project ID or vehicle
            </p>
          </div>
        )}
        {section === 'tasks' && actor.team === 'rd' && (
          <div className="ops-panel">
            <h2>Existing R&D work</h2>
            <p>
              These reference items use existing R&D assignments and approvals,
              independently of the request filters above. Process them in their
              original screens. Unassigned items need team review.
            </p>
            {rd.actions
              .filter((action) =>
                view === 'assigned'
                  ? action.ownerId === actor.id
                  : view === 'approvals'
                    ? (action.id.startsWith('handoff-') &&
                        action.ownerId === actor.id) ||
                      myApprovalEntityIds.has(
                        action.id.replace('registration-', ''),
                      )
                    : false,
              )
              .filter((action) =>
                (action.title + ' ' + action.detail)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((action) => (
                <div className="ops-row" key={action.id}>
                  <Link to={action.to}>{action.title}</Link>
                  <span>
                    {action.badge} · {action.detail}
                  </span>
                </div>
              ))}
            <Link to="/dashboard">
              View unassigned work and all R&D activity →
            </Link>
          </div>
        )}
      </>
    );
  return (
    <section className="ops">
      {section !== 'settings' && (
        <div className="ops-heading">
          <div className="workbench-heading">
            <h1>{titles[section] ?? 'Inbox'}</h1>
            <p>
              {TEAM_NAMES[team]} · {personName(actor.id)}
            </p>
          </div>
          <Button asChild>
            <Link to={'/work/requests?new=1&team=' + team}>New request</Link>
          </Button>
        </div>
      )}
      {section !== 'settings' && params.get('new') === '1' && (
        <RequestForm key={actor.id} team={team} />
      )}
      {section === 'reports' ? (
        <ReportViewTabs operations={content} performance={<RdPerformance />} />
      ) : (
        content
      )}
    </section>
  );
}
