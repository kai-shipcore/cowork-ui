import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleProjectGroup } from '@/shared/types/workbench';
import {
  intakeSchema,
  linkedIntakeProjects,
  reviewIntake,
  type DevelopmentIntake,
} from './intake-model';

const draft: DevelopmentIntake = {
  id: 'DEV-1',
  vehicle: '2026 Test',
  configurationId: 'c1',
  product: 'Seat Cover',
  source: 'Notify Me',
  sourceReference: 'Export-1',
  notifyCount: 12,
  complaintCount: 0,
  b2bUnits: 0,
  releaseDate: '',
  evidence: '12 customers requested coverage',
  priority: 'NORMAL',
  status: '검토 대기',
  reviews: [],
  createdAt: '2026-09-21T12:00:00Z',
};
const project: VehicleProjectGroup = {
  productTypeId: 'PT-SC',
  id: 'PG-1',
  vehicle: draft.vehicle,
  vehicleResearchId: 'c1',
  options: [],
  product: 'Seat Cover',
  zoneProjects: [],
  stage: 'Vehicle Hunt',
  status: 'IN PROGRESS',
  created: '2026-09-21',
};

await test('intake rejects missing evidence, negative counts and fractional quantities', () => {
  assert.equal(intakeSchema.safeParse(draft).success, true);
  assert.equal(
    intakeSchema.safeParse({ ...draft, evidence: ' ' }).success,
    false,
  );
  assert.equal(
    intakeSchema.safeParse({ ...draft, notifyCount: -1 }).success,
    false,
  );
  assert.equal(
    intakeSchema.safeParse({ ...draft, b2bUnits: 1.5 }).success,
    false,
  );
});
await test('review appends decision, reason and priority without rewriting history', () => {
  const review = {
    at: '2026-09-22T12:00:00Z',
    actor: 'Demo',
    status: '개발 승인' as const,
    priority: 'HIGH' as const,
    reason: 'Strong demand',
  };
  const approved = reviewIntake(draft, review);
  assert.equal(approved.priority, 'HIGH');
  assert.equal(approved.status, '개발 승인');
  assert.equal(approved.reviews.length, 1);
  assert.equal(draft.reviews.length, 0);
  assert.throws(() => reviewIntake(draft, { ...review, reason: ' ' }));
});
await test('request project links require both the configuration and product', () => {
  const linked = linkedIntakeProjects(draft, [
    project,
    { ...project, id: 'PG-2', product: 'Floor Mat' },
    { ...project, id: 'PG-3', vehicleResearchId: 'c2' },
  ]);
  assert.deepEqual(
    linked.map((entry) => entry.id),
    ['PG-1'],
  );
});
