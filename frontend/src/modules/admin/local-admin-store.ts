import { z } from 'zod';
import {
  readRdRecords,
  writeRdRecords,
} from '@/modules/rd-workspace/rd-record-storage';
import {
  APP_USER_STATUSES,
  ASSIGNMENT_EFFECTS,
  INVITATION_STATUSES,
  type AppRoleDto,
  type AppRoleInput,
  type AppUserDto,
  type AppUserInput,
  type DepartmentDto,
  type DepartmentInput,
  type InvitationDto,
  type InvitationInput,
  type InviteUserInput,
  type PermissionAssignmentDto,
  type PermissionAssignmentInput,
  type PermissionDto,
  type PermissionInput,
  type RolePermissionDto,
} from './app-user-dto';

/**
 * Browser-local stand-in for the identity tables (`app_user`, `department`,
 * `app_role`, `user_invitation`, `permission`, `role_x_permission`,
 * `user_x_permission_assignment`). Rows are stored normalized; the DTOs the
 * screens read resolve names on the way out, like the API's joins did.
 */
export const ADMIN_STORE_KEY = 'coverland-admin-v1';

const INVITATION_TTL_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const storedUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(APP_USER_STATUSES),
  designerInitial: z.string().optional(),
  departmentId: z.string().min(1),
  appRoleId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const storedInvitationSchema = z.object({
  id: z.string().min(1),
  appUserId: z.string().min(1),
  invitedBy: z.string().min(1),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string(),
  closedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const storedAssignmentSchema = z.object({
  id: z.string().min(1),
  appUserId: z.string().min(1),
  permissionId: z.string().min(1),
  effect: z.enum(ASSIGNMENT_EFFECTS),
});
const adminDocumentSchema = z.object({
  departments: z.array(
    z.object({ id: z.string().min(1), code: z.string(), name: z.string() }),
  ),
  roles: z.array(
    z.object({
      id: z.string().min(1),
      departmentId: z.string().min(1),
      code: z.string(),
      name: z.string(),
    }),
  ),
  users: z.array(storedUserSchema),
  invitations: z.array(storedInvitationSchema),
  permissions: z.array(
    z.object({ id: z.string().min(1), code: z.string(), name: z.string() }),
  ),
  rolePermissions: z.array(
    z.object({ appRoleId: z.string().min(1), permissionId: z.string().min(1) }),
  ),
  assignments: z.array(storedAssignmentSchema),
});
type AdminDocument = z.infer<typeof adminDocumentSchema>;
type StoredUser = z.infer<typeof storedUserSchema>;
type StoredInvitation = z.infer<typeof storedInvitationSchema>;

const SEED_TIME = '2026-09-18T16:23:14.401Z';
const DEPT_SYSTEM = 'dept-system';
const DEPT_ENGINEERING = 'dept-engineering';
const DEPT_RD = 'dept-rd';
const ROLE_SYSTEM = 'role-system';
const ROLE_DEVELOPER = 'role-developer';
const ROLE_DESIGNER = 'role-designer';
const PERMISSION_USER_MANAGE = 'perm-user-manage';

function seedUser(
  id: string,
  name: string,
  email: string,
  status: AppUserDto['status'],
  departmentId: string,
  appRoleId: string,
  designerInitial?: string,
): StoredUser {
  return {
    id,
    name,
    email,
    status,
    ...(designerInitial ? { designerInitial } : {}),
    departmentId,
    appRoleId,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

/** Demo rows mirroring the staging seed, so the screens have something to show on first load. */
export const ADMIN_STORE_SEED: AdminDocument = {
  departments: [
    { id: DEPT_ENGINEERING, code: 'ENGINEERING', name: 'Engineering' },
    { id: DEPT_RD, code: 'R_AND_D', name: 'Research & Development' },
    { id: DEPT_SYSTEM, code: 'SYSTEM', name: 'System' },
  ],
  roles: [
    {
      id: ROLE_DESIGNER,
      departmentId: DEPT_RD,
      code: 'DESIGNER',
      name: 'Designer',
    },
    {
      id: ROLE_DEVELOPER,
      departmentId: DEPT_ENGINEERING,
      code: 'DEVELOPER',
      name: 'Developer',
    },
    {
      id: ROLE_SYSTEM,
      departmentId: DEPT_SYSTEM,
      code: 'SYSTEM',
      name: 'System',
    },
  ],
  users: [
    seedUser(
      'usr-kai',
      'Kai Chung',
      'kai.c@shipcore.com',
      'ACTIVE',
      DEPT_ENGINEERING,
      ROLE_DEVELOPER,
    ),
    seedUser(
      'usr-joon',
      'Joon Kim',
      'joon.k@shipcore.com',
      'ACTIVE',
      DEPT_ENGINEERING,
      ROLE_DEVELOPER,
    ),
    seedUser(
      'usr-taeho',
      'Taeho Kim',
      'taeho@coverland.com',
      'ACTIVE',
      DEPT_ENGINEERING,
      ROLE_DEVELOPER,
    ),
    seedUser(
      'usr-jane',
      'Jane Jin',
      'jane.coverland@gmail.com',
      'INVITED',
      DEPT_RD,
      ROLE_DESIGNER,
      'J',
    ),
    seedUser(
      'usr-heechul',
      'Heechul Park',
      'heechul.coverland@gmail.com',
      'INVITED',
      DEPT_RD,
      ROLE_DESIGNER,
      'C',
    ),
    seedUser(
      'usr-andy',
      'Andy Kang',
      'andy.k.coverland@gmail.com',
      'INACTIVE',
      DEPT_RD,
      ROLE_DESIGNER,
      'L',
    ),
    seedUser(
      'usr-system',
      'SYSTEM',
      'system@coverland.com',
      'ACTIVE',
      DEPT_SYSTEM,
      ROLE_SYSTEM,
    ),
  ],
  invitations: [
    {
      id: 'inv-jane',
      appUserId: 'usr-jane',
      invitedBy: 'usr-taeho',
      status: 'PENDING',
      expiresAt: '2026-09-25T16:23:14.401Z',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    },
  ],
  permissions: [
    { id: PERMISSION_USER_MANAGE, code: 'USER_MANAGE', name: 'Manage users' },
  ],
  rolePermissions: [
    { appRoleId: ROLE_DEVELOPER, permissionId: PERMISSION_USER_MANAGE },
  ],
  assignments: [],
};

/** What the API answered with; `status` maps onto the HTTP codes the screens already handle. */
export class AdminStoreError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'AdminStoreError';
  }
}

function invalid(message: string): never {
  throw new AdminStoreError(400, message);
}

function notFound(message: string): never {
  throw new AdminStoreError(404, message);
}

function conflict(message: string): never {
  throw new AdminStoreError(409, message);
}

function toUserDto(document: AdminDocument, user: StoredUser): AppUserDto {
  return {
    ...user,
    departmentName:
      document.departments.find((row) => row.id === user.departmentId)?.name ??
      user.departmentId,
    appRoleName:
      document.roles.find((row) => row.id === user.appRoleId)?.name ??
      user.appRoleId,
  };
}

function toInvitationDto(
  document: AdminDocument,
  invitation: StoredInvitation,
): InvitationDto {
  const invitee = document.users.find((row) => row.id === invitation.appUserId);
  const inviter = document.users.find((row) => row.id === invitation.invitedBy);
  return {
    ...invitation,
    inviteeName: invitee?.name ?? invitation.appUserId,
    inviteeEmail: invitee?.email ?? '',
    inviterName: inviter?.name ?? invitation.invitedBy,
  };
}

function toAssignmentDto(
  document: AdminDocument,
  assignment: AdminDocument['assignments'][number],
): PermissionAssignmentDto {
  const user = document.users.find((row) => row.id === assignment.appUserId);
  const permission = document.permissions.find(
    (row) => row.id === assignment.permissionId,
  );
  return {
    ...assignment,
    userName: user?.name ?? assignment.appUserId,
    userEmail: user?.email ?? '',
    permissionCode: permission?.code ?? assignment.permissionId,
  };
}

function validateUserInput(
  document: AdminDocument,
  input: AppUserInput,
  userId?: string,
): AppUserInput {
  const name = input.name.trim();
  const email = input.email.trim();
  const designerInitial = input.designerInitial?.trim();
  if (!name) invalid('name is required');
  if (!EMAIL_PATTERN.test(email)) invalid('email must be a valid address');
  const role = document.roles.find((row) => row.id === input.appRoleId);
  if (!document.departments.some((row) => row.id === input.departmentId)) {
    invalid('departmentId must be a department id');
  }
  if (!role) invalid('appRoleId does not match a role');
  if (role.departmentId !== input.departmentId) {
    invalid('The role must belong to the selected department');
  }
  const others = document.users.filter((row) => row.id !== userId);
  if (others.some((row) => row.email.toLowerCase() === email.toLowerCase())) {
    conflict('That email already belongs to a user');
  }
  if (
    designerInitial &&
    others.some((row) => row.designerInitial === designerInitial)
  ) {
    conflict('That designer initial is already taken');
  }
  return {
    name,
    email,
    status: input.status,
    ...(designerInitial ? { designerInitial } : {}),
    departmentId: input.departmentId,
    appRoleId: input.appRoleId,
  };
}

function validateCode(code: string, label: string): string {
  const normalized = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) {
    invalid(`${label} must be letters, digits and underscores`);
  }
  return normalized;
}

/** Revokes the account's pending invitation, if any, and issues a new one (resending replaces it). */
function issueInvitation(
  document: AdminDocument,
  input: InvitationInput,
): { document: AdminDocument; result: InvitationDto } {
  const invitee = document.users.find((row) => row.id === input.appUserId);
  if (!invitee) invalid('appUserId does not match a user');
  if (invitee.status !== 'INVITED') {
    invalid('Only accounts in the INVITED status can be invited');
  }
  const inviter = document.users.find((row) => row.id === input.invitedBy);
  if (inviter?.status !== 'ACTIVE') {
    invalid('invitedBy must be an active user');
  }
  const at = new Date().toISOString();
  const invitation: StoredInvitation = {
    id: crypto.randomUUID(),
    appUserId: input.appUserId,
    invitedBy: input.invitedBy,
    status: 'PENDING',
    expiresAt: new Date(
      Date.now() + INVITATION_TTL_DAYS * MILLISECONDS_PER_DAY,
    ).toISOString(),
    createdAt: at,
    updatedAt: at,
  };
  const next = {
    ...document,
    invitations: [
      ...document.invitations.map((row) =>
        row.appUserId === input.appUserId && row.status === 'PENDING'
          ? { ...row, status: 'REVOKED' as const, closedAt: at, updatedAt: at }
          : row,
      ),
      invitation,
    ],
  };
  return { document: next, result: toInvitationDto(next, invitation) };
}

function revokeInvitation(
  document: AdminDocument,
  appUserId: string,
): { document: AdminDocument; result: undefined } {
  const pendingInvitation = document.invitations.find(
    (row) => row.appUserId === appUserId && row.status === 'PENDING',
  );
  if (!pendingInvitation) notFound('No pending invitation for that user');
  const at = new Date().toISOString();
  return {
    document: {
      ...document,
      invitations: document.invitations.map((row) =>
        row.id === pendingInvitation.id
          ? { ...row, status: 'REVOKED' as const, closedAt: at, updatedAt: at }
          : row,
      ),
    },
    result: undefined,
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Every operation the admin screens need, backed by one localStorage document. */
export function createAdminStore(storage: StorageLike) {
  function read(): AdminDocument {
    return readRdRecords(
      storage,
      ADMIN_STORE_KEY,
      adminDocumentSchema,
      ADMIN_STORE_SEED,
    );
  }

  /** Applies `update` to the latest document and returns what it produced alongside the new document. */
  function write<T>(
    update: (document: AdminDocument) => { document: AdminDocument; result: T },
  ): T {
    let result: T | undefined;
    writeRdRecords(storage, {
      key: ADMIN_STORE_KEY,
      schema: adminDocumentSchema,
      defaults: ADMIN_STORE_SEED,
      update: (current) => {
        const outcome = update(current);
        result = outcome.result;
        return outcome.document;
      },
    });
    // `update` always runs, so `result` is set by now.
    return result as T;
  }

  const now = (): string => new Date().toISOString();

  return {
    listUsers: (): AppUserDto[] => {
      const document = read();
      return document.users.map((user) => toUserDto(document, user));
    },
    listDepartments: (): DepartmentDto[] => read().departments,
    listRoles: (): AppRoleDto[] => read().roles,
    listInvitations: (): InvitationDto[] => {
      const document = read();
      return [...document.invitations]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((invitation) => toInvitationDto(document, invitation));
    },
    listPermissions: (): PermissionDto[] => read().permissions,
    listRolePermissions: (): RolePermissionDto[] => read().rolePermissions,
    listAssignments: (): PermissionAssignmentDto[] => {
      const document = read();
      return document.assignments.map((row) => toAssignmentDto(document, row));
    },

    createDepartment: (input: DepartmentInput): DepartmentDto =>
      write((document) => {
        const code = validateCode(input.code, 'Department code');
        const name = input.name.trim();
        if (!name) invalid('Department name is required');
        if (document.departments.some((row) => row.code === code)) {
          conflict('A department with that code already exists');
        }
        const department = { id: crypto.randomUUID(), code, name };
        return {
          document: {
            ...document,
            departments: [...document.departments, department],
          },
          result: department,
        };
      }),

    updateDepartment: (id: string, input: DepartmentInput): DepartmentDto =>
      write((document) => {
        if (!document.departments.some((row) => row.id === id)) {
          notFound('No department with that id');
        }
        const code = validateCode(input.code, 'Department code');
        const name = input.name.trim();
        if (!name) invalid('Department name is required');
        if (
          document.departments.some((row) => row.id !== id && row.code === code)
        ) {
          conflict('A department with that code already exists');
        }
        const department = { id, code, name };
        return {
          document: {
            ...document,
            departments: document.departments.map((row) =>
              row.id === id ? department : row,
            ),
          },
          result: department,
        };
      }),

    deleteDepartment: (id: string): void => {
      write((document) => {
        if (!document.departments.some((row) => row.id === id)) {
          notFound('No department with that id');
        }
        if (
          document.users.some((row) => row.departmentId === id) ||
          document.roles.some((row) => row.departmentId === id)
        ) {
          conflict('The department is still assigned to users or roles');
        }
        return {
          document: {
            ...document,
            departments: document.departments.filter((row) => row.id !== id),
          },
          result: undefined,
        };
      });
    },

    createUser: (input: AppUserInput): AppUserDto =>
      write((document) => {
        const valid = validateUserInput(document, input);
        const user: StoredUser = {
          id: crypto.randomUUID(),
          ...valid,
          createdAt: now(),
          updatedAt: now(),
        };
        const next = { ...document, users: [...document.users, user] };
        return { document: next, result: toUserDto(next, user) };
      }),

    updateUser: (id: string, input: AppUserInput): AppUserDto =>
      write((document) => {
        const existing = document.users.find((row) => row.id === id);
        if (!existing) notFound('No user with that id');
        const user: StoredUser = {
          ...existing,
          ...validateUserInput(document, input, id),
          updatedAt: now(),
        };
        const next = {
          ...document,
          users: document.users.map((row) => (row.id === id ? user : row)),
        };
        return { document: next, result: toUserDto(next, user) };
      }),

    createRole: (input: AppRoleInput): AppRoleDto =>
      write((document) => {
        const role = validateRole(document, input);
        return {
          document: { ...document, roles: [...document.roles, role] },
          result: role,
        };
      }),

    updateRole: (id: string, input: AppRoleInput): AppRoleDto =>
      write((document) => {
        if (!document.roles.some((row) => row.id === id))
          notFound('No role with that id');
        const role = validateRole(document, input, id);
        return {
          document: {
            ...document,
            roles: document.roles.map((row) => (row.id === id ? role : row)),
          },
          result: role,
        };
      }),

    deleteRole: (id: string): void => {
      write((document) => {
        if (!document.roles.some((row) => row.id === id))
          notFound('No role with that id');
        if (document.users.some((row) => row.appRoleId === id)) {
          conflict('The role is still assigned to users');
        }
        return {
          document: {
            ...document,
            roles: document.roles.filter((row) => row.id !== id),
            rolePermissions: document.rolePermissions.filter(
              (row) => row.appRoleId !== id,
            ),
          },
          result: undefined,
        };
      });
    },

    sendInvitation: (input: InvitationInput): InvitationDto =>
      write((document) => issueInvitation(document, input)),

    revokeInvitation: (appUserId: string): void => {
      write((document) => revokeInvitation(document, appUserId));
    },

    /** Creates the account as INVITED and issues its first invitation together. */
    inviteUser: (input: InviteUserInput): AppUserDto =>
      write((document) => {
        const valid = validateUserInput(document, {
          name: input.name,
          email: input.email,
          status: 'INVITED',
          departmentId: input.departmentId,
          appRoleId: input.appRoleId,
        });
        const user: StoredUser = {
          id: crypto.randomUUID(),
          ...valid,
          createdAt: now(),
          updatedAt: now(),
        };
        const withUser = { ...document, users: [...document.users, user] };
        const { document: next } = issueInvitation(withUser, {
          appUserId: user.id,
          invitedBy: input.invitedBy,
        });
        return { document: next, result: toUserDto(next, user) };
      }),

    createPermission: (input: PermissionInput): PermissionDto =>
      write((document) => {
        const permission = validatePermission(document, input);
        return {
          document: {
            ...document,
            permissions: [...document.permissions, permission],
          },
          result: permission,
        };
      }),

    updatePermission: (id: string, input: PermissionInput): PermissionDto =>
      write((document) => {
        if (!document.permissions.some((row) => row.id === id))
          notFound('No permission with that id');
        const permission = validatePermission(document, input, id);
        return {
          document: {
            ...document,
            permissions: document.permissions.map((row) =>
              row.id === id ? permission : row,
            ),
          },
          result: permission,
        };
      }),

    /** Links cascade, as the database's `ON DELETE CASCADE` does. */
    deletePermission: (id: string): void => {
      write((document) => {
        if (!document.permissions.some((row) => row.id === id))
          notFound('No permission with that id');
        return {
          document: {
            ...document,
            permissions: document.permissions.filter((row) => row.id !== id),
            rolePermissions: document.rolePermissions.filter(
              (row) => row.permissionId !== id,
            ),
            assignments: document.assignments.filter(
              (row) => row.permissionId !== id,
            ),
          },
          result: undefined,
        };
      });
    },

    setRolePermissions: (
      appRoleId: string,
      permissionIds: readonly string[],
    ): void => {
      write((document) => {
        if (!document.roles.some((row) => row.id === appRoleId))
          notFound('No role with that id');
        const known = new Set(document.permissions.map((row) => row.id));
        if (permissionIds.some((permissionId) => !known.has(permissionId))) {
          invalid('permissionIds contains an unknown permission');
        }
        return {
          document: {
            ...document,
            rolePermissions: [
              ...document.rolePermissions.filter(
                (row) => row.appRoleId !== appRoleId,
              ),
              ...[...new Set(permissionIds)].map((permissionId) => ({
                appRoleId,
                permissionId,
              })),
            ],
          },
          result: undefined,
        };
      });
    },

    createAssignment: (
      input: PermissionAssignmentInput,
    ): PermissionAssignmentDto =>
      write((document) => {
        if (!document.users.some((row) => row.id === input.appUserId))
          invalid('appUserId must be a user id');
        if (
          !document.permissions.some((row) => row.id === input.permissionId)
        ) {
          invalid('permissionId must be a permission id');
        }
        if (
          document.assignments.some(
            (row) =>
              row.appUserId === input.appUserId &&
              row.permissionId === input.permissionId,
          )
        ) {
          conflict('That user already has an override for this permission');
        }
        const assignment = { id: crypto.randomUUID(), ...input };
        const next = {
          ...document,
          assignments: [...document.assignments, assignment],
        };
        return { document: next, result: toAssignmentDto(next, assignment) };
      }),

    deleteAssignment: (id: string): void => {
      write((document) => {
        if (!document.assignments.some((row) => row.id === id)) {
          notFound('No permission override with that id');
        }
        return {
          document: {
            ...document,
            assignments: document.assignments.filter((row) => row.id !== id),
          },
          result: undefined,
        };
      });
    },
  };

  function validateRole(
    document: AdminDocument,
    input: AppRoleInput,
    roleId?: string,
  ): AppRoleDto {
    const code = validateCode(input.code, 'code');
    const name = input.name.trim();
    if (!name) invalid('name is required');
    if (!document.departments.some((row) => row.id === input.departmentId)) {
      invalid('departmentId must be a department id');
    }
    if (
      document.roles.some(
        (row) =>
          row.id !== roleId &&
          row.departmentId === input.departmentId &&
          row.code === code,
      )
    ) {
      conflict('That code is already used by a role in the department');
    }
    return {
      id: roleId ?? crypto.randomUUID(),
      departmentId: input.departmentId,
      code,
      name,
    };
  }

  function validatePermission(
    document: AdminDocument,
    input: PermissionInput,
    permissionId?: string,
  ): PermissionDto {
    const code = validateCode(input.code, 'code');
    const name = input.name.trim();
    if (!name) invalid('name is required');
    if (
      document.permissions.some(
        (row) => row.id !== permissionId && row.code === code,
      )
    ) {
      conflict('That permission code already exists');
    }
    return { id: permissionId ?? crypto.randomUUID(), code, name };
  }
}

export type AdminStore = ReturnType<typeof createAdminStore>;
