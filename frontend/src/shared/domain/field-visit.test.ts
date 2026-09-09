import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectTask } from '../types/workbench';
import { createProjectVisit, migrateVisitStaff } from './field-visit';

test('a visit schedules projects directly without tasks and survives serialization', () => {
  const visit = createProjectVisit({
    type: 'SCAN',
    dealer: 'Galpin Ford',
    date: '2026-09-15',
    time: '10:30',
    vehicleProjectIds: ['VP-F', 'VP-B', 'VP-F'],
    staffIds: ['USR-KAI', 'USR-KAI'],
    locationType: 'DEALERSHIP',
    priority: 'URGENT',
    targetVehicleResearchId: 'VR-1',
    note: 'Bring scanner',
  });
  const saved = JSON.parse(JSON.stringify(visit));
  assert.equal(saved.status, 'SCHEDULED');
  assert.equal(saved.taskIds, undefined);
  assert.deepEqual(saved.staffIds, ['USR-KAI']);
  assert.deepEqual(saved.vehicleProjectIds, ['VP-F', 'VP-B']);
  assert.equal(saved.projectLinks.length, 2);
  assert.ok(
    saved.projectLinks.every(
      (link: {
        fieldVisitId: string;
        type: string;
        targetVehicleResearchId: string;
      }) =>
        link.fieldVisitId === saved.id &&
        link.type === 'SCAN' &&
        link.targetVehicleResearchId === 'VR-1',
    ),
  );
  assert.equal(
    new Date(saved.scheduledAt).getTime(),
    new Date('2026-09-15T10:30').getTime(),
  );
  assert.equal(saved.note, 'Bring scanner');
});

test('migrates legacy visit staff once and respects an explicitly empty staff list', () => {
  const tasks: ProjectTask[] = [
    {
      id: 'TSK-1',
      type: 'SCAN',
      title: 'Scan',
      vehicleProjectId: 'VP-F',
      assignedTo: 'USR-YOUNG',
      requestedBy: 'USR-KAI',
      created: '2026-08-01',
      status: 'OPEN',
    },
  ];
  assert.deepEqual(migrateVisitStaff({ taskIds: ['TSK-1'] }, tasks), [
    'USR-YOUNG',
  ]);
  assert.deepEqual(migrateVisitStaff({ taskIds: ['missing'] }, tasks), []);
  assert.deepEqual(
    migrateVisitStaff({ taskIds: ['TSK-1'], staffIds: [] }, tasks),
    [],
  );
});

test('fitting visits keep their project association and do not invent a result', () => {
  const visit = createProjectVisit({
    type: 'FITTING',
    dealer: 'Office',
    date: '2026-09-15',
    time: '11:00',
    vehicleProjectIds: ['VP-F'],
    staffIds: [],
    locationType: 'OFFICE',
  });
  assert.equal(visit.projectLinks?.[0]?.type, 'FITTING');
  assert.equal(visit.projectLinks?.[0]?.result, undefined);
  assert.equal(visit.performedAt, undefined);
});
