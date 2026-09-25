import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdminStoreError, createAdminStore } from './local-admin-store';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function statusOf(run: () => unknown): number | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof AdminStoreError ? error.status : undefined;
  }
}

await test('the seed loads with names resolved and survives a round trip', () => {
  const storage = memoryStorage();
  const store = createAdminStore(storage);

  const users = store.listUsers();
  assert.ok(users.length > 0);
  assert.equal(
    users.find((user) => user.id === 'usr-kai')?.departmentName,
    'Engineering',
  );
  assert.equal(
    users.find((user) => user.id === 'usr-kai')?.appRoleName,
    'Developer',
  );

  store.updateUser('usr-kai', {
    name: 'Kai Chung',
    email: 'kai.c@shipcore.com',
    status: 'ACTIVE',
    departmentId: 'dept-engineering',
    appRoleId: 'role-developer',
  });
  assert.equal(createAdminStore(storage).listUsers().length, users.length);
});

await test('users must have unique emails and a role from their department', () => {
  const store = createAdminStore(memoryStorage());
  const base = {
    name: 'New Person',
    email: 'new@coverland.com',
    status: 'ACTIVE' as const,
    departmentId: 'dept-engineering',
    appRoleId: 'role-developer',
  };

  assert.equal(store.createUser(base).appRoleName, 'Developer');
  assert.equal(
    statusOf(() => store.createUser(base)),
    409,
  );
  assert.equal(
    statusOf(() =>
      store.createUser({ ...base, email: 'x@y.z', appRoleId: 'role-designer' }),
    ),
    400,
  );
  assert.equal(
    statusOf(() => store.updateUser('missing', base)),
    404,
  );
});

await test('inviting creates an INVITED account with a pending invitation, and resending replaces it', () => {
  const storage = memoryStorage();
  const store = createAdminStore(storage);

  const invited = store.inviteUser({
    name: 'Mina Lee',
    email: 'mina@coverland.com',
    departmentId: 'dept-rd',
    appRoleId: 'role-designer',
    invitedBy: 'usr-kai',
  });
  assert.equal(invited.status, 'INVITED');
  const first = store
    .listInvitations()
    .find((row) => row.appUserId === invited.id);
  assert.ok(first);
  assert.equal(first.status, 'PENDING');
  assert.equal(first.inviterName, 'Kai Chung');

  const again = store.sendInvitation({
    appUserId: invited.id,
    invitedBy: 'usr-kai',
  });
  const pending = store
    .listInvitations()
    .filter((row) => row.appUserId === invited.id && row.status === 'PENDING');
  assert.deepEqual(
    pending.map((row) => row.id),
    [again.id],
  );
  assert.equal(
    store.listInvitations().find((row) => row.id === first.id)?.status,
    'REVOKED',
  );

  store.revokeInvitation(invited.id);
  assert.equal(
    createAdminStore(storage)
      .listInvitations()
      .find((row) => row.id === again.id)?.status,
    'REVOKED',
  );
  assert.equal(
    statusOf(() => {
      store.revokeInvitation(invited.id);
    }),
    404,
  );

  const resentAfterRevoke = store.sendInvitation({
    appUserId: invited.id,
    invitedBy: 'usr-kai',
  });
  assert.equal(resentAfterRevoke.status, 'PENDING');

  assert.equal(
    statusOf(() =>
      store.sendInvitation({ appUserId: 'usr-kai', invitedBy: 'usr-kai' }),
    ),
    400,
  );
  assert.equal(
    statusOf(() =>
      store.inviteUser({
        name: 'Dup',
        email: 'mina@coverland.com',
        departmentId: 'dept-rd',
        appRoleId: 'role-designer',
        invitedBy: 'usr-kai',
      }),
    ),
    409,
  );
});

await test('roles cannot be deleted while held and their permission links are replaced as a set', () => {
  const store = createAdminStore(memoryStorage());

  assert.equal(
    statusOf(() => {
      store.deleteRole('role-developer');
    }),
    409,
  );
  const role = store.createRole({
    departmentId: 'dept-engineering',
    code: 'qa',
    name: 'QA',
  });
  assert.equal(role.code, 'QA');
  const permission = store.createPermission({
    code: 'rd_edit',
    name: 'Edit R&D',
  });
  store.setRolePermissions(role.id, [permission.id, permission.id]);
  assert.deepEqual(
    store.listRolePermissions().filter((row) => row.appRoleId === role.id),
    [{ appRoleId: role.id, permissionId: permission.id }],
  );
  store.deleteRole(role.id);
  assert.equal(
    store.listRolePermissions().some((row) => row.appRoleId === role.id),
    false,
  );
});

await test('deleting a permission removes its role links and user overrides', () => {
  const store = createAdminStore(memoryStorage());
  const permissionId = store.listPermissions()[0]?.id ?? '';

  const override = store.createAssignment({
    appUserId: 'usr-kai',
    permissionId,
    effect: 'DENY',
  });
  assert.equal(override.permissionCode, 'USER_MANAGE');
  assert.equal(
    statusOf(() =>
      store.createAssignment({
        appUserId: 'usr-kai',
        permissionId,
        effect: 'ALLOW',
      }),
    ),
    409,
  );

  store.deletePermission(permissionId);
  assert.deepEqual(store.listRolePermissions(), []);
  assert.deepEqual(store.listAssignments(), []);
});
