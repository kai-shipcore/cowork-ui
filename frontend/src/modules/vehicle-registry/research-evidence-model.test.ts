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
  categorization: 'Cabin type and trim',
  summary: 'Two confirmed seat variations',
  sections: [
    {
      id: 'row-1',
      rowLabel: 'Front (1st row)',
      keyNotes: 'Removable headrest',
      seatTypes: [
        {
          id: 'seat-1',
          name: 'Bucket seat',
          sourceUrl: 'https://example.com/front-seat',
          photo: '',
          photoName: '',
        },
      ],
    },
  ],
  decision: 'Keep separate configuration',
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
  assert.equal(
    researchEvidenceSchema.safeParse({
      ...evidence,
      sections: [
        ...evidence.sections,
        {
          ...evidence.sections[0],
          id: 'row-2',
          rowLabel: 'Rear (2nd row)',
          seatTypes: [
            ...evidence.sections[0].seatTypes,
            {
              ...evidence.sections[0].seatTypes[0],
              id: 'seat-2',
              name: 'Split bench',
            },
          ],
        },
      ],
    }).success,
    true,
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
    decision: 'Propose merge' as const,
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

await test('legacy research decisions normalize while original evidence stays unchanged', () => {
  const reason = '조사자가 작성한 원문';
  for (const [legacy, current] of [
    ['검토 중', 'Under review'],
    ['별도 구성 유지', 'Keep separate configuration'],
    ['병합 제안', 'Propose merge'],
  ]) {
    const parsed = researchEvidenceSchema.parse({
      ...evidence,
      decision: legacy,
      reason,
      photoName: '조사사진.png',
    });
    assert.equal(parsed.decision, current);
    assert.equal(parsed.reason, reason);
    assert.equal(parsed.photoName, '조사사진.png');
    assert.deepEqual(parsed.sources, evidence.sources);
    if (parsed.decision === 'Propose merge')
      assert.throws(() => validateResearchEvidence(parsed, [config]));
  }
});
