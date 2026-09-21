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
          <h2>개발 단계 기준</h2>
          <p>제품별 표준 기간 · 달력일 · 새로 시작하는 단계부터 적용</p>
        </div>
        <span>
          {canEditStageDurations(actor) ? 'R&D 관리자 편집' : '읽기 전용'} ·{' '}
          {actor.name}
        </span>
      </div>
      <p className="stage-duration-notice">
        브라우저 로컬 데모입니다. 회사 공통 DB·실제 권한 검증은 연결되지
        않았습니다. 예시 기간은 저장하기 전까지 적용되지 않습니다.
      </p>
      <div
        className="stage-duration-products"
        role="group"
        aria-label="표준 기간 제품 선택"
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
        <summary>변경 이력 · {history.length}건</summary>
        {!history.length && <p>아직 저장한 기준이 없습니다.</p>}
        {history
          .slice()
          .reverse()
          .map((revision) => (
            <article key={revision.id}>
              <strong>
                {new Date(revision.updatedAt).toLocaleString()} ·{' '}
                {revision.updatedBy}
              </strong>
              <p>{revision.note}</p>
              <p>
                {revision.stages
                  .map(
                    (entry) => `${entry.stage}: ${String(entry.targetDays)}일`,
                  )
                  .join(' / ')}
              </p>
            </article>
          ))}
      </details>
    </div>
  );
}
