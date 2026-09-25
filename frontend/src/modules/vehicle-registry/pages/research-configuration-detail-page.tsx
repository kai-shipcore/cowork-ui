import { useMemo, useState } from 'react';
import {
  Activity,
  type ActivityEntry,
  type NewActivityComment,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { ArrowLeft, ExternalLink, GitPullRequest, Images } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfigChips } from '@/shared/domain/config-chips';
import {
  RESEARCH_DISPOSITION_LABELS,
  RESEARCH_DISPOSITION_TONES,
  researchDisposition,
} from '@/shared/domain/research-approval';
import { StatusBadge } from '@/shared/components/status-badge';
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
import type { ResearchAssetTarget } from '../research-asset-uploader';
import { ResearchConfigurationDialog } from '../research-configuration-dialog';
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
import { vehicleResearchIdentity } from '../vehicle-research-grid-model';
import '../research-handoff-card.css';
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

function firstItem<T>(items: readonly T[]): T | undefined {
  return items[0];
}

export function ResearchConfigurationDetailPage() {
  const navigate = useNavigate();
  const { configurationId = '', researchConfigurationId = '' } = useParams();
  const { actor } = useOperations();
  const {
    configurations,
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
  const target: ResearchAssetTarget | null =
    sourceConfiguration && productType
      ? {
          id: researchConfigurationId,
          configurationId,
          productTypeId: productType.id,
          productLabel: productType.product,
          options:
            approvedVersion?.options ??
            sourceConfiguration.options.filter(([key]) =>
              allowedOptionNames.has(key),
            ),
        }
      : null;
  const availableYears = approvedVersion?.years.length
    ? approvedVersion.years
    : sourceConfiguration
      ? configurationYears(sourceConfiguration)
      : [];
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
          Back to Vehicle Research
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

      <header className="research-detail-header">
        <div className="research-detail-title-row">
          <div>
            <h1>{target.productLabel} configuration</h1>
            <span className="research-group-summary">
              {vehicleIdentity.makeModel} · {vehicleIdentity.years}
            </span>
          </div>
        </div>
      </header>

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

          <section className="research-configuration-assets-card">
            <header>
              <div>
                <span aria-hidden="true">
                  <Images />
                </span>
                <div>
                  <h2>Research assets</h2>
                  <p>
                    Evidence matching this configuration, ranked by relevance.
                  </p>
                </div>
              </div>
              <strong>{relatedAssets.length} matched</strong>
            </header>
            {relatedAssets.length ? (
              <div className="research-configuration-asset-grid">
                {relatedAssets.map(({ material, relevance }) => (
                  <button
                    type="button"
                    className="research-configuration-asset-card"
                    key={material.id}
                    onClick={() => {
                      setPreviewAsset(material);
                    }}
                  >
                    <span className="research-configuration-asset-preview">
                      {material.fileData ? (
                        <img
                          src={material.fileData}
                          alt={material.fileName || material.title}
                        />
                      ) : (
                        <Images />
                      )}
                    </span>
                    <span className="research-configuration-asset-content">
                      <strong>{material.fileName || material.title}</strong>
                      <span
                        className={`research-asset-relevance research-asset-relevance--${relevance.label
                          .split(' ')[0]
                          .toLowerCase()}`}
                      >
                        <span>
                          <strong>{relevance.label}</strong>
                          <b>{relevance.score}%</b>
                        </span>
                        <small>
                          Year {relevance.yearMatch ? 'match' : 'different'} ·{' '}
                          Options {relevance.optionMatches}/
                          {relevance.optionTotal} · Zone{' '}
                          {relevance.zoneMatch ? 'match' : 'different'}
                        </small>
                      </span>
                      <span className="research-configuration-asset-meta">
                        {material.years.length
                          ? material.years.join(', ')
                          : 'Year not set'}
                        {' · '}
                        {material.vehicleZoneIds.length}{' '}
                        {material.vehicleZoneIds.length === 1
                          ? 'zone'
                          : 'zones'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="research-configuration-assets-empty">
                <Images />
                <strong>No matching assets</strong>
                <span>
                  Assets classified for {target.productLabel} will appear here.
                </span>
              </div>
            )}
          </section>

          <section className="research-configuration-handoff-card">
            <header>
              <div className="research-configuration-handoff-title">
                <span aria-hidden="true">
                  <GitPullRequest />
                </span>
                <div>
                  <h2>Project handoff approval</h2>
                  <p>
                    Decide whether this completed research configuration should
                    become a project.
                  </p>
                </div>
              </div>
              <div className="research-handoff-summary-statuses">
                <StatusBadge
                  label={researchComplete ? 'Completed' : 'In progress'}
                  tone={researchComplete ? 'success' : 'progress'}
                />
                <StatusBadge
                  label={RESEARCH_DISPOSITION_LABELS[handoffDisposition]}
                  tone={RESEARCH_DISPOSITION_TONES[handoffDisposition]}
                />
              </div>
            </header>
            <div className="research-configuration-handoff-summary">
              <div>
                <small>PROJECT CANDIDATE</small>
                <strong>{target.productLabel}</strong>
                <span>
                  {vehicleIdentity.makeModel} ·{' '}
                  {availableYears.length
                    ? `${String(availableYears[0])}–${String(availableYears[availableYears.length - 1])}`
                    : vehicleIdentity.years}
                </span>
              </div>
              <ConfigChips options={target.options} />
            </div>
            <ResearchApprovalPanel
              configuration={handoffConfiguration}
              sourceConfigurationId={configurationId}
              productLabel={target.productLabel}
            />
          </section>
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

      <Dialog
        open={Boolean(previewAsset)}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
      >
        <DialogContent className="research-configuration-asset-dialog">
          <DialogHeader>
            <DialogTitle>
              {previewAsset?.fileName ?? previewAsset?.title ?? 'Asset preview'}
            </DialogTitle>
            <p>Research evidence linked to this configuration.</p>
          </DialogHeader>
          {previewAsset && (
            <DialogBody className="research-configuration-asset-dialog-body">
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
                              {group.options.length === 1
                                ? 'option'
                                : 'options'}
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
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewAsset(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
