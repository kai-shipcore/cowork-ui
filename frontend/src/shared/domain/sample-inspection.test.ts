import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SampleRequestItem } from '../types/workbench';
import {
  inspectionErrors,
  migrateSampleInspection,
  sampleStatus,
} from './sample-inspection';

const item: SampleRequestItem = {
  id: 'i',
  sampleRequestId: 'r',
  vehicleProductDesignId: 'd',
  vehicleProductDesignRevisionId: 'v',
  sampleRound: 1,
  priority: 'NORMAL',
  sampleReceivedAt: '2026-01-01',
  inspectedAt: '2026-01-02',
  inspectedBy: 'u',
  drawingMatch: true,
};
void test('receipt without inspection never counts as passing', () => {
  assert.equal(sampleStatus({ ...item, inspectedAt: undefined }), 'RECEIVED');
  assert.equal(
    sampleStatus({ ...item, sampleReceivedAt: undefined }),
    'REQUESTED',
  );
  assert.equal(sampleStatus({ ...item, drawingMatch: undefined }), 'RECEIVED');
  assert.equal(sampleStatus(item), 'PASSED');
});
void test('later rounds require reflection and drawing mismatch has factory precedence', () => {
  assert.ok(inspectionErrors({ ...item, sampleRound: 2 }).length);
  assert.equal(
    sampleStatus({ ...item, sampleRound: 2, revisionReflected: 'CORRECT' }),
    'PASSED',
  );
  assert.equal(
    sampleStatus({
      ...item,
      revisionReflected: 'PARTIAL',
      inspectionNote: 'partial',
    }),
    'DESIGN_ISSUE',
  );
  assert.equal(
    sampleStatus({
      ...item,
      drawingMatch: false,
      revisionReflected: 'PARTIAL',
      inspectionNote: 'both',
    }),
    'FACTORY_ISSUE',
  );
});
void test('invalid chronology and legacy execution do not fabricate drawing inspection', () => {
  assert.ok(inspectionErrors({ ...item, inspectedAt: '2025-12-31' }).length);
  assert.ok(inspectionErrors({ ...item, inspectedAt: '2099-01-01' }).length);
  const legacy = migrateSampleInspection({
    ...item,
    drawingMatch: undefined,
    revisionReflected: 'EXACT' as SampleRequestItem['revisionReflected'],
  });
  assert.equal(legacy.revisionReflected, 'CORRECT');
  assert.equal(sampleStatus(legacy), 'RECEIVED');
});
