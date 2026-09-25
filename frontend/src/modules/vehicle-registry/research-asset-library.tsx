import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Check,
  Download,
  ExternalLink,
  FileImage,
  Filter,
  Link2,
  Search,
} from 'lucide-react';
import { ConfigChips } from '@/shared/domain/config-chips';
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

interface ResearchAssetLibraryProps {
  configurations: readonly VehicleConfiguration[];
  onOpenEvidence: (configurationId: string) => void;
}

interface ResearchAsset {
  id: string;
  configuration: VehicleConfiguration;
  filename: string;
  photo: string;
  sourceUrl: string;
  rowLabel: string;
  variation: string;
  make: string;
  model: string;
  years: string;
  yearValues: readonly number[];
  format: string;
  productTypeId: ProductTypeId;
  productTypeIds: readonly ProductTypeId[];
  optionSelections: readonly (readonly [string, string])[];
}

interface FilterOption {
  value: string;
  label: string;
}

interface MultiFilterProps {
  label: string;
  allLabel: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

const PRODUCT_LABELS = Object.fromEntries(
  PRODUCT_TYPES.map((item) => [item.id, item.product]),
) as Record<ProductTypeId, string>;

function vehicleIdentity(vehicle: string) {
  const match = /^(\d{4}(?:–\d{4})?)\s+(\S+)\s+(.+)$/.exec(vehicle);
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

function yearRangeValues(years: string): number[] {
  const match = /^(\d{4})(?:[–-](\d{4}))?$/.exec(years);
  if (!match) return [];
  const [, startValue, endValue] = match as unknown as [
    string,
    string,
    string?,
  ];
  const start = Number(startValue);
  const end = Number(endValue ?? startValue);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
}

function MultiFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: MultiFilterProps): ReactElement {
  const [filterQuery, setFilterQuery] = useState('');
  const normalizedFilterQuery = filterQuery.trim().toLowerCase();
  const visibleOptions = normalizedFilterQuery
    ? options.filter((option) =>
        option.label.toLowerCase().includes(normalizedFilterQuery),
      )
    : options;

  return (
    <div className="research-assets-multi-filter">
      <details name="research-asset-filters">
        <summary>
          <Filter aria-hidden="true" />
          <span>{label}</span>
          {selected.length > 0 && <b>{selected.length}</b>}
        </summary>
        <div>
          <label className="research-assets-filter-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${label.toLowerCase()}`}
              value={filterQuery}
              onChange={(event) => {
                setFilterQuery(event.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="research-assets-filter-all"
            onClick={() => {
              onChange([]);
            }}
          >
            <span aria-hidden="true">{selected.length === 0 && <Check />}</span>
            {allLabel}
          </button>
          {visibleOptions.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                type="button"
                key={option.value}
                aria-pressed={checked}
                onClick={() => {
                  onChange(
                    checked
                      ? selected.filter((value) => value !== option.value)
                      : [...selected, option.value],
                  );
                }}
              >
                <span aria-hidden="true">{checked && <Check />}</span>
                {option.label}
              </button>
            );
          })}
          {visibleOptions.length === 0 && (
            <span className="research-assets-filter-empty">
              No matching {label.toLowerCase()}
            </span>
          )}
        </div>
      </details>
    </div>
  );
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

function researchAssets(
  records: readonly ResearchDetailRecord[],
  configurations: readonly VehicleConfiguration[],
): ResearchAsset[] {
  return latestEvidence(records).flatMap((evidence) => {
    return evidence.materials.flatMap((material) =>
      material.fileData || material.sourceUrl
        ? (() => {
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
                configuration,
                filename: material.fileName || material.title,
                photo: material.fileData,
                sourceUrl: material.sourceUrl,
                rowLabel: material.fileData ? 'Uploaded asset' : 'Source link',
                variation: material.notes || material.title,
                productTypeId: material.productTypeId,
                productTypeIds,
                optionSelections: material.optionSelections,
                ...identity,
                yearValues: material.years.length
                  ? material.years
                  : yearRangeValues(identity.years),
                format: material.fileData
                  ? assetFormat(material.fileData, material.fileName)
                  : 'LINK',
              },
            ];
          })()
        : [],
    );
  });
}

/** Latest saved research images, searchable across vehicles and option combinations. */
export function ResearchAssetLibrary({
  configurations,
  onOpenEvidence,
}: ResearchAssetLibraryProps): ReactElement {
  const { records } = useRdRecords(
    RESEARCH_DETAIL_KEY,
    researchDetailListSchema,
    RESEARCH_DETAIL_SEED,
  );
  const assets = useMemo(
    () => researchAssets(records, configurations),
    [configurations, records],
  );
  const [query, setQuery] = useState('');
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(
    [],
  );
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<string[]>([]);
  const [selectedOptionValues, setSelectedOptionValues] = useState<string[]>(
    [],
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const years = Array.from(
    new Set(assets.flatMap((asset) => asset.yearValues)),
  ).sort((left, right) => left - right);
  const yearMatchingAssets = assets.filter(
    (asset) =>
      selectedYears.length === 0 ||
      asset.yearValues.some((year) => selectedYears.includes(String(year))),
  );
  const makes = Array.from(
    new Set(yearMatchingAssets.map((asset) => asset.make)),
  ).sort();
  const makeMatchingAssets = yearMatchingAssets.filter(
    (asset) => selectedMakes.length === 0 || selectedMakes.includes(asset.make),
  );
  const models = Array.from(
    new Set(makeMatchingAssets.map((asset) => asset.model)),
  ).sort();
  const productTypes = PRODUCT_TYPES.filter((productType) =>
    assets.some((asset) => asset.productTypeIds.includes(productType.id)),
  );
  const optionKeys = Array.from(
    new Set(
      assets.flatMap((asset) => asset.optionSelections.map(([key]) => key)),
    ),
  ).sort();
  const optionValues = Array.from(
    new Set(
      assets.flatMap((asset) =>
        asset.optionSelections
          .filter(
            ([key]) =>
              selectedOptionKeys.length === 0 ||
              selectedOptionKeys.includes(key),
          )
          .map(([, value]) => value),
      ),
    ),
  ).sort();
  const formats = Array.from(
    new Set(assets.map((asset) => asset.format)),
  ).sort();

  function changeYears(nextYears: string[]): void {
    const matchingAssets = assets.filter(
      (asset) =>
        nextYears.length === 0 ||
        asset.yearValues.some((year) => nextYears.includes(String(year))),
    );
    const allowedMakes = new Set(matchingAssets.map((asset) => asset.make));
    const nextMakes = selectedMakes.filter((make) => allowedMakes.has(make));
    const allowedModels = new Set(
      matchingAssets
        .filter(
          (asset) => nextMakes.length === 0 || nextMakes.includes(asset.make),
        )
        .map((asset) => asset.model),
    );
    setSelectedYears(nextYears);
    setSelectedMakes(nextMakes);
    setSelectedModels((current) =>
      current.filter((model) => allowedModels.has(model)),
    );
  }

  function changeMakes(nextMakes: string[]): void {
    const allowedModels = new Set(
      yearMatchingAssets
        .filter(
          (asset) => nextMakes.length === 0 || nextMakes.includes(asset.make),
        )
        .map((asset) => asset.model),
    );
    setSelectedMakes(nextMakes);
    setSelectedModels((current) =>
      current.filter((model) => allowedModels.has(model)),
    );
  }

  function changeOptionKeys(nextOptionKeys: string[]): void {
    const allowedValues = new Set(
      assets.flatMap((asset) =>
        asset.optionSelections
          .filter(
            ([key]) =>
              nextOptionKeys.length === 0 || nextOptionKeys.includes(key),
          )
          .map(([, value]) => value),
      ),
    );
    setSelectedOptionKeys(nextOptionKeys);
    setSelectedOptionValues((current) =>
      current.filter((value) => allowedValues.has(value)),
    );
  }
  const normalizedQuery = query.trim().toLowerCase();
  const visibleAssets = assets.filter((asset) => {
    const optionText = asset.optionSelections.flat().join(' ');
    const matchesQuery =
      !normalizedQuery ||
      [
        asset.filename,
        asset.configuration.vehicle,
        asset.rowLabel,
        asset.variation,
        optionText,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesOption = asset.optionSelections.some(
      ([key, value]) =>
        (selectedOptionKeys.length === 0 || selectedOptionKeys.includes(key)) &&
        (selectedOptionValues.length === 0 ||
          selectedOptionValues.includes(value)),
    );
    return (
      matchesQuery &&
      (selectedMakes.length === 0 || selectedMakes.includes(asset.make)) &&
      (selectedModels.length === 0 || selectedModels.includes(asset.model)) &&
      (selectedYears.length === 0 ||
        asset.yearValues.some((year) =>
          selectedYears.includes(String(year)),
        )) &&
      (selectedProductTypes.length === 0 ||
        asset.productTypeIds.some((productTypeId) =>
          selectedProductTypes.includes(productTypeId),
        )) &&
      (selectedOptionKeys.length === 0 && selectedOptionValues.length === 0
        ? true
        : matchesOption) &&
      (selectedFormats.length === 0 || selectedFormats.includes(asset.format))
    );
  });

  return (
    <section className="research-assets" aria-label="Research asset library">
      <header className="research-assets-header">
        <div>
          <span className="research-assets-eyebrow">Asset library</span>
          <h2>Research files</h2>
          <p>Latest saved files and sources across research configurations.</p>
        </div>
        <strong>{visibleAssets.length} files</strong>
      </header>

      <div className="research-assets-toolbar">
        <label className="research-assets-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Search research files"
            placeholder="Search filename, vehicle, seat type"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <MultiFilter
          label="Year"
          allLabel="All years"
          options={years.map((item) => ({
            value: String(item),
            label: String(item),
          }))}
          selected={selectedYears}
          onChange={changeYears}
        />
        <MultiFilter
          label="Make"
          allLabel={selectedYears.length ? 'All matching makes' : 'All makes'}
          options={makes.map((item) => ({ value: item, label: item }))}
          selected={selectedMakes}
          onChange={changeMakes}
        />
        <MultiFilter
          label="Model"
          allLabel={selectedMakes.length ? 'All matching models' : 'All models'}
          options={models.map((item) => ({ value: item, label: item }))}
          selected={selectedModels}
          onChange={setSelectedModels}
        />
        <MultiFilter
          label="Product types"
          allLabel="All product types"
          options={productTypes.map((item) => ({
            value: item.id,
            label: item.product,
          }))}
          selected={selectedProductTypes}
          onChange={setSelectedProductTypes}
        />
        <MultiFilter
          label="Options"
          allLabel="All options"
          options={optionKeys.map((item) => ({ value: item, label: item }))}
          selected={selectedOptionKeys}
          onChange={changeOptionKeys}
        />
        <MultiFilter
          label="Values"
          allLabel={
            selectedOptionKeys.length ? 'All matching values' : 'All values'
          }
          options={optionValues.map((item) => ({ value: item, label: item }))}
          selected={selectedOptionValues}
          onChange={setSelectedOptionValues}
        />
        <MultiFilter
          label="File types"
          allLabel="All types"
          options={formats.map((item) => ({ value: item, label: item }))}
          selected={selectedFormats}
          onChange={setSelectedFormats}
        />
      </div>

      {visibleAssets.length ? (
        <div className="research-assets-grid">
          {visibleAssets.map((asset) => (
            <article className="research-asset-card" key={asset.id}>
              <div className="research-asset-preview">
                {asset.photo ? (
                  <img src={asset.photo} alt={asset.filename} />
                ) : (
                  <span className="research-asset-link-preview">
                    <Link2 aria-hidden="true" />
                  </span>
                )}
                <span>{asset.format}</span>
              </div>
              <div className="research-asset-body">
                <div className="research-asset-title">
                  <FileImage aria-hidden="true" />
                  <div>
                    <strong title={asset.filename}>{asset.filename}</strong>
                    <span>
                      {asset.years} {asset.make} {asset.model}
                    </span>
                  </div>
                </div>
                <div className="research-asset-context">
                  <span>
                    {PRODUCT_LABELS[asset.productTypeId]} · {asset.rowLabel}
                  </span>
                  <strong>{asset.variation}</strong>
                </div>
                <ConfigChips
                  options={
                    asset.optionSelections.length
                      ? asset.optionSelections
                      : asset.configuration.options
                  }
                />
                <footer>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenEvidence(asset.configuration.id);
                    }}
                  >
                    View research
                  </Button>
                  {asset.photo ? (
                    <a href={asset.photo} download={asset.filename}>
                      <Download aria-hidden="true" /> Download
                    </a>
                  ) : (
                    <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" /> Open source
                    </a>
                  )}
                </footer>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="research-assets-empty">
          <FileImage aria-hidden="true" />
          <h3>
            {assets.length
              ? 'No files match these filters'
              : 'No research files yet'}
          </h3>
          <p>
            {assets.length
              ? 'Try a different make, model, option, or search term.'
              : 'Files and links saved in Vehicle Research will appear here.'}
          </p>
        </div>
      )}
    </section>
  );
}
