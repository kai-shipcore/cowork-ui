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
      setMessage('Enter observation evidence.');
      return;
    }
    if (
      quality === 'PASS' &&
      (!latestFittingPassed(zone.id, visits) || (!target && !allPartsPassed))
    ) {
      setMessage(
        "Record the latest fitting PASS and each part's latest quality PASS first.",
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
    setMessage('New observation saved. Previous records are preserved.');
  };
  return (
    <section className="shape-section">
      <h3>Fitting quality observations · Parts / Overall product</h3>
      <p>
        Inspect individual parts separately from the visit PASS before
        confirming overall product quality.
      </p>
      <label>
        Observation target{' '}
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
        >
          <option value="">Overall product</option>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name} ·{' '}
              {latest(part.id)?.evidenceKey === evidenceKey
                ? latest(part.id)?.quality
                : 'Needs verification'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Quality{' '}
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
        Observation evidence{' '}
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </label>
      <Button onClick={save}>Record observation</Button>
      <p>
        Overall product:{' '}
        {latest()?.evidenceKey === evidenceKey
          ? latest()?.quality
          : 'Needs verification'}
      </p>
      <details>
        <summary>Quality history {records.length} items</summary>
        {records.map((item) => (
          <p key={item.id}>
            {item.createdAt} ·{' '}
            {item.vehicleProductDesignId ?? 'Overall product'} · {item.quality}{' '}
            · {item.note}
          </p>
        ))}
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
