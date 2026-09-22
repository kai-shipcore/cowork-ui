import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import { Input } from '@coverland-engineering/ui/input';
import { ImagePlus, Plus, SearchCheck, Trash2 } from 'lucide-react';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import {
  EMPTY_RESEARCH_EVIDENCE,
  RESEARCH_EVIDENCE_KEY,
  researchEvidenceListSchema,
  researchEvidenceSchema,
  validateResearchEvidence,
  type ResearchEvidenceSection,
} from './research-evidence-model';
import '@/modules/rd-workspace/rd-workspace.css';
import './research-evidence.css';
import { formText } from '@/modules/rd-workspace/form-text';

interface ResearchEvidenceProps {
  configuration: VehicleConfiguration;
  configurations: readonly VehicleConfiguration[];
  onClose: () => void;
}

function newSeatType() {
  return {
    id: crypto.randomUUID(),
    name: '',
    sourceUrl: '',
    photo: '',
    photoName: '',
  };
}

function newSection(rowLabel = ''): ResearchEvidenceSection {
  return {
    id: crypto.randomUUID(),
    rowLabel,
    keyNotes: '',
    seatTypes: [newSeatType()],
  };
}

/** Repeatable evidence entries with append-only saved snapshots. */
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
  const [categorization, setCategorization] = useState(
    latest?.categorization ?? '',
  );
  const [summary, setSummary] = useState(latest?.summary ?? '');
  const [sections, setSections] = useState<readonly ResearchEvidenceSection[]>(
    latest?.sections.length
      ? latest.sections
      : [newSection('Front (1st row)'), newSection('Rear (2nd row)')],
  );
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);

  function updateSection(
    sectionId: string,
    update: Partial<ResearchEvidenceSection>,
  ): void {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, ...update } : section,
      ),
    );
  }

  function updateSeatType(
    sectionId: string,
    seatTypeId: string,
    update: Partial<ResearchEvidenceSection['seatTypes'][number]>,
  ): void {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              seatTypes: section.seatTypes.map((seatType) =>
                seatType.id === seatTypeId
                  ? { ...seatType, ...update }
                  : seatType,
              ),
            }
          : section,
      ),
    );
  }

  function readPhoto(sectionId: string, seatTypeId: string, file?: File): void {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setMessage('Select a PNG, JPEG, or WebP image up to 1 MB.');
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSeatType(sectionId, seatTypeId, {
          photo: reader.result,
          photoName: file.name,
        });
        setMessage('Image added. Save to register this evidence.');
      }
      setReading(false);
    };
    reader.onerror = () => {
      setMessage('Unable to read the image.');
      setReading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <DetailSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      icon={<SearchCheck />}
      title="Research evidence"
      description={`${configuration.vehicle} · ${configuration.id}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="research-evidence-form"
            disabled={saving || reading}
          >
            Save research evidence
          </Button>
        </>
      }
    >
      <form
        id="research-evidence-form"
        className="research-evidence-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const sources = sections.flatMap((section) =>
            section.seatTypes
              .map((seatType) => seatType.sourceUrl.trim())
              .filter(Boolean),
          );
          const firstPhoto = sections
            .flatMap((section) => section.seatTypes)
            .find((seatType) => seatType.photo);
          const result = researchEvidenceSchema.safeParse({
            id: crypto.randomUUID(),
            configurationId: configuration.id,
            checkedCount: sources.length,
            sources,
            photo: firstPhoto?.photo ?? '',
            photoName: firstPhoto?.photoName ?? '',
            categorization,
            summary,
            sections,
            decision: data.get('decision'),
            mergeTargetId: data.get('target'),
            reason: formText(data, 'reason'),
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
            if (ok) {
              setMessage('Research evidence saved.');
              onClose();
            }
          });
        }}
      >
        <section className="research-evidence-overview">
          <div>
            <span>Vehicle</span>
            <strong>{configuration.vehicle}</strong>
          </div>
          <div>
            <span>Configuration</span>
            <strong>
              {configuration.options
                .map(([name, value]) => `${name}: ${value}`)
                .join(' · ')}
            </strong>
          </div>
        </section>

        <label>
          Categorization criteria
          <textarea
            rows={2}
            value={categorization}
            onChange={(event) => {
              setCategorization(event.target.value);
            }}
            placeholder="Cabin/body type, trim, package, or other attributes that determine seat types"
          />
        </label>
        <label>
          Overall summary of seat types and variations
          <textarea
            rows={3}
            value={summary}
            onChange={(event) => {
              setSummary(event.target.value);
            }}
            placeholder="Summarize the confirmed variations and important differences"
          />
        </label>

        <div className="research-evidence-section-heading">
          <div>
            <h3>Supporting evidence</h3>
            <p>Add as many seat rows and seat-type variants as needed.</p>
          </div>
          <Button
            type="button"
            variant="dashed"
            onClick={() => {
              setSections((current) => [...current, newSection()]);
            }}
          >
            <Plus /> Add seat row
          </Button>
        </div>

        <div className="research-evidence-sections">
          {sections.map((section, sectionIndex) => (
            <section className="research-evidence-section" key={section.id}>
              <header>
                <span>{sectionIndex + 1}</span>
                <Input
                  aria-label={`Seat row ${String(sectionIndex + 1)} name`}
                  value={section.rowLabel}
                  placeholder="Example: Third row"
                  onChange={(event) => {
                    updateSection(section.id, { rowLabel: event.target.value });
                  }}
                />
                <Button
                  type="button"
                  mode="icon"
                  variant="ghost"
                  aria-label={`Remove seat row ${String(sectionIndex + 1)}`}
                  disabled={sections.length === 1}
                  onClick={() => {
                    setSections((current) =>
                      current.filter((item) => item.id !== section.id),
                    );
                  }}
                >
                  <Trash2 />
                </Button>
              </header>
              <label>
                Key things to note
                <textarea
                  rows={2}
                  value={section.keyNotes}
                  onChange={(event) => {
                    updateSection(section.id, { keyNotes: event.target.value });
                  }}
                  placeholder="Seat geometry, split, headrest, armrest, belt, or trim details"
                />
              </label>

              <div className="research-seat-types">
                {section.seatTypes.map((seatType, seatTypeIndex) => (
                  <article className="research-seat-type" key={seatType.id}>
                    <div className="research-seat-type-title">
                      <strong>Seat type {seatTypeIndex + 1}</strong>
                      <Button
                        type="button"
                        mode="icon"
                        variant="ghost"
                        aria-label={`Remove seat type ${String(seatTypeIndex + 1)}`}
                        disabled={section.seatTypes.length === 1}
                        onClick={() => {
                          updateSection(section.id, {
                            seatTypes: section.seatTypes.filter(
                              (item) => item.id !== seatType.id,
                            ),
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <label>
                      Type / variation
                      <Input
                        value={seatType.name}
                        placeholder="Example: Bucket seat with removable headrest"
                        onChange={(event) => {
                          updateSeatType(section.id, seatType.id, {
                            name: event.target.value,
                          });
                        }}
                      />
                    </label>
                    <label>
                      Source link
                      <Input
                        type="url"
                        value={seatType.sourceUrl}
                        placeholder="https://..."
                        onChange={(event) => {
                          updateSeatType(section.id, seatType.id, {
                            sourceUrl: event.target.value,
                          });
                        }}
                      />
                    </label>
                    <label className="research-photo-input">
                      <ImagePlus aria-hidden="true" />
                      <span>
                        {seatType.photoName || 'Add supporting image'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          readPhoto(
                            section.id,
                            seatType.id,
                            event.target.files?.[0],
                          );
                        }}
                      />
                    </label>
                    {seatType.photo && (
                      <div className="research-photo-preview">
                        <img src={seatType.photo} alt={seatType.photoName} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateSeatType(section.id, seatType.id, {
                              photo: '',
                              photoName: '',
                            });
                          }}
                        >
                          Remove image
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <Button
                type="button"
                variant="dashed"
                onClick={() => {
                  updateSection(section.id, {
                    seatTypes: [...section.seatTypes, newSeatType()],
                  });
                }}
              >
                <Plus /> Add seat type
              </Button>
            </section>
          ))}
        </div>

        <section className="research-decision-section">
          <h3>Research decision</h3>
          <div className="rd-fields">
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
            Decision rationale
            <textarea
              name="reason"
              rows={3}
              required
              maxLength={2000}
              defaultValue={latest?.reason}
              placeholder="Explain why this configuration stays separate or should be merged"
            />
          </label>
        </section>

        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <p role="status" className="research-evidence-status">
          {message}
        </p>

        {history.length > 0 && (
          <section className="research-history">
            <h3>Saved history · {history.length}</h3>
            {[...history].reverse().map((record) => (
              <details key={record.id}>
                <summary>
                  {record.at.slice(0, 16).replace('T', ' ')} · {record.actor} ·{' '}
                  {record.decision}
                </summary>
                <p>{record.reason}</p>
                <p>
                  {record.sections.length} seat rows · {record.checkedCount}{' '}
                  source links
                </p>
              </details>
            ))}
          </section>
        )}
      </form>
    </DetailSheet>
  );
}
