import type {
  AppUser,
  ProjectDetailSnapshot,
  ProjectStage,
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
  StatusTone,
  VehicleConfiguration,
  VehicleProductRegistration,
  VehicleProjectGroup,
  VehicleZoneProject,
  Visit,
} from '@/shared/types/workbench';
import { ROUTES } from '@/constants/routes';

/** A received sample with no fitting booked for this long is a warning. */
export const SAMPLE_FITTING_WAIT_DAYS = 7;
/** No activity on a zone project for this long marks it stalled. */
export const STALLED_DAYS = 14;
/** Arrivals (past and expected) shown on the dashboard fall in this window. */
export const ARRIVAL_WINDOW_DAYS = 7;
/** A sample round at or above this is a repeat sample worth calling out. */
export const REPEAT_SAMPLE_ROUND = 3;

/** Every stage across the product pipelines, in workflow order. */
const STAGE_ORDER: readonly ProjectStage[] = [
  'Research',
  'Vehicle Hunt',
  'Scan',
  '3D Model',
  'Fit Review',
  'Design',
  'Sample',
  'Fitting',
];

export interface DashboardInput {
  /** `YYYY-MM-DD` in the workbench time zone. */
  today: string;
  projects: readonly VehicleProjectGroup[];
  projectDetails: Readonly<Record<string, ProjectDetailSnapshot>>;
  visits: readonly Visit[];
  sampleRequests: readonly SampleRequest[];
  sampleRequestItems: readonly SampleRequestItem[];
  sampleShipments: readonly SampleShipment[];
  configurations: readonly VehicleConfiguration[];
  registrations: readonly VehicleProductRegistration[];
  appUsers: readonly AppUser[];
}

/** A zone project together with the group that owns it. */
export interface DashboardZone extends VehicleZoneProject {
  project: VehicleProjectGroup;
}

export interface SampleWait {
  requestId: string;
  projectGroupId: string;
  vehicle: string;
  product: string;
  round: number;
  receivedAt: string;
  waitingDays: number;
}

export type DashboardWarningKind =
  'SAMPLE_WAITING' | 'UNASSIGNED_VISIT' | 'ORPHAN_VISIT';

export interface DashboardWarning {
  id: string;
  kind: DashboardWarningKind;
  message: string;
  to: string;
}

export interface ActionItem {
  id: string;
  tone: StatusTone;
  badge: string;
  title: string;
  detail: string;
  ownerId?: string;
  actionLabel: string;
  to: string;
}

export interface ArrivalItem {
  id: string;
  title: string;
  detail: string;
  dateLabel: string;
  status: string;
  tone: StatusTone;
  isRepeatSample: boolean;
}

export interface DashboardSummary {
  stageCounts: ReadonlyArray<{ stage: ProjectStage; count: number }>;
  activeZones: readonly DashboardZone[];
  overdue: readonly DashboardZone[];
  stalled: readonly DashboardZone[];
  highPriority: readonly DashboardZone[];
  samplesWaitingFitting: readonly SampleWait[];
  pendingRegistrations: number;
  handoffPending: readonly DashboardZone[];
  repeatSampleCount: number;
  arrivals: readonly ArrivalItem[];
  warnings: readonly DashboardWarning[];
  actions: readonly ActionItem[];
}

/** Whole days from `from` (date or ISO datetime) to `to` (`YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

function zoneLink(zone: DashboardZone): string {
  return `${ROUTES.vehicleProjects}?project=${encodeURIComponent(zone.project.id)}&zone=${encodeURIComponent(zone.code)}`;
}

function visitLabel(visit: Visit): string {
  return `${visit.vehicle} · ${visit.kind === 'SCAN' ? '스캔' : '피팅'} 방문`;
}

/**
 * Zone projects still in development. The saved detail snapshot carries the
 * live stage once a project has been worked on; the seed row is the fallback.
 */
function activeZones(input: DashboardInput): DashboardZone[] {
  return input.projects.flatMap((project) => {
    const zones: readonly VehicleZoneProject[] =
      input.projectDetails[project.id]?.zones ?? project.zoneProjects;
    return zones
      .filter(
        (zone) =>
          zone.status !== 'CANCELLED' && zone.currentStage !== 'Approved',
      )
      .map((zone) => ({ ...zone, project }));
  });
}

function samplesWaitingFitting(input: DashboardInput): SampleWait[] {
  return input.sampleRequests.flatMap((request) => {
    const received = input.sampleRequestItems.filter(
      (item) =>
        item.sampleRequestId === request.id && Boolean(item.sampleReceivedAt),
    );
    if (!received.length) return [];
    const project = input.projects.find(
      (candidate) => candidate.id === request.projectGroupId,
    );
    const zones =
      input.projectDetails[request.projectGroupId]?.zones ??
      project?.zoneProjects ??
      [];
    // Nothing left to fit once every zone is approved.
    if (zones.length && zones.every((zone) => zone.currentStage === 'Approved'))
      return [];
    const receivedDates = received
      .map((item) => item.sampleReceivedAt ?? '')
      .sort();
    const receivedAt = receivedDates[receivedDates.length - 1];
    if (!receivedAt) return [];
    const fittingVisits = input.visits.filter(
      (visit) =>
        visit.projectGroupId === request.projectGroupId &&
        visit.kind === 'FITTING',
    );
    const scheduled = fittingVisits.some(
      (visit) => visit.status === 'SCHEDULED',
    );
    const fittedSince = fittingVisits.some(
      (visit) =>
        visit.status === 'COMPLETED' && visit.date >= receivedAt.slice(0, 10),
    );
    if (scheduled || fittedSince) return [];
    return [
      {
        requestId: request.id,
        projectGroupId: request.projectGroupId,
        vehicle: request.vehicle,
        product: request.product,
        round: Math.max(...received.map((item) => item.sampleRound)),
        receivedAt,
        waitingDays: daysBetween(receivedAt, input.today),
      },
    ];
  });
}

/** A scheduled visit whose vehicle no longer exists in the registry. */
function isOrphanVisit(visit: Visit, input: DashboardInput): boolean {
  const project = input.projects.find(
    (candidate) => candidate.id === visit.projectGroupId,
  );
  if (!project) return true;
  const hasConfiguration = input.configurations.some(
    (configuration) => configuration.id === project.vehicleResearchId,
  );
  if (!hasConfiguration) return true;
  const zones =
    input.projectDetails[project.id]?.zones ?? project.zoneProjects;
  const targets = zones.filter((zone) =>
    visit.vehicleProjectIds.includes(zone.id),
  );
  return (
    visit.vehicleProjectIds.length > 0 &&
    (targets.length === 0 ||
      targets.every((zone) => zone.status === 'CANCELLED'))
  );
}

interface DatedArrival {
  sortKey: string;
  item: ArrivalItem;
}

function arrivals(input: DashboardInput): ArrivalItem[] {
  const requestById = new Map(
    input.sampleRequests.map((request) => [request.id, request] as const),
  );
  const dated = input.sampleShipments.flatMap(
    (shipment): DatedArrival[] => {
      const items = input.sampleRequestItems.filter(
        (item) => item.sampleShipmentId === shipment.id,
      );
      const request = items[0]
        ? requestById.get(items[0].sampleRequestId)
        : undefined;
      if (!request) return [];
      const round = Math.max(...items.map((item) => item.sampleRound));
      const title = `${request.vehicle} · ${round}차`;
      const detail = `${request.product} · ${shipment.factory}`;
      const isRepeatSample = round >= REPEAT_SAMPLE_ROUND;
      if (shipment.arrivedAt) {
        const age = daysBetween(shipment.arrivedAt, input.today);
        if (age < 0 || age > ARRIVAL_WINDOW_DAYS) return [];
        const verified = items.every((item) => Boolean(item.verifiedAt));
        return [
          {
            sortKey: shipment.arrivedAt.slice(0, 10),
            item: {
              id: shipment.id,
              title,
              detail,
              dateLabel: '도착 완료',
              status: verified ? '검증 완료' : '검증 대기',
              tone: verified ? 'success' : 'warning',
              isRepeatSample,
            },
          },
        ];
      }
      if (!shipment.shippedAt) return [];
      const expected = shipment.expectedArrivalDate;
      const daysOut = expected ? daysBetween(input.today, expected) : 0;
      if (daysOut > ARRIVAL_WINDOW_DAYS) return [];
      return [
        {
          sortKey: expected ?? '9999',
          item: {
            id: shipment.id,
            title,
            detail,
            dateLabel: expected ? formatMonthDay(expected) : '도착일 미정',
            status: daysOut < 0 ? '지연' : '운송 중',
            tone: daysOut < 0 ? 'danger' : 'neutral',
            isRepeatSample,
          },
        },
      ];
    },
  );
  return dated
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => entry.item);
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return month && day ? `${month}월 ${day}일` : date;
}

/** Everything the dashboard shows, derived from workbench state. */
export function summarizeDashboard(input: DashboardInput): DashboardSummary {
  const zones = activeZones(input);
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: zones.filter((zone) => zone.currentStage === stage).length,
  }));
  const overdue = zones.filter(
    (zone) =>
      zone.status !== 'ON_HOLD' &&
      Boolean(zone.targetAt) &&
      daysBetween(zone.targetAt ?? '', input.today) > 0,
  );
  const overdueIds = new Set(overdue.map((zone) => zone.id));
  const stalled = zones.filter(
    (zone) =>
      !overdueIds.has(zone.id) &&
      zone.status !== 'ON_HOLD' &&
      daysBetween(zone.lastActivityAt ?? zone.project.created, input.today) >=
        STALLED_DAYS,
  );
  const highPriority = zones.filter(
    (zone) => zone.priority === 'HIGH' || zone.priority === 'URGENT',
  );
  const waits = samplesWaitingFitting(input);
  const scheduledVisits = input.visits.filter(
    (visit) => visit.status === 'SCHEDULED',
  );
  const orphanVisits = scheduledVisits.filter((visit) =>
    isOrphanVisit(visit, input),
  );
  const unassignedVisits = scheduledVisits.filter(
    (visit) =>
      !orphanVisits.includes(visit) && !(visit.staffIds?.length ?? 0),
  );
  const handoffPending = zones.filter(
    (zone) =>
      zone.currentStage === 'Fitting' &&
      input.visits.some(
        (visit) =>
          visit.kind === 'FITTING' &&
          visit.status === 'COMPLETED' &&
          visit.result !== 'FAIL' &&
          visit.vehicleProjectIds.includes(zone.id),
      ),
  );
  const pendingRegistrations = input.registrations.filter(
    (registration) => !registration.approvedAt,
  ).length;
  const repeatSampleCount = new Set(
    input.sampleRequestItems
      .filter((item) => item.sampleRound >= REPEAT_SAMPLE_ROUND)
      .map((item) => item.sampleRequestId),
  ).size;

  const warnings: DashboardWarning[] = [
    ...orphanVisits.map((visit) => ({
      id: `orphan-${visit.id}`,
      kind: 'ORPHAN_VISIT' as const,
      message: `${visitLabel(visit)} · 차량이 목록에서 사라졌습니다 (${visit.date} ${visit.dealer})`,
      to: ROUTES.huntBoard,
    })),
    ...unassignedVisits.map((visit) => ({
      id: `unassigned-${visit.id}`,
      kind: 'UNASSIGNED_VISIT' as const,
      message: `${visitLabel(visit)} · 담당자가 없습니다 (${visit.date} ${visit.time} ${visit.dealer})`,
      to: ROUTES.huntBoard,
    })),
    ...waits
      .filter((wait) => wait.waitingDays > SAMPLE_FITTING_WAIT_DAYS)
      .map((wait) => ({
        id: `sample-${wait.requestId}`,
        kind: 'SAMPLE_WAITING' as const,
        message: `${wait.vehicle} ${wait.round}차 샘플 · 입고 후 ${wait.waitingDays}일째 피팅 예약이 없습니다`,
        to: ROUTES.huntBoard,
      })),
  ];

  const todayVisits = scheduledVisits.filter(
    (visit) => visit.date === input.today,
  );
  const actions: ActionItem[] = [
    ...orphanVisits.map((visit) => ({
      id: `orphan-${visit.id}`,
      tone: 'danger' as const,
      badge: '차량 없음',
      title: visitLabel(visit),
      detail: `${visit.dealer} · ${visit.date} ${visit.time}`,
      ownerId: visit.staffIds?.[0],
      actionLabel: '방문 보기',
      to: ROUTES.huntBoard,
    })),
    ...unassignedVisits.map((visit) => ({
      id: `unassigned-${visit.id}`,
      tone: 'warning' as const,
      badge: '담당자 없음',
      title: visitLabel(visit),
      detail: `${visit.dealer} · ${visit.date} ${visit.time}`,
      actionLabel: '담당자 지정',
      to: ROUTES.huntBoard,
    })),
    ...waits
      .filter((wait) => wait.waitingDays > SAMPLE_FITTING_WAIT_DAYS)
      .map((wait) => ({
        id: `sample-${wait.requestId}`,
        tone: 'warning' as const,
        badge: `${wait.waitingDays}일 대기`,
        title: `${wait.vehicle} · ${wait.round}차 샘플 피팅 예약`,
        detail: `${wait.product} · ${wait.requestId} · 입고 ${wait.receivedAt.slice(0, 10)}`,
        actionLabel: '예약하기',
        to: ROUTES.huntBoard,
      })),
    ...overdue.map((zone) => ({
      id: `overdue-${zone.id}`,
      tone: 'danger' as const,
      badge: `${daysBetween(zone.targetAt ?? '', input.today)}일 지연`,
      title: `${zone.project.vehicle} · ${zone.label} ${zone.currentStage}`,
      detail: `${zone.project.product} · ${zone.id}`,
      ownerId: zone.managerId,
      actionLabel: '프로젝트 열기',
      to: zoneLink(zone),
    })),
    ...todayVisits.map((visit) => ({
      id: `today-${visit.id}`,
      tone: 'cyan' as const,
      badge: '오늘 예정',
      title: visitLabel(visit),
      detail: `${visit.time} · ${visit.dealer}`,
      ownerId: visit.staffIds?.[0],
      actionLabel: '방문 보기',
      to: ROUTES.huntBoard,
    })),
    ...handoffPending.map((zone) => ({
      id: `handoff-${zone.id}`,
      tone: 'purple' as const,
      badge: '승인 대기',
      title: `${zone.project.vehicle} · ${zone.label} 인계 승인`,
      detail: `${zone.project.product} · 피팅 PASS · ${zone.id}`,
      ownerId: zone.managerId,
      actionLabel: '검토하기',
      to: zoneLink(zone),
    })),
    ...input.registrations
      .filter((registration) => !registration.approvedAt)
      .map((registration) => ({
        id: `registration-${registration.id}`,
        tone: 'purple' as const,
        badge: '승인 대기',
        title: `SKU 등록 요청 ${registration.id}`,
        detail: `요청 ${registration.requestedAt.slice(0, 10)}`,
        ownerId: registration.requestedBy,
        actionLabel: '검토하기',
        to: ROUTES.productRegistrations,
      })),
    ...stalled.map((zone) => ({
      id: `stalled-${zone.id}`,
      tone: 'warning' as const,
      badge: `${daysBetween(zone.lastActivityAt ?? zone.project.created, input.today)}일 정체`,
      title: `${zone.project.vehicle} · ${zone.label} ${zone.currentStage}`,
      detail: `${zone.project.product} · ${zone.id}`,
      ownerId: zone.managerId,
      actionLabel: '프로젝트 열기',
      to: zoneLink(zone),
    })),
  ];

  return {
    stageCounts,
    activeZones: zones,
    overdue,
    stalled,
    highPriority,
    samplesWaitingFitting: waits,
    pendingRegistrations,
    handoffPending,
    repeatSampleCount,
    arrivals: arrivals(input),
    warnings,
    actions,
  };
}
