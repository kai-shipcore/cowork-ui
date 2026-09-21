import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import {
  researchEvidenceSchema,
  validateResearchEvidence,
  type ResearchEvidenceRecord,
} from './research-evidence-model';

const config: VehicleConfiguration = {
  id: 'c1',
  vehicle: 'Test',
  vehicleClass: 'SUV',
  options: [],
  researchStatus: 'COMPLETE',
  projectGroupIds: [],
};
const evidence: ResearchEvidenceRecord = {
  id: 'e1',
  configurationId: 'c1',
  checkedCount: 3,
  sources: ['https://example.com/listing'],
  photo: '',
  photoName: '',
  decision: '별도 구성 유지',
  mergeTargetId: '',
  reason: 'Separate belt geometry',
  actor: 'Demo',
  at: '2026-09-21',
};

await test('research evidence rejects unsafe URLs, executable images and invalid counts', () => {
  assert.equal(researchEvidenceSchema.safeParse(evidence).success, true);
  for (const sources of [
    ['javascript:alert(1)'],
    ['https://user:pass@example.com'],
  ])
    assert.equal(
      researchEvidenceSchema.safeParse({ ...evidence, sources }).success,
      false,
    );
  assert.equal(
    researchEvidenceSchema.safeParse({
      ...evidence,
      photo: 'data:image/svg+xml;base64,AAA=',
    }).success,
    false,
  );
  assert.equal(
    researchEvidenceSchema.safeParse({ ...evidence, checkedCount: -1 }).success,
    false,
  );
  assert.equal(
    researchEvidenceSchema.safeParse({ ...evidence, reason: ' ' }).success,
    false,
  );
});
await test('merge suggestions require a different configuration of the same vehicle', () => {
  const configurations = [
    config,
    { ...config, id: 'c2' },
    { ...config, id: 'c3', vehicle: 'Other' },
  ];
  const proposal = {
    ...evidence,
    decision: '병합 제안' as const,
    mergeTargetId: 'c2',
  };
  assert.equal(
    validateResearchEvidence(proposal, configurations).mergeTargetId,
    'c2',
  );
  for (const mergeTargetId of ['c1', 'c3', 'missing', ''])
    assert.throws(() =>
      validateResearchEvidence({ ...proposal, mergeTargetId }, configurations),
    );
  assert.equal(configurations[0].researchStatus, 'COMPLETE');
});
