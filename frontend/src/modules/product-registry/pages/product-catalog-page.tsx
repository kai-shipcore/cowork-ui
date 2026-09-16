import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { PackageCheck, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  businessDateInstant,
  packagingVersionErrors,
  skuVersionErrors,
} from '@/shared/domain/catalog-validation';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
  const {
    pageItems: pagedProducts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visible, `${query}|${productType}|${status}`);

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
    const validFrom = businessDateInstant(version.validFrom)!;
    const row: MasterProductSku = {
      id: `MPS-${version.sku}-${masterProductSkus.length + 1}`,
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
    const validFrom = businessDateInstant(version.validFrom)!;
    const row: MasterProductPackaging = {
      id: `MPP-${product.id}-${masterProductPackagings.length + 1}`,
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

  if (selected) {
    const item = itemOf(selected);
    return (
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
          (registration) => registration.id === item?.registrationId,
        )}
        registrationItem={item}
        onBack={closeProduct}
        onIssueSku={(version) => issueSku(selected, version)}
        onIssuePackaging={(version) => issuePackaging(selected, version)}
      />
    );
  }

  return (
    <section>
      <PageHeader
        description="등록이 승인된 Product 목록 — SKU와 Packaging은 시점별 버전으로 관리됩니다"
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

      <div className="summary-grid" role="group" aria-label="상태별 필터">
        {STATUS_CARDS.map((card) => (
          <button
            type="button"
            className="summary-card-button"
            key={card.status}
            aria-pressed={status === card.status}
            onClick={() =>
              setStatus((current) =>
                current === card.status ? 'ALL' : card.status,
              )
            }
          >
            <Card
              className={`summary-card summary-${card.tone}${status === card.status ? ' active' : ''}`}
            >
              <PackageCheck />
              <div>
                <strong>
                  {
                    scoped.filter((product) => product.status === card.status)
                      .length
                  }
                </strong>
                <span>{card.label}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <div className="workbench-filters">
        <div className="search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label="SKU 또는 F# 검색"
            placeholder="SKU / F# 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={productType} onValueChange={setProductType}>
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
              setStatus('ALL');
            }}
          >
            <X /> 필터 초기화
          </Button>
        )}
        <span className="filter-count">
          {visible.length} / {masterProducts.length} products
        </span>
      </div>

      {visible.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>F#</TableHead>
                <TableHead>재질</TableHead>
                <TableHead>Shape</TableHead>
                <TableHead>Packaging</TableHead>
                <TableHead>출처 등록</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.map((product) => {
                const packaging = currentPackaging(product);
                return (
                  <TableRow
                    key={product.id}
                    className="row-link"
                    onClick={() => openProduct(product.id)}
                  >
                    <TableCell>
                      <span className="generated-sku compact">
                        {product.sku}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="f-number">{product.fNumber}</span>
                    </TableCell>
                    <TableCell>
                      {materialOf(product)?.code ?? '—'}
                      <div className="vehicle-meta">
                        {materialOf(product)?.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="shape-list">
                        {shapesOf(product).map((name) => (
                          <span key={name}>{name}</span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {packaging ? (
                        <span className="vehicle-meta">
                          {packaging.length}×{packaging.width}×
                          {packaging.height} {packaging.dimensionUnit} ·{' '}
                          {packaging.weight}
                          {packaging.weightUnit}
                        </span>
                      ) : (
                        <StatusBadge label="미등록" tone="warning" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="visit-reference">
                        {itemOf(product)?.registrationId ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={product.status}
                        tone={STATUS_TONES[product.status]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <WorkbenchPagination
            recordCount={visible.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            itemLabel="products"
          />
        </Card>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <strong>Product가 없습니다.</strong>
          <p>
            Unique Vehicles / F#에서 등록을 요청하고 Product Registrations에서
            승인하면 여기에 나타납니다.
          </p>
        </div>
      )}
    </section>
  );
}
