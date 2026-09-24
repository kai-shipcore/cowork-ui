import { useState } from 'react';
import { Badge } from '@coverland-engineering/ui/badge';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
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
import { Input } from '@coverland-engineering/ui/input';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import type { DepartmentDto } from '../app-user-dto';
import {
  apiErrorMessage,
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useListAppRolesQuery,
  useListDepartmentsQuery,
  useListUsersQuery,
  useUpdateDepartmentMutation,
} from '../users-api';

type DialogState = { open: false } | { open: true; department?: DepartmentDto };

export function DepartmentsTab() {
  const departments = useListDepartmentsQuery();
  const users = useListUsersQuery();
  const roles = useListAppRolesQuery();
  const [createDepartment] = useCreateDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<DepartmentDto>();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  function userCount(id: string): number {
    return (users.data ?? []).filter((user) => user.departmentId === id).length;
  }
  function roleCount(id: string): number {
    return (roles.data ?? []).filter((role) => role.departmentId === id).length;
  }
  function openEditor(department?: DepartmentDto): void {
    setName(department?.name ?? '');
    setCode(department?.code ?? '');
    setMessage('');
    setDialog({ open: true, department });
  }
  async function save(): Promise<void> {
    try {
      if (!dialog.open) return;
      const input = { name: name.trim(), code: code.trim() };
      if (dialog.department) {
        await updateDepartment({ id: dialog.department.id, input }).unwrap();
      } else {
        await createDepartment(input).unwrap();
      }
      setDialog({ open: false });
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }
  async function remove(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deleteDepartment(deleteTarget.id).unwrap();
      setDeleteTarget(undefined);
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }

  const needle = query.trim().toLowerCase();
  const rows = (departments.data ?? []).filter(
    (department) =>
      !needle ||
      `${department.name} ${department.code}`.toLowerCase().includes(needle),
  );
  const columns: FlatDataGridColumn<DepartmentDto>[] = [
    {
      id: 'department',
      header: 'Department',
      width: 280,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div className="text-sm font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.code}</div>
        </div>
      ),
    },
    {
      id: 'users',
      header: 'Users',
      width: 120,
      sortValue: (row) => userCount(row.id),
      cell: (row) => <Badge variant="secondary">{userCount(row.id)}</Badge>,
    },
    {
      id: 'roles',
      header: 'Roles',
      width: 120,
      sortValue: (row) => roleCount(row.id),
      cell: (row) => <Badge variant="secondary">{roleCount(row.id)}</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 120,
      className: 'text-center',
      hideable: false,
      cell: (row) => {
        const isInUse = userCount(row.id) > 0 || roleCount(row.id) > 0;
        return (
          <div className="admin-row-actions">
            <Button
              size="sm"
              variant="outline"
              mode="icon"
              aria-label={`Edit ${row.name}`}
              title="Edit department"
              onClick={() => {
                openEditor(row);
              }}
            >
              <Pencil />
            </Button>
            <Button
              size="sm"
              variant="outline"
              mode="icon"
              aria-label={`Delete ${row.name}`}
              disabled={isInUse}
              title={
                isInUse
                  ? 'Departments assigned to users or roles cannot be deleted.'
                  : 'Delete department'
              }
              onClick={() => {
                setDeleteTarget(row);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        );
      },
    },
  ];
  const page = useSortedPage(rows, columns, query);

  return (
    <>
      <FlatDataGrid
        embedded
        label="Departments"
        columns={columns}
        rows={page.pageItems}
        getRowId={(row) => row.id}
        isLoading={departments.isLoading}
        error={departments.isError ? 'Unable to load departments.' : undefined}
        emptyMessage="No departments match this search."
        search={{
          label: 'Search departments',
          placeholder: 'Search department or code',
          value: query,
          onChange: setQuery,
        }}
        toolbarContent={
          query && (
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
              openEditor();
            }}
          >
            <Plus /> Add department
          </Button>
        }
        pagination={page.pagination}
        sorting={page.sorting}
      />

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDialog({ open: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.open && dialog.department
                ? 'Edit department'
                : 'Add department'}
            </DialogTitle>
            <DialogDescription>
              The code is used as the stable internal identifier.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Name
              <Input
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </label>
            <label>
              Code
              <Input
                maxLength={40}
                disabled={dialog.open && dialog.department !== undefined}
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]/g, '_'),
                  );
                }}
              />
            </label>
            {message && <p className="admin-form-error">{message}</p>}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialog({ open: false });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || !code.trim()}
              onClick={() => void save()}
            >
              Save department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Delete department?</DialogTitle>
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
            <Button variant="destructive" onClick={() => void remove()}>
              <Trash2 /> Delete department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
