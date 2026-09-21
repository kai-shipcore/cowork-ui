import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleProjectGroup } from '@/shared/types/workbench';
import {
  intakeSchema,
  intakesSchema,
  linkedIntakeProjects,
  parseIntakeStatusFilter,
  reviewIntake,
  type DevelopmentIntake,
} from './intake-model';
import { readRdRecords, writeRdRecords } from './rd-record-storage';

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
  status: 'Awaiting review',
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
    status: 'Development approved' as const,
    priority: 'HIGH' as const,
    reason: 'Strong demand',
  };
  const approved = reviewIntake(draft, review);
  assert.equal(approved.priority, 'HIGH');
  assert.equal(approved.status, 'Development approved');
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

await test('legacy saved requests normalize statuses without translating user evidence or history', () => {
  const evidence = '고객이 직접 입력한 수요 근거';
  const reason = '검토자가 작성한 원문';
  const original = JSON.stringify([
    {
      ...draft,
      evidence,
      source: '컴플레인',
      status: '개발 승인',
      reviews: [
        {
          at: draft.createdAt,
          actor: '사용자',
          status: '검토 대기',
          priority: 'NORMAL',
          reason,
        },
      ],
    },
  ]);
  let stored = original;
  const storage = {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  };
  const records = readRdRecords(storage, 'test', intakesSchema, []);
  assert.equal(stored, original);
  assert.equal(records[0].status, 'Development approved');
  assert.equal(records[0].source, 'Complaint');
  assert.equal(records[0].evidence, evidence);
  assert.equal(records[0].reviews[0].status, 'Awaiting review');
  assert.equal(records[0].reviews[0].reason, reason);
  const saved = writeRdRecords(storage, {
    key: 'test',
    schema: intakesSchema,
    defaults: [],
    update: (current) => current,
  });
  assert.deepEqual(saved, records);
  assert.deepEqual(readRdRecords(storage, 'test', intakesSchema, []), records);
});

await test('legacy request statuses, sources and bookmarked filters remain supported', () => {
  for (const [legacy, current] of [
    ['검토 대기', 'Awaiting review'],
    ['개발 승인', 'Development approved'],
    ['보류', 'On hold'],
    ['반려', 'Rejected'],
  ]) {
    assert.equal(
      intakeSchema.parse({ ...draft, status: legacy }).status,
      current,
    );
    assert.equal(parseIntakeStatusFilter(legacy), current);
    assert.equal(parseIntakeStatusFilter(current), current);
  }
  assert.equal(
    intakeSchema.parse({ ...draft, source: '신차 출시' }).source,
    'Vehicle launch',
  );
  for (const value of [null, '전체', 'All', 'unknown'])
    assert.equal(parseIntakeStatusFilter(value), 'All');
  assert.equal(
    intakeSchema.safeParse({ ...draft, status: 'unknown' }).success,
    false,
  );
});
