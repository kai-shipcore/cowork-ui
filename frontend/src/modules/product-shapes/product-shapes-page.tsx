import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
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
import { ClipboardCheck, Search, Shapes, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import {
  PRODUCT_TYPES,
  type VehicleProductShape,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ShapeCompositionEditor } from './shape-composition-editor';
import { ShapeEditor } from './shape-editor';
import {
  compositionIsCurrent,
  dimensionsLabel,
  SHAPE_STATUSES,
  shapeUsage,
} from './shape-model';
import { ShapeReviewWorkspace } from './shape-review-workspace';
import './shape-management.css';

const SHAPE_VIEWS = [
  {
    value: 'review',
    label: 'Awaiting review / issuance',
    icon: ClipboardCheck,
  },
  { value: 'issued', label: 'Developed / Confirmed Shapes', icon: Shapes },
] as const;

export function ProductShapesPage() {
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    projects,
    projectDetails,
  } = useWorkbenchStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view =
    params.get('view') ?? (params.get('shape') ? 'issued' : 'review');
  const [showAll, setShowAll] = useState(false);
  const [reviewQuery, setReviewQuery] = useState('');
  const [query, setQuery] = useState(params.get('shape') ?? '');
  const [product, setProduct] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [editing, setEditing] = useState<VehicleProductShape | 'NEW'>();
  const [expanded, setExpanded] = useState<string>();
  const [compositionId, setCompositionId] = useState<string | undefined>(
    params.get('shape') ?? undefined,
  );
  const filtered = shapes.filter(
    (shape) =>
      (product === 'ALL' || shape.productTypeId === product) &&
      (status === 'ALL' || shape.status === status) &&
      `${shape.name} ${shape.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const columns: FlatDataGridColumn<(typeof filtered)[number]>[] = [
    {
      id: 'shape',
      header: 'Shape',
      width: 210,
      sortValue: (shape) => shape.name,
      cell: (shape) => (
        <>
          <Link
            className="shape-name-link"
            to={`/product-shapes/${encodeURIComponent(shape.id)}`}
          >
            <strong>{shape.name}</strong>
          </Link>
          <div className="vehicle-meta">{shape.id}</div>
        </>
      ),
    },
    {
      id: 'product',
      header: 'Product type',
      width: 180,
      sortValue: (shape) =>
        PRODUCT_TYPES.find((item) => item.id === shape.productTypeId)
          ?.product ?? shape.productTypeId,
      cell: (shape) => (
        <>
          {PRODUCT_TYPES.find((item) => item.id === shape.productTypeId)
            ?.product ?? shape.productTypeId}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 180,
      sortValue: (shape) => SHAPE_STATUSES[shape.status],
      cell: (shape) => <>{SHAPE_STATUSES[shape.status]}</>,
    },
    {
      id: 'dimensions',
      header: 'Dimensions',
      width: 180,
      cell: (shape) => <>{dimensionsLabel(shape.dimensions)}</>,
    },
    {
      id: 'composition',
      header: 'Composition',
      width: 180,
      cell: (shape) => (
        <>
          {compositionIsCurrent(shape, projectDetails)
            ? 'Composition complete'
            : shape.composition?.status === 'COMPLETE'
              ? 'Source changed · Recheck required'
              : shape.composition
                ? 'Draft'
                : 'Awaiting composition'}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCompositionId(shape.id);
            }}
          >
            Part / Blueprint
          </Button>
        </>
      ),
    },
    {
      id: 'projects',
      header: 'Linked projects',
      width: 180,
      sortValue: (shape) => shapeUsage(shape.id, projects).length,
      cell: (shape) => {
        const usage = shapeUsage(shape.id, projects);
        return (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setExpanded(expanded === shape.id ? undefined : shape.id);
              }}
              aria-expanded={expanded === shape.id}
            >
              {usage.length} projects · View
            </Button>
            {expanded === shape.id && (
              <div className="shape-usage">
                {usage.length ? (
                  usage.map(({ project, zone }) => (
                    <Link
                      key={zone.id}
                      to={`/vehicle-projects?project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(zone.code)}&tab=overview`}
                    >
                      {project.vehicle} · {zone.code} · {zone.currentStage}
                    </Link>
                  ))
                ) : (
                  <span>No linked projects.</span>
                )}
              </div>
            )}
          </>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 180,
      hideable: false,
      cell: (shape) => (
        <div className="table-actions">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/product-shapes/${encodeURIComponent(shape.id)}`}>
              View
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(shape);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...filtered],
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
    pageItems: pagedShapes,
    pagination,
    setPagination,
  } = useWorkbenchPagination(
    sortedRows,
    `${view}|${query}|${product}|${status}`,
  );
  const compositionShape = shapes.find((shape) => shape.id === compositionId);

  return (
    <section className="shape-management">
      <PageHeader
        description="Shapes — Manage development Shapes through quality review and confirmation. Record sales vehicle fitment separately in F#."
        tables={[
          { name: 'vehicle_product_shape' },
          { name: 'vehicle_product_shape_dimension' },
          { name: 'vehicle_project' },
        ]}
      />
      <Card>
        <div className="grid-tabs-row">
          <div className="stage-tabs" role="group" aria-label="Shape view">
            {SHAPE_VIEWS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className="stage-tab"
                aria-pressed={view === value}
                onClick={() => {
                  setParams({ view: value });
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        {view !== 'review' && (
          <div className="grid-toolbar">
            <div className="grid-toolbar-filters">
              <>
                <div className="search-field">
                  <Search aria-hidden="true" />
                  <Input
                    aria-label="Search Shapes"
                    placeholder="Search Shape number or ID"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                    }}
                  />
                </div>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger
                    aria-label="Product type filter"
                    className="filter-select wide"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All product types</SelectItem>
                    {PRODUCT_TYPES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger
                    aria-label="Shape status filter"
                    className="filter-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {Object.entries(SHAPE_STATUSES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(query || product !== 'ALL' || status !== 'ALL') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setQuery('');
                      setProduct('ALL');
                      setStatus('ALL');
                    }}
                  >
                    <X /> Clear filters
                  </Button>
                )}
              </>
            </div>
            <div className="grid-toolbar-actions">
              <Button
                variant="outline"
                onClick={() => {
                  // React Router handles route errors; the click does not await navigation.
                  void navigate('/vehicle-projects');
                }}
              >
                Development projects
              </Button>
            </div>
          </div>
        )}
        {view === 'review' ? (
          <ShapeReviewWorkspace
            showAll={showAll}
            query={reviewQuery}
            onShowAllChange={setShowAll}
            onQueryChange={setReviewQuery}
          />
        ) : (
          <>
            <div className="shape-info">
              <strong>Developed / Confirmed Shapes · Composition</strong>
              <p>
                Development Shape → Fitting and quality review → Shape
                confirmation → Handoff · Parts composition and blueprint
              </p>
              <p>
                Multiple vehicle projects may reference the same Shape. Parts,
                revisions, and fitting results are managed in each project.
              </p>
            </div>
            <FlatDataGrid
              embedded
              label="Shapes"
              columns={columns}
              rows={pagedShapes}
              getRowId={(shape) => shape.id}
              emptyMessage="No Shapes match your search."

              pagination={{
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
                totalCount: filtered.length,
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
                    sort
                      ? [{ id: sort.id, desc: sort.direction === 'desc' }]
                      : [],
                  );
                },
              }}
            />
          </>
        )}
      </Card>
      {compositionShape && (
        <ShapeCompositionEditor
          key={compositionId}
          shape={compositionShape}
          onClose={() => {
            setCompositionId(undefined);
          }}
        />
      )}
      {editing && (
        <ShapeEditor
          key={editing === 'NEW' ? 'NEW' : editing.id}
          shape={editing === 'NEW' ? undefined : editing}
          shapes={shapes}
          usageCount={
            editing === 'NEW' ? 0 : shapeUsage(editing.id, projects).length
          }
          onClose={() => {
            setEditing(undefined);
          }}
          onSave={(shape) => {
            setVehicleProductShapes((current) => [
              ...current.filter((item) => item.id !== shape.id),
              shape,
            ]);
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
