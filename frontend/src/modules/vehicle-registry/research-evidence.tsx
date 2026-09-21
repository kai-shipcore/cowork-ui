import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import {
  EMPTY_RESEARCH_EVIDENCE,
  RESEARCH_EVIDENCE_KEY,
  researchEvidenceListSchema,
  researchEvidenceSchema,
  validateResearchEvidence,
} from './research-evidence-model';
import '@/modules/rd-workspace/rd-workspace.css';
import { formText } from '@/modules/rd-workspace/form-text';

interface ResearchEvidenceProps {
  configuration: VehicleConfiguration;
  configurations: readonly VehicleConfiguration[];
  onClose: () => void;
}

/** Evidence and decisions are append-only; no destructive configuration merge occurs here. */
export function ResearchEvidence({
  configuration,
  configurations,
  onClose,
}: ResearchEvidenceProps): ReactElement {
  const { actor } = useOperations();
  const { records, save, saving, error } = useRdRecords(
    RESEARCH_EVIDENCE_KEY,
    researchEvidenceListSchema,
    EMPTY_RESEARCH_EVIDENCE,
  );
  const history = records.filter(
    (record) => record.configurationId === configuration.id,
  );
  const latest = history.slice(-1).pop();
  const [photo, setPhoto] = useState(latest?.photo ?? '');
  const [photoName, setPhotoName] = useState(latest?.photoName ?? '');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  return (
    <section className="rd-workspace mb-5">
      <form
        className="rd-panel"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const result = researchEvidenceSchema.safeParse({
            id: crypto.randomUUID(),
            configurationId: configuration.id,
            checkedCount: Number(data.get('count')),
            sources: formText(data, 'sources')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            photo,
            photoName,
            decision: data.get('decision'),
            mergeTargetId: data.get('target'),
            reason: data.get('reason'),
            actor: actor.name,
            at: new Date().toISOString(),
          });
          if (!result.success) {
            setMessage(
              result.error.issues.map((issue) => issue.message).join(' / '),
            );
            return;
          }
          try {
            validateResearchEvidence(result.data, configurations);
          } catch (cause) {
            setMessage(
              cause instanceof Error ? cause.message : 'Check your input.',
            );
            return;
          }
          void save((current) => [...current, result.data]).then((ok) => {
            if (ok) setMessage('Research evidence and decision history saved.');
          });
        }}
      >
        <div className="rd-toolbar">
          <h2>
            Research evidence · {configuration.vehicle} / {configuration.id}
          </h2>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <p>
          {configuration.options.map((option) => option.join(': ')).join(' · ')}
        </p>
        <div className="rd-fields">
          <label>
            Listings / Sources reviewed
            <input
              type="number"
              name="count"
              min={0}
              step={1}
              required
              defaultValue={latest?.checkedCount ?? 0}
            />
          </label>
          <label>
            Configuration decision
            <select
              name="decision"
              defaultValue={latest?.decision ?? 'Under review'}
            >
              <option>Under review</option>
              <option>Keep separate configuration</option>
              <option>Propose merge</option>
            </select>
          </label>
          <label>
            Proposed merge target
            <select name="target" defaultValue={latest?.mergeTargetId ?? ''}>
              <option value="">Not applicable</option>
              {configurations
                .filter(
                  (item) =>
                    item.vehicle === configuration.vehicle &&
                    item.id !== configuration.id,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} ·{' '}
                    {item.options.map((option) => option[1]).join(' / ')}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          Source URLs · One per line
          <textarea
            name="sources"
            rows={3}
            defaultValue={latest?.sources.join('\n')}
            placeholder="https://..."
          />
        </label>
        <label>
          Evidence photo · PNG/JPEG/WebP, up to 1 MB
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (
                !['image/png', 'image/jpeg', 'image/webp'].includes(
                  file.type,
                ) ||
                file.size > 1024 * 1024
              ) {
                setMessage('Select a PNG/JPEG/WebP photo up to 1 MB.');
                return;
              }
              setReading(true);
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  setPhoto(reader.result);
                  setPhotoName(file.name);
                  setMessage('Photo loaded. Save to record it.');
                }
                setReading(false);
              };
              reader.onerror = () => {
                setMessage('Unable to read the photo.');
                setReading(false);
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {photo && (
          <div>
            <img
              className="rd-photo"
              src={photo}
              alt={'Research evidence: ' + photoName}
            />
            <small>{photoName}</small>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPhoto('');
                setPhotoName('');
              }}
            >
              Exclude photo from new record
            </Button>
          </div>
        )}
        <label>
          Observations / Rationale for separation or merging
          <textarea
            name="reason"
            rows={3}
            required
            maxLength={2000}
            defaultValue={latest?.reason}
          />
        </label>
        <p className="rd-note">
          Research counts reflect the sources actually checked. No arbitrary
          threshold such as 10 sources is applied. A merge proposal records a
          decision; it does not merge configurations or existing projects
          automatically.
        </p>
        <Button type="submit" disabled={saving || reading}>
          Save research evidence
        </Button>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
        <h2>Decision history · {history.length} items</h2>
        {[...history].reverse().map((record) => (
          <details key={record.id}>
            <summary className="cursor-pointer text-sm">
              {record.at.slice(0, 16).replace('T', ' ')} · {record.actor} ·{' '}
              {record.decision} · {record.checkedCount} reviewed
            </summary>
            <p className="whitespace-pre-wrap">{record.reason}</p>
            {record.mergeTargetId && (
              <p>Proposed target: {record.mergeTargetId}</p>
            )}
            {record.sources.map((url) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </p>
            ))}
            {record.photo && (
              <img
                className="rd-photo"
                src={record.photo}
                alt={record.photoName}
              />
            )}
          </details>
        ))}
      </form>
    </section>
  );
}
