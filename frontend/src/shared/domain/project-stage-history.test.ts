import assert from 'node:assert/strict';
import { test } from 'node:test';
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
