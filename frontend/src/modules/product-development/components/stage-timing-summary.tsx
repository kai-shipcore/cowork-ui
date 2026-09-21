import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { VehicleZoneProject } from '@/shared/types/workbench';
import { reportDate } from '@/modules/rd-workspace/report-date';
import { currentStageTiming } from '../project-health';

/** Show the frozen stage target separately from the overall delivery deadline. */
export function StageTimingSummary({
  zone,
}: {
  zone: VehicleZoneProject;
}): ReactElement {
  const timing = currentStageTiming(zone);
  return (
    <section className="shape-section" aria-label="Current stage schedule">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>
          Current stage schedule ·{' '}
          {zone.currentStage === 'Approved'
            ? 'Development complete'
            : zone.currentStage}
        </strong>
        <Link
          to={
            '/reference-data?tab=stages&product=' +
            encodeURIComponent(zone.productTypeId)
          }
        >
          Stage Standards
        </Link>
      </div>
      {zone.currentStage === 'Approved' ? (
        <p>
          Development complete · Standard durations and due dates are not
          recalculated.
        </p>
      ) : (
        <p>
          Start {reportDate(timing?.startedAt) ?? 'No record'} · Applied
          standard{' '}
          {timing?.targetDays !== undefined
            ? `${String(timing.targetDays)} days`
            : 'Not set'}{' '}
          · Stage target {reportDate(timing?.targetDueAt) ?? 'Not set'}
        </p>
      )}
      <p>
        Overall project target {reportDate(zone.targetAt) ?? 'Unassigned'} ·
        Standard changes apply when the next stage starts.
      </p>
    </section>
  );
}
