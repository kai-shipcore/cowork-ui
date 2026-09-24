import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { History, Plus, Save, Trash2, X } from 'lucide-react';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import type { ResearchAssetTarget } from './research-asset-uploader';
import {
  nextResearchConfigurationVersionNumber,
  type ResearchConfigurationVersion,
  type ResearchConfigurationVersionStatus,
} from './research-configuration-version-model';

interface ResearchConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ResearchAssetTarget | null;
  availableYears: readonly number[];
  researchStatus: VehicleConfiguration['researchStatus'];
  versions: readonly ResearchConfigurationVersion[];
  actor: string;
  saving: boolean;
  onCreateVersion: (version: ResearchConfigurationVersion) => Promise<boolean>;
  onUpdateVersionStatus: (
    versionId: string,
    status: ResearchConfigurationVersionStatus,
  ) => Promise<boolean>;
  onOpenVehicleResearch?: () => void;
}

function isConfigurationCompleted(
  status: VehicleConfiguration['researchStatus'],
) {
  return status === 'COMPLETED' || status === 'COMPLETE';
}

function versionStatusLabel(status: ResearchConfigurationVersionStatus) {
  return status.split('_').join(' ');
}

/** Configuration editor and immutable version history for a research row. */
export function ResearchConfigurationDialog({
  open,
  onOpenChange,
  target,
  availableYears,
  researchStatus,
  versions,
  actor,
  saving,
  onCreateVersion,
  onUpdateVersionStatus,
  onOpenVehicleResearch,
}: ResearchConfigurationDialogProps) {
  const { vehicleOptionKeys, vehicleOptionValues } = useWorkbenchStore();
  const [editing, setEditing] = useState(false);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [options, setOptions] = useState<
    readonly (readonly [string, string])[]
  >([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const targetId = target?.id ?? '';
  const targetVersions = useMemo(
    () =>
      versions
        .filter((version) => version.researchConfigurationId === targetId)
        .sort((left, right) => right.versionNumber - left.versionNumber),
    [targetId, versions],
  );
  const latestVersion = targetVersions[0];
  const selectedVersion = targetVersions.find(
    (version) => version.id === selectedVersionId,
  );
  const currentApprovedVersion = targetVersions.find(
    (version) => version.status === 'APPROVED' && version.action === 'UPSERT',
  );
  const pendingVersion = targetVersions.find(
    (version) =>
      version.status === 'DRAFT' || version.status === 'PENDING_APPROVAL',
  );
  const approvalRequired = isConfigurationCompleted(researchStatus);
  const productOptionKeys = vehicleOptionKeys.filter(
    (optionKey) => optionKey.productTypeId === target?.productTypeId,
  );

  function setYearRange(nextYears: readonly number[]) {
    if (nextYears.length === 0) {
      setYearFrom('');
      setYearTo('');
      return;
    }
    setYearFrom(String(Math.min(...nextYears)));
    setYearTo(String(Math.max(...nextYears)));
  }

  function yearsInRange(): number[] {
    const start = Number(yearFrom);
    const end = Number(yearTo);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      return [];
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  useEffect(() => {
    if (!open || !target) return;
    setYearRange(
      currentApprovedVersion?.years.length
        ? currentApprovedVersion.years
        : availableYears,
    );
    setOptions(currentApprovedVersion?.options ?? target.options);
    setEditing(false);
    setSelectedVersionId(null);
  }, [availableYears, currentApprovedVersion, open, target]);

  if (!target) return null;
  const targetOptions = target.options;

  function updateOption(index: number, part: 0 | 1, value: string) {
    setOptions((current) =>
      current.map((option, optionIndex) => {
        if (optionIndex !== index) return option;
        if (part === 1) return [option[0], value] as const;
        const optionKey = productOptionKeys.find((item) => item.name === value);
        const firstValue = vehicleOptionValues.find(
          (item) => item.vehicleOptionKeyId === optionKey?.id,
        );
        return [value, firstValue?.value ?? ''] as const;
      }),
    );
  }

  function showCurrentConfiguration() {
    setYearRange(
      currentApprovedVersion?.years.length
        ? currentApprovedVersion.years
        : availableYears,
    );
    setOptions(currentApprovedVersion?.options ?? targetOptions);
    setEditing(false);
    setSelectedVersionId(null);
  }

  function showVersion(version: ResearchConfigurationVersion) {
    setYearRange(version.years);
    setOptions(version.options);
    setEditing(false);
    setSelectedVersionId(version.id);
  }

  async function createVersion(action: 'UPSERT' | 'DELETE') {
    const status: ResearchConfigurationVersionStatus = approvalRequired
      ? 'DRAFT'
      : 'APPROVED';
    const version: ResearchConfigurationVersion = {
      id: crypto.randomUUID(),
      researchConfigurationId: targetId,
      versionNumber: nextResearchConfigurationVersionNumber(versions, targetId),
      status,
      action,
      years: yearsInRange(),
      options: options.map(([key, value]) => [key, value] as const),
      changeSummary:
        action === 'DELETE'
          ? 'Configuration deletion requested.'
          : 'Configuration updated.',
      actor,
      createdAt: new Date().toISOString(),
    };
    const ok = await onCreateVersion(version);
    if (ok) {
      setEditing(false);
      setSelectedVersionId(version.id);
    }
  }

  const parsedYearFrom = Number(yearFrom);
  const parsedYearTo = Number(yearTo);
  const valid =
    Number.isInteger(parsedYearFrom) &&
    Number.isInteger(parsedYearTo) &&
    parsedYearFrom >= 1900 &&
    parsedYearTo <= 2100 &&
    parsedYearFrom <= parsedYearTo &&
    options.every(([key, value]) => key.trim() && value.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="research-configuration-dialog">
        <DialogHeader>
          <DialogTitle>{target.productLabel} configuration</DialogTitle>
          <p>
            Manage the current configuration and review its complete version
            history.
          </p>
        </DialogHeader>
        <DialogBody className="research-configuration-dialog-body">
          <section className="research-configuration-current">
            <header>
              <div>
                <span>
                  {selectedVersion
                    ? `CONFIGURATION VERSION ${String(selectedVersion.versionNumber)}`
                    : 'RESEARCH CONFIGURATION'}
                </span>
                <h3>
                  {target.productLabel}
                  {selectedVersion
                    ? ` · Version ${String(selectedVersion.versionNumber)}`
                    : ''}
                </h3>
              </div>
              <span className="research-configuration-status">
                {selectedVersion
                  ? versionStatusLabel(selectedVersion.status)
                  : researchStatus.split('_').join(' ')}
              </span>
            </header>

            {selectedVersion ? (
              <p className="research-version-snapshot-notice">
                Viewing the exact Year and Option values saved in Version{' '}
                {selectedVersion.versionNumber}.
                {selectedVersion.action === 'DELETE' &&
                  ' This version requests deletion of the configuration shown below.'}
              </p>
            ) : approvalRequired ? (
              <p className="research-version-notice">
                This configuration completed its initial approval. Further
                changes create a version that must be approved before becoming
                current.
              </p>
            ) : (
              <p className="research-version-snapshot-notice">
                Until this configuration is completed, saved versions become
                current immediately and do not require approval.
              </p>
            )}

            <fieldset disabled={!editing}>
              <legend>Year</legend>
              <div className="research-configuration-year-inputs">
                <label>
                  From
                  <Input
                    type="number"
                    min={1900}
                    max={2100}
                    placeholder="e.g. 2023"
                    value={yearFrom}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setYearFrom(event.target.value);
                    }}
                  />
                </label>
                <label>
                  To
                  <Input
                    type="number"
                    min={1900}
                    max={2100}
                    placeholder="e.g. 2026"
                    value={yearTo}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setYearTo(event.target.value);
                    }}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset disabled={!editing}>
              <legend>Option values</legend>
              <div className="research-configuration-option-editor">
                {options.map(([key, value], index) => (
                  <div key={`${String(index)}-${key}-${value}`}>
                    <Select
                      value={key}
                      onValueChange={(nextKey: string) => {
                        updateOption(index, 0, nextKey);
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Option ${String(index + 1)} name`}
                      >
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        {productOptionKeys
                          .filter(
                            (optionKey) =>
                              optionKey.name === key ||
                              !options.some(
                                ([selectedKey]) =>
                                  selectedKey === optionKey.name,
                              ),
                          )
                          .map((optionKey) => (
                            <SelectItem
                              value={optionKey.name}
                              key={optionKey.id}
                            >
                              {optionKey.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={value}
                      onValueChange={(nextValue: string) => {
                        updateOption(index, 1, nextValue);
                      }}
                      disabled={!key}
                    >
                      <SelectTrigger
                        aria-label={`Option ${String(index + 1)} value`}
                      >
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleOptionValues
                          .filter(
                            (optionValue) =>
                              optionValue.vehicleOptionKeyId ===
                              productOptionKeys.find(
                                (optionKey) => optionKey.name === key,
                              )?.id,
                          )
                          .map((optionValue) => (
                            <SelectItem
                              value={optionValue.value}
                              key={optionValue.id}
                            >
                              {optionValue.value}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {editing && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove option ${String(index + 1)}`}
                        onClick={() => {
                          setOptions((current) =>
                            current.filter(
                              (_, optionIndex) => optionIndex !== index,
                            ),
                          );
                        }}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length === 0 && (
                  <span className="research-base-vehicle">Base vehicle</span>
                )}
              </div>
              {editing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOptions((current) => [...current, ['', '']]);
                  }}
                  disabled={options.length >= productOptionKeys.length}
                >
                  <Plus /> Add option
                </Button>
              )}
            </fieldset>

            <div className="research-configuration-actions">
              {selectedVersion ? (
                <Button variant="outline" onClick={showCurrentConfiguration}>
                  Back to current configuration
                </Button>
              ) : editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!valid || saving}
                    onClick={() => void createVersion('DELETE')}
                  >
                    <Trash2 /> Create deletion version
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!valid || saving}
                    onClick={() => void createVersion('UPSERT')}
                  >
                    <Save /> Save new version
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  disabled={Boolean(pendingVersion)}
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  <Plus /> Create new version
                </Button>
              )}
            </div>
          </section>

          <section className="research-configuration-history">
            <header>
              <History aria-hidden="true" />
              <div>
                <h3>Configuration history</h3>
                <p>{targetVersions.length} saved versions</p>
              </div>
            </header>
            {targetVersions.length > 0 ? (
              <div className="research-version-list">
                {targetVersions.map((version) => (
                  <article
                    key={version.id}
                    data-selected={selectedVersionId === version.id}
                  >
                    <button
                      type="button"
                      className="research-version-card-select"
                      aria-pressed={selectedVersionId === version.id}
                      onClick={() => {
                        showVersion(version);
                      }}
                    >
                      <span className="research-version-card-heading">
                        <strong>Version {version.versionNumber}</strong>
                        <span
                          className={`research-version-status research-version-status-${version.status.toLowerCase()}`}
                        >
                          {versionStatusLabel(version.status)}
                        </span>
                      </span>
                      <span className="research-version-card-summary">
                        {version.action === 'DELETE'
                          ? 'Delete configuration'
                          : `${version.years.join(', ')} · ${String(version.options.length)} options`}
                      </span>
                      {version.action === 'DELETE' && (
                        <span className="research-version-delete-snapshot">
                          Snapshot: {version.years.join(', ')} ·{' '}
                          {version.options.length
                            ? `${String(version.options.length)} options`
                            : 'Base vehicle'}
                        </span>
                      )}
                      <span className="research-version-option-preview">
                        {version.options.length > 0
                          ? version.options
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' · ')
                          : 'Base vehicle'}
                      </span>
                      <small>{version.changeSummary}</small>
                    </button>
                    <footer>
                      <span>
                        {version.actor} ·{' '}
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                      {version.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void onUpdateVersionStatus(
                              version.id,
                              'PENDING_APPROVAL',
                            )
                          }
                        >
                          Submit for approval
                        </Button>
                      )}
                      {version.status === 'PENDING_APPROVAL' && (
                        <span className="research-version-review-actions">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void onUpdateVersionStatus(version.id, 'REJECTED')
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              void onUpdateVersionStatus(version.id, 'APPROVED')
                            }
                          >
                            Approve
                          </Button>
                        </span>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="research-version-empty">
                <History aria-hidden="true" />
                <p>No saved versions yet.</p>
                <span>The current values are the initial configuration.</span>
              </div>
            )}
            {targetVersions.length > 0 &&
              latestVersion.status === 'APPROVED' && (
                <p className="research-version-current-note">
                  Version {latestVersion.versionNumber}{' '}
                  {latestVersion.action === 'DELETE'
                    ? 'is the approved deletion version.'
                    : 'is the current approved version.'}
                </p>
              )}
          </section>
        </DialogBody>
        <DialogFooter>
          {onOpenVehicleResearch && (
            <Button variant="ghost" onClick={onOpenVehicleResearch}>
              Open full vehicle research
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
