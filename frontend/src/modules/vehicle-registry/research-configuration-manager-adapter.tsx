import {
  ResearchConfigurationManager,
  type ResearchConfigurationVersion as StorybookConfigurationVersion,
  type ResearchConfigurationVersionStatus as StorybookVersionStatus,
} from '@coverland-engineering/ui/vehicle-research/research-configuration-manager';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import type { ResearchAssetTarget } from './research-asset-uploader-adapter';
import type {
  ResearchConfigurationVersion,
  ResearchConfigurationVersionStatus,
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
  presentation?: 'dialog' | 'page';
}

/** Supplies application catalogs and persistence to the Storybook manager. */
export function ResearchConfigurationDialog({
  target,
  versions,
  onCreateVersion,
  onUpdateVersionStatus,
  ...props
}: ResearchConfigurationDialogProps) {
  const { vehicleOptionKeys, vehicleOptionValues } = useWorkbenchStore();
  const optionKeys = vehicleOptionKeys.filter(
    (optionKey) => optionKey.productTypeId === target?.productTypeId,
  );
  const optionKeyIds = new Set(optionKeys.map((optionKey) => optionKey.id));

  return (
    <ResearchConfigurationManager
      {...props}
      target={
        target
          ? {
              id: target.id,
              productLabel: target.productLabel,
              options: target.options,
            }
          : null
      }
      versions={versions}
      optionKeys={optionKeys.map(({ id, name }) => ({ id, name }))}
      optionValues={vehicleOptionValues
        .filter((value) => optionKeyIds.has(value.vehicleOptionKeyId))
        .map(({ id, vehicleOptionKeyId, value }) => ({
          id,
          optionKeyId: vehicleOptionKeyId,
          value,
        }))}
      onCreateVersion={(version: StorybookConfigurationVersion) =>
        onCreateVersion(version as ResearchConfigurationVersion)
      }
      onUpdateVersionStatus={(
        versionId: string,
        status: StorybookVersionStatus,
      ) =>
        onUpdateVersionStatus(
          versionId,
          status as ResearchConfigurationVersionStatus,
        )
      }
    />
  );
}
