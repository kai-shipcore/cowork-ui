import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyRequestAction,
  createRequest,
  requestDraftSchema,
  snapshotSchema,
  teamFromLocation,
  teamHome,
  type RequestDraft,
} from './operations-model';
import { createOperationsSeed } from './operations-seed';

const at = '2026-09-19T00:00:00.000Z';
const draft: RequestDraft = {
  title: '핏 불만 조사',
  description: '반복 불만 조사 후 결과 times신',
  sourceTeam: 'customer-services',
  targetTeam: 'rd',
  assigneeId: 'rd-member',
  reviewerId: 'USR-KAI',
  priority: 'high',
  dueDate: '2026-09-21',
  category: 'Quality investigation',
  reference: 'CS-001',
  referencePath: '',
};
function request() {
  return createRequest(draft, 'cs-member', 'REQ-1', at);
}

await test('requester must belong to the originating team; reviewer must be a different target-team lead', () => {
  assert.throws(() => createRequest(draft, 'rd-member', 'REQ-1', at));
  assert.equal(
    requestDraftSchema.safeParse({ ...draft, reviewerId: 'rd-member' }).success,
    false,
  );
  assert.equal(
    requestDraftSchema.safeParse({ ...draft, assigneeId: 'cs-member' }).success,
    false,
  );
  assert.equal(
    requestDraftSchema.safeParse({ ...draft, dueDate: '2026-02-30' }).success,
    false,
  );
});

await test('only assignee can accept; callers cannot skip to completion', () => {
  const original = request();
  assert.throws(() =>
    applyRequestAction(
      original,
      { kind: 'status', status: 'active', note: 'Submit' },
      'cs-member',
      0,
      at,
      'ev1',
    ),
  );
  assert.throws(() =>
    applyRequestAction(
      original,
      { kind: 'status', status: 'done', note: 'Completed' },
      'USR-KAI',
      0,
      at,
      'ev1',
    ),
  );
  const updated = applyRequestAction(
    original,
    { kind: 'status', status: 'active', note: 'Submit' },
    'rd-member',
    0,
    at,
    'ev1',
  );
  assert.equal(updated.status, 'active');
  assert.equal(original.status, 'submitted');
  assert.equal(updated.events[1]?.from, 'submitted');
});

await test('review requires evidence and completion is restricted to nominated reviewer', () => {
  let current = applyRequestAction(
    request(),
    { kind: 'status', status: 'active', note: '조사 Start' },
    'rd-member',
    0,
    at,
    'ev1',
  );
  assert.throws(() =>
    applyRequestAction(
      current,
      { kind: 'status', status: 'review', note: 'Review Requests' },
      'rd-member',
      1,
      at,
      'ev2',
    ),
  );
  current = applyRequestAction(
    current,
    { kind: 'document', name: '보고서', url: 'https://example.com/report' },
    'rd-member',
    1,
    at,
    'ev2',
  );
  current = applyRequestAction(
    current,
    { kind: 'status', status: 'review', note: '증빙 Confirm Requests' },
    'rd-member',
    2,
    at,
    'ev3',
  );
  assert.throws(() =>
    applyRequestAction(
      current,
      { kind: 'status', status: 'done', note: '내가 Approve' },
      'rd-member',
      3,
      at,
      'ev4',
    ),
  );
  assert.throws(() =>
    applyRequestAction(
      current,
      { kind: 'document', name: '보고서', url: 'https://example.com/changed' },
      'rd-member',
      3,
      at,
      'ev4',
    ),
  );
  const done = applyRequestAction(
    current,
    { kind: 'status', status: 'done', note: 'items선 결과 Confirm' },
    'USR-KAI',
    3,
    at,
    'ev4',
  );
  assert.equal(done.status, 'done');
  assert.equal(done.documents[0]?.approvedAt, at);
  assert.ok(done.events[4]?.mentions.includes('cs-member'));
});

await test('rejecting requires a reason, preserves evidence, and allows resubmission after work', () => {
  const current = { ...request(), status: 'review' as const };
  assert.throws(() =>
    applyRequestAction(
      current,
      { kind: 'status', status: 'rejected', note: '  ' },
      'USR-KAI',
      0,
      at,
      'ev1',
    ),
  );
  const rejected = applyRequestAction(
    current,
    { kind: 'status', status: 'rejected', note: 'Round량 정보 보완 필요' },
    'USR-KAI',
    0,
    at,
    'ev1',
  );
  assert.equal(rejected.status, 'rejected');
  assert.throws(() =>
    applyRequestAction(
      rejected,
      { kind: 'status', status: 'review', note: '즉시 Requests' },
      'rd-member',
      1,
      at,
      'ev2',
    ),
  );
  assert.equal(
    applyRequestAction(
      rejected,
      { kind: 'status', status: 'active', note: '보완 Start' },
      'rd-member',
      1,
      at,
      'ev2',
    ).status,
    'active',
  );
  assert.equal(current.events.length, 1);
});

await test('stale revisions are rejected and document versions preserve previous URLs', () => {
  const original = request();
  const first = applyRequestAction(
    original,
    { kind: 'document', name: '보고서', url: 'https://example.com/v1' },
    'rd-member',
    0,
    at,
    'ev1',
  );
  assert.throws(() =>
    applyRequestAction(
      first,
      { kind: 'comment', note: '충돌', mentions: [] },
      'cs-member',
      0,
      at,
      'ev2',
    ),
  );
  const second = applyRequestAction(
    first,
    { kind: 'document', name: '보고서', url: 'https://example.com/v2' },
    'rd-member',
    1,
    at,
    'ev2',
  );
  assert.deepEqual(
    second.documents.map((doc) => doc.version),
    [1, 2],
  );
  assert.equal(second.documents[0]?.url, 'https://example.com/v1');
});

await test('unsafe document URLs, unknown mentions and corrupt backups are rejected', () => {
  assert.throws(() =>
    applyRequestAction(
      request(),
      { kind: 'document', name: '자료', url: 'javascript:alert(1)' },
      'rd-member',
      0,
      at,
      'ev1',
    ),
  );
  assert.throws(() =>
    applyRequestAction(
      request(),
      { kind: 'comment', note: 'Confirm Requests', mentions: ['unknown-user'] },
      'cs-member',
      0,
      at,
      'ev1',
    ),
  );
  const seed = createOperationsSeed();
  assert.equal(snapshotSchema.safeParse(seed).success, true);
  assert.equal(
    snapshotSchema.safeParse({ ...seed, requests: [request(), request()] })
      .success,
    false,
  );
  assert.equal(snapshotSchema.safeParse({ schemaVersion: 2 }).success, false);
});

await test('completion approves only the latest version of each document', () => {
  let current = request();
  for (const version of [1, 2]) {
    current = applyRequestAction(
      current,
      {
        kind: 'document',
        name: 'Report',
        url: 'https://example.com/v' + String(version),
      },
      'rd-member',
      current.revision,
      at,
      'doc' + String(version),
    );
  }
  current = applyRequestAction(
    current,
    { kind: 'status', status: 'active', note: 'Accepted' },
    'rd-member',
    current.revision,
    at,
    'accept',
  );
  current = applyRequestAction(
    current,
    { kind: 'status', status: 'review', note: 'Review latest evidence' },
    'rd-member',
    current.revision,
    at,
    'review',
  );
  const done = applyRequestAction(
    current,
    { kind: 'status', status: 'done', note: 'Verified' },
    'USR-KAI',
    current.revision,
    at,
    'done',
  );
  assert.equal(done.documents[0]?.approvedAt, undefined);
  assert.equal(done.documents[1]?.approvedAt, at);
  assert.equal(current.documents[1]?.approvedAt, undefined);
});

await test('team URLs retain context on refresh and task links while R&D tool links use R&D', () => {
  assert.equal(teamFromLocation('/dashboard/ecommerce', ''), 'ecommerce');
  assert.equal(
    teamFromLocation('/work/tasks', '?team=demand-planning'),
    'demand-planning',
  );
  assert.equal(teamFromLocation('/vehicle-projects', '?project=PG-1'), 'rd');
  assert.equal(teamFromLocation('/dashboard/invalid', ''), 'rd');
  assert.equal(teamHome('rd'), '/dashboard');
});
