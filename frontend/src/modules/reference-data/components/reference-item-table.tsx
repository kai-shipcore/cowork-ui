import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
  const { pageItems, pagination, setPagination } = useWorkbenchPagination(
    items,
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
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>{entityLabel} 이름</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>최근 수정</TableHead>
            <TableHead className="action-column" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="reference-code">{item.code}</span>
              </TableCell>
              <TableCell>
                <div className="vehicle-name compact">{item.name}</div>
                <div className="vehicle-meta">{item.id}</div>
              </TableCell>
              <TableCell>{productName(item.productTypeId)}</TableCell>
              <TableCell>
                <span className="vehicle-meta">
                  {item.updatedAt.slice(0, 10)}
                </span>
              </TableCell>
              <TableCell className="table-actions">
                <Button
                  size="sm"
                  variant="outline"
                  mode="icon"
                  aria-label={`${item.name} 수정`}
                  onClick={() => onEdit(item)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  mode="icon"
                  aria-label={`${item.name} 삭제`}
                  onClick={() => onDelete(item)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <WorkbenchPagination
        recordCount={items.length}
        pagination={pagination}
        onPaginationChange={setPagination}
        itemLabel="items"
      />
    </Card>
  );
}
