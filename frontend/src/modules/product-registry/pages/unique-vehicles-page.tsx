import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { userName } from '@/shared/domain/app-user';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import { PRODUCT_TYPES } from '@/shared/types/workbench';
import type {
  Complaint,
  MasterProduct,
  UniqueVehicle,
  VehicleProductRegistration,
  VehicleProductRegistrationItem,
} from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  ComplaintDialog,
  type ComplaintDraft,
} from '../components/complaint-dialog';
import {
  RegistrationRequestDialog,
  type RegistrationRequestDraft,
} from '../components/registration-request-dialog';
import { ShapeAssignmentPanel } from '../components/shape-assignment-panel';

/** F-number registry for fitting-confirmed vehicle configurations. */
export function UniqueVehiclesPage() {
  const [query, setQuery] = useState('');
  const [requesting, setRequesting] = useState<UniqueVehicle>();
  const [complaining, setComplaining] = useState<UniqueVehicle>();
  const [message, setMessage] = useState('');
  const {
    uniqueVehicles,
    shapeAssignments,
    vehicleZones,
    masterProductSkus,
    updateWorkbench,
    complaints,
    setComplaints,
    appUsers,
    projects,
    productMaterials,
    productColors,
    vehicleProductShapes,
    masterProducts,
    registrations,
    registrationItems,
  } = useWorkbenchStore();
  const visibleVehicles = uniqueVehicles.filter((vehicle) =>
    `${vehicle.fNumber} ${vehicle.vehicle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const registeredSkus = [
    ...masterProducts.map((product) => product.sku),
    ...masterProductSkus.map((row) => row.sku),
  ];
  function primaryAssignments(vehicle: UniqueVehicle) {
    return shapeAssignments
      .filter(
        (row) =>
          row.uniqueVehicleId === (vehicle.id ?? vehicle.fNumber) &&
          row.type === 'PRIMARY' &&
          !row.validTo,
      )
      .sort(
        (a, b) =>
          ['EX', 'F', 'B', 'E'].indexOf(
            vehicleZones.find((zone) => zone.id === a.vehicleZoneId)?.code ??
              '',
          ) -
          ['EX', 'F', 'B', 'E'].indexOf(
            vehicleZones.find((zone) => zone.id === b.vehicleZoneId)?.code ??
              '',
          ),
      );
  }
  const columns: FlatDataGridColumn<(typeof visibleVehicles)[number]>[] = [
    {
      id: 'f-number',
      header: 'F Number',
      width: 210,
      sortValue: (vehicle) => vehicle.fNumber,
      cell: (vehicle) => (
        <>
          <span className="f-number">{vehicle.fNumber}</span>
        </>
      ),
    },
    {
      id: 'vehicle',
      header: 'Vehicle',
      width: 180,
      sortValue: (vehicle) => vehicle.vehicle,
      cell: (vehicle) => (
        <>
          <div className="vehicle-name">{vehicle.vehicle}</div>
          <div className="vehicle-meta">
            {vehicle.product} · Research {vehicle.vehicleResearchId}
          </div>
        </>
      ),
    },
    {
      id: 'configuration',
      header: 'Configuration',
      width: 180,
      cell: (vehicle) => (
        <>
          <ConfigChips options={vehicle.options} />
        </>
      ),
    },
    {
      id: 'project',
      header: 'Source (Group)',
      width: 180,
      sortValue: (vehicle) => vehicle.projectGroupId,
      cell: (vehicle) => (
        <>
          <span className="project-reference">{vehicle.projectGroupId}</span>
        </>
      ),
    },
    {
      id: 'shapes',
      header: 'Shapes',
      width: 180,
      sortValue: (vehicle) => vehicle.shapes.join(', '),
      cell: (vehicle) => (
        <>
          <div className="shape-list">
            {vehicle.shapes.map((shape) => (
              <span key={shape}>{shape}</span>
            ))}
          </div>
          <ShapeAssignmentPanel vehicle={vehicle} />
        </>
      ),
    },
    {
      id: 'registration',
      header: 'SKU Registration',
      width: 180,
      sortValue: (vehicle) => vehicle.skuStatus,
      cell: (vehicle) => (
        <>
          <StatusBadge
            label={vehicle.skuStatus}
            tone={
              vehicle.skuStatus === 'ACTIVE'
                ? 'success'
                : vehicle.skuStatus === 'REQUESTED'
                  ? 'warning'
                  : 'neutral'
            }
          />
          {vehicle.skuStatus === 'DRAFT' && (
            <div>
              <Button
                size="sm"
                variant="primary"
                className="complaint-button"
                onClick={() => {
                  setRequesting(vehicle);
                }}
              >
                Registration request
              </Button>
            </div>
          )}
          {registrationItems
            .filter((item) =>
              masterProducts.some(
                (product) =>
                  product.id === item.masterProductId &&
                  product.fNumber === vehicle.fNumber,
              ),
            )
            .map((item) => (
              <div className="vehicle-meta" key={item.id}>
                {item.registrationId}
              </div>
            ))}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 180,
      cell: (vehicle) => (
        <>
          <StatusBadge label="ACTIVE" tone="success" />
          <div>
            <Button
              size="sm"
              variant="outline"
              className="complaint-button"
              onClick={() => {
                setMessage('');
                setComplaining(vehicle);
              }}
            >
              Complaint
            </Button>
          </div>
        </>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...visibleVehicles],
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
    pageItems: pagedVehicles,
    pagination,
    setPagination,
  } = useWorkbenchPagination(sortedRows, query);

  function productTypeIdFor(vehicle: UniqueVehicle) {
    return (
      PRODUCT_TYPES.find(
        (productType) => productType.product === vehicle.product,
      )?.id ?? 'PT-SC'
    );
  }

  function zoneProjectsFor(vehicle: UniqueVehicle) {
    return (
      projects.find((project) => project.id === vehicle.projectGroupId)
        ?.zoneProjects ?? []
    );
  }

  /** One registration with one item per new combination. */
  function submitRegistration(
    vehicle: UniqueVehicle,
    draft: RegistrationRequestDraft,
  ): void {
    if (!draft.combinations.length) return;
    const now = new Date().toISOString();
    const nextRegistrationNumber =
      Math.max(
        0,
        ...registrations.map((registration) =>
          Number(registration.id.replace(/\D/g, '')),
        ),
      ) + 1;
    const registrationId = `VPR-${String(nextRegistrationNumber).padStart(4, '0')}`;
    const productTypeId = productTypeIdFor(vehicle);
    const applied = primaryAssignments(vehicle);
    if (
      !applied.length ||
      draft.shapeIds.some(
        (id) => !applied.some((row) => row.vehicleProductShapeId === id),
      )
    ) {
      setMessage('Verify PRIMARY Shape assignments by zone first.');
      return;
    }
    const shapeFor = (code: string) =>
      applied.find(
        (row) =>
          vehicleZones.find((zone) => zone.id === row.vehicleZoneId)?.code ===
          code,
      )?.vehicleProductShapeId;
    const shapeColumns =
      productTypeId === 'PT-CC'
        ? { exteriorShapeId: shapeFor('EX') }
        : {
            frontShapeId: shapeFor('F'),
            rearShapeId: shapeFor('B'),
            thirdRowShapeId: shapeFor('E'),
          };
    if (
      draft.combinations.some((row) =>
        registeredSkus.some(
          (sku) => sku.trim().toLowerCase() === row.sku.trim().toLowerCase(),
        ),
      )
    ) {
      setMessage('This SKU is in use or was used previously.');
      return;
    }
    const newProducts: MasterProduct[] = draft.combinations.map(
      (combination) => ({
        id: `MP-${combination.sku}`,
        productTypeId,
        sku: combination.sku,
        status: 'DRAFT',
        productMaterialId: combination.materialId,
        productColorId: combination.colorId,
        ...shapeColumns,
        fNumber: vehicle.fNumber,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const registration: VehicleProductRegistration = {
      id: registrationId,
      requestedBy: CURRENT_USER_ID,
      requestedAt: now,
      ...(draft.note ? { note: draft.note } : {}),
    };
    const newItems: VehicleProductRegistrationItem[] = newProducts.map(
      (product, index) => ({
        id: `${registrationId}-${String(index + 1).padStart(2, '0')}`,
        registrationId,
        masterProductId: product.id,
        vehicleProjectIds: [],
        sourceShapeIds: draft.sourceShapeIds,
      }),
    );
    updateWorkbench((state) => {
      if (
        draft.combinations.some((row) =>
          [...state.masterProducts, ...state.masterProductSkus].some(
            (existing) =>
              existing.sku.trim().toLowerCase() ===
              row.sku.trim().toLowerCase(),
          ),
        )
      )
        return state;
      return {
        ...state,
        masterProducts: [...state.masterProducts, ...newProducts],
        registrations: [registration, ...state.registrations],
        registrationItems: [...state.registrationItems, ...newItems],
        uniqueVehicles: state.uniqueVehicles.map((row) =>
          row.fNumber === vehicle.fNumber
            ? { ...row, skuStatus: 'REQUESTED' as const }
            : row,
        ),
      };
    });
    setRequesting(undefined);
  }

  /** Shape names assigned to this F#, for the complaint's affected design. */
  function designOptionsFor(vehicle: UniqueVehicle): readonly string[] {
    return vehicle.shapes.map(
      (shapeId) =>
        vehicleProductShapes.find((shape) => shape.id === shapeId)?.name ??
        shapeId,
    );
  }

  function createComplaint(vehicle: UniqueVehicle, draft: ComplaintDraft) {
    const nextNumber =
      Math.max(
        0,
        ...complaints.map((complaint) =>
          Number(complaint.id.replace(/\D/g, '')),
        ),
      ) + 1;
    const complaint: Complaint = {
      id: `CP-${String(nextNumber).padStart(4, '0')}`,
      fNumber: vehicle.fNumber,
      vehicle: vehicle.vehicle,
      product: vehicle.product,
      issue: draft.issue,
      design: draft.design,
      revision: draft.revision,
      reported: new Date().toISOString().slice(0, 10),
      owner: draft.owner,
      status: 'OPEN',
    };
    setComplaints((current) => [complaint, ...current]);
    setComplaining(undefined);
    setMessage(
      `${complaint.id} Complaint logged — ${vehicle.fNumber} · ${draft.design}`,
    );
  }

  return (
    <section>
      <PageHeader
        description="Vehicles with fitting-confirmed configurations — Shape / Product / SKU link to this F#"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'unique_vehicle' },
                { name: 'unique_vehicle_x_option_value' },
                { name: 'unique_vehicle_x_shape_assignment' },
                { name: 'vehicle_product_shape' },
                { name: 'unique_vehicle_group' },
                { name: 'unique_vehicle_dimension' },
              ]
            : undefined
        }
      />
      {message && (
        <p className="page-status-message" role="status">
          {message}
        </p>
      )}
      <Card>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                aria-label="Search F number or vehicle"
                placeholder="Search F number / Vehicle"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </div>
          </div>
        </div>
        <FlatDataGrid
          embedded
          label="Unique Vehicles"
          columns={columns}
          rows={pagedVehicles}
          getRowId={(vehicle) => vehicle.fNumber}
          emptyMessage="No matching vehicles."

          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: visibleVehicles.length,
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

      {complaining && (
        <ComplaintDialog
          key={complaining.fNumber}
          vehicle={complaining}
          designOptions={designOptionsFor(complaining)}
          defaultOwner={userName(appUsers, CURRENT_USER_ID)}
          onSubmit={(draft) => {
            createComplaint(complaining, draft);
          }}
          onClose={() => {
            setComplaining(undefined);
          }}
        />
      )}

      {requesting && (
        <RegistrationRequestDialog
          key={requesting.fNumber}
          vehicle={requesting}
          productTypeId={productTypeIdFor(requesting)}
          zoneProjects={zoneProjectsFor(requesting)}
          materials={productMaterials.filter(
            (material) =>
              material.productTypeId === productTypeIdFor(requesting),
          )}
          colors={productColors.filter(
            (color) => color.productTypeId === productTypeIdFor(requesting),
          )}
          shapes={primaryAssignments(requesting).flatMap((assignment) => {
            const shapeId = assignment.vehicleProductShapeId;
            const shape = vehicleProductShapes.find(
              (item) => item.id === shapeId && item.status === 'ACTIVE',
            );
            return shape ? [shape] : [];
          })}
          registeredSkus={registeredSkus}
          onSubmit={(draft) => {
            submitRegistration(requesting, draft);
          }}
          onClose={() => {
            setRequesting(undefined);
          }}
        />
      )}
    </section>
  );
}
