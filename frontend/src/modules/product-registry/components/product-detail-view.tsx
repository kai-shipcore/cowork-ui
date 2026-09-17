import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import { Plus } from 'lucide-react';
import { userName } from '@/shared/domain/app-user';
import { StatusBadge } from '@/shared/components/status-badge';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type {
  AppUser,
  MasterProduct,
  MasterProductPackaging,
  MasterProductSku,
  ProductReferenceItem,
  VehicleProductRegistration,
  VehicleProductRegistrationItem,
} from '@/shared/types/workbench';

export interface NewSkuVersion {
  sku: string;
  validFrom: string;
  note: string;
}

export interface NewPackagingVersion {
  length: string;
  width: string;
  height: string;
  weight: string;
  validFrom: string;
}

interface ProductDetailViewProps {
  product: MasterProduct;
  material?: ProductReferenceItem;
  users: readonly AppUser[];
  /** Shape names in zone order — the SKU's size segment(s). */
  shapeNames: readonly string[];
  skuHistory: readonly MasterProductSku[];
  packagingHistory: readonly MasterProductPackaging[];
  registration?: VehicleProductRegistration;
  registrationItem?: VehicleProductRegistrationItem;
  onIssueSku: (version: NewSkuVersion) => readonly string[];
  onIssuePackaging: (version: NewPackagingVersion) => readonly string[];
}

function productName(productTypeId: string): string {
  return (
    PRODUCT_TYPES.find((productType) => productType.id === productTypeId)
      ?.product ?? productTypeId
  );
}

/** Current version first; a row without `validTo` is the one in effect. */
function byNewestFirst<T extends { validFrom: string }>(
  rows: readonly T[],
): readonly T[] {
  return [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Product detail. SKU and packaging are effective-dated, so both are shown as
 * version timelines and changed by issuing a new version — never edited.
 */
export function ProductDetailView({
  product,
  material,
  users,
  shapeNames,
  skuHistory,
  packagingHistory,
  registration,
  registrationItem,
  onIssueSku,
  onIssuePackaging,
}: ProductDetailViewProps) {
  const [skuDialogOpen, setSkuDialogOpen] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [packagingDialogOpen, setPackagingDialogOpen] = useState(false);
  const [newSku, setNewSku] = useState(product.sku);
  const [skuNote, setSkuNote] = useState('');
  const [validFrom, setValidFrom] = useState(TODAY);
  const [length, setLength] = useState('42');
  const [width, setWidth] = useState('30');
  const [height, setHeight] = useState('12');
  const [weight, setWeight] = useState('3.4');

  return (
    <div className="product-detail-stack">
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            <span className="generated-sku">{product.sku}</span>
            {import.meta.env.DEV && (
              <small>master_product · vehicle_product</small>
            )}
          </CardTitle>
          <StatusBadge
            label={product.status}
            tone={
              product.status === 'ACTIVE'
                ? 'success'
                : product.status === 'DISCONTINUED'
                  ? 'danger'
                  : product.status === 'CLOSEOUT'
                    ? 'warning'
                    : 'neutral'
            }
          />
        </CardHeader>
        <CardContent>
          <dl className="detail-rows">
            <div>
              <dt>Product Type</dt>
              <dd>{productName(product.productTypeId)}</dd>
            </div>
            <div>
              <dt>F#</dt>
              <dd>
                <span className="f-number">{product.fNumber}</span>
              </dd>
            </div>
            <div>
              <dt>Shape</dt>
              <dd>
                {shapeNames.length ? (
                  <span className="shape-list">
                    {shapeNames.map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </span>
                ) : (
                  <span className="muted-text">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>재질</dt>
              <dd>{material ? `${material.code} · ${material.name}` : '—'}</dd>
            </div>
            <div>
              <dt>출처 등록</dt>
              <dd>
                {registration ? (
                  <>
                    <span className="visit-reference">{registration.id}</span>{' '}
                    요청 {userName(users, registration.requestedBy)} · 승인{' '}
                    {registration.approvedBy
                      ? userName(users, registration.approvedBy)
                      : '대기'}
                  </>
                ) : (
                  <span className="muted-text">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>근거 Zone Project</dt>
              <dd>
                {registrationItem?.vehicleProjectIds.length ? (
                  <span className="zone-list">
                    {registrationItem.vehicleProjectIds.map((projectId) => (
                      <span className="zone-project-reference" key={projectId}>
                        {projectId}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted-text">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            SKU 이력 {import.meta.env.DEV && <small>master_product_sku</small>}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewSku(product.sku);
              setSkuNote('');
              setValidFrom(TODAY);
              setSkuDialogOpen(true);
            }}
          >
            <Plus /> 새 SKU 발행
          </Button>
        </CardHeader>
        <CardContent className="version-list">
          {skuHistory.length ? (
            byNewestFirst(skuHistory).map((row) => (
              <div className="version-row" key={row.id}>
                <span className="generated-sku compact">{row.sku}</span>
                <span className="version-range">
                  {row.validFrom.slice(0, 10)} ~{' '}
                  {row.validTo ? row.validTo.slice(0, 10) : '현재'}
                </span>
                {row.validTo === undefined && (
                  <StatusBadge label="현재" tone="success" />
                )}
                {row.note && <span className="muted-text">{row.note}</span>}
              </div>
            ))
          ) : (
            <div className="empty-inline">
              승인 시점에 첫 SKU 버전이 기록됩니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            Packaging 이력{' '}
            {import.meta.env.DEV && <small>master_product_packaging</small>}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setValidFrom(TODAY);
              setPackagingDialogOpen(true);
            }}
          >
            <Plus /> 새 Packaging 발행
          </Button>
        </CardHeader>
        <CardContent className="version-list">
          {packagingHistory.length ? (
            byNewestFirst(packagingHistory).map((row) => (
              <div className="version-row" key={row.id}>
                <strong>
                  {row.length} × {row.width} × {row.height} {row.dimensionUnit}{' '}
                  · {row.weight} {row.weightUnit}
                </strong>
                <span className="version-range">
                  {row.validFrom.slice(0, 10)} ~{' '}
                  {row.validTo ? row.validTo.slice(0, 10) : '현재'}
                </span>
                {row.validTo === undefined && (
                  <StatusBadge label="현재" tone="success" />
                )}
              </div>
            ))
          ) : (
            <div className="empty-inline">
              Packaging 미등록 — 물류에 필요합니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={skuDialogOpen} onOpenChange={setSkuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 SKU 발행</DialogTitle>
            {errors.map((error) => (
              <p role="alert" key={error}>
                {error}
              </p>
            ))}
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              새 SKU
              <Input
                value={newSku}
                onChange={(event) => setNewSku(event.target.value)}
              />
            </label>
            <label>
              적용 시작일
              <Input
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </label>
            <label>
              변경 사유
              <Input
                placeholder="예: 코드 체계 개편"
                value={skuNote}
                onChange={(event) => setSkuNote(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              현재 버전의 종료일은 이 시작일로 자동 마감됩니다. 기존 행은
              수정하지 않습니다.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkuDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!newSku.trim() || newSku.trim() === product.sku}
              onClick={() => {
                const nextErrors = onIssueSku({
                  sku: newSku.trim(),
                  validFrom,
                  note: skuNote.trim(),
                });
                setErrors(nextErrors);
                if (!nextErrors.length) setSkuDialogOpen(false);
              }}
            >
              발행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={packagingDialogOpen} onOpenChange={setPackagingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 Packaging 발행</DialogTitle>
            {errors.map((error) => (
              <p role="alert" key={error}>
                {error}
              </p>
            ))}
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              길이 (cm)
              <Input
                type="number"
                value={length}
                onChange={(event) => setLength(event.target.value)}
              />
            </label>
            <label>
              폭 (cm)
              <Input
                type="number"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>
            <label>
              높이 (cm)
              <Input
                type="number"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
            <label>
              무게 (kg)
              <Input
                type="number"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </label>
            <label className="full-width">
              적용 시작일
              <Input
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              현재 버전의 종료일은 이 시작일로 자동 마감됩니다.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackagingDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const nextErrors = onIssuePackaging({
                  length,
                  width,
                  height,
                  weight,
                  validFrom,
                });
                setErrors(nextErrors);
                if (!nextErrors.length) setPackagingDialogOpen(false);
              }}
            >
              발행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
