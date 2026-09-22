import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
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
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ClipboardList, List, PackageCheck, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import {
  matchesInspectionItem,
  matchesInspectionRequest,
} from '@/shared/domain/sample-inspection-filter';
import { sampleRoundLabel } from '@/shared/domain/sample-request';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type {
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
  SampleShipmentDetails,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { InspectionDialog } from '../inspection-dialog';
import { InspectionResult, InspectionSummary } from '../inspection-result';
import { toSampleTrackingRows } from '../sample-tracking';
import { SampleTrackingTable } from '../sample-tracking-table';
import { ShipmentDialog } from '../shipment-dialog';
import { ShipmentSummary } from '../shipment-summary';
import { VendorQualityReport } from '../vendor-quality-report';

type SampleLifecycle = 'DRAFT' | 'SENT' | 'IN_TRANSIT' | 'ARRIVED';
type SampleFilter = SampleLifecycle | 'PASSED';
const STATUS_CARDS: readonly {
  status: SampleFilter;
  label: string;
  tone: 'neutral' | 'warning' | 'progress' | 'success';
}[] = [
  { status: 'DRAFT', label: 'Draft Request', tone: 'neutral' },
  { status: 'SENT', label: 'Sent / Awaiting Shipment', tone: 'warning' },
  { status: 'IN_TRANSIT', label: 'In Transit', tone: 'progress' },
  {
    status: 'ARRIVED',
    label: 'Arrived / Awaiting inspection',
    tone: 'warning',
  },
  { status: 'PASSED', label: 'Inspection passed', tone: 'success' },
];

function itemsOf(request: SampleRequest, items: readonly SampleRequestItem[]) {
  return items.filter((item) => item.sampleRequestId === request.id);
}

function shipmentsOf(
  requestItems: readonly SampleRequestItem[],
  shipments: readonly SampleShipment[],
) {
  const ids = new Set(
    requestItems.flatMap((item) =>
      item.sampleShipmentId ? [item.sampleShipmentId] : [],
    ),
  );
  return shipments.filter((shipment) => ids.has(shipment.id));
}

function lifecycleOf(
  request: SampleRequest,
  items: readonly SampleRequestItem[],
  shipments: readonly SampleShipment[],
): SampleLifecycle {
  if (!request.sentAt) return 'DRAFT';
  const requestItems = itemsOf(request, items);
  const requestShipments = shipmentsOf(requestItems, shipments);
  if (
    requestItems.length > 0 &&
    requestItems.every((item) => item.sampleReceivedAt)
  )
    return 'ARRIVED';
  if (requestShipments.some((shipment) => shipment.shippedAt))
    return 'IN_TRANSIT';
  return 'SENT';
}

/** DDL-grain sample request, line and shipment tracking screen. */
export function SamplesPage() {
  const navigate = useNavigate();
  const {
    sampleRequests: requests,
    setSampleRequests,
    sampleRequestItems,
    setSampleRequestItems,
    sampleShipments,
    setSampleShipments,
    projects,
    projectDetails,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [factory, setFactory] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | SampleFilter>('ALL');
  const [view, setView] = useState<'REQUESTS' | 'PARTS'>('REQUESTS');
  const [shippingRequest, setShippingRequest] = useState<SampleRequest>();
  const [inspection, setInspection] = useState<{
    requestId: string;
    itemId?: string;
  }>();
  const [inspectionMessage, setInspectionMessage] = useState('');
  const factories = [...new Set(requests.map((request) => request.factory))]
    .sort()
    .filter(Boolean);
  const lifecycle = (request: SampleRequest) =>
    lifecycleOf(request, sampleRequestItems, sampleShipments);
  const matchesFilter = (request: SampleRequest, filter: SampleFilter) =>
    filter === 'ARRIVED' || filter === 'PASSED'
      ? matchesInspectionRequest(itemsOf(request, sampleRequestItems), filter)
      : lifecycle(request) === filter;
  const normalizedQuery = query.trim().toLowerCase();
  const scopedRequests = requests.filter((request) => {
    const items = itemsOf(request, sampleRequestItems);
    const references = shipmentsOf(items, sampleShipments)
      .map((item) => item.externalReference)
      .join(' ');
    const haystack =
      `${request.id} ${request.projectGroupId} ${request.vehicle} ${request.product} ${request.factory} ${references}`.toLowerCase();
    return (
      (!normalizedQuery || haystack.includes(normalizedQuery)) &&
      (factory === 'ALL' || request.factory === factory)
    );
  });
  const visibleRequests = scopedRequests.filter(
    (request) => status === 'ALL' || matchesFilter(request, status),
  );
  const columns: FlatDataGridColumn<(typeof visibleRequests)[number]>[] = [
    {
      id: 'request',
      header: 'Request',
      width: 210,
      sortValue: (request) => request.id,
      cell: (request) => (
        <>
          <button
            type="button"
            className="sample-id text-left underline-offset-4 hover:underline"
            aria-label={`${request.id} Open receipt & inspection`}
            onClick={() => {
              setInspection({ requestId: request.id });
            }}
          >
            {request.id}
          </button>
          <div className="vehicle-meta">
            Created {request.createdAt.slice(0, 10)}
          </div>
        </>
      ),
    },
    {
      id: 'vehicle',
      header: 'Project / Vehicle',
      width: 180,
      sortValue: (request) => request.vehicle,
      cell: (request) => (
        <>
          <button
            type="button"
            disabled={!projectIds.has(request.projectGroupId)}
            className="project-reference project-reference-link"
            onClick={() => {
              openProjectSamples(request.projectGroupId);
            }}
          >
            {request.projectGroupId}
          </button>
          <div className="vehicle-name compact">{request.vehicle}</div>
          <div className="vehicle-meta">{request.product}</div>
        </>
      ),
    },
    {
      id: 'factory',
      header: 'Factory / Sent',
      width: 180,
      sortValue: (request) => request.factory,
      cell: (request) => (
        <>
          <strong>{request.factory}</strong>
          <div className="vehicle-meta">
            {request.sentAt
              ? `Sent ${request.sentAt.slice(0, 10)} · ${request.sentBy ?? '—'}`
              : 'Not sent'}
          </div>
        </>
      ),
    },
    {
      id: 'items',
      header: 'Request Items',
      width: 180,
      sortValue: (request) => itemsOf(request, sampleRequestItems).length,
      cell: (request) => {
        const requestItems = itemsOf(request, sampleRequestItems);
        const rounds = [
          ...new Set(requestItems.map((item) => item.sampleRound)),
        ];
        return (
          <>
            <strong>{requestItems.length} lines</strong>
            <div className="vehicle-meta">
              Round {rounds.join(', ') || '—'} ·{' '}
              {requestItems.filter((item) => item.priority === 'URGENT').length}{' '}
              urgent
            </div>
            <div className="sample-line-list">
              {requestItems.map((item) => (
                <span key={item.id}>
                  <code>{item.vehicleProductDesignId}</code>
                  <small>
                    {item.vehicleProductDesignRevisionId} ·{' '}
                    {sampleRoundLabel(item.sampleRound)}
                  </small>
                  {item.priority === 'URGENT' && (
                    <StatusBadge label="URGENT" tone="danger" />
                  )}
                </span>
              ))}
            </div>
          </>
        );
      },
    },
    {
      id: 'shipment',
      header: 'Shipment',
      width: 180,
      cell: (request) => {
        const requestItems = itemsOf(request, sampleRequestItems);
        const shipments = shipmentsOf(requestItems, sampleShipments);
        return (
          <>
            {shipments.length ? (
              shipments.map((shipment) => (
                <ShipmentSummary key={shipment.id} shipment={shipment} />
              ))
            ) : (
              <span className="muted-text">Not assigned</span>
            )}
          </>
        );
      },
    },
    {
      id: 'lifecycle',
      header: 'Lifecycle',
      width: 180,
      sortValue: (request) => lifecycle(request),
      cell: (request) => {
        const state = lifecycle(request);
        return (
          <>
            <StatusBadge
              label={state.replace('_', ' ')}
              tone={
                state === 'ARRIVED'
                  ? 'success'
                  : state === 'IN_TRANSIT'
                    ? 'progress'
                    : state === 'SENT'
                      ? 'warning'
                      : 'neutral'
              }
            />
          </>
        );
      },
    },
    {
      id: 'inspection',
      header: 'Inspection results',
      width: 180,
      cell: (request) => {
        const requestItems = itemsOf(request, sampleRequestItems);
        return (
          <>
            <InspectionSummary
              items={requestItems}
              onOpen={() => {
                setInspection({ requestId: request.id });
              }}
            />
          </>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 180,
      hideable: false,
      cell: (request) => {
        const state = lifecycle(request);
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setInspection({ requestId: request.id });
              }}
            >
              Receipt & inspection
            </Button>
            {state !== 'ARRIVED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  advance(request);
                }}
              >
                {state === 'DRAFT'
                  ? 'Send Request'
                  : state === 'SENT'
                    ? 'Create Shipment'
                    : 'Mark Arrived'}
              </Button>
            )}
          </div>
        );
      },
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...visibleRequests],
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
  const {
    pageItems: pagedRequests,
    pagination,
    setPagination,
  } = useWorkbenchPagination(sortedRows, `${query}|${factory}|${status}`);
  const trackingRows = toSampleTrackingRows({
    requests: visibleRequests,
    items:
      status === 'ARRIVED' || status === 'PASSED'
        ? sampleRequestItems.filter((item) =>
            matchesInspectionItem(item, status),
          )
        : sampleRequestItems,
    projects,
    projectDetails,
  });
  const projectIds = new Set(projects.map((project) => project.id));

  function openProjectSamples(projectId: string): void {
    if (projectIds.has(projectId))
      void navigate(
        `${ROUTES.vehicleProjects}?project=${encodeURIComponent(projectId)}&tab=samples`,
      );
  }

  function advance(request: SampleRequest): void {
    const state = lifecycle(request);
    const now = new Date().toISOString();
    if (state === 'DRAFT') {
      setSampleRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? { ...item, sentAt: now, sentBy: 'USR-KAI' }
            : item,
        ),
      );
      return;
    }
    const requestItems = itemsOf(request, sampleRequestItems);
    if (state === 'SENT') {
      setShippingRequest(request);
      return;
    }
    if (state === 'IN_TRANSIT') {
      const shipmentIds = new Set(
        requestItems.flatMap((item) =>
          item.sampleShipmentId &&
          sampleShipments.some(
            (shipment) =>
              shipment.id === item.sampleShipmentId && shipment.shippedAt,
          )
            ? [item.sampleShipmentId]
            : [],
        ),
      );
      setSampleShipments((current) =>
        current.map((item) =>
          shipmentIds.has(item.id) ? { ...item, arrivedAt: now } : item,
        ),
      );
      setSampleRequestItems((current) =>
        current.map((item) =>
          item.sampleRequestId === request.id &&
          !item.sampleReceivedAt &&
          item.sampleShipmentId &&
          shipmentIds.has(item.sampleShipmentId)
            ? { ...item, sampleReceivedAt: now }
            : item,
        ),
      );
    }
  }

  function createShipment(
    request: SampleRequest,
    details: SampleShipmentDetails,
  ): void {
    const shipmentId = `SHIP-${request.id}-${Date.now().toString().slice(-4)}`;
    setSampleShipments((current) => [
      ...current,
      { id: shipmentId, factory: request.factory, ...details },
    ]);
    setSampleRequestItems((current) =>
      current.map((item) =>
        item.sampleRequestId === request.id &&
        !item.sampleShipmentId &&
        !item.sampleReceivedAt
          ? { ...item, sampleShipmentId: shipmentId }
          : item,
      ),
    );
    setShippingRequest(undefined);
  }

  function resetFilters(): void {
    setQuery('');
    setFactory('ALL');
    setStatus('ALL');
  }

  const filterControls = (
    <>
      <div className="search-field">
        <Search aria-hidden="true" />
        <Input
          aria-label="Search request, project, vehicle, factory, or tracking number"
          placeholder="Request / Project / Vehicle / Tracking number"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      <Select value={factory} onValueChange={setFactory}>
        <SelectTrigger
          aria-label="Factory filter"
          className="filter-select wide"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Factory: All</SelectItem>
          {factories.map((name) => (
            <SelectItem value={name} key={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(query || factory !== 'ALL' || status !== 'ALL') && (
        <Button size="sm" variant="ghost" onClick={resetFilters}>
          <X /> Clear filters
        </Button>
      )}
    </>
  );

  return (
    <section>
      <PageHeader
        description="Track request dispatch, design/revision/round items, and actual shipments and receipts separately. Part Lines uses the Sample Tracking format (one part per row). Approve samples on the part revision."
        tables={
          import.meta.env.DEV
            ? [
                { name: 'sample_request' },
                { name: 'sample_request_item' },
                { name: 'sample_shipment' },
                { name: 'vehicle_product_design' },
                { name: 'vehicle_product_design_revision' },
                { name: 'vehicle_project_group' },
                { name: 'vehicle_project' },
              ]
            : undefined
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Select a request row or inspection button to record receipt and
        inspection. Saved results appear in the list immediately.
      </p>
      <details className="mb-5 rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Factory Quality & Delivery Report / Sample-linked Quality Issues
        </summary>
        <div className="mt-5">
          <VendorQualityReport />
        </div>
      </details>
      {inspectionMessage && (
        <p
          role="status"
          className="mb-4 text-sm text-green-700 dark:text-green-400"
        >
          {inspectionMessage}
        </p>
      )}
      <div
        className="summary-grid sample-status-grid"
        role="group"
        aria-label="Sample status filters"
      >
        {STATUS_CARDS.map((card) => (
          <SummaryCard
            key={card.status}
            label={card.label}
            value={
              scopedRequests.filter((request) =>
                matchesFilter(request, card.status),
              ).length
            }
            icon={<PackageCheck />}
            tone={card.tone}
            selected={status === card.status}
            onClick={() => {
              setStatus((current) =>
                current === card.status ? 'ALL' : card.status,
              );
            }}
          />
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground" role="status">
        Cards count requests. Awaiting inspection: requests with received,
        uninspected items. Passed: every item passed. Clear filters to find
        failed results in the full list.
        {status === 'ARRIVED' &&
          ' Part Lines shows only items awaiting inspection.'}
      </p>
      <Card>
        <div className="grid-tabs-row">
          <div className="stage-tabs" role="group" aria-label="View mode">
            <button
              type="button"
              className="stage-tab"
              aria-pressed={view === 'REQUESTS'}
              onClick={() => {
                setView('REQUESTS');
              }}
            >
              <ClipboardList aria-hidden="true" />
              Requests
              <span className="stage-tab-count">{visibleRequests.length}</span>
            </button>
            <button
              type="button"
              className="stage-tab"
              aria-pressed={view === 'PARTS'}
              onClick={() => {
                setView('PARTS');
              }}
            >
              <List aria-hidden="true" />
              Part Lines
              <span className="stage-tab-count">{trackingRows.length}</span>
            </button>
          </div>
        </div>
        {view === 'PARTS' && (
          <p className="sample-view-note">
            Part Lines = Sample Tracking (SeatCover-Sample-Request) format · One
            part per row
          </p>
        )}
        {view === 'PARTS' ? (
          <SampleTrackingTable
            toolbarContent={filterControls}
            rows={trackingRows}
            filterKey={`${query}|${factory}|${status}`}
            onOpenProject={openProjectSamples}
            onInspect={(row) => {
              setInspection({ requestId: row.requestId, itemId: row.id });
            }}
            renderInspection={(row) => {
              const item = sampleRequestItems.find(
                (item) => item.id === row.id,
              );
              return item ? <InspectionResult item={item} compact /> : null;
            }}
          />
        ) : (
          <>
            <FlatDataGrid
              embedded
              label="Sample Requests"
              toolbarContent={filterControls}
              emptyMessage="No matching sample requests. Try changing the search, factory, or status filters."
              columns={columns}
              rows={pagedRequests}
              getRowId={(request) => request.id}
              onRowClick={(request) => {
                setInspection({ requestId: request.id });
              }}
              rowActionLabel={(request) =>
                `${request.id} Open receipt & inspection`
              }
              pagination={{
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
                totalCount: visibleRequests.length,
                pageSizeOptions: [5, 10, 25],
                onPageChange: (page) => {
                  setPagination((current) => ({
                    ...current,
                    pageIndex: page - 1,
                  }));
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
                    sort
                      ? [{ id: sort.id, desc: sort.direction === 'desc' }]
                      : [],
                  );
                },
              }}
            />
          </>
        )}
      </Card>
      {shippingRequest && (
        <ShipmentDialog
          subject={shippingRequest.id}
          factory={shippingRequest.factory}
          onClose={() => {
            setShippingRequest(undefined);
          }}
          onSubmit={(details) => {
            createShipment(shippingRequest, details);
          }}
        />
      )}
      {inspection && (
        <InspectionDialog
          key={inspection.requestId}
          {...inspection}
          onClose={() => {
            setInspection(undefined);
          }}
          onSaved={() => {
            setInspectionMessage(
              `${inspection.requestId} Inspection results saved.`,
            );
          }}
        />
      )}
    </section>
  );
}
