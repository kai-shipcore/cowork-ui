import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { DataGridProvider } from '@coverland-engineering/ui/data-grid';
import { DataGridPagination } from '@coverland-engineering/ui/data-grid-pagination';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';

const EMPTY_COLUMNS: [] = [];

interface WorkbenchPaginationProps {
  recordCount: number;
  pagination: PaginationState;
  onPaginationChange: Dispatch<SetStateAction<PaginationState>>;
  itemLabel: string;
}

export function useWorkbenchPagination<T>(
  items: readonly T[],
  resetKey: string,
  initialPageSize = 10,
) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [resetKey]);

  useEffect(() => {
    const lastPageIndex = Math.max(
      0,
      Math.ceil(items.length / pagination.pageSize) - 1,
    );
    setPagination((current) =>
      current.pageIndex <= lastPageIndex
        ? current
        : { ...current, pageIndex: lastPageIndex },
    );
  }, [items.length, pagination.pageSize]);

  const start = pagination.pageIndex * pagination.pageSize;
  return {
    pageItems: items.slice(start, start + pagination.pageSize),
    pagination,
    setPagination,
  };
}

export function WorkbenchPagination({
  recordCount,
  pagination,
  onPaginationChange,
  itemLabel,
}: WorkbenchPaginationProps) {
  const data = useMemo(
    () => Array.from({ length: recordCount }, (_, index) => ({ index })),
    [recordCount],
  );
  const table = useReactTable({
    data,
    columns: EMPTY_COLUMNS,
    state: { pagination },
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (!recordCount) return null;

  return (
    <DataGridProvider table={table} recordCount={recordCount}>
      <div className="workbench-pagination">
        <DataGridPagination
          sizes={[5, 10, 25]}
          info={`{from} - {to} / {count} ${itemLabel}`}
        />
      </div>
    </DataGridProvider>
  );
}
