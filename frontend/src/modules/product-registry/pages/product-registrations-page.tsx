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
import { userName } from '@/shared/domain/app-user';
import { PageHeader } from '@/shared/components/page-header';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
  const { pageItems, pagination, setPagination } = useWorkbenchPagination(
    visible,
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
      <div className="shape-filters">
        <Input
          aria-label="등록 번호, 요청자, SKU 검색"
          placeholder="등록 번호 / 요청자 / SKU 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="승인 상태"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            'ALL',
            'NOT_SUBMITTED',
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED',
            'LEGACY_APPROVED',
          ].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>등록</TableHead>
              <TableHead>요청자</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.id}
                  <small>{row.requestedAt}</small>
                </TableCell>
                <TableCell>{userName(appUsers, row.requestedBy)}</TableCell>
                <TableCell>
                  {itemsOf(row.id).map((item) => (
                    <div key={item.id}>
                      {masterProducts.find(
                        (product) => product.id === item.masterProductId,
                      )?.sku ?? '제품 누락'}
                    </div>
                  ))}
                </TableCell>
                <TableCell>{statusOf(row.id)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => setReviewing(row.id)}
                  >
                    검토·이력
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <WorkbenchPagination
          recordCount={visible.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          itemLabel="registrations"
        />
      </Card>
      {!visible.length && <p>표시할 등록 요청이 없습니다.</p>}
      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => !open && setReviewing('')}
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
                  {item.sourceShapeIds?.join(', ') || '별도 근거 없음'}
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
            <Button variant="outline" onClick={() => setReviewing('')}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LocalApprovalGrants />
    </section>
  );
}
