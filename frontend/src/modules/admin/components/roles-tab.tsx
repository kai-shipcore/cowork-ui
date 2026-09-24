import { useState } from 'react';
import { Badge } from '@coverland-engineering/ui/badge';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import type { AppRoleDto } from '../app-user-dto';
import {
  apiErrorMessage,
  useDeleteAppRoleMutation,
  useListAppRolesQuery,
  useListDepartmentsQuery,
  useListPermissionsQuery,
  useListRolePermissionsQuery,
  useListUsersQuery,
} from '../users-api';
import { RoleDialog } from './role-dialog';

type DialogState = { open: false } | { open: true; role?: AppRoleDto };

/** The roles in `app_role`, their department, members and permissions. Rows open the edit dialog. */
export function RolesTab() {
  const roles = useListAppRolesQuery();
  const departments = useListDepartmentsQuery();
  const users = useListUsersQuery();
  const permissions = useListPermissionsQuery();
  const rolePermissions = useListRolePermissionsQuery();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<AppRoleDto>();
  const [message, setMessage] = useState('');
  const [deleteRole] = useDeleteAppRoleMutation();

  async function removeRole(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.id).unwrap();
      setMessage(`Role ${deleteTarget.name} deleted.`);
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
    setDeleteTarget(undefined);
  }

  function departmentName(departmentId: string): string {
    return (
      departments.data?.find((department) => department.id === departmentId)
        ?.name ?? departmentId
    );
  }

  function memberCount(roleId: string): number {
    return (users.data ?? []).filter((user) => user.appRoleId === roleId)
      .length;
  }

  function permissionIdsOf(roleId: string): string[] {
    return (rolePermissions.data ?? [])
      .filter((link) => link.appRoleId === roleId)
      .map((link) => link.permissionId);
  }

  function permissionCodesOf(roleId: string): string[] {
    const ids = permissionIdsOf(roleId);
    return (permissions.data ?? [])
      .filter((permission) => ids.includes(permission.id))
      .map((permission) => permission.code);
  }

  const needle = query.trim().toLowerCase();
  const visibleRoles = (roles.data ?? []).filter(
    (role) =>
      !needle ||
      `${role.name} ${role.code} ${departmentName(role.departmentId)}`
        .toLowerCase()
        .includes(needle),
  );

  const columns: FlatDataGridColumn<AppRoleDto>[] = [
    {
      id: 'role',
      header: 'Role',
      width: 200,
      sortValue: (role) => role.name,
      cell: (role) => (
        <div className="min-w-0">
          <div className="text-sm font-medium">{role.name}</div>
          <div className="text-xs text-muted-foreground">{role.code}</div>
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      width: 180,
      sortValue: (role) => departmentName(role.departmentId),
      cell: (role) => <>{departmentName(role.departmentId)}</>,
    },
    {
      id: 'members',
      header: 'Members',
      width: 100,
      sortValue: (role) => memberCount(role.id),
      cell: (role) => <Badge variant="secondary">{memberCount(role.id)}</Badge>,
    },
    {
      id: 'permissions',
      header: 'Permissions',
      width: 250,
      sortValue: (role) => permissionCodesOf(role.id).length,
      cell: (role) => {
        const codes = permissionCodesOf(role.id);
        return codes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {codes.map((code) => (
              <Badge key={code} variant="outline">
                {code}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 120,
      className: 'text-center',
      hideable: false,
      cell: (role) => (
        <div className="admin-row-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`Edit ${role.name}`}
            title="Edit"
            onClick={() => {
              setDialog({ open: true, role });
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`Delete ${role.name}`}
            disabled={memberCount(role.id) > 0}
            title={
              memberCount(role.id) > 0
                ? 'Reassign the users holding this role first.'
                : 'Delete'
            }
            onClick={() => {
              setDeleteTarget(role);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const page = useSortedPage(visibleRoles, columns, query);

  return (
    <>
      <FlatDataGrid
        embedded
        label="Roles"
        columns={columns}
        rows={page.pageItems}
        getRowId={(role) => role.id}
        isLoading={roles.isLoading}
        error={
          roles.isError
            ? 'Unable to read the saved roles in this browser.'
            : undefined
        }
        emptyMessage={
          roles.data?.length
            ? 'No roles match this search.'
            : 'No roles in the database yet.'
        }
        search={{
          label: 'Search roles',
          placeholder: 'Search role, code or department',
          value: query,
          onChange: setQuery,
        }}
        toolbarContent={
          query !== '' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('');
              }}
            >
              <X /> Clear filters
            </Button>
          )
        }
        actions={
          <Button
            variant="primary"
            disabled={!departments.data}
            onClick={() => {
              setDialog({ open: true });
            }}
          >
            <Plus /> Add role
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
        <RoleDialog
          key={dialog.role?.id ?? 'new'}
          role={dialog.role}
          departments={departments.data ?? []}
          permissions={permissions.data ?? []}
          grantedPermissionIds={
            dialog.role ? permissionIdsOf(dialog.role.id) : []
          }
          onClose={() => {
            setDialog({ open: false });
          }}
        />
      )}
      <Dialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void removeRole();
              }}
            >
              <Trash2 /> Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
