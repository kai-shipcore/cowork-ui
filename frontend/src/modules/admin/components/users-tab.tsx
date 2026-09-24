import { useState } from 'react';
import { Badge, BadgeDot } from '@coverland-engineering/ui/badge';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { MailX, Pencil, Send, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import { useOperations } from '@/app/operations-store';
import type { AppUserDto } from '../app-user-dto';
import {
  filterUsers,
  formatJoinedDate,
  type UserFilters,
} from '../user-management-model';
import {
  apiErrorMessage,
  useListAppRolesQuery,
  useListDepartmentsQuery,
  useListUsersQuery,
  useRevokeInvitationMutation,
  useSendInvitationMutation,
} from '../users-api';
import { UserAccessSheet } from './user-access-sheet';
import { UserDialog } from './user-dialog';
import { UserIdentity } from './user-identity';

const USER_STATUS: Record<
  AppUserDto['status'],
  { label: string; variant: 'success' | 'info' | 'warning' }
> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INVITED: { label: 'Invited', variant: 'info' },
  INACTIVE: { label: 'Inactive', variant: 'warning' },
};

type DialogState = { open: false } | { open: true; user?: AppUserDto };

const EMPTY_FILTERS: UserFilters = {
  query: '',
  departmentId: 'ALL',
  appRoleId: 'ALL',
  status: 'ALL',
};

/** Directory of accounts from `app_user`; new people are invited, existing ones edited. */
export function UsersTab() {
  const users = useListUsersQuery();
  const departments = useListDepartmentsQuery();
  const roles = useListAppRolesQuery();
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const hasActiveFilter =
    filters.query !== '' ||
    filters.departmentId !== 'ALL' ||
    filters.appRoleId !== 'ALL' ||
    filters.status !== 'ALL';
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [accessUser, setAccessUser] = useState<AppUserDto>();
  const [message, setMessage] = useState('');
  const [revokedUserIds, setRevokedUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { actor } = useOperations();
  const [sendInvitation] = useSendInvitationMutation();
  const [revokeInvitation, revokeState] = useRevokeInvitationMutation();

  // Until sign-in exists, the invitation is sent from the demo actor's account,
  // falling back to the SYSTEM account so the inviter is always an active user.
  const activeUsers = (users.data ?? []).filter(
    (user) => user.status === 'ACTIVE',
  );
  const inviter =
    activeUsers.find((user) =>
      user.name.toLowerCase().startsWith(actor.name.toLowerCase()),
    ) ??
    activeUsers.find((user) => user.name === 'SYSTEM') ??
    (activeUsers.length > 0 ? activeUsers[0] : undefined);

  async function resend(user: AppUserDto): Promise<void> {
    if (!inviter) return;
    try {
      const sent = await sendInvitation({
        appUserId: user.id,
        invitedBy: inviter.id,
      }).unwrap();
      setRevokedUserIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
      setMessage(`Invitation sent again to ${sent.inviteeEmail}.`);
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }

  async function revoke(user: AppUserDto): Promise<void> {
    try {
      await revokeInvitation(user.id).unwrap();
      setRevokedUserIds((current) => new Set(current).add(user.id));
      setMessage(`Invitation to ${user.email} revoked.`);
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }

  const visibleUsers = filterUsers(users.data ?? [], filters);

  const columns: FlatDataGridColumn<AppUserDto>[] = [
    {
      id: 'user',
      header: 'User',
      width: 200,
      sortValue: (user) => user.name,
      cell: (user) => <UserIdentity name={user.name} email={user.email} />,
    },
    {
      id: 'department',
      header: 'Department',
      width: 125,
      sortValue: (user) => user.departmentName,
      cell: (user) => <>{user.departmentName}</>,
    },
    {
      id: 'role',
      header: 'Role',
      width: 105,
      sortValue: (user) => user.appRoleName,
      cell: (user) => <Badge variant="secondary">{user.appRoleName}</Badge>,
    },
    {
      id: 'initial',
      header: 'Initial',
      label: 'Designer initial',
      width: 60,
      sortValue: (user) => user.designerInitial,
      cell: (user) =>
        user.designerInitial ? (
          <Badge variant="outline">{user.designerInitial}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 100,
      sortValue: (user) => user.status,
      cell: (user) => (
        <Badge variant={USER_STATUS[user.status].variant} appearance="ghost">
          <BadgeDot />
          {USER_STATUS[user.status].label}
        </Badge>
      ),
    },
    {
      id: 'joined',
      header: 'Joined',
      width: 125,
      sortValue: (user) => user.createdAt,
      cell: (user) => <>{formatJoinedDate(user.createdAt)}</>,
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 170,
      className: 'text-center',
      hideable: false,
      cell: (user) => {
        const canRevoke =
          user.status === 'INVITED' && !revokedUserIds.has(user.id);
        return (
          <div className="admin-row-actions">
            <Button
              size="sm"
              variant="outline"
              mode="icon"
              aria-label={`Manage access for ${user.name}`}
              title="Manage access"
              onClick={() => {
                setAccessUser(user);
              }}
            >
              <ShieldCheck />
            </Button>
            <Button
              size="sm"
              variant="outline"
              mode="icon"
              aria-label={`Edit ${user.name}`}
              title="Edit"
              onClick={() => {
                setDialog({ open: true, user });
              }}
            >
              <Pencil />
            </Button>
            {user.status === 'INVITED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  mode="icon"
                  aria-label={`Resend invitation to ${user.name}`}
                  title="Resend invitation"
                  disabled={!inviter}
                  onClick={() => {
                    void resend(user);
                  }}
                >
                  <Send />
                </Button>
                {canRevoke && (
                  <Button
                    size="sm"
                    variant="outline"
                    mode="icon"
                    aria-label={`Revoke invitation to ${user.name}`}
                    title="Revoke invitation"
                    disabled={revokeState.isLoading}
                    onClick={() => {
                      void revoke(user);
                    }}
                  >
                    <MailX />
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  const page = useSortedPage(
    visibleUsers,
    columns,
    `${filters.query}|${filters.departmentId}|${filters.appRoleId}|${filters.status}`,
  );

  return (
    <>
      <FlatDataGrid
        embedded
        label="Users"
        columns={columns}
        rows={page.pageItems}
        getRowId={(user) => user.id}
        isLoading={users.isLoading}
        error={
          users.isError
            ? 'Unable to read the saved users in this browser.'
            : undefined
        }
        emptyMessage={
          users.data?.length
            ? 'No users match these filters.'
            : 'No users in the database yet.'
        }
        search={{
          label: 'Search users',
          placeholder: 'Search users',
          value: filters.query,
          onChange: (query) => {
            setFilters((current) => ({ ...current, query }));
          },
        }}
        filters={[
          {
            id: 'department',
            label: 'Department filter',
            value: filters.departmentId,
            options: [
              { value: 'ALL', label: 'All Departments' },
              ...(departments.data ?? []).map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ],
            onChange: (departmentId) => {
              setFilters((current) => ({ ...current, departmentId }));
            },
          },
          {
            id: 'role',
            label: 'Role filter',
            value: filters.appRoleId,
            options: [
              { value: 'ALL', label: 'All Roles' },
              ...(roles.data ?? []).map((role) => ({
                value: role.id,
                label: role.name,
              })),
            ],
            onChange: (appRoleId) => {
              setFilters((current) => ({ ...current, appRoleId }));
            },
          },
          {
            id: 'status',
            label: 'Status filter',
            value: filters.status,
            options: [
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INVITED', label: 'Invited' },
              { value: 'INACTIVE', label: 'Inactive' },
            ],
            onChange: (value) => {
              setFilters((current) => ({
                ...current,
                status:
                  value in USER_STATUS
                    ? (value as UserFilters['status'])
                    : 'ALL',
              }));
            },
          },
        ]}
        toolbarContent={
          hasActiveFilter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
              }}
            >
              <X /> Clear filters
            </Button>
          )
        }
        actions={
          <Button
            variant="primary"
            disabled={!departments.data || !roles.data}
            onClick={() => {
              setDialog({ open: true });
            }}
          >
            <UserPlus /> Send invitation
          </Button>
        }
        footer={
          message ? (
            <p role="status" className="admin-muted">
              {message}
            </p>
          ) : undefined
        }
        pagination={page.pagination}
        sorting={page.sorting}
      />
      {dialog.open && (
        <UserDialog
          key={dialog.user?.id ?? 'new'}
          user={dialog.user}
          inviterId={inviter?.id}
          departments={departments.data ?? []}
          roles={roles.data ?? []}
          onClose={() => {
            setDialog({ open: false });
          }}
        />
      )}
      {accessUser && (
        <UserAccessSheet
          key={accessUser.id}
          user={accessUser}
          onClose={() => {
            setAccessUser(undefined);
          }}
        />
      )}
    </>
  );
}
