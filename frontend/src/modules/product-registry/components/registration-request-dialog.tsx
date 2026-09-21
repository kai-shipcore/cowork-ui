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
import { StatusBadge } from '@/shared/components/status-badge';
import type {
  ColorType,
  ProductReferenceItem,
  ProductTypeId,
  UniqueVehicle,
  VehicleProductShape,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import {
  allowedColorTypes,
  buildSku,
  canonicalSku,
  colorFitsType,
} from '../sku-format';

export interface RegistrationCombination {
  sku: string;
  materialId: string;
  colorId: string;
  isDuplicate: boolean;
}

export interface RegistrationRequestDraft {
  combinations: readonly RegistrationCombination[];
  sourceShapeIds: readonly string[];
  /** Shapes the SKU was rendered from, in zone order. */
  shapeIds: readonly string[];
  note: string;
}

interface RegistrationRequestDialogProps {
  vehicle: UniqueVehicle;
  productTypeId: ProductTypeId;
  zoneProjects: readonly VehicleZoneProject[];
  /** Shapes assigned to this F#, resolved from `vehicle.shapes`. */
  shapes: readonly VehicleProductShape[];
  materials: readonly ProductReferenceItem[];
  colors: readonly ProductReferenceItem[];
  /** SKUs already registered, compared in canonical form. */
  registeredSkus: readonly string[];
  onSubmit: (draft: RegistrationRequestDraft) => void;
  onClose: () => void;
}

const COLOR_TYPE_LABELS: Record<ColorType, string> = {
  '1TO': '1TO · 1-Tone',
  STI: 'STI · Stitch Only',
  STR: 'STR · Stripe',
};

/**
 * Requests registration of the products for one F#.
 *
 * The size segments come from the F#'s assigned shapes, so nothing about size
 * is chosen here. What varies is material × colour, and those are a dependency
 * chain: a material fixes which colour types it can carry, and a colour type
 * fixes which colours exist.
 */
export function RegistrationRequestDialog({
  vehicle,
  productTypeId,
  shapes,
  materials,
  colors,
  registeredSkus,
  onSubmit,
  onClose,
}: RegistrationRequestDialogProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<
    readonly string[]
  >(() => shapes.map((shape) => shape.id));
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<
    readonly string[]
  >(() => (materials[0] ? [materials[0].id] : []));
  const [colorType, setColorType] = useState<ColorType>('1TO');
  const [selectedColorIds, setSelectedColorIds] = useState<readonly string[]>(
    [],
  );
  const [note, setNote] = useState('');

  const needsColor = productTypeId !== 'PT-FM';
  const shapeNames = shapes.map((shape) => shape.name);
  const selectedMaterials = materials.filter((material) =>
    selectedMaterialIds.includes(material.id),
  );
  // Offered only when every chosen material allows it.
  const availableColorTypes = (['1TO', 'STI', 'STR'] as const).filter(
    (candidate) =>
      selectedMaterials.length > 0 &&
      selectedMaterials.every((material) =>
        allowedColorTypes(material.code).includes(candidate),
      ),
  );
  const availableColors = colors.filter((color) =>
    colorFitsType(color.code, colorType),
  );
  /**
   * Floor Mat has no colour code and ships in one colour, so there is nothing
   * to choose: the single `product_color` row exists to satisfy the NOT NULL
   * FK and never reaches the SKU.
   */
  const implicitColor = needsColor ? undefined : colors[0];
  const canonicalRegistered = registeredSkus.map(canonicalSku);

  const combinations: readonly RegistrationCombination[] =
    selectedMaterials.flatMap((material) => {
      const pickedColors = needsColor
        ? availableColors.filter((color) => selectedColorIds.includes(color.id))
        : implicitColor
          ? [implicitColor]
          : [];
      return pickedColors.flatMap((color) => {
        const result = buildSku(productTypeId, {
          materialCode: material.code,
          shapeNames,
          colorCode: color.code,
          colorType,
          fNumber: vehicle.fNumber,
        });
        return result.status === 'ok'
          ? [
              {
                sku: result.sku,
                materialId: material.id,
                colorId: color.id,
                isDuplicate: canonicalRegistered.includes(
                  canonicalSku(result.sku),
                ),
              },
            ]
          : [];
      });
    });
  const newCombinations = combinations.filter(
    (combination) => !combination.isDuplicate,
  );
  const probe = buildSku(productTypeId, {
    materialCode: selectedMaterials[0]?.code ?? '',
    shapeNames,
    colorCode: needsColor
      ? (availableColors[0]?.code ?? '')
      : (implicitColor?.code ?? ''),
    colorType,
    fNumber: vehicle.fNumber,
  });
  const canSubmit = newCombinations.length > 0 && shapes.length > 0;

  function toggle(
    setter: (updater: (current: readonly string[]) => string[]) => void,
    id: string,
    checked: boolean,
  ): void {
    setter((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <DialogTitle>Product registration request</DialogTitle>
        </DialogHeader>
        <DialogBody className="detail-card-list">
          <div className="detail-card">
            <span className="detail-card-label">
              {vehicle.product} · {vehicle.fNumber}
            </span>
            <strong>{vehicle.vehicle}</strong>
            <dl className="detail-rows">
              <div>
                <dt>Project Group</dt>
                <dd>
                  <span className="project-reference">
                    {vehicle.projectGroupId}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Shape</dt>
                <dd>
                  {shapes.length ? (
                    <span className="shape-list">
                      {shapes.map((shape) => (
                        <span key={shape.id}>{shape.name}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted-text">
                      No Shape assigned to this F#
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <fieldset className="visit-zone-picker">
            <legend>STEP 1 · Select reference Shape (optional)</legend>
            {shapes.length ? (
              shapes.map((zoneProject) => (
                <label key={zoneProject.id}>
                  <Checkbox
                    checked={selectedProjectIds.includes(zoneProject.id)}
                    onCheckedChange={(checked) =>
                      toggle(
                        setSelectedProjectIds,
                        zoneProject.id,
                        Boolean(checked),
                      )
                    }
                  />
                  <span>
                    {zoneProject.name} · {zoneProject.id}
                  </span>
                </label>
              ))
            ) : (
              <p className="visit-no-task-note">
                Register PRIMARY Shape assignments per zone for this F# first.
              </p>
            )}
          </fieldset>

          <fieldset className="visit-zone-picker">
            <legend>
              STEP 2 · Material — Multiple selections create more combinations
            </legend>
            {materials.map((material) => (
              <label key={material.id}>
                <Checkbox
                  checked={selectedMaterialIds.includes(material.id)}
                  onCheckedChange={(checked) =>
                    toggle(
                      setSelectedMaterialIds,
                      material.id,
                      Boolean(checked),
                    )
                  }
                />
                <span>
                  {material.code} · {material.name}
                </span>
                <span className="muted-text">
                  {allowedColorTypes(material.code).join(' / ')}
                </span>
              </label>
            ))}
          </fieldset>

          {needsColor && (
            <>
              <div className="dialog-form-grid">
                <label>
                  STEP 3 · Color Type
                  <Select
                    value={colorType}
                    onValueChange={(value) => {
                      setColorType(value as ColorType);
                      setSelectedColorIds([]);
                    }}
                  >
                    <SelectTrigger aria-label="Color Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColorTypes.map((candidate) => (
                        <SelectItem value={candidate} key={candidate}>
                          {COLOR_TYPE_LABELS[candidate]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Notes (optional)
                  <Input
                    placeholder="Example: Register packaging specifications after approval"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="visit-zone-picker two-column">
                <legend>
                  STEP 4 · Color — Available colors for the selected materials
                  and color type only
                </legend>
                {availableColorTypes.length === 0 ? (
                  <p className="visit-no-task-note">
                    The selected materials share no allowed color type. Narrow
                    the material selection.
                  </p>
                ) : availableColors.length ? (
                  availableColors.map((color) => (
                    <label key={color.id}>
                      <Checkbox
                        checked={selectedColorIds.includes(color.id)}
                        onCheckedChange={(checked) =>
                          toggle(
                            setSelectedColorIds,
                            color.id,
                            Boolean(checked),
                          )
                        }
                      />
                      <span>
                        {color.code} · {color.name}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="visit-no-task-note">
                    No colors registered for this color type. Add them in
                    Reference Data.
                  </p>
                )}
              </fieldset>
            </>
          )}

          {!needsColor && (
            <div className="dialog-form-grid">
              <label className="full-width">
                Notes (optional)
                <Input
                  placeholder="Example: Register packaging specifications after approval"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {implicitColor ? (
                <div className="dialog-note">
                  Floor Mat is sold in one color with no color code. Because
                  product_color_id is NOT NULL, only a representative row (
                  {implicitColor.code}) is recorded, without affecting the SKU.
                  The SKU uses material + F#, so each F# has one product.
                </div>
              ) : (
                <div className="dialog-error">
                  No Floor Mat product_color row exists. Register one Floor Mat
                  color in Reference Data.
                </div>
              )}
            </div>
          )}

          <div className="detail-card">
            <span className="detail-card-label">
              Submission preview — Combinations {combinations.length} items;
              new: {newCombinations.length} items
            </span>
            {combinations.length ? (
              <div className="version-list">
                {combinations.map((combination) => (
                  <div className="version-row" key={combination.sku}>
                    <span className="generated-sku compact">
                      {combination.sku}
                    </span>
                    {combination.isDuplicate ? (
                      <StatusBadge label="Already registered" tone="danger" />
                    ) : (
                      <StatusBadge label="New" tone="success" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="dialog-error">
                {probe.status === 'unsupported'
                  ? probe.reason
                  : 'Select materials and colors to generate combinations.'}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelled
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                combinations: newCombinations,
                sourceShapeIds: selectedProjectIds,
                shapeIds: shapes.map((shape) => shape.id),
                note: note.trim(),
              })
            }
          >
            Submit registration requests ({newCombinations.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
