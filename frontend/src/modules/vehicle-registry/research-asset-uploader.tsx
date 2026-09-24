import { useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  AssetUploadDialog,
  type AssetUploadItem,
  type AssetUploadMetadataContext,
} from '@coverland-engineering/ui/asset-upload-dialog';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Check, Images } from 'lucide-react';
import {
  PRODUCT_TYPES,
  type ProductTypeId,
  type VehicleConfiguration,
  type VehicleZone,
} from '@/shared/types/workbench';
import type { ResearchMaterial } from './vehicle-research-detail-model';
import './research-asset-library.css';

interface ResearchAssetUploaderProps {
  configuration: VehicleConfiguration;
  vehicleLabel?: string;
  targets: readonly ResearchAssetTarget[];
  vehicleZones: readonly VehicleZone[];
  onSaveMaterials: (
    materials: readonly ResearchMaterial[],
  ) => boolean | Promise<boolean>;
}

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Unable to read image'));
    };
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

function toggleValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

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
  const [yearFrom, setYearFrom] = useState(() =>
    value.years.length ? String(Math.min(...value.years)) : '',
  );
  const [yearTo, setYearTo] = useState(() =>
    value.years.length ? String(Math.max(...value.years)) : '',
  );
  const availableProductTypes = PRODUCT_TYPES.filter((productType) =>
    targets.some((target) => target.productTypeId === productType.id),
  );
  const availableOptions = researchAssetOptionValues(targets).filter((option) =>
    value.productTypeIds.includes(option.productTypeId),
  );
  const availableZones = vehicleZones.filter((zone) =>
    value.productTypeIds.includes(zone.productTypeId),
  );

  function updateYearRange(from: string, to: string) {
    const start = Number(from);
    const end = Number(to);
    const years =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 1900 &&
      end <= 2100 &&
      start <= end
        ? Array.from({ length: end - start + 1 }, (_, index) => start + index)
        : [];
    onChange({ ...value, years });
  }

  function toggleProduct(productTypeId: ProductTypeId) {
    const productTypeIds = toggleValue(value.productTypeIds, productTypeId);
    onChange({
      years: value.years,
      productTypeIds,
      optionValues: value.optionValues.filter((option) =>
        productTypeIds.includes(option.productTypeId),
      ),
      vehicleZoneIds: value.vehicleZoneIds.filter((zoneId) => {
        const zone = vehicleZones.find((item) => item.id === zoneId);
        return Boolean(zone && productTypeIds.includes(zone.productTypeId));
      }),
    });
  }

  function toggleOption(option: ResearchAssetOptionValue) {
    onChange({
      ...value,
      optionValues: value.optionValues.some((item) => item.id === option.id)
        ? value.optionValues.filter((item) => item.id !== option.id)
        : [...value.optionValues, option],
    });
  }

  return (
    <div className="research-asset-wizard-fields">
      <fieldset>
        <legend>
          1. Year <span>(enter range)</span>
        </legend>
        <div className="research-wizard-year-inputs">
          <label>
            From
            <Input
              type="number"
              min={1900}
              max={2100}
              placeholder="e.g. 2023"
              value={yearFrom}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const nextFrom = event.target.value;
                setYearFrom(nextFrom);
                updateYearRange(nextFrom, yearTo);
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
                const nextTo = event.target.value;
                setYearTo(nextTo);
                updateYearRange(yearFrom, nextTo);
              }}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          2. Product type <span>(select multiple)</span>
        </legend>
        <div className="research-wizard-tags">
          {availableProductTypes.map((productType) => {
            const selected = value.productTypeIds.includes(productType.id);
            return (
              <button
                type="button"
                key={productType.id}
                aria-pressed={selected}
                onClick={() => {
                  toggleProduct(productType.id);
                }}
              >
                {selected && <Check aria-hidden="true" />}
                {productType.product}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={!value.productTypeIds.length}>
        <legend>
          3. Option values <span>(select multiple)</span>
        </legend>
        {value.productTypeIds.map((productTypeId) => {
          const product = PRODUCT_TYPES.find(
            (item) => item.id === productTypeId,
          );
          const productOptions = availableOptions.filter(
            (option) => option.productTypeId === productTypeId,
          );
          if (!productOptions.length) return null;
          return (
            <section
              className="research-wizard-choice-group"
              key={productTypeId}
            >
              <strong>{product?.product}</strong>
              <div className="research-wizard-tags">
                {productOptions.map((option) => {
                  const selected = value.optionValues.some(
                    (item) => item.id === option.id,
                  );
                  return (
                    <button
                      type="button"
                      key={option.id}
                      aria-pressed={selected}
                      onClick={() => {
                        toggleOption(option);
                      }}
                    >
                      {selected && <Check aria-hidden="true" />}
                      {option.key} · {option.value}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {value.productTypeIds.length > 0 && availableOptions.length === 0 && (
          <small>
            No option values are configured for the selected products.
          </small>
        )}
      </fieldset>

      <fieldset disabled={!value.productTypeIds.length}>
        <legend>
          4. Vehicle zones <span>(select multiple)</span>
        </legend>
        <div className="research-wizard-tags">
          {availableZones.map((zone) => {
            const selected = value.vehicleZoneIds.includes(zone.id);
            return (
              <button
                type="button"
                key={zone.id}
                aria-pressed={selected}
                onClick={() => {
                  onChange({
                    ...value,
                    vehicleZoneIds: toggleValue(value.vehicleZoneIds, zone.id),
                  });
                }}
              >
                {selected && <Check aria-hidden="true" />}
                {zone.name}
              </button>
            );
          })}
        </div>
        {value.productTypeIds.length > 0 && availableZones.length === 0 && (
          <small>
            No vehicle zones are configured for the selected products.
          </small>
        )}
      </fieldset>
    </div>
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
      onChange={(metadata) => {
        context.updateMetadata(metadata);
      }}
      targets={targets}
      vehicleZones={vehicleZones}
    />
  );
}

/** Research-specific metadata step for the shared AssetUploadDialog. */
export function ResearchAssetUploader({
  configuration,
  vehicleLabel,
  targets,
  vehicleZones,
  onSaveMaterials,
}: ResearchAssetUploaderProps): ReactElement {
  const [open, setOpen] = useState(false);
  const displayVehicle = vehicleLabel ?? configuration.vehicle;
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
      description={`${displayVehicle} · Classify each image before moving to the next.`}
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
        const selectedProductsWithOptions = new Set(
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
          Array.from(selectedProductsWithOptions).every((productTypeId) =>
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
