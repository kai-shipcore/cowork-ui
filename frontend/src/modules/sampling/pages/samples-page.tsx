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
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
  { status: 'ARRIVED', label: 'Arrived / 검수 대기', tone: 'warning' },
  { status: 'PASSED', label: '검수 통과', tone: 'success' },
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
  const {
    pageItems: pagedRequests,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleRequests, `${query}|${factory}|${status}`);
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

  return (
    <section>
      <PageHeader
        description="Request 발송 · design/revision/round별 Item · 실제 Shipment/입고를 분리해 추적합니다. Part Lines는 Sample Tracking 시트 형식(부품 1개 = 1행)입니다. Sample 승인은 Parts의 Revision에서 처리합니다."
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
        요청 행 또는 검수 버튼을 선택해 입고·검수를 진행하세요. 저장 결과는
        목록에 바로 반영됩니다.
      </p>
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
        aria-label="샘플 상태 필터"
      >
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
                    scopedRequests.filter((request) =>
                      matchesFilter(request, card.status),
                    ).length
                  }
                </strong>
                <span>{card.label}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground" role="status">
        카드 숫자는 요청 건수입니다. 검수 대기: 입고 후 미검수 항목이 있는 요청
        · 검수 통과: 모든 항목이 통과한 요청. 불합격 결과는 필터 초기화 후 전체
        목록에서 확인하세요.
        {status === 'ARRIVED' && ' Part Lines에는 검수 대기 항목만 표시합니다.'}
      </p>
      <Card>
        <div className="grid-tabs-row">
          <div className="stage-tabs" role="group" aria-label="보기 방식">
            <button
              type="button"
              className="stage-tab"
              aria-pressed={view === 'REQUESTS'}
              onClick={() => setView('REQUESTS')}
            >
              <ClipboardList aria-hidden="true" />
              Requests
              <span className="stage-tab-count">{visibleRequests.length}</span>
            </button>
            <button
              type="button"
              className="stage-tab"
              aria-pressed={view === 'PARTS'}
              onClick={() => setView('PARTS')}
            >
              <List aria-hidden="true" />
              Part Lines
              <span className="stage-tab-count">{trackingRows.length}</span>
            </button>
          </div>
        </div>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
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
              <SelectTrigger
                aria-label="공장 필터"
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
                <X /> 필터 초기화
              </Button>
            )}
          </div>
        </div>
        {view === 'PARTS' && (
          <p className="sample-view-note">
            Part Lines = Sample Tracking 시트(SeatCover-Sample-Request) 형식 ·
            부품 1개 = 1행
          </p>
        )}
        {view === 'PARTS' ? (
          <SampleTrackingTable
            rows={trackingRows}
            filterKey={`${query}|${factory}|${status}`}
            onOpenProject={openProjectSamples}
            onInspect={(row) =>
              setInspection({ requestId: row.requestId, itemId: row.id })
            }
            renderInspection={(row) => {
              const item = sampleRequestItems.find(
                (item) => item.id === row.id,
              );
              return item ? <InspectionResult item={item} compact /> : null;
            }}
          />
        ) : visibleRequests.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Project / Vehicle</TableHead>
                  <TableHead>Factory / Sent</TableHead>
                  <TableHead>Request Items</TableHead>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>검수 결과</TableHead>
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
                    <TableRow
                      key={request.id}
                      className="cursor-pointer"
                      onClick={(event) => {
                        if (
                          !(event.target as HTMLElement).closest(
                            'button, a, input, select',
                          )
                        )
                          setInspection({ requestId: request.id });
                      }}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="sample-id text-left underline-offset-4 hover:underline"
                          aria-label={`${request.id} 입고·검수 열기`}
                          onClick={() =>
                            setInspection({ requestId: request.id })
                          }
                        >
                          {request.id}
                        </button>
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
                                {item.vehicleProductDesignRevisionId} ·{' '}
                                {sampleRoundLabel(item.sampleRound)}
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
                            <ShipmentSummary
                              key={shipment.id}
                              shipment={shipment}
                            />
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
                      <TableCell>
                        <InspectionSummary
                          items={requestItems}
                          onOpen={() =>
                            setInspection({ requestId: request.id })
                          }
                        />
                      </TableCell>
                      <TableCell className="table-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setInspection({ requestId: request.id })
                          }
                        >
                          입고·검수
                        </Button>
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
            />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <strong>조건에 맞는 샘플 요청이 없습니다.</strong>
            <p>검색어, 공장, 상태 필터를 바꿔 보세요.</p>
          </div>
        )}
      </Card>
      {shippingRequest && (
        <ShipmentDialog
          subject={shippingRequest.id}
          factory={shippingRequest.factory}
          onClose={() => setShippingRequest(undefined)}
          onSubmit={(details) => createShipment(shippingRequest, details)}
        />
      )}
      {inspection && (
        <InspectionDialog
          key={inspection.requestId}
          {...inspection}
          onClose={() => setInspection(undefined)}
          onSaved={() =>
            setInspectionMessage(
              `${inspection.requestId} 검수 결과가 저장되었습니다.`,
            )
          }
        />
      )}
    </section>
  );
}
