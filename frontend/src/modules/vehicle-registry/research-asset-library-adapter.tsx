import { useMemo, type ReactElement } from 'react';
import {
  ResearchAssetLibrary,
  type ResearchAssetLibraryItem,
} from '@coverland-engineering/ui/vehicle-research/research-asset-library';
import {
  PRODUCT_TYPES,
  type ProductTypeId,
  type VehicleConfiguration,
} from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import {
  RESEARCH_DETAIL_KEY,
  RESEARCH_DETAIL_SEED,
  researchDetailListSchema,
  type ResearchDetailRecord,
} from './vehicle-research-detail-model';
import { yearsFromLabel } from './vehicle-research-grid-model';

interface ResearchAssetLibraryAdapterProps {
  configurations: readonly VehicleConfiguration[];
  onOpenEvidence: (configurationId: string) => void;
}

function vehicleIdentity(vehicle: string) {
  const match =
    /^((?:\d{4}(?:[–-]\d{4})?)(?:,\s*\d{4}(?:[–-]\d{4})?)*)\s+(\S+)\s+(.+)$/.exec(
      vehicle,
    );
  return {
    years: match?.[1] ?? '',
    make: match?.[2] ?? 'Other',
    model: match?.[3] ?? vehicle,
  };
}

function assetFormat(photo: string, filename: string) {
  const mime = /^data:image\/(png|jpeg|webp);/i.exec(photo)?.[1];
  if (mime) return mime.toUpperCase().replace('JPEG', 'JPG');
  const extension = filename.split('.').pop();
  return extension ? extension.toUpperCase() : 'IMAGE';
}

function latestEvidence(records: readonly ResearchDetailRecord[]) {
  const latest = new Map<string, ResearchDetailRecord>();
  for (const record of records) {
    const saved = latest.get(record.configurationId);
    if (!saved || Date.parse(record.at) >= Date.parse(saved.at)) {
      latest.set(record.configurationId, record);
    }
  }
  return Array.from(latest.values());
}

const PRODUCT_LABELS = Object.fromEntries(
  PRODUCT_TYPES.map((item) => [item.id, item.product]),
) as Record<ProductTypeId, string>;

/** Maps saved research evidence into the Storybook-owned asset library. */
export function ResearchAssetLibraryAdapter({
  configurations,
  onOpenEvidence,
}: ResearchAssetLibraryAdapterProps): ReactElement {
  const { records } = useRdRecords(
    RESEARCH_DETAIL_KEY,
    researchDetailListSchema,
    RESEARCH_DETAIL_SEED,
  );
  const assets = useMemo<readonly ResearchAssetLibraryItem[]>(
    () =>
      latestEvidence(records).flatMap((evidence) =>
        evidence.materials.flatMap((material) => {
          if (!material.fileData && !material.sourceUrl) return [];
          const configuration = configurations.find(
            (item) =>
              item.id ===
              (material.targetConfigurationId ?? evidence.configurationId),
          );
          if (!configuration) return [];
          const identity = vehicleIdentity(configuration.vehicle);
          const productTypeIds = material.productTypeIds.length
            ? material.productTypeIds
            : [material.productTypeId];
          return [
            {
              id: `${evidence.id}-${material.id}`,
              configurationId: configuration.id,
              filename: material.fileName || material.title,
              previewUrl: material.fileData || undefined,
              sourceUrl: material.sourceUrl || undefined,
              vehicle: configuration.vehicle,
              make: identity.make,
              model: identity.model,
              yearsLabel: identity.years,
              years: material.years.length
                ? material.years
                : yearsFromLabel(identity.years),
              format: material.fileData
                ? assetFormat(
                    material.fileData,
                    material.fileName || material.title,
                  )
                : 'LINK',
              productTypeIds,
              productTypeLabel: PRODUCT_LABELS[material.productTypeId],
              contextLabel: material.fileData
                ? 'Uploaded asset'
                : 'Source link',
              description: material.notes || material.title,
              options: material.optionSelections.length
                ? material.optionSelections
                : configuration.options,
            },
          ];
        }),
      ),
    [configurations, records],
  );

  return (
    <ResearchAssetLibrary
      assets={assets}
      products={PRODUCT_TYPES.map((product) => ({
        id: product.id,
        label: product.product,
      }))}
      onOpenResearch={(asset) => {
        if (asset.configurationId) onOpenEvidence(asset.configurationId);
      }}
    />
  );
}
