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
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  APP_USER_STATUSES,
  type AppRoleDto,
  type AppUserDto,
  type AppUserInput,
  type AppUserStatus,
  type DepartmentDto,
} from '../app-user-dto';
import {
  apiErrorMessage,
  useInviteUserMutation,
  useUpdateUserMutation,
} from '../users-api';

/** `department.code` of Research & Development, the only team that assigns designer initials. */
const RESEARCH_DEPARTMENT_CODE = 'R_AND_D';

const STATUS_LABELS: Record<AppUserStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  INACTIVE: 'Inactive',
};

interface UserDialogProps {
  /** Account being edited; omit to invite a new person. */
  user?: AppUserDto;
  /** Active account recorded as `user_invitation.invited_by` for a new invitation. */
  inviterId?: string;
  departments: readonly DepartmentDto[];
  roles: readonly AppRoleDto[];
  onClose: () => void;
}

/**
 * Edit form for one `app_user` row, or the invitation form for a new one.
 * Inviting creates the account in the INVITED status and issues its
 * `user_invitation`; the account becomes ACTIVE when the person accepts,
 * so designer initial and status are only editable afterwards.
 */
export function UserDialog({
  user,
  inviterId,
  departments,
  roles,
  onClose,
}: UserDialogProps) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? '');
  const [appRoleId, setAppRoleId] = useState(user?.appRoleId ?? '');
  const [designerInitial, setDesignerInitial] = useState(
    user?.designerInitial ?? '',
  );
  const [status, setStatus] = useState<AppUserStatus>(user?.status ?? 'ACTIVE');
  const [error, setError] = useState('');
  const [inviteUser, inviteState] = useInviteUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();

  const isInviting = user === undefined;
  // Designer initials are rendered into pattern names, which only R&D produces.
  const isDesignerDepartment =
    departments.find((department) => department.id === departmentId)?.code ===
    RESEARCH_DEPARTMENT_CODE;
  const departmentRoles = roles.filter(
    (role) => role.departmentId === departmentId,
  );
  const canSave =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    departmentId !== '' &&
    appRoleId !== '' &&
    (!isInviting || inviterId !== undefined);
  const isSaving = inviteState.isLoading || updateState.isLoading;

  function selectDepartment(nextDepartmentId: string): void {
    setDepartmentId(nextDepartmentId);
    // Roles are per department, so a role from the previous department cannot stay selected.
    if (
      !roles.some(
        (role) =>
          role.id === appRoleId && role.departmentId === nextDepartmentId,
      )
    ) {
      setAppRoleId('');
    }
  }

  async function save(): Promise<void> {
    try {
      if (user) {
        const input: AppUserInput = {
          name: name.trim(),
          email: email.trim(),
          status,
          ...(isDesignerDepartment && designerInitial.trim()
            ? { designerInitial: designerInitial.trim() }
            : {}),
          departmentId,
          appRoleId,
        };
        await updateUser({ id: user.id, input }).unwrap();
      } else if (inviterId) {
        await inviteUser({
          name: name.trim(),
          email: email.trim(),
          departmentId,
          appRoleId,
          invitedBy: inviterId,
        }).unwrap();
      }
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
            {isInviting ? 'Send Invitation' : 'Edit User'}
          </DialogTitle>
          {isInviting && (
            <DialogDescription>
              The account is created as Invited and becomes Active once the
              person accepts the invitation email.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <label className="full-width">
            Name
            <Input
              placeholder="Enter name"
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>
          <label className="full-width">
            Email
            <Input
              type="email"
              placeholder="Enter user email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </label>
          <label>
            Department
            <Select value={departmentId} onValueChange={selectDepartment}>
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
          <label>
            Role
            <Select
              value={appRoleId}
              disabled={departmentId === ''}
              onValueChange={setAppRoleId}
            >
              <SelectTrigger aria-label="Role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {departmentRoles.map((role) => (
                  <SelectItem value={role.id} key={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {!isInviting && (
            <>
              {isDesignerDepartment && (
                <label>
                  Designer initial
                  <Input
                    placeholder="Optional, e.g. JK"
                    maxLength={8}
                    value={designerInitial}
                    onChange={(event) => {
                      setDesignerInitial(event.target.value);
                    }}
                  />
                </label>
              )}
              <label>
                Status
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as AppUserStatus);
                  }}
                >
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_USER_STATUSES.map((value) => (
                      <SelectItem value={value} key={value}>
                        {STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </>
          )}
          {isInviting && inviterId === undefined && (
            <div className="dialog-error">
              No active account is available to send the invitation from.
            </div>
          )}
          {error && <div className="dialog-error">{error}</div>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave || isSaving}
            onClick={() => {
              void save();
            }}
          >
            {isInviting ? 'Send invitation' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
