import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  VehicleProjectGroup,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import {
  countProjectHealth,
  filterProjectsByHealth,
  parseHealthFilter,
  projectHealth,
} from './project-health';

const CURRENT_DATE = '2026-09-21';
const ZONE: VehicleZoneProject = {
  id: 'z1',
  projectGroupId: 'p1',
  productTypeId: 'PT-SC',
  vehicleResearchId: 'c1',
  zoneId: 'front',
  code: 'F',
  label: 'Front',
  managerId: '',
  currentStage: 'Design',
  targetAt: '2026-10-10',
  lastActivityAt: CURRENT_DATE,
};

await test('current stage deadline takes precedence while closed or different stages do not override project delivery', () => {
  const record = {
    id: 'stage1',
    stage: 'Design',
    stageSequence: 1,
    startedAt: '2026-09-01',
    targetDays: 5,
    targetDueAt: '2026-09-06',
  };
  assert.equal(
    projectHealth({ ...ZONE, stageHistory: [record] }, CURRENT_DATE).value,
    'late',
  );
  assert.equal(
    projectHealth(
      { ...ZONE, stageHistory: [{ ...record, completedAt: '2026-09-05' }] },
      CURRENT_DATE,
    ).value,
    'on-track',
  );
  assert.equal(
    projectHealth(
      { ...ZONE, stageHistory: [{ ...record, stage: 'Scan' }] },
      CURRENT_DATE,
    ).value,
    'on-track',
  );
});

await test('calendar-day target boundaries map to the four health colors', () => {
  for (const [targetAt, expected] of [
    ['2026-09-20', 'late'],
    ['2026-09-21', 'at-risk'],
    ['2026-09-23', 'at-risk'],
    ['2026-09-24', 'watch'],
    ['2026-09-28', 'watch'],
    ['2026-09-29', 'on-track'],
  ]) {
    assert.equal(
      projectHealth({ ...ZONE, targetAt }, CURRENT_DATE).value,
      expected,
    );
  }
});

await test('inactivity boundaries flag watch and at risk without manufacturing lateness', () => {
  for (const [lastActivityAt, expected] of [
    ['2026-09-15', 'on-track'],
    ['2026-09-14', 'watch'],
    ['2026-09-08', 'watch'],
    ['2026-09-07', 'at-risk'],
  ]) {
    assert.equal(
      projectHealth({ ...ZONE, lastActivityAt }, CURRENT_DATE).value,
      expected,
    );
  }
});

await test('severe risk wins over watch, while late wins over hold and inactivity', () => {
  assert.equal(
    projectHealth({ ...ZONE, status: 'ON_HOLD' }, CURRENT_DATE).value,
    'at-risk',
  );
  assert.equal(
    projectHealth(
      { ...ZONE, targetAt: '2026-09-25', lastActivityAt: '2026-09-01' },
      CURRENT_DATE,
    ).value,
    'at-risk',
  );
  assert.equal(
    projectHealth(
      { ...ZONE, targetAt: '2026-09-01', status: 'ON_HOLD' },
      CURRENT_DATE,
    ).value,
    'late',
  );
});

await test('complete, cancelled and merged projects never become late', () => {
  const lateZone = { ...ZONE, targetAt: '2026-01-01' };
  assert.equal(
    projectHealth({ ...lateZone, currentStage: 'Approved' }, CURRENT_DATE)
      .value,
    'complete',
  );
  for (const status of ['CANCELLED', 'MERGED'] as const) {
    assert.equal(
      projectHealth({ ...lateZone, status }, CURRENT_DATE).value,
      'inactive',
    );
  }
});

await test('missing, malformed and future activity records do not imply on track', () => {
  for (const zone of [
    { ...ZONE, targetAt: undefined },
    { ...ZONE, targetAt: 'bad date' },
    { ...ZONE, targetAt: '2026-02-30' },
    { ...ZONE, lastActivityAt: undefined },
    { ...ZONE, lastActivityAt: '2026-09-22' },
  ]) {
    assert.equal(projectHealth(zone, CURRENT_DATE).value, 'unknown');
  }
  assert.equal(projectHealth(ZONE, 'invalid').value, 'unknown');
  assert.equal(
    projectHealth(
      { ...ZONE, lastActivityAt: undefined, targetAt: '2026-09-20' },
      CURRENT_DATE,
    ).value,
    'late',
  );
});

await test('timestamp targets use LA day and DST boundaries count calendar days', () => {
  assert.equal(
    projectHealth({ ...ZONE, targetAt: '2026-09-21T02:00:00Z' }, CURRENT_DATE)
      .value,
    'late',
  );
  assert.equal(
    projectHealth(
      { ...ZONE, targetAt: '2026-03-10', lastActivityAt: '2026-03-08' },
      '2026-03-08',
    ).value,
    'at-risk',
  );
});

await test('health counts and filters use individual zones and never mutate project groups', () => {
  const project: VehicleProjectGroup = {
    id: 'p1',
    productTypeId: 'PT-SC',
    vehicle: 'Test vehicle',
    vehicleResearchId: 'c1',
    options: [],
    product: 'Seat Cover',
    stage: 'Design',
    status: 'IN PROGRESS',
    created: CURRENT_DATE,
    zoneProjects: [ZONE, { ...ZONE, id: 'z2', targetAt: '2026-09-20' }],
  };
  const counts = countProjectHealth([project], CURRENT_DATE);
  assert.equal(counts.all, 2);
  assert.equal(counts['on-track'], 1);
  assert.equal(counts.late, 1);
  const filtered = filterProjectsByHealth([project], 'late', CURRENT_DATE);
  assert.deepEqual(
    filtered[0]?.zoneProjects.map((zone) => zone.id),
    ['z2'],
  );
  assert.equal(project.zoneProjects.length, 2);
  assert.deepEqual(
    filterProjectsByHealth([project], 'watch', CURRENT_DATE),
    [],
  );
  assert.equal(
    filterProjectsByHealth([project], 'all', CURRENT_DATE)[0]?.zoneProjects
      .length,
    2,
  );
  assert.equal(parseHealthFilter('late'), 'late');
  assert.equal(parseHealthFilter('unexpected'), 'all');
  assert.equal(parseHealthFilter(null), 'all');
});
