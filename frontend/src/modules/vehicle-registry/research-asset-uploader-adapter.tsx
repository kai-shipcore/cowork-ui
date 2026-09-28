import { useMemo, useState, type ReactElement } from 'react';
import {
  AssetUploadDialog,
  type AssetUploadItem,
  type AssetUploadMetadataContext,
} from '@coverland-engineering/ui/asset-upload-dialog';
import { Button } from '@coverland-engineering/ui/button';
import {
  ResearchAssetClassificationFields as StorybookClassificationFields,
  type ResearchAssetClassification,
} from '@coverland-engineering/ui/vehicle-research/research-asset-classification-fields';
import { Images } from 'lucide-react';
import {
  PRODUCT_TYPES,
  type ProductTypeId,
  type VehicleConfiguration,
  type VehicleZone,
} from '@/shared/types/workbench';
import type { ResearchMaterial } from './vehicle-research-detail-model';

export interface ResearchAssetTarget {
  id: string;
  configurationId: string;
  productTypeId: ProductTypeId;
  productLabel: string;
  options: readonly (readonly [string, string])[];
}
export interface ResearchAssetOptionValue {
  id: string;
  productTypeId: ProductTypeId;
  key: string;
  value: string;
}
export interface ResearchAssetMetadata {
  years: readonly number[];
  productTypeIds: readonly ProductTypeId[];
  optionValues: readonly ResearchAssetOptionValue[];
  vehicleZoneIds: readonly string[];
}

const TARGET_DATA_URL_LENGTH = 260_000;

export function researchAssetOptionValues(
  targets: readonly ResearchAssetTarget[],
): readonly ResearchAssetOptionValue[] {
  return Array.from(
    new Map(
      targets.flatMap((target) =>
        target.options.map(([key, value]) => {
          const id = `${target.productTypeId}:${key}:${value}`;
          return [
            id,
            { id, productTypeId: target.productTypeId, key, value },
          ] as const;
        }),
      ),
    ).values(),
  );
}

/** Domain adapter for the Storybook-owned asset classification fields. */
export function ResearchAssetClassificationFields({
  value,
  onChange,
  targets,
  vehicleZones,
}: {
  value: ResearchAssetMetadata;
  onChange: (value: ResearchAssetMetadata) => void;
  targets: readonly ResearchAssetTarget[];
  vehicleZones: readonly VehicleZone[];
}): ReactElement {
  return (
    <StorybookClassificationFields
      value={value}
      products={PRODUCT_TYPES.filter((product) =>
        targets.some((target) => target.productTypeId === product.id),
      ).map((product) => ({ id: product.id, label: product.product }))}
      options={researchAssetOptionValues(targets)}
      zones={vehicleZones.map((zone) => ({
        id: zone.id,
        productTypeId: zone.productTypeId,
        label: zone.name,
      }))}
      onChange={(next: ResearchAssetClassification) => {
        onChange({
          years: next.years,
          productTypeIds: next.productTypeIds as readonly ProductTypeId[],
          optionValues:
            next.optionValues as readonly ResearchAssetOptionValue[],
          vehicleZoneIds: next.vehicleZoneIds,
        });
      }}
    />
  );
}

function ResearchAssetFields({
  context,
  targets,
  vehicleZones,
}: {
  context: AssetUploadMetadataContext<ResearchAssetMetadata>;
  targets: readonly ResearchAssetTarget[];
  vehicleZones: readonly VehicleZone[];
}) {
  return (
    <ResearchAssetClassificationFields
      key={context.item.id}
      value={context.item.metadata}
      onChange={context.updateMetadata}
      targets={targets}
      vehicleZones={vehicleZones}
    />
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read image'));
    image.src = url;
  });
}

async function prepareImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > TARGET_DATA_URL_LENGTH && quality > 0.42) {
      quality -= 0.08;
      result = canvas.toDataURL('image/jpeg', quality);
    }
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Research upload controller using shared Storybook upload and metadata UI. */
export function ResearchAssetUploader({
  configuration,
  vehicleLabel,
  targets,
  vehicleZones,
  onSaveMaterials,
}: {
  configuration: VehicleConfiguration;
  vehicleLabel?: string;
  targets: readonly ResearchAssetTarget[];
  vehicleZones: readonly VehicleZone[];
  onSaveMaterials: (
    materials: readonly ResearchMaterial[],
  ) => boolean | Promise<boolean>;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const optionValues = useMemo(
    () => researchAssetOptionValues(targets),
    [targets],
  );

  async function saveItems(
    items: readonly AssetUploadItem<ResearchAssetMetadata>[],
  ) {
    const materials = await Promise.all(
      items.map(
        async (item) =>
          ({
            id: item.id,
            title: item.file.name,
            sourceUrl: '',
            notes: '',
            tags: [],
            productTypeId: item.metadata.productTypeIds[0] ?? 'PT-SC',
            productTypeIds: [...item.metadata.productTypeIds],
            years: [...item.metadata.years],
            optionSelections: item.metadata.optionValues.map(
              ({ key, value }) => [key, value] as [string, string],
            ),
            selectedOptionValues: [...item.metadata.optionValues],
            vehicleZoneIds: [...item.metadata.vehicleZoneIds],
            researchRowId: '',
            targetConfigurationId: configuration.id,
            fileData: await prepareImage(item.file),
            fileName: item.file.name,
            fileType: 'image/jpeg',
          }) satisfies ResearchMaterial,
      ),
    );
    return onSaveMaterials(materials);
  }

  return (
    <AssetUploadDialog<ResearchAssetMetadata>
      open={open}
      onOpenChange={setOpen}
      title="Add research assets"
      description={`${vehicleLabel ?? configuration.vehicle} · Classify each image before moving to the next.`}
      trigger={
        <Button variant="outline">
          <Images aria-hidden="true" /> Add assets
        </Button>
      }
      createMetadata={() => ({
        years: [],
        productTypeIds: [],
        optionValues: [],
        vehicleZoneIds: [],
      })}
      validateMetadata={(item) => {
        const productsWithOptions = new Set(
          optionValues
            .filter((option) =>
              item.metadata.productTypeIds.includes(option.productTypeId),
            )
            .map((option) => option.productTypeId),
        );
        const completedProducts = new Set(
          item.metadata.optionValues.map((option) => option.productTypeId),
        );
        return (
          item.metadata.years.length > 0 &&
          item.metadata.productTypeIds.length > 0 &&
          item.metadata.vehicleZoneIds.length > 0 &&
          Array.from(productsWithOptions).every((productTypeId) =>
            completedProducts.has(productTypeId),
          )
        );
      }}
      renderMetadataStep={(context) => (
        <ResearchAssetFields
          context={context}
          targets={targets}
          vehicleZones={vehicleZones}
        />
      )}
      onSave={saveItems}
      incompleteMessage="Enter a valid year range and select at least one product type, its option values, and vehicle zone."
    />
  );
}
