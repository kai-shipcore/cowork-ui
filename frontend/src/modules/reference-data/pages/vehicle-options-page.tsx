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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/shared/components/page-header';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type {
  ProductTypeId,
  VehicleOptionKey,
  VehicleOptionValue,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase();
}

/**
 * The vehicle option dictionary — `vehicle_option_key` and its
 * `vehicle_option_value` rows, scoped per product type.
 *
 * Vehicle Research builds a Configuration from these values, seat cover codes
 * map onto them, and `unique_vehicle.option_hash` is computed from them, so
 * this is the root dictionary the rest of the R&D flow reads.
 */
export function VehicleOptionsPage() {
  const {
    vehicleOptionKeys,
    setVehicleOptionKeys,
    vehicleOptionValues,
    setVehicleOptionValues,
    seatCoverCodeOptionValues,
    configurations,
    uniqueVehicles,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [productType, setProductType] = useState<'ALL' | ProductTypeId>('ALL');
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyProductType, setKeyProductType] = useState<ProductTypeId>('PT-SC');
  const [valueDialogFor, setValueDialogFor] = useState<VehicleOptionKey>();
  const [valueText, setValueText] = useState('');
  const [pendingDelete, setPendingDelete] = useState<VehicleOptionValue>();

  const normalizedQuery = query.trim().toLowerCase();
  const valuesOf = (optionKey: VehicleOptionKey) =>
    vehicleOptionValues.filter(
      (value) => value.vehicleOptionKeyId === optionKey.id,
    );
  const visibleKeys = vehicleOptionKeys.filter((optionKey) => {
    const haystack = `${optionKey.name} ${valuesOf(optionKey)
      .map((value) => value.value)
      .join(' ')}`.toLowerCase();
    return (
      (!normalizedQuery || haystack.includes(normalizedQuery)) &&
      (productType === 'ALL' || optionKey.productTypeId === productType)
    );
  });
  const hasActiveFilter = normalizedQuery.length > 0 || productType !== 'ALL';
  const {
    pageItems: pagedKeys,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleKeys, `${query}|${productType}`);

  /** Seat cover codes that reference this value — deleting it breaks them. */
  const codeLinkCount = (value: VehicleOptionValue) =>
    seatCoverCodeOptionValues.filter(
      (link) => link.vehicleOptionValueId === value.id,
    ).length +
    [...configurations, ...uniqueVehicles].filter(
      (record) =>
        record.optionValueIds?.includes(value.id) ||
        record.options.some(
          ([key, text]) =>
            key ===
              vehicleOptionKeys.find(
                (item) => item.id === value.vehicleOptionKeyId,
              )?.name && text === value.value,
        ),
    ).length;
  const blockingLinks = pendingDelete ? codeLinkCount(pendingDelete) : 0;

  function addKey(): void {
    const name = keyName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    setVehicleOptionKeys((current) => [
      ...current,
      {
        id: `VOK-${keyProductType.replace('PT-', '')}-${slug(name)}`,
        productTypeId: keyProductType,
        name,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setKeyName('');
    setKeyDialogOpen(false);
  }

  function addValue(optionKey: VehicleOptionKey): void {
    const value = valueText.trim();
    if (!value) return;
    const now = new Date().toISOString();
    setVehicleOptionValues((current) => [
      ...current,
      {
        id: `VOV-${optionKey.productTypeId.replace('PT-', '')}-${slug(optionKey.name)}-${slug(value)}`,
        vehicleOptionKeyId: optionKey.id,
        value,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setValueText('');
    setValueDialogFor(undefined);
  }

  function confirmDelete(): void {
    if (!pendingDelete || blockingLinks > 0) return;
    setVehicleOptionValues((current) =>
      current.filter((value) => value.id !== pendingDelete.id),
    );
    setPendingDelete(undefined);
  }

  const duplicateKey = vehicleOptionKeys.some(
    (optionKey) =>
      optionKey.productTypeId === keyProductType &&
      optionKey.name.toLowerCase() === keyName.trim().toLowerCase(),
  );
  const duplicateValue =
    valueDialogFor !== undefined &&
    valuesOf(valueDialogFor).some(
      (value) => value.value.toLowerCase() === valueText.trim().toLowerCase(),
    );

  return (
    <section>
      <PageHeader
        description="차량 옵션 사전 — Vehicle Research의 Configuration, Seat Cover Code 매핑, unique_vehicle.option_hash가 모두 이 값을 읽습니다"
        tables={
          import.meta.env.DEV
            ? [{ name: 'vehicle_option_key' }, { name: 'vehicle_option_value' }]
            : undefined
        }
      />

      <Card>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                aria-label="옵션 키 또는 값 검색"
                placeholder="키 / 값 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select
              value={productType}
              onValueChange={(value) =>
                setProductType(value as 'ALL' | ProductTypeId)
              }
            >
              <SelectTrigger
                aria-label="Product Type 필터"
                className="filter-select wide"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Product Type: All</SelectItem>
                {PRODUCT_TYPES.map((type) => (
                  <SelectItem value={type.id} key={type.id}>
                    {type.product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  setProductType('ALL');
                }}
              >
                <X /> 필터 초기화
              </Button>
            )}
          </div>
          <div className="grid-toolbar-actions">
            <Button
              variant="primary"
              onClick={() => {
                setKeyName('');
                setKeyDialogOpen(true);
              }}
            >
              <Plus /> 옵션 키 등록
            </Button>
          </div>
        </div>

        {visibleKeys.length ? (
          <>
            <div className="option-key-rows">
              {pagedKeys.map((optionKey) => {
                const values = valuesOf(optionKey);
                const productName =
                  PRODUCT_TYPES.find(
                    (type) => type.id === optionKey.productTypeId,
                  )?.product ?? optionKey.productTypeId;
                return (
                  <div className="option-key-row" key={optionKey.id}>
                    <div className="option-key-name">
                      <strong>{optionKey.name}</strong>
                      <small>
                        {productName} · {values.length} 값
                      </small>
                    </div>
                    <div className="option-value-list">
                      {values.length ? (
                        values.map((value) => (
                          <span className="option-value-chip" key={value.id}>
                            {value.value}
                            {codeLinkCount(value) > 0 && (
                              <em title="Seat Cover Code가 참조 중">
                                {codeLinkCount(value)}
                              </em>
                            )}
                            <button
                              type="button"
                              aria-label={`${value.value} 삭제`}
                              onClick={() => setPendingDelete(value)}
                            >
                              <Trash2 />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="muted-text">
                          값이 없습니다. Configuration에서 선택할 수 없습니다.
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setValueText('');
                        setValueDialogFor(optionKey);
                      }}
                    >
                      <Plus /> 값 추가
                    </Button>
                  </div>
                );
              })}
            </div>
            <WorkbenchPagination
              recordCount={visibleKeys.length}
              pagination={pagination}
              onPaginationChange={setPagination}
            />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <strong>조건에 맞는 옵션 키가 없습니다.</strong>
            <p>검색어나 Product Type 필터를 바꿔 보세요.</p>
          </div>
        )}
      </Card>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>옵션 키 등록</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Product Type
              <Select
                value={keyProductType}
                onValueChange={(value) =>
                  setKeyProductType(value as ProductTypeId)
                }
              >
                <SelectTrigger aria-label="Product Type">
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
              키 이름
              <Input
                placeholder="예: Front Seat"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              키는 Product Type 안에서 유일합니다. Car Cover 차트는 제목이 없어
              일반 키 하나(Submodel)만 씁니다.
            </div>
            {duplicateKey && keyName.trim() && (
              <div className="dialog-error">
                이 Product Type에 같은 이름의 키가 이미 있습니다.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!keyName.trim() || duplicateKey}
              onClick={addKey}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={valueDialogFor !== undefined}
        onOpenChange={(open) => !open && setValueDialogFor(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{valueDialogFor?.name} · 값 추가</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              값
              <Input
                placeholder="예: Bucket"
                value={valueText}
                onChange={(event) => setValueText(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              값은 키 안에서 유일합니다. 등록하면 Vehicle Research의
              Configuration 선택 목록에 바로 나타납니다.
            </div>
            {duplicateValue && valueText.trim() && (
              <div className="dialog-error">
                이 키에 같은 값이 이미 있습니다.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValueDialogFor(undefined)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!valueText.trim() || duplicateValue}
              onClick={() => valueDialogFor && addValue(valueDialogFor)}
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>옵션 값 삭제</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {blockingLinks > 0 ? (
              <div className="dialog-error">
                Seat Cover Code {blockingLinks}건이 이 값을 참조하고 있어 삭제할
                수 없습니다. 먼저 Reference Data의 Seat Cover Code 탭에서 연결을
                해제하세요.
              </div>
            ) : (
              <div className="dialog-note">
                &quot;{pendingDelete?.value}&quot;를 삭제합니다. 이후
                Configuration에서 선택할 수 없게 됩니다. 이미 이 값을 쓰는
                차량의 기존 기록은 그대로 남습니다.
              </div>
            )}
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
              disabled={blockingLinks > 0}
              onClick={confirmDelete}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
