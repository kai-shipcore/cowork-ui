import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
} from '@/shared/types/workbench';
import {
  hasVendorFailure,
  vendorFailureCases,
  vendorQualityReport,
} from './vendor-quality-model';

const request: SampleRequest = {
  id: 'r1',
  projectGroupId: 'p1',
  vehicle: 'Test',
  product: 'Seat Cover',
  factory: 'Factory A',
  createdAt: '2026-09-01',
};
const item: SampleRequestItem = {
  id: 'i1',
  sampleRequestId: 'r1',
  vehicleProductDesignId: 'd1',
  vehicleProductDesignRevisionId: 'v1',
  sampleRound: 2,
  priority: 'NORMAL',
  inspectedAt: '2026-09-20',
  revisionReflected: 'NOT_REFLECTED',
};

await test('factory failures require inspection or verification evidence', () => {
  assert.equal(hasVendorFailure(item), true);
  assert.equal(hasVendorFailure({ ...item, inspectedAt: undefined }), false);
  assert.equal(
    hasVendorFailure({
      ...item,
      inspectedAt: undefined,
      verifiedAt: '2026-09-20',
    }),
    true,
  );
  assert.equal(
    hasVendorFailure({
      ...item,
      revisionReflected: 'CORRECT',
      drawingMatch: true,
    }),
    false,
  );
});
await test('repeat issues group by factory/design and count distinct failed rounds', () => {
  const cases = vendorFailureCases(
    [request],
    [
      item,
      { ...item, id: 'i2', sampleRound: 3 },
      { ...item, id: 'i3', sampleRound: 3 },
    ],
  );
  assert.equal(cases.length, 1);
  assert.equal(cases[0].rounds, 2);
  const previous = vendorFailureCases([request], [item]);
  assert.notEqual(cases[0].id, previous[0].id);
});
await test('vendor report excludes missing date denominators and measures local arrival dates', () => {
  const shipments: SampleShipment[] = [
    {
      id: 's1',
      factory: 'Factory A',
      expectedArrivalDate: '2026-09-20',
      arrivedAt: '2026-09-21T01:00:00Z',
    },
    { id: 's2', factory: 'Factory A', arrivedAt: '2026-09-21' },
    { id: 's3', factory: 'Factory A', expectedArrivalDate: '2026-09-20' },
  ];
  const report = vendorQualityReport(
    [request],
    [item, { ...item, id: 'i2', inspectedAt: undefined }],
    shipments,
    '2026-09-21',
  )[0];
  assert.equal(report.inspected, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.measured, 1);
  assert.equal(report.onTime, 1);
  assert.equal(report.overdue, 1);
});
await test('different factories never share issue groups', () => {
  const cases = vendorFailureCases(
    [request, { ...request, id: 'r2', factory: 'Factory B' }],
    [item, { ...item, id: 'i2', sampleRequestId: 'r2' }],
  );
  assert.equal(cases.length, 2);
  assert.ok(cases.every((entry) => entry.rounds === 1));
});
