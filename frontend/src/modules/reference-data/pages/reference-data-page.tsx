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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
import { Layers, Palette, Plus, Search, Timer, X } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
import { StageDurationSettings } from '../components/stage-duration-settings';
import '../stage-duration.css';

const KIND_LABELS: Record<ReferenceKind, string> = {
  colors: 'Color',
  materials: 'Material',
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
  } = useWorkbenchStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab');
  const kind =
    tab === 'materials' ||
    tab === 'parts' ||
    tab === 'codes' ||
    tab === 'stages'
      ? tab
      : 'colors';
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
  const entityLabel =
    kind === 'stages' ? 'Development Stage Standards' : KIND_LABELS[kind];

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

  if (tab === 'parts' || tab === 'codes') {
    const destination = new URLSearchParams(params);
    destination.set('tab', tab);
    return <Navigate to={`/parts?${destination.toString()}`} replace />;
  }

  return (
    <section>
      <PageHeader
        description="Manage SKU/BOM reference data and standard development stage durations by product."
        tables={
          import.meta.env.DEV
            ? [
                { name: 'product_color' },
                { name: 'product_material' },
                { name: 'vehicle_project_stage_template' },
              ]
            : undefined
        }
      />

      <Card>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set('tab', value);
              return next;
            });
          }}
        >
          <TabsList variant="line" className="grid-tabs-list">
            <TabsTrigger value="colors">
              <Palette aria-hidden="true" />
              Color
              <span className="stage-tab-count">{productColors.length}</span>
            </TabsTrigger>
            <TabsTrigger value="materials">
              <Layers aria-hidden="true" />
              Material
              <span className="stage-tab-count">{productMaterials.length}</span>
            </TabsTrigger>
            <TabsTrigger value="stages">
              <Timer aria-hidden="true" />
              Development Stage Standards
            </TabsTrigger>
          </TabsList>

          <TabsContent value={kind} className="mt-0">
            {kind === 'stages' ? (
              <StageDurationSettings />
            ) : isGeneric ? (
              <>
                <ReferenceItemTable
                  toolbarContent={
                    <>
                      <div className="search-field">
                        <Search aria-hidden="true" />
                        <Input
                          aria-label="Search code or name"
                          placeholder="Search code / Name"
                          value={query}
                          onChange={(event) => {
                            setQuery(event.target.value);
                          }}
                        />
                      </div>
                      <Select
                        value={productTypeFilter}
                        onValueChange={setProductTypeFilter}
                      >
                        <SelectTrigger
                          aria-label="Product type filter"
                          className="filter-select wide"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Product Type: All</SelectItem>
                          {PRODUCT_TYPES.map((productType) => (
                            <SelectItem
                              value={productType.id}
                              key={productType.id}
                            >
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
                          <X /> Clear filters
                        </Button>
                      )}
                    </>
                  }
                  actions={
                    <Button variant="primary" onClick={openCreate}>
                      <Plus /> {entityLabel} Create
                    </Button>
                  }
                  items={visibleItems}
                  entityLabel={entityLabel}
                  filterKey={`${kind}|${query}|${productTypeFilter}`}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </Card>

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
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entityLabel} Delete</DialogTitle>
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
                  Products using this code: {blockingSkus.length} items;
                  deletion is not allowed.
                </strong>
                <div className="version-list blocking-sku-list">
                  {blockingSkus.map((sku) => (
                    <span className="generated-sku compact" key={sku}>
                      {sku}
                    </span>
                  ))}
                </div>
                To exclude it only from new registrations, update the name
                instead of deleting it.
              </div>
            ) : (
              <div className="dialog-note">
                No products use this code, so it can be deleted. It will no
                longer be selectable for new registrations.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDelete(undefined);
              }}
            >
              Cancelled
            </Button>
            <Button
              variant="destructive"
              disabled={blockingSkus.length > 0}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
