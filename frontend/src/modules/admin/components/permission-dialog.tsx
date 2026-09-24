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
import type { PermissionDto, PermissionInput } from '../app-user-dto';
import {
  apiErrorMessage,
  useCreatePermissionMutation,
  useUpdatePermissionMutation,
} from '../users-api';

interface PermissionDialogProps {
  /** Permission being edited; omit to create a new one. */
  permission?: PermissionDto;
  onClose: () => void;
}

/** Create/edit form for one `permission` row. */
export function PermissionDialog({
  permission,
  onClose,
}: PermissionDialogProps) {
  const [code, setCode] = useState(permission?.code ?? '');
  const [name, setName] = useState(permission?.name ?? '');
  const [error, setError] = useState('');
  const [createPermission, createState] = useCreatePermissionMutation();
  const [updatePermission, updateState] = useUpdatePermissionMutation();

  const normalizedCode = code.trim().toUpperCase();
  const canSave = normalizedCode.length > 0 && name.trim().length > 0;
  const isBusy = createState.isLoading || updateState.isLoading;

  async function save(): Promise<void> {
    const input: PermissionInput = { code: normalizedCode, name: name.trim() };
    try {
      await (permission
        ? updatePermission({ id: permission.id, input }).unwrap()
        : createPermission(input).unwrap());
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
          <DialogTitle>
            {permission ? 'Edit Permission' : 'Add Permission'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <label>
            Code
            <Input
              placeholder="Example: USER_MANAGE"
              maxLength={60}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
            />
          </label>
          <label>
            Name
            <Input
              placeholder="Enter permission name"
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>
          <div className="dialog-note">
            Codes are saved in uppercase and must be unique.
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
            {permission ? 'Save changes' : 'Add permission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
