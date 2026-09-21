import type { VehicleProjectGroup } from '@/shared/types/workbench';
import { reportDate } from './report-date';

/** UTC date-key arithmetic avoids machine timezone drift in period boundaries. */
export function reportPeriod(
  month: string,
  mode: string,
): { start: string; end: string } {
  const [year, number] = month.split('-').map(Number);
  if (
    !/^\d{4}-\d{2}$/.test(month) ||
    number < 1 ||
    number > 12 ||
    year < 1900 ||
    year > 9998
  )
    throw new Error('유효한 기준 월이 필요합니다.');
  const startMonth =
    mode === 'year'
      ? 0
      : mode === 'quarter'
        ? Math.floor((number - 1) / 3) * 3
        : number - 1;
  const length = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, startMonth + length, 1))
      .toISOString()
      .slice(0, 10),
  };
}

/** Missing or reversed timestamps are unknown, never zero-day performance. */
export function elapsedDays(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  return Number.isFinite(days) && days >= 0 ? days : undefined;
}

/** Median excludes no-data records rather than treating them as fast completions. */
export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Completed means recorded production handoff, not a forecast or current stage label. */
export function summarizePerformance(
  projects: readonly VehicleProjectGroup[],
  start: string,
  end: string,
) {
  const zones = projects.flatMap((project) =>
    project.zoneProjects.map((zone) => ({ project, zone })),
  );
  const completed = zones.filter(({ zone }) => {
    const at = reportDate(zone.productionHandoff?.completedAt);
    return (
      at &&
      at >= start &&
      at < end &&
      zone.status !== 'CANCELLED' &&
      zone.status !== 'MERGED'
    );
  });
  const cycles = completed.flatMap(({ zone }) => {
    const starts =
      zone.stageHistory
        ?.map((entry) => entry.startedAt)
        .filter((at) => Number.isFinite(Date.parse(at)))
        .sort() ?? [];
    const days = elapsedDays(starts[0], zone.productionHandoff?.completedAt);
    return days === undefined ? [] : [days];
  });
  const stages = new Map<string, number[]>();
  for (const { zone } of zones) {
    if (zone.status === 'CANCELLED' || zone.status === 'MERGED') continue;
    for (const record of zone.stageHistory ?? []) {
      const at = reportDate(record.completedAt);
      const days = elapsedDays(record.startedAt, record.completedAt);
      if (at && at >= start && at < end && days !== undefined)
        stages.set(record.stage, [...(stages.get(record.stage) ?? []), days]);
    }
  }
  return {
    completed: completed.length,
    cycleMedian: median(cycles),
    cycleSamples: cycles.length,
    completedProjects: completed,
    stages: [...stages].map(([stage, days]) => ({
      stage,
      days: median(days),
      count: days.length,
    })),
  };
}
