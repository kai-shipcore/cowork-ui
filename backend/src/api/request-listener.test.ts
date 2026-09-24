import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import type { AppUserService } from '../application/app-user.service.js';
import type { AppUser } from '../domain/app-user.js';
import type { Invitation } from '../domain/invitation.js';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import { createRequestListener } from './request-listener.js';

const JANE: AppUser = {
  id: '0199a0c2-0000-7000-8000-000000000001',
  email: 'jane@coverland.com',
  name: 'Jane Kim',
  status: 'ACTIVE',
  designerInitial: 'JK',
  departmentId: '01a0b554-47a4-7d51-98a8-2031a7706b48',
  departmentName: 'Research & Development',
  appRoleId: '01a0b554-47cc-775d-b9ef-73a4e27eb58c',
  appRoleName: 'Designer',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-02T00:00:00.000Z'),
};
const JANE_DTO = {
  ...JANE,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const INVITATION: Invitation = {
  id: '01a0b56d-ba06-731a-8314-2e60f77ab07e',
  appUserId: JANE.id,
  inviteeName: JANE.name,
  inviteeEmail: JANE.email,
  invitedBy: JANE.id,
  inviterName: JANE.name,
  status: 'PENDING',
  expiresAt: new Date('2026-10-01T00:00:00.000Z'),
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
};

const PERMISSION = {
  id: '01a0ab71-d4bc-7a67-ae0b-4e1bf4330e0c',
  code: 'USER_MANAGE',
  name: 'Manage users',
};

let failure: Error | undefined;
function guarded<T>(value: T): Promise<T> {
  return failure ? Promise.reject(failure) : Promise.resolve(value);
}
const service: AppUserService = {
  listAppUsers: () => guarded([JANE]),
  createAppUser: (body) => guarded({ ...JANE, ...(body as Partial<AppUser>) }),
  updateAppUser: (id, body) => guarded({ ...JANE, id, ...(body as Partial<AppUser>) }),
  listDepartments: () =>
    guarded([{ id: JANE.departmentId, code: 'R_AND_D', name: JANE.departmentName }]),
  createDepartment: (body) =>
    guarded({ id: JANE.departmentId, code: 'R_AND_D', name: 'Research', ...(body as object) }),
  updateDepartment: (id, body) =>
    guarded({ id, code: 'R_AND_D', name: 'Research', ...(body as object) }),
  deleteDepartment: () => guarded(undefined),
  listAppRoles: () =>
    guarded([
      { id: JANE.appRoleId, departmentId: JANE.departmentId, code: 'DESIGNER', name: 'Designer' },
    ]),
  createAppRole: (body) =>
    guarded({
      id: 'new-role',
      departmentId: JANE.departmentId,
      code: 'QA',
      name: 'QA',
      ...(body as object),
    }),
  updateAppRole: (id, body) =>
    guarded({ id, departmentId: JANE.departmentId, code: 'QA', name: 'QA', ...(body as object) }),
  deleteAppRole: () => guarded(undefined),
  listInvitations: () => guarded([INVITATION]),
  sendInvitation: (body) => guarded({ ...INVITATION, ...(body as object) }),
  revokeInvitation: (id) => guarded({ ...INVITATION, id, status: 'REVOKED' }),
  acceptInvitation: (id) => guarded({ ...INVITATION, id, status: 'ACCEPTED' }),
  listPermissions: () => guarded([PERMISSION]),
  createPermission: (body) => guarded({ ...PERMISSION, ...(body as object) }),
  updatePermission: (id, body) => guarded({ ...PERMISSION, id, ...(body as object) }),
  deletePermission: () => guarded(undefined),
  listRolePermissions: () => guarded([{ appRoleId: JANE.appRoleId, permissionId: PERMISSION.id }]),
  setRolePermissions: () => guarded(undefined),
  listPermissionAssignments: () => guarded([]),
  createPermissionAssignment: (body) =>
    guarded({
      id: 'a1',
      appUserId: JANE.id,
      userName: JANE.name,
      userEmail: JANE.email,
      permissionId: PERMISSION.id,
      permissionCode: PERMISSION.code,
      effect: 'DENY',
      ...(body as object),
    }),
  deletePermissionAssignment: () => guarded(undefined),
};

const server = createServer(createRequestListener(service));
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') {
  throw new Error('Expected a TCP address');
}
const baseUrl = `http://127.0.0.1:${String(address.port)}`;

async function withFailure(error: Error, run: () => Promise<void>): Promise<void> {
  failure = error;
  try {
    await run();
  } finally {
    failure = undefined;
  }
}

await test('GET /api/users returns every account as JSON with ISO timestamps', async () => {
  const response = await fetch(`${baseUrl}/api/users`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [JANE_DTO]);
});

await test('GET /api/departments and /api/app-roles list the pick-list rows', async () => {
  const departments = await fetch(`${baseUrl}/api/departments`);
  assert.equal(departments.status, 200);
  assert.deepEqual(await departments.json(), [
    { id: JANE.departmentId, code: 'R_AND_D', name: JANE.departmentName },
  ]);

  const roles = await fetch(`${baseUrl}/api/app-roles`);
  assert.equal(roles.status, 200);
  assert.equal(((await roles.json()) as unknown[]).length, 1);
});

await test('POST /api/users answers 201 with the stored account', async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Mina' }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ...JANE_DTO, name: 'Mina' });
});

await test('PATCH /api/users/:id answers 200 with the updated account', async () => {
  const response = await fetch(`${baseUrl}/api/users/${JANE.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'INACTIVE' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...JANE_DTO, status: 'INACTIVE' });
});

await test('roles are created, updated and deleted under /api/app-roles', async () => {
  const created = await fetch(`${baseUrl}/api/app-roles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Quality' }),
  });
  assert.equal(created.status, 201);
  assert.equal(((await created.json()) as { name: string }).name, 'Quality');

  const updated = await fetch(`${baseUrl}/api/app-roles/${JANE.appRoleId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed' }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), {
    id: JANE.appRoleId,
    departmentId: JANE.departmentId,
    code: 'QA',
    name: 'Renamed',
  });

  const deleted = await fetch(`${baseUrl}/api/app-roles/${JANE.appRoleId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);

  const get = await fetch(`${baseUrl}/api/app-roles/${JANE.appRoleId}`);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'PATCH, DELETE');
});

await test('invitations are listed, sent, revoked and accepted under /api/invitations', async () => {
  const listed = await fetch(`${baseUrl}/api/invitations`);
  assert.equal(listed.status, 200);
  assert.deepEqual(await listed.json(), [
    {
      ...INVITATION,
      expiresAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
    },
  ]);

  const sent = await fetch(`${baseUrl}/api/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ invitedBy: 'someone' }),
  });
  assert.equal(sent.status, 201);
  assert.equal(((await sent.json()) as { invitedBy: string }).invitedBy, 'someone');

  const revoked = await fetch(`${baseUrl}/api/invitations/${INVITATION.id}/revoke`, {
    method: 'POST',
  });
  assert.equal(((await revoked.json()) as { status: string }).status, 'REVOKED');

  const accepted = await fetch(`${baseUrl}/api/invitations/${INVITATION.id}/accept`, {
    method: 'POST',
  });
  assert.equal(((await accepted.json()) as { status: string }).status, 'ACCEPTED');

  const wrongMethod = await fetch(`${baseUrl}/api/invitations/${INVITATION.id}/accept`);
  assert.equal(wrongMethod.status, 405);
});

await test('permissions, role links and overrides have their own routes', async () => {
  const listed = await fetch(`${baseUrl}/api/permissions`);
  assert.deepEqual(await listed.json(), [PERMISSION]);

  const created = await fetch(`${baseUrl}/api/permissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'RD_EDIT' }),
  });
  assert.equal(created.status, 201);

  const deleted = await fetch(`${baseUrl}/api/permissions/${PERMISSION.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);

  const links = await fetch(`${baseUrl}/api/role-permissions`);
  assert.deepEqual(await links.json(), [
    { appRoleId: JANE.appRoleId, permissionId: PERMISSION.id },
  ]);

  const replaced = await fetch(`${baseUrl}/api/app-roles/${JANE.appRoleId}/permissions`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissionIds: [PERMISSION.id] }),
  });
  assert.equal(replaced.status, 204);

  const override = await fetch(`${baseUrl}/api/permission-assignments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ effect: 'ALLOW' }),
  });
  assert.equal(override.status, 201);
  assert.equal(((await override.json()) as { effect: string }).effect, 'ALLOW');

  const removed = await fetch(`${baseUrl}/api/permission-assignments/a1`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
});

await test('malformed JSON bodies answer 400', async () => {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Request body must be valid JSON' });
});

await test('domain errors map to 400, 404 and 409 with their message', async () => {
  const cases: [Error, number][] = [
    [new ValidationError('email must be a valid address'), 400],
    [new NotFoundError('No user with that id'), 404],
    [new ConflictError('That email already belongs to a user'), 409],
  ];
  for (const [error, status] of cases) {
    await withFailure(error, async () => {
      const response = await fetch(`${baseUrl}/api/users/${JANE.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { message: error.message });
    });
  }
});

await test('unknown paths return 404 and other methods return 405', async () => {
  const missing = await fetch(`${baseUrl}/api/nothing`);
  assert.equal(missing.status, 404);

  const del = await fetch(`${baseUrl}/api/users`, { method: 'DELETE' });
  assert.equal(del.status, 405);
  assert.equal(del.headers.get('allow'), 'GET, POST');

  const get = await fetch(`${baseUrl}/api/users/${JANE.id}`);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'PATCH');
});

await test('an unexpected failure returns 500 without leaking the cause', async () => {
  const originalError = console.error;
  console.error = () => {
    // The listener logs the cause; keep the test output clean.
  };
  try {
    await withFailure(new Error('connection refused'), async () => {
      const response = await fetch(`${baseUrl}/api/users`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { message: 'Internal server error' });
    });
  } finally {
    console.error = originalError;
  }
});

server.closeAllConnections();
server.close();
