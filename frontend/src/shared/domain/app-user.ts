import type { AppUser } from '@/shared/types/workbench';

/**
 * Renders a stored actor reference as a display name.
 *
 * Assignee columns hold an `app_user.id`. Snapshots written before that
 * migration hold a bare name instead, so an unresolved value is returned
 * as-is rather than shown as a raw id.
 */
export function userName(
  users: readonly AppUser[],
  value: string | undefined,
): string {
  if (!value) return 'Unassigned';
  return users.find((user) => user.id === value)?.name ?? value;
}

/** The user record behind a stored reference, when it resolves. */
export function findUser(
  users: readonly AppUser[],
  value: string | undefined,
): AppUser | undefined {
  return value ? users.find((user) => user.id === value) : undefined;
}
