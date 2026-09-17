import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SampleRequestItem } from '../types/workbench';
import { sampleStatus } from './sample-inspection';
import { canApproveRevisionSample } from './revision-control';
import { mergeProjectSampleItem } from './sample-item-sync';

const generated: SampleRequestItem = {
  id: 'item', sampleRequestId: 'request', vehicleProductDesignId: 'design',
  vehicleProductDesignRevisionId: 'revision-new', sampleRound: 1, priority: 'NORMAL',
  sampleReceivedAt: '2026-09-16T12:00:00Z', sampleShipmentId: 'generated-shipment',
};
const inspected: SampleRequestItem = {
  ...generated, vehicleProductDesignRevisionId: 'revision-original',
  sampleRound: 2, priority: 'URGENT', sampleReceivedAt: '2026-01-01T10:00:00Z',
  sampleShipmentId: 'actual-shipment', productionStartedAt: '2025-12-28',
  drawingMatch: true, revisionReflected: 'CORRECT', inspectedAt: '2026-01-02T10:00:00Z',
  inspectedBy: 'USR-KAI', inspectionNote: 'Checked against drawing', note: 'Tracker note',
};

void test('project sync preserves tracker evidence, identity, priority and actual receipt', () => {
  const result = mergeProjectSampleItem(generated, inspected);
  assert.deepEqual(result, inspected);
  assert.equal(sampleStatus(result), 'PASSED');
  assert.equal(canApproveRevisionSample(undefined, result), true);
  assert.deepEqual(mergeProjectSampleItem(generated, result), result);
});
void test('project sync preserves failed and pending inspections rather than inventing passes', () => {
  const failed = { ...inspected, drawingMatch: false, inspectionNote: 'Wrong seam' };
  assert.equal(sampleStatus(mergeProjectSampleItem(generated, failed)), 'FACTORY_ISSUE');
  assert.equal(canApproveRevisionSample(undefined, mergeProjectSampleItem(generated, failed)), false);
  assert.equal(sampleStatus(mergeProjectSampleItem(generated)), 'RECEIVED');
});
void test('explicit project notes can change without clearing inspection evidence', () => {
  const result = mergeProjectSampleItem({ ...generated, note: 'Updated line' }, inspected);
  assert.equal(result.note, 'Updated line');
  assert.equal(result.inspectionNote, inspected.inspectionNote);
  assert.equal(result.inspectedAt, inspected.inspectedAt);
});
