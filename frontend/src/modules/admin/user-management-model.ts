import type { AppUserDto } from './app-user-dto';

export interface UserFilters {
  query: string;
  /** A `department.id`, or `'ALL'`. */
  departmentId: string;
  /** An `app_role.id`, or `'ALL'`. */
  appRoleId: string;
  status: AppUserDto['status'] | 'ALL';
}

/** Directory rows matching the search box and the role and status selects. */
export function filterUsers(
  users: readonly AppUserDto[],
  { query, departmentId, appRoleId, status }: UserFilters,
): AppUserDto[] {
  const needle = query.trim().toLowerCase();
  return users.filter(
    (user) =>
      (status === 'ALL' || user.status === status) &&
      (departmentId === 'ALL' || user.departmentId === departmentId) &&
      (appRoleId === 'ALL' || user.appRoleId === appRoleId) &&
      (!needle ||
        `${user.name} ${user.email} ${user.id}`.toLowerCase().includes(needle)),
  );
}

/** Up to three initials for the avatar: `Jane Kim` → `JK`, `User 635` → `U6`. */
export function userInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return initials || '?';
}

/** `September 8, 2026`, or a dash when the timestamp does not parse. */
export function formatJoinedDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
