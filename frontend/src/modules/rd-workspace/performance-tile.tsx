import type { ReactElement } from 'react';
import type { DeviationBand } from './performance-tiles';

export interface TileBar {
  key: string;
  value?: number;
  band: DeviationBand;
  /** Axis label; only the first bar carries one, the current bar reads "now". */
  label?: string;
}

interface PerformanceTileProps {
  title: string;
  band: DeviationBand;
  value: string;
  unit?: string;
  /** Two short lines beside the number, e.g. "median" / "per completed project". */
  description: string;
  /** Target line, e.g. "Target 94 d · 26% over". */
  target: string;
  /** Oldest first; the last bar is the current period. */
  bars?: readonly TileBar[];
  /** Goal drawn as the grey reference bar after the periods. */
  targetBar?: number;
}

/** Bars never vanish entirely, so an empty period still reads as a slot. */
const MIN_BAR_HEIGHT = 10;

function barHeight(value: number | undefined, max: number): string {
  if (value === undefined || max <= 0) return `${String(MIN_BAR_HEIGHT)}%`;
  return `${String(Math.max(MIN_BAR_HEIGHT, (value / max) * 100))}%`;
}

/** One KPI tile: graded number, target line and recent periods as graded bars. */
export function PerformanceTile({
  title,
  band,
  value,
  unit,
  description,
  target,
  bars,
  targetBar,
}: PerformanceTileProps): ReactElement {
  const max = Math.max(
    targetBar ?? 0,
    ...(bars ?? []).map((bar) => bar.value ?? 0),
  );
  const columns = (bars?.length ?? 0) + (targetBar === undefined ? 0 : 1);
  return (
    <article className="perf-tile" data-band={band}>
      <h4 className="perf-tile-title">
        <span className="perf-swatch" aria-hidden="true" />
        {title}
      </h4>
      <div className="perf-tile-value">
        <strong>{value}</strong>
        {unit && <small>{unit}</small>}
        <span className="perf-tile-desc">{description}</span>
      </div>
      <p className="perf-tile-target">{target}</p>
      {bars && (
        <div
          className="perf-chart"
          aria-hidden="true"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, 1fr)` }}
        >
          {bars.map((bar, index) => (
            <span
              key={bar.key}
              className="perf-bar"
              data-band={bar.band}
              data-current={index === bars.length - 1}
              data-empty={bar.value === undefined}
              style={{ height: barHeight(bar.value, max) }}
            />
          ))}
          {targetBar !== undefined && (
            <span
              className="perf-bar"
              data-target="true"
              style={{ height: barHeight(targetBar, max) }}
            />
          )}
          {bars.map((bar, index) => (
            <small key={bar.key} className="perf-axis">
              {index === bars.length - 1 ? 'now' : bar.label}
            </small>
          ))}
          {targetBar !== undefined && (
            <small className="perf-axis">target</small>
          )}
        </div>
      )}
    </article>
  );
}
