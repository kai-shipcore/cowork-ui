/** Matches the `user_invitation_status_check` constraint. */
export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** Statuses a pending invitation can be closed with; `closed_at` is set at the same time. */
export type ClosedInvitationStatus = Exclude<InvitationStatus, 'PENDING'>;

/** Invitations stay valid this long; matches what the Coverland_Workbench API issues. */
export const INVITATION_TTL_DAYS = 7;

/**
 * One invitation issued to an `INVITED` account (`user_invitation`), with the
 * invitee and inviter resolved for display. The secret itself is never read back.
 */
export interface Invitation {
  id: string;
  appUserId: string;
  inviteeName: string;
  inviteeEmail: string;
  invitedBy: string;
  inviterName: string;
  status: InvitationStatus;
  expiresAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** What an operator supplies to send (or resend) an invitation. */
export interface InvitationInput {
  appUserId: string;
  invitedBy: string;
}

/** What the repository stores for a new invitation. */
export interface NewInvitation extends InvitationInput {
  /** SHA-256 digest of the one-time secret, exactly 32 bytes. */
  secretHash: Uint8Array;
  expiresAt: Date;
}

export function isInvitationStatus(value: string): value is InvitationStatus {
  return (INVITATION_STATUSES as readonly string[]).includes(value);
}
