import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
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
                  onClick={() => {
                    // React Router handles route errors; clicks do not await navigation.
                    void navigate(warning.to);
                  }}
                >
                  확인
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dashboard-stats">
        <SummaryCard
          label="처리할 작업"
          value={summary.actions.length}
          description={`지연 ${String(overdueActions)}건 포함`}
          className={
            overdueActions
              ? '[&_.text-xs]:text-amber-700 dark:[&_.text-xs]:text-amber-400'
              : undefined
          }
        />
        <SummaryCard
          label="피팅 대기 Sample"
          value={summary.samplesWaitingFitting.length}
          description={`${String(SAMPLE_FITTING_WAIT_DAYS)}일 초과 ${String(longWaits)}건`}
          className={
            longWaits
              ? '[&_.text-xs]:text-amber-700 dark:[&_.text-xs]:text-amber-400'
              : undefined
          }
        />
        <SummaryCard
          label="승인 대기"
          value={approvalsPending}
          description={`인계 승인 ${String(summary.handoffPending.length)} · SKU 등록 ${String(summary.pendingRegistrations)}`}
        />
      </div>

      <div className="dashboard-kpis">
        <SummaryCard
          label="Active Project"
          value={summary.activeZones.length}
        />
        <SummaryCard
          label="Overdue"
          value={summary.overdue.length}
          className={
            summary.overdue.length
              ? '[&_strong]:text-red-600 dark:[&_strong]:text-red-400'
              : undefined
          }
        />
        <SummaryCard
          label="Stalled"
          value={summary.stalled.length}
          className={
            summary.stalled.length
              ? '[&_strong]:text-red-600 dark:[&_strong]:text-red-400'
              : undefined
          }
        />
        <SummaryCard
          label="High · Urgent"
          value={summary.highPriority.length}
        />
        <SummaryCard
          label="3차 이상 Sample"
          value={summary.repeatSampleCount}
        />
        <SummaryCard label="도착 예정 · 도착" value={summary.arrivals.length} />
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
              <SummaryCard
                key={stage}
                label={stage}
                value={count}
                className={
                  count
                    ? 'flex-1 min-w-25 border-primary/25 bg-primary/5'
                    : 'flex-1 min-w-25'
                }
              />
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
              onClick={() => {
                // React Router handles route errors; clicks do not await navigation.
                void navigate(ROUTES.vehicleProjects);
              }}
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
                  onOpen={() => {
                    // React Router handles route errors; clicks do not await navigation.
                    void navigate(action.to);
                  }}
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
              onClick={() => {
                // React Router handles route errors; clicks do not await navigation.
                void navigate(ROUTES.samples);
              }}
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
