import type { Sql, TransactionSql } from 'postgres';
import {
  isAppUserStatus,
  type AppRole,
  type AppUser,
  type Department,
} from '../../domain/app-user.js';
import type { AppUserRepository } from '../../domain/app-user.repository.js';
import { ConflictError, ValidationError } from '../../domain/errors.js';
import {
  isInvitationStatus,
  type ClosedInvitationStatus,
  type Invitation,
} from '../../domain/invitation.js';
import {
  isAssignmentEffect,
  type Permission,
  type PermissionAssignment,
  type RolePermission,
} from '../../domain/permission.js';

interface AppUserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  designerInitial: string | null;
  departmentId: string;
  departmentName: string;
  appRoleId: string;
  appRoleName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InvitationRow {
  id: string;
  appUserId: string;
  inviteeName: string;
  inviteeEmail: string;
  invitedBy: string;
  inviterName: string;
  status: string;
  expiresAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AssignmentRow {
  id: string;
  appUserId: string;
  userName: string;
  userEmail: string;
  permissionId: string;
  permissionCode: string;
  effect: string;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const CONFLICT_MESSAGES: Record<string, string> = {
  app_user_email_key: 'That email already belongs to a user',
  app_user_designer_initial_key: 'That designer initial is already taken',
  app_role_department_id_code_key: 'That code is already used by a role in the department',
  // Rows that still point at the role being deleted.
  app_user_app_role_id_fkey: 'The role is still assigned to users',
  role_x_permission_app_role_id_fkey: 'The role still has permissions attached',
  user_invitation_pending_key: 'That account already has a pending invitation',
  permission_code_key: 'That permission code already exists',
  user_x_permission_assignment_app_user_id_permission_id_key:
    'That user already has an override for this permission',
};

function toAppUser(row: AppUserRow): AppUser {
  if (!isAppUserStatus(row.status)) {
    throw new Error(`app_user ${row.id} has an unknown status "${row.status}"`);
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    ...(row.designerInitial === null ? {} : { designerInitial: row.designerInitial }),
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    appRoleId: row.appRoleId,
    appRoleName: row.appRoleName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toInvitation(row: InvitationRow): Invitation {
  if (!isInvitationStatus(row.status)) {
    throw new Error(`user_invitation ${row.id} has an unknown status "${row.status}"`);
  }
  return {
    id: row.id,
    appUserId: row.appUserId,
    inviteeName: row.inviteeName,
    inviteeEmail: row.inviteeEmail,
    invitedBy: row.invitedBy,
    inviterName: row.inviterName,
    status: row.status,
    expiresAt: row.expiresAt,
    ...(row.closedAt === null ? {} : { closedAt: row.closedAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssignment(row: AssignmentRow): PermissionAssignment {
  if (!isAssignmentEffect(row.effect)) {
    throw new Error(`user_x_permission_assignment ${row.id} has an unknown effect "${row.effect}"`);
  }
  return { ...row, effect: row.effect };
}

/** Translates constraint failures into domain errors; anything else is a real fault. */
function translateWriteError(error: unknown): never {
  // The `postgres` driver rejects with PostgresError, which carries the SQLSTATE and constraint name.
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  const constraint =
    error instanceof Error && 'constraint_name' in error ? String(error.constraint_name) : '';
  const message = CONFLICT_MESSAGES[constraint];
  if (code === UNIQUE_VIOLATION || (code === FOREIGN_KEY_VIOLATION && message)) {
    throw new ConflictError(message ?? 'A record with those details already exists', {
      cause: error,
    });
  }
  if (code === FOREIGN_KEY_VIOLATION) {
    throw new ValidationError('Unknown department or role', { cause: error });
  }
  throw error;
}

export function createPostgresAppUserRepository(database: Sql): AppUserRepository {
  function selectAppUsers(id?: string) {
    return database<AppUserRow[]>`
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        u.designer_initial AS "designerInitial",
        u.department_id AS "departmentId",
        d.name AS "departmentName",
        u.app_role_id AS "appRoleId",
        r.name AS "appRoleName",
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM app_user u
      JOIN department d ON d.id = u.department_id
      JOIN app_role r ON r.id = u.app_role_id
      WHERE ${id === undefined ? database`TRUE` : database`u.id = ${id}`}
      ORDER BY u.name, u.id
    `;
  }

  function selectInvitations(client: Sql | TransactionSql, id?: string) {
    return client<InvitationRow[]>`
      SELECT
        i.id,
        i.app_user_id AS "appUserId",
        invitee.name AS "inviteeName",
        invitee.email AS "inviteeEmail",
        i.invited_by AS "invitedBy",
        inviter.name AS "inviterName",
        i.status,
        i.expires_at AS "expiresAt",
        i.closed_at AS "closedAt",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt"
      FROM user_invitation i
      JOIN app_user invitee ON invitee.id = i.app_user_id
      JOIN app_user inviter ON inviter.id = i.invited_by
      WHERE ${id === undefined ? client`TRUE` : client`i.id = ${id}`}
      ORDER BY i.created_at DESC, i.id
    `;
  }

  async function findInvitation(client: Sql | TransactionSql, id: string): Promise<Invitation> {
    const [row] = await selectInvitations(client, id);
    if (!row) {
      throw new Error(`user_invitation ${id} vanished after it was written`);
    }
    return toInvitation(row);
  }

  async function findAppUser(id: string): Promise<AppUser> {
    const [row] = await selectAppUsers(id);
    if (!row) {
      throw new Error(`app_user ${id} vanished after it was written`);
    }
    return toAppUser(row);
  }

  return {
    async listAppUsers() {
      const rows = await selectAppUsers();
      return rows.map((row) => toAppUser(row));
    },

    async createAppUser(input) {
      const [inserted] = await database<{ id: string }[]>`
        INSERT INTO app_user (department_id, app_role_id, email, name, status, designer_initial)
        VALUES (
          ${input.departmentId},
          ${input.appRoleId},
          ${input.email},
          ${input.name},
          ${input.status},
          ${input.designerInitial ?? null}
        )
        RETURNING id
      `.catch(translateWriteError);
      if (!inserted) {
        throw new Error('INSERT INTO app_user returned no row');
      }
      return findAppUser(inserted.id);
    },

    async updateAppUser(id, input) {
      const [updated] = await database<{ id: string }[]>`
        UPDATE app_user SET
          department_id = ${input.departmentId},
          app_role_id = ${input.appRoleId},
          email = ${input.email},
          name = ${input.name},
          status = ${input.status},
          designer_initial = ${input.designerInitial ?? null},
          updated_at = now()
        WHERE id = ${id}
        RETURNING id
      `.catch(translateWriteError);
      return updated ? findAppUser(updated.id) : undefined;
    },

    listDepartments() {
      return database<Department[]>`
        SELECT id, code, name FROM department ORDER BY name, id
      `;
    },

    async createDepartment(input) {
      const [department] = await database<Department[]>`
        INSERT INTO department (code, name)
        VALUES (${input.code}, ${input.name})
        RETURNING id, code, name
      `.catch(translateWriteError);
      if (!department) throw new Error('INSERT INTO department returned no row');
      return department;
    },

    async updateDepartment(id, input) {
      const [department] = await database<Department[]>`
        UPDATE department SET
          code = ${input.code},
          name = ${input.name},
          updated_at = now()
        WHERE id = ${id}
        RETURNING id, code, name
      `.catch(translateWriteError);
      return department;
    },

    async deleteDepartment(id) {
      const deleted = await database<{ id: string }[]>`
        DELETE FROM department WHERE id = ${id} RETURNING id
      `.catch(translateWriteError);
      return deleted.length > 0;
    },

    listAppRoles() {
      return database<AppRole[]>`
        SELECT id, department_id AS "departmentId", code, name FROM app_role ORDER BY name, id
      `;
    },

    async createAppRole(input) {
      const [role] = await database<AppRole[]>`
        INSERT INTO app_role (department_id, code, name)
        VALUES (${input.departmentId}, ${input.code}, ${input.name})
        RETURNING id, department_id AS "departmentId", code, name
      `.catch(translateWriteError);
      if (!role) {
        throw new Error('INSERT INTO app_role returned no row');
      }
      return role;
    },

    async updateAppRole(id, input) {
      const [role] = await database<AppRole[]>`
        UPDATE app_role SET
          department_id = ${input.departmentId},
          code = ${input.code},
          name = ${input.name},
          updated_at = now()
        WHERE id = ${id}
        RETURNING id, department_id AS "departmentId", code, name
      `.catch(translateWriteError);
      return role;
    },

    async deleteAppRole(id) {
      const deleted = await database<{ id: string }[]>`
        DELETE FROM app_role WHERE id = ${id} RETURNING id
      `.catch(translateWriteError);
      return deleted.length > 0;
    },

    async listInvitations() {
      const rows = await selectInvitations(database);
      return rows.map((row) => toInvitation(row));
    },

    issueInvitation(invitation) {
      // Only one pending invitation per account may exist (user_invitation_pending_key),
      // and resending is defined as revoking the earlier one.
      return database
        .begin(async (transaction) => {
          await transaction`
            UPDATE user_invitation
            SET status = 'REVOKED', closed_at = now(), updated_at = now()
            WHERE app_user_id = ${invitation.appUserId} AND status = 'PENDING'
          `;
          const [inserted] = await transaction<{ id: string }[]>`
            INSERT INTO user_invitation (app_user_id, invited_by, secret_hash, expires_at)
            VALUES (
              ${invitation.appUserId},
              ${invitation.invitedBy},
              ${Buffer.from(invitation.secretHash)},
              ${invitation.expiresAt}
            )
            RETURNING id
          `;
          if (!inserted) {
            throw new Error('INSERT INTO user_invitation returned no row');
          }
          return findInvitation(transaction, inserted.id);
        })
        .catch(translateWriteError);
    },

    closeInvitation(id, status: ClosedInvitationStatus) {
      return database
        .begin(async (transaction) => {
          const [closed] = await transaction<{ id: string; appUserId: string }[]>`
            UPDATE user_invitation
            SET status = ${status}, closed_at = now(), updated_at = now()
            WHERE id = ${id} AND status = 'PENDING'
            RETURNING id, app_user_id AS "appUserId"
          `;
          if (!closed) {
            return undefined;
          }
          if (status === 'ACCEPTED') {
            await transaction`
              UPDATE app_user SET status = 'ACTIVE', updated_at = now()
              WHERE id = ${closed.appUserId} AND status = 'INVITED'
            `;
          }
          return findInvitation(transaction, closed.id);
        })
        .catch(translateWriteError);
    },

    listPermissions() {
      return database<Permission[]>`
        SELECT id, code, name FROM permission ORDER BY code, id
      `;
    },

    async createPermission(input) {
      const [permission] = await database<Permission[]>`
        INSERT INTO permission (code, name)
        VALUES (${input.code}, ${input.name})
        RETURNING id, code, name
      `.catch(translateWriteError);
      if (!permission) {
        throw new Error('INSERT INTO permission returned no row');
      }
      return permission;
    },

    async updatePermission(id, input) {
      const [permission] = await database<Permission[]>`
        UPDATE permission SET code = ${input.code}, name = ${input.name}, updated_at = now()
        WHERE id = ${id}
        RETURNING id, code, name
      `.catch(translateWriteError);
      return permission;
    },

    async deletePermission(id) {
      const deleted = await database<{ id: string }[]>`
        DELETE FROM permission WHERE id = ${id} RETURNING id
      `.catch(translateWriteError);
      return deleted.length > 0;
    },

    listRolePermissions() {
      return database<RolePermission[]>`
        SELECT app_role_id AS "appRoleId", permission_id AS "permissionId"
        FROM role_x_permission
        ORDER BY app_role_id, permission_id
      `;
    },

    setRolePermissions(appRoleId, permissionIds) {
      return database
        .begin(async (transaction) => {
          await transaction`DELETE FROM role_x_permission WHERE app_role_id = ${appRoleId}`;
          for (const permissionId of permissionIds) {
            await transaction`
              INSERT INTO role_x_permission (app_role_id, permission_id)
              VALUES (${appRoleId}, ${permissionId})
            `;
          }
        })
        .catch(translateWriteError);
    },

    async listPermissionAssignments() {
      const rows = await database<AssignmentRow[]>`
        SELECT
          a.id,
          a.app_user_id AS "appUserId",
          u.name AS "userName",
          u.email AS "userEmail",
          a.permission_id AS "permissionId",
          p.code AS "permissionCode",
          a.effect
        FROM user_x_permission_assignment a
        JOIN app_user u ON u.id = a.app_user_id
        JOIN permission p ON p.id = a.permission_id
        ORDER BY u.name, p.code, a.id
      `;
      return rows.map((row) => toAssignment(row));
    },

    async createPermissionAssignment(input) {
      const [inserted] = await database<{ id: string }[]>`
        INSERT INTO user_x_permission_assignment (app_user_id, permission_id, effect)
        VALUES (${input.appUserId}, ${input.permissionId}, ${input.effect})
        RETURNING id
      `.catch(translateWriteError);
      if (!inserted) {
        throw new Error('INSERT INTO user_x_permission_assignment returned no row');
      }
      const [row] = await database<AssignmentRow[]>`
        SELECT
          a.id,
          a.app_user_id AS "appUserId",
          u.name AS "userName",
          u.email AS "userEmail",
          a.permission_id AS "permissionId",
          p.code AS "permissionCode",
          a.effect
        FROM user_x_permission_assignment a
        JOIN app_user u ON u.id = a.app_user_id
        JOIN permission p ON p.id = a.permission_id
        WHERE a.id = ${inserted.id}
      `;
      if (!row) {
        throw new Error(
          `user_x_permission_assignment ${inserted.id} vanished after it was written`,
        );
      }
      return toAssignment(row);
    },

    async deletePermissionAssignment(id) {
      const deleted = await database<{ id: string }[]>`
        DELETE FROM user_x_permission_assignment WHERE id = ${id} RETURNING id
      `;
      return deleted.length > 0;
    },
  };
}
