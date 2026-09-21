import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  VehicleProjectGroup,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import {
  elapsedDays,
  median,
  reportPeriod,
  summarizePerformance,
} from './performance-model';
import { reportDate } from './report-date';

const zone: VehicleZoneProject = {
  id: 'z1',
  projectGroupId: 'p1',
  productTypeId: 'PT-SC',
  vehicleResearchId: 'c1',
  zoneId: 'Z1',
  code: '1',
  label: 'Front',
  managerId: 'Demo',
  currentStage: 'Approved',
  productionHandoff: {
    completedAt: '2026-09-20T12:00:00Z',
    completedBy: 'Demo',
    reference: 'doc',
    evidenceKey: 'v1',
  },
  stageHistory: [
    {
      id: 's1',
      stage: 'Vehicle Hunt',
      stageSequence: 1,
      startedAt: '2026-09-01T12:00:00Z',
      completedAt: '2026-09-10T12:00:00Z',
    },
    {
      id: 's2',
      stage: 'Sample',
      stageSequence: 2,
      startedAt: '2026-09-10T12:00:00Z',
    },
  ],
};
const project: VehicleProjectGroup = {
  productTypeId: 'PT-SC',
  id: 'p1',
  vehicle: 'Test',
  vehicleResearchId: 'c1',
  options: [],
  product: 'Seat Cover',
  zoneProjects: [zone],
  stage: 'Approved',
  status: 'APPROVED',
  created: '2026-08-01',
};

await test('month, quarter and year periods have exclusive ends including year rollover', () => {
  assert.deepEqual(reportPeriod('2026-12', 'quarter'), {
    start: '2026-10-01',
    end: '2027-01-01',
  });
  assert.deepEqual(reportPeriod('2024-02', 'month'), {
    start: '2024-02-01',
    end: '2024-03-01',
  });
  assert.deepEqual(reportPeriod('2026-09', 'year'), {
    start: '2026-01-01',
    end: '2027-01-01',
  });
  assert.throws(() => reportPeriod('invalid', 'month'));
});
await test('missing dates never become zero and median does not mutate inputs', () => {
  const values = [30, 1, 10, 4];
  assert.equal(median(values), 7);
  assert.deepEqual(values, [30, 1, 10, 4]);
  assert.equal(median([]), undefined);
  assert.equal(elapsedDays(undefined, '2026-09-01'), undefined);
  assert.equal(elapsedDays('2026-09-02', '2026-09-01'), undefined);
});
await test('performance uses handoff dates and counts only completed stage records', () => {
  const result = summarizePerformance([project], '2026-09-01', '2026-10-01');
  assert.equal(result.completed, 1);
  assert.equal(result.cycleMedian, 19);
  assert.equal(result.cycleSamples, 1);
  assert.deepEqual(result.stages, [
    { stage: 'Vehicle Hunt', days: 9, count: 1 },
  ]);
});
await test('approved labels, cancelled zones and missing timestamps cannot inflate measured completions', () => {
  const rows = {
    ...project,
    zoneProjects: [
      { ...zone, id: '1', productionHandoff: undefined },
      { ...zone, id: '2', status: 'CANCELLED' as const },
      { ...zone, id: '3', stageHistory: undefined },
    ],
  };
  const result = summarizePerformance([rows], '2026-09-01', '2026-10-01');
  assert.equal(result.completed, 1);
  assert.equal(result.cycleSamples, 0);
  assert.equal(result.cycleMedian, undefined);
});
await test('Los Angeles date boundaries are respected in both summer and winter', () => {
  assert.equal(reportDate('2026-10-01T02:00:00Z'), '2026-09-30');
  assert.equal(reportDate('2026-01-01T07:00:00Z'), '2025-12-31');
  assert.equal(reportDate('2026-09-30'), '2026-09-30');
  assert.equal(reportDate('invalid'), undefined);
});
