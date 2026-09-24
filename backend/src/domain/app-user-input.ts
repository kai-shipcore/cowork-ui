import {
  isAppUserStatus,
  type AppRoleInput,
  type AppUserInput,
  type DepartmentInput,
} from './app-user.js';
import { ValidationError } from './errors.js';
import type { InvitationInput } from './invitation.js';
import {
  isAssignmentEffect,
  type PermissionAssignmentInput,
  type PermissionInput,
} from './permission.js';

const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const DESIGNER_INITIAL_MAX_LENGTH = 8;
const ROLE_CODE_MAX_LENGTH = 40;
/** Matches the seeded codes (`DEVELOPER`, `R_AND_D`): upper snake case. */
const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const PERMISSION_CODE_MAX_LENGTH = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readText(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Turns an untrusted request body into a validated {@link AppUserInput}.
 * Throws {@link ValidationError} naming the first offending field.
 */
export function parseAppUserInput(raw: unknown): AppUserInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const source = raw as Record<string, unknown>;

  const name = readText(source, 'name');
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required and at most ${String(NAME_MAX_LENGTH)} characters`);
  }

  const email = readText(source, 'email');
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    throw new ValidationError('email must be a valid address');
  }

  const departmentId = readText(source, 'departmentId');
  if (!isUuid(departmentId)) {
    throw new ValidationError('departmentId must be a department id');
  }

  const appRoleId = readText(source, 'appRoleId');
  if (!isUuid(appRoleId)) {
    throw new ValidationError('appRoleId must be a role id');
  }

  const status = source.status === undefined ? 'ACTIVE' : readText(source, 'status');
  if (!isAppUserStatus(status)) {
    throw new ValidationError('status must be INVITED, ACTIVE or INACTIVE');
  }

  const designerInitial = readText(source, 'designerInitial');
  if (designerInitial.length > DESIGNER_INITIAL_MAX_LENGTH) {
    throw new ValidationError(
      `designerInitial is at most ${String(DESIGNER_INITIAL_MAX_LENGTH)} characters`,
    );
  }

  return {
    name,
    email,
    status,
    ...(designerInitial ? { designerInitial } : {}),
    departmentId,
    appRoleId,
  };
}

/**
 * Turns an untrusted request body into a validated {@link AppRoleInput}.
 * The code is upper-cased so `designer` and `DESIGNER` cannot coexist in a department.
 */
export function parseAppRoleInput(raw: unknown): AppRoleInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const source = raw as Record<string, unknown>;

  const departmentId = readText(source, 'departmentId');
  if (!isUuid(departmentId)) {
    throw new ValidationError('departmentId must be a department id');
  }

  const code = readText(source, 'code').toUpperCase();
  if (!ROLE_CODE_PATTERN.test(code) || code.length > ROLE_CODE_MAX_LENGTH) {
    throw new ValidationError(
      `code must be letters, digits and underscores, at most ${String(ROLE_CODE_MAX_LENGTH)} characters`,
    );
  }

  const name = readText(source, 'name');
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required and at most ${String(NAME_MAX_LENGTH)} characters`);
  }

  return { departmentId, code, name };
}

/** Turns an untrusted request body into a validated department name and stable code. */
export function parseDepartmentInput(raw: unknown): DepartmentInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const source = raw as Record<string, unknown>;
  const code = readText(source, 'code').toUpperCase();
  if (!ROLE_CODE_PATTERN.test(code) || code.length > ROLE_CODE_MAX_LENGTH) {
    throw new ValidationError(
      `code must be letters, digits and underscores, at most ${String(ROLE_CODE_MAX_LENGTH)} characters`,
    );
  }
  const name = readText(source, 'name');
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required and at most ${String(NAME_MAX_LENGTH)} characters`);
  }
  return { code, name };
}

/** Turns an untrusted request body into a validated {@link InvitationInput}. */
export function parseInvitationInput(raw: unknown): InvitationInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const source = raw as Record<string, unknown>;

  const appUserId = readText(source, 'appUserId');
  if (!isUuid(appUserId)) {
    throw new ValidationError('appUserId must be a user id');
  }

  const invitedBy = readText(source, 'invitedBy');
  if (!isUuid(invitedBy)) {
    throw new ValidationError('invitedBy must be a user id');
  }

  return { appUserId, invitedBy };
}

function readObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return raw as Record<string, unknown>;
}

/** Turns an untrusted request body into a validated {@link PermissionInput}; codes are upper snake case. */
export function parsePermissionInput(raw: unknown): PermissionInput {
  const source = readObject(raw);
  const code = readText(source, 'code').toUpperCase();
  if (!ROLE_CODE_PATTERN.test(code) || code.length > PERMISSION_CODE_MAX_LENGTH) {
    throw new ValidationError(
      `code must be letters, digits and underscores, at most ${String(PERMISSION_CODE_MAX_LENGTH)} characters`,
    );
  }
  const name = readText(source, 'name');
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required and at most ${String(NAME_MAX_LENGTH)} characters`);
  }
  return { code, name };
}

/** `{ permissionIds: [...] }` with every entry a uuid; duplicates are dropped. */
export function parsePermissionIds(raw: unknown): string[] {
  const source = readObject(raw);
  const ids = source.permissionIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !isUuid(id))) {
    throw new ValidationError('permissionIds must be a list of permission ids');
  }
  return [...new Set(ids as string[])];
}

/** Turns an untrusted request body into a validated {@link PermissionAssignmentInput}. */
export function parsePermissionAssignmentInput(raw: unknown): PermissionAssignmentInput {
  const source = readObject(raw);
  const appUserId = readText(source, 'appUserId');
  if (!isUuid(appUserId)) {
    throw new ValidationError('appUserId must be a user id');
  }
  const permissionId = readText(source, 'permissionId');
  if (!isUuid(permissionId)) {
    throw new ValidationError('permissionId must be a permission id');
  }
  const effect = readText(source, 'effect');
  if (!isAssignmentEffect(effect)) {
    throw new ValidationError('effect must be ALLOW or DENY');
  }
  return { appUserId, permissionId, effect };
}
