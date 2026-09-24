import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Check, Mail, Search, Send, UserPlus } from 'lucide-react';
import { PERMISSIONS, roleName, ROLES, type RoleId } from '@/constants/roles';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import type { AppUser } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  INVITATION_KEY,
  INVITATION_SEED,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_TONES,
  invitationConflict,
  invitationListSchema,
  invitationSchema,
  newUserId,
  rolesOf,
  toggleRole,
  USER_ROLE_KEY,
  USER_ROLE_SEED,
  userRoleListSchema,
} from '../user-management-model';
import '../admin.css';

const DEFAULT_INVITE_ROLES: readonly RoleId[] = ['RD_MEMBER'];

/** Users, their roles and approval grants, and invitations into the workspace. */
export function UserManagementPage() {
  const { actor } = useOperations();
  const { appUsers, approvalGrants, approvalTypes, updateWorkbench } =
    useWorkbenchStore();
  const roles = useRdRecords(USER_ROLE_KEY, userRoleListSchema, USER_ROLE_SEED);
  const invitations = useRdRecords(
    INVITATION_KEY,
    invitationListSchema,
    INVITATION_SEED,
  );
  const [query, setQuery] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoles, setInviteRoles] =
    useState<readonly RoleId[]>(DEFAULT_INVITE_ROLES);
  const [message, setMessage] = useState('');

  const visibleUsers = appUsers.filter((user) =>
    `${user.name} ${user.email} ${user.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const sortedInvitations = [...invitations.records].sort((a, b) =>
    b.invitedAt.localeCompare(a.invitedAt),
  );

  function grantSummary(userId: string): string {
    const parts = approvalTypes.flatMap((type) => {
      const grant = approvalGrants.find(
        (row) =>
          row.appUserId === userId &&
          row.approvalTypeId === type.id &&
          row.status === 'ACTIVE',
      );
      if (!grant) return [];
      const actions = [
        grant.canForward ? 'review' : '',
        grant.canFinalApprove ? 'final' : '',
      ].filter(Boolean);
      return [`${type.name}: ${actions.join(' + ')}`];
    });
    return parts.length ? parts.join(' · ') : 'None';
  }

  function setUserStatus(userId: string, status: AppUser['status']): void {
    updateWorkbench((state) => ({
      ...state,
      appUsers: state.appUsers.map((user) =>
        user.id === userId
          ? { ...user, status, updatedAt: new Date().toISOString() }
          : user,
      ),
    }));
  }

  function sendInvitation(): void {
    const conflict = invitationConflict(
      inviteEmail,
      appUsers,
      invitations.records,
    );
    if (conflict) {
      setMessage(conflict);
      return;
    }
    const now = new Date().toISOString();
    const parsed = invitationSchema.safeParse({
      id: crypto.randomUUID(),
      email: inviteEmail.trim(),
      name: inviteName,
      roleIds: inviteRoles,
      status: 'PENDING',
      invitedBy: actor.name,
      invitedAt: now,
      sentCount: 1,
      lastSentAt: now,
    });
    if (!parsed.success) {
      setMessage(
        parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(' / '),
      );
      return;
    }
    void invitations
      .save((current) => [...current, parsed.data])
      .then((ok) => {
        if (!ok) return;
        setInviteName('');
        setInviteEmail('');
        setInviteRoles(DEFAULT_INVITE_ROLES);
        setMessage(`Invitation sent to ${parsed.data.email}.`);
      });
  }

  function resend(invitationId: string): void {
    const now = new Date().toISOString();
    void invitations.save((current) =>
      current.map((invitation) =>
        invitation.id === invitationId
          ? {
              ...invitation,
              sentCount: invitation.sentCount + 1,
              lastSentAt: now,
            }
          : invitation,
      ),
    );
    setMessage('Invitation sent again.');
  }

  function revoke(invitationId: string): void {
    void invitations.save((current) =>
      current.map((invitation) =>
        invitation.id === invitationId
          ? { ...invitation, status: 'REVOKED' as const }
          : invitation,
      ),
    );
    setMessage('Invitation revoked.');
  }

  /** Stands in for the invitee signing in: creates the user with the invited roles. */
  function markAccepted(invitationId: string): void {
    const invitation = invitations.records.find(
      (row) => row.id === invitationId,
    );
    if (!invitation) return;
    const userId = newUserId(invitation.name, appUsers);
    const now = new Date().toISOString();
    updateWorkbench((state) => ({
      ...state,
      appUsers: [
        ...state.appUsers,
        {
          id: userId,
          email: invitation.email,
          name: invitation.name,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    void roles.save((current) => [
      ...current.filter((record) => record.userId !== userId),
      { userId, roleIds: [...invitation.roleIds] },
    ]);
    void invitations.save((current) =>
      current.map((row) =>
        row.id === invitationId
          ? { ...row, status: 'ACCEPTED' as const, acceptedUserId: userId }
          : row,
      ),
    );
    setMessage(`${invitation.name} joined as ${userId}.`);
  }

  return (
    <section className="admin-page">
      <PageHeader
        description="Who can sign in, which roles they hold, and who has been invited. Roles decide permissions; approval grants are managed under Approval Flow Management."
        tables={
          import.meta.env.DEV
            ? [{ name: 'app_user' }, { name: 'user_x_approval_type_grant' }]
            : undefined
        }
      />

      <section className="admin-card" aria-labelledby="admin-users-title">
        <header>
          <div>
            <h2 id="admin-users-title">Users</h2>
            <p>
              Toggle roles directly in the table. Deactivating a person keeps
              their history but removes them from pickers and approval routes.
            </p>
          </div>
          <span className="admin-badge">
            {appUsers.filter((user) => user.status === 'ACTIVE').length} active
            · {appUsers.length} total
          </span>
        </header>
        <div className="admin-toolbar">
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input
              aria-label="Search users"
              placeholder="Search name, email, or id"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Status</th>
              <th scope="col">Roles</th>
              <th scope="col">Approval grants</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => {
              const userRoles = rolesOf(roles.records, user.id);
              const active = user.status === 'ACTIVE';
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>
                      {user.email} · {user.id}
                    </small>
                  </td>
                  <td>
                    <StatusBadge
                      label={active ? 'Active' : 'Inactive'}
                      tone={active ? 'success' : 'neutral'}
                    />
                  </td>
                  <td>
                    <div
                      className="admin-role-chips"
                      role="group"
                      aria-label={`${user.name} roles`}
                    >
                      {ROLES.map((role) => (
                        <button
                          type="button"
                          className="admin-chip"
                          key={role.id}
                          aria-pressed={userRoles.includes(role.id)}
                          disabled={!active}
                          title={role.description}
                          onClick={() => {
                            void roles.save((current) =>
                              toggleRole(current, user.id, role.id),
                            );
                          }}
                        >
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <small>{grantSummary(user.id)}</small>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUserStatus(user.id, active ? 'INACTIVE' : 'ACTIVE');
                      }}
                    >
                      {active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleUsers.length === 0 && (
          <p className="admin-muted">No users match this search.</p>
        )}
      </section>

      <section className="admin-card" aria-labelledby="admin-invites-title">
        <header>
          <div>
            <h2 id="admin-invites-title">Invitations</h2>
            <p>
              Invite a colleague by email with the roles they should start with.
              Until sign-in is connected, "Mark accepted" stands in for the
              invitee joining.
            </p>
          </div>
          <span className="admin-badge">
            <Mail aria-hidden="true" size={13} />{' '}
            {
              invitations.records.filter((row) => row.status === 'PENDING')
                .length
            }{' '}
            pending
          </span>
        </header>
        <form
          className="admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            sendInvitation();
          }}
        >
          <label>
            Name
            <Input
              required
              maxLength={80}
              value={inviteName}
              placeholder="Mina"
              onChange={(event) => {
                setInviteName(event.target.value);
              }}
            />
          </label>
          <label>
            Work email
            <Input
              required
              type="email"
              value={inviteEmail}
              placeholder="name@coverland.com"
              onChange={(event) => {
                setInviteEmail(event.target.value);
              }}
            />
          </label>
          <div>
            <span
              className="admin-fields"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Starting roles
            </span>
            <div
              className="admin-role-chips"
              role="group"
              aria-label="Roles for the invitation"
            >
              {ROLES.map((role) => (
                <button
                  type="button"
                  className="admin-chip"
                  key={role.id}
                  aria-pressed={inviteRoles.includes(role.id)}
                  title={role.description}
                  onClick={() => {
                    setInviteRoles((current) =>
                      current.includes(role.id)
                        ? current.filter((id) => id !== role.id)
                        : [...current, role.id],
                    );
                  }}
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={
              !inviteName.trim() ||
              !inviteEmail.trim() ||
              inviteRoles.length === 0 ||
              invitations.saving
            }
          >
            <UserPlus /> Send invitation
          </Button>
        </form>
        <p role="status" className="admin-status admin-muted">
          {message || invitations.error || roles.error}
        </p>
        {sortedInvitations.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Invitee</th>
                <th scope="col">Roles</th>
                <th scope="col">Status</th>
                <th scope="col">Sent</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInvitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>
                    <strong>{invitation.name}</strong>
                    <small>{invitation.email}</small>
                  </td>
                  <td>
                    <small>
                      {invitation.roleIds.map((id) => roleName(id)).join(', ')}
                    </small>
                  </td>
                  <td>
                    <StatusBadge
                      label={INVITATION_STATUS_LABELS[invitation.status]}
                      tone={INVITATION_STATUS_TONES[invitation.status]}
                    />
                    {invitation.acceptedUserId && (
                      <small> · {invitation.acceptedUserId}</small>
                    )}
                  </td>
                  <td>
                    <small>
                      {invitation.sentCount}× · last{' '}
                      {invitation.lastSentAt.slice(0, 10)} · by{' '}
                      {invitation.invitedBy}
                    </small>
                  </td>
                  <td>
                    {invitation.status === 'PENDING' && (
                      <div className="admin-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resend(invitation.id);
                          }}
                        >
                          <Send /> Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            markAccepted(invitation.id);
                          }}
                        >
                          <Check /> Mark accepted
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            revoke(invitation.id);
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card" aria-labelledby="admin-roles-title">
        <header>
          <div>
            <h2 id="admin-roles-title">Roles and permissions</h2>
            <p>
              What each role allows. Roles are assigned per user above;
              permissions are fixed per role.
            </p>
          </div>
        </header>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Role</th>
              {Object.entries(PERMISSIONS).map(([key, label]) => (
                <th scope="col" key={key} title={label}>
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role.id}>
                <td>
                  <strong>{role.name}</strong>
                  <small>{role.description}</small>
                </td>
                {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).map(
                  (permission) => (
                    <td key={permission} className="is-center">
                      {role.permissions.includes(permission) ? (
                        <Check aria-label="Granted" size={16} />
                      ) : (
                        <span aria-label="Not granted">—</span>
                      )}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
