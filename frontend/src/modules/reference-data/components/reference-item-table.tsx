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
  toolbarContent?: ReactNode;
  actions?: ReactNode;
  items: readonly ProductReferenceItem[];
  /** "Color" or "Material" — used in the empty state and action labels. */
  entityLabel: string;
  /** Resets to the first page when the surrounding filters change. */
  filterKey: string;
  onEdit: (item: ProductReferenceItem) => void;
  onDelete: (item: ProductReferenceItem) => void;
}

/** Read-out of one reference table, with per-row edit and delete. */
export function ReferenceItemTable({
  toolbarContent,
  actions,
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
      header: <>{entityLabel} Name</>,
      label: `${entityLabel} Name`,
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
      header: 'Last updated',
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
      header: 'Actions',
      width: 180,
      hideable: false,
      cell: (item) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`${item.name} Edit`}
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
            aria-label={`${item.name} Delete`}
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

  return (
    <>
      <FlatDataGrid
        embedded
        label="Reference Data"
        toolbarContent={toolbarContent}
        actions={actions}
        emptyMessage={`No matching ${entityLabel} items found. Try changing the search term or product type filter.`}
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
