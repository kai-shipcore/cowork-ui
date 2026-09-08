import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { PackageCheck, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import type {
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

type SampleLifecycle = 'DRAFT' | 'SENT' | 'IN_TRANSIT' | 'ARRIVED';
const STATUS_CARDS: readonly {
  status: SampleLifecycle;
  label: string;
  tone: 'neutral' | 'warning' | 'progress' | 'success';
}[] = [
  { status: 'DRAFT', label: 'Draft Request', tone: 'neutral' },
  { status: 'SENT', label: 'Sent / Awaiting Shipment', tone: 'warning' },
  { status: 'IN_TRANSIT', label: 'In Transit', tone: 'progress' },
  { status: 'ARRIVED', label: 'Arrived / Inspect', tone: 'success' },
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
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [factory, setFactory] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | SampleLifecycle>('ALL');
  const factories = [...new Set(requests.map((request) => request.factory))]
    .sort()
    .filter(Boolean);
  const lifecycle = (request: SampleRequest) =>
    lifecycleOf(request, sampleRequestItems, sampleShipments);
  const normalizedQuery = query.trim().toLowerCase();
  const scopedRequests = requests.filter((request) => {
    const items = itemsOf(request, sampleRequestItems);
    const references = shipmentsOf(items, sampleShipments)
      .map((item) => item.shipmentReference)
      .join(' ');
    const haystack =
      `${request.id} ${request.projectGroupId} ${request.vehicle} ${request.product} ${request.factory} ${references}`.toLowerCase();
    return (
      (!normalizedQuery || haystack.includes(normalizedQuery)) &&
      (factory === 'ALL' || request.factory === factory)
    );
  });
  const visibleRequests = scopedRequests.filter(
    (request) => status === 'ALL' || lifecycle(request) === status,
  );
  const {
    pageItems: pagedRequests,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleRequests, `${query}|${factory}|${status}`);
  const projectIds = new Set(projects.map((project) => project.id));

  function openProjectSamples(projectId: string): void {
    if (projectIds.has(projectId))
      navigate(
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
      const shipmentId = `SHIP-${request.id}-${Date.now().toString().slice(-4)}`;
      setSampleShipments((current) => [
        ...current,
        {
          id: shipmentId,
          factory: request.factory,
          sampleReadyAt: now,
          shippedAt: now,
          shipmentReference: `TRACK-${request.id}`,
        },
      ]);
      setSampleRequestItems((current) =>
        current.map((item) =>
          item.sampleRequestId === request.id
            ? { ...item, sampleShipmentId: shipmentId }
            : item,
        ),
      );
      return;
    }
    if (state === 'IN_TRANSIT') {
      const shipmentIds = new Set(
        requestItems.flatMap((item) =>
          item.sampleShipmentId ? [item.sampleShipmentId] : [],
        ),
      );
      setSampleShipments((current) =>
        current.map((item) =>
          shipmentIds.has(item.id) ? { ...item, arrivedAt: now } : item,
        ),
      );
      setSampleRequestItems((current) =>
        current.map((item) =>
          item.sampleRequestId === request.id
            ? { ...item, sampleReceivedAt: now }
            : item,
        ),
      );
    }
  }

  function resetFilters(): void {
    setQuery('');
    setFactory('ALL');
    setStatus('ALL');
  }

  return (
    <section>
      <PageHeader
        description="Request 발송 · design/revision/round별 Item · 실제 Shipment/입고를 분리해 추적합니다. Sample 승인은 Parts의 Revision에서 처리합니다."
        tables={
          import.meta.env.DEV
            ? [
                { name: 'sample_request' },
                { name: 'sample_request_item' },
                { name: 'sample_shipment' },
                { name: 'vehicle_product_design_revision' },
              ]
            : undefined
        }
      />
      <div className="summary-grid" role="group" aria-label="샘플 상태 필터">
        {STATUS_CARDS.map((card) => (
          <button
            type="button"
            className="summary-card-button"
            aria-pressed={status === card.status}
            onClick={() =>
              setStatus((current) =>
                current === card.status ? 'ALL' : card.status,
              )
            }
            key={card.status}
          >
            <Card
              className={`summary-card summary-${card.tone}${status === card.status ? ' active' : ''}`}
            >
              <PackageCheck />
              <div>
                <strong>
                  {
                    scopedRequests.filter(
                      (request) => lifecycle(request) === card.status,
                    ).length
                  }
                </strong>
                <span>{card.label}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>
      <div className="workbench-filters">
        <div className="search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label="Request, Project, 차량, 공장, 송장번호 검색"
            placeholder="Request / Project / 차량 / 송장번호"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={factory} onValueChange={setFactory}>
          <SelectTrigger aria-label="공장 필터" className="filter-select wide">
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
            <X /> 필터 초기화
          </Button>
        )}
        <span className="filter-count">
          {visibleRequests.length} / {requests.length} 요청
        </span>
      </div>
      {visibleRequests.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Project / Vehicle</TableHead>
                <TableHead>Factory / Sent</TableHead>
                <TableHead>Request Items</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRequests.map((request) => {
                const requestItems = itemsOf(request, sampleRequestItems);
                const shipments = shipmentsOf(requestItems, sampleShipments);
                const state = lifecycle(request);
                const rounds = [
                  ...new Set(requestItems.map((item) => item.sampleRound)),
                ];
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <span className="sample-id">{request.id}</span>
                      <div className="vehicle-meta">
                        Created {request.createdAt.slice(0, 10)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        disabled={!projectIds.has(request.projectGroupId)}
                        className="project-reference project-reference-link"
                        onClick={() =>
                          openProjectSamples(request.projectGroupId)
                        }
                      >
                        {request.projectGroupId}
                      </button>
                      <div className="vehicle-name compact">
                        {request.vehicle}
                      </div>
                      <div className="vehicle-meta">{request.product}</div>
                    </TableCell>
                    <TableCell>
                      <strong>{request.factory}</strong>
                      <div className="vehicle-meta">
                        {request.sentAt
                          ? `Sent ${request.sentAt.slice(0, 10)} · ${request.sentBy}`
                          : 'Not sent'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <strong>{requestItems.length} lines</strong>
                      <div className="vehicle-meta">
                        Round {rounds.join(', ') || '—'} ·{' '}
                        {
                          requestItems.filter(
                            (item) => item.priority === 'URGENT',
                          ).length
                        }{' '}
                        urgent
                      </div>
                      <div className="sample-line-list">
                        {requestItems.map((item) => (
                          <span key={item.id}>
                            <code>{item.vehicleProductDesignId}</code>
                            <small>
                              {item.vehicleProductDesignRevisionId} · Round{' '}
                              {item.sampleRound}
                            </small>
                            {item.priority === 'URGENT' && (
                              <StatusBadge label="URGENT" tone="danger" />
                            )}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {shipments.length ? (
                        shipments.map((shipment) => (
                          <div key={shipment.id}>
                            <span className="tracking-code">
                              {shipment.shipmentReference ?? shipment.id}
                            </span>
                            <div className="vehicle-meta">
                              {shipment.arrivedAt ? 'Arrived' : 'In transit'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="muted-text">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="table-actions">
                      {state !== 'ARRIVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => advance(request)}
                        >
                          {state === 'DRAFT'
                            ? 'Send Request'
                            : state === 'SENT'
                              ? 'Create Shipment'
                              : 'Mark Arrived'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <WorkbenchPagination
            recordCount={visibleRequests.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            itemLabel="requests"
          />
        </Card>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <strong>조건에 맞는 샘플 요청이 없습니다.</strong>
          <p>검색어, 공장, 상태 필터를 바꿔 보세요.</p>
        </div>
      )}
    </section>
  );
}
