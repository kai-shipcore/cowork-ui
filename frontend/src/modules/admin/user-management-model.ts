import { z } from 'zod';
import { ROLE_IDS, type RoleId } from '@/constants/roles';
import type { AppUser } from '@/shared/types/workbench';

export const userRoleSchema = z.object({
  userId: z.string().min(1),
  roleIds: z.array(z.enum(ROLE_IDS)),
});
export const userRoleListSchema = z.array(userRoleSchema);
export type UserRoleRecord = z.infer<typeof userRoleSchema>;

export const invitationSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().trim().min(1).max(80),
  roleIds: z.array(z.enum(ROLE_IDS)).min(1),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED']),
  invitedBy: z.string(),
  invitedAt: z.string(),
  /** How many times the invitation email was sent, including the first. */
  sentCount: z.number().int().min(1),
  lastSentAt: z.string(),
  acceptedUserId: z.string().optional(),
});
export const invitationListSchema = z.array(invitationSchema);
export type Invitation = z.infer<typeof invitationSchema>;

export const USER_ROLE_KEY = 'coverland-user-roles-v1';
export const INVITATION_KEY = 'coverland-user-invitations-v1';

export const INVITATION_STATUS_LABELS: Record<Invitation['status'], string> = {
  PENDING: 'Invitation sent',
  ACCEPTED: 'Accepted',
  REVOKED: 'Revoked',
};

export const INVITATION_STATUS_TONES = {
  PENDING: 'progress',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
} as const;

/** Demo role assignments; users without a record are viewers. */
export const USER_ROLE_SEED: readonly UserRoleRecord[] = [
  { userId: 'USR-KAI', roleIds: ['DEVELOPER'] },
  { userId: 'USR-JH', roleIds: ['APPROVAL_MANAGER', 'RD_MEMBER'] },
  { userId: 'USR-YOUNG', roleIds: ['RD_MEMBER'] },
  { userId: 'USR-CHRISTIAN', roleIds: ['APPROVAL_MANAGER'] },
  { userId: 'USR-TAEHO', roleIds: ['RD_MEMBER'] },
  { userId: 'USR-MIN', roleIds: ['RD_MEMBER'] },
  { userId: 'USR-SOO', roleIds: ['RD_MEMBER'] },
];

export const INVITATION_SEED: readonly Invitation[] = [
  {
    id: 'INV-001',
    email: 'mina@coverland.com',
    name: 'Mina',
    roleIds: ['RD_MEMBER'],
    status: 'PENDING',
    invitedBy: 'Kai',
    invitedAt: '2026-09-20T17:30:00.000Z',
    sentCount: 1,
    lastSentAt: '2026-09-20T17:30:00.000Z',
  },
];

export function rolesOf(
  records: readonly UserRoleRecord[],
  userId: string,
): readonly RoleId[] {
  return records.find((record) => record.userId === userId)?.roleIds ?? [];
}

/** Adds or removes one role for a user, creating the record on first use. */
export function toggleRole(
  records: readonly UserRoleRecord[],
  userId: string,
  roleId: RoleId,
): UserRoleRecord[] {
  const existing = records.find((record) => record.userId === userId);
  const current = existing?.roleIds ?? [];
  const next = current.includes(roleId)
    ? current.filter((id) => id !== roleId)
    : [...current, roleId];
  return existing
    ? records.map((record) =>
        record.userId === userId ? { ...record, roleIds: next } : record,
      )
    : [...records, { userId, roleIds: next }];
}

/** `USR-MINA`, or `USR-MINA-2` when that id is already taken. */
export function newUserId(
  name: string,
  users: readonly Pick<AppUser, 'id'>[],
): string {
  const base = `USR-${name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
  let candidate = base;
  let suffix = 2;
  while (users.some((user) => user.id === candidate)) {
    candidate = `${base}-${String(suffix)}`;
    suffix += 1;
  }
  return candidate;
}

/** An address already in the directory or in an open invitation cannot be invited again. */
export function invitationConflict(
  email: string,
  users: readonly Pick<AppUser, 'email'>[],
  invitations: readonly Invitation[],
): string | undefined {
  const normalized = email.trim().toLowerCase();
  if (users.some((user) => user.email.toLowerCase() === normalized))
    return 'This address already belongs to a user.';
  if (
    invitations.some(
      (invitation) =>
        invitation.status === 'PENDING' &&
        invitation.email.toLowerCase() === normalized,
    )
  )
    return 'An invitation to this address is already pending.';
  return undefined;
}
