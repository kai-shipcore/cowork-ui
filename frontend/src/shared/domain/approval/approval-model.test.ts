import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ApprovalAssignment,
  ApprovalGrant,
  ApprovalRequest,
  ApprovalStep,
} from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';
import {
  describeDecisionEffect,
  describeStep,
  grantedUsers,
  newRouteStep,
  pendingTasksFor,
  requestProgress,
  routePresets,
  validateRoute,
} from './approval-model';

const TYPE = 'VEHICLE_PRODUCT_REGISTRATION';

function user(
  id: string,
  name: string,
  status: AppUser['status'] = 'ACTIVE',
): AppUser {
  return {
    id,
    email: `${id}@x.test`,
    name,
    status,
    createdAt: '',
    updatedAt: '',
  };
}
const USERS = [
  user('alice', 'Alice'),
  user('bob', 'Bob'),
  user('carol', 'Carol'),
  user('dave', 'Dave'),
  user('eve', 'Eve', 'INACTIVE'),
];
function grant(
  appUserId: string,
  canForward: boolean,
  canFinalApprove: boolean,
): ApprovalGrant {
  return {
    id: `g-${appUserId}`,
    appUserId,
    approvalTypeId: TYPE,
    canForward,
    canFinalApprove,
    status: 'ACTIVE',
  };
}
const GRANTS = [
  grant('alice', true, false),
  grant('bob', true, false),
  grant('carol', false, true),
  grant('dave', true, true),
  grant('eve', true, true),
];

await test('granted users follow the step action and skip inactive people', () => {
  assert.deepEqual(
    grantedUsers(USERS, GRANTS, TYPE, 'FORWARD').map((u) => u.id),
    ['alice', 'bob', 'dave'],
  );
  assert.deepEqual(
    grantedUsers(USERS, GRANTS, TYPE, 'FINAL').map((u) => u.id),
    ['carol', 'dave'],
  );
});

await test('presets follow the guide: quick, any final, review then sign-off', () => {
  const presets = routePresets(
    grantedUsers(USERS, GRANTS, TYPE, 'FORWARD'),
    grantedUsers(USERS, GRANTS, TYPE, 'FINAL'),
  );
  assert.deepEqual(
    presets[0]?.steps.map((s) => [s.type, s.completionRule, [...s.userIds]]),
    [['FINAL', 'ALL', ['carol']]],
  );
  assert.deepEqual(
    presets[1]?.steps.map((s) => [s.type, s.completionRule, [...s.userIds]]),
    [['FINAL', 'ANY', ['carol', 'dave']]],
  );
  assert.deepEqual(
    presets[2]?.steps.map((s) => [s.type, s.completionRule, [...s.userIds]]),
    [
      ['FORWARD', 'ALL', ['alice', 'bob']],
      ['FINAL', 'ANY', ['carol', 'dave']],
    ],
  );
});

await test('route validation explains the missing piece', () => {
  assert.match(
    validateRoute([newRouteStep('FORWARD', ['alice'])], USERS, GRANTS, TYPE) ??
      '',
    /final approval step/,
  );
  assert.match(
    validateRoute([newRouteStep('FINAL', [])], USERS, GRANTS, TYPE) ?? '',
    /at least one person/,
  );
  assert.match(
    validateRoute([newRouteStep('FINAL', ['alice'])], USERS, GRANTS, TYPE) ??
      '',
    /Alice cannot act/,
  );
  assert.equal(
    validateRoute(
      [
        newRouteStep('FORWARD', ['alice', 'bob']),
        newRouteStep('FINAL', ['carol'], 'ANY'),
      ],
      USERS,
      GRANTS,
      TYPE,
    ),
    undefined,
  );
});

await test('step descriptions read as sentences', () => {
  assert.equal(
    describeStep(
      { type: 'FINAL', completionRule: 'ANY', userIds: ['carol', 'dave'] },
      USERS,
    ),
    'Carol or Dave: the first decision settles this step.',
  );
  assert.equal(
    describeStep(
      { type: 'FORWARD', completionRule: 'ALL', userIds: ['alice', 'bob'] },
      USERS,
    ),
    'Alice and Bob must all approve.',
  );
});

const REQUEST: ApprovalRequest = {
  id: 'r1',
  approvalTypeId: TYPE,
  entityType: 'VEHICLE_PRODUCT_REGISTRATION',
  entityId: 'REG-1',
  requestedBy: 'alice',
  submittedData: { productIds: [], sourceShapeIds: [], snapshot: '' },
  status: 'PENDING',
  createdAt: '2026-09-20T10:00:00.000Z',
};
const STEPS: ApprovalStep[] = [
  {
    id: 's1',
    approvalRequestId: 'r1',
    stepNumber: 1,
    type: 'FORWARD',
    completionRule: 'ALL',
    status: 'PENDING',
  },
  {
    id: 's2',
    approvalRequestId: 'r1',
    stepNumber: 2,
    type: 'FINAL',
    completionRule: 'ANY',
    status: 'WAITING',
  },
];
const ASSIGNMENTS: ApprovalAssignment[] = [
  {
    id: 'a1',
    approvalRequestStepId: 's1',
    assignedTo: 'alice',
    status: 'APPROVED',
    decidedBy: 'alice',
    decidedAt: '2026-09-20T11:00:00.000Z',
  },
  {
    id: 'a2',
    approvalRequestStepId: 's1',
    assignedTo: 'bob',
    status: 'PENDING',
  },
  {
    id: 'a3',
    approvalRequestStepId: 's2',
    assignedTo: 'carol',
    status: 'PENDING',
  },
];

await test('progress names the current step and who it waits on', () => {
  assert.deepEqual(requestProgress(REQUEST, STEPS, ASSIGNMENTS, USERS), {
    label: 'Step 1 of 2 · Review',
    detail: 'Waiting on Bob',
  });
});

await test('the inbox lists only open assignments on the open step', () => {
  assert.deepEqual(
    pendingTasksFor('bob', [REQUEST], STEPS, ASSIGNMENTS).map(
      (t) => t.assignment.id,
    ),
    ['a2'],
  );
  assert.deepEqual(pendingTasksFor('carol', [REQUEST], STEPS, ASSIGNMENTS), []);
  const [task] = pendingTasksFor('bob', [REQUEST], STEPS, ASSIGNMENTS);
  assert.ok(task);
  assert.match(describeDecisionEffect(task), /last reviewer/);
});
