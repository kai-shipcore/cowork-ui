import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  researchAssetRelevance,
  type ResearchAssetCandidate,
} from './research-asset-relevance';

const candidate: ResearchAssetCandidate = {
  id: 'c01:PT-SC',
  label: 'Seat Cover · Configuration 1',
  years: [2023, 2024, 2025, 2026],
  productTypeId: 'PT-SC',
  options: [
    ['Powertrain', 'Hybrid'],
    ['Seats', '5 Seats'],
  ],
  zoneIds: ['ZONE-SC-F', 'ZONE-SC-B'],
};

await test('gives an exact match all four dimensions', () => {
  assert.deepEqual(
    researchAssetRelevance(
      {
        years: [2024],
        productTypeIds: ['PT-SC'],
        options: candidate.options,
        zoneIds: ['ZONE-SC-F'],
      },
      candidate,
    ),
    {
      score: 100,
      label: 'Exact match',
      productMatch: true,
      yearMatch: true,
      optionMatches: 2,
      optionTotal: 2,
      zoneMatch: true,
    },
  );
});

await test('shows partial option coverage as a lower relevance result', () => {
  const result = researchAssetRelevance(
    {
      years: [2025],
      productTypeIds: ['PT-SC'],
      options: [['Powertrain', 'Hybrid']],
      zoneIds: ['ZONE-SC-B'],
    },
    candidate,
  );
  assert.equal(result.score, 83);
  assert.equal(result.label, 'Strong match');
  assert.equal(result.optionMatches, 1);
});

await test('unrelated product types can be excluded by the caller', () => {
  const result = researchAssetRelevance(
    {
      years: [2024],
      productTypeIds: ['PT-CC'],
      options: candidate.options,
      zoneIds: ['ZONE-SC-F'],
    },
    candidate,
  );
  assert.equal(result.productMatch, false);
  assert.equal(result.score, 70);
});
