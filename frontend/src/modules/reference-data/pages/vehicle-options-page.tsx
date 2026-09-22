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
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
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

function productName(productTypeId: string): string {
  return (
    PRODUCT_TYPES.find((type) => type.id === productTypeId)?.product ??
    productTypeId
  );
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

  /** Seat cover codes that reference this value — deleting it breaks them. */
  const codeLinkCount = (value: VehicleOptionValue) =>
    seatCoverCodeOptionValues.filter(
      (link) => link.vehicleOptionValueId === value.id,
    ).length +
    [...configurations, ...uniqueVehicles].filter(
      (record) =>
        (record.optionValueIds?.includes(value.id) ?? false) ||
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

  const columns: FlatDataGridColumn<VehicleOptionKey>[] = [
    {
      id: 'product',
      header: 'Product Type',
      width: 180,
      sortValue: (optionKey) => productName(optionKey.productTypeId),
      cell: (optionKey) => <>{productName(optionKey.productTypeId)}</>,
    },
    {
      id: 'name',
      header: 'Name',
      width: 220,
      sortValue: (optionKey) => optionKey.name,
      cell: (optionKey) => (
        <>
          <div className="vehicle-name compact">{optionKey.name}</div>
          <div className="vehicle-meta">{valuesOf(optionKey).length} Value</div>
        </>
      ),
    },
    {
      id: 'options',
      header: 'Options',
      width: 420,
      cell: (optionKey) => {
        const values = valuesOf(optionKey);
        return (
          <div className="option-value-list">
            {values.length ? (
              values.map((value) => (
                <span className="option-value-chip" key={value.id}>
                  {value.value}
                  {codeLinkCount(value) > 0 && (
                    <em title="Referenced by Seat Cover codes">
                      {codeLinkCount(value)}
                    </em>
                  )}
                  <button
                    type="button"
                    aria-label={`${value.value} Delete`}
                    onClick={() => {
                      setPendingDelete(value);
                    }}
                  >
                    <Trash2 />
                  </button>
                </span>
              ))
            ) : (
              <span className="muted-text">
                No values. This option cannot be selected in configurations.
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 120,
      hideable: false,
      cell: (optionKey) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            mode="icon"
            aria-label={`${optionKey.name} Add value`}
            title="Add value"
            onClick={() => {
              setValueText('');
              setValueDialogFor(optionKey);
            }}
          >
            <Plus />
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: visibleKeys,
    columns: columns.map((column) => ({
      id: column.id,
      accessorFn: column.sortValue,
      sortUndefined: 'last',
    })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedKeys = gridTable.getRowModel().rows.map((row) => row.original);
  const activeSort = gridTable.getState().sorting.slice(0, 1).pop();
  const {
    pageItems: pagedKeys,
    pagination,
    setPagination,
  } = useWorkbenchPagination(sortedKeys, `${query}|${productType}`);

  return (
    <section>
      <PageHeader
        description="Vehicle option dictionary — Used by Vehicle Research configurations, Seat Cover code mappings, and unique_vehicle.option_hash"
        tables={
          import.meta.env.DEV
            ? [{ name: 'vehicle_option_key' }, { name: 'vehicle_option_value' }]
            : undefined
        }
      />

      <Card>
        <FlatDataGrid
          embedded
          label="Vehicle Options"
          columns={columns}
          rows={pagedKeys}
          getRowId={(optionKey) => optionKey.id}
          search={{
            label: 'Search option key or value',
            placeholder: 'Search key / Value',
            value: query,
            onChange: setQuery,
          }}
          filters={[
            {
              id: 'productType',
              label: 'Product type filter',
              value: productType,
              onChange: (value) => {
                setProductType(value as 'ALL' | ProductTypeId);
              },
              options: [
                { value: 'ALL', label: 'Product Type: All' },
                ...PRODUCT_TYPES.map((type) => ({
                  value: type.id,
                  label: type.product,
                })),
              ],
            },
          ]}
          toolbarContent={
            hasActiveFilter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  setProductType('ALL');
                }}
              >
                <X /> Clear filters
              </Button>
            )
          }
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setKeyName('');
                setKeyDialogOpen(true);
              }}
            >
              <Plus /> Add option key
            </Button>
          }
          emptyMessage="No matching option keys. Try changing the search term or product type filter."
          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: visibleKeys.length,
            pageSizeOptions: [5, 10, 25],
            onPageChange: (page) => {
              setPagination((current) => ({ ...current, pageIndex: page - 1 }));
            },
            onPageSizeChange: (pageSize) => {
              setPagination({ pageIndex: 0, pageSize });
            },
          }}
          sorting={{
            mode: 'manual',
            value: activeSort
              ? {
                  id: activeSort.id,
                  direction: activeSort.desc ? 'desc' : 'asc',
                }
              : null,
            onChange: (sort) => {
              gridTable.setSorting(
                sort ? [{ id: sort.id, desc: sort.direction === 'desc' }] : [],
              );
            },
          }}
        />
      </Card>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add option key</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Product Type
              <Select
                value={keyProductType}
                onValueChange={(value) => {
                  setKeyProductType(value as ProductTypeId);
                }}
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
              Key name
              <Input
                placeholder="Example: Front Seat"
                value={keyName}
                onChange={(event) => {
                  setKeyName(event.target.value);
                }}
              />
            </label>
            <div className="dialog-note">
              Keys must be unique within each product type. The Car Cover chart
              uses one general key (Submodel) because it has no headings.
            </div>
            {duplicateKey && keyName.trim() && (
              <div className="dialog-error">
                A key with this name already exists for this product type.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setKeyDialogOpen(false);
              }}
            >
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={!keyName.trim() || duplicateKey}
              onClick={addKey}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={valueDialogFor !== undefined}
        onOpenChange={(open) => {
          if (!open) setValueDialogFor(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{valueDialogFor?.name} · Add value</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              Value
              <Input
                placeholder="Example: Bucket"
                value={valueText}
                onChange={(event) => {
                  setValueText(event.target.value);
                }}
              />
            </label>
            <div className="dialog-note">
              Values must be unique within each key. New values become available
              immediately in Vehicle Research configuration options.
            </div>
            {duplicateValue && valueText.trim() && (
              <div className="dialog-error">
                This value already exists under this key.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setValueDialogFor(undefined);
              }}
            >
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={!valueText.trim() || duplicateValue}
              onClick={() => {
                if (valueDialogFor) addValue(valueDialogFor);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete option value</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {blockingLinks > 0 ? (
              <div className="dialog-error">
                {blockingLinks} Seat Cover Code references use this value, so it
                cannot be deleted. Unlink it in Reference Data → Seat Cover
                Codes first.
              </div>
            ) : (
              <div className="dialog-note">
                &quot;{pendingDelete?.value}&quot; will be deleted and
                unavailable for new configurations. Existing vehicle records
                using this value are preserved.
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
              disabled={blockingLinks > 0}
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
