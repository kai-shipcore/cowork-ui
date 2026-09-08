import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VEHICLE_PROJECTS } from '../../app/workbench-mock-data';
import type { Visit } from '../../shared/types/workbench';
import { huntRow } from './hunt-rows';

const seed = VEHICLE_PROJECTS.find(
  (p) => p.product === 'Seat Cover' && p.zoneProjects.length >= 2,
);
assert.ok(seed);
const project = {
  ...seed,
  zoneProjects: seed.zoneProjects.map((z) => ({
    ...z,
    currentStage: 'Scan' as const,
  })),
};
function visit(patch: Partial<Visit> = {}): Visit {
  return {
    id: 'visit',
    vehicle: project.vehicle,
    projectGroupId: project.id,
    product: project.product,
    vehicleProjectIds: [project.zoneProjects[0].id],
    dealer: 'Dealer',
    date: '2026-09-08',
    time: '10:00',
    taskIds: [],
    kind: 'SCAN',
    status: 'COMPLETED',
    ...patch,
  };
}
test('partial scan stays waiting; next appointment must concern a remaining scan zone', () => {
  const row = huntRow(
    project,
    undefined,
    [
      visit(),
      visit({ id: 'wrong-kind', kind: 'FITTING', status: 'SCHEDULED' }),
      visit({ id: 'done-zone', status: 'SCHEDULED' }),
      visit({
        id: 'next',
        status: 'SCHEDULED',
        vehicleProjectIds: [project.zoneProjects[1].id],
      }),
    ],
    'SCAN',
  );
  assert.equal(row.done, false);
  assert.equal(row.completed.length, 1);
  assert.equal(row.remaining.length, project.zoneProjects.length - 1);
  assert.equal(row.scheduled?.id, 'next');
});
test('only all scanned zones move a project into completed', () => {
  const row = huntRow(
    project,
    undefined,
    [visit({ vehicleProjectIds: project.zoneProjects.map((z) => z.id) })],
    'SCAN',
  );
  assert.equal(row.done, true);
  assert.equal(row.completedDate, '2026-09-08');
});
test('stage-based completion does not fabricate a date, and car covers are excluded from scan', () => {
  const approved = {
    ...project,
    zoneProjects: project.zoneProjects.map((z) => ({
      ...z,
      currentStage: 'Approved' as const,
    })),
  };
  assert.equal(huntRow(approved, undefined, [], 'SCAN').completedDate, '');
  assert.equal(
    huntRow({ ...approved, product: 'Car Cover' }, undefined, [], 'SCAN')
      .eligible,
    false,
  );
  assert.equal(huntRow(approved, undefined, [], 'FITTING').done, true);
});
test('a fitting visit alone does not imply approved fitting', () => {
  const fitting = {
    ...project,
    zoneProjects: project.zoneProjects.map((z) => ({
      ...z,
      currentStage: 'Fitting' as const,
    })),
  };
  const row = huntRow(
    fitting,
    undefined,
    [
      visit({
        kind: 'FITTING',
        vehicleProjectIds: project.zoneProjects.map((z) => z.id),
      }),
    ],
    'FITTING',
  );
  assert.equal(row.eligible, true);
  assert.equal(row.done, false);
});
