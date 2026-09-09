import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ProjectDesignRevision,
  SampleRequestItem,
} from '../types/workbench';
import {
  canApproveRevisionSample,
  isChangedDxf,
  revisionExecutionAccuracy,
} from './revision-control';

const item = (
  verdict?: SampleRequestItem['revisionReflected'],
): SampleRequestItem => ({
  id: crypto.randomUUID(),
  sampleRequestId: 'request',
  vehicleProductDesignId: 'design',
  vehicleProductDesignRevisionId: 'rev-2',
  sampleRound: 2,
  priority: 'NORMAL',
  sampleReceivedAt: '2026-09-08',
  ...(verdict ? { revisionReflected: verdict } : {}),
});
const revised: ProjectDesignRevision = {
  id: 'rev-2',
  revisionNumber: 2,
  note: 'change',
  createdBy: 'designer',
  createdAt: '2026-09-01',
  changeRequest: {
    issueSource: 'sample fitting',
    issueArea: 'lower back',
    instruction: '+10mm',
    referenceImageName: 'issue.jpg',
    previousRevisionId: 'rev-1',
    previousDxfFileName: 'v1.dxf',
    previousDxfFingerprint: 'old',
    newDxfFileName: 'v2.dxf',
    newDxfFingerprint: 'new',
    designerConfirmed: true,
    confirmedBy: 'designer',
    confirmedAt: '2026-09-01',
  },
};

test('the same DXF content is rejected regardless of filename', () => {
  assert.equal(isChangedDxf('same-hash', 'same-hash'), false);
  assert.equal(isChangedDxf('old-hash', 'new-hash'), true);
});
test('only exact execution counts in revision accuracy', () => {
  assert.deepEqual(
    revisionExecutionAccuracy([item('EXACT'), item('PARTIAL'), item('NONE')]),
    { exact: 1, verified: 3, percentage: 33.3 },
  );
});
test('revised samples cannot be approved before exact execution verification', () => {
  assert.equal(canApproveRevisionSample(revised, item()), false);
  assert.equal(canApproveRevisionSample(revised, item('PARTIAL')), false);
  assert.equal(canApproveRevisionSample(revised, item('EXACT')), true);
});
