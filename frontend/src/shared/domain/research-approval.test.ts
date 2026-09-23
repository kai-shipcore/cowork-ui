import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkbenchState } from '@/app/workbench-store';
import {
  cancelResearchApproval,
  decideResearchApproval,
  RESEARCH_APPROVAL_TYPE,
  researchDisposition,
  submitResearchApproval,
} from './research-approval';

function fixture(): WorkbenchState {
  return {
    appUsers: ['u1', 'u2'].map((id) => ({ id, name: id, status: 'ACTIVE' })),
    approvalTypes: [
      {
        id: RESEARCH_APPROVAL_TYPE,
        code: 'RESEARCH_HANDOFF',
        name: 'Research → project handoff',
        status: 'ACTIVE',
      },
    ],
    approvalGrants: ['u1', 'u2'].map((id) => ({
      id,
      appUserId: id,
      approvalTypeId: RESEARCH_APPROVAL_TYPE,
      status: 'ACTIVE',
      canForward: true,
      canFinalApprove: true,
    })),
    approvalRequests: [],
    approvalSteps: [],
    approvalAssignments: [],
    configurations: [
      {
        id: 'c1',
        vehicle: '2023–2026 Toyota RAV4',
        vehicleClass: 'SUV',
        options: [['Powertrain', 'Hybrid']],
        researchStatus: 'COMPLETE',
        projectGroupIds: [],
      },
      {
        id: 'c2',
        vehicle: '2023–2026 Toyota RAV4',
        vehicleClass: 'SUV',
        options: [['Powertrain', 'Gas']],
        researchStatus: 'RESEARCHING',
        projectGroupIds: [],
      },
    ],
  } as unknown as WorkbenchState;
}
const C1 = { id: 'c1', projectGroupIds: [] as readonly string[] };
const route = [
  { type: 'FORWARD' as const, users: ['u2'] },
  {
    type: 'FINAL' as const,
    users: ['u1', 'u2'],
    completionRule: 'ANY' as const,
  },
];

await test('only complete research can ask for the handoff, once at a time', () => {
  assert.throws(
    () => submitResearchApproval(fixture(), 'c2', 'u1', route),
    /complete/,
  );
  const state = submitResearchApproval(fixture(), 'c1', 'u1', route, 'Go');
  assert.equal(researchDisposition(state.approvalRequests, C1), 'REVIEWING');
  assert.equal(state.approvalRequests[0]?.note, 'Go');
  assert.throws(
    () => submitResearchApproval(state, 'c1', 'u1', route),
    /already exists/,
  );
});

await test('final approval pushes the configuration; ANY cancels the other final task', () => {
  let state = submitResearchApproval(fixture(), 'c1', 'u1', route);
  const [review, finalA, finalB] = state.approvalAssignments;
  assert.ok(review);
  assert.ok(finalA);
  assert.ok(finalB);
  state = decideResearchApproval(state, review.id, 'u2', 'APPROVED', '');
  assert.equal(researchDisposition(state.approvalRequests, C1), 'REVIEWING');
  state = decideResearchApproval(
    state,
    finalA.id,
    'u1',
    'APPROVED',
    'Demand ok',
  );
  assert.equal(researchDisposition(state.approvalRequests, C1), 'PUSH');
  assert.equal(state.configurations[0]?.status, 'ACTIVE');
  assert.equal(
    state.approvalAssignments.find((row) => row.id === finalB.id)?.status,
    'CANCELLED',
  );
});

await test('a rejection holds the configuration and a cancel leaves it unasked', () => {
  let state = submitResearchApproval(fixture(), 'c1', 'u1', route);
  const first = state.approvalAssignments[0];
  assert.ok(first);
  state = decideResearchApproval(
    state,
    first.id,
    'u2',
    'REJECTED',
    'No demand',
  );
  assert.equal(researchDisposition(state.approvalRequests, C1), 'HOLD');
  assert.equal(state.configurations[0]?.status, 'ON_HOLD');

  let other = submitResearchApproval(fixture(), 'c1', 'u1', route);
  const requestId = other.approvalRequests[0]?.id ?? '';
  assert.throws(
    () => cancelResearchApproval(other, requestId, 'u2'),
    /requester/,
  );
  other = cancelResearchApproval(other, requestId, 'u1');
  assert.equal(researchDisposition(other.approvalRequests, C1), 'PENDING');
});

await test('a combination that already has a development project reads as pushed', () => {
  assert.equal(
    researchDisposition([], { id: 'c9', projectGroupIds: ['PG-1'] }),
    'PUSH',
  );
  assert.equal(researchDisposition([], C1), 'PENDING');
});
