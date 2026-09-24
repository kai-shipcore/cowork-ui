import type {
  FlatDataGridColumn,
  FlatDataGridPaginationConfig,
  GridSortingConfig,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useWorkbenchPagination } from './workbench-pagination';

interface SortedPage<T> {
  /** Rows of the current page, in the chosen sort order. */
  pageItems: T[];
  pagination: FlatDataGridPaginationConfig;
  sorting: GridSortingConfig;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

/**
 * Column sorting plus the shared pager for a `FlatDataGrid` whose rows all
 * live in memory. Sorting uses each column's `sortValue`; `resetKey` returns
 * to the first page whenever the caller's filters change.
 */
export function useSortedPage<T>(
  rows: readonly T[],
  columns: readonly FlatDataGridColumn<T>[],
  resetKey: string,
): SortedPage<T> {
  const gridTable = useReactTable({
    // Paging is owned by the caller's filters and the shared grid pager.
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
    resetKey,
  );

  return {
    pageItems,
    pagination: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      totalCount: rows.length,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      onPageChange: (page) => {
        setPagination((current) => ({ ...current, pageIndex: page - 1 }));
      },
      onPageSizeChange: (pageSize) => {
        setPagination({ pageIndex: 0, pageSize });
      },
    },
    sorting: {
      mode: 'manual',
      value: activeSort
        ? { id: activeSort.id, direction: activeSort.desc ? 'desc' : 'asc' }
        : null,
      onChange: (sort) => {
        gridTable.setSorting(
          sort ? [{ id: sort.id, desc: sort.direction === 'desc' }] : [],
        );
      },
    },
  };
}
