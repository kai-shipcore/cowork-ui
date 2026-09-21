import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleProjectGroup } from '@/shared/types/workbench';
import {
  completionPace,
  deviationBand,
  percentOff,
  periodLabel,
  periodSeries,
  periodTitle,
  shiftMonth,
  stageStrip,
  weeksLeft,
  worstStages,
} from './performance-tiles';

await test('deviation bands step at the goal, 10% and 25%', () => {
  assert.equal(deviationBand(90, 100), 'ok');
  assert.equal(deviationBand(100, 100), 'ok');
  assert.equal(deviationBand(110, 100), 'warn');
  assert.equal(deviationBand(125, 100), 'high');
  assert.equal(deviationBand(126, 100), 'critical');
  assert.equal(deviationBand(undefined, 100), 'none');
  assert.equal(deviationBand(50, undefined), 'none');
});

await test('period series walks back across year boundaries, oldest first', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-11', 2), '2027-01');
  const quarters = periodSeries('2026-02', 'quarter', 3);
  assert.deepEqual(
    quarters.map((period) => period.start),
    ['2025-07-01', '2025-10-01', '2026-01-01'],
  );
  assert.equal(quarters[2]?.end, '2026-04-01');
});

const project: VehicleProjectGroup = {
  productTypeId: 'PT-SC',
  id: 'p1',
  vehicle: 'Test',
  vehicleResearchId: 'c1',
  options: [],
  product: 'Seat Cover',
  stage: 'Sample',
  status: 'IN PROGRESS',
  created: '2026-08-01',
  zoneProjects: [
    {
      id: 'z1',
      projectGroupId: 'p1',
      productTypeId: 'PT-SC',
      vehicleResearchId: 'c1',
      zoneId: 'Z1',
      code: '1',
      label: 'Front',
      managerId: 'Demo',
      currentStage: 'Sample',
      stageHistory: [
        {
          id: 's1',
          stage: 'Scan',
          stageSequence: 1,
          startedAt: '2026-09-01',
          completedAt: '2026-09-04',
          targetDays: 2,
        },
        {
          id: 's2',
          stage: 'Design',
          stageSequence: 2,
          startedAt: '2026-09-04',
          completedAt: '2026-09-08',
        },
      ],
    },
  ],
};

await test('stage strip scores each record against its own goal and skips unscored ones', () => {
  const strip = stageStrip(
    [project],
    '2026-09-01',
    '2026-10-01',
    [],
    ['Scan', 'Design', 'Sample'],
  );
  assert.deepEqual(strip[0], {
    stage: 'Scan',
    days: 3,
    count: 1,
    band: 'critical',
    goalDays: 2,
    overDays: 1,
  });
  assert.equal(strip[1]?.days, 4);
  assert.equal(strip[1]?.band, 'none');
  assert.equal(strip[2]?.count, 0);
  assert.deepEqual(
    worstStages(strip, 2).map((item) => item.stage),
    ['Scan'],
  );
});

await test('completion pace prorates the goal by elapsed time', () => {
  const start = '2026-07-01';
  const end = '2026-10-01';
  assert.equal(completionPace(3, undefined, start, end, '2026-08-01'), 'none');
  assert.equal(completionPace(5, 12, start, end, '2026-08-01'), 'ok');
  assert.equal(completionPace(4, 12, start, end, '2026-08-01'), 'warn');
  assert.equal(completionPace(0, 12, start, end, '2026-08-01'), 'critical');
  assert.equal(completionPace(9, 12, start, end, '2026-11-01'), 'critical');
  assert.equal(completionPace(12, 12, start, end, '2026-06-01'), 'ok');
  assert.equal(weeksLeft(end, '2026-08-27'), 5);
  assert.equal(weeksLeft(end, '2026-10-05'), 0);
});

await test('period labels and titles follow the mode and today', () => {
  assert.equal(periodLabel('2025-04-01', 'quarter'), "Q2'25");
  assert.equal(periodLabel('2026-09-01', 'month'), "Sep'26");
  assert.equal(periodLabel('2026-01-01', 'year'), '2026');
  const q3 = { start: '2026-07-01', end: '2026-10-01' };
  assert.equal(
    periodTitle(q3, 'quarter', '2026-09-21'),
    'Q3 2026, quarter to date',
  );
  assert.equal(
    periodTitle(q3, 'quarter', '2026-10-01'),
    'Q3 2026, full quarter',
  );
  assert.equal(
    periodTitle(q3, 'quarter', '2026-06-30'),
    'Q3 2026, not started',
  );
  assert.equal(
    periodTitle(
      { start: '2026-09-01', end: '2026-10-01' },
      'month',
      '2026-09-21',
    ),
    'September 2026, month to date',
  );
  assert.equal(percentOff(118, 94), 26);
  assert.equal(percentOff(9, 12), -25);
});
