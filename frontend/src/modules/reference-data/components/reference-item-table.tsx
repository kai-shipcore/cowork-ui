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
import { Pencil, Trash2 } from 'lucide-react';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import {
  PRODUCT_TYPES,
  type ProductReferenceItem,
} from '@/shared/types/workbench';

function productName(productTypeId: string): string {
  return (
    PRODUCT_TYPES.find((productType) => productType.id === productTypeId)
      ?.product ?? productTypeId
  );
}

interface ReferenceItemTableProps {
  items: readonly ProductReferenceItem[];
  /** "색상" or "재질" — used in the empty state and action labels. */
  entityLabel: string;
  /** Resets to the first page when the surrounding filters change. */
  filterKey: string;
  onEdit: (item: ProductReferenceItem) => void;
  onDelete: (item: ProductReferenceItem) => void;
}

/** Read-out of one reference table, with per-row edit and delete. */
export function ReferenceItemTable({
  items,
  entityLabel,
  filterKey,
  onEdit,
  onDelete,
}: ReferenceItemTableProps) {
  const columns: FlatDataGridColumn<(typeof items)[number]>[] = [
    {
      id: 'code',
      header: 'Code',
      width: 210,
      sortValue: (item) => item.code,
      cell: (item) => (
        <>
          <span className="reference-code">{item.code}</span>
        </>
      ),
    },
    {
      id: 'name',
      header: <>{entityLabel} 이름</>,
      label: `${entityLabel} 이름`,
      width: 180,
      sortValue: (item) => item.name,
      cell: (item) => (
        <>
          <div className="vehicle-name compact">{item.name}</div>
          <div className="vehicle-meta">{item.id}</div>
        </>
      ),
    },
    {
      id: 'product',
      header: 'Product Type',
      width: 180,
      sortValue: (item) => productName(item.productTypeId),
      cell: (item) => <>{productName(item.productTypeId)}</>,
    },
    {
      id: 'updated',
      header: '최근 수정',
      width: 180,
      sortValue: (item) => item.updatedAt,
      cell: (item) => (
        <>
          <span className="vehicle-meta">{item.updatedAt.slice(0, 10)}</span>
        </>
      ),
    },
    {
      id: 'actions',
      header: '작업',
      width: 180,
      hideable: false,
      cell: (item) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`${item.name} 수정`}
            onClick={() => {
              onEdit(item);
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`${item.name} 삭제`}
            onClick={() => {
              onDelete(item);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...items],
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

  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <strong>조건에 맞는 {entityLabel}이 없습니다.</strong>
        <p>검색어나 Product Type 필터를 바꿔 보세요.</p>
      </div>
    );
  }

  return (
    <>
      <FlatDataGrid
        embedded
        label="기준정보"
        columns={columns}
        rows={pageItems}
        getRowId={(item) => item.id}

        pagination={{
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalCount: items.length,
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
