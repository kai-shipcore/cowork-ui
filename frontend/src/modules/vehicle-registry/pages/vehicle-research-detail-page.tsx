import { useMemo, useState } from 'react';
import {
  Activity,
  type ActivityEntry,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { ArrowLeft, ImagePlus, Link2, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfigChips } from '@/shared/domain/config-chips';
import { UserAvatar } from '@/shared/domain/user-picker';
import { StatusBadge } from '@/shared/components/status-badge';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  newResearchMaterial,
  projectDispositionSchema,
  RESEARCH_COMMENT_KEY,
  RESEARCH_COMMENT_SEED,
  RESEARCH_DETAIL_KEY,
  RESEARCH_DETAIL_SEED,
  researchCommentListSchema,
  researchDetailListSchema,
  researchDetailSchema,
  researchStatusSchema,
  type ResearchMaterial,
} from '../vehicle-research-detail-model';
import './vehicle-research-detail-page.css';

const TAG_SUGGESTIONS = [
  'Seat Cover',
  'Car Cover',
  'Floor Mat',
  'Front seat',
  'Second row',
  'Third row',
  'Driver',
  'Passenger',
  'Bucket',
  'Bench',
  'Hybrid',
  'Power seat',
  'Manual seat',
  '7 seats',
  '8 seats',
];

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 30);
}

export function VehicleResearchDetailPage() {
  const navigate = useNavigate();
  const { configurationId = '' } = useParams();
  const { actor } = useOperations();
  const { configurations, setConfigurations } = useWorkbenchStore();
  const configuration = configurations.find(
    (item) => item.id === configurationId,
  );
  const details = useRdRecords(
    RESEARCH_DETAIL_KEY,
    researchDetailListSchema,
    RESEARCH_DETAIL_SEED,
  );
  const comments = useRdRecords(
    RESEARCH_COMMENT_KEY,
    researchCommentListSchema,
    RESEARCH_COMMENT_SEED,
  );
  const history = details.records.filter(
    (item) => item.configurationId === configurationId,
  );
  const latest = history.slice(-1).pop();
  const [researchStatus, setResearchStatus] = useState(
    latest?.researchStatus ??
      (configuration?.researchStatus === 'COMPLETE'
        ? 'COMPLETE'
        : 'RESEARCHING'),
  );
  const [projectDisposition, setProjectDisposition] = useState(
    latest?.projectDisposition ?? 'PENDING',
  );
  const [holdReason, setHoldReason] = useState(latest?.holdReason ?? '');
  const [generation, setGeneration] = useState(latest?.generation ?? '');
  const [overview, setOverview] = useState(latest?.overview ?? '');
  const [modelYears, setModelYears] = useState(latest?.modelYears ?? '');
  const [trimLevels, setTrimLevels] = useState(latest?.trimLevels ?? '');
  const [frontSeats, setFrontSeats] = useState(latest?.frontSeats ?? '');
  const [secondRow, setSecondRow] = useState(latest?.secondRow ?? '');
  const [thirdRow, setThirdRow] = useState(latest?.thirdRow ?? '');
  const [optionalFeatures, setOptionalFeatures] = useState(
    latest?.optionalFeatures ?? '',
  );
  const [materials, setMaterials] = useState<readonly ResearchMaterial[]>(
    latest?.materials.length ? latest.materials : [newResearchMaterial()],
  );
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (latest?.materials ?? []).map((item) => [item.id, item.tags.join(', ')]),
    ),
  );

  const activity = useMemo<readonly ActivityEntry[]>(
    () => [
      ...history.map((item) => ({
        id: `history-${item.id}`,
        type: 'SYSTEM_LOG' as const,
        message: `Research saved · ${item.researchStatus} · Project ${item.projectDisposition}`,
        createdAt: item.at,
      })),
      ...comments.records
        .filter((item) => item.configurationId === configurationId)
        .map((item) => ({
          id: item.id,
          type: 'USER_COMMENT' as const,
          message: item.message,
          author: item.author,
          createdAt: item.createdAt,
        })),
    ],
    [comments.records, configurationId, history],
  );

  if (!configuration) {
    return (
      <section className="research-detail-missing">
        <h1>Research record not found</h1>
        <Button
          onClick={() => {
            void navigate('/vehicle-research');
          }}
        >
          Back to Vehicle Research
        </Button>
      </section>
    );
  }

  function updateMaterial(id: string, patch: Partial<ResearchMaterial>) {
    setMaterials((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function toggleTag(id: string, tag: string) {
    const item = materials.find((entry) => entry.id === id);
    if (!item) return;
    const nextTags = item.tags.includes(tag)
      ? item.tags.filter((value) => value !== tag)
      : [...item.tags, tag];
    updateMaterial(id, { tags: nextTags });
    setTagDrafts((current) => ({
      ...current,
      [id]: nextTags.join(', '),
    }));
  }

  function readMaterialFile(id: string, file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setMessage('Select a PNG, JPEG, or WebP image up to 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      updateMaterial(id, {
        fileData: reader.result,
        fileName: file.name,
        fileType: file.type,
      });
      setMessage('Asset added. Save research to register it.');
    };
    reader.onerror = () => setMessage('Unable to read the asset file.');
    reader.readAsDataURL(file);
  }

  async function saveResearch() {
    const parsed = researchDetailSchema.safeParse({
      id: crypto.randomUUID(),
      configurationId,
      researchStatus,
      projectDisposition,
      holdReason,
      generation,
      overview,
      modelYears,
      trimLevels,
      frontSeats,
      secondRow,
      thirdRow,
      optionalFeatures,
      materials,
      actor: actor.name,
      at: new Date().toISOString(),
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues.map((issue) => issue.message).join(' / '));
      return;
    }
    if (projectDisposition === 'HOLD' && !holdReason.trim()) {
      setMessage('Add a reason before placing project conversion on hold.');
      return;
    }
    const ok = await details.save((current) => [...current, parsed.data]);
    if (!ok) return;
    setConfigurations((current) =>
      current.map((item) =>
        item.id === configurationId
          ? {
              ...item,
              researchStatus:
                researchStatus === 'COMPLETE' ? 'COMPLETE' : 'RESEARCHING',
            }
          : item,
      ),
    );
    setMessage(
      'Vehicle research saved. The decision was added to the timeline.',
    );
  }

  async function addComment() {
    const value = comment.trim();
    if (!value) return;
    const ok = await comments.save((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        configurationId,
        message: value,
        author: actor.name,
        createdAt: new Date().toISOString(),
      },
    ]);
    if (ok) setComment('');
  }

  return (
    <section className="research-detail-page">
      <Button
        className="research-back-button"
        variant="ghost"
        onClick={() => {
          void navigate('/vehicle-research');
        }}
      >
        <ArrowLeft /> Vehicle Research
      </Button>
      <header className="research-detail-header">
        <div className="research-detail-title-row">
          <div>
            <p>VEHICLE RESEARCH</p>
            <h1>{configuration.vehicle}</h1>
            <ConfigChips options={configuration.options} />
          </div>
          <div className="research-detail-badges">
            <StatusBadge
              label={researchStatus}
              tone={researchStatus === 'COMPLETE' ? 'success' : 'progress'}
            />
            <StatusBadge
              label={`PROJECT ${projectDisposition}`}
              tone={
                projectDisposition === 'PUSH'
                  ? 'success'
                  : projectDisposition === 'HOLD'
                    ? 'warning'
                    : 'neutral'
              }
            />
          </div>
        </div>
      </header>

      <div className="research-detail-layout">
        <main className="research-detail-main">
          <section className="research-detail-card decision-card">
            <div className="section-heading">
              <div>
                <span>01</span>
                <h2>Research & project decision</h2>
              </div>
              <p>
                Research completion and project conversion are managed
                separately.
              </p>
            </div>
            <div className="research-field-grid">
              <label>
                Research status
                <select
                  value={researchStatus}
                  onChange={(e) => {
                    setResearchStatus(
                      researchStatusSchema.parse(e.target.value),
                    );
                  }}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="RESEARCHING">In progress</option>
                  <option value="COMPLETE">Complete</option>
                </select>
              </label>
              <label>
                Project conversion
                <select
                  value={projectDisposition}
                  onChange={(e) => {
                    setProjectDisposition(
                      projectDispositionSchema.parse(e.target.value),
                    );
                  }}
                >
                  <option value="PENDING">Pending decision</option>
                  <option value="PUSH">Push to development</option>
                  <option value="HOLD">Hold</option>
                </select>
              </label>
            </div>
            {projectDisposition === 'HOLD' && (
              <label>
                Hold reason
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={(e) => {
                    setHoldReason(e.target.value);
                  }}
                  placeholder="Demand, factory capacity, missing evidence, or another reason"
                />
              </label>
            )}
          </section>

          <section className="research-detail-card">
            <div className="section-heading">
              <div>
                <span>02</span>
                <h2>Vehicle overview</h2>
              </div>
              <p>Structured from the vehicle research reference document.</p>
            </div>
            <div className="research-field-grid">
              <label>
                Generation
                <Input
                  value={generation}
                  onChange={(e) => {
                    setGeneration(e.target.value);
                  }}
                  placeholder="Example: Third Generation"
                />
              </label>
              <label>
                Applicable model years
                <Input
                  value={modelYears}
                  onChange={(e) => {
                    setModelYears(e.target.value);
                  }}
                  placeholder="Example: 2025–2026+"
                />
              </label>
            </div>
            <label>
              Overview
              <textarea
                rows={5}
                value={overview}
                onChange={(e) => {
                  setOverview(e.target.value);
                }}
                placeholder="Platform, body structure, powertrain, refreshes, and important changes"
              />
            </label>
            <label>
              Trim levels
              <textarea
                rows={4}
                value={trimLevels}
                onChange={(e) => {
                  setTrimLevels(e.target.value);
                }}
                placeholder="Trim names, year ranges, upholstery, and meaningful differences"
              />
            </label>
          </section>

          <section className="research-detail-card">
            <div className="section-heading">
              <div>
                <span>03</span>
                <h2>Seating & option matrix</h2>
              </div>
              <p>
                Record product-affecting ranges independently, even within one
                generation.
              </p>
            </div>
            <label>
              Front seating
              <textarea
                rows={3}
                value={frontSeats}
                onChange={(e) => {
                  setFrontSeats(e.target.value);
                }}
              />
            </label>
            <label>
              Second-row configurations
              <textarea
                rows={3}
                value={secondRow}
                onChange={(e) => {
                  setSecondRow(e.target.value);
                }}
              />
            </label>
            <label>
              Third-row configurations
              <textarea
                rows={3}
                value={thirdRow}
                onChange={(e) => {
                  setThirdRow(e.target.value);
                }}
              />
            </label>
            <label>
              Optional features / add-ons
              <textarea
                rows={3}
                value={optionalFeatures}
                onChange={(e) => {
                  setOptionalFeatures(e.target.value);
                }}
              />
            </label>
          </section>

          <section className="research-detail-card">
            <div className="section-heading material-heading">
              <div>
                <span>04</span>
                <h2>Research evidence</h2>
              </div>
              <Button
                variant="dashed"
                onClick={() => {
                  setMaterials((current) => [
                    ...current,
                    newResearchMaterial(),
                  ]);
                }}
              >
                <Plus /> Add evidence
              </Button>
            </div>
            <p className="section-help">
              One source can carry multiple year, product, seat-position, and
              vehicle-feature tags.
            </p>
            <div className="material-list">
              {materials.map((item, index) => (
                <article className="material-card" key={item.id}>
                  <header>
                    <strong>Evidence {index + 1}</strong>
                    <Button
                      mode="icon"
                      variant="ghost"
                      disabled={materials.length === 1}
                      onClick={() => {
                        setMaterials((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        );
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </header>
                  <label>
                    Title
                    <Input
                      value={item.title}
                      onChange={(e) => {
                        updateMaterial(item.id, { title: e.target.value });
                      }}
                      placeholder="Example: 2025 Avenir second-row captain chair"
                    />
                  </label>
                  <label>
                    Source URL
                    <div className="input-with-icon">
                      <Link2 />
                      <Input
                        type="url"
                        value={item.sourceUrl}
                        onChange={(e) => {
                          updateMaterial(item.id, {
                            sourceUrl: e.target.value,
                          });
                        }}
                        placeholder="https://..."
                      />
                    </div>
                  </label>
                  <label className="research-material-upload">
                    <ImagePlus aria-hidden="true" />
                    <span>{item.fileName || 'Add asset file'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        readMaterialFile(item.id, event.target.files?.[0]);
                      }}
                    />
                  </label>
                  {item.fileData && (
                    <div className="research-material-preview">
                      <img src={item.fileData} alt={item.fileName} />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          updateMaterial(item.id, {
                            fileData: '',
                            fileName: '',
                            fileType: '',
                          });
                        }}
                      >
                        Remove file
                      </Button>
                    </div>
                  )}
                  <label>
                    Evidence notes
                    <textarea
                      rows={3}
                      value={item.notes}
                      onChange={(e) => {
                        updateMaterial(item.id, { notes: e.target.value });
                      }}
                      placeholder="What this source confirms and any uncertainty"
                    />
                  </label>
                  <fieldset>
                    <legend>Tags</legend>
                    <Input
                      aria-label={`Evidence ${String(index + 1)} custom tags`}
                      value={tagDrafts[item.id] ?? item.tags.join(', ')}
                      placeholder="Add tags separated by commas"
                      onChange={(event) => {
                        const value = event.target.value;
                        setTagDrafts((current) => ({
                          ...current,
                          [item.id]: value,
                        }));
                        updateMaterial(item.id, { tags: parseTags(value) });
                      }}
                    />
                    <div className="tag-picker">
                      {TAG_SUGGESTIONS.map((tag) => (
                        <button
                          type="button"
                          className={item.tags.includes(tag) ? 'selected' : ''}
                          key={tag}
                          onClick={() => {
                            toggleTag(item.id, tag);
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </article>
              ))}
            </div>
          </section>

          <div className="research-save-bar">
            <p role="status">{message || details.error}</p>
            <Button
              variant="primary"
              disabled={details.saving}
              onClick={() => void saveResearch()}
            >
              <Save /> Save research
            </Button>
          </div>
        </main>

        <aside className="research-activity-column">
          <section
            className="research-timeline"
            aria-labelledby="research-timeline-title"
          >
            <h2 id="research-timeline-title">Timeline</h2>
            <div className="comment-composer">
              <UserAvatar
                user={{
                  id: actor.id,
                  // Initials come from the name; drop the "(Demo)" suffix.
                  name: actor.name.replace(/\s*\(.*\)$/, ''),
                }}
                size="md"
              />
              <textarea
                aria-label="Leave a comment"
                rows={2}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                }}
                placeholder="Leave a comment..."
              />
              <Button
                size="sm"
                disabled={!comment.trim() || comments.saving}
                onClick={() => void addComment()}
              >
                Post
              </Button>
            </div>
            <p className="comment-visibility">
              Only you and other staff can see comments
            </p>
            <Activity
              className="research-timeline-feed"
              entries={activity}
              title="Activity"
              emptyMessage="No research activity yet."
              systemAuthorLabel="Coverland System"
            />
          </section>
        </aside>
      </div>
    </section>
  );
}
