import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { userName } from '@/shared/domain/app-user';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  LocalApprovalGrants,
  ProductApprovalPanel,
} from '../components/product-approval-panel';
import '@/modules/product-shapes/shape-management.css';

export function ProductRegistrationsPage() {
  const {
    registrations,
    registrationItems,
    masterProducts,
    approvalRequests,
    appUsers,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [reviewing, setReviewing] = useState('');
  const itemsOf = (id: string) =>
    registrationItems.filter((item) => item.registrationId === id);
  const statusOf = (id: string) =>
    approvalRequests.filter((request) => request.entityId === id).slice(-1)[0]
      ?.status ??
    (registrations.find((row) => row.id === id)?.approvedAt
      ? 'LEGACY_APPROVED'
      : 'NOT_SUBMITTED');
  const visible = registrations.filter(
    (row) =>
      (filter === 'ALL' || statusOf(row.id) === filter) &&
      `${row.id} ${userName(appUsers, row.requestedBy)} ${itemsOf(row.id)
        .map(
          (item) =>
            masterProducts.find((p) => p.id === item.masterProductId)?.sku,
        )
        .join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns: FlatDataGridColumn<(typeof visible)[number]>[] = [
    {
      id: 'registration',
      header: '등록',
      width: 210,
      sortValue: (row) => row.id,
      cell: (row) => (
        <>
          <strong>{row.id}</strong>
          <div className="vehicle-meta">{row.requestedAt.slice(0, 10)}</div>
        </>
      ),
    },
    {
      id: 'requester',
      header: '요청자',
      width: 180,
      sortValue: (row) => userName(appUsers, row.requestedBy),
      cell: (row) => <>{userName(appUsers, row.requestedBy)}</>,
    },
    {
      id: 'sku',
      header: 'SKU',
      width: 180,
      cell: (row) => (
        <>
          {itemsOf(row.id).map((item) => (
            <div key={item.id}>
              {masterProducts.find(
                (product) => product.id === item.masterProductId,
              )?.sku ?? '제품 누락'}
            </div>
          ))}
        </>
      ),
    },
    {
      id: 'status',
      header: '상태',
      width: 180,
      sortValue: (row) => statusOf(row.id),
      cell: (row) => <>{statusOf(row.id)}</>,
    },
    {
      id: 'actions',
      header: '작업',
      width: 180,
      hideable: false,
      cell: (row) => (
        <>
          <Button
            variant="outline"
            onClick={() => {
              setReviewing(row.id);
            }}
          >
            검토·이력
          </Button>
        </>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...visible],
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
    `${query}|${filter}`,
  );
  return (
    <section className="shape-management">
      <PageHeader
        description="제품 등록 · 단계별 승인 / 반려 이력 보존 / 최종 승인 시 제품과 SKU 일괄 반영"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_product_registration' },
                { name: 'vehicle_product_registration_item' },
                { name: 'registration_item_x_vehicle_product_shape' },
                { name: 'vehicle_product' },
                { name: 'master_product' },
                { name: 'approval_type' },
                { name: 'user_x_approval_type_grant' },
                { name: 'approval_request' },
                { name: 'approval_request_step' },
                { name: 'approval_request_step_assignment' },
              ]
            : undefined
        }
      />
      <p>
        현재 브라우저 저장 기반의 승인 흐름입니다. 실제 사용자 인증과 서버
        트랜잭션은 연결 전입니다.
      </p>
      <Card>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                aria-label="등록 번호, 요청자, SKU 검색"
                placeholder="등록 번호 / 요청자 / SKU 검색"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger
                aria-label="승인 상태"
                className="filter-select wide"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Status: All</SelectItem>
                {[
                  'NOT_SUBMITTED',
                  'PENDING',
                  'APPROVED',
                  'REJECTED',
                  'CANCELLED',
                  'LEGACY_APPROVED',
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <FlatDataGrid
          embedded
          label="Product Registrations"
          columns={columns}
          rows={pageItems}
          getRowId={(row) => row.id}

          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: visible.length,
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
              ? {
                  id: activeSort.id,
                  direction: activeSort.desc ? 'desc' : 'asc',
                }
              : null,
            onChange: (sort) => {
              gridTable.setSorting(
                sort ? [{ id: sort.id, desc: sort.direction === 'desc' }] : [],
              );
            },
          }}
        />
        {!visible.length && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <strong>표시할 등록 요청이 없습니다.</strong>
            <p>검색어나 승인 상태 필터를 바꿔 보세요.</p>
          </div>
        )}
      </Card>
      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (!open) setReviewing('');
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>등록 검토 · {reviewing}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {itemsOf(reviewing).map((item) => (
              <section className="shape-section" key={item.id}>
                <strong>
                  {
                    masterProducts.find(
                      (product) => product.id === item.masterProductId,
                    )?.sku
                  }
                </strong>
                <p>
                  근거 Shape:{' '}
                  {item.sourceShapeIds?.length
                    ? item.sourceShapeIds.join(', ')
                    : '별도 근거 없음'}
                </p>
                {item.vehicleProjectIds.length > 0 && (
                  <p>
                    이전 기록의 프로젝트 참조:{' '}
                    {item.vehicleProjectIds.join(', ')} (기존 데이터 보존)
                  </p>
                )}
              </section>
            ))}
            {reviewing && (
              <ProductApprovalPanel
                key={reviewing}
                registrationId={reviewing}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewing('');
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LocalApprovalGrants />
    </section>
  );
}
