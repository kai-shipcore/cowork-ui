/**
 * Application roles and the permissions they carry. Until real auth lands the
 * assignments live in the browser (see the admin User Management screen); the
 * names match what the backend permission tables will use.
 */
export const PERMISSIONS = {
  APPROVAL_MANAGE: 'Manage approval types and grants',
  USER_MANAGE: 'Manage users, roles and invitations',
  RD_EDIT: 'Edit R&D records',
  RD_VIEW: 'View R&D records',
} as const;
export type Permission = keyof typeof PERMISSIONS;

export const ROLE_IDS = [
  'DEVELOPER',
  'APPROVAL_MANAGER',
  'RD_MEMBER',
  'VIEWER',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const ROLES: readonly RoleDefinition[] = [
  {
    id: 'DEVELOPER',
    name: 'Developer',
    description: 'Everything, including local approval administration.',
    permissions: ['APPROVAL_MANAGE', 'USER_MANAGE', 'RD_EDIT', 'RD_VIEW'],
  },
  {
    id: 'APPROVAL_MANAGER',
    name: 'Approval manager',
    description: 'Decides who may review and finally approve each type.',
    permissions: ['APPROVAL_MANAGE', 'RD_VIEW'],
  },
  {
    id: 'RD_MEMBER',
    name: 'R&D member',
    description: 'Works on research, projects, samples and registrations.',
    permissions: ['RD_EDIT', 'RD_VIEW'],
  },
  {
    id: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to R&D screens.',
    permissions: ['RD_VIEW'],
  },
];

export function roleName(roleId: RoleId): string {
  return ROLES.find((role) => role.id === roleId)?.name ?? roleId;
}

/** The union of permissions across the given roles, in declaration order. */
export function permissionsOf(roleIds: readonly RoleId[]): Permission[] {
  const granted = new Set(
    ROLES.filter((role) => roleIds.includes(role.id)).flatMap(
      (role) => role.permissions,
    ),
  );
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    granted.has(permission),
  );
}
