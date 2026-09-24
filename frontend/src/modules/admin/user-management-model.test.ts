import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionsOf } from '@/constants/roles';
import {
  invitationConflict,
  invitationSchema,
  newUserId,
  rolesOf,
  toggleRole,
  type Invitation,
} from './user-management-model';

await test('roles toggle per user and create the record on first use', () => {
  let records = toggleRole([], 'u1', 'RD_MEMBER');
  assert.deepEqual(rolesOf(records, 'u1'), ['RD_MEMBER']);
  records = toggleRole(records, 'u1', 'APPROVAL_MANAGER');
  assert.deepEqual(rolesOf(records, 'u1'), ['RD_MEMBER', 'APPROVAL_MANAGER']);
  records = toggleRole(records, 'u1', 'RD_MEMBER');
  assert.deepEqual(rolesOf(records, 'u1'), ['APPROVAL_MANAGER']);
  assert.deepEqual(rolesOf(records, 'u2'), []);
});

await test('permissions are the union of the assigned roles', () => {
  assert.deepEqual(permissionsOf(['VIEWER']), ['RD_VIEW']);
  assert.deepEqual(permissionsOf(['APPROVAL_MANAGER', 'RD_MEMBER']), [
    'APPROVAL_MANAGE',
    'RD_EDIT',
    'RD_VIEW',
  ]);
  assert.deepEqual(permissionsOf([]), []);
});

await test('new user ids derive from the name and stay unique', () => {
  assert.equal(newUserId('Mina', []), 'USR-MINA');
  assert.equal(
    newUserId('Mina Lee', [{ id: 'USR-MINA-LEE' }]),
    'USR-MINA-LEE-2',
  );
});

await test('invitations refuse known addresses and duplicates, and validate shape', () => {
  const pending: Invitation = {
    id: 'i1',
    email: 'mina@coverland.com',
    name: 'Mina',
    roleIds: ['RD_MEMBER'],
    status: 'PENDING',
    invitedBy: 'Kai',
    invitedAt: '2026-09-20T00:00:00.000Z',
    sentCount: 1,
    lastSentAt: '2026-09-20T00:00:00.000Z',
  };
  assert.match(
    invitationConflict('kai@x.test', [{ email: 'KAI@x.test' }], []) ?? '',
    /already belongs/,
  );
  assert.match(
    invitationConflict('Mina@coverland.com', [], [pending]) ?? '',
    /already pending/,
  );
  assert.equal(
    invitationConflict(
      'new@coverland.com',
      [],
      [{ ...pending, status: 'REVOKED' }],
    ),
    undefined,
  );
  assert.equal(
    invitationSchema.safeParse({ ...pending, email: 'nope' }).success,
    false,
  );
  assert.equal(
    invitationSchema.safeParse({ ...pending, roleIds: [] }).success,
    false,
  );
});
