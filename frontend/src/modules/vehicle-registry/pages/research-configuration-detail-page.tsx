import { useMemo, useState } from 'react';
import {
  Activity,
  type ActivityEntry,
  type NewActivityComment,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import {
  ResearchAssetGallery,
  type ResearchAssetGalleryItem,
} from '@coverland-engineering/ui/vehicle-research/research-asset-gallery';
import { ResearchAssetPreviewDialog } from '@coverland-engineering/ui/vehicle-research/research-asset-preview-dialog';
import { ResearchConfigurationHeader } from '@coverland-engineering/ui/vehicle-research/research-configuration-header';
import { ResearchHandoffPanel } from '@coverland-engineering/ui/vehicle-research/research-handoff-panel';
import { ArrowLeft, ExternalLink, Images } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  RESEARCH_DISPOSITION_LABELS,
  RESEARCH_DISPOSITION_TONES,
  researchDisposition,
} from '@/shared/domain/research-approval';
import {
  PRODUCT_TYPES,
  type VehicleConfiguration,
} from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ResearchApprovalPanel } from '../research-approval-panel';
import {
  researchAssetRelevance,
  type ResearchAssetCandidate,
} from '../research-asset-relevance';
import type { ResearchAssetTarget } from '../research-asset-uploader-adapter';
import { ResearchConfigurationDialog } from '../research-configuration-manager-adapter';
import {
  RESEARCH_CONFIGURATION_VERSION_KEY,
  RESEARCH_CONFIGURATION_VERSION_SEED,
  researchConfigurationVersionListSchema,
  type ResearchConfigurationVersion,
  type ResearchConfigurationVersionStatus,
} from '../research-configuration-version-model';
import {
  RESEARCH_COMMENT_KEY,
  RESEARCH_COMMENT_SEED,
  RESEARCH_DETAIL_KEY,
  RESEARCH_DETAIL_SEED,
  researchCommentListSchema,
  researchDetailListSchema,
  type ResearchMaterial,
} from '../vehicle-research-detail-model';
import {
  formatYearRanges,
  vehicleResearchIdentity,
  yearsFromLabel,
} from '../vehicle-research-grid-model';
import '../research-handoff-card.css';
import './vehicle-research-detail-page.css';

function configurationYears(configuration: VehicleConfiguration): number[] {
  const identity = vehicleResearchIdentity(configuration.vehicle);
  if (configuration.yearStart === undefined) {
    return yearsFromLabel(identity.years);
  }
  const start = configuration.yearStart;
  const end = configuration.yearEnd ?? start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return [];
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function firstItem<T>(items: readonly T[]): T | undefined {
  return items[0];
}

export function ResearchConfigurationDetailPage() {
  const navigate = useNavigate();
  const { configurationId = '', researchConfigurationId = '' } = useParams();
  const { actor } = useOperations();
  const {
    configurations,
    setConfigurations,
    vehicleOptionKeys,
    vehicleZones,
    projects,
    approvalRequests,
  } = useWorkbenchStore();
  const [previewAsset, setPreviewAsset] = useState<ResearchMaterial | null>(
    null,
  );
  const previewOptionGroups = useMemo(() => {
    if (!previewAsset) return [];
    const productTypeIds = previewAsset.productTypeIds.length
      ? previewAsset.productTypeIds
      : [previewAsset.productTypeId];
    return productTypeIds
      .map((previewProductTypeId) => ({
        productTypeId: previewProductTypeId,
        productLabel:
          PRODUCT_TYPES.find(
            (productType) => productType.id === previewProductTypeId,
          )?.product ?? previewProductTypeId,
        options: previewAsset.selectedOptionValues.length
          ? previewAsset.selectedOptionValues
              .filter((option) => option.productTypeId === previewProductTypeId)
              .map((option) => [option.key, option.value] as const)
          : previewAsset.optionSelections.filter(([key]) =>
              vehicleOptionKeys.some(
                (optionKey) =>
                  optionKey.productTypeId === previewProductTypeId &&
                  optionKey.name === key,
              ),
            ),
      }))
      .filter((group) => group.options.length > 0);
  }, [previewAsset, vehicleOptionKeys]);
  const researchDetails = useRdRecords(
    RESEARCH_DETAIL_KEY,
    researchDetailListSchema,
    RESEARCH_DETAIL_SEED,
  );
  const configurationVersions = useRdRecords(
    RESEARCH_CONFIGURATION_VERSION_KEY,
    researchConfigurationVersionListSchema,
    RESEARCH_CONFIGURATION_VERSION_SEED,
  );
  const comments = useRdRecords(
    RESEARCH_COMMENT_KEY,
    researchCommentListSchema,
    RESEARCH_COMMENT_SEED,
  );
  const sourceConfiguration = configurations.find(
    (configuration) => configuration.id === configurationId,
  );
  const productTypeId = researchConfigurationId.slice(
    researchConfigurationId.lastIndexOf(':') + 1,
  );
  const productType = PRODUCT_TYPES.find((item) => item.id === productTypeId);
  const approvedVersion = firstItem(
    configurationVersions.records
      .filter(
        (version) =>
          version.researchConfigurationId === researchConfigurationId &&
          version.status === 'APPROVED' &&
          version.action === 'UPSERT',
      )
      .sort((left, right) => right.versionNumber - left.versionNumber),
  );
  const allowedOptionNames = new Set(
    vehicleOptionKeys
      .filter((key) => key.productTypeId === productType?.id)
      .map((key) => key.name),
  );
  const approvedVersionFor = (sourceId: string) =>
    firstItem(
      configurationVersions.records
        .filter(
          (version) =>
            version.researchConfigurationId ===
              `${sourceId}:${productTypeId}` &&
            version.status === 'APPROVED' &&
            version.action === 'UPSERT',
        )
        .sort((left, right) => right.versionNumber - left.versionNumber),
    );
  const optionSignature = (options: readonly (readonly [string, string])[]) =>
    [...options]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}\u0000${value}`)
      .join('\u0001');
  const effectiveOptions = (configuration: VehicleConfiguration) =>
    approvedVersionFor(configuration.id)?.options ??
    configuration.options.filter(([key]) => allowedOptionNames.has(key));
  const sourceOptions = sourceConfiguration
    ? (approvedVersion?.options ?? effectiveOptions(sourceConfiguration))
    : [];
  const matchingSourceConfigurations =
    sourceConfiguration && productType
      ? configurations.filter(
          (configuration) =>
            vehicleResearchIdentity(configuration.vehicle).makeModel ===
              vehicleResearchIdentity(sourceConfiguration.vehicle).makeModel &&
            (!configuration.productTypeId ||
              configuration.productTypeId === productType.id) &&
            optionSignature(effectiveOptions(configuration)) ===
              optionSignature(sourceOptions),
        )
      : [];
  const target: ResearchAssetTarget | null =
    sourceConfiguration && productType
      ? {
          id: researchConfigurationId,
          configurationId,
          productTypeId: productType.id,
          productLabel: productType.product,
          options: sourceOptions,
        }
      : null;
  const availableYears = Array.from(
    new Set(
      matchingSourceConfigurations.flatMap((configuration) => {
        const version = approvedVersionFor(configuration.id);
        return version?.years.length
          ? version.years
          : configurationYears(configuration);
      }),
    ),
  ).sort((left, right) => left - right);
  const activity = useMemo<readonly ActivityEntry[]>(
    () => [
      ...configurationVersions.records
        .filter(
          (version) =>
            version.researchConfigurationId === researchConfigurationId,
        )
        .flatMap((version) => {
          const created: ActivityEntry = {
            id: `version-created-${version.id}`,
            type: 'SYSTEM_LOG',
            message:
              version.action === 'DELETE'
                ? `Configuration deletion requested in Version ${String(version.versionNumber)}`
                : `Configuration Version ${String(version.versionNumber)} saved`,
            createdAt: version.createdAt,
          };
          const reviewed: ActivityEntry | null = version.reviewedAt
            ? {
                id: `version-reviewed-${version.id}`,
                type: 'SYSTEM_LOG',
                message: `Configuration Version ${String(version.versionNumber)} ${version.status.toLowerCase().split('_').join(' ')}`,
                createdAt: version.reviewedAt,
              }
            : null;
          return reviewed ? [created, reviewed] : [created];
        }),
      ...comments.records
        .filter(
          (comment) =>
            comment.configurationId === researchConfigurationId ||
            (researchConfigurationId === 'c01:PT-SC' &&
              comment.configurationId === configurationId),
        )
        .map((comment) => ({
          id: comment.id,
          type: 'USER_COMMENT' as const,
          message: comment.message,
          author: comment.author,
          authorId: comment.authorId,
          attachments: comment.attachments,
          createdAt: comment.createdAt,
        })),
    ],
    [
      comments.records,
      configurationId,
      configurationVersions.records,
      researchConfigurationId,
    ],
  );

  function addComment({ message, files }: NewActivityComment): void {
    if (!message) return;
    void comments.save((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        configurationId: researchConfigurationId,
        message,
        author: actor.name,
        authorId: actor.id,
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
      current.map((comment) =>
        comment.id === commentId ? { ...comment, message } : comment,
      ),
    );
  }

  function deleteComment(commentId: string): void {
    void comments.save((current) =>
      current.filter((comment) => comment.id !== commentId),
    );
  }

  function removeCommentAttachment(
    commentId: string,
    attachmentId: string,
  ): void {
    void comments.save((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              attachments: comment.attachments?.filter(
                (attachment) => attachment.id !== attachmentId,
              ),
            }
          : comment,
      ),
    );
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

  if (!sourceConfiguration || !target) {
    return (
      <section className="research-detail-missing">
        <h1>Research configuration not found</h1>
        <Button onClick={() => void navigate('/vehicle-research')}>
          Back to Research Vehicle
        </Button>
      </section>
    );
  }

  const vehicleIdentity = vehicleResearchIdentity(sourceConfiguration.vehicle);
  const vehicleConfigurations = configurations.filter(
    (configuration) =>
      vehicleResearchIdentity(configuration.vehicle).makeModel ===
      vehicleIdentity.makeModel,
  );
  const matchingSources = vehicleConfigurations.filter(
    (configuration) =>
      JSON.stringify(
        configuration.options.filter(([key]) => allowedOptionNames.has(key)),
      ) === JSON.stringify(target.options),
  );
  const handoffConfiguration: VehicleConfiguration = {
    ...sourceConfiguration,
    id: target.id,
    productTypeId: target.productTypeId,
    options: target.options,
    projectGroupIds: Array.from(
      new Set(
        matchingSources.flatMap((configuration) =>
          configuration.projectGroupIds.filter(
            (projectId) =>
              projects.find((project) => project.id === projectId)
                ?.productTypeId === target.productTypeId,
          ),
        ),
      ),
    ),
  };
  const handoffDisposition = researchDisposition(
    approvalRequests,
    handoffConfiguration,
  );
  const researchComplete = ['COMPLETE', 'COMPLETED'].includes(
    handoffConfiguration.researchStatus,
  );
  const currentResearchStatus =
    sourceConfiguration.researchStatus === 'COMPLETE'
      ? 'COMPLETED'
      : sourceConfiguration.researchStatus === 'RESEARCHING'
        ? 'IN_PROGRESS'
        : sourceConfiguration.researchStatus;
  function changeResearchStatus(
    status: 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED',
  ): void {
    const matchingIds = new Set(
      matchingSourceConfigurations.map((configuration) => configuration.id),
    );
    setConfigurations((current) =>
      current.map((configuration) =>
        matchingIds.has(configuration.id)
          ? { ...configuration, researchStatus: status }
          : configuration,
      ),
    );
  }
  const researchGroupId = vehicleConfigurations[0]?.id ?? configurationId;
  const researchHistory = researchDetails.records.filter(
    (detail) => detail.configurationId === researchGroupId,
  );
  const researchMaterials =
    researchHistory[researchHistory.length - 1]?.materials ?? [];
  const linkedZoneIds = projects
    .filter((project) =>
      matchingSources.some((configuration) =>
        configuration.projectGroupIds.includes(project.id),
      ),
    )
    .flatMap((project) => project.zoneProjects.map((zone) => zone.zoneId));
  const assetCandidate: ResearchAssetCandidate = {
    id: target.id,
    label: target.productLabel,
    years: availableYears,
    productTypeId: target.productTypeId,
    options: target.options,
    zoneIds: linkedZoneIds.length
      ? Array.from(new Set(linkedZoneIds))
      : vehicleZones
          .filter((zone) => zone.productTypeId === target.productTypeId)
          .map((zone) => zone.id),
  };
  const relatedAssets = researchMaterials
    .map((material) => {
      const productTypeIds = material.productTypeIds.length
        ? material.productTypeIds
        : [material.productTypeId];
      const selectedOptions = material.selectedOptionValues.length
        ? material.selectedOptionValues
            .filter((option) => option.productTypeId === target.productTypeId)
            .map((option) => [option.key, option.value] as const)
        : material.optionSelections;
      return {
        material,
        relevance: researchAssetRelevance(
          {
            years: material.years,
            productTypeIds,
            options: selectedOptions,
            zoneIds: material.vehicleZoneIds,
          },
          assetCandidate,
        ),
      };
    })
    .filter(({ relevance }) => relevance.productMatch)
    .sort((left, right) => right.relevance.score - left.relevance.score);
  const assetGalleryItems: readonly ResearchAssetGalleryItem[] =
    relatedAssets.map(({ material, relevance }) => ({
      id: material.id,
      title: material.fileName || material.title,
      previewSrc: material.fileData || undefined,
      previewAlt: material.fileName || material.title,
      relevanceLabel: relevance.label,
      relevanceScore: relevance.score,
      relevanceDetail: `Year ${relevance.yearMatch ? 'match' : 'different'} · Options ${String(relevance.optionMatches)}/${String(relevance.optionTotal)} · Zone ${relevance.zoneMatch ? 'match' : 'different'}`,
      meta: `${material.years.length ? material.years.join(', ') : 'Year not set'} · ${String(material.vehicleZoneIds.length)} ${material.vehicleZoneIds.length === 1 ? 'zone' : 'zones'}`,
      relevanceTone: relevance.label.toLowerCase().startsWith('exact')
        ? 'exact'
        : relevance.label.toLowerCase().startsWith('strong')
          ? 'strong'
          : 'related',
    }));

  return (
    <section className="research-detail-page research-configuration-detail-page">
      <Button
        className="research-back-button"
        variant="ghost"
        onClick={() =>
          void navigate(
            `/vehicle-research/${encodeURIComponent(configurationId)}`,
          )
        }
      >
        <ArrowLeft /> {vehicleIdentity.makeModel}
      </Button>

      <ResearchConfigurationHeader
        vehicle={vehicleIdentity.makeModel}
        years={formatYearRanges(availableYears) || vehicleIdentity.years}
        productType={target.productLabel}
        status={currentResearchStatus}
        statusOptions={[
          { value: 'DRAFT', label: 'Draft' },
          { value: 'IN_PROGRESS', label: 'In progress' },
          { value: 'PENDING_APPROVAL', label: 'Pending approval' },
          {
            value: 'COMPLETED',
            label: 'Complete',
            approvalRequired: true,
          },
        ]}
        onStatusChange={(status) => {
          changeResearchStatus(
            status as
              'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED',
          );
        }}
        onCompletionApprovalRequest={() => {
          changeResearchStatus('PENDING_APPROVAL');
        }}
        onCompletionApprove={() => {
          changeResearchStatus('COMPLETED');
        }}
        onCompletionReject={() => {
          changeResearchStatus('IN_PROGRESS');
        }}
      />

      <div className="research-configuration-management-layout">
        <div className="research-configuration-management-main">
          <ResearchConfigurationDialog
            presentation="page"
            open
            onOpenChange={() => undefined}
            target={target}
            availableYears={availableYears}
            researchStatus={sourceConfiguration.researchStatus}
            versions={configurationVersions.records}
            actor={actor.name}
            saving={configurationVersions.saving}
            onCreateVersion={createConfigurationVersion}
            onUpdateVersionStatus={updateConfigurationVersionStatus}
            onOpenVehicleResearch={() =>
              void navigate(
                `/vehicle-research/${encodeURIComponent(configurationId)}`,
              )
            }
          />

          <ResearchAssetGallery
            items={assetGalleryItems}
            productLabel={target.productLabel}
            onAssetClick={(item) => {
              setPreviewAsset(
                relatedAssets.find(({ material }) => material.id === item.id)
                  ?.material ?? null,
              );
            }}
          />

          <ResearchHandoffPanel
            vehicle={`${vehicleIdentity.makeModel} · ${formatYearRanges(availableYears) || vehicleIdentity.years}`}
            productLabel={target.productLabel}
            options={target.options}
            researchStatus={{
              label: researchComplete ? 'Completed' : 'In progress',
              tone: researchComplete ? 'success' : 'progress',
            }}
            handoffStatus={{
              label: RESEARCH_DISPOSITION_LABELS[handoffDisposition],
              tone: RESEARCH_DISPOSITION_TONES[handoffDisposition],
            }}
          >
            <ResearchApprovalPanel
              configuration={handoffConfiguration}
              sourceConfigurationId={configurationId}
              productLabel={target.productLabel}
            />
          </ResearchHandoffPanel>
        </div>
        <aside className="research-activity-column">
          <Activity
            entries={activity}
            title="Configuration activity"
            emptyMessage="No configuration activity yet."
            systemAuthorLabel="Coverland System"
            commenter={{
              id: actor.id,
              name: actor.name.replace(/\s*\(.*\)$/, ''),
            }}
            onSubmit={addComment}
            onEditComment={editComment}
            onDeleteComment={deleteComment}
            onRemoveAttachment={removeCommentAttachment}
          />
        </aside>
      </div>

      <ResearchAssetPreviewDialog
        className="research-configuration-asset-dialog"
        open={Boolean(previewAsset)}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
        title={previewAsset?.fileName ?? previewAsset?.title ?? 'Asset preview'}
        preview={
          previewAsset ? (
            <div className="research-asset-preview-media">
              {previewAsset.fileData ? (
                <img
                  src={previewAsset.fileData}
                  alt={previewAsset.fileName || previewAsset.title}
                />
              ) : (
                <div>
                  <Images />
                  <strong>No uploaded preview</strong>
                  <span>This asset is saved as a research link.</span>
                  {previewAsset.sourceUrl && (
                    <a
                      href={previewAsset.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink /> Open source
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : null
        }
        details={
          previewAsset ? (
            <dl className="research-configuration-asset-dialog-meta">
              <div>
                <dt>Year</dt>
                <dd>
                  {previewAsset.years.length
                    ? previewAsset.years.join(', ')
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt>Options</dt>
                <dd className="research-asset-preview-option-groups">
                  {previewOptionGroups.length ? (
                    previewOptionGroups.map((group) => (
                      <section
                        className={`research-asset-preview-option-group research-asset-preview-option-group-${group.productTypeId.toLowerCase()}`}
                        key={group.productTypeId}
                      >
                        <header>
                          <span aria-hidden="true">
                            {group.productLabel
                              .split(' ')
                              .map((word) => word[0])
                              .join('')}
                          </span>
                          <strong>{group.productLabel}</strong>
                          <small>
                            {group.options.length}{' '}
                            {group.options.length === 1 ? 'option' : 'options'}
                          </small>
                        </header>
                        <div>
                          {group.options.map(([key, value]) => (
                            <span
                              key={`${group.productTypeId}-${key}-${value}`}
                            >
                              <small>{key}</small>
                              <strong>{value}</strong>
                            </span>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <span className="research-asset-preview-empty">
                      No option values
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Vehicle zones</dt>
                <dd>
                  {previewAsset.vehicleZoneIds.length
                    ? previewAsset.vehicleZoneIds
                        .map(
                          (zoneId) =>
                            vehicleZones.find((zone) => zone.id === zoneId)
                              ?.name ?? zoneId,
                        )
                        .join(' · ')
                    : 'Not set'}
                </dd>
              </div>
              {previewAsset.notes && (
                <div>
                  <dt>Notes</dt>
                  <dd>{previewAsset.notes}</dd>
                </div>
              )}
            </dl>
          ) : null
        }
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setPreviewAsset(null);
            }}
          >
            Close
          </Button>
        }
      />
    </section>
  );
}
