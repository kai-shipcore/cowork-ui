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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
import { Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/shared/components/page-header';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type { ProductReferenceItem } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  ReferenceItemDialog,
  type GenericReferenceKind,
  type ReferenceItemDraft,
  type ReferenceKind,
} from '../components/reference-item-dialog';
import { ReferenceItemTable } from '../components/reference-item-table';
import { SeatCoverCodePanel } from '../components/seat-cover-code-panel';
import { SeatCoverPartPanel } from '../components/seat-cover-part-panel';

const KIND_LABELS: Record<ReferenceKind, string> = {
  colors: '색상',
  materials: '재질',
  parts: 'Seat Cover Part',
  codes: 'Seat Cover Code',
};

const ID_PREFIXES: Record<GenericReferenceKind, string> = {
  colors: 'CLR',
  materials: 'MAT',
};

/**
 * Reference dictionaries the SKU and BOM are built from.
 *
 * Colours and materials share one code/name form; seat cover parts and codes
 * have their own panels because their rows carry different columns. Size is
 * absent on purpose: it is `vehicle_product_shape.name`, not a table.
 */
export function ReferenceDataPage() {
  const {
    productColors,
    productMaterials,
    setProductColors,
    setProductMaterials,
    masterProducts,
    seatCoverParts,
    seatCoverCodes,
  } = useWorkbenchStore();
  const [kind, setKind] = useState<ReferenceKind>('colors');
  const [query, setQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductReferenceItem>();
  const [pendingDelete, setPendingDelete] = useState<ProductReferenceItem>();

  const isMaterials = kind === 'materials';
  const genericKind: GenericReferenceKind = isMaterials
    ? 'materials'
    : 'colors';
  const items = isMaterials ? productMaterials : productColors;
  const setItems = isMaterials ? setProductMaterials : setProductColors;
  const entityLabel = KIND_LABELS[kind];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter(
    (item) =>
      (!normalizedQuery ||
        `${item.code} ${item.name}`.toLowerCase().includes(normalizedQuery)) &&
      (productTypeFilter === 'ALL' || item.productTypeId === productTypeFilter),
  );
  const hasActiveFilter =
    normalizedQuery.length > 0 || productTypeFilter !== 'ALL';

  function openCreate(): void {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(item: ProductReferenceItem): void {
    setEditing(item);
    setDialogOpen(true);
  }

  function saveItem(draft: ReferenceItemDraft): void {
    const now = new Date().toISOString();
    const row: ProductReferenceItem = {
      id:
        editing?.id ??
        `${ID_PREFIXES[genericKind]}-${draft.productTypeId.replace('PT-', '')}-${draft.code}`,
      productTypeId: draft.productTypeId,
      code: draft.code,
      name: draft.name,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    setItems((current) =>
      editing
        ? current.map((item) => (item.id === editing.id ? row : item))
        : [...current, row],
    );
    setDialogOpen(false);
    setEditing(undefined);
  }

  /**
   * SKUs already built from this code. Deleting it would leave those SKUs
   * unexplainable, so the delete is blocked rather than warned about.
   */
  function usedBy(item: ProductReferenceItem): readonly string[] {
    return masterProducts
      .filter((product) =>
        isMaterials
          ? product.productMaterialId === item.id
          : product.productColorId === item.id,
      )
      .map((product) => product.sku);
  }

  const blockingSkus = pendingDelete ? usedBy(pendingDelete) : [];

  function confirmDelete(): void {
    if (!pendingDelete || blockingSkus.length > 0) return;
    setItems((current) =>
      current.filter((item) => item.id !== pendingDelete.id),
    );
    setPendingDelete(undefined);
  }

  const isGeneric = kind === 'colors' || isMaterials;

  return (
    <section>
      <PageHeader
        description="SKU와 BOM을 구성하는 사전 — 색상·재질 Code는 SKU 문자열에 그대로 들어갑니다. Size는 테이블이 아니라 vehicle_product_shape.name 입니다"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'product_color' },
                { name: 'product_material' },
                { name: 'seat_cover_part' },
                { name: 'seat_cover_code' },
                { name: 'seat_cover_code_x_option_value' },
              ]
            : undefined
        }
        actions={
          isGeneric ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus /> {entityLabel} 등록
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={kind}
        onValueChange={(value) => setKind(value as ReferenceKind)}
      >
        <TabsList variant="line">
          <TabsTrigger value="colors">
            색상 <span className="tab-count">{productColors.length}</span>
          </TabsTrigger>
          <TabsTrigger value="materials">
            재질 <span className="tab-count">{productMaterials.length}</span>
          </TabsTrigger>
          <TabsTrigger value="parts">
            Seat Cover Part{' '}
            <span className="tab-count">{seatCoverParts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="codes">
            Seat Cover Code{' '}
            <span className="tab-count">{seatCoverCodes.length}</span>
          </TabsTrigger>
        </TabsList>

        <div className="workbench-filters reference-data-filters">
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input
              aria-label="Code 또는 이름 검색"
              placeholder="Code / 이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {isGeneric && (
            <>
              <Select
                value={productTypeFilter}
                onValueChange={setProductTypeFilter}
              >
                <SelectTrigger
                  aria-label="Product Type 필터"
                  className="filter-select wide"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Product Type: All</SelectItem>
                  {PRODUCT_TYPES.map((productType) => (
                    <SelectItem value={productType.id} key={productType.id}>
                      {productType.product}
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
                    setProductTypeFilter('ALL');
                  }}
                >
                  <X /> 필터 초기화
                </Button>
              )}
              <span className="filter-count">
                {visibleItems.length} / {items.length} {entityLabel}
              </span>
            </>
          )}
        </div>

        <TabsContent value={kind}>
          {isGeneric ? (
            <ReferenceItemTable
              items={visibleItems}
              entityLabel={entityLabel}
              filterKey={`${kind}|${query}|${productTypeFilter}`}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ) : kind === 'parts' ? (
            <SeatCoverPartPanel query={query} />
          ) : (
            <SeatCoverCodePanel query={query} />
          )}
        </TabsContent>
      </Tabs>

      {dialogOpen && isGeneric && (
        <ReferenceItemDialog
          key={editing?.id ?? 'new'}
          kind={genericKind}
          item={editing}
          entityLabel={entityLabel}
          siblings={items}
          onSave={saveItem}
          onClose={() => {
            setDialogOpen(false);
            setEditing(undefined);
          }}
        />
      )}

      <Dialog
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entityLabel} 삭제</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {pendingDelete && (
              <div className="detail-card">
                <span className="detail-card-label">
                  {pendingDelete.code} · {entityLabel}
                </span>
                <strong>{pendingDelete.name}</strong>
              </div>
            )}
            {blockingSkus.length ? (
              <div className="dialog-error">
                <strong>
                  이 Code를 쓰는 Product가 {blockingSkus.length}건 있어 삭제할
                  수 없습니다.
                </strong>
                <div className="version-list blocking-sku-list">
                  {blockingSkus.map((sku) => (
                    <span className="generated-sku compact" key={sku}>
                      {sku}
                    </span>
                  ))}
                </div>
                신규 등록에서만 제외하려면 삭제하지 말고 이름을 정리하세요.
              </div>
            ) : (
              <div className="dialog-note">
                이 Code를 쓰는 Product가 없어 삭제할 수 있습니다. 이후 등록에서
                선택할 수 없게 됩니다.
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
              disabled={blockingSkus.length > 0}
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
