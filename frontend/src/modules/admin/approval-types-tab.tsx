import { useState } from 'react';
import { Badge, BadgeDot } from '@coverland-engineering/ui/badge';
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
import { Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import type { ApprovalType } from '@/shared/types/db-workflow';
import { useWorkbenchStore } from '@/app/workbench-store';
import './admin.css';

type StatusFilter = ApprovalType['status'] | 'ALL';
type UsageFilter = 'ALL' | 'HAS_GRANTS' | 'NO_GRANTS' | 'IN_USE' | 'NEVER_USED';

const STATUS_FILTERS: readonly StatusFilter[] = ['ALL', 'ACTIVE', 'INACTIVE'];
const USAGE_FILTERS: readonly UsageFilter[] = [
  'ALL',
  'HAS_GRANTS',
  'NO_GRANTS',
  'IN_USE',
  'NEVER_USED',
];
const USAGE_LABELS: Record<UsageFilter, string> = {
  ALL: 'All Usage',
  HAS_GRANTS: 'Has grants',
  NO_GRANTS: 'No grants',
  IN_USE: 'In use',
  NEVER_USED: 'Never used',
};

interface Props {
  selectedTypeId: string;
  onSelectedTypeChange: (id: string) => void;
}

export function ApprovalTypesTab({
  selectedTypeId,
  onSelectedTypeChange,
}: Props) {
  const { approvalGrants, approvalRequests, approvalTypes, updateWorkbench } =
    useWorkbenchStore();
  const [mode, setMode] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<ApprovalType>();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ApprovalType>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [usage, setUsage] = useState<UsageFilter>('ALL');
  const hasActiveFilter = query !== '' || status !== 'ALL' || usage !== 'ALL';

  function requestCount(type: ApprovalType): number {
    return approvalRequests.filter((row) => row.approvalTypeId === type.id)
      .length;
  }

  function grantCount(type: ApprovalType): number {
    return approvalGrants.filter(
      (row) => row.approvalTypeId === type.id && row.status === 'ACTIVE',
    ).length;
  }

  function openEditor(nextMode: 'add' | 'edit', type?: ApprovalType): void {
    setMode(nextMode);
    setEditing(type);
    setName(type?.name ?? '');
    setCode(type?.code ?? '');
    setError('');
  }

  function closeEditor(): void {
    setMode(null);
    setEditing(undefined);
    setName('');
    setCode('');
    setError('');
  }

  function saveType(): void {
    const nextName = name.trim();
    const nextCode = code.trim().toUpperCase();
    if (!nextName || !nextCode) return;
    if (!/^[A-Z][A-Z0-9_]*$/.test(nextCode)) {
      setError(
        'Code must start with a letter and use A–Z, 0–9, or underscores.',
      );
      return;
    }
    if (
      approvalTypes.some(
        (row) => row.id !== editing?.id && row.code === nextCode,
      )
    ) {
      setError('That approval type code already exists.');
      return;
    }
    if (mode === 'edit' && editing) {
      updateWorkbench((state) => ({
        ...state,
        approvalTypes: state.approvalTypes.map((row) =>
          row.id === editing.id ? { ...row, name: nextName } : row,
        ),
      }));
      closeEditor();
      return;
    }
    const id = crypto.randomUUID();
    updateWorkbench((state) => ({
      ...state,
      approvalTypes: [
        ...state.approvalTypes,
        { id, code: nextCode, name: nextName, status: 'ACTIVE' },
      ],
    }));
    onSelectedTypeChange(id);
    closeEditor();
  }

  function toggleStatus(type: ApprovalType): void {
    updateWorkbench((state) => ({
      ...state,
      approvalTypes: state.approvalTypes.map((row) =>
        row.id === type.id
          ? { ...row, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : row,
      ),
    }));
  }

  function deleteType(): void {
    if (!deleteTarget) return;
    const next = approvalTypes.find((row) => row.id !== deleteTarget.id);
    updateWorkbench((state) => ({
      ...state,
      approvalTypes: state.approvalTypes.filter(
        (row) => row.id !== deleteTarget.id,
      ),
      approvalGrants: state.approvalGrants.filter(
        (row) => row.approvalTypeId !== deleteTarget.id,
      ),
    }));
    if (selectedTypeId === deleteTarget.id)
      onSelectedTypeChange(next?.id ?? '');
    setDeleteTarget(undefined);
  }

  const columns: FlatDataGridColumn<ApprovalType>[] = [
    {
      id: 'name',
      header: 'Display name',
      width: 200,
      sortValue: (type) => type.name,
      cell: (type) => <span className="text-sm font-medium">{type.name}</span>,
    },
    {
      id: 'code',
      header: 'Code',
      width: 160,
      sortValue: (type) => type.code,
      cell: (type) => <code className="text-xs">{type.code}</code>,
    },
    {
      id: 'status',
      header: 'Status',
      width: 110,
      sortValue: (type) => type.status,
      cell: (type) => (
        <Badge
          variant={type.status === 'ACTIVE' ? 'success' : 'warning'}
          appearance="ghost"
        >
          <BadgeDot />
          {type.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'grants',
      header: 'User grants',
      width: 125,
      sortValue: (type) => grantCount(type),
      cell: (type) => <Badge variant="secondary">{grantCount(type)}</Badge>,
    },
    {
      id: 'requests',
      header: 'Requests',
      width: 110,
      sortValue: (type) => requestCount(type),
      cell: (type) => <Badge variant="secondary">{requestCount(type)}</Badge>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      label: 'Actions',
      width: 140,
      hideable: false,
      cell: (type) => (
        <div className="admin-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`Edit ${type.name}`}
            title="Edit"
            onClick={() => {
              openEditor('edit', type);
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            mode="icon"
            aria-label={`${type.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} ${type.name}`}
            title={type.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            onClick={() => {
              toggleStatus(type);
            }}
          >
            <Power />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            mode="icon"
            aria-label={`Delete ${type.name}`}
            disabled={requestCount(type) > 0}
            title={
              requestCount(type)
                ? 'Types with request history cannot be deleted.'
                : 'Delete'
            }
            onClick={() => {
              setDeleteTarget(type);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];
  function matchesUsage(type: ApprovalType): boolean {
    switch (usage) {
      case 'HAS_GRANTS':
        return grantCount(type) > 0;
      case 'NO_GRANTS':
        return grantCount(type) === 0;
      case 'IN_USE':
        return requestCount(type) > 0;
      case 'NEVER_USED':
        return requestCount(type) === 0;
      default:
        return true;
    }
  }

  const needle = query.trim().toLowerCase();
  const visibleTypes = approvalTypes.filter(
    (type) =>
      (status === 'ALL' || type.status === status) &&
      matchesUsage(type) &&
      (!needle || `${type.name} ${type.code}`.toLowerCase().includes(needle)),
  );
  const page = useSortedPage(
    visibleTypes,
    columns,
    `${query}|${status}|${usage}`,
  );

  return (
    <>
      <FlatDataGrid
        embedded
        label="Approval types"
        columns={columns}
        rows={page.pageItems}
        getRowId={(type) => type.id}
        emptyMessage={
          approvalTypes.length
            ? 'No approval types match these filters.'
            : 'No approval types yet.'
        }
        search={{
          label: 'Search approval types',
          placeholder: 'Search name or code',
          value: query,
          onChange: setQuery,
        }}
        filters={[
          {
            id: 'status',
            label: 'Status filter',
            value: status,
            options: [
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ],
            onChange: (value) => {
              setStatus(
                STATUS_FILTERS.find((option) => option === value) ?? 'ALL',
              );
            },
          },
          {
            id: 'usage',
            label: 'Usage filter',
            value: usage,
            options: USAGE_FILTERS.map((value) => ({
              value,
              label: USAGE_LABELS[value],
            })),
            onChange: (value) => {
              setUsage(
                USAGE_FILTERS.find((option) => option === value) ?? 'ALL',
              );
            },
          },
        ]}
        toolbarContent={
          hasActiveFilter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('');
                setStatus('ALL');
                setUsage('ALL');
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
              openEditor('add');
            }}
          >
            <Plus /> Add approval type
          </Button>
        }
        pagination={page.pagination}
        sorting={page.sorting}
      />

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? 'Edit approval type' : 'Add approval type'}
            </DialogTitle>
            <DialogDescription>
              The display name is shown to users. The code is permanent after
              creation.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Display name
              <Input
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
              />
            </label>
            <label>
              Code
              <Input
                maxLength={60}
                disabled={mode === 'edit'}
                value={code}
                placeholder="PURCHASE_APPROVAL"
                onChange={(event) => {
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]/g, '_'),
                  );
                  setError('');
                }}
              />
            </label>
            {error && (
              <p className="admin-form-error" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || !code.trim()}
              onClick={saveType}
            >
              {mode === 'edit' ? 'Save changes' : 'Create type'}
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
            <DialogTitle>Delete approval type?</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name} and its user grants? This cannot be
              undone.
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
            <Button variant="destructive" onClick={deleteType}>
              <Trash2 /> Delete type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
