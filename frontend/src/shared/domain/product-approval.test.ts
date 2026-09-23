import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkbenchState } from '@/app/workbench-store';
import {
  decideProductApproval,
  PRODUCT_APPROVAL_TYPE,
  submitProductApproval,
} from './product-approval';

function fixture(): WorkbenchState {
  return {
    appUsers: ['u1', 'u2'].map((id) => ({ id, name: id, status: 'ACTIVE' })),
    approvalGrants: ['u1', 'u2'].map((id) => ({
      id,
      appUserId: id,
      approvalTypeId: PRODUCT_APPROVAL_TYPE,
      status: 'ACTIVE',
      canForward: true,
      canFinalApprove: true,
    })),
    approvalTypes: [
      {
        id: PRODUCT_APPROVAL_TYPE,
        code: 'REGISTRATION',
        name: 'SKU registration',
        status: 'ACTIVE',
      },
    ],
    approvalRequests: [],
    approvalSteps: [],
    approvalAssignments: [],
    registrations: [{ id: 'r', requestedBy: 'u1', requestedAt: '2026-01-01' }],
    registrationItems: [
      {
        id: 'i',
        registrationId: 'r',
        masterProductId: 'p',
        vehicleProjectIds: [],
        sourceShapeIds: ['s'],
      },
    ],
    masterProducts: [
      {
        id: 'p',
        productTypeId: 'PT-CC',
        sku: 'SKU',
        status: 'DRAFT',
        productMaterialId: 'm',
        productColorId: 'c',
        exteriorShapeId: 's',
        fNumber: 'F1',
      },
    ],
    masterProductSkus: [],
    uniqueVehicles: [{ fNumber: 'F1', skuStatus: 'REQUESTED' }],
    productMaterials: [{ id: 'm', productTypeId: 'PT-CC' }],
    productColors: [{ id: 'c', productTypeId: 'PT-CC' }],
    vehicleProductShapes: [
      { id: 's', productTypeId: 'PT-CC', status: 'ACTIVE' },
    ],
  } as unknown as WorkbenchState;
}
const route = [
  { type: 'FORWARD' as const, users: ['u1', 'u2'] },
  { type: 'FINAL' as const, users: ['u1'] },
];
void test('all forward assignees must approve before final; final atomically activates products and opens one SKU', () => {
  let state = submitProductApproval(fixture(), 'r', 'u1', route);
  const [a, b, c] = state.approvalAssignments;
  assert.throws(
    () => decideProductApproval(state, c.id, 'u1', 'APPROVED', ''),
    /(?:current|active)/,
  );
  state = decideProductApproval(state, a.id, 'u1', 'APPROVED', '');
  assert.equal(state.approvalSteps[1].status, 'WAITING');
  state = decideProductApproval(state, b.id, 'u2', 'APPROVED', '');
  assert.equal(state.approvalSteps[1].status, 'PENDING');
  assert.equal(state.masterProducts[0].status, 'DRAFT');
  state = decideProductApproval(state, c.id, 'u1', 'APPROVED', '');
  assert.equal(state.approvalRequests[0].status, 'APPROVED');
  assert.equal(state.masterProducts[0].status, 'ACTIVE');
  assert.equal(state.masterProductSkus.length, 1);
  assert.throws(
    () => decideProductApproval(state, c.id, 'u1', 'APPROVED', ''),
    /(?:current|active)/,
  );
});
void test('other users, revoked grants, missing final route and duplicate requests cannot approve', () => {
  let state = submitProductApproval(fixture(), 'r', 'u1', route);
  assert.throws(
    () =>
      decideProductApproval(
        state,
        state.approvalAssignments[0].id,
        'u2',
        'APPROVED',
        '',
      ),
    /permissions/,
  );
  assert.throws(
    () => submitProductApproval(state, 'r', 'u1', route),
    /(?:current|active)/,
  );
  state = { ...state, approvalGrants: [] };
  assert.throws(
    () =>
      decideProductApproval(
        state,
        state.approvalAssignments[0].id,
        'u1',
        'APPROVED',
        '',
      ),
    /permissions/,
  );
  assert.throws(
    () => submitProductApproval(fixture(), 'r', 'u1', [route[0]]),
    /FINAL/,
  );
});
void test('rejection preserves registration/products/snapshot and resubmission creates separate history', () => {
  let state = submitProductApproval(fixture(), 'r', 'u1', route);
  assert.throws(
    () =>
      decideProductApproval(
        state,
        state.approvalAssignments[0].id,
        'u1',
        'REJECTED',
        '',
      ),
    /reason/,
  );
  state = decideProductApproval(
    state,
    state.approvalAssignments[0].id,
    'u1',
    'REJECTED',
    'Fix',
  );
  assert.equal(state.approvalRequests[0].status, 'REJECTED');
  assert.equal(state.masterProducts.length, 1);
  assert.equal(state.registrations.length, 1);
  assert.equal(state.approvalSteps[1].status, 'CANCELLED');
  state = submitProductApproval(state, 'r', 'u1', route);
  assert.equal(state.approvalRequests.length, 2);
  assert.equal(state.approvalRequests[0].status, 'REJECTED');
});
void test('changed snapshots and previously used SKU block approval', () => {
  let state = submitProductApproval(fixture(), 'r', 'u1', route);
  state = {
    ...state,
    masterProducts: state.masterProducts.map((row) => ({
      ...row,
      sku: 'CHANGED',
    })),
  };
  assert.throws(
    () =>
      decideProductApproval(
        state,
        state.approvalAssignments[0].id,
        'u1',
        'APPROVED',
        '',
      ),
    /changed/,
  );
  const existing = fixture();
  existing.masterProductSkus = [
    {
      id: 'old',
      masterProductId: 'old',
      sku: 'sku',
      validFrom: '2025-01-01',
      validTo: '2025-02-01',
    },
  ];
  assert.throws(() => submitProductApproval(existing, 'r', 'u1', route), /SKU/);
});
