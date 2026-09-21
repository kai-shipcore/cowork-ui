import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Box,
  CarFront,
  CheckCheck,
  Eye,
  Package,
  PenTool,
  Plus,
  Scan,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { ProductType } from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import {
  durationStages,
  readStageDurationRevisions,
} from '@/app/stage-duration-model';
import { useWorkbenchStore } from '@/app/workbench-store';
import { reportPeriod, summarizePerformance } from './performance-model';
import { PerformanceTile, type TileBar } from './performance-tile';
import {
  ALL_DURATION_STAGES,
  completionPace,
  DEVIATION_LEGEND,
  deviationBand,
  percentOff,
  periodLabel,
  periodSeries,
  periodTitle,
  stageStrip,
  weeksLeft,
  worstStages,
} from './performance-tiles';
import { useRdRecords } from './use-rd-records';
import './rd-workspace.css';
import './rd-performance.css';

const targetsSchema = z.record(
  z.string(),
  z.object({
    cycle: z.number().positive(),
    completions: z.number().int().positive(),
  }),
);
const EMPTY_TARGETS: z.infer<typeof targetsSchema> = {};

const PERIOD_MODES = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
] as const;
const PRODUCTS: readonly ProductType[] = [
  'Seat Cover',
  'Floor Mat',
  'Car Cover',
];
/** Bars in each tile: the reference period plus the four before it. */
const HISTORY_PERIODS = 5;
const WORST_COUNT = 2;
const STAGE_ICONS: Record<string, LucideIcon> = {
  Research: Search,
  'Vehicle Hunt': CarFront,
  Scan,
  '3D Model': Box,
  'Fit Review': Eye,
  Design: PenTool,
  Sample: Package,
  Fitting: CheckCheck,
};
const STAGE_SHORT_NAMES: Record<string, string> = {
  'Vehicle Hunt': 'Hunt',
  Fitting: 'Fit',
};

function formatDays(days: number): string {
  return Math.abs(days) >= 100 ? days.toFixed(0) : days.toFixed(1);
}

function signed(value: number, unit: string): string {
  return `${value > 0 ? '+' : ''}${formatDays(value)}${unit}`;
}

/** "26% over" reads as the gap to a lower-is-better target. */
function overText(actual: number, goal: number): string {
  const percent = percentOff(actual, goal);
  if (percent === 0) return 'on target';
  return `${String(Math.abs(percent))}% ${percent > 0 ? 'over' : 'under'}`;
}

/** "25% short" reads as the gap to a higher-is-better target. */
function shortText(actual: number, goal: number): string {
  const percent = percentOff(actual, goal);
  if (percent >= 0) return percent === 0 ? 'on target' : 'target met';
  return `${String(Math.abs(percent))}% short`;
}

/** Operational tiles use recorded dates; commercial tiles stay explicitly unconnected. */
export function RdPerformance(): ReactElement {
  const { projects } = useWorkbenchStore();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mode, setMode] = useState('quarter');
  const [product, setProduct] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [revisions] = useState(() => readStageDurationRevisions());
  const { records, save, error, saving } = useRdRecords(
    'coverland-rd-targets-v1',
    targetsSchema,
    EMPTY_TARGETS,
  );
  const [message, setMessage] = useState('');

  const now = today();
  const filtered = projects.filter(
    (project) => product === 'All' || project.product === product,
  );
  const period = reportPeriod(month, mode);
  const report = summarizePerformance(filtered, period.start, period.end);
  const key = period.start + ':' + period.end + ':' + product;
  const targets = Object.prototype.hasOwnProperty.call(records, key)
    ? records[key]
    : undefined;
  const series = periodSeries(month, mode, HISTORY_PERIODS).map((entry) => ({
    ...entry,
    label: periodLabel(entry.start, mode),
    ...summarizePerformance(filtered, entry.start, entry.end),
  }));
  const cycleBars: TileBar[] = series.map((entry) => ({
    key: entry.start,
    label: entry.label,
    value: entry.cycleMedian,
    band: deviationBand(entry.cycleMedian, targets?.cycle),
  }));
  const completionBars: TileBar[] = series.map((entry) => ({
    key: entry.start,
    label: entry.label,
    value: entry.completed,
    band: completionPace(
      entry.completed,
      targets?.completions,
      entry.start,
      entry.end,
      now < entry.end ? now : entry.end,
    ),
  }));
  const selectedProduct = PRODUCTS.find((entry) => entry === product);
  const strip = stageStrip(
    filtered,
    period.start,
    period.end,
    revisions,
    selectedProduct ? durationStages(selectedProduct) : ALL_DURATION_STAGES,
  );
  const worst = worstStages(strip, WORST_COUNT);
  const left = weeksLeft(period.end, now);
  const cycleBand = deviationBand(report.cycleMedian, targets?.cycle);
  const completionBand = completionPace(
    report.completed,
    targets?.completions,
    period.start,
    period.end,
    now,
  );

  return (
    <div className="rd-workspace perf">
      <div className="rd-panel perf-panel">
        <div className="perf-head">
          <div className="perf-title">
            <span className="perf-kicker">Performance</span>
            <h2>{periodTitle(period, mode, now)}</h2>
          </div>
          <div className="perf-segment" role="group" aria-label="Period">
            {PERIOD_MODES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={mode === entry.value}
                onClick={() => {
                  setMode(entry.value);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <select
            className="perf-product"
            aria-label="Product"
            value={product}
            onChange={(event) => {
              setProduct(event.target.value);
            }}
          >
            <option>All</option>
            {PRODUCTS.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            aria-label="Reference month and targets"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen((open) => !open);
            }}
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
          <Button asChild>
            <Link to="/vehicle-projects?new=1">
              <Plus aria-hidden="true" /> New
            </Link>
          </Button>
        </div>
        {filtersOpen && (
          <form
            key={key + JSON.stringify(targets)}
            className="perf-filters"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const cycle = Number(data.get('cycle'));
              const completions = Number(data.get('completions'));
              void save((current) => ({
                ...current,
                [key]: { cycle, completions },
              })).then((ok) => {
                if (ok)
                  setMessage('Targets saved for this period and product.');
              });
            }}
          >
            <label>
              Reference month
              <input
                type="month"
                min="1900-01"
                max="9998-12"
                required
                value={month}
                onChange={(event) => {
                  if (
                    /^\d{4}-\d{2}$/.test(event.target.value) &&
                    event.target.value >= '1900-01' &&
                    event.target.value <= '9998-12'
                  )
                    setMonth(event.target.value);
                }}
              />
            </label>
            <label>
              Cycle time target (days)
              <input
                type="number"
                name="cycle"
                min={1}
                step="0.1"
                required
                defaultValue={targets?.cycle}
              />
            </label>
            <label>
              Completion target (count)
              <input
                type="number"
                name="completions"
                min={1}
                step={1}
                required
                defaultValue={targets?.completions}
              />
            </label>
            <Button type="submit" disabled={saving}>
              Save targets
            </Button>
            <small className="perf-filters-note">
              Targets are stored in this browser for this period and product.
              Stage targets come from Stage Standards. Company policies are
              unchanged.
            </small>
          </form>
        )}
        {error && (
          <p role="alert" className="rd-error px-5 pt-3">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="px-5 pt-3">
            {message}
          </p>
        )}
        <div className="perf-grading" aria-label="Grading">
          <span className="perf-kicker">Grading</span>
          {DEVIATION_LEGEND.map((entry) => (
            <span key={entry.band} data-band={entry.band}>
              <span className="perf-swatch" aria-hidden="true" />
              {entry.description}
            </span>
          ))}
        </div>
        <div className="perf-groups">
          <section className="perf-group" aria-labelledby="perf-leading">
            <h3 id="perf-leading" className="perf-group-title" data-tone="lead">
              Leading <span>What the team controls this period</span>
            </h3>
            <div className="perf-tiles">
              <PerformanceTile
                title="Cycle time — research to handoff"
                band={cycleBand}
                value={
                  report.cycleMedian === undefined
                    ? '—'
                    : formatDays(report.cycleMedian)
                }
                unit={report.cycleMedian === undefined ? undefined : 'd'}
                description={`median per completed project · ${String(report.cycleSamples)} records`}
                target={
                  targets
                    ? `Target ${formatDays(targets.cycle)} d` +
                      (report.cycleMedian === undefined
                        ? ''
                        : ` · ${overText(report.cycleMedian, targets.cycle)}`)
                    : 'No target set · open the targets panel to add one'
                }
                bars={cycleBars}
                targetBar={targets?.cycle}
              />
              <PerformanceTile
                title="Projects completed"
                band={completionBand}
                value={String(report.completed)}
                description={`handed off this ${mode}`}
                target={
                  targets
                    ? `Target ${String(targets.completions)} · ${shortText(report.completed, targets.completions)}` +
                      (left > 0 ? ` · ${String(left)} weeks left` : '')
                    : left > 0
                      ? `No target set · ${String(left)} weeks left`
                      : 'No target set'
                }
                bars={completionBars}
                targetBar={targets?.completions}
              />
            </div>
          </section>
          <section className="perf-group" aria-labelledby="perf-lagging">
            <h3 id="perf-lagging" className="perf-group-title" data-tone="lag">
              Lagging{' '}
              <span>What the customer sees, one to two periods later</span>
            </h3>
            <div className="perf-tiles">
              <PerformanceTile
                title="Fitment complaints"
                band="none"
                value="—"
                description="complaints as a share of units sold"
                target="CS / Sales data not connected · no rate without a denominator"
              />
              <PerformanceTile
                title="Sales of new releases"
                band="none"
                value="—"
                description="units, first 90 days after launch"
                target="Sales channels not connected · needs launch dates and orders"
              />
            </div>
          </section>
        </div>
        <div className="perf-section-head">
          <h3>Cycle time by stage</h3>
          <span>
            The same grading, applied to each completed stage in this period.
            {worst.length > 0 &&
              ` ${worst
                .map((item) => STAGE_SHORT_NAMES[item.stage] ?? item.stage)
                .join(' and ')} account for most of the gap to target.`}
          </span>
        </div>
        <div
          className="perf-strip"
          role="list"
          aria-label="Cycle time by stage"
        >
          {strip.map((item, index) => (
            <div
              key={item.stage}
              className="perf-stage"
              role="listitem"
              data-band={item.band}
              title={`${item.stage} · ${String(item.count)} completed records`}
            >
              <span className="perf-stage-name">
                <span className="perf-swatch" aria-hidden="true" />
                {index + 1} {STAGE_SHORT_NAMES[item.stage] ?? item.stage}
              </span>
              <strong>
                {item.days === undefined ? (
                  '—'
                ) : (
                  <>
                    {formatDays(item.days)}
                    <small>d</small>
                  </>
                )}
              </strong>
              <small className="perf-stage-target">
                {item.goalDays === undefined
                  ? 'No target'
                  : `Target ${formatDays(item.goalDays)} d` +
                    (item.overDays !== undefined &&
                    item.overDays > 0 &&
                    item.band !== 'ok'
                      ? ` · ${signed(item.overDays, '')}`
                      : '')}
              </small>
            </div>
          ))}
        </div>
        <div className="perf-foot">
          <div className="perf-worst">
            <span className="perf-kicker">Worst two</span>
            {worst.length ? (
              worst.map((item) => {
                const Icon = STAGE_ICONS[item.stage] ?? Box;
                return (
                  <Link
                    key={item.stage}
                    to="/vehicle-projects?view=board"
                    className="perf-worst-item"
                    data-band={item.band}
                  >
                    <span className="perf-swatch" aria-hidden="true" />
                    <Icon aria-hidden="true" />
                    <strong>
                      {STAGE_SHORT_NAMES[item.stage] ?? item.stage}
                      {item.overDays !== undefined &&
                        ` ${signed(item.overDays, 'd')}`}
                    </strong>
                    <span>{item.count} records →</span>
                  </Link>
                );
              })
            ) : (
              <span>
                No stage over target
                {revisions.length ? '' : ' · Stage Standards not set'}
              </span>
            )}
          </div>
          <small>
            {period.start} to {period.end} · {product} · Browser-local records
          </small>
        </div>
      </div>
      <div className="rd-panel">
        <details>
          <summary className="cursor-pointer text-sm">
            Production handoffs included · {report.completed}
          </summary>
          {report.completedProjects.map(({ project, zone }) => (
            <div className="rd-toolbar mt-3" key={zone.id}>
              <Link
                to={
                  '/vehicle-projects?project=' +
                  project.id +
                  '&zone=' +
                  zone.code
                }
              >
                {project.vehicle} · {zone.label}
              </Link>
              <small>{zone.productionHandoff?.completedAt.slice(0, 10)}</small>
            </div>
          ))}
          {!report.completed && (
            <p className="mt-3">
              No completed records. Missing dates in legacy data are not
              fabricated.
            </p>
          )}
        </details>
      </div>
    </div>
  );
}
