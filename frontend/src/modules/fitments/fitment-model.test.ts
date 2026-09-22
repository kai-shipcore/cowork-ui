import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FitmentQuality } from '@/shared/types/db-workflow';
import {
  fitmentKind,
  latestFitments,
  sameFitmentTarget,
} from './fitment-model';

const project: FitmentQuality = {
  id: 'project-1',
  vehicleResearchId: 'vehicle-1',
  vehicleProjectId: 'zone-project-1',
  vehicleZoneId: 'front',
  quality: 'FAIL',
  source: 'REVIEW',
  note: 'Fit review',
  evidenceKey: 'evidence',
  createdAt: '2026-09-20T12:00:00Z',
};
await test('project and part fitments are independent targets', () => {
  const part = { ...project, id: 'part-1', vehicleProductDesignId: 'design-1' };
  assert.equal(fitmentKind(project), 'projects');
  assert.equal(fitmentKind(part), 'parts');
  assert.equal(sameFitmentTarget(project, part), false);
  assert.equal(latestFitments([project, part]).length, 2);
});
await test('list uses latest observation but leaves source history intact', () => {
  const latest = {
    ...project,
    id: 'project-2',
    quality: 'PASS' as const,
    createdAt: '2026-09-21T12:00:00Z',
  };
  const records = [latest, project];
  assert.deepEqual(latestFitments(records), [latest]);
  assert.equal(records.length, 2);
  assert.equal(records[1].quality, 'FAIL');
});
await test('different vehicles, parts and zones never collapse together', () => {
  const records = [
    project,
    { ...project, id: 'other-vehicle', vehicleResearchId: 'vehicle-2' },
    { ...project, id: 'other-zone', vehicleZoneId: 'rear' },
    { ...project, id: 'part-a', vehicleProductDesignId: 'a' },
    { ...project, id: 'part-b', vehicleProductDesignId: 'b' },
  ];
  assert.equal(latestFitments(records).length, 5);
  assert.deepEqual(latestFitments([]), []);
});
