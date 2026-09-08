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
import { ConfigChips } from '@/shared/domain/config-chips';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
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
  RegistrationRequestDialog,
  type RegistrationRequestDraft,
} from '../components/registration-request-dialog';

/** F-number registry for fitting-confirmed vehicle configurations. */
export function UniqueVehiclesPage() {
  const [query, setQuery] = useState('');
  const [requesting, setRequesting] = useState<UniqueVehicle>();
  const {
    uniqueVehicles,
    setUniqueVehicles,
    complaints,
    setComplaints,
    projects,
    productMaterials,
    productColors,
    vehicleProductShapes,
    masterProducts,
    setMasterProducts,
    registrations,
    setRegistrations,
    registrationItems,
    setRegistrationItems,
  } = useWorkbenchStore();
  const visibleVehicles = uniqueVehicles.filter((vehicle) =>
    `${vehicle.fNumber} ${vehicle.vehicle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const registeredSkus = masterProducts.map((product) => product.sku);

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
    // vehicle_cover_product keeps shapes in per-zone columns: exterior alone
    // for a whole-vehicle cover, otherwise front / rear / third row in order.
    const [first, second, third] = draft.shapeIds;
    const shapeColumns =
      productTypeId === 'PT-CC'
        ? { exteriorShapeId: first }
        : {
            ...(first ? { frontShapeId: first } : {}),
            ...(second ? { rearShapeId: second } : {}),
            ...(third ? { thirdRowShapeId: third } : {}),
          };
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
        vehicleProjectIds: draft.vehicleProjectIds,
      }),
    );
    setMasterProducts((current) => [...current, ...newProducts]);
    setRegistrations((current) => [registration, ...current]);
    setRegistrationItems((current) => [...current, ...newItems]);
    setUniqueVehicles((current) =>
      current.map((row) =>
        row.fNumber === vehicle.fNumber
          ? { ...row, skuStatus: 'REQUESTED' as const }
          : row,
      ),
    );
    setRequesting(undefined);
  }

  function createComplaint(vehicle: (typeof uniqueVehicles)[number]): void {
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
      issue: 'Fitting complaint created from Unique Vehicles.',
      design: vehicle.shapes[0] ?? 'Not assigned',
      revision: 'Rev 1',
      reported: new Date().toISOString().slice(0, 10),
      owner: 'Kai',
      status: 'OPEN',
    };
    setComplaints((current) => [complaint, ...current]);
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
      <div className="registry-note">
        <div className="f-number-example">F#20855</div>
        <div>
          <strong>F-Number는 Project 시작 번호가 아닙니다.</strong>
          <p>
            전 Zone fitting confirmed + Shape 부여 후 Configuration이 확정될 때
            발급됩니다.
          </p>
        </div>
      </div>
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
            {visibleVehicles.map((vehicle) => (
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
                      onClick={() => createComplaint(vehicle)}
                    >
                      Complaint
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
          shapes={requesting.shapes.flatMap((shapeId) => {
            const shape = vehicleProductShapes.find(
              (item) => item.id === shapeId,
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
