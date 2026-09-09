import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { findUser } from '@/shared/domain/app-user';
import { UserAvatar } from '@/shared/domain/user-picker';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import type { AppUser } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  SAMPLE_FITTING_WAIT_DAYS,
  summarizeDashboard,
  type ActionItem,
} from '../dashboard-model';
import '../dashboard.css';

const WORKBENCH_TIME_ZONE = 'America/Los_Angeles';

/** Today as `YYYY-MM-DD` in the workbench time zone. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKBENCH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** R&D home: what needs attention today, derived from the live workbench state. */
export function DashboardPage() {
  const navigate = useNavigate();
  const {
    projects,
    projectDetails,
    visits,
    sampleRequests,
    sampleRequestItems,
    sampleShipments,
    configurations,
    registrations,
    appUsers,
  } = useWorkbenchStore();
  const summary = summarizeDashboard({
    today: todayKey(),
    projects,
    projectDetails,
    visits,
    sampleRequests,
    sampleRequestItems,
    sampleShipments,
    configurations,
    registrations,
    appUsers,
  });
  const overdueActions = summary.actions.filter((action) =>
    action.id.startsWith('overdue-'),
  ).length;
  const longWaits = summary.samplesWaitingFitting.filter(
    (wait) => wait.waitingDays > SAMPLE_FITTING_WAIT_DAYS,
  ).length;
  const approvalsPending =
    summary.pendingRegistrations + summary.handoffPending.length;

  return (
    <section className="dashboard">
      <PageHeader
        description="지연된 작업과 도착한 수정 샘플부터 확인하세요."
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_project' },
                { name: 'field_visit' },
                { name: 'field_visit_staff' },
                { name: 'sample_request_item' },
                { name: 'sample_shipment' },
                { name: 'vehicle_product_registration' },
              ]
            : undefined
        }
      />

      {summary.warnings.length > 0 && (
        <section className="dashboard-alerts" role="alert">
          <h2>경고 {summary.warnings.length}건</h2>
          <ul>
            {summary.warnings.map((warning) => (
              <li key={warning.id}>
                <StatusBadge
                  tone="danger"
                  label={
                    warning.kind === 'ORPHAN_VISIT'
                      ? '차량 없음'
                      : warning.kind === 'UNASSIGNED_VISIT'
                        ? '담당자 없음'
                        : '피팅 미예약'
                  }
                />
                <span>{warning.message}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(warning.to)}
                >
                  확인
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dashboard-stats">
        <Card className="dashboard-stat">
          <CardContent>
            <span className="dashboard-stat-label">처리할 작업</span>
            <strong className="dashboard-stat-value">
              {summary.actions.length}
            </strong>
            <span
              className={`dashboard-stat-sub${overdueActions ? ' attention' : ''}`}
            >
              지연 {overdueActions}건 포함
            </span>
          </CardContent>
        </Card>
        <Card className="dashboard-stat">
          <CardContent>
            <span className="dashboard-stat-label">피팅 대기 Sample</span>
            <strong className="dashboard-stat-value">
              {summary.samplesWaitingFitting.length}
            </strong>
            <span
              className={`dashboard-stat-sub${longWaits ? ' attention' : ''}`}
            >
              {SAMPLE_FITTING_WAIT_DAYS}일 초과 {longWaits}건
            </span>
          </CardContent>
        </Card>
        <Card className="dashboard-stat">
          <CardContent>
            <span className="dashboard-stat-label">승인 대기</span>
            <strong className="dashboard-stat-value">{approvalsPending}</strong>
            <span className="dashboard-stat-sub">
              인계 승인 {summary.handoffPending.length} · SKU 등록{' '}
              {summary.pendingRegistrations}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="dashboard-kpis">
        <Kpi label="Active Project" value={summary.activeZones.length} />
        <Kpi label="Overdue" value={summary.overdue.length} attention />
        <Kpi label="Stalled" value={summary.stalled.length} attention />
        <Kpi label="High · Urgent" value={summary.highPriority.length} />
        <Kpi label="3차 이상 Sample" value={summary.repeatSampleCount} />
        <Kpi label="도착 예정 · 도착" value={summary.arrivals.length} />
      </div>

      <Card className="dashboard-panel">
        <CardHeader>
          <CardTitle>
            단계별 Active Project
            <small>{summary.activeZones.length}개 Zone Project</small>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="dashboard-stages">
            {summary.stageCounts.map(({ stage, count }) => (
              <div
                className={`dashboard-stage${count ? ' active' : ''}`}
                key={stage}
              >
                <span>{stage}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="dashboard-columns">
        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>
              먼저 처리할 일<small>{summary.actions.length}건</small>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(ROUTES.vehicleProjects)}
            >
              전체 보기
            </Button>
          </CardHeader>
          <CardContent>
            {summary.actions.length ? (
              summary.actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  owner={findUser(appUsers, action.ownerId)}
                  onOpen={() => navigate(action.to)}
                />
              ))
            ) : (
              <p className="dashboard-empty">
                처리할 작업이 없습니다. 지연·정체·승인 대기 항목이 생기면 여기에
                표시됩니다.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>이번 주 도착</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(ROUTES.samples)}
            >
              배송 보기
            </Button>
          </CardHeader>
          <CardContent>
            {summary.arrivals.length ? (
              summary.arrivals.map((arrival) => (
                <div className="dashboard-arrival" key={arrival.id}>
                  <div className="dashboard-row-text">
                    <strong>{arrival.title}</strong>
                    <span>
                      {arrival.dateLabel} · {arrival.detail}
                    </span>
                  </div>
                  <div className="dashboard-arrival-badges">
                    <StatusBadge label={arrival.status} tone={arrival.tone} />
                    {arrival.isRepeatSample && (
                      <StatusBadge label="반복 샘플" tone="warning" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="dashboard-empty">
                이번 주에 도착했거나 도착 예정인 샘플이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface KpiProps {
  label: string;
  value: number;
  /** Highlight a non-zero value as something to act on. */
  attention?: boolean;
}

function Kpi({ label, value, attention = false }: KpiProps) {
  return (
    <div className={`dashboard-kpi${attention && value ? ' attention' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface ActionRowProps {
  action: ActionItem;
  owner?: AppUser;
  onOpen: () => void;
}

function ActionRow({ action, owner, onOpen }: ActionRowProps) {
  return (
    <div className="dashboard-row">
      <StatusBadge label={action.badge} tone={action.tone} />
      <div className="dashboard-row-text">
        <strong>{action.title}</strong>
        <span>{action.detail}</span>
      </div>
      {owner ? (
        <div className="dashboard-owner">
          <UserAvatar user={owner} />
          <span>{owner.name}</span>
        </div>
      ) : (
        <div className="dashboard-owner unassigned">담당자 미지정</div>
      )}
      <Button size="sm" variant="outline" onClick={onOpen}>
        {action.actionLabel}
      </Button>
    </div>
  );
}
