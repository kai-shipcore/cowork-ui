/** A row of `permission`: a capability roles grant and users can be individually allowed or denied. */
export interface Permission {
  id: string;
  code: string;
  name: string;
}

export interface PermissionInput {
  code: string;
  name: string;
}

/** One `role_x_permission` link. */
export interface RolePermission {
  appRoleId: string;
  permissionId: string;
}

/** Matches the `user_x_permission_assignment_effect_check` constraint. */
export const ASSIGNMENT_EFFECTS = ['ALLOW', 'DENY'] as const;
export type AssignmentEffect = (typeof ASSIGNMENT_EFFECTS)[number];

/** A per-user override (`user_x_permission_assignment`) with the user and permission resolved for display. */
export interface PermissionAssignment {
  id: string;
  appUserId: string;
  userName: string;
  userEmail: string;
  permissionId: string;
  permissionCode: string;
  effect: AssignmentEffect;
}

export interface PermissionAssignmentInput {
  appUserId: string;
  permissionId: string;
  effect: AssignmentEffect;
}

export function isAssignmentEffect(value: string): value is AssignmentEffect {
  return (ASSIGNMENT_EFFECTS as readonly string[]).includes(value);
}
