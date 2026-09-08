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
  vehicleProjectIds: readonly string[];
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
  zoneProjects,
  shapes,
  materials,
  colors,
  registeredSkus,
  onSubmit,
  onClose,
}: RegistrationRequestDialogProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<
    readonly string[]
  >(() => zoneProjects.map((zoneProject) => zoneProject.id));
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
  const canSubmit = newCombinations.length > 0 && selectedProjectIds.length > 0;

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
          <DialogTitle>Product 등록 요청</DialogTitle>
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
                <dt>Shape (사이즈 세그먼트)</dt>
                <dd>
                  {shapes.length ? (
                    <span className="shape-list">
                      {shapes.map((shape) => (
                        <span key={shape.id}>{shape.name}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted-text">
                      이 F#에 할당된 Shape이 없습니다
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <fieldset className="visit-zone-picker">
            <legend>
              STEP 1 · 근거 Zone Project — 등록 아이템에 기록됩니다
            </legend>
            {zoneProjects.length ? (
              zoneProjects.map((zoneProject) => (
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
                    {zoneProject.code} · {zoneProject.label} · {zoneProject.id}
                  </span>
                </label>
              ))
            ) : (
              <p className="visit-no-task-note">
                이 F#의 Project Group({vehicle.projectGroupId})에서 Zone
                Project를 찾을 수 없습니다. 등록 근거를 걸 수 없어 요청할 수
                없습니다.
              </p>
            )}
          </fieldset>

          <fieldset className="visit-zone-picker">
            <legend>STEP 2 · 재질 — 여러 개 선택하면 조합이 늘어납니다</legend>
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
                  메모 (선택)
                  <Input
                    placeholder="예: 포장 사양은 승인 후 등록"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="visit-zone-picker two-column">
                <legend>
                  STEP 4 · Color — 선택한 재질과 Color Type에서 가능한 색상만
                </legend>
                {availableColorTypes.length === 0 ? (
                  <p className="visit-no-task-note">
                    선택한 재질들이 공통으로 허용하는 Color Type이 없습니다.
                    재질 선택을 좁혀 주세요.
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
                    이 Color Type에 등록된 색상이 없습니다. Reference Data에서
                    추가해 주세요.
                  </p>
                )}
              </fieldset>
            </>
          )}

          {!needsColor && (
            <div className="dialog-form-grid">
              <label className="full-width">
                메모 (선택)
                <Input
                  placeholder="예: 포장 사양은 승인 후 등록"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {implicitColor ? (
                <div className="dialog-note">
                  Floor Mat은 색상 코드가 없고 단일 색상으로만 판매되므로 선택할
                  것이 없습니다. product_color_id 가 NOT NULL이라 대표 행(
                  {implicitColor.code})만 기록되고 SKU에는 들어가지 않습니다.
                  SKU가 재질 + F#로 결정되므로 F# 하나당 Product는 한 건입니다.
                </div>
              ) : (
                <div className="dialog-error">
                  Floor Mat용 product_color 행이 없습니다. Reference Data에서
                  Floor Mat 색상을 한 건 등록해 주세요.
                </div>
              )}
            </div>
          )}

          <div className="detail-card">
            <span className="detail-card-label">
              제출 미리보기 — 조합 {combinations.length}건 중 신규{' '}
              {newCombinations.length}건
            </span>
            {combinations.length ? (
              <div className="version-list">
                {combinations.map((combination) => (
                  <div className="version-row" key={combination.sku}>
                    <span className="generated-sku compact">
                      {combination.sku}
                    </span>
                    {combination.isDuplicate ? (
                      <StatusBadge label="이미 등록됨" tone="danger" />
                    ) : (
                      <StatusBadge label="신규" tone="success" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="dialog-error">
                {probe.status === 'unsupported'
                  ? probe.reason
                  : '조합을 만들려면 재질과 색상을 선택하세요.'}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                combinations: newCombinations,
                vehicleProjectIds: selectedProjectIds,
                shapeIds: shapes.map((shape) => shape.id),
                note: note.trim(),
              })
            }
          >
            등록 요청 제출 ({newCombinations.length}건)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
