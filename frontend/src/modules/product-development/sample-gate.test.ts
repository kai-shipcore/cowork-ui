import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ProjectDesign,
  SampleRequestItem,
} from '@/shared/types/workbench';
import { getSampleGate } from './sample-gate';

const zones = [{ id: 'VP-EX', code: 'EX' }];
const design: ProjectDesign = {
  id: 'DS-1',
  vehicleProjectId: 'VP-EX',
  productTypeId: 'PT-CC',
  name: 'Mustang Cover',
  status: 'ACTIVE',
  quantity: 1,
  fittingConfirmed: false,
  details: {
    kind: 'CAR_COVER',
    vehicleResearchId: 'c07',
    designedBy: 'USR-KAI',
  },
  revisions: [
    {
      id: 'REV-1',
      revisionNumber: 1,
      createdAt: '2026-09-09',
      createdBy: 'USR-KAI',
      note: 'First',
      sampleApprovedAt: '2026-09-09',
    },
  ],
};
const item: SampleRequestItem = {
  id: 'SRI-1',
  sampleRequestId: 'SR-1',
  vehicleProductDesignId: 'DS-1',
  vehicleProductDesignRevisionId: 'REV-1',
  sampleRound: 1,
  priority: 'NORMAL',
  sampleReceivedAt: '2026-09-09',
};

test('an orphan approved sample cannot pass an empty car-cover design gate', () => {
  const gate = getSampleGate('Car Cover', zones, [], [item]);
  assert.equal(gate.ready, false);
  assert.equal(gate.blockers[0]?.tab, 'designs');
  assert.match(gate.blockers[0]?.message ?? '', /전체 패턴/);
});

test('current revision needs its own receipt and approval', () => {
  assert.equal(getSampleGate('Car Cover', zones, [design], [item]).ready, true);
  assert.equal(
    getSampleGate(
      'Car Cover',
      zones,
      [design],
      [{ ...item, sampleReceivedAt: undefined }],
    ).ready,
    false,
  );
  assert.equal(
    getSampleGate(
      'Car Cover',
      zones,
      [design],
      [{ ...item, vehicleProductDesignRevisionId: 'OLD' }],
    ).ready,
    false,
  );
  const unapproved = {
    ...design,
    revisions: design.revisions.map((revision) => ({
      ...revision,
      sampleApprovedAt: undefined,
    })),
  };
  assert.equal(
    getSampleGate('Car Cover', zones, [unapproved], [item]).ready,
    false,
  );
});

test('each bundle zone needs a design and another zones receipt cannot satisfy it', () => {
  const bundle = [...zones, { id: 'VP-B', code: 'B' }];
  assert.equal(
    getSampleGate('Floor Mat', bundle, [design], [item]).ready,
    false,
  );
  assert.equal(
    getSampleGate(
      'Car Cover',
      zones,
      [{ ...design, vehicleProjectId: 'OTHER' }],
      [item],
    ).ready,
    false,
  );
  assert.equal(getSampleGate('Car Cover', [], [], []).ready, false);
});

test('floor mat retains its receipt-only approval policy but cannot bypass receipt', () => {
  const unapproved = {
    ...design,
    revisions: design.revisions.map((revision) => ({
      ...revision,
      sampleApprovedAt: undefined,
    })),
  };
  assert.equal(
    getSampleGate('Floor Mat', zones, [unapproved], [item]).ready,
    true,
  );
  assert.equal(
    getSampleGate('Floor Mat', zones, [unapproved], []).ready,
    false,
  );
});
