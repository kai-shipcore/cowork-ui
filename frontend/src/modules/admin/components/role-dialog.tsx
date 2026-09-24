import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import type {
  AppRoleDto,
  AppRoleInput,
  DepartmentDto,
  PermissionDto,
} from '../app-user-dto';
import {
  apiErrorMessage,
  useCreateAppRoleMutation,
  useSetRolePermissionsMutation,
  useUpdateAppRoleMutation,
} from '../users-api';

interface RoleDialogProps {
  /** Role being edited; omit to create a new one. */
  role?: AppRoleDto;
  departments: readonly DepartmentDto[];
  permissions: readonly PermissionDto[];
  /** `role_x_permission` links the role currently has. */
  grantedPermissionIds: readonly string[];
  onClose: () => void;
}

/** Create/edit form for one `app_role` row and its `role_x_permission` links. */
export function RoleDialog({
  role,
  departments,
  permissions,
  grantedPermissionIds,
  onClose,
}: RoleDialogProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [departmentId, setDepartmentId] = useState(role?.departmentId ?? '');
  const [permissionIds, setPermissionIds] =
    useState<readonly string[]>(grantedPermissionIds);
  const [error, setError] = useState('');
  const [createRole, createState] = useCreateAppRoleMutation();
  const [updateRole, updateState] = useUpdateAppRoleMutation();
  const [setRolePermissions, linkState] = useSetRolePermissionsMutation();

  const normalizedCode = code.trim().toUpperCase();
  const canSave =
    name.trim().length > 0 && normalizedCode.length > 0 && departmentId !== '';
  const isBusy =
    createState.isLoading || updateState.isLoading || linkState.isLoading;

  async function save(): Promise<void> {
    const input: AppRoleInput = {
      departmentId,
      code: normalizedCode,
      name: name.trim(),
    };
    try {
      const saved = await (role
        ? updateRole({ id: role.id, input }).unwrap()
        : createRole(input).unwrap());
      await setRolePermissions({
        appRoleId: saved.id,
        permissionIds: [...permissionIds],
      }).unwrap();
      onClose();
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Add Role'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <label className="full-width">
            Name
            <Input
              placeholder="Enter role name"
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
              placeholder="Example: DESIGNER"
              maxLength={40}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
            />
          </label>
          <label>
            Department
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger aria-label="Department">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem value={department.id} key={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <fieldset className="full-width admin-permission-list">
            <legend>Permissions</legend>
            {permissions.length === 0 && (
              <span className="admin-muted">No permissions defined yet.</span>
            )}
            {permissions.map((permission) => (
              <label key={permission.id} className="admin-permission-option">
                <input
                  type="checkbox"
                  className="admin-grant-checkbox"
                  checked={permissionIds.includes(permission.id)}
                  onChange={(event) => {
                    setPermissionIds((current) =>
                      event.target.checked
                        ? [...current, permission.id]
                        : current.filter((id) => id !== permission.id),
                    );
                  }}
                />
                <span>
                  {permission.code}
                  <small>{permission.name}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="dialog-note">
            Codes are saved in uppercase and must be unique within the
            department.
            {normalizedCode && ` Code to save: ${normalizedCode}`}
          </div>
          {error && <div className="dialog-error">{error}</div>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave || isBusy}
            onClick={() => {
              void save();
            }}
          >
            {role ? 'Save changes' : 'Add role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
