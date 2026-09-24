import { createHash, randomBytes } from 'node:crypto';
import {
  isUuid,
  parseDepartmentInput,
  parseAppRoleInput,
  parseAppUserInput,
  parseInvitationInput,
  parsePermissionAssignmentInput,
  parsePermissionIds,
  parsePermissionInput,
} from '../domain/app-user-input.js';
import type { AppRole, AppUser, AppUserInput, Department } from '../domain/app-user.js';
import type { AppUserRepository } from '../domain/app-user.repository.js';
import { NotFoundError, ValidationError } from '../domain/errors.js';
import { INVITATION_TTL_DAYS, type Invitation } from '../domain/invitation.js';
import type { Permission, PermissionAssignment, RolePermission } from '../domain/permission.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECRET_BYTES = 32;

/** Account, role and invitation use cases the API exposes. Request bodies arrive unvalidated (`unknown`). */
export interface AppUserService {
  listAppUsers(): Promise<AppUser[]>;
  createAppUser(body: unknown): Promise<AppUser>;
  updateAppUser(id: string, body: unknown): Promise<AppUser>;
  listDepartments(): Promise<Department[]>;
  createDepartment(body: unknown): Promise<Department>;
  updateDepartment(id: string, body: unknown): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;
  listAppRoles(): Promise<AppRole[]>;
  createAppRole(body: unknown): Promise<AppRole>;
  updateAppRole(id: string, body: unknown): Promise<AppRole>;
  deleteAppRole(id: string): Promise<void>;
  listInvitations(): Promise<Invitation[]>;
  /** Issues a fresh invitation; an earlier pending one for the same account is revoked. */
  sendInvitation(body: unknown): Promise<Invitation>;
  revokeInvitation(id: string): Promise<Invitation>;
  /** Stands in for the invitee signing in until auth lands: closes the invitation and activates the account. */
  acceptInvitation(id: string): Promise<Invitation>;
  listPermissions(): Promise<Permission[]>;
  createPermission(body: unknown): Promise<Permission>;
  updatePermission(id: string, body: unknown): Promise<Permission>;
  deletePermission(id: string): Promise<void>;
  listRolePermissions(): Promise<RolePermission[]>;
  setRolePermissions(appRoleId: string, body: unknown): Promise<void>;
  listPermissionAssignments(): Promise<PermissionAssignment[]>;
  createPermissionAssignment(body: unknown): Promise<PermissionAssignment>;
  deletePermissionAssignment(id: string): Promise<void>;
}

/**
 * The plain secret would travel in the invitation email; only its digest is stored.
 * Mail delivery is not wired up yet, so the secret is discarded here.
 */
function newSecretHash(): Uint8Array {
  return createHash('sha256').update(randomBytes(SECRET_BYTES)).digest();
}

export function createAppUserService(repository: AppUserRepository): AppUserService {
  /** `app_user` has no database check for this; the schema leaves it to the application. */
  async function assertRoleBelongsToDepartment(input: AppUserInput): Promise<void> {
    const roles = await repository.listAppRoles();
    const role = roles.find((candidate) => candidate.id === input.appRoleId);
    if (!role) {
      throw new ValidationError('appRoleId does not match a role');
    }
    if (role.departmentId !== input.departmentId) {
      throw new ValidationError('The role must belong to the selected department');
    }
  }

  async function closeInvitation(id: string, status: 'ACCEPTED' | 'REVOKED'): Promise<Invitation> {
    const invitation = isUuid(id) ? await repository.closeInvitation(id, status) : undefined;
    if (!invitation) {
      throw new NotFoundError('No pending invitation with that id');
    }
    return invitation;
  }

  return {
    listAppUsers: () => repository.listAppUsers(),
    listDepartments: () => repository.listDepartments(),
    listAppRoles: () => repository.listAppRoles(),
    listInvitations: () => repository.listInvitations(),

    createDepartment(body) {
      return repository.createDepartment(parseDepartmentInput(body));
    },

    async updateDepartment(id, body) {
      const department = isUuid(id)
        ? await repository.updateDepartment(id, parseDepartmentInput(body))
        : undefined;
      if (!department) throw new NotFoundError('No department with that id');
      return department;
    },

    async deleteDepartment(id) {
      if (!isUuid(id) || !(await repository.deleteDepartment(id))) {
        throw new NotFoundError('No department with that id');
      }
    },

    async createAppUser(body) {
      const input = parseAppUserInput(body);
      await assertRoleBelongsToDepartment(input);
      return repository.createAppUser(input);
    },

    async updateAppUser(id, body) {
      if (!isUuid(id)) {
        throw new NotFoundError('No user with that id');
      }
      const input = parseAppUserInput(body);
      await assertRoleBelongsToDepartment(input);
      const user = await repository.updateAppUser(id, input);
      if (!user) {
        throw new NotFoundError('No user with that id');
      }
      return user;
    },

    createAppRole(body) {
      return repository.createAppRole(parseAppRoleInput(body));
    },

    async updateAppRole(id, body) {
      if (!isUuid(id)) {
        throw new NotFoundError('No role with that id');
      }
      const role = await repository.updateAppRole(id, parseAppRoleInput(body));
      if (!role) {
        throw new NotFoundError('No role with that id');
      }
      return role;
    },

    async deleteAppRole(id) {
      if (!isUuid(id) || !(await repository.deleteAppRole(id))) {
        throw new NotFoundError('No role with that id');
      }
    },

    async sendInvitation(body) {
      const input = parseInvitationInput(body);
      const users = await repository.listAppUsers();
      const invitee = users.find((user) => user.id === input.appUserId);
      if (!invitee) {
        throw new ValidationError('appUserId does not match a user');
      }
      if (invitee.status !== 'INVITED') {
        throw new ValidationError('Only accounts in the INVITED status can be invited');
      }
      const inviter = users.find((user) => user.id === input.invitedBy);
      if (inviter?.status !== 'ACTIVE') {
        throw new ValidationError('invitedBy must be an active user');
      }
      return repository.issueInvitation({
        ...input,
        secretHash: newSecretHash(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * MILLISECONDS_PER_DAY),
      });
    },

    revokeInvitation: (id) => closeInvitation(id, 'REVOKED'),
    acceptInvitation: (id) => closeInvitation(id, 'ACCEPTED'),

    listPermissions: () => repository.listPermissions(),
    listRolePermissions: () => repository.listRolePermissions(),
    listPermissionAssignments: () => repository.listPermissionAssignments(),

    createPermission(body) {
      return repository.createPermission(parsePermissionInput(body));
    },

    async updatePermission(id, body) {
      const permission = isUuid(id)
        ? await repository.updatePermission(id, parsePermissionInput(body))
        : undefined;
      if (!permission) {
        throw new NotFoundError('No permission with that id');
      }
      return permission;
    },

    async deletePermission(id) {
      if (!isUuid(id) || !(await repository.deletePermission(id))) {
        throw new NotFoundError('No permission with that id');
      }
    },

    async setRolePermissions(appRoleId, body) {
      const permissionIds = parsePermissionIds(body);
      const roles = await repository.listAppRoles();
      if (!isUuid(appRoleId) || !roles.some((role) => role.id === appRoleId)) {
        throw new NotFoundError('No role with that id');
      }
      const known = new Set((await repository.listPermissions()).map((row) => row.id));
      if (permissionIds.some((permissionId) => !known.has(permissionId))) {
        throw new ValidationError('permissionIds contains an unknown permission');
      }
      await repository.setRolePermissions(appRoleId, permissionIds);
    },

    createPermissionAssignment(body) {
      return repository.createPermissionAssignment(parsePermissionAssignmentInput(body));
    },

    async deletePermissionAssignment(id) {
      if (!isUuid(id) || !(await repository.deletePermissionAssignment(id))) {
        throw new NotFoundError('No permission override with that id');
      }
    },
  };
}
