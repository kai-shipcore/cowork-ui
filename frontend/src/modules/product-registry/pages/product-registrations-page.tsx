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
import { Search, Send, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { userName } from '@/shared/domain/app-user';
import {
  APPROVAL_STATUS_LABELS,
  requestProgress,
  type EntityApprovalStatus,
} from '@/shared/domain/approval/approval-model';
import { ApprovalStatusChip } from '@/shared/domain/approval/approval-status-chip';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ProductApprovalPanel } from '../components/product-approval-panel';
import '@/modules/product-shapes/shape-management.css';
import '@/shared/domain/approval/approval.css';

const STATUS_FILTERS: readonly EntityApprovalStatus[] = [
  'NOT_SUBMITTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'LEGACY_APPROVED',
];
const RESUBMITTABLE: readonly EntityApprovalStatus[] = [
  'NOT_SUBMITTED',
  'REJECTED',
  'CANCELLED',
];

export function ProductRegistrationsPage() {
  const {
    registrations,
    registrationItems,
    masterProducts,
    approvalRequests,
    approvalSteps,
    approvalAssignments,
    appUsers,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  // The open registration lives in the URL so the approval inbox can link here.
  const [params, setParams] = useSearchParams();
  const reviewing = params.get('review') ?? '';
  const [submitIntent, setSubmitIntent] = useState(false);
  const openReview = (id: string, submit = false) => {
    setSubmitIntent(submit);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('review', id);
      return next;
    });
  };
  const closeReview = () => {
    setSubmitIntent(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('review');
      return next;
    });
  };
  const itemsOf = (id: string) =>
    registrationItems.filter((item) => item.registrationId === id);
  const latestRequest = (id: string) =>
    approvalRequests
      .filter((request) => request.entityId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-1)
      .pop();
  const statusOf = (id: string): EntityApprovalStatus =>
    latestRequest(id)?.status ??
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
      header: 'Create',
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
      header: 'Requester',
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
              )?.sku ?? 'Product missing'}
            </div>
          ))}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Approval',
      width: 260,
      sortValue: (row) => statusOf(row.id),
      cell: (row) => {
        const request = latestRequest(row.id);
        const progress = request
          ? requestProgress(
              request,
              approvalSteps,
              approvalAssignments,
              appUsers,
            )
          : undefined;
        return (
          <ApprovalStatusChip
            status={statusOf(row.id)}
            detail={
              progress
                ? [progress.label, progress.detail].filter(Boolean).join(' · ')
                : undefined
            }
          />
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 260,
      hideable: false,
      cell: (row) => (
        <div className="approval-panel-actions">
          {RESUBMITTABLE.includes(statusOf(row.id)) && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                openReview(row.id, true);
              }}
            >
              <Send /> Submit for approval
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              openReview(row.id);
            }}
          >
            Open
          </Button>
        </div>
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
        description="Product registration · Step-by-step approvals / Rejection history preserved / Products and SKUs created together on final approval"
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
      <Card>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                aria-label="Search registration ID, requester, or SKU"
                placeholder="Search registration ID / Requester / SKU"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger
                aria-label="Approval status"
                className="filter-select wide"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Approval: All</SelectItem>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {APPROVAL_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(query || filter !== 'ALL') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  setFilter('ALL');
                }}
              >
                <X /> Clear filters
              </Button>
            )}
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
            <strong>No registration requests to display.</strong>
            <p>Try changing the search term or approval status filter.</p>
          </div>
        )}
      </Card>
      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>Registration review · {reviewing}</DialogTitle>
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
                  Reference Shape:{' '}
                  {item.sourceShapeIds?.length
                    ? item.sourceShapeIds.join(', ')
                    : 'No separate reference'}
                </p>
                {item.vehicleProjectIds.length > 0 && (
                  <p>
                    Legacy project reference:{' '}
                    {item.vehicleProjectIds.join(', ')} (Legacy data preserved)
                  </p>
                )}
              </section>
            ))}
            {reviewing && (
              <ProductApprovalPanel
                key={reviewing}
                registrationId={reviewing}
                initialSubmitOpen={submitIntent}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeReview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
