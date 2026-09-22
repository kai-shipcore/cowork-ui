import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Link } from 'react-router-dom';
import type { VehicleZoneProject } from '@/shared/types/workbench';
import { reportDate } from '@/modules/rd-workspace/report-date';
import { projectStagePlan, STAGE_PRODUCTS } from '@/app/stage-duration-model';
import { currentStageTiming } from '../project-health';

/** Show the frozen stage target separately from the overall delivery deadline. */
export function StageTimingSummary({
  zone,
  onSavePlan,
}: {
  zone: VehicleZoneProject;
  onSavePlan?: (
    plan: NonNullable<VehicleZoneProject['stageTargetDays']>,
  ) => void;
}): ReactElement {
  const timing = currentStageTiming(zone);
  const product = STAGE_PRODUCTS.find(
    (entry) => entry.id === zone.productTypeId,
  );
  const [plan, setPlan] = useState(() =>
    (
      zone.stageTargetDays ??
      (product ? projectStagePlan(product.name, zone.priority ?? 'NORMAL') : [])
    ).map((entry) => ({ ...entry })),
  );
  const [message, setMessage] = useState('');
  const valid =
    plan.length > 0 &&
    plan.every(
      (entry) =>
        Number.isInteger(entry.targetDays) &&
        entry.targetDays >= 1 &&
        entry.targetDays <= 365,
    );
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
        {zone.stageTargetDays
          ? 'Project-specific durations apply to future stages.'
          : 'Standard changes apply when the next stage starts.'}
      </p>
      {onSavePlan && (
        <details>
          <summary>
            Edit project target days · {zone.priority ?? 'NORMAL'}
          </summary>
          <p>
            Changes apply when a stage next starts. Active and completed stage
            deadlines stay unchanged.
          </p>
          {plan.map((entry, index) => (
            <label
              key={entry.stage}
              className="flex items-center justify-between gap-3 my-2"
            >
              {entry.stage}
              <Input
                className="max-w-24"
                aria-label={`${entry.stage} project target days`}
                type="number"
                min={1}
                max={365}
                step={1}
                value={entry.targetDays || ''}
                onChange={(event) => {
                  const days = Number(event.target.value);
                  setPlan((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, targetDays: days } : row,
                    ),
                  );
                  setMessage('');
                }}
              />
            </label>
          ))}
          <Button
            disabled={!valid}
            onClick={() => {
              onSavePlan(plan);
              setMessage('Project durations saved.');
            }}
          >
            Save project durations
          </Button>
          <p role="status">{message}</p>
        </details>
      )}
    </section>
  );
}
