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
  const [status, setStatus] = useState(shape?.status ?? 'ACTIVE');
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
    dimensions: includeDimensions
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
              ? 'Shape 수정'
              : issuanceApproved
                ? '최종 Shape 발급 · 프로젝트 연결'
                : '기존 확정 Shape 등록'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="project-dialog-stack">
          <p className="muted-text">
            Shape는 검토·승인으로 확정한 제품 규격입니다. 여러 프로젝트가 같은
            Shape를 참조할 수 있습니다. Part와 패턴 버전은 별도로 관리합니다.
          </p>
          <div className="dialog-form-grid">
            <label>
              제품 유형
              <Select
                value={product}
                disabled={Boolean(shape || productTypeId)}
                onValueChange={setProduct}
              >
                <SelectTrigger aria-label="Shape 제품 유형">
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
              관리 상태
              <Select
                value={status}
                disabled={issuanceApproved}
                onValueChange={(value) =>
                  setStatus(value as VehicleProductShape['status'])
                }
              >
                <SelectTrigger aria-label="Shape 관리 상태">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SHAPE_STATUSES).map(([value, label]) => (
                    <SelectItem value={value} key={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="full-width">
              Shape 이름 (관리 번호)
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="팀에서 확정한 Shape 번호 입력"
                maxLength={160}
              />
            </label>
          </div>
          <p className="muted-text">
            Seat Cover 번호 예: F-xxx (앞좌석), B-xxx (2열), E-xxx (3열). 번호는
            자동 발급하지 않습니다. ‘신규 사용 중지’로 바꿔도 기존 연결은
            유지됩니다.
          </p>
          {needsConfirmation && (
            <label className="shape-check">
              <Checkbox
                checked={confirmedExisting}
                onCheckedChange={(value) =>
                  setConfirmedExisting(value === true)
                }
              />
              PM / Director 검토를 마치고 이미 확정된 Shape임을 확인했습니다.
              신규 개발 Shape는 프로젝트에서 검토 후 발급하세요.
            </label>
          )}
          <label className="shape-check">
            <Checkbox
              checked={includeDimensions}
              onCheckedChange={(value) => setIncludeDimensions(value === true)}
            />
            치수 입력 (선택)
          </label>
          {includeDimensions && (
            <div className="dialog-form-grid">
              <label>
                길이 *
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                />
              </label>
              <label>
                높이 *
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
              </label>
              <label>
                앞폭
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={front}
                  onChange={(event) => setFront(event.target.value)}
                />
              </label>
              <label>
                뒤폭
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={back}
                  onChange={(event) => setBack(event.target.value)}
                />
              </label>
              <label>
                단위
                <Select
                  value={unit}
                  onValueChange={(value) => setUnit(value as 'CM' | 'IN')}
                >
                  <SelectTrigger aria-label="치수 단위">
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
              <strong>{usageCount}개 프로젝트에 함께 반영됩니다.</strong>
              <p>
                형상 자체가 다른 경우 기존 Shape를 덮어쓰지 말고 새 Shape를
                등록해 필요한 프로젝트에 연결하세요.
              </p>
              <label className="shape-check">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                연결된 프로젝트 전체에 적용되는 수정임을 확인했습니다.
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
            취소
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
              ? '변경 저장'
              : issuanceApproved
                ? 'Shape 발급 · 연결'
                : '기존 Shape 등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
