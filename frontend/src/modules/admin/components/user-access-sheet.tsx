import { useMemo, useState } from 'react';
import { Badge } from '@coverland-engineering/ui/badge';
import { Button } from '@coverland-engineering/ui/button';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { AppUserDto, AssignmentEffect } from '../app-user-dto';
import {
  apiErrorMessage,
  useCreatePermissionAssignmentMutation,
  useDeletePermissionAssignmentMutation,
  useListPermissionAssignmentsQuery,
  useListPermissionsQuery,
  useListRolePermissionsQuery,
} from '../users-api';

interface UserAccessSheetProps {
  user: AppUserDto;
  onClose: () => void;
}

/** Shows role grants, direct overrides and effective access for one user. */
export function UserAccessSheet({ user, onClose }: UserAccessSheetProps) {
  const permissions = useListPermissionsQuery();
  const rolePermissions = useListRolePermissionsQuery();
  const assignments = useListPermissionAssignmentsQuery();
  const [createAssignment, createState] =
    useCreatePermissionAssignmentMutation();
  const [deleteAssignment, deleteState] =
    useDeletePermissionAssignmentMutation();
  const [permissionId, setPermissionId] = useState('');
  const [effect, setEffect] = useState<AssignmentEffect>('ALLOW');
  const [message, setMessage] = useState('');

  const directAssignments = useMemo(
    () =>
      (assignments.data ?? []).filter(
        (assignment) => assignment.appUserId === user.id,
      ),
    [assignments.data, user.id],
  );
  const directByPermission = new Map(
    directAssignments.map((assignment) => [
      assignment.permissionId,
      assignment,
    ]),
  );
  const roleGrantedIds = new Set(
    (rolePermissions.data ?? [])
      .filter((link) => link.appRoleId === user.appRoleId)
      .map((link) => link.permissionId),
  );
  const availablePermissions = (permissions.data ?? []).filter(
    (permission) => !directByPermission.has(permission.id),
  );

  async function addOverride(): Promise<void> {
    if (!permissionId) return;
    try {
      await createAssignment({
        appUserId: user.id,
        permissionId,
        effect,
      }).unwrap();
      setPermissionId('');
      setMessage('User permission added.');
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }

  return (
    <DetailSheet
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={`Manage access · ${user.name}`}
      description={`${user.email} · Role: ${user.appRoleName}`}
      icon={<ShieldCheck />}
      size="md"
    >
      <div className="user-access-sheet">
        <section className="user-access-add" aria-labelledby="add-access-title">
          <div>
            <h3 id="add-access-title">Add user permission</h3>
            <p>Allow or deny a permission on top of the user’s role.</p>
          </div>
          <div className="user-access-add__fields">
            <Select value={permissionId} onValueChange={setPermissionId}>
              <SelectTrigger aria-label="Permission">
                <SelectValue placeholder="Select a permission" />
              </SelectTrigger>
              <SelectContent>
                {availablePermissions.map((permission) => (
                  <SelectItem key={permission.id} value={permission.id}>
                    {permission.code} · {permission.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={effect}
              onValueChange={(value) => {
                setEffect(value as AssignmentEffect);
              }}
            >
              <SelectTrigger aria-label="Effect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALLOW">Allow</SelectItem>
                <SelectItem value="DENY">Deny</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="primary"
              disabled={!permissionId || createState.isLoading}
              onClick={() => void addOverride()}
            >
              <Plus /> Add
            </Button>
          </div>
        </section>

        <section aria-labelledby="effective-access-title">
          <div className="user-access-heading">
            <div>
              <h3 id="effective-access-title">Effective permissions</h3>
              <p>Role grants and direct overrides combined.</p>
            </div>
            <Badge variant="secondary">
              {
                (permissions.data ?? []).filter((permission) => {
                  const direct = directByPermission.get(permission.id);
                  return direct
                    ? direct.effect === 'ALLOW'
                    : roleGrantedIds.has(permission.id);
                }).length
              }{' '}
              allowed
            </Badge>
          </div>

          <div className="user-access-list">
            {(permissions.data ?? []).map((permission) => {
              const direct = directByPermission.get(permission.id);
              const roleGranted = roleGrantedIds.has(permission.id);
              const allowed = direct ? direct.effect === 'ALLOW' : roleGranted;
              return (
                <div className="user-access-row" key={permission.id}>
                  <div className="user-access-row__name">
                    <strong>{permission.code}</strong>
                    <span>{permission.name}</span>
                  </div>
                  <Badge
                    variant={allowed ? 'success' : 'secondary'}
                    appearance="light"
                  >
                    {allowed ? 'Allowed' : 'Not allowed'}
                  </Badge>
                  <span className="user-access-source">
                    {direct
                      ? `Direct ${direct.effect.toLowerCase()}`
                      : roleGranted
                        ? `Role · ${user.appRoleName}`
                        : 'No grant'}
                  </span>
                  {direct ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      mode="icon"
                      aria-label={`Remove ${permission.code} override`}
                      title="Remove override"
                      disabled={deleteState.isLoading}
                      onClick={() => {
                        void deleteAssignment(direct.id)
                          .unwrap()
                          .then(() => {
                            setMessage('User permission removed.');
                          })
                          .catch((failure: unknown) => {
                            setMessage(apiErrorMessage(failure));
                          });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
            {!permissions.isLoading && permissions.data?.length === 0 && (
              <p className="admin-muted">No permissions have been defined.</p>
            )}
          </div>
        </section>
        {message && (
          <p role="status" className="admin-muted">
            {message}
          </p>
        )}
      </div>
    </DetailSheet>
  );
}
