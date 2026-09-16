import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { Input } from '@coverland-engineering/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { Search } from 'lucide-react';
import { userName } from '@/shared/domain/app-user';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
  const {
    pageItems: pagedVehicles,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleVehicles, query);

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
      setMessage('Zone별 PRIMARY Shape 적용을 먼저 확인하세요.');
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
      setMessage('현재 또는 과거에 사용된 SKU입니다.');
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
      `${complaint.id} 컴플레인을 접수했습니다 — ${vehicle.fNumber} · ${draft.design}`,
    );
  }

  return (
    <section>
      <PageHeader
        description="Fitting으로 Configuration이 확정된 차량 — Shape / Product / SKU는 이 F#에 연결됩니다"
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
      <div className="workbench-filters">
        <div className="search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label="F Number 또는 Vehicle 검색"
            placeholder="F Number / Vehicle 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="filter-count">
          {visibleVehicles.length} active vehicles
        </span>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>F Number</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="configuration-column">
                Configuration
              </TableHead>
              <TableHead>출처 (Group)</TableHead>
              <TableHead>Shapes</TableHead>
              <TableHead>SKU Registration</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedVehicles.map((vehicle) => (
              <TableRow key={vehicle.fNumber}>
                <TableCell>
                  <span className="f-number">{vehicle.fNumber}</span>
                </TableCell>
                <TableCell>
                  <div className="vehicle-name">{vehicle.vehicle}</div>
                  <div className="vehicle-meta">
                    {vehicle.product} · Research {vehicle.vehicleResearchId}
                  </div>
                </TableCell>
                <TableCell>
                  <ConfigChips options={vehicle.options} />
                </TableCell>
                <TableCell>
                  <span className="project-reference">
                    {vehicle.projectGroupId}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="shape-list">
                    {vehicle.shapes.map((shape) => (
                      <span key={shape}>{shape}</span>
                    ))}
                  </div>
                  <ShapeAssignmentPanel vehicle={vehicle} />
                </TableCell>
                <TableCell>
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
                        onClick={() => setRequesting(vehicle)}
                      >
                        등록 요청
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
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <WorkbenchPagination
          recordCount={visibleVehicles.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          itemLabel="vehicles"
        />
      </Card>

      {complaining && (
        <ComplaintDialog
          key={complaining.fNumber}
          vehicle={complaining}
          designOptions={designOptionsFor(complaining)}
          defaultOwner={userName(appUsers, CURRENT_USER_ID)}
          onSubmit={(draft) => createComplaint(complaining, draft)}
          onClose={() => setComplaining(undefined)}
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
          onSubmit={(draft) => submitRegistration(requesting, draft)}
          onClose={() => setRequesting(undefined)}
        />
      )}
    </section>
  );
}
