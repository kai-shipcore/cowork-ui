import type { ProductTypeId } from '@/shared/types/workbench';

export interface ResearchAssetCandidate {
  id: string;
  label: string;
  years: readonly number[];
  productTypeId: ProductTypeId;
  options: readonly (readonly [string, string])[];
  zoneIds: readonly string[];
}

export interface ResearchAssetRelevanceInput {
  years: readonly number[];
  productTypeIds: readonly ProductTypeId[];
  options: readonly (readonly [string, string])[];
  zoneIds: readonly string[];
}

export interface ResearchAssetRelevance {
  score: number;
  label: 'Exact match' | 'Strong match' | 'Related';
  productMatch: boolean;
  yearMatch: boolean;
  optionMatches: number;
  optionTotal: number;
  zoneMatch: boolean;
}

function normalizedOption(key: string, value: string): string {
  return `${key.trim().toLowerCase()}:${value.trim().toLowerCase()}`;
}

export function researchAssetRelevance(
  asset: ResearchAssetRelevanceInput,
  candidate: ResearchAssetCandidate,
): ResearchAssetRelevance {
  const productMatch = asset.productTypeIds.includes(candidate.productTypeId);
  const yearMatch = candidate.years.some((year) => asset.years.includes(year));
  const assetOptions = new Set(
    asset.options.map(([key, value]) => normalizedOption(key, value)),
  );
  const optionMatches = candidate.options.filter(([key, value]) =>
    assetOptions.has(normalizedOption(key, value)),
  ).length;
  const optionTotal = candidate.options.length;
  const optionCoverage = optionTotal === 0 ? 1 : optionMatches / optionTotal;
  const zoneMatch = candidate.zoneIds.some((zoneId) =>
    asset.zoneIds.includes(zoneId),
  );
  const score = Math.round(
    (productMatch ? 30 : 0) +
      (yearMatch ? 20 : 0) +
      optionCoverage * 35 +
      (zoneMatch ? 15 : 0),
  );
  const exact = productMatch && yearMatch && optionCoverage === 1 && zoneMatch;

  return {
    score,
    label: exact ? 'Exact match' : score >= 75 ? 'Strong match' : 'Related',
    productMatch,
    yearMatch,
    optionMatches,
    optionTotal,
    zoneMatch,
  };
}
