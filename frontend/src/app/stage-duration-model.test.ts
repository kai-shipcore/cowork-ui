import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PEOPLE } from '@/modules/operations/operations-model';
import {
  appendStageDurationRevision,
  durationStages,
  projectStagePlan,
  stageDurationSchema,
  stageTarget,
  suggestedStageDays,
  type StageDurationRevision,
} from './stage-duration-model';

const REVISION: StageDurationRevision = {
  id: 'r1',
  productTypeId: 'PT-SC',
  updatedAt: '2026-09-21T12:00:00Z',
  updatedBy: 'USR-KAI',
  note: 'Reviewed',
  stages: durationStages('Seat Cover').map((stage) => ({
    stage,
    targetDays: 5,
  })),
};

await test('project plans are independent copies and override standards for new stages', () => {
  const plan = projectStagePlan('Seat Cover', 'HIGH');
  assert.equal(plan.length, 6);
  plan[0].targetDays = 12;
  assert.notEqual(projectStagePlan('Seat Cover', 'HIGH')[0].targetDays, 12);
  assert.equal(
    stageTarget([], 'PT-SC', plan[0].stage, '2026-09-21', 'HIGH', plan)
      .targetDays,
    12,
  );
  assert.equal(
    stageTarget([REVISION], 'PT-SC', plan[0].stage, '2026-09-21', 'HIGH', plan)
      .targetDays,
    12,
  );
});

await test('priority standards select the matching days and preserve legacy standards', () => {
  const revision: StageDurationRevision = {
    ...REVISION,
    stages: REVISION.stages.map((stage) => ({
      ...stage,
      priorityDays: { URGENT: 2, HIGH: 3, NORMAL: 5, LOW: 8 },
    })),
  };
  for (const priority of ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const) {
    assert.equal(
      stageTarget([revision], 'PT-SC', 'Design', '2026-09-21', priority)
        .targetDays,
      revision.stages[0]?.priorityDays?.[priority],
    );
    assert.equal(
      stageTarget([REVISION], 'PT-SC', 'Design', '2026-09-21', priority)
        .targetDays,
      5,
    );
  }
  assert.equal(
    stageTarget([revision], 'PT-SC', 'Design', '2026-09-21', 'URGENT')
      .targetDueAt,
    '2026-09-23',
  );
  assert.equal(suggestedStageDays(7, 'URGENT'), 4);
  assert.equal(suggestedStageDays(7, 'HIGH'), 6);
  assert.equal(suggestedStageDays(7, 'NORMAL'), 7);
  assert.equal(suggestedStageDays(7, 'LOW'), 11);
  assert.equal(suggestedStageDays(1, 'URGENT'), 1);
  for (const invalid of [0, 366, 1.5]) {
    assert.equal(
      stageDurationSchema.safeParse([
        {
          ...revision,
          stages: revision.stages.map((stage) => ({
            ...stage,
            priorityDays: { ...stage.priorityDays, HIGH: invalid },
          })),
        },
      ]).success,
      false,
    );
  }
  assert.equal(
    stageDurationSchema.safeParse([
      {
        ...revision,
        stages: revision.stages.map((stage) => ({
          ...stage,
          priorityDays: { NORMAL: 5 },
        })),
      },
    ]).success,
    false,
  );
});

await test('only the R&D lead can append standards and stale changes cannot replace history', () => {
  const records = appendStageDurationRevision([], REVISION, PEOPLE[0]);
  assert.equal(records.length, 1);
  assert.throws(() =>
    appendStageDurationRevision(records, { ...REVISION, id: 'r2' }, PEOPLE[0]),
  );
  assert.equal(
    appendStageDurationRevision(
      records,
      { ...REVISION, id: 'r2' },
      PEOPLE[0],
      'r1',
    ).length,
    2,
  );
  assert.equal(records.length, 1);
  assert.throws(() =>
    appendStageDurationRevision(
      [],
      { ...REVISION, updatedBy: PEOPLE[1].id },
      PEOPLE[1],
    ),
  );
  assert.throws(() =>
    appendStageDurationRevision(
      [],
      { ...REVISION, updatedBy: PEOPLE[2].id },
      PEOPLE[2],
    ),
  );
});

await test('standards require all product stages once and integer days within bounds', () => {
  for (const targetDays of [0, -1, 1.5, 366])
    assert.equal(
      stageDurationSchema.safeParse([
        {
          ...REVISION,
          stages: REVISION.stages.map((stage) => ({ ...stage, targetDays })),
        },
      ]).success,
      false,
    );
  assert.equal(
    stageDurationSchema.safeParse([
      { ...REVISION, stages: REVISION.stages.slice(1) },
    ]).success,
    false,
  );
  assert.equal(
    stageDurationSchema.safeParse([{ ...REVISION, productTypeId: 'PT-CC' }])
      .success,
    false,
  );
  assert.equal(
    stageDurationSchema.safeParse([{ ...REVISION, note: ' ' }]).success,
    false,
  );
});

await test('deadlines snapshot the latest applicable template using LA calendar days across DST', () => {
  assert.deepEqual(
    stageTarget([REVISION], 'PT-SC', 'Design', '2026-09-21T02:00:00Z'),
    { targetDays: 5, targetDueAt: '2026-09-25', templateRevisionId: 'r1' },
  );
  assert.equal(
    stageTarget([REVISION], 'PT-SC', 'Design', '2026-03-07T20:00:00Z')
      .targetDueAt,
    '2026-03-12',
  );
  assert.equal(
    stageTarget([REVISION], 'PT-SC', 'Design', '2028-02-27').targetDueAt,
    '2028-03-03',
  );
  for (const stage of ['Approved', '3D Model'])
    assert.deepEqual(stageTarget([REVISION], 'PT-SC', stage, '2026-09-21'), {});
  assert.deepEqual(stageTarget([], 'PT-SC', 'Design', '2026-09-21'), {});
  assert.deepEqual(
    stageTarget([REVISION], 'PT-CC', 'Design', '2026-09-21'),
    {},
  );
  assert.deepEqual(stageTarget([REVISION], 'PT-SC', 'Design', 'invalid'), {});
});
