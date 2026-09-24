import type {
  AppRole,
  AppRoleInput,
  AppUser,
  AppUserInput,
  Department,
  DepartmentInput,
} from './app-user.js';
import type { ClosedInvitationStatus, Invitation, NewInvitation } from './invitation.js';
import type {
  Permission,
  PermissionAssignment,
  PermissionAssignmentInput,
  PermissionInput,
  RolePermission,
} from './permission.js';

/** Persistence the account use cases depend on; implemented in `infra/`. */
export interface AppUserRepository {
  listAppUsers(): Promise<AppUser[]>;
  createAppUser(input: AppUserInput): Promise<AppUser>;
  /** Resolves to `undefined` when no account has that id. */
  updateAppUser(id: string, input: AppUserInput): Promise<AppUser | undefined>;
  listDepartments(): Promise<Department[]>;
  createDepartment(input: DepartmentInput): Promise<Department>;
  updateDepartment(id: string, input: DepartmentInput): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;
  listAppRoles(): Promise<AppRole[]>;
  createAppRole(input: AppRoleInput): Promise<AppRole>;
  /** Resolves to `undefined` when no role has that id. */
  updateAppRole(id: string, input: AppRoleInput): Promise<AppRole | undefined>;
  /** Resolves to `false` when no role has that id. */
  deleteAppRole(id: string): Promise<boolean>;
  listInvitations(): Promise<Invitation[]>;
  /** Revokes the invitee's pending invitation, if any, and stores the new one. */
  issueInvitation(invitation: NewInvitation): Promise<Invitation>;
  /**
   * Closes a pending invitation; accepting also activates the invitee.
   * Resolves to `undefined` when there is no pending invitation with that id.
   */
  closeInvitation(id: string, status: ClosedInvitationStatus): Promise<Invitation | undefined>;
  listPermissions(): Promise<Permission[]>;
  createPermission(input: PermissionInput): Promise<Permission>;
  /** Resolves to `undefined` when no permission has that id. */
  updatePermission(id: string, input: PermissionInput): Promise<Permission | undefined>;
  /** Resolves to `false` when no permission has that id; links cascade in the database. */
  deletePermission(id: string): Promise<boolean>;
  listRolePermissions(): Promise<RolePermission[]>;
  /** Replaces the role's permission links with exactly `permissionIds`. */
  setRolePermissions(appRoleId: string, permissionIds: readonly string[]): Promise<void>;
  listPermissionAssignments(): Promise<PermissionAssignment[]>;
  createPermissionAssignment(input: PermissionAssignmentInput): Promise<PermissionAssignment>;
  /** Resolves to `false` when no assignment has that id. */
  deletePermissionAssignment(id: string): Promise<boolean>;
}
