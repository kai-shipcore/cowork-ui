import type { AppUser, AppUserStatus } from '../domain/app-user.js';
import type { Invitation, InvitationStatus } from '../domain/invitation.js';

/** Wire shape of a staff account; timestamps are ISO-8601 strings. */
export interface AppUserDto {
  id: string;
  email: string;
  name: string;
  status: AppUserStatus;
  designerInitial?: string;
  departmentId: string;
  departmentName: string;
  appRoleId: string;
  appRoleName: string;
  createdAt: string;
  updatedAt: string;
}

export function toAppUserDto(user: AppUser): AppUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    ...(user.designerInitial === undefined ? {} : { designerInitial: user.designerInitial }),
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    appRoleId: user.appRoleId,
    appRoleName: user.appRoleName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Wire shape of an invitation; timestamps are ISO-8601 strings. */
export interface InvitationDto {
  id: string;
  appUserId: string;
  inviteeName: string;
  inviteeEmail: string;
  invitedBy: string;
  inviterName: string;
  status: InvitationStatus;
  expiresAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function toInvitationDto(invitation: Invitation): InvitationDto {
  return {
    id: invitation.id,
    appUserId: invitation.appUserId,
    inviteeName: invitation.inviteeName,
    inviteeEmail: invitation.inviteeEmail,
    invitedBy: invitation.invitedBy,
    inviterName: invitation.inviterName,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    ...(invitation.closedAt === undefined ? {} : { closedAt: invitation.closedAt.toISOString() }),
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  };
}
