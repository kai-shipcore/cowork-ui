import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  PRODUCT_TYPES,
  type VehicleProductShape,
} from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { SHAPE_STATUSES, shapeErrors } from './shape-model';

interface Props {
  shape?: VehicleProductShape;
  productTypeId?: string;
  shapes: readonly VehicleProductShape[];
  usageCount: number;
  issuanceApproved?: boolean;
  onClose: () => void;
  onSave: (shape: VehicleProductShape) => void;
}

export function ShapeEditor({
  shape,
  productTypeId,
  shapes,
  usageCount,
  issuanceApproved,
  onClose,
  onSave,
}: Props) {
  const [product, setProduct] = useState(
    shape?.productTypeId ?? productTypeId ?? 'PT-SC',
  );
  const [name, setName] = useState(shape?.name ?? '');
  const [status, setStatus] = useState(
    issuanceApproved ? 'ACTIVE' : (shape?.status ?? 'IN_DEVELOPMENT'),
  );
  const [includeDimensions, setIncludeDimensions] = useState(
    Boolean(shape?.dimensions && shape.dimensions.length > 0),
  );
  const [length, setLength] = useState(
    shape?.dimensions?.length ? String(shape.dimensions.length) : '',
  );
  const [height, setHeight] = useState(
    shape?.dimensions?.height ? String(shape.dimensions.height) : '',
  );
  const [front, setFront] = useState(
    shape?.dimensions?.frontWidth ? String(shape.dimensions.frontWidth) : '',
  );
  const [back, setBack] = useState(
    shape?.dimensions?.backWidth ? String(shape.dimensions.backWidth) : '',
  );
  const [unit, setUnit] = useState<'CM' | 'IN'>(
    shape?.dimensions?.unit ?? 'CM',
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmedExisting, setConfirmedExisting] = useState(false);
  const needsConfirmation =
    !issuanceApproved &&
    (!shape || shape.status !== 'ACTIVE') &&
    status === 'ACTIVE';
  const [submitted, setSubmitted] = useState(false);
  const input = {
    productTypeId: product,
    name: name.trim(),
    status,
    dimensions:
      product === 'PT-CC' && (includeDimensions || status === 'ACTIVE')
        ? {
            length: Number(length),
            height: Number(height),
            unit,
            ...(front ? { frontWidth: Number(front) } : {}),
            ...(back ? { backWidth: Number(back) } : {}),
          }
        : undefined,
  };
  const errors = shapeErrors(input, shapes, shape?.id);
  const save = () => {
    setSubmitted(true);
    if (
      errors.length ||
      (usageCount > 0 && !acknowledged) ||
      (needsConfirmation && !confirmedExisting)
    )
      return;
    const now = new Date().toISOString();
    onSave({
      ...shape,
      ...input,
      id: shape?.id ?? `SHP-${crypto.randomUUID()}`,
      source: shape?.source ?? 'NEW',
      createdBy: shape?.createdBy ?? CURRENT_USER_ID,
      createdAt: shape?.createdAt ?? now,
      updatedAt: now,
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <DialogTitle>
            {shape
              ? 'Edit Shape'
              : issuanceApproved
                ? 'Issue final Shape / Link project'
                : 'Create development Shape'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="project-dialog-stack">
          <p className="muted-text">
            A Shape links to one source development project. Manage fitment
            across sales vehicles in F#.
          </p>
          <div className="dialog-form-grid">
            <label>
              Product type
              <Select
                value={product}
                disabled={Boolean(shape || productTypeId)}
                onValueChange={setProduct}
              >
                <SelectTrigger aria-label="Shape product type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem value={type.id} key={type.id}>
                      {type.product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Management status
              <Select
                value={status}
                disabled={issuanceApproved}
                onValueChange={(value) =>
                  setStatus(value as VehicleProductShape['status'])
                }
              >
                <SelectTrigger aria-label="Shape management status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SHAPE_STATUSES).map(([value, label]) => (
                    <SelectItem
                      value={value}
                      key={value}
                      disabled={
                        value === 'ACTIVE' &&
                        shape?.status !== 'ACTIVE' &&
                        !issuanceApproved
                      }
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="full-width">
              Shape name (reference number)
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter the Shape number confirmed by the team"
                maxLength={160}
              />
            </label>
          </div>
          <p className="muted-text">
            Seat Cover examples: F-xxx (front), B-xxx (2nd row), E-xxx (3rd
            row). Numbers are not auto-issued. Disabling new usage preserves
            existing links.
          </p>
          {needsConfirmation && (
            <label className="shape-check">
              <Checkbox
                checked={confirmedExisting}
                onCheckedChange={(value) =>
                  setConfirmedExisting(value === true)
                }
              />
              I confirm this Shape was already finalized after PM / Director
              review. For new development, review and issue it from the project.
            </label>
          )}
          {product === 'PT-CC' && (
            <label className="shape-check">
              <Checkbox
                checked={includeDimensions || status === 'ACTIVE'}
                disabled={status === 'ACTIVE'}
                onCheckedChange={(value) =>
                  setIncludeDimensions(value === true)
                }
              />
              Dimensions (required for confirmed Car Covers · Enter front and
              rear widths together)
            </label>
          )}
          {product === 'PT-CC' &&
            (includeDimensions || status === 'ACTIVE') && (
              <div className="dialog-form-grid">
                <label>
                  Length *
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={length}
                    onChange={(event) => setLength(event.target.value)}
                  />
                </label>
                <label>
                  Height *
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                  />
                </label>
                <label>
                  Front width
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={front}
                    onChange={(event) => setFront(event.target.value)}
                  />
                </label>
                <label>
                  Rear width
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={back}
                    onChange={(event) => setBack(event.target.value)}
                  />
                </label>
                <label>
                  Unit
                  <Select
                    value={unit}
                    onValueChange={(value) => setUnit(value as 'CM' | 'IN')}
                  >
                    <SelectTrigger aria-label="Dimension unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CM">cm</SelectItem>
                      <SelectItem value="IN">inch</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
          {usageCount > 0 && (
            <div className="shape-impact">
              <strong>{usageCount} linked projects will be updated.</strong>
              <p>
                If the shape itself differs, create a new Shape and link the
                relevant projects instead of overwriting the existing one.
              </p>
              <label className="shape-check">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                I confirm this change applies to all linked projects.
              </label>
            </div>
          )}
          {submitted && errors.length > 0 && (
            <div role="alert" className="shape-errors">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelled
          </Button>
          <Button
            variant="primary"
            disabled={
              (usageCount > 0 && !acknowledged) ||
              (needsConfirmation && !confirmedExisting)
            }
            onClick={save}
          >
            {shape
              ? 'Save changes'
              : issuanceApproved
                ? 'Issue / Link Shape'
                : 'Create development Shape'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
