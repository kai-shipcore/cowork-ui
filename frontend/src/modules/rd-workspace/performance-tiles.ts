import type { VehicleProjectGroup } from '@/shared/types/workbench';
import { stageTarget } from '@/app/stage-duration-model';
import type { StageDurationRevision } from '@/app/stage-duration-model';
import { elapsedDays, median, reportPeriod } from './performance-model';
import { reportDate } from './report-date';

/** Deviation from goal, coloured like the project health legend. */
export type DeviationBand = 'ok' | 'warn' | 'high' | 'critical' | 'none';

export const DEVIATION_LEGEND: readonly {
  band: DeviationBand;
  label: string;
  description: string;
}[] = [
  { band: 'ok', label: 'ok', description: 'On target or better' },
  { band: 'warn', label: '10%', description: 'Within 10% of target' },
  { band: 'high', label: '25%', description: '10–25% off target' },
  { band: 'critical', label: '25%+', description: 'More than 25% off target' },
];

const BAND_RANK: Record<DeviationBand, number> = {
  none: 0,
  ok: 1,
  warn: 2,
  high: 3,
  critical: 4,
};

/** Every stage with a duration across the three pipelines, in workflow order. */
export const ALL_DURATION_STAGES: readonly string[] = [
  'Research',
  'Vehicle Hunt',
  'Scan',
  '3D Model',
  'Fit Review',
  'Design',
  'Sample',
  'Fitting',
];

/** Months covered by one reporting period. */
const PERIOD_MONTHS: Record<string, number> = {
  month: 1,
  quarter: 3,
  year: 12,
};

/** Up to the goal is ok; 10% and 25% over are the warning steps. Missing goals are never scored. */
export function deviationBand(actual?: number, goal?: number): DeviationBand {
  if (actual === undefined || goal === undefined || goal <= 0) return 'none';
  const ratio = actual / goal;
  if (ratio <= 1) return 'ok';
  if (ratio <= 1.1) return 'warn';
  if (ratio <= 1.25) return 'high';
  return 'critical';
}

/** `YYYY-MM` arithmetic in UTC so year boundaries never drift with the machine zone. */
export function shiftMonth(month: string, months: number): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + months, 1))
    .toISOString()
    .slice(0, 7);
}

/** Consecutive periods ending with the reference one, oldest first. */
export function periodSeries(
  month: string,
  mode: string,
  count: number,
): { start: string; end: string }[] {
  const step = PERIOD_MONTHS[mode] ?? 1;
  const periods: { start: string; end: string }[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    periods.push(reportPeriod(shiftMonth(month, -step * index), mode));
  }
  return periods;
}

export interface StageStripItem {
  stage: string;
  /** Median completed duration in days. */
  days?: number;
  count: number;
  band: DeviationBand;
  /** Median goal of the scored records, in days. */
  goalDays?: number;
  /** Median days over the stage goal; negative means under. */
  overDays?: number;
}

/**
 * Stage medians scored against each record's own goal, so mixed products
 * compare fairly. The goal snapshot taken at stage start wins over the
 * current standard.
 */
export function stageStrip(
  projects: readonly VehicleProjectGroup[],
  start: string,
  end: string,
  revisions: readonly StageDurationRevision[],
  stages: readonly string[],
): StageStripItem[] {
  const samples = new Map<string, { days: number; goal?: number }[]>();
  for (const project of projects) {
    for (const zone of project.zoneProjects) {
      if (zone.status === 'CANCELLED' || zone.status === 'MERGED') continue;
      for (const record of zone.stageHistory ?? []) {
        const at = reportDate(record.completedAt);
        const days = elapsedDays(record.startedAt, record.completedAt);
        if (!at || at < start || at >= end || days === undefined) continue;
        const goal =
          record.targetDays ??
          stageTarget(
            revisions,
            zone.productTypeId,
            record.stage,
            record.startedAt,
          ).targetDays;
        samples.set(record.stage, [
          ...(samples.get(record.stage) ?? []),
          { days, goal },
        ]);
      }
    }
  }
  return stages.map((stage) => {
    const list = samples.get(stage) ?? [];
    const scored = list.filter(
      (sample): sample is { days: number; goal: number } =>
        sample.goal !== undefined && sample.goal > 0,
    );
    const ratio = median(scored.map((sample) => sample.days / sample.goal));
    return {
      stage,
      days: median(list.map((sample) => sample.days)),
      count: list.length,
      band: deviationBand(ratio, 1),
      goalDays: median(scored.map((sample) => sample.goal)),
      overDays: median(scored.map((sample) => sample.days - sample.goal)),
    };
  });
}

/** Stages over goal, worst first; stages within goal or without one never qualify. */
export function worstStages(
  items: readonly StageStripItem[],
  count: number,
): StageStripItem[] {
  return items
    .filter((item) => BAND_RANK[item.band] > BAND_RANK.ok)
    .sort(
      (a, b) =>
        BAND_RANK[b.band] - BAND_RANK[a.band] ||
        (b.overDays ?? 0) - (a.overDays ?? 0),
    )
    .slice(0, count);
}

/** Whole weeks until the period ends; 0 once it has ended. */
export function weeksLeft(end: string, today: string): number {
  const days = elapsedDays(today, end);
  return days === undefined ? 0 : Math.ceil(days / 7);
}

/**
 * A completion goal is prorated by elapsed time, so a mid-period shortfall
 * reads as pace rather than failure.
 */
export function completionPace(
  completed: number,
  goal: number | undefined,
  start: string,
  end: string,
  today: string,
): DeviationBand {
  if (goal === undefined || goal <= 0) return 'none';
  const total = elapsedDays(start, end);
  if (!total) return 'none';
  const passed =
    today < start ? 0 : Math.min(total, elapsedDays(start, today) ?? total);
  const expected = goal * (passed / total);
  if (completed >= expected) return 'ok';
  if (completed <= 0) return 'critical';
  return deviationBand(expected, completed);
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Short axis label for a period: `Q2'25`, `Sep'26` or `2026`. */
export function periodLabel(start: string, mode: string): string {
  const [year, month] = start.split('-').map(Number);
  const shortYear = String(year).slice(2);
  if (mode === 'year') return String(year);
  if (mode === 'quarter')
    return `Q${String(Math.floor((month - 1) / 3) + 1)}'${shortYear}`;
  return `${MONTH_NAMES[month - 1]?.slice(0, 3) ?? ''}'${shortYear}`;
}

/** Heading such as `Q3 2026, quarter to date`; ended and future periods say so. */
export function periodTitle(
  period: { start: string; end: string },
  mode: string,
  today: string,
): string {
  const [year, month] = period.start.split('-').map(Number);
  const name =
    mode === 'year'
      ? String(year)
      : mode === 'quarter'
        ? `Q${String(Math.floor((month - 1) / 3) + 1)} ${String(year)}`
        : `${MONTH_NAMES[month - 1] ?? ''} ${String(year)}`;
  const unit =
    mode === 'year' ? 'year' : mode === 'quarter' ? 'quarter' : 'month';
  if (today < period.start) return `${name}, not started`;
  if (today >= period.end) return `${name}, full ${unit}`;
  return `${name}, ${unit} to date`;
}

/** Whole-percent distance from goal; positive means over. */
export function percentOff(actual: number, goal: number): number {
  return Math.round(((actual - goal) / goal) * 100);
}
