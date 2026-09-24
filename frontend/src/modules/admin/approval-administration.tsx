import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Save, X } from 'lucide-react';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import type { ApprovalGrant } from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { UserIdentity } from './components/user-identity';
import './admin.css';

type GrantFlag = 'canForward' | 'canFinalApprove';
type GrantFlags = Record<GrantFlag, boolean>;

const FLAG_LABELS: Record<GrantFlag, string> = {
  canForward: 'can review',
  canFinalApprove: 'can finally approve',
};

/**
 * Who may review or finally approve one approval type. Checkbox changes are
 * staged per person and written to `user_x_approval_type_grant` together when
 * saved, so a half-edited row never reaches the store.
 */
export function ApprovalAdministration({
  approvalTypeId: typeId,
}: {
  approvalTypeId: string;
}): ReactElement {
  const { appUsers, approvalGrants, approvalTypes, updateWorkbench } =
    useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Record<string, GrantFlags>>({});
  const [message, setMessage] = useState('');
  const type = approvalTypes.find((row) => row.id === typeId);
  const grantOf = (userId: string): ApprovalGrant | undefined =>
    approvalGrants.find(
      (grant) => grant.appUserId === userId && grant.approvalTypeId === typeId,
    );
  const savedFlags = (userId: string): GrantFlags => {
    const grant = grantOf(userId);
    const active = grant?.status === 'ACTIVE';
    return {
      canForward: active && grant.canForward,
      canFinalApprove: active && grant.canFinalApprove,
    };
  };
  const currentFlags = (userId: string): GrantFlags =>
    draft[userId] ?? savedFlags(userId);

  const changedUserIds = Object.keys(draft).filter((userId) => {
    const saved = savedFlags(userId);
    const edited = currentFlags(userId);
    return (
      saved.canForward !== edited.canForward ||
      saved.canFinalApprove !== edited.canFinalApprove
    );
  });
  const isDirty = changedUserIds.length > 0;

  function stageFlag(userId: string, flag: GrantFlag, checked: boolean): void {
    setDraft((current) => ({
      ...current,
      [userId]: { ...currentFlags(userId), [flag]: checked },
    }));
    setMessage('');
  }

  function discard(): void {
    setDraft({});
    setMessage('');
  }

  function save(): void {
    const edits = changedUserIds.map((userId) => ({
      userId,
      flags: currentFlags(userId),
    }));
    updateWorkbench((state) => {
      let approvalGrantsNext = state.approvalGrants;
      for (const { userId, flags } of edits) {
        const existing = approvalGrantsNext.find(
          (grant) =>
            grant.appUserId === userId && grant.approvalTypeId === typeId,
        );
        const enabled = flags.canForward || flags.canFinalApprove;
        if (existing) {
          approvalGrantsNext = approvalGrantsNext.map((grant) =>
            grant.id === existing.id
              ? enabled
                ? { ...grant, ...flags, status: 'ACTIVE' }
                : { ...grant, status: 'INACTIVE' }
              : grant,
          );
        } else if (enabled) {
          approvalGrantsNext = [
            ...approvalGrantsNext,
            {
              id: crypto.randomUUID(),
              appUserId: userId,
              approvalTypeId: typeId,
              ...flags,
              status: 'ACTIVE',
            },
          ];
        }
      }
      return { ...state, approvalGrants: approvalGrantsNext };
    });
    setDraft({});
    setMessage(
      `Saved grants for ${String(edits.length)} ${edits.length === 1 ? 'person' : 'people'}.`,
    );
  }

  const needle = query.trim().toLowerCase();
  const people = appUsers.filter(
    (user) =>
      (user.status === 'ACTIVE' || grantOf(user.id) !== undefined) &&
      (!needle || `${user.name} ${user.email}`.toLowerCase().includes(needle)),
  );

  function flagColumn(
    flag: GrantFlag,
    header: string,
  ): FlatDataGridColumn<AppUser> {
    return {
      id: flag,
      header,
      width: 180,
      className: 'text-center',
      sortValue: (user) => (currentFlags(user.id)[flag] ? 1 : 0),
      cell: (user) => (
        <input
          type="checkbox"
          className="admin-grant-checkbox"
          aria-label={`${user.name} ${FLAG_LABELS[flag]}`}
          checked={currentFlags(user.id)[flag]}
          disabled={user.status !== 'ACTIVE' || !type}
          onChange={(event) => {
            stageFlag(user.id, flag, event.target.checked);
          }}
        />
      ),
    };
  }

  const columns: FlatDataGridColumn<AppUser>[] = [
    {
      id: 'person',
      header: 'Person',
      width: 280,
      sortValue: (user) => user.name,
      cell: (user) => <UserIdentity name={user.name} email={user.email} />,
    },
    flagColumn('canForward', 'Can review (forward)'),
    flagColumn('canFinalApprove', 'Can finally approve'),
  ];
  const page = useSortedPage(people, columns, `${typeId}|${query}`);

  return (
    <FlatDataGrid
      embedded
      label={`User grants${type ? ` · ${type.name}` : ''}`}
      columns={columns}
      rows={page.pageItems}
      getRowId={(user) => user.id}
      emptyMessage="No people match this search."
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
      search={{
        label: 'Search people',
        placeholder: 'Search name or email',
        value: query,
        onChange: setQuery,
      }}
      actions={
        <>
          <Button variant="outline" disabled={!isDirty} onClick={discard}>
            Discard
          </Button>
          <Button variant="primary" disabled={!isDirty} onClick={save}>
            <Save /> Save changes
            {isDirty && ` (${String(changedUserIds.length)})`}
          </Button>
        </>
      }
      footer={
        <div className="admin-grid-footer">
          <p className="admin-note">
            Revoking a grant keeps its history and never reroutes an open
            request.
          </p>
          {(isDirty || message) && (
            <p role="status" className="admin-muted">
              {isDirty
                ? `${String(changedUserIds.length)} unsaved change${changedUserIds.length === 1 ? '' : 's'}.`
                : message}
            </p>
          )}
        </div>
      }
      pagination={page.pagination}
      sorting={page.sorting}
    />
  );
}
