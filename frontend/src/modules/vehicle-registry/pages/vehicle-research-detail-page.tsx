import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  type ActivityEntry,
  type NewActivityComment,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import {
  ContentTabs,
  ContentTabsPanel,
} from '@coverland-engineering/ui/content-tabs';
import {
  ArrowLeft,
  Images,
  List,
  Pencil,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  RESEARCH_DISPOSITION_LABELS,
  RESEARCH_DISPOSITION_TONES,
  researchDisposition,
} from '@/shared/domain/research-approval';
import { StatusBadge } from '@/shared/components/status-badge';
import { WorkbenchPagination } from '@/shared/components/workbench-pagination';
import {
  PRODUCT_TYPES,
  type VehicleConfiguration,
} from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  researchAssetRelevance,
  type ResearchAssetCandidate,
  type ResearchAssetRelevance,
} from '../research-asset-relevance';
import {
  ResearchAssetClassificationFields,
  researchAssetOptionValues,
  ResearchAssetUploader,
  type ResearchAssetMetadata,
  type ResearchAssetTarget,
} from '../research-asset-uploader';
import { ResearchConfigurationDialog } from '../research-configuration-dialog';
import {
  RESEARCH_CONFIGURATION_VERSION_KEY,
  RESEARCH_CONFIGURATION_VERSION_SEED,
  researchConfigurationVersionListSchema,
  type ResearchConfigurationVersion,
  type ResearchConfigurationVersionStatus,
} from '../research-configuration-version-model';
import { ResearchHandoffDialog } from '../research-handoff-card';
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
import { vehicleResearchIdentity } from '../vehicle-research-grid-model';
import './vehicle-research-detail-page.css';

function configurationYears(configuration: VehicleConfiguration): number[] {
  const identity = vehicleResearchIdentity(configuration.vehicle);
  const match = /^(\d{4})(?:[–-](\d{4}))?$/.exec(identity.years);
  const start = configuration.yearStart ?? Number(match?.[1]);
  const end = configuration.yearEnd ?? Number(match?.[2] ?? match?.[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return [];
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function VehicleResearchDetailPage() {
  const navigate = useNavigate();
  const { configurationId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const focusedConfigurationId = searchParams.get('configuration');
  const { actor } = useOperations();
  const {
    configurations,
    projects,
    vehicleOptionKeys,
    vehicleZones,
    approvalRequests,
  } = useWorkbenchStore();
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
  const availableYears = Array.from(
    new Set(
      vehicleConfigurations.flatMap((item) => {
        const label = vehicleResearchIdentity(item.vehicle).years;
        const match = /^(\d{4})(?:[–-](\d{4}))?$/.exec(label);
        if (!match) return [];
        const start = Number(match[1]);
        const end = Number(match[2] ? match[2] : match[1]);
        return Array.from(
          { length: Math.max(0, end - start + 1) },
          (_, index) => start + index,
        );
      }),
    ),
  ).sort((left, right) => left - right);
  const groupConfiguration =
    vehicleConfigurations.slice(0, 1).pop() ?? configuration;
  const researchGroupId = groupConfiguration?.id ?? configurationId;
  const baseResearchTargets = Array.from(
    vehicleConfigurations
      .flatMap((vehicleConfiguration) =>
        (vehicleConfiguration.productTypeId
          ? PRODUCT_TYPES.filter(
              (productType) =>
                productType.id === vehicleConfiguration.productTypeId,
            )
          : PRODUCT_TYPES
        ).map((productType) => {
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
      .reduce((targets, target) => {
        const key = `${target.productTypeId}:${JSON.stringify(target.options)}`;
        if (!targets.has(key)) targets.set(key, target);
        return targets;
      }, new Map<string, ResearchAssetTarget>())
      .values(),
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
  const configurationVersions = useRdRecords(
    RESEARCH_CONFIGURATION_VERSION_KEY,
    researchConfigurationVersionListSchema,
    RESEARCH_CONFIGURATION_VERSION_SEED,
  );
  const researchTargets: readonly ResearchAssetTarget[] =
    baseResearchTargets.flatMap((target) => {
      const approvedVersions = configurationVersions.records
        .filter(
          (version) =>
            version.researchConfigurationId === target.id &&
            version.status === 'APPROVED',
        )
        .sort((left, right) => right.versionNumber - left.versionNumber);
      if (approvedVersions.length === 0) return [target];
      const currentVersion = approvedVersions[0];
      if (currentVersion.action === 'DELETE') return [];
      return [{ ...target, options: currentVersion.options }];
    });
  const researchTargetGroups = PRODUCT_TYPES.map((productType) => ({
    ...productType,
    rows: researchTargets.filter(
      (target) => target.productTypeId === productType.id,
    ),
  })).filter((group) => group.rows.length > 0);
  const researchCandidates = researchTargetGroups.flatMap((group) =>
    group.rows.map((target, index) => {
      const source = vehicleConfigurations.find(
        (item) => item.id === target.configurationId,
      );
      const approvedVersion = configurationVersions.records
        .filter(
          (version) =>
            version.researchConfigurationId === target.id &&
            version.status === 'APPROVED' &&
            version.action === 'UPSERT',
        )
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .shift();
      const years = approvedVersion?.years.length
        ? approvedVersion.years
        : source
          ? configurationYears(source)
          : [];
      const optionSummary = target.options.length
        ? target.options.map(([key, value]) => `${key}: ${value}`).join(' · ')
        : 'Base vehicle';
      return {
        ...target,
        years,
        label: `${group.product} · Configuration ${String(index + 1)} · ${years.length ? `${String(years[0])}–${String(years[years.length - 1])}` : 'Year not set'} · ${optionSummary}`,
      };
    }),
  );

  useEffect(() => {
    if (!focusedConfigurationId || researchTargets.length === 0) return;
    const focusedCard = document.getElementById(
      `research-configuration-${focusedConfigurationId}`,
    );
    focusedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedConfigurationId, researchTargets.length]);
  const history = details.records.filter(
    (item) => item.configurationId === researchGroupId,
  );
  const latest = history.slice(-1).pop();
  const [materials, setMaterials] = useState<readonly ResearchMaterial[]>(
    latest?.materials ?? [],
  );
  const [message, setMessage] = useState('');
  const [detailView, setDetailView] = useState<'rows' | 'assets'>('rows');
  const [productRowQuery, setProductRowQuery] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [selectedAssetCandidateId, setSelectedAssetCandidateId] =
    useState('all');
  const [assetPagination, setAssetPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });
  const [assetPageItems, setAssetPageItems] = useState<
    readonly ResearchMaterial[]
  >([]);
  const [assetPageLoading, setAssetPageLoading] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] =
    useState<ResearchAssetMetadata | null>(null);
  const [selectedResearchTarget, setSelectedResearchTarget] =
    useState<ResearchAssetTarget | null>(null);
  const [selectedHandoffTarget, setSelectedHandoffTarget] = useState<
    (ResearchAssetTarget & { configurationNumber: number }) | null
  >(null);

  function handoffConfiguration(
    target: ResearchAssetTarget,
  ): VehicleConfiguration | null {
    const relevantOptionNames = new Set(
      vehicleOptionKeys
        .filter((key) => key.productTypeId === target.productTypeId)
        .map((key) => key.name),
    );
    const matchingSources = vehicleConfigurations.filter(
      (item) =>
        JSON.stringify(
          item.options.filter(([key]) => relevantOptionNames.has(key)),
        ) === JSON.stringify(target.options),
    );
    const source = vehicleConfigurations.find(
      (item) => item.id === target.configurationId,
    );
    if (!source) return null;
    const productProjectIds = Array.from(
      new Set(
        matchingSources.flatMap((item) =>
          item.projectGroupIds.filter(
            (projectId) =>
              projects.find((project) => project.id === projectId)
                ?.productTypeId === target.productTypeId,
          ),
        ),
      ),
    );
    return {
      ...source,
      id: target.id,
      productTypeId: target.productTypeId,
      options: target.options,
      projectGroupIds: productProjectIds,
    };
  }

  const selectedHandoffConfiguration = selectedHandoffTarget
    ? handoffConfiguration(selectedHandoffTarget)
    : null;
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
  const selectedAssetCandidate = useMemo<ResearchAssetCandidate | null>(() => {
    if (selectedAssetCandidateId === 'all') return null;
    const separatorIndex = selectedAssetCandidateId.indexOf(':');
    if (separatorIndex < 0) return null;
    const sourceConfigurationId = selectedAssetCandidateId.slice(
      0,
      separatorIndex,
    );
    const productTypeId = selectedAssetCandidateId.slice(
      separatorIndex + 1,
    ) as ResearchAssetCandidate['productTypeId'];
    const source = configurations.find(
      (item) => item.id === sourceConfigurationId,
    );
    if (!source) return null;
    const allowedOptionNames = new Set(
      vehicleOptionKeys
        .filter((key) => key.productTypeId === productTypeId)
        .map((key) => key.name),
    );
    const approvedVersion = configurationVersions.records
      .filter(
        (version) =>
          version.researchConfigurationId === selectedAssetCandidateId &&
          version.status === 'APPROVED' &&
          version.action === 'UPSERT',
      )
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .shift();
    const linkedZoneIds = projects
      .filter((project) => source.projectGroupIds.includes(project.id))
      .flatMap((project) => project.zoneProjects.map((zone) => zone.zoneId));
    const zoneIds = linkedZoneIds.length
      ? linkedZoneIds
      : vehicleZones
          .filter((zone) => zone.productTypeId === productTypeId)
          .map((zone) => zone.id);

    return {
      id: selectedAssetCandidateId,
      label:
        PRODUCT_TYPES.find((item) => item.id === productTypeId)?.product ??
        productTypeId,
      years: approvedVersion?.years.length
        ? approvedVersion.years
        : configurationYears(source),
      productTypeId,
      options:
        approvedVersion?.options ??
        source.options.filter(([key]) => allowedOptionNames.has(key)),
      zoneIds,
    };
  }, [
    configurationVersions.records,
    configurations,
    projects,
    selectedAssetCandidateId,
    vehicleOptionKeys,
    vehicleZones,
  ]);
  const assetRelevanceById = useMemo(() => {
    const result = new Map<string, ResearchAssetRelevance>();
    if (!selectedAssetCandidate) return result;
    for (const material of materials) {
      result.set(
        material.id,
        researchAssetRelevance(
          {
            years: material.years,
            productTypeIds: material.productTypeIds.length
              ? material.productTypeIds
              : [material.productTypeId],
            options: material.optionSelections,
            zoneIds: material.vehicleZoneIds,
          },
          selectedAssetCandidate,
        ),
      );
    }
    return result;
  }, [materials, selectedAssetCandidate]);
  const filteredMaterials = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    const matchingQuery = materials.filter((material) => {
      const productLabels = (
        material.productTypeIds.length
          ? material.productTypeIds
          : [material.productTypeId]
      ).map(
        (productTypeId) =>
          PRODUCT_TYPES.find((item) => item.id === productTypeId)?.product ??
          productTypeId,
      );
      const zoneLabels = material.vehicleZoneIds.map(
        (zoneId) =>
          vehicleZones.find((zone) => zone.id === zoneId)?.name ?? zoneId,
      );
      const matches = [
        material.title,
        material.fileName,
        ...productLabels,
        ...material.years.map(String),
        ...zoneLabels,
        ...material.optionSelections.flatMap(([key, value]) => [key, value]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
      return !query || matches;
    });
    if (!selectedAssetCandidate) return matchingQuery;
    return matchingQuery
      .filter((material) => assetRelevanceById.get(material.id)?.productMatch)
      .sort(
        (left, right) =>
          (assetRelevanceById.get(right.id)?.score ?? 0) -
          (assetRelevanceById.get(left.id)?.score ?? 0),
      );
  }, [
    assetQuery,
    assetRelevanceById,
    materials,
    selectedAssetCandidate,
    vehicleZones,
  ]);

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

    return () => {
      window.clearTimeout(timeout);
    };
  }, [assetPagination.pageIndex, assetPagination.pageSize, filteredMaterials]);

  useEffect(() => {
    setAssetPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [assetQuery, selectedAssetCandidateId]);

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
          authorId: item.authorId,
          attachments: item.attachments,
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

  async function saveAssets(
    nextMaterials: readonly ResearchMaterial[] = materials,
  ): Promise<boolean> {
    const parsed = researchDetailSchema.safeParse({
      id: crypto.randomUUID(),
      configurationId: researchGroupId,
      researchStatus:
        latest?.researchStatus ??
        (['COMPLETE', 'COMPLETED'].includes(configuration?.researchStatus ?? '')
          ? 'COMPLETED'
          : 'IN_PROGRESS'),
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

  async function saveAssetClassification(assetId: string) {
    if (!editingMetadata) return;
    const nextMaterials = materials.map((material) =>
      material.id === assetId
        ? {
            ...material,
            productTypeId:
              editingMetadata.productTypeIds[0] ?? material.productTypeId,
            productTypeIds: [...editingMetadata.productTypeIds],
            years: [...editingMetadata.years],
            optionSelections: editingMetadata.optionValues.map(
              ({ key, value }) => [key, value] as [string, string],
            ),
            selectedOptionValues: [...editingMetadata.optionValues],
            vehicleZoneIds: [...editingMetadata.vehicleZoneIds],
            researchRowId: '',
          }
        : material,
    );
    const saved = await saveAssets(nextMaterials);
    if (!saved) return;
    setMaterials(nextMaterials);
    setEditingAssetId(null);
    setEditingMetadata(null);
  }

  async function createConfigurationVersion(
    version: ResearchConfigurationVersion,
  ) {
    return configurationVersions.save((current) => {
      const next =
        version.status === 'APPROVED'
          ? current.map((item) =>
              item.researchConfigurationId ===
                version.researchConfigurationId && item.status === 'APPROVED'
                ? { ...item, status: 'SUPERSEDED' as const }
                : item,
            )
          : current;
      return [...next, version];
    });
  }

  async function updateConfigurationVersionStatus(
    versionId: string,
    status: ResearchConfigurationVersionStatus,
  ) {
    return configurationVersions.save((current) => {
      const selected = current.find((item) => item.id === versionId);
      if (!selected) return current;
      return current.map((item) => {
        if (
          status === 'APPROVED' &&
          item.researchConfigurationId === selected.researchConfigurationId &&
          item.status === 'APPROVED'
        ) {
          return { ...item, status: 'SUPERSEDED' as const };
        }
        if (item.id !== versionId) return item;
        return {
          ...item,
          status,
          reviewedBy:
            status === 'APPROVED' || status === 'REJECTED'
              ? actor.name
              : item.reviewedBy,
          reviewedAt:
            status === 'APPROVED' || status === 'REJECTED'
              ? new Date().toISOString()
              : item.reviewedAt,
        };
      });
    });
  }

  async function removeAsset(assetId: string) {
    const nextMaterials = materials.filter((item) => item.id !== assetId);
    const saved = await saveAssets(nextMaterials);
    if (saved) setMaterials(nextMaterials);
  }

  function addComment({ message, files }: NewActivityComment): void {
    if (!message) return;
    void comments.save((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        configurationId: researchGroupId,
        message,
        author: actor.name,
        authorId: actor.id,
        // Files are not uploaded yet; keep what the attachment chip renders.
        attachments: files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
        })),
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function editComment(commentId: string, message: string): void {
    void comments.save((current) =>
      current.map((item) =>
        item.id === commentId ? { ...item, message } : item,
      ),
    );
  }

  function deleteComment(commentId: string): void {
    void comments.save((current) =>
      current.filter((item) => item.id !== commentId),
    );
  }

  function removeCommentAttachment(
    commentId: string,
    attachmentId: string,
  ): void {
    void comments.save((current) =>
      current.map((item) =>
        item.id === commentId
          ? {
              ...item,
              attachments: item.attachments?.filter(
                (attachment) => attachment.id !== attachmentId,
              ),
            }
          : item,
      ),
    );
  }

  function materialMetadata(material: ResearchMaterial): ResearchAssetMetadata {
    const productTypeIds = material.productTypeIds.length
      ? material.productTypeIds
      : [material.productTypeId];
    const choices = researchAssetOptionValues(researchTargets);
    return {
      years: material.years.length ? material.years : availableYears,
      productTypeIds,
      optionValues: material.selectedOptionValues.length
        ? material.selectedOptionValues
        : material.optionSelections.flatMap(([key, value]) => {
            const choice = choices.find(
              (item) =>
                productTypeIds.includes(item.productTypeId) &&
                item.key === key &&
                item.value === value,
            );
            return choice ? [choice] : [];
          }),
      vehicleZoneIds: material.vehicleZoneIds,
    };
  }

  function isClassificationComplete(value: ResearchAssetMetadata | null) {
    if (!value?.productTypeIds.length || !value.vehicleZoneIds.length) {
      return false;
    }
    const choices = researchAssetOptionValues(researchTargets);
    return value.productTypeIds
      .filter((productTypeId) =>
        choices.some((choice) => choice.productTypeId === productTypeId),
      )
      .every((productTypeId) =>
        value.optionValues.some(
          (option) => option.productTypeId === productTypeId,
        ),
      );
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
          <ContentTabs
            label="Vehicle research detail view"
            value={detailView}
            onValueChange={(value) => {
              setDetailView(value === 'assets' ? 'assets' : 'rows');
            }}
            items={[
              {
                value: 'rows',
                label: 'Product research rows',
                icon: <List />,
              },
              {
                value: 'assets',
                label: 'Research assets',
                icon: <Images />,
              },
            ]}
          >
            <ContentTabsPanel value="rows">
              <section className="research-detail-card research-row-card">
                <div className="section-heading">
                  <div>
                    <h2>Product research rows</h2>
                  </div>
                  <p>
                    Classify each image by product, option values, and vehicle
                    zones.
                  </p>
                </div>
                <label className="research-section-search">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={productRowQuery}
                    onChange={(event) => {
                      setProductRowQuery(event.target.value);
                    }}
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
                          <span
                            className="research-product-mark"
                            aria-hidden="true"
                          >
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
                        {group.rows.map((target) => {
                          const handoff = handoffConfiguration(target);
                          const disposition = handoff
                            ? researchDisposition(approvalRequests, handoff)
                            : 'PENDING';
                          const complete = ['COMPLETE', 'COMPLETED'].includes(
                            handoff?.researchStatus ?? '',
                          );
                          return (
                            <article
                              className="research-product-row-card"
                              key={target.id}
                              id={`research-configuration-${target.id}`}
                              data-focused={
                                focusedConfigurationId === target.id
                              }
                              aria-current={
                                focusedConfigurationId === target.id
                                  ? 'true'
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className="research-product-row-button"
                                onClick={() => {
                                  setSelectedResearchTarget(target);
                                }}
                              >
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
                                <span className="research-product-row-manage">
                                  View configuration & history
                                </span>
                              </button>
                              <footer className="research-product-row-footer">
                                <div>
                                  {focusedConfigurationId === target.id && (
                                    <span className="research-product-row-focused">
                                      Selected configuration
                                    </span>
                                  )}
                                  <StatusBadge
                                    label={
                                      complete ? 'Completed' : 'In progress'
                                    }
                                    tone={complete ? 'success' : 'progress'}
                                  />
                                  <StatusBadge
                                    label={
                                      RESEARCH_DISPOSITION_LABELS[disposition]
                                    }
                                    tone={
                                      RESEARCH_DISPOSITION_TONES[disposition]
                                    }
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedHandoffTarget(target);
                                  }}
                                >
                                  Project handoff
                                </Button>
                              </footer>
                            </article>
                          );
                        })}
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
            </ContentTabsPanel>

            <ContentTabsPanel value="assets">
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
                      vehicleZones={vehicleZones}
                      onSaveMaterials={async (uploaded) => {
                        const nextMaterials = [...materials, ...uploaded].slice(
                          -50,
                        );
                        const saved = await saveAssets(nextMaterials);
                        if (saved) setMaterials(nextMaterials);
                        return saved;
                      }}
                    />
                  </div>
                </div>

                <div className="research-asset-controls">
                  <label className="research-candidate-filter">
                    <span>Configuration (project candidate)</span>
                    <select
                      value={selectedAssetCandidateId}
                      onChange={(event) => {
                        setSelectedAssetCandidateId(event.target.value);
                      }}
                    >
                      <option value="all">All configurations</option>
                      {researchCandidates.map((candidate) => (
                        <option value={candidate.id} key={candidate.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="research-section-search">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      value={assetQuery}
                      onChange={(event) => {
                        setAssetQuery(event.target.value);
                      }}
                      placeholder="Search filename, product, option, or zone"
                      aria-label="Search research assets"
                    />
                  </label>
                </div>

                {selectedAssetCandidate && (
                  <p className="research-relevance-help">
                    Showing assets for the selected product type, ranked by
                    matching year, option values, and vehicle zone.
                  </p>
                )}

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
                            const relevance = assetRelevanceById.get(item.id);
                            return (
                              <article key={item.id}>
                                <div className="research-asset-mapping-preview">
                                  {item.fileData ? (
                                    <img
                                      src={item.fileData}
                                      alt={item.fileName || item.title}
                                    />
                                  ) : (
                                    <span>LINK</span>
                                  )}
                                </div>
                                <div className="research-asset-mapping-body">
                                  <strong title={item.fileName || item.title}>
                                    {item.fileName || item.title}
                                  </strong>
                                  {relevance && (
                                    <div
                                      className={`research-asset-relevance research-asset-relevance--${relevance.label
                                        .split(' ')[0]
                                        .toLowerCase()}`}
                                    >
                                      <div>
                                        <strong>{relevance.label}</strong>
                                        <span>{relevance.score}%</span>
                                      </div>
                                      <small>
                                        Year{' '}
                                        {relevance.yearMatch
                                          ? 'match'
                                          : 'different'}
                                        {' · '}Options {relevance.optionMatches}
                                        /{relevance.optionTotal}
                                        {' · '}Zone{' '}
                                        {relevance.zoneMatch
                                          ? 'match'
                                          : 'different'}
                                      </small>
                                    </div>
                                  )}
                                  <div className="research-asset-assignment">
                                    <span>
                                      {item.years.length > 0 &&
                                        `${item.years.join(', ')} · `}
                                      {(item.productTypeIds.length
                                        ? item.productTypeIds
                                        : [item.productTypeId]
                                      )
                                        .map(
                                          (productTypeId) =>
                                            PRODUCT_TYPES.find(
                                              (productType) =>
                                                productType.id ===
                                                productTypeId,
                                            )?.product,
                                        )
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </span>
                                    <div className="research-asset-tag-list">
                                      {item.optionSelections.map(
                                        ([key, value]) => (
                                          <span key={`${key}-${value}`}>
                                            {key}: {value}
                                          </span>
                                        ),
                                      )}
                                      {item.vehicleZoneIds.map((zoneId) => (
                                        <span key={zoneId}>
                                          {vehicleZones.find(
                                            (zone) => zone.id === zoneId,
                                          )?.name ?? zoneId}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  {editingAssetId === item.id &&
                                    editingMetadata && (
                                      <ResearchAssetClassificationFields
                                        value={editingMetadata}
                                        onChange={setEditingMetadata}
                                        targets={researchTargets}
                                        vehicleZones={vehicleZones}
                                      />
                                    )}
                                  <div className="research-asset-card-actions">
                                    {editingAssetId === item.id ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingAssetId(null);
                                            setEditingMetadata(null);
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="primary"
                                          disabled={
                                            !isClassificationComplete(
                                              editingMetadata,
                                            ) || details.saving
                                          }
                                          onClick={() =>
                                            void saveAssetClassification(
                                              item.id,
                                            )
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
                                          setEditingMetadata(
                                            materialMetadata(item),
                                          );
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
            </ContentTabsPanel>
          </ContentTabs>
        </main>

        <aside className="research-activity-column">
          <Activity
            entries={activity}
            title="Timeline"
            emptyMessage="No research activity yet."
            systemAuthorLabel="Coverland System"
            commenter={{
              id: actor.id,
              // Initials come from the name; drop the "(Demo)" suffix.
              name: actor.name.replace(/\s*\(.*\)$/, ''),
            }}
            onSubmit={addComment}
            onEditComment={editComment}
            onDeleteComment={deleteComment}
            onRemoveAttachment={removeCommentAttachment}
          />
        </aside>
      </div>
      <ResearchConfigurationDialog
        open={Boolean(selectedResearchTarget)}
        onOpenChange={(open) => {
          if (!open) setSelectedResearchTarget(null);
        }}
        target={selectedResearchTarget}
        availableYears={availableYears}
        researchStatus={
          vehicleConfigurations.find(
            (item) => item.id === selectedResearchTarget?.configurationId,
          )?.researchStatus ?? configuration.researchStatus
        }
        versions={configurationVersions.records}
        actor={actor.name}
        saving={configurationVersions.saving}
        onCreateVersion={createConfigurationVersion}
        onUpdateVersionStatus={updateConfigurationVersionStatus}
      />
      <ResearchHandoffDialog
        open={Boolean(selectedHandoffTarget)}
        onOpenChange={(open) => {
          if (!open) setSelectedHandoffTarget(null);
        }}
        configuration={selectedHandoffConfiguration}
        sourceConfigurationId={selectedHandoffTarget?.configurationId}
        productLabel={selectedHandoffTarget?.productLabel}
        configurationNumber={selectedHandoffTarget?.configurationNumber}
      />
    </section>
  );
}
