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
              <dt>Material</dt>
              <dd>{material ? `${material.code} · ${material.name}` : '—'}</dd>
            </div>
            <div>
              <dt>Source registration</dt>
              <dd>
                {registration ? (
                  <>
                    <span className="visit-reference">{registration.id}</span>{' '}
                    Requests {userName(users, registration.requestedBy)} ·
                    Approved{' '}
                    {registration.approvedBy
                      ? userName(users, registration.approvedBy)
                      : 'Pending'}
                  </>
                ) : (
                  <span className="muted-text">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Source zone project</dt>
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
            SKU history{' '}
            {import.meta.env.DEV && <small>master_product_sku</small>}
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
            <Plus /> Issue new SKU
          </Button>
        </CardHeader>
        <CardContent className="version-list">
          {skuHistory.length ? (
            byNewestFirst(skuHistory).map((row) => (
              <div className="version-row" key={row.id}>
                <span className="generated-sku compact">{row.sku}</span>
                <span className="version-range">
                  {row.validFrom.slice(0, 10)} ~{' '}
                  {row.validTo ? row.validTo.slice(0, 10) : 'Current'}
                </span>
                {row.validTo === undefined && (
                  <StatusBadge label="Current" tone="success" />
                )}
                {row.note && <span className="muted-text">{row.note}</span>}
              </div>
            ))
          ) : (
            <div className="empty-inline">
              The first SKU version is recorded on approval.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            Packaging history{' '}
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
            <Plus /> Issue new packaging
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
                  {row.validTo ? row.validTo.slice(0, 10) : 'Current'}
                </span>
                {row.validTo === undefined && (
                  <StatusBadge label="Current" tone="success" />
                )}
              </div>
            ))
          ) : (
            <div className="empty-inline">
              Packaging not registered — required for logistics.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={skuDialogOpen} onOpenChange={setSkuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue new SKU</DialogTitle>
            {errors.map((error) => (
              <p role="alert" key={error}>
                {error}
              </p>
            ))}
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              New SKU
              <Input
                value={newSku}
                onChange={(event) => setNewSku(event.target.value)}
              />
            </label>
            <label>
              Effective start date
              <Input
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </label>
            <label>
              Reason for change
              <Input
                placeholder="Example: Code system update"
                value={skuNote}
                onChange={(event) => setSkuNote(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              The current version ends on this start date automatically.
              Existing rows are not edited.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkuDialogOpen(false)}>
              Cancelled
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
              Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={packagingDialogOpen} onOpenChange={setPackagingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue new packaging</DialogTitle>
            {errors.map((error) => (
              <p role="alert" key={error}>
                {error}
              </p>
            ))}
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Length (cm)
              <Input
                type="number"
                value={length}
                onChange={(event) => setLength(event.target.value)}
              />
            </label>
            <label>
              Width (cm)
              <Input
                type="number"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>
            <label>
              Height (cm)
              <Input
                type="number"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
            <label>
              Weight (kg)
              <Input
                type="number"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </label>
            <label className="full-width">
              Effective start date
              <Input
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              The current version ends on this start date automatically.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackagingDialogOpen(false)}
            >
              Cancelled
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
              Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
