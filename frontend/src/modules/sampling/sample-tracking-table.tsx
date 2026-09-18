import type { ReactNode } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { sampleRoundLabel } from '@/shared/domain/sample-request';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { SampleTrackingRow } from './sample-tracking';

interface SampleTrackingTableProps {
  rows: readonly SampleTrackingRow[];
  /** Resets the page when the surrounding filters change. */
  filterKey: string;
  onOpenProject: (projectGroupId: string) => void;
  onInspect: (row: SampleTrackingRow) => void;
  renderInspection: (row: SampleTrackingRow) => ReactNode;
}

/**
 * Sample Tracking sheet view (Stage 8): one part per row, sheet column order.
 * Renders the table and its pagination; the caller supplies the grid card.
 */
export function SampleTrackingTable({
  rows,
  filterKey,
  onOpenProject,
  onInspect,
  renderInspection,
}: SampleTrackingTableProps) {
  const columns: FlatDataGridColumn<(typeof rows)[number]>[] = [
    {
      id: 'date',
      header: 'Date',
      width: 210,
      sortValue: (row) => row.date,
      cell: (row) => <>{row.date}</>,
    },
    {
      id: 'vehicle',
      header: 'Vehicle',
      width: 180,
      sortValue: (row) => row.vehicle,
      cell: (row) => (
        <>
          <div className="vehicle-name compact">{row.vehicle}</div>
          <button
            type="button"
            className="project-reference project-reference-link"
            onClick={() => {
              onInspect(row);
            }}
          >
            {row.requestId}
          </button>
        </>
      ),
    },
    {
      id: 'seat',
      header: 'Row / Seat Type',
      width: 180,
      sortValue: (row) => row.seatType,
      cell: (row) => <>{row.seatType}</>,
    },
    {
      id: 'part',
      header: 'Part Name',
      width: 180,
      sortValue: (row) => row.partName,
      cell: (row) => (
        <>
          <code>{row.partName}</code>
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 180,
      sortValue: (row) => row.status,
      cell: (row) => (
        <>
          <StatusBadge
            label={row.status === 'READY' ? 'Ready' : 'Sample'}
            tone={row.status === 'READY' ? 'success' : 'progress'}
          />
        </>
      ),
    },
    {
      id: 'round',
      header: 'Sample Round',
      width: 180,
      sortValue: (row) => row.sampleRound,
      cell: (row) => <>{sampleRoundLabel(row.sampleRound)}</>,
    },
    {
      id: 'vendor',
      header: 'Vendor',
      width: 180,
      sortValue: (row) => row.vendor,
      cell: (row) => <>{row.vendor}</>,
    },
    {
      id: 'note',
      header: 'Note',
      width: 180,
      sortValue: (row) => row.note,
      cell: (row) => (
        <>{row.note ? row.note : <span className="muted-text">—</span>}</>
      ),
    },
    {
      id: 'inspection',
      header: '검수 결과',
      width: 180,
      cell: (row) => <>{renderInspection(row)}</>,
    },
    {
      id: 'actions',
      header: '작업',
      width: 180,
      hideable: false,
      cell: (row) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInspect(row);
            }}
          >
            입고·검수
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onOpenProject(row.projectGroupId);
            }}
          >
            프로젝트
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...rows],
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
  const { pageItems, pagination, setPagination } = useWorkbenchPagination(
    sortedRows,
    filterKey,
  );

  if (!rows.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <strong>등록된 부품 행이 없습니다.</strong>
        <p>
          프로젝트 상세의 Samples 탭에서 Sample Request를 만들면 부품마다 한
          행씩 생성됩니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <FlatDataGrid
        embedded
        label="Sample Part Lines"
        columns={columns}
        rows={pageItems}
        getRowId={(row) => row.id}
        onRowClick={onInspect}
        rowActionLabel={(row) => `${row.requestId} 입고·검수 열기`}
        pagination={{
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalCount: rows.length,
          pageSizeOptions: [5, 10, 25],
          onPageChange: (page) => {
            setPagination((current) => ({ ...current, pageIndex: page - 1 }));
          },
          onPageSizeChange: (pageSize) => {
            setPagination({ pageIndex: 0, pageSize });
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
    </>
  );
}
