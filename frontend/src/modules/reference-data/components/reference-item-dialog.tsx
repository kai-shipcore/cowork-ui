import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
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
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type {
  ProductReferenceItem,
  ProductTypeId,
} from '@/shared/types/workbench';

/**
 * Tabs the Reference Data screen hosts. Only colours and materials share the
 * generic code/name form; parts and codes have their own panels. Size is not a
 * table at all: it is `vehicle_product_shape.name`.
 */
export type ReferenceKind = 'colors' | 'materials' | 'parts' | 'codes';

/** Kinds handled by the generic table + dialog below. */
export type GenericReferenceKind = Extract<
  ReferenceKind,
  'colors' | 'materials'
>;

export interface ReferenceItemDraft {
  productTypeId: ProductTypeId;
  code: string;
  name: string;
}

interface ReferenceItemDialogProps {
  kind: GenericReferenceKind;
  /** Item being edited; omit to create a new one. */
  item?: ProductReferenceItem;
  entityLabel: string;
  /** Existing items, to reject a code already used for the same product type. */
  siblings: readonly ProductReferenceItem[];
  onSave: (draft: ReferenceItemDraft) => void;
  onClose: () => void;
}

/** Create/edit form for one colour, material or size row. */
export function ReferenceItemDialog({
  kind,
  item,
  entityLabel,
  siblings,
  onSave,
  onClose,
}: ReferenceItemDialogProps) {
  const [productTypeId, setProductTypeId] = useState<ProductTypeId>(
    item?.productTypeId ?? 'PT-SC',
  );
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');

  const normalizedCode = code.trim().toUpperCase();
  const isDuplicate = siblings.some(
    (sibling) =>
      sibling.id !== item?.id &&
      sibling.productTypeId === productTypeId &&
      (sibling.code === normalizedCode ||
        sibling.name.trim().toLowerCase() === name.trim().toLowerCase()),
  );
  const canSave = normalizedCode.length > 0 && name.trim().length > 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {entityLabel} {item ? 'Edit' : 'Create'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <label>
            Product Type
            <Select
              value={productTypeId}
              disabled={Boolean(item)}
              onValueChange={(value) =>
                setProductTypeId(value as ProductTypeId)
              }
            >
              <SelectTrigger aria-label="Product Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((productType) => (
                  <SelectItem value={productType.id} key={productType.id}>
                    {productType.product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Code
            <Input
              placeholder={kind === 'colors' ? 'Example: BK' : 'Example: 10'}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="full-width">
            {entityLabel} Name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <div className="dialog-note">
            Codes are used directly in SKUs, saved in uppercase, and must be
            unique within each product type.
            {normalizedCode && ` Code to save: ${normalizedCode}`}
          </div>
          {isDuplicate && (
            <div className="dialog-error">
              This code or name already exists for the product type.
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelled
          </Button>
          <Button
            variant="primary"
            disabled={!canSave || isDuplicate}
            onClick={() =>
              onSave({
                productTypeId,
                code: normalizedCode,
                name: name.trim(),
              })
            }
          >
            {item ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
