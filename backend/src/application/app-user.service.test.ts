import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppRole, AppRoleInput, AppUser, AppUserInput } from '../domain/app-user.js';
import type { Invitation, NewInvitation } from '../domain/invitation.js';
import type { Permission, RolePermission } from '../domain/permission.js';
import type { AppUserRepository } from '../domain/app-user.repository.js';
import { NotFoundError, ValidationError } from '../domain/errors.js';
import { createAppUserService } from './app-user.service.js';

const ENGINEERING = '01a0ab80-f843-7a8e-b8c5-41e3540744a3';
const RESEARCH = '01a0b554-47a4-7d51-98a8-2031a7706b48';
const ROLES: AppRole[] = [
  {
    id: '01a0ab80-f875-7251-9fab-7ec3e206b8db',
    departmentId: ENGINEERING,
    code: 'DEVELOPER',
    name: 'Developer',
  },
  {
    id: '01a0b554-47cc-775d-b9ef-73a4e27eb58c',
    departmentId: RESEARCH,
    code: 'DESIGNER',
    name: 'Designer',
  },
];
const DEVELOPER = ROLES[0]?.id ?? '';
const DESIGNER = ROLES[1]?.id ?? '';

function BODY_DEFAULTS(): AppUserInput {
  return {
    name: 'Someone',
    email: 'someone@coverland.com',
    status: 'ACTIVE',
    departmentId: ENGINEERING,
    appRoleId: DEVELOPER,
  };
}

function stored(id: string, input: AppUserInput): AppUser {
  return {
    id,
    ...input,
    departmentName: 'Engineering',
    appRoleName: 'Developer',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };
}

interface FakeRepository extends AppUserRepository {
  created: AppUserInput[];
  deletedRoles: string[];
  issued: NewInvitation[];
  rolePermissions: RolePermission[];
}

function fakeRepository(existingIds: string[]): FakeRepository {
  const created: AppUserInput[] = [];
  const deletedRoles: string[] = [];
  const issued: NewInvitation[] = [];
  const rolePermissions: RolePermission[] = [];
  return {
    created,
    deletedRoles,
    issued,
    rolePermissions,
    listAppUsers: () => Promise.resolve(USERS),
    listDepartments: () => Promise.resolve([]),
    createDepartment: (input) => Promise.resolve({ id: 'new-department', ...input }),
    updateDepartment: (id, input) =>
      Promise.resolve(existingIds.includes(id) ? { id, ...input } : undefined),
    deleteDepartment: (id) => Promise.resolve(existingIds.includes(id)),
    listAppRoles: () => Promise.resolve(ROLES),
    createAppUser(input) {
      created.push(input);
      return Promise.resolve(stored('new', input));
    },
    updateAppUser(id, input) {
      return Promise.resolve(existingIds.includes(id) ? stored(id, input) : undefined);
    },
    createAppRole: (input: AppRoleInput) => Promise.resolve({ id: 'new-role', ...input }),
    updateAppRole(id, input) {
      return Promise.resolve(existingIds.includes(id) ? { id, ...input } : undefined);
    },
    deleteAppRole(id) {
      deletedRoles.push(id);
      return Promise.resolve(existingIds.includes(id));
    },
    listInvitations: () => Promise.resolve([]),
    issueInvitation(invitation) {
      issued.push(invitation);
      return Promise.resolve(storedInvitation(invitation));
    },
    closeInvitation(id, status) {
      return Promise.resolve(
        existingIds.includes(id)
          ? {
              ...storedInvitation({
                appUserId: INVITED_ID,
                invitedBy: ACTIVE_ID,
                secretHash: new Uint8Array(32),
                expiresAt: new Date(),
              }),
              id,
              status,
              closedAt: new Date(),
            }
          : undefined,
      );
    },
    listPermissions: () => Promise.resolve(PERMISSIONS),
    createPermission: (input) => Promise.resolve({ id: PERMISSION_ID, ...input }),
    updatePermission: (id, input) =>
      Promise.resolve(id === PERMISSION_ID ? { id, ...input } : undefined),
    deletePermission: (id) => Promise.resolve(id === PERMISSION_ID),
    listRolePermissions: () => Promise.resolve(rolePermissions),
    setRolePermissions(appRoleId, permissionIds) {
      rolePermissions.splice(
        0,
        rolePermissions.length,
        ...permissionIds.map((permissionId) => ({ appRoleId, permissionId })),
      );
      return Promise.resolve();
    },
    listPermissionAssignments: () => Promise.resolve([]),
    createPermissionAssignment: (input) =>
      Promise.resolve({
        id: 'a1',
        ...input,
        userName: 'Kai Chung',
        userEmail: 'kai@coverland.com',
        permissionCode: 'USER_MANAGE',
      }),
    deletePermissionAssignment: () => Promise.resolve(true),
  };
}

const INVITED_ID = '01a0b56d-b9ff-70e9-946b-5f6159a41f92';
const PERMISSION_ID = '01a0ab71-d4bc-7a67-ae0b-4e1bf4330e0c';
const PERMISSIONS: Permission[] = [
  { id: PERMISSION_ID, code: 'USER_MANAGE', name: 'Manage users' },
];
const INVITATION_ID = '01a0b56d-ba06-731a-8314-2e60f77ab07e';
const OTHER_INVITATION_ID = '01a0b56e-0864-71fb-b1cf-3f06f2476846';
const ACTIVE_ID = '01a0ab80-f975-7ff8-8b76-60ab0d5f809d';
const USERS: AppUser[] = [
  stored(INVITED_ID, { ...BODY_DEFAULTS(), name: 'Heechul Park', status: 'INVITED' }),
  stored(ACTIVE_ID, { ...BODY_DEFAULTS(), name: 'Kai Chung', status: 'ACTIVE' }),
];

function storedInvitation(invitation: NewInvitation): Invitation {
  return {
    id: INVITATION_ID,
    appUserId: invitation.appUserId,
    inviteeName: 'Heechul Park',
    inviteeEmail: 'heechul@coverland.com',
    invitedBy: invitation.invitedBy,
    inviterName: 'Kai Chung',
    status: 'PENDING',
    expiresAt: invitation.expiresAt,
    createdAt: new Date('2026-09-24T00:00:00.000Z'),
    updatedAt: new Date('2026-09-24T00:00:00.000Z'),
  };
}

const BODY = {
  name: 'Jane Kim',
  email: 'jane@coverland.com',
  departmentId: ENGINEERING,
  appRoleId: DEVELOPER,
};

await test('create validates the body and stores it when the role matches the department', async () => {
  const repository = fakeRepository([]);
  const service = createAppUserService(repository);

  const user = await service.createAppUser(BODY);

  assert.equal(user.name, 'Jane Kim');
  assert.equal(repository.created.length, 1);
});

await test('create refuses a role from another department or an unknown role', async () => {
  const service = createAppUserService(fakeRepository([]));

  await assert.rejects(service.createAppUser({ ...BODY, appRoleId: DESIGNER }), ValidationError);
  await assert.rejects(
    service.createAppUser({ ...BODY, appRoleId: '00000000-0000-7000-8000-000000000000' }),
    ValidationError,
  );
});

await test('update reports a missing account as not found', async () => {
  const existing = '01a0b554-47f4-7fe3-b5e2-d8d7b397c0aa';
  const service = createAppUserService(fakeRepository([existing]));

  const user = await service.updateAppUser(existing, { ...BODY, status: 'INACTIVE' });
  assert.equal(user.status, 'INACTIVE');

  await assert.rejects(
    service.updateAppUser('01a0b554-0000-7000-8000-000000000000', BODY),
    NotFoundError,
  );
  await assert.rejects(service.updateAppUser('not-a-uuid', BODY), NotFoundError);
});

await test('roles are created, updated and deleted by id, and a missing id is not found', async () => {
  const existing = DEVELOPER;
  const repository = fakeRepository([existing]);
  const service = createAppUserService(repository);
  const body = { departmentId: ENGINEERING, code: 'qa', name: 'QA' };

  assert.equal((await service.createAppRole(body)).code, 'QA');
  assert.equal((await service.updateAppRole(existing, body)).id, existing);
  await service.deleteAppRole(existing);
  assert.deepEqual(repository.deletedRoles, [existing]);

  await assert.rejects(service.updateAppRole(DESIGNER, body), NotFoundError);
  await assert.rejects(service.deleteAppRole(DESIGNER), NotFoundError);
  await assert.rejects(service.deleteAppRole('not-a-uuid'), NotFoundError);
  assert.deepEqual(repository.deletedRoles, [existing, DESIGNER]);
});

await test('invitations go to INVITED accounts from ACTIVE inviters and carry a 32-byte digest', async () => {
  const repository = fakeRepository([INVITATION_ID]);
  const service = createAppUserService(repository);

  const invitation = await service.sendInvitation({ appUserId: INVITED_ID, invitedBy: ACTIVE_ID });
  assert.equal(invitation.status, 'PENDING');
  const issued = repository.issued[0];
  assert.ok(issued);
  assert.equal(issued.secretHash.length, 32);
  assert.ok(issued.expiresAt.getTime() > Date.now());

  await assert.rejects(
    service.sendInvitation({ appUserId: ACTIVE_ID, invitedBy: ACTIVE_ID }),
    ValidationError,
  );
  await assert.rejects(
    service.sendInvitation({ appUserId: INVITED_ID, invitedBy: INVITED_ID }),
    ValidationError,
  );

  assert.equal((await service.revokeInvitation(INVITATION_ID)).status, 'REVOKED');
  assert.equal((await service.acceptInvitation(INVITATION_ID)).status, 'ACCEPTED');
  await assert.rejects(service.revokeInvitation(OTHER_INVITATION_ID), NotFoundError);
});

await test('role permissions are replaced as a set and validated against known ids', async () => {
  const repository = fakeRepository([DEVELOPER]);
  const service = createAppUserService(repository);

  await service.setRolePermissions(DEVELOPER, { permissionIds: [PERMISSION_ID] });
  assert.deepEqual(repository.rolePermissions, [
    { appRoleId: DEVELOPER, permissionId: PERMISSION_ID },
  ]);

  await assert.rejects(
    service.setRolePermissions(DEVELOPER, {
      permissionIds: ['01a0ab71-0000-7000-8000-000000000000'],
    }),
    ValidationError,
  );
  await assert.rejects(
    service.setRolePermissions('01a0ab71-0000-7000-8000-000000000000', { permissionIds: [] }),
    NotFoundError,
  );
  await assert.rejects(service.deletePermission(DESIGNER), NotFoundError);
});
