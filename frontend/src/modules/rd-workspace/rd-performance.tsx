import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { today } from '@/modules/operations/operations-model';
import { useWorkbenchStore } from '@/app/workbench-store';
import { reportPeriod, summarizePerformance } from './performance-model';
import { useRdRecords } from './use-rd-records';
import './rd-workspace.css';

const targetsSchema = z.record(
  z.string(),
  z.object({
    cycle: z.number().positive(),
    completions: z.number().int().positive(),
  }),
);
const EMPTY_TARGETS: z.infer<typeof targetsSchema> = {};

/** Operational measurements use recorded dates; commercial KPIs remain explicitly unconnected. */
export function RdPerformance(): ReactElement {
  const { projects } = useWorkbenchStore();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mode, setMode] = useState('quarter');
  const [product, setProduct] = useState('All');
  const { records, save, error, saving } = useRdRecords(
    'coverland-rd-targets-v1',
    targetsSchema,
    EMPTY_TARGETS,
  );
  const [message, setMessage] = useState('');
  const period = reportPeriod(month, mode);
  const report = summarizePerformance(
    projects.filter(
      (project) => product === 'All' || project.product === product,
    ),
    period.start,
    period.end,
  );
  const key = period.start + ':' + period.end + ':' + product;
  const targets = new Map(Object.entries(records)).get(key);
  return (
    <div className="rd-workspace">
      <div className="rd-panel">
        <div className="rd-toolbar">
          <h2>R&D Performance</h2>
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
            Period
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
              }}
            >
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </label>
          <label>
            Product
            <select
              value={product}
              onChange={(event) => {
                setProduct(event.target.value);
              }}
            >
              <option>All</option>
              <option>Seat Cover</option>
              <option>Floor Mat</option>
              <option>Car Cover</option>
            </select>
          </label>
        </div>
        <p>
          {period.start} inclusive to {period.end} exclusive · Project count =
          Configuration × Zone · Browser-local records
        </p>
        <div className="rd-fields">
          <div className="rd-panel">
            <small>Median development duration</small>
            <h1>
              {report.cycleMedian === undefined
                ? '—'
                : report.cycleMedian.toFixed(1) + 'Day'}
            </h1>
            <p>
              Stage start history → Production handoff complete · Valid records{' '}
              {report.cycleSamples}
              items{targets && ` / Target ${String(targets.cycle)} days`}
            </p>
            {targets && report.cycleMedian !== undefined && (
              <p>
                Against target {(report.cycleMedian - targets.cycle).toFixed(1)}{' '}
                days{' '}
                {report.cycleMedian <= targets.cycle
                  ? '· Within target'
                  : '· Over target'}
              </p>
            )}
          </div>
          <div className="rd-panel">
            <small>Production handoffs completed</small>
            <h1>{report.completed} items</h1>
            <p>
              {targets
                ? `Target ${String(targets.completions)} items · Achievement rate ${String(Math.round((report.completed / targets.completions) * 100))}%`
                : 'Set a comparison target.'}
            </p>
          </div>
          <div className="rd-panel">
            <small>Complaints as a share of sales</small>
            <h2>CS / Sales data not connected</h2>
            <p>Rates are not estimated without a denominator.</p>
          </div>
          <div className="rd-panel">
            <small>Sales in first 90 days after launch</small>
            <h2>Sales channels not connected</h2>
            <p>Calculated after launch dates and order data are connected.</p>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm">
            Comparison targets for this period / product
          </summary>
          <form
            key={key + JSON.stringify(targets)}
            className="rd-fields mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const cycle = Number(data.get('cycle'));
              const completions = Number(data.get('completions'));
              void save((current) => ({
                ...current,
                [key]: { cycle, completions },
              })).then((ok) => {
                if (ok) setMessage('Comparison targets saved.');
              });
            }}
          >
            <label>
              Duration target (days)
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
          </form>
          <p>
            Local comparison targets only. Company policies and individual
            permissions are unchanged.
          </p>
        </details>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
      </div>
      <div className="rd-panel">
        <h2>Duration by stage · Completed stages only</h2>
        <p>
          Includes only stages actually completed in the selected period.
          In-progress stages and missing history are excluded.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Median (days)</th>
                <th>Completed records</th>
              </tr>
            </thead>
            <tbody>
              {report.stages.map((stage) => (
                <tr key={stage.stage}>
                  <td>{stage.stage}</td>
                  <td>{stage.days?.toFixed(1)}</td>
                  <td>{stage.count} items</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.stages.length && (
          <p className="rd-empty">No stages completed in this period.</p>
        )}
      </div>
      <div className="rd-panel">
        <h2>Production handoffs included</h2>
        {report.completedProjects.map(({ project, zone }) => (
          <div className="rd-toolbar" key={zone.id}>
            <Link
              to={
                '/vehicle-projects?project=' + project.id + '&zone=' + zone.code
              }
            >
              {project.vehicle} · {zone.label}
            </Link>
            <small>{zone.productionHandoff?.completedAt.slice(0, 10)}</small>
          </div>
        ))}
        {!report.completed && (
          <p>
            No completed records. Missing dates in legacy data are not
            fabricated.
          </p>
        )}
      </div>
    </div>
  );
}
