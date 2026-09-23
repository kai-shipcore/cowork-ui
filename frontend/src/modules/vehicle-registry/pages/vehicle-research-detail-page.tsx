import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  type ActivityEntry,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import { ArrowLeft, Pencil, Save, Search, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserAvatar } from '@/shared/domain/user-picker';
import { WorkbenchPagination } from '@/shared/components/workbench-pagination';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  RESEARCH_COMMENT_KEY,
  RESEARCH_COMMENT_SEED,
  RESEARCH_DETAIL_KEY,
  RESEARCH_DETAIL_SEED,
  researchCommentListSchema,
  researchDetailListSchema,
  researchDetailSchema,
  type ResearchMaterial,
} from '../vehicle-research-detail-model';
import {
  ResearchAssetUploader,
  type ResearchAssetTarget,
} from '../research-asset-uploader';
import { vehicleResearchIdentity } from '../vehicle-research-grid-model';
import './vehicle-research-detail-page.css';

export function VehicleResearchDetailPage() {
  const navigate = useNavigate();
  const { configurationId = '' } = useParams();
  const { actor } = useOperations();
  const { configurations, vehicleOptionKeys } = useWorkbenchStore();
  const configuration = configurations.find(
    (item) => item.id === configurationId,
  );
  const selectedVehicleIdentity = vehicleResearchIdentity(
    configuration?.vehicle ?? '',
  );
  const vehicleConfigurations = configuration
    ? configurations.filter(
        (item) =>
          vehicleResearchIdentity(item.vehicle).makeModel ===
          selectedVehicleIdentity.makeModel,
      )
    : [];
  const groupConfiguration = vehicleConfigurations[0] ?? configuration;
  const researchGroupId = groupConfiguration?.id ?? configurationId;
  const researchTargets = Array.from(
    new Map(
      vehicleConfigurations
        .flatMap((vehicleConfiguration) =>
          PRODUCT_TYPES.map((productType) => {
            const allowedOptionNames = new Set(
              vehicleOptionKeys
                .filter((key) => key.productTypeId === productType.id)
                .map((key) => key.name),
            );
            const options = vehicleConfiguration.options.filter(([key]) =>
              allowedOptionNames.has(key),
            );
            return {
              id: `${vehicleConfiguration.id}:${productType.id}`,
              configurationId: vehicleConfiguration.id,
              productTypeId: productType.id,
              productLabel: productType.product,
              options,
            } satisfies ResearchAssetTarget;
          }),
        )
        .map((target) => [
          `${target.productTypeId}:${JSON.stringify(target.options)}`,
          target,
        ] as const),
    ).values(),
  );
  const researchTargetGroups = PRODUCT_TYPES.map((productType) => ({
    ...productType,
    rows: researchTargets.filter(
      (target) => target.productTypeId === productType.id,
    ),
  })).filter((group) => group.rows.length > 0);
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
    (item) => item.configurationId === researchGroupId,
  );
  const latest = history.slice(-1).pop();
  const [materials, setMaterials] = useState<readonly ResearchMaterial[]>(
    latest?.materials ?? [],
  );
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [productRowQuery, setProductRowQuery] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetPagination, setAssetPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });
  const [assetPageItems, setAssetPageItems] = useState<
    readonly ResearchMaterial[]
  >([]);
  const [assetPageLoading, setAssetPageLoading] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState('');
  const visibleResearchTargetGroups = researchTargetGroups
    .map((group) => ({
      ...group,
      rows: group.rows
        .map((target, index) => ({
          ...target,
          configurationNumber: index + 1,
        }))
        .filter((target) =>
          [
            group.product,
            `Configuration ${String(target.configurationNumber)}`,
            ...target.options.flatMap(([key, value]) => [key, value]),
          ]
            .join(' ')
            .toLowerCase()
            .includes(productRowQuery.trim().toLowerCase()),
        ),
    }))
    .filter((group) => group.rows.length > 0);
  const filteredMaterials = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((material) => {
      const productLabel =
        PRODUCT_TYPES.find((item) => item.id === material.productTypeId)
          ?.product ?? '';
      return [
        material.title,
        material.fileName,
        productLabel,
        ...material.tags,
        ...material.optionSelections.flatMap(([key, value]) => [key, value]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [assetQuery, materials]);

  useEffect(() => {
    const lastPageIndex = Math.max(
      0,
      Math.ceil(filteredMaterials.length / assetPagination.pageSize) - 1,
    );
    if (assetPagination.pageIndex > lastPageIndex) {
      setAssetPagination((current) => ({
        ...current,
        pageIndex: lastPageIndex,
      }));
      return;
    }

    setAssetPageLoading(true);
    const timeout = window.setTimeout(() => {
      const start = assetPagination.pageIndex * assetPagination.pageSize;
      setAssetPageItems(
        filteredMaterials.slice(start, start + assetPagination.pageSize),
      );
      setAssetPageLoading(false);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [assetPagination.pageIndex, assetPagination.pageSize, filteredMaterials]);

  useEffect(() => {
    setAssetPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [assetQuery]);

  const activity = useMemo<readonly ActivityEntry[]>(
    () => [
      ...history.map((item) => ({
        id: `history-${item.id}`,
        type: 'SYSTEM_LOG' as const,
        message: `${String(item.materials.length)} research assets saved`,
        createdAt: item.at,
      })),
      ...comments.records
        .filter((item) => item.configurationId === researchGroupId)
        .map((item) => ({
          id: item.id,
          type: 'USER_COMMENT' as const,
          message: item.message,
          author: item.author,
          createdAt: item.createdAt,
        })),
    ],
    [comments.records, history, researchGroupId],
  );

  if (!configuration || !groupConfiguration) {
    return (
      <section className="research-detail-missing">
        <h1>Research record not found</h1>
        <Button onClick={() => void navigate('/vehicle-research')}>
          Back to Vehicle Research
        </Button>
      </section>
    );
  }

  function assignMaterialToTarget(
    material: ResearchMaterial,
    targetId: string,
  ): ResearchMaterial {
    const target = researchTargets.find((item) => item.id === targetId);
    if (!target) return material;
    return {
      ...material,
      researchRowId: target.id,
      targetConfigurationId: target.configurationId,
      productTypeId: target.productTypeId,
      optionSelections: target.options.map(
        ([key, value]) => [key, value] as [string, string],
      ),
    };
  }

  async function saveAssets(
    nextMaterials: readonly ResearchMaterial[] = materials,
  ): Promise<boolean> {
    const parsed = researchDetailSchema.safeParse({
      id: crypto.randomUUID(),
      configurationId: researchGroupId,
      researchStatus:
        latest?.researchStatus ??
        (configuration?.researchStatus === 'COMPLETE'
          ? 'COMPLETE'
          : 'RESEARCHING'),
      projectDisposition: latest?.projectDisposition ?? 'PENDING',
      holdReason: latest?.holdReason ?? '',
      generation: latest?.generation ?? '',
      overview: latest?.overview ?? '',
      modelYears: latest?.modelYears ?? '',
      trimLevels: latest?.trimLevels ?? '',
      frontSeats: latest?.frontSeats ?? '',
      secondRow: latest?.secondRow ?? '',
      thirdRow: latest?.thirdRow ?? '',
      optionalFeatures: latest?.optionalFeatures ?? '',
      materials: nextMaterials,
      actor: actor.name,
      at: new Date().toISOString(),
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues.map((issue) => issue.message).join(' / '));
      return false;
    }
    const ok = await details.save((current) => [...current, parsed.data]);
    if (ok) setMessage('Research assets saved.');
    return ok;
  }

  async function saveAssetConfiguration(assetId: string) {
    if (!editingTargetId) return;
    const nextMaterials = materials.map((material) =>
      material.id === assetId
        ? assignMaterialToTarget(material, editingTargetId)
        : material,
    );
    const saved = await saveAssets(nextMaterials);
    if (!saved) return;
    setMaterials(nextMaterials);
    setEditingAssetId(null);
    setEditingTargetId('');
  }

  async function removeAsset(assetId: string) {
    const nextMaterials = materials.filter((item) => item.id !== assetId);
    const saved = await saveAssets(nextMaterials);
    if (saved) setMaterials(nextMaterials);
  }

  async function addComment() {
    const value = comment.trim();
    if (!value) return;
    const ok = await comments.save((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        configurationId: researchGroupId,
        message: value,
        author: actor.name,
        createdAt: new Date().toISOString(),
      },
    ]);
    if (ok) setComment('');
  }

  function resolveMaterialTarget(material: ResearchMaterial) {
    const savedTarget = researchTargets.find(
      (target) => target.id === material.researchRowId,
    );
    if (savedTarget) return savedTarget;

    return researchTargets.find(
      (target) =>
        target.productTypeId === material.productTypeId &&
        material.optionSelections.every(([key, value]) =>
          target.options.some(
            ([targetKey, targetValue]) =>
              targetKey === key && targetValue === value,
          ),
        ),
    );
  }

  function targetLabel(target: ResearchAssetTarget | undefined) {
    if (!target) return 'Configuration not selected';
    const group = researchTargetGroups.find(
      (item) => item.id === target.productTypeId,
    );
    const index = group?.rows.findIndex((item) => item.id === target.id) ?? -1;
    return `${target.productLabel} · Configuration ${String(index + 1)}`;
  }

  return (
    <section className="research-detail-page">
      <Button
        className="research-back-button"
        variant="ghost"
        onClick={() => void navigate('/vehicle-research')}
      >
        <ArrowLeft /> Vehicle Research
      </Button>

      <header className="research-detail-header">
        <div className="research-detail-title-row">
          <div>
            <p>VEHICLE RESEARCH</p>
            <h1>{selectedVehicleIdentity.makeModel}</h1>
            <span className="research-group-summary">
              {researchTargets.length} product research rows ·{' '}
              {vehicleConfigurations.length} vehicle configurations
            </span>
          </div>
        </div>
      </header>

      <div className="research-detail-layout">
        <main className="research-detail-main">
          <section className="research-detail-card research-row-card">
            <div className="section-heading">
              <div>
                <h2>Product research rows</h2>
              </div>
              <p>Each uploaded image is mapped to one row.</p>
            </div>
            <label className="research-section-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={productRowQuery}
                onChange={(event) => setProductRowQuery(event.target.value)}
                placeholder="Search product, configuration, or option"
                aria-label="Search product research rows"
              />
            </label>
            <div className="research-product-groups">
              {visibleResearchTargetGroups.map((group) => (
                <section
                  className={`research-product-group research-product-group-${group.id.toLowerCase()}`}
                  key={group.id}
                >
                  <header>
                    <div>
                      <span className="research-product-mark" aria-hidden="true">
                        {group.product
                          .split(' ')
                          .map((word) => word[0])
                          .join('')}
                      </span>
                      <strong>{group.product}</strong>
                    </div>
                    <span>{group.rows.length} rows</span>
                  </header>
                  <div className="research-product-row-list">
                    {group.rows.map((target) => (
                      <article key={target.id}>
                        <div className="research-product-row-title">
                          <strong>
                            Configuration {target.configurationNumber}
                          </strong>
                          <span>{target.options.length} options</span>
                        </div>
                        {target.options.length ? (
                          <div className="research-option-chips">
                            {target.options.map(([key, value]) => (
                              <span key={`${key}-${value}`}>
                                <small>{key}</small>
                                <strong>{value}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="research-base-vehicle">
                            Base vehicle
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {visibleResearchTargetGroups.length === 0 && (
              <p className="research-search-empty">
                No product research rows match “{productRowQuery}”.
              </p>
            )}
          </section>

          <section className="research-detail-card research-assets-card">
            <div className="section-heading">
              <div>
                <h2>Research assets</h2>
              </div>
              <div className="research-assets-heading-actions">
                <p>{materials.length} images</p>
                <ResearchAssetUploader
                  configuration={groupConfiguration}
                  vehicleLabel={selectedVehicleIdentity.makeModel}
                  targets={researchTargets}
                  onSaveMaterials={async (uploaded) => {
                    const nextMaterials = [...materials, ...uploaded].slice(-50);
                    const saved = await saveAssets(nextMaterials);
                    if (saved) setMaterials(nextMaterials);
                    return saved;
                  }}
                />
              </div>
            </div>

            <label className="research-section-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={assetQuery}
                onChange={(event) => setAssetQuery(event.target.value)}
                placeholder="Search filename, product, configuration, or tag"
                aria-label="Search research assets"
              />
            </label>

            {materials.length > 0 && (
              <>
                <div
                  className="research-asset-mapping-grid"
                  aria-busy={assetPageLoading}
                >
                  {assetPageLoading
                    ? Array.from(
                        {
                          length: Math.min(
                            assetPagination.pageSize,
                            filteredMaterials.length,
                          ),
                        },
                        (_, index) => (
                          <article
                            className="research-asset-loading-card"
                            key={`asset-loading-${String(index)}`}
                            aria-hidden="true"
                          >
                            <div />
                            <span />
                            <span />
                            <span />
                          </article>
                        ),
                      )
                    : assetPageItems.map((item) => {
                        const selectedTarget = resolveMaterialTarget(item);
                        return (
                  <article key={item.id}>
                    <div className="research-asset-mapping-preview">
                      {item.fileData ? (
                        <img src={item.fileData} alt={item.fileName || item.title} />
                      ) : (
                        <span>LINK</span>
                      )}
                    </div>
                    <div className="research-asset-mapping-body">
                      <strong title={item.fileName || item.title}>
                        {item.fileName || item.title}
                      </strong>
                      <div className="research-asset-assignment">
                        <span>{targetLabel(selectedTarget)}</span>
                        {item.tags.length > 0 ? (
                          <div className="research-asset-tag-list">
                            {item.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        ) : (
                          <small>No tags</small>
                        )}
                      </div>
                      {editingAssetId === item.id && (
                        <label>
                          Configuration
                          <select
                            value={editingTargetId}
                            onChange={(event) =>
                              setEditingTargetId(event.target.value)
                            }
                          >
                            <option value="" disabled>
                              Select product and options
                            </option>
                            {researchTargetGroups.map((group) => (
                              <optgroup key={group.id} label={group.product}>
                                {group.rows.map((target, index) => (
                                  <option key={target.id} value={target.id}>
                                    Configuration {index + 1} ·{' '}
                                    {target.options.length
                                      ? target.options
                                          .map(
                                            ([key, value]) =>
                                              `${key}: ${value}`,
                                          )
                                          .join(' / ')
                                      : 'Base vehicle'}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="research-asset-card-actions">
                        {editingAssetId === item.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingAssetId(null);
                                setEditingTargetId('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={!editingTargetId || details.saving}
                              onClick={() =>
                                void saveAssetConfiguration(item.id)
                              }
                            >
                              <Save /> Save
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAssetId(item.id);
                              setEditingTargetId(selectedTarget?.id ?? '');
                            }}
                          >
                            <Pencil /> Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={details.saving}
                          onClick={() => void removeAsset(item.id)}
                        >
                          <Trash2 /> Remove
                        </Button>
                      </div>
                    </div>
                  </article>
                        );
                      })}
                </div>
                {!assetPageLoading && filteredMaterials.length === 0 && (
                  <p className="research-search-empty">
                    No assets match “{assetQuery}”.
                  </p>
                )}
                <WorkbenchPagination
                  recordCount={filteredMaterials.length}
                  pagination={assetPagination}
                  onPaginationChange={setAssetPagination}
                  itemLabel="assets"
                />
                <p className="research-asset-status" role="status">
                  {message || details.error}
                </p>
              </>
            )}
          </section>
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
                  name: actor.name.replace(/\s*\(.*\)$/, ''),
                }}
                size="md"
              />
              <textarea
                aria-label="Leave a comment"
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
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
