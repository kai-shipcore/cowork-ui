import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import type { Visit } from '@/shared/types/workbench';
import type { HuntRow } from '../hunt-rows';
import './hunt-work-list.css';

interface Filter {
  query: string;
  product: string;
  scheduled: string;
  from: string;
  to: string;
  page: PaginationState;
}
const emptyFilter = (): Filter => ({
  query: '',
  product: '',
  scheduled: '',
  from: '',
  to: '',
  page: { pageIndex: 0, pageSize: 25 },
});
/** Radix Select cannot hold an empty value, so "all" is spelled out. */
const ALL = 'ALL';

export function HuntWorkList({
  kind,
  rows,
  onProject,
  onSchedule,
  onVisit,
  assignees,
}: {
  kind: Visit['kind'];
  rows: HuntRow[];
  onProject: (id: string) => void;
  onSchedule: (id: string) => void;
  onVisit: (visit: Visit) => void;
  assignees: (visit: Visit) => string;
}) {
  const [status, setStatus] = useState<'waiting' | 'completed'>('waiting');
  const [filters, setFilters] = useState({
    waiting: emptyFilter(),
    completed: emptyFilter(),
  });
  const filter = filters[status];
  const label = kind === 'SCAN' ? 'Scan' : 'Fitting';
  const done = status === 'completed';
  function update(patch: Partial<Filter>) {
    setFilters((current) => ({
      ...current,
      [status]: {
        ...current[status],
        ...patch,
        page: { ...current[status].page, pageIndex: 0 },
      },
    }));
  }
  const subset = rows.filter((row) => row.done === done);
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  const filtered = subset
    .filter(
      (row) =>
        `${row.project.vehicle} ${row.project.id}`
          .toLowerCase()
          .includes(filter.query.trim().toLowerCase()) &&
        (!filter.product || row.project.product === filter.product) &&
        (done
          ? !invalidRange &&
            (!filter.from || row.completedDate >= filter.from) &&
            (!filter.to ||
              (Boolean(row.completedDate) && row.completedDate <= filter.to))
          : !filter.scheduled ||
            Boolean(row.scheduled) === (filter.scheduled === 'yes')),
    )
    .sort((a, b) =>
      done
        ? b.completedDate.localeCompare(a.completedDate) ||
          a.project.id.localeCompare(b.project.id)
        : Number(Boolean(a.scheduled)) - Number(Boolean(b.scheduled)) ||
          (a.scheduled?.date ?? '').localeCompare(b.scheduled?.date ?? '') ||
          a.project.id.localeCompare(b.project.id),
    );
  const columns: FlatDataGridColumn<(typeof filtered)[number]>[] = [
    {
      id: 'vehicle',
      header: 'Vehicle / Product',
      width: 210,
      sortValue: (row) => row.project.vehicle,
      cell: (row) => (
        <>
          <strong>{row.project.vehicle}</strong>
          <div className="vehicle-meta">{row.project.product}</div>
        </>
      ),
    },
    {
      id: 'project',
      header: 'Project ID',
      width: 180,
      sortValue: (row) => row.project.id,
      cell: (row) => (
        <>
          <button
            className="project-reference project-reference-link"
            onClick={() => {
              onProject(row.project.id);
            }}
          >
            {row.project.id}
          </button>
        </>
      ),
    },
    {
      id: 'zones',
      header: done ? 'Completed zones' : `Remaining ${label} zones`,
      width: 180,
      sortValue: (row) => (done ? row.completed : row.remaining).length,
      cell: (row) => (
        <>
          <div className="zone-list">
            {(done ? row.completed : row.remaining).map((z) => (
              <span className={`zone zone-${z.code.toLowerCase()}`} key={z.id}>
                {z.code}
              </span>
            ))}
          </div>
          {!done && (
            <div className="vehicle-meta">
              {row.remaining.length} zones remaining
            </div>
          )}
        </>
      ),
    },
    {
      id: 'visit',
      header: done ? 'Last completed visit' : 'Next visit / Dealer',
      width: 180,
      sortValue: (row) => (done ? row.completedDate : row.scheduled?.date),
      cell: (row) => (
        <>
          {done ? (
            row.completedDate || 'Not recorded'
          ) : row.scheduled ? (
            <>
              <div>
                {row.scheduled.date} {row.scheduled.time}
              </div>
              <div>{row.scheduled.dealer}</div>
              <small>{assignees(row.scheduled)}</small>
            </>
          ) : (
            'No visits scheduled'
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 180,
      sortValue: (row) => (done ? 2 : row.scheduled ? 1 : 0),
      cell: (row) => (
        <>
          <StatusBadge
            label={
              done
                ? `${label} Completed`
                : row.completed.length
                  ? `Partially complete · ${String(row.remaining.length)} remaining`
                  : row.scheduled
                    ? 'Scheduled'
                    : 'Not scheduled'
            }
            tone={
              done
                ? 'success'
                : row.completed.length
                  ? 'warning'
                  : row.scheduled
                    ? 'progress'
                    : 'neutral'
            }
          />
          {!done && row.completed.length > 0 && (
            <div className="vehicle-meta">
              {row.scheduled ? 'Scheduled' : 'Not scheduled'}
            </div>
          )}
        </>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 180,
      hideable: false,
      cell: (row) => (
        <div className="table-actions">
          {done ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onProject(row.project.id);
              }}
            >
              Project view
            </Button>
          ) : row.scheduled ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (row.scheduled) onVisit(row.scheduled);
              }}
            >
              View schedule
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onSchedule(row.project.id);
              }}
            >
              Schedule
            </Button>
          )}
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...filtered],
    columns: columns.map((column) => ({
      id: column.id,
      accessorFn: column.sortValue,
      sortUndefined: 'last',
    })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = gridTable.getRowModel().rows.map((row) => row.original);
  const activeSort = gridTable.getState().sorting.slice(0, 1).pop();
  const pagination = {
    ...filter.page,
    pageIndex: Math.min(
      filter.page.pageIndex,
      Math.max(0, Math.ceil(filtered.length / filter.page.pageSize) - 1),
    ),
  };
  const shown = sortedRows.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  const statusTabs = [
    { value: 'waiting', label: 'Pending', count: rows.filter((r) => !r.done) },
    {
      value: 'completed',
      label: 'Completed',
      count: rows.filter((r) => r.done),
    },
  ] as const;
  return (
    <div className="hunt-work-list">
      {invalidRange && (
        <p className="hunt-list-note" role="alert">
          The end date must be on or after the start date.
        </p>
      )}
      {done && (
        <p className="hunt-list-note muted-text">
          Sorted by most recent completed visit. Items completed without a visit
          record show Not recorded.
        </p>
      )}
      <FlatDataGrid
        embedded
        label="Hunt Board"
        columns={columns}
        rows={shown}
        getRowId={(row) => row.project.id}
        emptyMessage={
          subset.length
            ? 'No matching items. Change your search or filters.'
            : `${label} ${done ? 'Completed' : 'Pending'} No projects.`
        }
        search={{
          label: `${label} ${done ? 'Completed' : 'Pending'} Search`,
          placeholder: 'Search vehicle / Project ID',
          value: filter.query,
          onChange: (query) => {
            update({ query });
          },
        }}
        filters={[
          {
            id: 'product',
            label: 'Product family',
            value: filter.product || ALL,
            onChange: (value) => {
              update({ product: value === ALL ? '' : value });
            },
            options: [
              { value: ALL, label: 'All product families' },
              ...[
                'Seat Cover',
                'Floor Mat',
                ...(kind === 'FITTING' ? ['Car Cover'] : []),
              ].map((p) => ({ value: p, label: p })),
            ],
          },
          ...(done
            ? []
            : [
                {
                  id: 'scheduled',
                  label: 'Schedule status',
                  value: filter.scheduled || ALL,
                  onChange: (value: string) => {
                    update({ scheduled: value === ALL ? '' : value });
                  },
                  options: [
                    { value: ALL, label: 'All schedules' },
                    { value: 'no', label: 'Not scheduled' },
                    { value: 'yes', label: 'Scheduled' },
                  ],
                },
              ]),
        ]}
        toolbarContent={
          <>
            {done && (
              <>
                <Input
                  className="hunt-date-input"
                  type="date"
                  aria-label="Completed visit date · From"
                  value={filter.from}
                  onChange={(e) => {
                    update({ from: e.target.value });
                  }}
                />
                <Input
                  className="hunt-date-input"
                  type="date"
                  aria-label="Completed visit date · To"
                  value={filter.to}
                  onChange={(e) => {
                    update({ to: e.target.value });
                  }}
                />
              </>
            )}
            <div
              className="stage-tabs"
              role="group"
              aria-label={`${label} Work status`}
            >
              {statusTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.value}
                  className="stage-tab"
                  aria-pressed={status === tab.value}
                  onClick={() => {
                    setStatus(tab.value);
                  }}
                >
                  {tab.label}
                  <span className="stage-tab-count">{tab.count.length}</span>
                </button>
              ))}
            </div>
            {(filter.query ||
              filter.product ||
              filter.scheduled ||
              filter.from ||
              filter.to) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  update(emptyFilter());
                }}
              >
                <X /> Clear filters
              </Button>
            )}
          </>
        }

        pagination={{
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalCount: filtered.length,
          pageSizeOptions: [5, 10, 25],
          onPageChange: (page) => {
            setFilters((current) => ({
              ...current,
              [status]: {
                ...current[status],
                page: { ...pagination, pageIndex: page - 1 },
              },
            }));
          },
          onPageSizeChange: (pageSize) => {
            setFilters((current) => ({
              ...current,
              [status]: {
                ...current[status],
                page: { pageIndex: 0, pageSize },
              },
            }));
          },
        }}
        sorting={{
          mode: 'manual',
          value: activeSort
            ? { id: activeSort.id, direction: activeSort.desc ? 'desc' : 'asc' }
            : null,
          onChange: (sort) => {
            gridTable.setSorting(
              sort ? [{ id: sort.id, desc: sort.direction === 'desc' }] : [],
            );
          },
        }}
      />
    </div>
  );
}
