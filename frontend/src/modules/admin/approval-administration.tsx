import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { ShieldCheck } from 'lucide-react';
import type { ApprovalGrant } from '@/shared/types/db-workflow';
import { useWorkbenchStore } from '@/app/workbench-store';
import './admin.css';

type GrantFlag = 'canForward' | 'canFinalApprove';

interface ApprovalAdministrationProps {
  approvalTypeId: string;
  onApprovalTypeChange: (approvalTypeId: string) => void;
}

/**
 * APPROVAL_MANAGE work: rename or deactivate approval types and decide who may
 * review or finally approve each one. Types themselves are created by
 * developers with the feature that needs them. Changes affect new requests
 * only; a submitted route is frozen.
 */
export function ApprovalAdministration({
  approvalTypeId: typeId,
  onApprovalTypeChange,
}: ApprovalAdministrationProps): ReactElement {
  const { appUsers, approvalGrants, approvalTypes, updateWorkbench } =
    useWorkbenchStore();
  const type = approvalTypes.find((row) => row.id === typeId);
  const [name, setName] = useState(type?.name ?? '');

  function grantOf(userId: string): ApprovalGrant | undefined {
    return approvalGrants.find(
      (grant) => grant.appUserId === userId && grant.approvalTypeId === typeId,
    );
  }

  function hasFlag(userId: string, flag: GrantFlag): boolean {
    const grant = grantOf(userId);
    return grant?.status === 'ACTIVE' && grant[flag];
  }

  /** A grant with neither flag is deactivated rather than deleted, keeping its history. */
  function toggleFlag(userId: string, flag: GrantFlag, checked: boolean): void {
    updateWorkbench((state) => {
      const existing = state.approvalGrants.find(
        (grant) =>
          grant.appUserId === userId && grant.approvalTypeId === typeId,
      );
      const active = existing?.status === 'ACTIVE';
      const flags = {
        canForward: active && existing.canForward,
        canFinalApprove: active && existing.canFinalApprove,
        [flag]: checked,
      };
      const enabled = flags.canForward || flags.canFinalApprove;
      if (!existing && !enabled) return state;
      return {
        ...state,
        approvalGrants: existing
          ? state.approvalGrants.map((grant) =>
              grant.id === existing.id
                ? enabled
                  ? { ...grant, ...flags, status: 'ACTIVE' }
                  : { ...grant, status: 'INACTIVE' }
                : grant,
            )
          : [
              ...state.approvalGrants,
              {
                id: crypto.randomUUID(),
                appUserId: userId,
                approvalTypeId: typeId,
                ...flags,
                status: 'ACTIVE',
              },
            ],
      };
    });
  }

  function saveName(): void {
    const next = name.trim();
    if (!type || !next || next === type.name) return;
    updateWorkbench((state) => ({
      ...state,
      approvalTypes: state.approvalTypes.map((row) =>
        row.id === type.id ? { ...row, name: next } : row,
      ),
    }));
  }

  function toggleTypeStatus(): void {
    if (!type) return;
    updateWorkbench((state) => ({
      ...state,
      approvalTypes: state.approvalTypes.map((row) =>
        row.id === type.id
          ? { ...row, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : row,
      ),
    }));
  }

  const people = appUsers.filter(
    (user) => user.status === 'ACTIVE' || grantOf(user.id) !== undefined,
  );

  return (
    <section className="admin-card" aria-labelledby="approval-admin-title">
      <header>
        <div>
          <h2 id="approval-admin-title">Approval types and grants</h2>
          <p>
            Who may review and who may finally approve, per approval type.
            Requires the APPROVAL_MANAGE permission.
          </p>
        </div>
        <span className="admin-badge">
          <ShieldCheck aria-hidden="true" size={13} /> Applies to new requests
        </span>
      </header>
      <div className="admin-fields">
        <label>
          Approval type
          <select
            value={typeId}
            onChange={(event) => {
              const next = approvalTypes.find(
                (row) => row.id === event.target.value,
              );
              onApprovalTypeChange(event.target.value);
              setName(next?.name ?? '');
            }}
          >
            {approvalTypes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Display name
          <Input
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
            }}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveName();
              }
            }}
          />
          <small>The code never changes; features refer to it.</small>
        </label>
      </div>
      {type && (
        <div className="admin-type-row">
          <code>{type.code}</code>
          <span className="admin-badge">
            {type.status === 'ACTIVE' ? 'Active' : 'Inactive · no new requests'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTypeStatus}
          >
            {type.status === 'ACTIVE' ? 'Deactivate type' : 'Reactivate type'}
          </Button>
        </div>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Can review (forward)</th>
            <th scope="col">Can finally approve</th>
          </tr>
        </thead>
        <tbody>
          {people.map((user) => (
            <tr key={user.id}>
              <td>
                <strong>{user.name}</strong>
                <small>
                  {user.email}
                  {user.status !== 'ACTIVE' && ' · inactive'}
                </small>
              </td>
              {(['canForward', 'canFinalApprove'] as const).map((flag) => (
                <td key={flag} className="is-center">
                  <input
                    type="checkbox"
                    aria-label={`${user.name} ${flag === 'canForward' ? 'can review' : 'can finally approve'}`}
                    checked={hasFlag(user.id, flag)}
                    disabled={user.status !== 'ACTIVE'}
                    onChange={(event) => {
                      toggleFlag(user.id, flag, event.target.checked);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-note">
        Revoking a grant keeps its history and never reroutes an open request.
        In this demo the changes live in your browser; the server permission
        tables decide in shared environments.
      </p>
    </section>
  );
}
