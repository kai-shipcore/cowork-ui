import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Download, ExternalLink, FileImage, Link2, Search } from 'lucide-react';
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
  format: string;
  productTypeId: ProductTypeId;
  optionSelections: readonly (readonly [string, string])[];
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
                optionSelections: material.optionSelections,
                ...identity,
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
  const [make, setMake] = useState('ALL');
  const [model, setModel] = useState('ALL');
  const [optionKey, setOptionKey] = useState('ALL');
  const [optionValue, setOptionValue] = useState('ALL');
  const [format, setFormat] = useState('ALL');
  const makes = Array.from(new Set(assets.map((asset) => asset.make))).sort();
  const models = Array.from(
    new Set(
      assets
        .filter((asset) => make === 'ALL' || asset.make === make)
        .map((asset) => asset.model),
    ),
  ).sort();
  const optionKeys = Array.from(
    new Set(
      assets.flatMap((asset) => asset.optionSelections.map(([key]) => key)),
    ),
  ).sort();
  const optionValues = Array.from(
    new Set(
      assets.flatMap((asset) =>
        asset.optionSelections
          .filter(([key]) => optionKey === 'ALL' || key === optionKey)
          .map(([, value]) => value),
      ),
    ),
  ).sort();
  const formats = Array.from(
    new Set(assets.map((asset) => asset.format)),
  ).sort();
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
        (optionKey === 'ALL' || key === optionKey) &&
        (optionValue === 'ALL' || value === optionValue),
    );
    return (
      matchesQuery &&
      (make === 'ALL' || asset.make === make) &&
      (model === 'ALL' || asset.model === model) &&
      (optionKey === 'ALL' && optionValue === 'ALL' ? true : matchesOption) &&
      (format === 'ALL' || asset.format === format)
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
        <label>
          <span>Make</span>
          <select
            value={make}
            onChange={(event) => {
              setMake(event.target.value);
              setModel('ALL');
            }}
          >
            <option value="ALL">All makes</option>
            {makes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Model</span>
          <select
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
            }}
          >
            <option value="ALL">All models</option>
            {models.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Option</span>
          <select
            value={optionKey}
            onChange={(event) => {
              setOptionKey(event.target.value);
              setOptionValue('ALL');
            }}
          >
            <option value="ALL">All options</option>
            {optionKeys.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Value</span>
          <select
            value={optionValue}
            onChange={(event) => {
              setOptionValue(event.target.value);
            }}
          >
            <option value="ALL">All values</option>
            {optionValues.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>File type</span>
          <select
            value={format}
            onChange={(event) => {
              setFormat(event.target.value);
            }}
          >
            <option value="ALL">All types</option>
            {formats.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
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
