import type { ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { useSearchParams } from 'react-router-dom';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import {
  appendStageDurationRevision,
  canEditStageDurations,
  EMPTY_STAGE_DURATIONS,
  STAGE_DURATION_KEY,
  STAGE_PRODUCTS,
  stageDurationSchema,
} from '@/app/stage-duration-model';
import { StageDurationEditor } from './stage-duration-editor';

/** Product-specific standard durations with device-local revision history. */
export function StageDurationSettings(): ReactElement {
  const [params, setParams] = useSearchParams();
  const product =
    STAGE_PRODUCTS.find((entry) => entry.id === params.get('product')) ??
    STAGE_PRODUCTS[0];
  const { actor } = useOperations();
  const { records, error, saving, save } = useRdRecords(
    STAGE_DURATION_KEY,
    stageDurationSchema,
    EMPTY_STAGE_DURATIONS,
  );
  const history = records.filter((entry) => entry.productTypeId === product.id);
  const latest = history[history.length - 1];
  return (
    <div className="stage-duration-settings">
      <div className="stage-duration-heading">
        <div>
          <h2>Development Stage Standards</h2>
          <p>
            Standard duration by product · Calendar days · Applies to newly
            started stages
          </p>
        </div>
        <span>
          {canEditStageDurations(actor) ? 'R&D lead editing' : 'Read-only'} ·{' '}
          {actor.name}
        </span>
      </div>
      <p className="stage-duration-notice">
        Browser-local demo. Shared company storage and real permission checks
        are not connected. Example durations do not apply until saved.
      </p>
      <div
        className="stage-duration-products"
        role="group"
        aria-label="Select product for standard durations"
      >
        {STAGE_PRODUCTS.map((entry) => (
          <Button
            key={entry.id}
            variant={entry.id === product.id ? 'primary' : 'outline'}
            aria-pressed={entry.id === product.id}
            onClick={() => {
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set('tab', 'stages');
                next.set('product', entry.id);
                return next;
              });
            }}
          >
            {entry.name}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <StageDurationEditor
        key={product.id + ':' + actor.id}
        product={product}
        latest={latest}
        canEdit={canEditStageDurations(actor) && !error}
        saving={saving}
        onSave={(draft, expectedId) =>
          save((current) =>
            appendStageDurationRevision(
              current,
              { ...draft, updatedBy: actor.id },
              actor,
              expectedId,
            ),
          )
        }
      />
      <details className="stage-duration-history">
        <summary>Change history · {history.length} items</summary>
        {!history.length && <p>No standards saved yet.</p>}
        {history
          .slice()
          .reverse()
          .map((revision) => (
            <article key={revision.id}>
              <strong>
                {new Date(revision.updatedAt).toLocaleString('en-US')} ·{' '}
                {revision.updatedBy}
              </strong>
              <p>{revision.note}</p>
              <p>
                {revision.stages
                  .map(
                    (entry) =>
                      `${entry.stage}: ${String(entry.targetDays)} days`,
                  )
                  .join(' / ')}
              </p>
            </article>
          ))}
      </details>
    </div>
  );
}
