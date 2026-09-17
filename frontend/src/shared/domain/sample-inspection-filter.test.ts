import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SampleRequestItem } from '../types/workbench';
import { matchesInspectionItem, matchesInspectionRequest } from './sample-inspection-filter';

const received: SampleRequestItem = {
  id: 'item', sampleRequestId: 'request', vehicleProductDesignId: 'design',
  vehicleProductDesignRevisionId: 'revision', sampleRound: 1, priority: 'NORMAL',
  sampleReceivedAt: '2026-01-01',
};
const passed: SampleRequestItem = { ...received, drawingMatch: true, inspectedAt: '2026-01-02', inspectedBy: 'USR-KAI' };
const failed: SampleRequestItem = { ...passed, drawingMatch: false, inspectionNote: 'Wrong seam' };

void test('passed requests leave pending and require every line to pass', () => {
  assert.equal(matchesInspectionRequest([passed], 'PASSED'), true);
  assert.equal(matchesInspectionRequest([passed], 'ARRIVED'), false);
  assert.equal(matchesInspectionRequest([passed, received], 'PASSED'), false);
  assert.equal(matchesInspectionRequest([passed, received], 'ARRIVED'), true);
  assert.equal(matchesInspectionRequest([passed, passed], 'PASSED'), true);
});
void test('failed and unreceived lines are not uninspected receipts', () => {
  assert.equal(matchesInspectionRequest([failed], 'ARRIVED'), false);
  assert.equal(matchesInspectionRequest([passed, failed], 'PASSED'), false);
  assert.equal(matchesInspectionRequest([{ ...received, sampleReceivedAt: undefined }], 'ARRIVED'), false);
  assert.equal(matchesInspectionRequest([], 'PASSED'), false);
  assert.equal(matchesInspectionRequest([], 'ARRIVED'), false);
});
void test('pending part lines exclude passed and failed siblings', () => {
  assert.deepEqual([received, passed, failed].filter(i => matchesInspectionItem(i, 'ARRIVED')), [received]);
  assert.equal(matchesInspectionRequest([{ ...passed, sampleRound: 2 }], 'PASSED'), false);
  assert.equal(matchesInspectionRequest([{ ...passed, sampleRound: 2, revisionReflected: 'CORRECT' }], 'PASSED'), true);
});
