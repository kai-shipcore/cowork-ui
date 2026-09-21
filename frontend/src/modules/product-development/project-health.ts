import type {
  VehicleProjectGroup,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import { reportDate } from '@/modules/rd-workspace/report-date';

export const PROJECT_HEALTH = [
  { value: 'on-track', label: 'On track' },
  { value: 'watch', label: 'Watch' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'late', label: 'Late' },
  { value: 'unknown', label: '정보 부족' },
  { value: 'complete', label: '완료' },
  { value: 'inactive', label: '취소·병합' },
] as const;
export type ProjectHealth = (typeof PROJECT_HEALTH)[number]['value'];
export type ProjectHealthFilter = 'all' | ProjectHealth;

interface HealthResult {
  value: ProjectHealth;
  reason: string;
}

/** Only the current, unfinished stage can supply the board's stage deadline. */
export function currentStageTiming(zone: VehicleZoneProject) {
  return zone.stageHistory
    ?.filter((entry) => entry.stage === zone.currentStage && !entry.completedAt)
    .slice(-1)[0];
}

function calendarDay(value?: string): number | undefined {
  const date = reportDate(value);
  if (!date) return undefined;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    return undefined;
  return timestamp / 86_400_000;
}

/** Prototype thresholds use LA calendar days, never infer progress from missing records. */
export function projectHealth(
  zone: VehicleZoneProject,
  currentDate: string,
): HealthResult {
  if (zone.status === 'CANCELLED' || zone.status === 'MERGED') {
    return {
      value: 'inactive',
      reason:
        zone.status === 'CANCELLED'
          ? '취소된 프로젝트'
          : '다른 프로젝트로 병합됨',
    };
  }
  if (zone.currentStage === 'Approved')
    return { value: 'complete', reason: '개발 완료 · 일정 위험도 집계 제외' };
  const current = calendarDay(currentDate);
  const target = calendarDay(
    currentStageTiming(zone)?.targetDueAt ?? zone.targetAt,
  );
  const activity = calendarDay(zone.lastActivityAt);
  if (current === undefined)
    return { value: 'unknown', reason: '기준일 확인 필요' };
  const remaining = target === undefined ? undefined : target - current;
  if (remaining !== undefined && remaining < 0)
    return { value: 'late', reason: `목표일 ${String(-remaining)}일 초과` };
  if (zone.status === 'ON_HOLD')
    return { value: 'at-risk', reason: '진행 보류 중' };
  if (remaining !== undefined && remaining <= 2)
    return { value: 'at-risk', reason: `목표일까지 ${String(remaining)}일` };
  const idle = activity === undefined ? undefined : current - activity;
  if (idle !== undefined && idle >= 14)
    return { value: 'at-risk', reason: `최근 활동 후 ${String(idle)}일 경과` };
  if (remaining === undefined)
    return { value: 'unknown', reason: '목표일 미지정 또는 날짜 확인 필요' };
  if (remaining <= 7)
    return { value: 'watch', reason: `목표일까지 ${String(remaining)}일` };
  if (idle === undefined || idle < 0)
    return { value: 'unknown', reason: '최근 활동 기록 확인 필요' };
  if (idle >= 7)
    return { value: 'watch', reason: `최근 활동 후 ${String(idle)}일 경과` };
  return {
    value: 'on-track',
    reason: `목표일까지 ${String(remaining)}일 · 최근 활동 ${String(idle)}일 전`,
  };
}

/** Unknown URL values safely select all projects. */
export function parseHealthFilter(value: string | null): ProjectHealthFilter {
  return PROJECT_HEALTH.find((item) => item.value === value)?.value ?? 'all';
}

/** Filter individual zone cards, keeping their vehicle grouping intact. */
export function filterProjectsByHealth(
  projects: readonly VehicleProjectGroup[],
  filter: ProjectHealthFilter,
  currentDate: string,
): VehicleProjectGroup[] {
  return projects.flatMap((project) => {
    const zoneProjects = project.zoneProjects.filter(
      (zone) =>
        filter === 'all' || projectHealth(zone, currentDate).value === filter,
    );
    return zoneProjects.length ? [{ ...project, zoneProjects }] : [];
  });
}

/** Counts reflect search/product/stage matches before applying the health filter. */
export function countProjectHealth(
  projects: readonly VehicleProjectGroup[],
  currentDate: string,
): Record<ProjectHealthFilter, number> {
  const counts: Record<ProjectHealthFilter, number> = {
    all: 0,
    'on-track': 0,
    watch: 0,
    'at-risk': 0,
    late: 0,
    unknown: 0,
    complete: 0,
    inactive: 0,
  };
  for (const project of projects) {
    for (const zone of project.zoneProjects) {
      counts.all += 1;
      counts[projectHealth(zone, currentDate).value] += 1;
    }
  }
  return counts;
}
