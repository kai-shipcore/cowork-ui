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
import { Input } from '@coverland-engineering/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { Check, PackageCheck, Search, Trash2, X } from 'lucide-react';
import { userName } from '@/shared/domain/app-user';
import { PageHeader } from '@/shared/components/page-header';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import { StatusBadge } from '@/shared/components/status-badge';
import type {
  MasterProductSku,
  VehicleProductRegistration,
} from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';

type ApprovalFilter = 'ALL' | 'PENDING' | 'APPROVED';

/** Approval queue for product registration requests. */
export function ProductRegistrationsPage() {
  const {
    registrations,
    setRegistrations,
    registrationItems,
    setRegistrationItems,
    masterProducts,
    setMasterProducts,
    setMasterProductSkus,
    setUniqueVehicles,
    appUsers,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ApprovalFilter>('ALL');
  const [reviewing, setReviewing] = useState<VehicleProductRegistration>();
  const [pendingDelete, setPendingDelete] =
    useState<VehicleProductRegistration>();

  const itemsOf = (registrationId: string) =>
    registrationItems.filter((item) => item.registrationId === registrationId);
  const productOf = (masterProductId: string) =>
    masterProducts.find((product) => product.id === masterProductId);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRegistrations = registrations.filter((registration) => {
    const skus = itemsOf(registration.id)
      .map((item) => productOf(item.masterProductId)?.sku ?? '')
      .join(' ');
    const matchesQuery =
      !normalizedQuery ||
      `${registration.id} ${userName(appUsers, registration.requestedBy)} ${skus}`
        .toLowerCase()
        .includes(normalizedQuery);
    const isPending = registration.approvedAt === undefined;
    const matchesFilter =
      filter === 'ALL' || (filter === 'PENDING' ? isPending : !isPending);
    return matchesQuery && matchesFilter;
  });
  const pendingCount = registrations.filter(
    (registration) => registration.approvedAt === undefined,
  ).length;
  const {
    pageItems: pagedRegistrations,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleRegistrations, `${query}|${filter}`);

  /** Approval is per registration; every item goes ACTIVE together. */
  function approve(registration: VehicleProductRegistration): void {
    const now = new Date().toISOString();
    const productIds = itemsOf(registration.id).map(
      (item) => item.masterProductId,
    );
    const approvedFNumbers = productIds
      .map((productId) => productOf(productId)?.fNumber)
      .filter((fNumber): fNumber is string => fNumber !== undefined);
    setRegistrations((current) =>
      current.map((item) =>
        item.id === registration.id
          ? { ...item, approvedAt: now, approvedBy: CURRENT_USER_ID }
          : item,
      ),
    );
    setMasterProducts((current) =>
      current.map((product) =>
        productIds.includes(product.id)
          ? { ...product, status: 'ACTIVE' as const, updatedAt: now }
          : product,
      ),
    );
    setUniqueVehicles((current) =>
      current.map((vehicle) =>
        approvedFNumbers.includes(vehicle.fNumber)
          ? { ...vehicle, skuStatus: 'ACTIVE' as const }
          : vehicle,
      ),
    );
    // Approval is when the SKU starts being valid, so it opens the history.
    const openedSkus: MasterProductSku[] = productIds.flatMap((productId) => {
      const product = productOf(productId);
      return product
        ? [
            {
              id: `MPS-${product.sku}-1`,
              masterProductId: product.id,
              sku: product.sku,
              validFrom: now,
              note: '최초 등록',
            },
          ]
        : [];
    });
    setMasterProductSkus((current) => [...current, ...openedSkus]);
    setReviewing(undefined);
  }

  /**
   * There is no reject state, so a mistaken request is deleted. That has to
   * remove the master products too: their ids are unique across registration
   * items, and leaving them behind would permanently block re-registering the
   * same SKU.
   */
  function deleteRegistration(registration: VehicleProductRegistration): void {
    const items = itemsOf(registration.id);
    const productIds = items.map((item) => item.masterProductId);
    const releasedFNumbers = productIds
      .map((productId) => productOf(productId)?.fNumber)
      .filter((fNumber): fNumber is string => fNumber !== undefined);
    setRegistrationItems((current) =>
      current.filter((item) => item.registrationId !== registration.id),
    );
    setMasterProducts((current) =>
      current.filter((product) => !productIds.includes(product.id)),
    );
    setMasterProductSkus((current) =>
      current.filter((row) => !productIds.includes(row.masterProductId)),
    );
    setRegistrations((current) =>
      current.filter((item) => item.id !== registration.id),
    );
    setUniqueVehicles((current) =>
      current.map((vehicle) =>
        releasedFNumbers.includes(vehicle.fNumber)
          ? { ...vehicle, skuStatus: 'DRAFT' as const }
          : vehicle,
      ),
    );
    setPendingDelete(undefined);
    setReviewing(undefined);
  }

  return (
    <section>
      <PageHeader
        description="Product 등록 요청 승인 — 승인은 등록 단위 일괄 처리이며, 반려 대신 승인 대기 건 삭제로 되돌립니다"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_product_registration' },
                { name: 'vehicle_product_registration_item' },
                { name: 'registration_item_x_vehicle_project' },
                { name: 'master_product' },
              ]
            : undefined
        }
      />

      <div className="summary-grid" role="group" aria-label="승인 상태 필터">
        <SummaryTile
          label="승인 대기"
          value={pendingCount}
          tone="warning"
          active={filter === 'PENDING'}
          onToggle={() =>
            setFilter((current) => (current === 'PENDING' ? 'ALL' : 'PENDING'))
          }
        />
        <SummaryTile
          label="승인 완료"
          value={registrations.length - pendingCount}
          tone="success"
          active={filter === 'APPROVED'}
          onToggle={() =>
            setFilter((current) =>
              current === 'APPROVED' ? 'ALL' : 'APPROVED',
            )
          }
        />
      </div>

      <div className="workbench-filters">
        <div className="search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label="등록 번호, 요청자, SKU 검색"
            placeholder="VPR / 요청자 / SKU 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {(normalizedQuery || filter !== 'ALL') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery('');
              setFilter('ALL');
            }}
          >
            <X /> 필터 초기화
          </Button>
        )}
        <span className="filter-count">
          {visibleRegistrations.length} / {registrations.length} 등록
        </span>
      </div>

      {visibleRegistrations.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>등록</TableHead>
                <TableHead>요청자</TableHead>
                <TableHead>아이템</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="action-column" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRegistrations.map((registration) => {
                const items = itemsOf(registration.id);
                const isPending = registration.approvedAt === undefined;
                return (
                  <TableRow
                    key={registration.id}
                    className="row-link"
                    onClick={() => setReviewing(registration)}
                  >
                    <TableCell>
                      <span className="visit-reference">{registration.id}</span>
                      <div className="vehicle-meta">
                        {registration.requestedAt.slice(0, 10)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {userName(appUsers, registration.requestedBy)}
                    </TableCell>
                    <TableCell>{items.length}건</TableCell>
                    <TableCell>
                      {items.map((item) => (
                        <div className="generated-sku compact" key={item.id}>
                          {productOf(item.masterProductId)?.sku ?? '—'}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={isPending ? '승인 대기' : '승인 완료'}
                        tone={isPending ? 'warning' : 'success'}
                      />
                      {!isPending && (
                        <div className="vehicle-meta">
                          {userName(appUsers, registration.approvedBy)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="table-actions">
                      <Button size="sm" variant="outline">
                        검토
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <WorkbenchPagination
            recordCount={visibleRegistrations.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            itemLabel="registrations"
          />
        </Card>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <strong>등록 요청이 없습니다.</strong>
          <p>
            Unique Vehicles / F# 화면에서 &quot;등록 요청&quot;으로 시작합니다.
          </p>
        </div>
      )}

      <Dialog
        open={reviewing !== undefined}
        onOpenChange={(open) => !open && setReviewing(undefined)}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>등록 검토 · {reviewing?.id}</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <DialogBody className="detail-card-list">
              <div className="detail-card">
                <span className="detail-card-label">
                  요청자 {userName(appUsers, reviewing.requestedBy)} ·{' '}
                  {reviewing.requestedAt.slice(0, 10)}
                </span>
                <strong>
                  {reviewing.approvedAt ? '승인 완료' : '승인 대기'}
                </strong>
                {reviewing.note && (
                  <dl className="detail-rows">
                    <div>
                      <dt>메모</dt>
                      <dd>{reviewing.note}</dd>
                    </div>
                  </dl>
                )}
              </div>

              {itemsOf(reviewing.id).map((item) => {
                const product = productOf(item.masterProductId);
                return (
                  <div className="detail-card" key={item.id}>
                    <span className="detail-card-label">
                      {item.id} · {product?.fNumber}
                    </span>
                    <strong className="generated-sku">
                      {product?.sku ?? '—'}
                    </strong>
                    <dl className="detail-rows">
                      <div>
                        <dt>근거 Zone Project</dt>
                        <dd>
                          <span className="zone-list">
                            {item.vehicleProjectIds.map((projectId) => (
                              <span
                                className="zone-project-reference"
                                key={projectId}
                              >
                                {projectId}
                              </span>
                            ))}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Product 상태</dt>
                        <dd>
                          <StatusBadge
                            label={product?.status ?? 'DRAFT'}
                            tone={
                              product?.status === 'ACTIVE'
                                ? 'success'
                                : 'neutral'
                            }
                          />
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </DialogBody>
          )}
          <DialogFooter>
            {reviewing && reviewing.approvedAt === undefined && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setPendingDelete(reviewing)}
                >
                  <Trash2 /> 삭제
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviewing(undefined)}
                >
                  닫기
                </Button>
                <Button variant="primary" onClick={() => approve(reviewing)}>
                  <Check /> 등록 승인 ({itemsOf(reviewing.id).length}건)
                </Button>
              </>
            )}
            {reviewing?.approvedAt !== undefined && (
              <Button variant="outline" onClick={() => setReviewing(undefined)}>
                닫기
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>등록 요청 삭제</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="dialog-note">
              {pendingDelete?.id}의 아이템과 생성된 Master Product가 함께
              삭제되어 같은 SKU를 다시 등록할 수 있게 됩니다. 해당 F#은 DRAFT로
              돌아갑니다.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(undefined)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteRegistration(pendingDelete)}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface SummaryTileProps {
  label: string;
  value: number;
  tone: 'warning' | 'success';
  active: boolean;
  onToggle: () => void;
}

function SummaryTile({
  label,
  value,
  tone,
  active,
  onToggle,
}: SummaryTileProps) {
  return (
    <button
      type="button"
      className="summary-card-button"
      aria-pressed={active}
      onClick={onToggle}
    >
      <Card
        className={`summary-card summary-${tone}${active ? ' active' : ''}`}
      >
        <PackageCheck />
        <div>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      </Card>
    </button>
  );
}
