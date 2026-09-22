import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  durationStages,
  type StageDurationRevision,
} from '@/app/stage-duration-model';
import type { ProjectDetailSnapshot } from '../types/workbench';
import { recordStageTransitions } from './project-stage-history';

void test('stage transitions append, close previous stage, and do not invent legacy starts or erase history on stale saves', () => {
  const initial: ProjectDetailSnapshot = {
    stage: 'Sample',
    tasks: [],
    visits: [],
    designs: [],
    samples: [],
    assets: [],
    activity: [],
    zones: [
      {
        id: 'z',
        currentStage: 'Sample',
        projectGroupId: 'p',
        productTypeId: 'PT-CC',
        vehicleResearchId: 'r',
        zoneId: 'ex',
        code: 'EX',
        label: 'Exterior',
        managerId: 'u',
        scanned: false,
      },
    ],
  };
  assert.deepEqual(
    recordStageTransitions(undefined, initial, 'u').zones[0].stageHistory,
    [],
  );
  const next = {
    ...initial,
    zones: [{ ...initial.zones[0], currentStage: 'Fitting' as const }],
  };
  const fitting = recordStageTransitions(initial, next, 'u', '2026-01-01');
  assert.equal(fitting.zones[0].stageHistory?.[0].stageSequence, 1);
  assert.equal(
    recordStageTransitions(fitting, next, 'u').zones[0].stageHistory?.length,
    1,
  );
  const approved = recordStageTransitions(
    fitting,
    { ...next, zones: [{ ...next.zones[0], currentStage: 'Approved' }] },
    'u',
    '2026-01-02',
  );
  assert.equal(approved.zones[0].stageHistory?.[0].completedAt, '2026-01-02');
  assert.equal(approved.zones[0].stageHistory[1].stageSequence, 2);
});

await test('new stages freeze template duration and later saves or template revisions preserve current deadlines', () => {
  const standard: StageDurationRevision = {
    id: 'standard-1',
    productTypeId: 'PT-CC',
    updatedAt: '2026-09-21T12:00:00Z',
    updatedBy: 'USR-KAI',
    note: 'Reviewed',
    stages: durationStages('Car Cover').map((stage) => ({
      stage,
      targetDays: 5,
    })),
  };
  const original: ProjectDetailSnapshot = {
    stage: 'Design',
    tasks: [],
    visits: [],
    designs: [],
    samples: [],
    assets: [],
    activity: [],
    zones: [
      {
        id: 'z',
        currentStage: 'Design',
        projectGroupId: 'p',
        productTypeId: 'PT-CC',
        vehicleResearchId: 'r',
        zoneId: 'ex',
        code: 'EX',
        label: 'Exterior',
        managerId: 'u',
        scanned: false,
        targetAt: '2026-12-31',
      },
    ],
  };
  const next = {
    ...original,
    zones: [{ ...original.zones[0], currentStage: 'Sample' as const }],
  };
  const sample = recordStageTransitions(
    original,
    next,
    'u',
    '2026-09-21T20:00:00Z',
    [standard],
  );
  assert.equal(sample.zones[0].stageHistory?.[0].targetDays, 5);
  assert.equal(sample.zones[0].stageHistory[0].targetDueAt, '2026-09-26');
  assert.equal(sample.zones[0].targetAt, '2026-12-31');
  const changed = {
    ...standard,
    id: 'standard-2',
    stages: standard.stages.map((entry) => ({ ...entry, targetDays: 10 })),
  };
  const unchanged = recordStageTransitions(
    sample,
    next,
    'u',
    '2026-09-23T20:00:00Z',
    [changed],
  );
  assert.deepEqual(
    unchanged.zones[0].stageHistory,
    sample.zones[0].stageHistory,
  );
  const fitting = recordStageTransitions(
    unchanged,
    { ...next, zones: [{ ...next.zones[0], currentStage: 'Fitting' }] },
    'u',
    '2026-09-24T20:00:00Z',
    [changed],
  );
  assert.equal(fitting.zones[0].stageHistory?.[1].targetDays, 10);
  assert.equal(fitting.zones[0].stageHistory[1].targetDueAt, '2026-10-04');
  assert.equal(fitting.zones[0].stageHistory[0].targetDueAt, '2026-09-26');
  const planned = recordStageTransitions(
    sample,
    {
      ...next,
      zones: [
        {
          ...next.zones[0],
          currentStage: 'Fitting',
          stageTargetDays: [{ stage: 'Fitting', targetDays: 3 }],
        },
      ],
    },
    'u',
    '2026-09-24T20:00:00Z',
    [changed],
  );
  assert.equal(planned.zones[0].stageHistory?.[1].targetDays, 3);
  assert.equal(planned.zones[0].stageHistory[1].targetDueAt, '2026-09-27');
  assert.equal(planned.zones[0].stageHistory[0].targetDueAt, '2026-09-26');
});
