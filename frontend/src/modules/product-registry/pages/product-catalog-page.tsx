import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { PackageCheck, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  businessDateInstant,
  packagingVersionErrors,
  skuVersionErrors,
} from '@/shared/domain/catalog-validation';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type {
  MasterProduct,
  MasterProductPackaging,
  MasterProductSku,
  MasterProductStatus,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  ProductDetailView,
  type NewPackagingVersion,
  type NewSkuVersion,
} from '../components/product-detail-view';

/** Badge tone per master_product.status. */
const STATUS_TONES: Record<
  MasterProductStatus,
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  CLOSEOUT: 'warning',
  DISCONTINUED: 'danger',
};

const STATUS_CARDS: readonly {
  status: MasterProductStatus;
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}[] = [
  { status: 'DRAFT', label: 'Draft', tone: 'neutral' },
  { status: 'ACTIVE', label: 'Active', tone: 'success' },
  { status: 'CLOSEOUT', label: 'Closeout', tone: 'warning' },
  { status: 'DISCONTINUED', label: 'Discontinued', tone: 'danger' },
];

/** Registered product catalogue, with effective-dated detail per product. */
export function ProductCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    masterProducts,
    masterProductSkus,
    setMasterProducts,
    setMasterProductSkus,
    masterProductPackagings,
    setMasterProductPackagings,
    productMaterials,
    vehicleProductShapes,
    appUsers,
    registrations,
    registrationItems,
  } = useWorkbenchStore();
  const [query, setQuery] = useState('');
  const [productType, setProductType] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | MasterProductStatus>('ALL');

  const selectedId = searchParams.get('product') ?? undefined;
  const selected = masterProducts.find((product) => product.id === selectedId);

  const normalizedQuery = query.trim().toLowerCase();
  const scoped = masterProducts.filter(
    (product) =>
      (!normalizedQuery ||
        `${product.sku} ${product.fNumber}`
          .toLowerCase()
          .includes(normalizedQuery)) &&
      (productType === 'ALL' || product.productTypeId === productType),
  );
  const visible = scoped.filter(
    (product) => status === 'ALL' || product.status === status,
  );
  const hasActiveFilter =
    normalizedQuery.length > 0 || productType !== 'ALL' || status !== 'ALL';
  const columns: FlatDataGridColumn<(typeof visible)[number]>[] = [
    {
      id: 'sku',
      header: 'SKU',
      width: 210,
      sortValue: (product) => product.sku,
      cell: (product) => (
        <>
          <span className="generated-sku compact">{product.sku}</span>
        </>
      ),
    },
    {
      id: 'f-number',
      header: 'F#',
      width: 180,
      sortValue: (product) => product.fNumber,
      cell: (product) => (
        <>
          <span className="f-number">{product.fNumber}</span>
        </>
      ),
    },
    {
      id: 'material',
      header: 'Material',
      width: 180,
      sortValue: (product) => materialOf(product)?.code,
      cell: (product) => (
        <>
          {materialOf(product)?.code ?? '—'}
          <div className="vehicle-meta">{materialOf(product)?.name}</div>
        </>
      ),
    },
    {
      id: 'shapes',
      header: 'Shape',
      width: 180,
      sortValue: (product) => shapesOf(product).join(', '),
      cell: (product) => (
        <>
          <span className="shape-list">
            {shapesOf(product).map((name) => (
              <span key={name}>{name}</span>
            ))}
          </span>
        </>
      ),
    },
    {
      id: 'packaging',
      header: 'Packaging',
      width: 180,
      cell: (product) => {
        const packaging = currentPackaging(product);
        return (
          <>
            {packaging ? (
              <span className="vehicle-meta">
                {packaging.length}×{packaging.width}×{packaging.height}{' '}
                {packaging.dimensionUnit} · {packaging.weight}
                {packaging.weightUnit}
              </span>
            ) : (
              <StatusBadge label="Not registered" tone="warning" />
            )}
          </>
        );
      },
    },
    {
      id: 'registration',
      header: 'Source registration',
      width: 180,
      sortValue: (product) => itemOf(product)?.registrationId,
      cell: (product) => (
        <>
          <span className="visit-reference">
            {itemOf(product)?.registrationId ?? '—'}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 180,
      sortValue: (product) => product.status,
      cell: (product) => (
        <>
          <StatusBadge
            label={product.status}
            tone={STATUS_TONES[product.status]}
          />
        </>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...visible],
    columns: columns.map((column) => ({
      id: column.id,
      accessorFn: column.sortValue,
      sortUndefined: 'last',
    })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = gridTable.getRowModel().rows.map((row) => row.original);
  const activeSort = gridTable.getState().sorting.slice(0, 1).pop();
  const {
    pageItems: pagedProducts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(sortedRows, `${query}|${productType}|${status}`);

  const materialOf = (product: MasterProduct) =>
    productMaterials.find((item) => item.id === product.productMaterialId);
  const itemOf = (product: MasterProduct) =>
    registrationItems.find((item) => item.masterProductId === product.id);
  /** Shapes in zone order — exterior alone, or front / rear / third row. */
  const shapesOf = (product: MasterProduct) =>
    [
      product.exteriorShapeId,
      product.frontShapeId,
      product.rearShapeId,
      product.thirdRowShapeId,
    ]
      .filter((shapeId): shapeId is string => shapeId !== undefined)
      .flatMap((shapeId) => {
        const shape = vehicleProductShapes.find((item) => item.id === shapeId);
        return shape ? [shape.name] : [];
      });
  const currentPackaging = (product: MasterProduct) =>
    masterProductPackagings.find(
      (row) => row.masterProductId === product.id && row.validTo === undefined,
    );

  function openProduct(productId: string): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('product', productId);
      return next;
    });
  }

  function closeProduct(): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('product');
      return next;
    });
  }

  /** Issuing a version closes the open one at the same instant, never edits it. */
  function issueSku(
    product: MasterProduct,
    version: NewSkuVersion,
  ): readonly string[] {
    const errors = skuVersionErrors(
      version.sku,
      version.validFrom,
      [
        ...masterProductSkus,
        ...masterProducts.map((row) => ({
          id: row.id,
          masterProductId: row.id,
          sku: row.sku,
          validFrom: row.createdAt,
        })),
      ],
      masterProductSkus.find(
        (row) => row.masterProductId === product.id && !row.validTo,
      )?.validFrom,
    );
    if (errors.length) return errors;
    const validFrom = businessDateInstant(version.validFrom);
    if (!validFrom) return ['Enter a valid effective start date.'];
    const row: MasterProductSku = {
      id: `MPS-${version.sku}-${String(masterProductSkus.length + 1)}`,
      masterProductId: product.id,
      sku: version.sku,
      validFrom,
      ...(version.note ? { note: version.note } : {}),
    };
    setMasterProductSkus((current) => [
      ...current.map((existing) =>
        existing.masterProductId === product.id &&
        existing.validTo === undefined
          ? { ...existing, validTo: validFrom }
          : existing,
      ),
      row,
    ]);
    setMasterProducts((current) =>
      current.map((existing) =>
        existing.id === product.id
          ? {
              ...existing,
              sku: version.sku,
              updatedAt: new Date().toISOString(),
            }
          : existing,
      ),
    );
    return [];
  }

  function issuePackaging(
    product: MasterProduct,
    version: NewPackagingVersion,
  ): readonly string[] {
    const errors = packagingVersionErrors(
      {
        length: Number(version.length),
        width: Number(version.width),
        height: Number(version.height),
        weight: Number(version.weight),
      },
      version.validFrom,
      currentPackaging(product)?.validFrom,
    );
    if (errors.length) return errors;
    const validFrom = businessDateInstant(version.validFrom);
    if (!validFrom) return ['Enter a valid effective start date.'];
    const row: MasterProductPackaging = {
      id: `MPP-${product.id}-${String(masterProductPackagings.length + 1)}`,
      masterProductId: product.id,
      length: Number(version.length),
      width: Number(version.width),
      height: Number(version.height),
      // master_product_packaging CHECKs: IN | CM and LB | KG.
      dimensionUnit: 'CM',
      weight: Number(version.weight),
      weightUnit: 'KG',
      validFrom,
    };
    setMasterProductPackagings((current) => [
      ...current.map((existing) =>
        existing.masterProductId === product.id &&
        existing.validTo === undefined
          ? { ...existing, validTo: validFrom }
          : existing,
      ),
      row,
    ]);
    return [];
  }

  const selectedItem = selected ? itemOf(selected) : undefined;

  return (
    <section>
      <PageHeader
        description="Approved products — SKUs and packaging are managed as effective-dated versions"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'master_product' },
                { name: 'vehicle_product' },
                { name: 'master_product_sku' },
                { name: 'master_product_packaging' },
              ]
            : undefined
        }
      />

      <div className="summary-grid" role="group" aria-label="Filter by status">
        {STATUS_CARDS.map((card) => (
          <SummaryCard
            key={card.status}
            label={card.label}
            value={
              scoped.filter((product) => product.status === card.status).length
            }
            icon={<PackageCheck />}
            tone={card.tone}
            selected={status === card.status}
            onClick={() => {
              setStatus((current) =>
                current === card.status ? 'ALL' : card.status,
              );
            }}
          />
        ))}
      </div>

      <Card>
        <FlatDataGrid
          embedded
          label="Products"
          columns={columns}
          rows={pagedProducts}
          search={{
            label: 'Search SKU or F#',
            placeholder: 'Search SKU / F#',
            value: query,
            onChange: setQuery,
          }}
          filters={[
            {
              id: 'productType',
              label: 'Product type filter',
              value: productType,
              onChange: setProductType,
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
                  setStatus('ALL');
                }}
              >
                <X /> Clear filters
              </Button>
            )
          }
          emptyMessage="No products. Approve registrations in Product Registrations to list them here."

          getRowId={(product) => product.id}
          onRowClick={(product) => {
            openProduct(product.id);
          }}
          rowActionLabel={(product) => `${product.sku} Open details`}
          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: visible.length,
            pageSizeOptions: [5, 10, 25],
            onPageChange: (page) => {
              setPagination((current) => ({
                ...current,
                pageIndex: page - 1,
              }));
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

      <DetailSheet
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) closeProduct();
        }}
        title={selected?.sku ?? 'Product details'}
        description={
          selected
            ? `${selected.fNumber} · SKUs and packaging are managed as effective-dated versions.`
            : 'SKU and packaging version history for the selected product'
        }
        size="lg"
        className="w-[min(1120px,96vw)] sm:max-w-none"
      >
        {selected && (
          <ProductDetailView
            key={selected.id}
            product={selected}
            material={materialOf(selected)}
            users={appUsers}
            shapeNames={shapesOf(selected)}
            skuHistory={masterProductSkus.filter(
              (row) => row.masterProductId === selected.id,
            )}
            packagingHistory={masterProductPackagings.filter(
              (row) => row.masterProductId === selected.id,
            )}
            registration={registrations.find(
              (registration) =>
                registration.id === selectedItem?.registrationId,
            )}
            registrationItem={selectedItem}
            onIssueSku={(version) => issueSku(selected, version)}
            onIssuePackaging={(version) => issuePackaging(selected, version)}
          />
        )}
      </DetailSheet>
    </section>
  );
}
