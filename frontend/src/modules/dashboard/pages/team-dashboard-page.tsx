import { Link, Navigate, useParams } from 'react-router-dom';
import {
  isOpen,
  isOverdue,
  PEOPLE,
  personName,
  requestLink,
  STATUS_NAMES,
  TEAM_IDS,
  TEAM_NAMES,
} from '@/modules/operations/operations-model';
import { useOperations } from '@/app/operations-store';
import '@/modules/operations/operations.css';

const DESCRIPTIONS = {
  rd: 'Manage vehicle research, product development, sample verification, and launch handoff.',
  'demand-planning':
    'Manage demand, inventory, and purchasing plans and cross-team stock requests.',
  'customer-services':
    'Handle customer inquiries, returns, and recurring complaints and track investigation results.',
  ecommerce:
    'Coordinate launch handoffs, channel operations, and promotion readiness.',
};

export function TeamDashboardPage() {
  const { teamId } = useParams();
  const { snapshot } = useOperations();
  const team = TEAM_IDS.find((id) => id === teamId);
  if (!team) return <Navigate to="/dashboard" replace />;
  const requests = snapshot.requests.filter(
    (request) => request.targetTeam === team,
  );
  const metrics = [
    {
      label: 'Pending requests',
      value: requests.filter(isOpen).length,
      filter: 'open',
    },
    {
      label: 'Overdue',
      value: requests.filter(isOverdue).length,
      filter: 'overdue',
    },
    {
      label: 'Pending approval',
      value: requests.filter((request) => request.status === 'review').length,
      filter: 'review',
    },
    {
      label: 'Completed',
      value: requests.filter((request) => request.status === 'done').length,
      filter: 'done',
    },
  ];
  const members = PEOPLE.filter((person) => person.team === team);
  return (
    <section className="ops">
      <div className="ops-heading">
        <div>
          <h1>{TEAM_NAMES[team]}</h1>
          <p>{DESCRIPTIONS[team]}</p>
        </div>
        <Link to={'/work/requests?new=1&team=' + team}>
          Create team request →
        </Link>
      </div>
      <p>
        Demo data · All requests by receiving team · Last updated{' '}
        {new Date(snapshot.updatedAt).toLocaleString('en-US')} · Select a metric
        to open the related work.
      </p>
      <div className="ops-metrics">
        {metrics.map((metric) => (
          <Link
            className="ops-metric"
            key={metric.label}
            to={
              '/work/requests?team=' +
              team +
              '&target=' +
              team +
              '&filter=' +
              metric.filter
            }
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <span>Open work queue →</span>
          </Link>
        ))}
      </div>
      <div className="ops-panel">
        <h2>Priority work</h2>
        {requests
          .filter(isOpen)
          .sort(
            (a, b) =>
              Number(isOverdue(b)) - Number(isOverdue(a)) ||
              a.dueDate.localeCompare(b.dueDate),
          )
          .slice(0, 8)
          .map((request) => (
            <div className="ops-row" key={request.id}>
              <Link to={requestLink(request.id, team)}>{request.title}</Link>
              <span>
                {STATUS_NAMES[request.status]} ·{' '}
                {personName(request.assigneeId)} · {request.dueDate}
              </span>
            </div>
          ))}
        {!requests.some(isOpen) && <p>No requests awaiting action.</p>}
      </div>
      <div className="ops-panel">
        <h2>Team roles & responsibilities</h2>
        <p>These demo users are provided for role testing.</p>
        {members.map((person) => (
          <div className="ops-row" key={person.id}>
            <strong>{person.name}</strong>
            <span>
              {person.role === 'lead'
                ? 'Review completion or reject'
                : 'Accept, process, and add documents'}{' '}
              · Active{' '}
              {
                requests.filter(
                  (request) =>
                    request.assigneeId === person.id && isOpen(request),
                ).length
              }
              items · Review{' '}
              {
                requests.filter(
                  (request) =>
                    request.reviewerId === person.id &&
                    request.status === 'review',
                ).length
              }
              items
            </span>
          </div>
        ))}
      </div>
      <div className="ops-panel">
        <h2>Business metrics connection</h2>
        <p>
          {team === 'demand-planning'
            ? 'Demand accuracy, stockout forecasts, and order quantities require inventory and sales data connections.'
            : team === 'customer-services'
              ? 'Customer satisfaction, response SLAs, and refund amounts require support and order data connections.'
              : 'Sales, listing errors, and channel inventory require sales channel connections.'}
        </p>
        <Link to={'/work/reports?team=' + team}>
          View current request report →
        </Link>
      </div>
    </section>
  );
}
