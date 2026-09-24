import { z } from 'zod';

export const APP_USER_STATUSES = ['INVITED', 'ACTIVE', 'INACTIVE'] as const;
export type AppUserStatus = (typeof APP_USER_STATUSES)[number];

/** One `app_user` row as the backend serves it (`GET /api/users`). */
export const appUserDtoSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(APP_USER_STATUSES),
  designerInitial: z.string().optional(),
  departmentId: z.string().min(1),
  departmentName: z.string(),
  appRoleId: z.string().min(1),
  appRoleName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const appUserListSchema = z.array(appUserDtoSchema);
export type AppUserDto = z.infer<typeof appUserDtoSchema>;

/** What the backend accepts for `POST /api/users` and `PATCH /api/users/:id`. */
export interface AppUserInput {
  name: string;
  email: string;
  status: AppUserStatus;
  designerInitial?: string;
  departmentId: string;
  appRoleId: string;
}

export const departmentDtoSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
});
export const departmentListSchema = z.array(departmentDtoSchema);
export type DepartmentDto = z.infer<typeof departmentDtoSchema>;
export interface DepartmentInput {
  code: string;
  name: string;
}

export const appRoleDtoSchema = z.object({
  id: z.string().min(1),
  departmentId: z.string().min(1),
  code: z.string(),
  name: z.string(),
});
export const appRoleListSchema = z.array(appRoleDtoSchema);
export type AppRoleDto = z.infer<typeof appRoleDtoSchema>;

/** What the backend accepts for `POST /api/app-roles` and `PATCH /api/app-roles/:id`. */
export interface AppRoleInput {
  departmentId: string;
  code: string;
  name: string;
}

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** One `user_invitation` row as the backend serves it (`GET /api/invitations`). */
export const invitationDtoSchema = z.object({
  id: z.string().min(1),
  appUserId: z.string().min(1),
  inviteeName: z.string(),
  inviteeEmail: z.string(),
  invitedBy: z.string().min(1),
  inviterName: z.string(),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string(),
  closedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const invitationListSchema = z.array(invitationDtoSchema);
export type InvitationDto = z.infer<typeof invitationDtoSchema>;

/** A new person: the account is created as INVITED and an invitation is issued in one step. */
export interface InviteUserInput {
  name: string;
  email: string;
  departmentId: string;
  appRoleId: string;
  /** Active account sending the invitation (`user_invitation.invited_by`). */
  invitedBy: string;
}

/** What the backend accepts for `POST /api/invitations`. */
export interface InvitationInput {
  appUserId: string;
  invitedBy: string;
}

/** One `permission` row. */
export const permissionDtoSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
});
export const permissionListSchema = z.array(permissionDtoSchema);
export type PermissionDto = z.infer<typeof permissionDtoSchema>;

export interface PermissionInput {
  code: string;
  name: string;
}

/** One `role_x_permission` link. */
export const rolePermissionSchema = z.object({
  appRoleId: z.string().min(1),
  permissionId: z.string().min(1),
});
export const rolePermissionListSchema = z.array(rolePermissionSchema);
export type RolePermissionDto = z.infer<typeof rolePermissionSchema>;

export const ASSIGNMENT_EFFECTS = ['ALLOW', 'DENY'] as const;
export type AssignmentEffect = (typeof ASSIGNMENT_EFFECTS)[number];

/** One `user_x_permission_assignment` row with the user and permission resolved. */
export const permissionAssignmentSchema = z.object({
  id: z.string().min(1),
  appUserId: z.string().min(1),
  userName: z.string(),
  userEmail: z.string(),
  permissionId: z.string().min(1),
  permissionCode: z.string(),
  effect: z.enum(ASSIGNMENT_EFFECTS),
});
export const permissionAssignmentListSchema = z.array(
  permissionAssignmentSchema,
);
export type PermissionAssignmentDto = z.infer<
  typeof permissionAssignmentSchema
>;

export interface PermissionAssignmentInput {
  appUserId: string;
  permissionId: string;
  effect: AssignmentEffect;
}
