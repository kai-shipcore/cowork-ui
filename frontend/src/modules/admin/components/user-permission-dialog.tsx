import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  UserPicker,
  type UserPickerUser,
} from '@coverland-engineering/ui/user-picker';
import {
  ASSIGNMENT_EFFECTS,
  type AssignmentEffect,
  type PermissionDto,
} from '../app-user-dto';
import {
  apiErrorMessage,
  useCreatePermissionAssignmentMutation,
} from '../users-api';

const EFFECT_LABELS: Record<AssignmentEffect, string> = {
  ALLOW: 'Allow',
  DENY: 'Deny',
};

interface UserPermissionDialogProps {
  users: readonly UserPickerUser[];
  permissions: readonly PermissionDto[];
  onClose: () => void;
}

/** Adds one `user_x_permission_assignment` row: a user, a permission, and whether it is allowed or denied. */
export function UserPermissionDialog({
  users,
  permissions,
  onClose,
}: UserPermissionDialogProps) {
  const [appUserId, setAppUserId] = useState<string>();
  const [permissionId, setPermissionId] = useState('');
  const [effect, setEffect] = useState<AssignmentEffect>('ALLOW');
  const [error, setError] = useState('');
  const [createAssignment, createState] =
    useCreatePermissionAssignmentMutation();

  async function save(): Promise<void> {
    if (!appUserId || !permissionId) return;
    try {
      await createAssignment({ appUserId, permissionId, effect }).unwrap();
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
          <DialogTitle>Add User Permission</DialogTitle>
          <DialogDescription>
            A user permission applies to one user on top of what their role
            grants: allow it, or deny it even if the role grants it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <label className="full-width">
            User
            <UserPicker
              label="User"
              value={users.find((user) => user.id === appUserId)}
              users={users}
              placeholder="Select a user"
              searchPlaceholder="Search name or email…"
              emptyMessage="No matching users."
              className="mt-1.5 w-full"
              onChange={setAppUserId}
            />
          </label>
          <label>
            Permission
            <Select value={permissionId} onValueChange={setPermissionId}>
              <SelectTrigger aria-label="Permission">
                <SelectValue placeholder="Select a permission" />
              </SelectTrigger>
              <SelectContent>
                {permissions.map((permission) => (
                  <SelectItem value={permission.id} key={permission.id}>
                    {permission.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Effect
            <Select
              value={effect}
              onValueChange={(value) => {
                // The options are exactly ASSIGNMENT_EFFECTS.
                setEffect(value as AssignmentEffect);
              }}
            >
              <SelectTrigger aria-label="Effect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNMENT_EFFECTS.map((value) => (
                  <SelectItem value={value} key={value}>
                    {EFFECT_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {error && <div className="dialog-error">{error}</div>}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={createState.isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!appUserId || !permissionId || createState.isLoading}
            onClick={() => {
              void save();
            }}
          >
            Add user permission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
