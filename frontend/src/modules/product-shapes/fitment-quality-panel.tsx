import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import type {
  ProjectDesign,
  ProjectVisit,
  ZoneProject,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { latestFittingPassed, sizeReviewEvidence } from './shape-model';

export function FitmentQualityPanel({
  zone,
  designs,
  visits,
}: {
  zone: ZoneProject;
  designs: readonly ProjectDesign[];
  visits: readonly ProjectVisit[];
}) {
  const { fitmentQualities, updateWorkbench } = useWorkbenchStore();
  const [target, setTarget] = useState('');
  const [quality, setQuality] = useState<'PASS' | 'FAIL'>('PASS');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const parts = designs.filter(
    (part) => part.vehicleProjectId === zone.id && part.status === 'ACTIVE',
  );
  const evidenceKey = sizeReviewEvidence(zone.id, designs, visits);
  const records = fitmentQualities.filter(
    (item) => item.vehicleProjectId === zone.id,
  );
  const latest = (id?: string) =>
    records
      .slice()
      .reverse()
      .find((item) => item.vehicleProductDesignId === id);
  const allPartsPassed =
    parts.length > 0 &&
    parts.every(
      (part) =>
        latest(part.id)?.quality === 'PASS' &&
        latest(part.id)?.evidenceKey === evidenceKey,
    );
  const save = () => {
    if (!note.trim()) {
      setMessage('관찰 근거를 입력하세요.');
      return;
    }
    if (
      quality === 'PASS' &&
      (!latestFittingPassed(zone.id, visits) || (!target && !allPartsPassed))
    ) {
      setMessage(
        '최신 피팅 PASS와 각 부품의 최신 품질 PASS를 먼저 기록하세요.',
      );
      return;
    }
    updateWorkbench((state) => ({
      ...state,
      fitmentQualities: [
        ...state.fitmentQualities,
        {
          id: crypto.randomUUID(),
          vehicleResearchId: zone.vehicleResearchId,
          vehicleProjectId: zone.id,
          vehicleProductDesignId: target || undefined,
          vehicleZoneId: zone.zoneId,
          quality,
          source: 'REVIEW',
          note: note.trim(),
          evidenceKey,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setNote('');
    setMessage('새 관찰 이력을 저장했습니다. 이전 기록은 보존됩니다.');
  };
  return (
    <section className="shape-section">
      <h3>피팅 품질 관찰 · 부품 / 전체 제품</h3>
      <p>방문 PASS와 별도로 부품을 확인한 후 전체 제품의 품질을 확정합니다.</p>
      <label>
        관찰 대상{' '}
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
        >
          <option value="">전체 제품</option>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name} ·{' '}
              {latest(part.id)?.evidenceKey === evidenceKey
                ? latest(part.id)?.quality
                : '확인 필요'}
            </option>
          ))}
        </select>
      </label>
      <label>
        품질{' '}
        <select
          value={quality}
          onChange={(e) => {
            setQuality(e.target.value as typeof quality);
          }}
        >
          <option>PASS</option>
          <option>FAIL</option>
        </select>
      </label>
      <label>
        관찰 근거{' '}
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </label>
      <Button onClick={save}>관찰 기록</Button>
      <p>
        전체 제품:{' '}
        {latest()?.evidenceKey === evidenceKey
          ? latest()?.quality
          : '확인 필요'}
      </p>
      <details>
        <summary>품질 이력 {records.length}건</summary>
        {records.map((item) => (
          <p key={item.id}>
            {item.createdAt} · {item.vehicleProductDesignId ?? '전체 제품'} ·{' '}
            {item.quality} · {item.note}
          </p>
        ))}
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
