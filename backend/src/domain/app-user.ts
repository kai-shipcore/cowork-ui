/** Matches the `app_user_status_check` constraint on `app_user`. */
export const APP_USER_STATUSES = ['INVITED', 'ACTIVE', 'INACTIVE'] as const;
export type AppUserStatus = (typeof APP_USER_STATUSES)[number];

/** A row of `department`. */
export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentInput {
  code: string;
  name: string;
}

/** A row of `app_role`; every role belongs to one department. */
export interface AppRole {
  id: string;
  departmentId: string;
  code: string;
  name: string;
}

/** A staff account (`app_user`) with its department and role resolved. Accounts are deactivated, never deleted. */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  status: AppUserStatus;
  /** Rendered into pattern names; absent when the person is not a designer. */
  designerInitial?: string;
  departmentId: string;
  departmentName: string;
  appRoleId: string;
  appRoleName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Everything an operator supplies when creating or editing an account. */
export interface AppUserInput {
  name: string;
  email: string;
  status: AppUserStatus;
  designerInitial?: string;
  departmentId: string;
  appRoleId: string;
}

export function isAppUserStatus(value: string): value is AppUserStatus {
  return (APP_USER_STATUSES as readonly string[]).includes(value);
}

/** Everything an operator supplies when creating or editing a role. */
export interface AppRoleInput {
  departmentId: string;
  code: string;
  name: string;
}
