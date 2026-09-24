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
import type { PermissionDto } from '../app-user-dto';
import {
  apiErrorMessage,
  useDeletePermissionMutation,
  useListAppRolesQuery,
  useListPermissionAssignmentsQuery,
  useListPermissionsQuery,
  useListRolePermissionsQuery,
} from '../users-api';
import { PermissionDialog } from './permission-dialog';

type DialogState =
  | { open: false }
  | { open: true; kind: 'permission'; permission?: PermissionDto };

/**
 * `permission` rows, which roles grant each one (`role_x_permission`), and
 * per-user permissions (`user_x_permission_assignment`).
 */
export function PermissionsTab() {
  const permissions = useListPermissionsQuery();
  const roles = useListAppRolesQuery();
  const rolePermissions = useListRolePermissionsQuery();
  const assignments = useListPermissionAssignmentsQuery();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PermissionDto>();
  const [deletePermission] = useDeletePermissionMutation();

  async function removePermission(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deletePermission(deleteTarget.id).unwrap();
      setMessage(`Permission ${deleteTarget.code} deleted.`);
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
    setDeleteTarget(undefined);
  }
  const [message, setMessage] = useState('');

  function rolesGranting(permissionId: string): string[] {
    const roleIds = (rolePermissions.data ?? [])
      .filter((link) => link.permissionId === permissionId)
      .map((link) => link.appRoleId);
    return (roles.data ?? [])
      .filter((role) => roleIds.includes(role.id))
      .map((role) => role.name);
  }

  function userPermissionCount(permissionId: string): number {
    return (assignments.data ?? []).filter(
      (assignment) => assignment.permissionId === permissionId,
    ).length;
  }

  const needle = query.trim().toLowerCase();
  const visiblePermissions = (permissions.data ?? []).filter(
    (permission) =>
      !needle ||
      `${permission.code} ${permission.name}`.toLowerCase().includes(needle),
  );

  const permissionColumns: FlatDataGridColumn<PermissionDto>[] = [
    {
      id: 'code',
      header: 'Code',
      width: 170,
      sortValue: (permission) => permission.code,
      cell: (permission) => (
        <span className="text-sm font-medium">{permission.code}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      width: 200,
      sortValue: (permission) => permission.name,
      cell: (permission) => <>{permission.name}</>,
    },
    {
      id: 'roles',
      header: 'Granted by roles',
      width: 220,
      sortValue: (permission) => rolesGranting(permission.id).length,
      cell: (permission) => {
        const names = rolesGranting(permission.id);
        return names.length ? (
          <div className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'userPermissions',
      header: 'User permissions',
      width: 110,
      sortValue: (permission) => userPermissionCount(permission.id),
      cell: (permission) => (
        <Badge variant="secondary">{userPermissionCount(permission.id)}</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 120,
      className: 'text-center',
      hideable: false,
      cell: (permission) => (
        <div className="admin-row-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`Edit ${permission.code}`}
            title="Edit"
            onClick={() => {
              setDialog({ open: true, kind: 'permission', permission });
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`Delete ${permission.code}`}
            disabled={false}
            title={'Delete'}
            onClick={() => {
              setDeleteTarget(permission);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const permissionPage = useSortedPage(
    visiblePermissions,
    permissionColumns,
    query,
  );

  const loadError =
    permissions.isError || roles.isError || rolePermissions.isError;

  return (
    <div className="admin-tab-panel">
      <FlatDataGrid
        embedded
        label="Permissions"
        columns={permissionColumns}
        rows={permissionPage.pageItems}
        getRowId={(permission) => permission.id}
        isLoading={permissions.isLoading}
        error={
          loadError
            ? 'Unable to read the saved permissions in this browser.'
            : undefined
        }
        emptyMessage={
          permissions.data?.length
            ? 'No permissions match this search.'
            : 'No permissions in the database yet.'
        }
        search={{
          label: 'Search permissions',
          placeholder: 'Search code or name',
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
            onClick={() => {
              setDialog({ open: true, kind: 'permission' });
            }}
          >
            <Plus /> Add permission
          </Button>
        }
        footer={
          message ? (
            <p role="status" className="admin-muted">
              {message}
            </p>
          ) : undefined
        }
        pagination={permissionPage.pagination}
        sorting={permissionPage.sorting}
      />

      {dialog.open && (
        <PermissionDialog
          key={dialog.permission?.id ?? 'new'}
          permission={dialog.permission}
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
            <DialogTitle>Delete permission?</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.code}? Role links and user permissions for
              it are removed as well. This cannot be undone.
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
                void removePermission();
              }}
            >
              <Trash2 /> Delete permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
