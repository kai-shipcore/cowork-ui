import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { migrateVisitStaff } from '@/shared/domain/field-visit';
import { summarizeGroupStage } from '@/shared/domain/project-stage';
import { recordStageTransitions } from '@/shared/domain/project-stage-history';
import { migrateSampleInspection } from '@/shared/domain/sample-inspection';
import type {
  ApprovalAssignment,
  ApprovalGrant,
  ApprovalRequest,
  ApprovalStep,
  ApprovalType,
  FitmentQuality,
  ShapeAssignment,
} from '@/shared/types/db-workflow';
import type {
  AppUser,
  Complaint,
  Dealer,
  MasterProduct,
  MasterProductPackaging,
  MasterProductSku,
  ProductReferenceItem,
  ProjectActivityItem,
  ProjectDesign,
  ProjectDetailSnapshot,
  ProjectTask,
  ProjectVisit,
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
  SeatCoverCode,
  SeatCoverCodeOptionValue,
  SeatCoverPart,
  UniqueVehicle,
  VehicleConfiguration,
  VehicleOptionKey,
  VehicleOptionValue,
  VehicleProductRegistration,
  VehicleProductRegistrationItem,
  VehicleProductShape,
  VehicleProjectGroup,
  VehicleZone,
  VehicleZoneProject,
  Visit,
  ZoneProject,
} from '@/shared/types/workbench';
import {
  collectShapes,
  removeLegacyAdoption,
} from '@/modules/product-shapes/shape-model';
import { CURRENT_USER_ID } from './current-user';
import { readStageDurationRevisions } from './stage-duration-model';
import {
  APP_USERS,
  APPROVAL_GRANTS,
  APPROVAL_TYPES,
  COMPLAINTS,
  DEALERS,
  MASTER_PRODUCT_PACKAGINGS,
  MASTER_PRODUCT_SKUS,
  MASTER_PRODUCTS,
  PRODUCT_COLORS,
  PRODUCT_MATERIALS,
  PRODUCT_REGISTRATION_ITEMS,
  PRODUCT_REGISTRATIONS,
  SAMPLE_REQUEST_ITEMS,
  SAMPLE_REQUESTS,
  SAMPLE_SHIPMENTS,
  SEAT_COVER_CODE_OPTION_VALUES,
  SEAT_COVER_CODES,
  SEAT_COVER_PARTS,
  SHAPE_ASSIGNMENTS,
  UNIQUE_VEHICLES,
  VEHICLE_CONFIGURATIONS,
  VEHICLE_OPTION_KEYS,
  VEHICLE_OPTION_VALUES,
  VEHICLE_PRODUCT_SHAPES,
  VEHICLE_PROJECTS,
  VEHICLE_ZONES,
  VISITS,
} from './workbench-mock-data';
import workbenchSeed from './workbench-seed.json';

const STORAGE_KEY = 'coverland-rd-workbench-v1';

export interface WorkbenchState {
  shapeAssignments: readonly ShapeAssignment[];
  fitmentQualities: readonly FitmentQuality[];
  approvalRequests: readonly ApprovalRequest[];
  approvalSteps: readonly ApprovalStep[];
  approvalAssignments: readonly ApprovalAssignment[];
  approvalGrants: readonly ApprovalGrant[];
  approvalTypes: readonly ApprovalType[];
  configurations: readonly VehicleConfiguration[];
  projects: readonly VehicleProjectGroup[];
  visits: readonly Visit[];
  dealers: readonly Dealer[];
  complaints: readonly Complaint[];
  sampleRequests: readonly SampleRequest[];
  sampleRequestItems: readonly SampleRequestItem[];
  sampleShipments: readonly SampleShipment[];
  uniqueVehicles: readonly UniqueVehicle[];
  productColors: readonly ProductReferenceItem[];
  productMaterials: readonly ProductReferenceItem[];
  vehicleProductShapes: readonly VehicleProductShape[];
  shapeCatalogVersion?: number;
  appUsers: readonly AppUser[];
  vehicleZones: readonly VehicleZone[];
  vehicleOptionKeys: readonly VehicleOptionKey[];
  vehicleOptionValues: readonly VehicleOptionValue[];
  seatCoverParts: readonly SeatCoverPart[];
  seatCoverCodes: readonly SeatCoverCode[];
  seatCoverCodeOptionValues: readonly SeatCoverCodeOptionValue[];
  masterProducts: readonly MasterProduct[];
  masterProductSkus: readonly MasterProductSku[];
  masterProductPackagings: readonly MasterProductPackaging[];
  registrations: readonly VehicleProductRegistration[];
  registrationItems: readonly VehicleProductRegistrationItem[];
  projectDetails: Readonly<Record<string, ProjectDetailSnapshot>>;
}

interface WorkbenchStore extends WorkbenchState {
  storageMessage: string;
  storageError: boolean;
  retryPersistence: () => void;
  exportSnapshot: () => string;
  updateWorkbench: (
    transform: (state: WorkbenchState) => WorkbenchState,
  ) => void;
  updateProjectWorkflow: (
    projectId: string,
    transform: (detail: ProjectDetailSnapshot) => ProjectDetailSnapshot,
  ) => void;
  setVehicleProductShapes: Dispatch<
    SetStateAction<readonly VehicleProductShape[]>
  >;
  setConfigurations: Dispatch<SetStateAction<readonly VehicleConfiguration[]>>;
  setProjects: Dispatch<SetStateAction<readonly VehicleProjectGroup[]>>;
  setVisits: Dispatch<SetStateAction<readonly Visit[]>>;
  setDealers: Dispatch<SetStateAction<readonly Dealer[]>>;
  setComplaints: Dispatch<SetStateAction<readonly Complaint[]>>;
  setSampleRequests: Dispatch<SetStateAction<readonly SampleRequest[]>>;
  setSampleRequestItems: Dispatch<SetStateAction<readonly SampleRequestItem[]>>;
  setSampleShipments: Dispatch<SetStateAction<readonly SampleShipment[]>>;
  setUniqueVehicles: Dispatch<SetStateAction<readonly UniqueVehicle[]>>;
  setProductColors: Dispatch<SetStateAction<readonly ProductReferenceItem[]>>;
  setProductMaterials: Dispatch<
    SetStateAction<readonly ProductReferenceItem[]>
  >;
  setVehicleOptionKeys: Dispatch<SetStateAction<readonly VehicleOptionKey[]>>;
  setVehicleOptionValues: Dispatch<
    SetStateAction<readonly VehicleOptionValue[]>
  >;
  setSeatCoverParts: Dispatch<SetStateAction<readonly SeatCoverPart[]>>;
  setSeatCoverCodes: Dispatch<SetStateAction<readonly SeatCoverCode[]>>;
  setSeatCoverCodeOptionValues: Dispatch<
    SetStateAction<readonly SeatCoverCodeOptionValue[]>
  >;
  setMasterProducts: Dispatch<SetStateAction<readonly MasterProduct[]>>;
  setMasterProductSkus: Dispatch<SetStateAction<readonly MasterProductSku[]>>;
  setMasterProductPackagings: Dispatch<
    SetStateAction<readonly MasterProductPackaging[]>
  >;
  setRegistrations: Dispatch<
    SetStateAction<readonly VehicleProductRegistration[]>
  >;
  setRegistrationItems: Dispatch<
    SetStateAction<readonly VehicleProductRegistrationItem[]>
  >;
  saveProjectDetail: (projectId: string, detail: ProjectDetailSnapshot) => void;
  resetWorkbench: () => void;
}

/** Hand-written reference data; fills any collection the seed snapshot lacks. */
function baselineState(): WorkbenchState {
  return {
    shapeAssignments: SHAPE_ASSIGNMENTS,
    fitmentQualities: [],
    approvalRequests: [],
    approvalSteps: [],
    approvalAssignments: [],
    approvalGrants: APPROVAL_GRANTS,
    approvalTypes: APPROVAL_TYPES,
    configurations: VEHICLE_CONFIGURATIONS,
    projects: VEHICLE_PROJECTS,
    visits: VISITS,
    dealers: DEALERS,
    complaints: COMPLAINTS,
    sampleRequests: SAMPLE_REQUESTS,
    sampleRequestItems: SAMPLE_REQUEST_ITEMS,
    sampleShipments: SAMPLE_SHIPMENTS,
    uniqueVehicles: UNIQUE_VEHICLES,
    productColors: PRODUCT_COLORS,
    productMaterials: PRODUCT_MATERIALS,
    vehicleProductShapes: collectShapes(
      VEHICLE_PRODUCT_SHAPES,
      VEHICLE_PROJECTS,
      {},
      false,
    ),
    shapeCatalogVersion: 1,
    appUsers: APP_USERS,
    vehicleZones: VEHICLE_ZONES,
    vehicleOptionKeys: VEHICLE_OPTION_KEYS,
    vehicleOptionValues: VEHICLE_OPTION_VALUES,
    seatCoverParts: SEAT_COVER_PARTS,
    seatCoverCodes: SEAT_COVER_CODES,
    seatCoverCodeOptionValues: SEAT_COVER_CODE_OPTION_VALUES,
    masterProducts: MASTER_PRODUCTS,
    masterProductSkus: MASTER_PRODUCT_SKUS,
    masterProductPackagings: MASTER_PRODUCT_PACKAGINGS,
    registrations: PRODUCT_REGISTRATIONS,
    registrationItems: PRODUCT_REGISTRATION_ITEMS,
    projectDetails: {},
  };
}

interface LegacyVehicleConfiguration extends Omit<
  VehicleConfiguration,
  'projectGroupIds'
> {
  projectGroupIds?: readonly string[];
  projectGroups?: readonly string[];
}

interface LegacyVehicleProject extends Omit<
  VehicleProjectGroup,
  'zoneProjects'
> {
  zoneProjects?: readonly VehicleZoneProject[];
  configurationId?: string;
  zones?: readonly string[];
}

interface LegacySampleShipment extends SampleShipment {
  /** Renamed to externalReference to match `sample_shipment.external_reference`. */
  shipmentReference?: string;
}

interface LegacyVisit extends Omit<Visit, 'taskIds' | 'vehicleProjectIds'> {
  vehicleProjectIds?: readonly string[];
  /** Legacy single staff member. */
  assignee?: string;
  taskIds?: readonly string[];
  project?: string;
  zones?: readonly string[];
}

interface LegacySampleRequest extends Omit<SampleRequest, 'createdAt'> {
  createdAt?: string;
  project?: string;
  items?: number;
  round?: number;
  tracking?: string;
  requestedAt?: string;
  status?: 'REQUESTED' | 'SHIPPED' | 'ARRIVED' | 'APPROVED';
}

interface LegacyUniqueVehicle extends UniqueVehicle {
  configurationId?: string;
  project?: string;
}

type LegacyProjectTask = Omit<ProjectTask, 'status'> & {
  zone?: string;
  status: ProjectTask['status'] | 'PENDING' | 'IN PROGRESS' | 'COMPLETED';
};

interface LegacyProjectVisit extends Omit<ProjectVisit, 'vehicleProjectIds'> {
  vehicleProjectIds?: readonly string[];
  zones?: readonly string[];
}

type LegacyProjectDesign = Omit<
  ProjectDesign,
  'productTypeId' | 'status' | 'details' | 'revisions'
> & {
  productTypeId?: string;
  status?: ProjectDesign['status'];
  details?: ProjectDesign['details'];
  revisions?: ProjectDesign['revisions'];
  zone?: string;
  part?: string;
  revision?: number;
  note?: string;
  sampleApproved?: boolean;
};

type LegacyZoneProject = Omit<
  ZoneProject,
  | 'projectGroupId'
  | 'productTypeId'
  | 'vehicleResearchId'
  | 'zoneId'
  | 'managerId'
  | 'currentStage'
  | 'shape'
> & {
  shape?: string;
  projectGroupId?: string;
  productTypeId?: string;
  vehicleResearchId?: string;
  zoneId?: string;
  managerId?: string;
  currentStage?: ZoneProject['currentStage'];
};

function migrateZoneShape(
  zone: LegacyZoneProject,
  productType: string,
): VehicleProductShape | undefined {
  if (zone.productShape) {
    const legacyShape = zone.productShape as Omit<
      VehicleProductShape,
      'status' | 'dimensions'
    > & {
      status: VehicleProductShape['status'] | 'IN_REVIEW' | 'APPROVED';
      dimensions?: Omit<
        NonNullable<VehicleProductShape['dimensions']>,
        'unit'
      > & {
        unit: 'CM' | 'IN' | 'cm' | 'in' | 'mm';
      };
    };
    const dimensions = legacyShape.dimensions;
    return {
      ...legacyShape,
      status:
        legacyShape.status === 'APPROVED'
          ? 'ACTIVE'
          : legacyShape.status === 'IN_REVIEW'
            ? 'IN_DEVELOPMENT'
            : legacyShape.status,
      dimensions: dimensions
        ? {
            ...dimensions,
            unit: dimensions.unit.toUpperCase() === 'IN' ? 'IN' : 'CM',
          }
        : undefined,
    };
  }
  const shapeId = nonEmptyId(zone.productShapeId, zone.shape);
  if (!shapeId) return undefined;
  return {
    id: shapeId,
    productTypeId: productType,
    name: nonEmptyId(zone.shape, shapeId),
    status: 'ACTIVE',
    source: 'NEW',
    ...(productType === 'PT-CC'
      ? { dimensions: { length: 0, height: 0, unit: 'CM' as const } }
      : {}),
    createdBy: 'Legacy data',
    createdAt: '2026-08-01T00:00:00-07:00',
  };
}

function zoneLabel(code: string): string {
  return code === 'EX'
    ? 'Exterior'
    : ({ F: 'Front Row', B: '2nd Row', E: '3rd Row' }[code] ?? code);
}

function productTypeId(product: VehicleProjectGroup['product']): string {
  return {
    'Seat Cover': 'PT-SC',
    'Car Cover': 'PT-CC',
    'Floor Mat': 'PT-FM',
    'Steering Wheel Cover': 'PT-SWC',
    'Window Shield': 'PT-WS',
  }[product];
}

// Empty IDs in older snapshots mean "not assigned", just like missing IDs.
function nonEmptyId(...values: (string | undefined)[]): string {
  return values.find((value) => value !== undefined && value !== '') ?? '';
}

function migrateProject(project: LegacyVehicleProject): VehicleProjectGroup {
  const vehicleResearchId = nonEmptyId(
    project.vehicleResearchId,
    project.configurationId,
  );
  const resolvedProductTypeId =
    project.productTypeId || productTypeId(project.product);
  const zoneProjects: readonly VehicleZoneProject[] = project.zoneProjects
    ?.length
    ? project.zoneProjects.map((zoneProject) => ({
        ...removeLegacyAdoption(zoneProject),
        productTypeId: zoneProject.productTypeId || resolvedProductTypeId,
        status: zoneProject.status ?? 'ACTIVE',
        priority: zoneProject.priority ?? 'NORMAL',
        lastActivityAt: zoneProject.lastActivityAt ?? project.created,
        currentStage:
          (zoneProject as Partial<VehicleZoneProject>).currentStage ??
          (project.stage as VehicleZoneProject['currentStage']),
      }))
    : (project.zones ?? []).map((code) => ({
        id: `${project.id}-${code}`,
        projectGroupId: project.id,
        productTypeId: resolvedProductTypeId,
        vehicleResearchId,
        zoneId: `ZONE-${resolvedProductTypeId.replace('PT-', '')}-${code}`,
        code,
        label: zoneLabel(code),
        managerId: 'USR-KAI',
        currentStage: project.stage as VehicleZoneProject['currentStage'],
        status: 'ACTIVE',
        priority: 'NORMAL',
        lastActivityAt: project.created,
      }));
  return {
    ...project,
    productTypeId: resolvedProductTypeId,
    vehicleResearchId,
    zoneProjects,
  };
}

export function isLegacySeedActivity(item: ProjectActivityItem): boolean {
  return (
    (item.id === 'ACT-003' &&
      ['Scan visit scheduled', 'Scan Visit 예약'].includes(item.title) &&
      item.detail.includes('08/28 Galpin Ford')) ||
    (item.id === 'ACT-002' &&
      ['Vehicle Hunt completed', 'Vehicle Hunt 완료'].includes(item.title) &&
      (item.detail.endsWith('Stage entered') ||
        item.detail.endsWith('단계 진입'))) ||
    (item.id === 'ACT-001' &&
      ['Project group created', 'Project Group 생성'].includes(item.title) &&
      (item.detail.includes('Auto-generated · No F#') ||
        item.detail.includes('자동 생성 · F# 없음')))
  );
}

/**
 * Default state: a snapshot captured from a working browser session on
 * 2026-09-11 (`workbench-seed.json`). It is normalized the same way a stored
 * snapshot is, so shape changes only need a migration in one place.
 */
function initialState(): WorkbenchState {
  // JSON imports carry no literal types, so the seed is typed as a stored
  // snapshot and normalized by migrateState like one.
  return migrateState(
    workbenchSeed as unknown as Partial<WorkbenchState>,
    baselineState(),
  );
}

function loadState(): WorkbenchState {
  const fallback = initialState();
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return fallback;
    return migrateState(
      JSON.parse(serialized) as Partial<WorkbenchState>,
      fallback,
    );
  } catch {
    return fallback;
  }
}

function migrateState(
  stored: Partial<WorkbenchState>,
  fallback: WorkbenchState,
): WorkbenchState {
  const configurations = (stored.configurations ?? fallback.configurations).map(
    (configuration) => {
      const legacy = configuration as LegacyVehicleConfiguration;
      const migrated = {
        ...configuration,
        projectGroupIds: legacy.projectGroupIds ?? legacy.projectGroups ?? [],
      };
      if (configuration.researchStatus === 'COMPLETE') {
        return { ...migrated, researchStatus: 'COMPLETED' as const };
      }
      if (configuration.researchStatus === 'RESEARCHING') {
        return { ...migrated, researchStatus: 'IN_PROGRESS' as const };
      }
      return migrated;
    },
  );
  const projects = (stored.projects ?? fallback.projects).map((project) =>
    migrateProject(project as LegacyVehicleProject),
  );
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const visits = (stored.visits ?? fallback.visits).map((visit) => {
    const legacy = visit as LegacyVisit;
    const projectGroupId = nonEmptyId(visit.projectGroupId, legacy.project);
    const group = projectById.get(projectGroupId);
    const legacyZoneCodes = legacy.zones ?? [];
    return {
      ...visit,
      staffIds: migrateVisitStaff(
        visit,
        stored.projectDetails?.[projectGroupId]?.tasks ?? [],
      ),
      projectGroupId,
      vehicleProjectIds: legacy.vehicleProjectIds?.length
        ? legacy.vehicleProjectIds
        : (group?.zoneProjects ?? [])
            .filter((project) => legacyZoneCodes.includes(project.code))
            .map((project) => project.id),
    };
  });
  const projectDetails = Object.fromEntries(
    Object.entries(stored.projectDetails ?? {}).map(([projectId, detail]) => {
      const legacyDetail: Omit<ProjectDetailSnapshot, 'tasks'> & {
        tasks?: ProjectDetailSnapshot['tasks'];
      } = detail;
      const group = projectById.get(projectId);
      const zoneByCode = new Map(
        group?.zoneProjects.map((zoneProject) => [
          zoneProject.code,
          zoneProject,
        ]),
      );
      const zoneById = new Map(
        group?.zoneProjects.map((zoneProject) => [zoneProject.id, zoneProject]),
      );
      return [
        projectId,
        {
          ...detail,
          zones: detail.zones.map((zone) => {
            const legacy = zone as LegacyZoneProject;
            const vehicleProject =
              zoneById.get(zone.id) ?? zoneByCode.get(zone.code);
            const productShape = migrateZoneShape(
              legacy,
              vehicleProject?.productTypeId ?? group?.productTypeId ?? '',
            );
            return {
              ...vehicleProject,
              ...removeLegacyAdoption(legacy),
              ...(productShape
                ? {
                    productShape,
                    productShapeId: productShape.id,
                    shape: productShape.name,
                  }
                : {}),
            } as ZoneProject;
          }),
          tasks: (legacyDetail.tasks ?? []).map((task) => {
            const legacy = task as LegacyProjectTask;
            const status: ProjectTask['status'] =
              legacy.status === 'PENDING'
                ? 'OPEN'
                : legacy.status === 'IN PROGRESS'
                  ? 'ACCEPTED'
                  : legacy.status === 'COMPLETED'
                    ? 'DONE'
                    : legacy.status;
            return {
              ...task,
              status,
              vehicleProjectId: nonEmptyId(
                task.vehicleProjectId,
                zoneByCode.get(legacy.zone ?? '')?.id,
              ),
              ...(legacy.assignedTo && !legacy.assignedAt
                ? { assignedAt: legacy.created }
                : {}),
              ...(['DONE', 'FAILED', 'CANCELLED'].includes(status) &&
              !legacy.closedAt
                ? { closedAt: legacy.created }
                : {}),
            };
          }),
          visits: detail.visits.map((visit) => {
            const legacy = visit as LegacyProjectVisit;
            return {
              ...visit,
              staffIds: migrateVisitStaff(visit, legacyDetail.tasks ?? []),
              vehicleProjectIds: legacy.vehicleProjectIds?.length
                ? legacy.vehicleProjectIds
                : (legacy.zones ?? [])
                    .map((code) => zoneByCode.get(code)?.id)
                    .filter((id): id is string => Boolean(id)),
            };
          }),
          designs: detail.designs.map((design) => {
            const legacy = design as LegacyProjectDesign;
            const vehicleProjectId = nonEmptyId(
              design.vehicleProjectId,
              zoneByCode.get(legacy.zone ?? '')?.id,
            );
            const vehicleProject = zoneById.get(vehicleProjectId);
            const details =
              legacy.details ??
              (group?.product === 'Seat Cover'
                ? {
                    kind: 'SEAT_COVER' as const,
                    vehicleResearchId: group.vehicleResearchId,
                    seatCoverPartId: 'PART-LEGACY',
                    seatCoverCodeId: 'SCC-LEGACY',
                    partName: legacy.part ?? 'Legacy Part',
                    category: 'OTHER',
                    side: 'UNIVERSAL' as const,
                    isForMiddleSeat: false,
                    isCustom: true,
                    designedBy: 'USR-JH',
                  }
                : group?.product === 'Car Cover'
                  ? {
                      kind: 'CAR_COVER' as const,
                      vehicleResearchId: group.vehicleResearchId,
                      designedBy: 'USR-JH',
                    }
                  : {
                      kind: 'FLOOR_MAT' as const,
                      vehicleResearchId: group?.vehicleResearchId ?? '',
                      vehicleZoneId: vehicleProject?.zoneId ?? '',
                    });
            const revisions = legacy.revisions?.length
              ? legacy.revisions
              : [
                  {
                    id: `REV-${design.id}-${String(legacy.revision ?? 1)}`,
                    revisionNumber: legacy.revision ?? 1,
                    note: legacy.note ?? 'Legacy revision',
                    createdBy: 'USR-JH',
                    createdAt: '2026-08-31T10:30:00-07:00',
                    ...(legacy.sampleApproved
                      ? {
                          sampleApprovedAt: '2026-08-31T15:00:00-07:00',
                          sampleApprovedBy: 'USR-KAI',
                        }
                      : {}),
                  },
                ];
            return {
              ...design,
              productTypeId: legacy.productTypeId ?? group?.productTypeId ?? '',
              vehicleProjectId,
              status: legacy.status ?? 'ACTIVE',
              details,
              revisions,
            };
          }),
          activity: detail.activity.filter(
            (item) => !isLegacySeedActivity(item),
          ),
        },
      ];
    }),
  );
  const storedSampleRequests = stored.sampleRequests ?? fallback.sampleRequests;
  const sampleRequests = storedSampleRequests.map((request) => {
    const legacy = request as LegacySampleRequest;
    return {
      id: request.id,
      projectGroupId: nonEmptyId(request.projectGroupId, legacy.project),
      vehicle: request.vehicle,
      product: request.product,
      factory: request.factory,
      ...(request.note ? { note: request.note } : {}),
      ...(request.sentAt
        ? {
            sentAt: request.sentAt,
            ...(request.sentBy ? { sentBy: request.sentBy } : {}),
          }
        : legacy.status && legacy.status !== 'REQUESTED'
          ? {
              sentAt: legacy.requestedAt ?? new Date().toISOString(),
              sentBy: 'USR-KAI',
            }
          : {}),
      createdAt:
        legacy.createdAt ?? legacy.requestedAt ?? new Date().toISOString(),
    } satisfies SampleRequest;
  });
  const sampleShipments = (
    stored.sampleShipments ??
    storedSampleRequests.flatMap((request) => {
      const legacy = request as LegacySampleRequest;
      if (!legacy.tracking || legacy.tracking === '—') return [];
      return [
        {
          id: `SHIP-${request.id}`,
          factory: request.factory,
          ...(legacy.status !== 'REQUESTED'
            ? { shippedAt: legacy.requestedAt ?? new Date().toISOString() }
            : {}),
          ...(legacy.status === 'ARRIVED' || legacy.status === 'APPROVED'
            ? { arrivedAt: legacy.requestedAt ?? new Date().toISOString() }
            : {}),
          externalReference: legacy.tracking,
        } satisfies SampleShipment,
      ];
    })
  ).map((shipment) => {
    const { shipmentReference, ...rest } = shipment as LegacySampleShipment;
    return shipmentReference && !rest.externalReference
      ? { ...rest, externalReference: shipmentReference }
      : rest;
  });
  const sampleRequestItems =
    stored.sampleRequestItems ??
    storedSampleRequests.flatMap((request) => {
      const legacy = request as LegacySampleRequest;
      return Array.from({ length: legacy.items ?? 1 }, (_, index) => ({
        id: `SRI-${request.id}-${String(index + 1)}`,
        sampleRequestId: request.id,
        vehicleProductDesignId: `DESIGN-${request.id}-${String(index + 1)}`,
        vehicleProductDesignRevisionId: `REV-${request.id}-${String(index + 1)}-${String(legacy.round ?? 1)}`,
        sampleRound: legacy.round ?? 1,
        priority: 'NORMAL' as const,
        ...(legacy.status === 'ARRIVED' || legacy.status === 'APPROVED'
          ? {
              sampleReceivedAt: legacy.requestedAt ?? new Date().toISOString(),
            }
          : {}),
        ...(legacy.tracking && legacy.tracking !== '—'
          ? { sampleShipmentId: `SHIP-${request.id}` }
          : {}),
      }));
    });
  return {
    configurations,
    projects,
    visits,
    dealers: stored.dealers ?? fallback.dealers,
    complaints: stored.complaints ?? fallback.complaints,
    // Reference data was added after the first snapshots were written, so a
    // stored state can be missing these collections entirely.
    productColors: stored.productColors ?? fallback.productColors,
    productMaterials: stored.productMaterials ?? fallback.productMaterials,
    vehicleProductShapes: collectShapes(
      stored.vehicleProductShapes ?? fallback.vehicleProductShapes,
      projects,
      projectDetails,
      stored.shapeCatalogVersion !== 1,
    ),
    shapeCatalogVersion: 1,
    appUsers: stored.appUsers ?? fallback.appUsers,
    vehicleZones: [
      ...(stored.vehicleZones ?? []),
      ...fallback.vehicleZones.filter(
        (fallbackZone) =>
          !(stored.vehicleZones ?? []).some(
            (storedZone) => storedZone.id === fallbackZone.id,
          ),
      ),
    ],
    vehicleOptionKeys: stored.vehicleOptionKeys ?? fallback.vehicleOptionKeys,
    vehicleOptionValues:
      stored.vehicleOptionValues ?? fallback.vehicleOptionValues,
    seatCoverParts: stored.seatCoverParts ?? fallback.seatCoverParts,
    seatCoverCodes: stored.seatCoverCodes ?? fallback.seatCoverCodes,
    seatCoverCodeOptionValues:
      stored.seatCoverCodeOptionValues ?? fallback.seatCoverCodeOptionValues,
    masterProducts: stored.masterProducts ?? fallback.masterProducts,
    masterProductSkus: stored.masterProductSkus ?? fallback.masterProductSkus,
    masterProductPackagings:
      stored.masterProductPackagings ?? fallback.masterProductPackagings,
    registrations: stored.registrations ?? fallback.registrations,
    registrationItems: stored.registrationItems ?? fallback.registrationItems,
    sampleRequests,
    sampleRequestItems: sampleRequestItems.map(migrateSampleInspection),
    sampleShipments,
    uniqueVehicles: (stored.uniqueVehicles ?? fallback.uniqueVehicles).map(
      (vehicle) => {
        const legacy = vehicle as LegacyUniqueVehicle;
        return {
          ...vehicle,
          vehicleResearchId: nonEmptyId(
            vehicle.vehicleResearchId,
            legacy.configurationId,
          ),
          projectGroupId: nonEmptyId(vehicle.projectGroupId, legacy.project),
        };
      },
    ),
    projectDetails,
    // Browsers that saved before assignments were seeded hold an empty list; give them the demo ones.
    shapeAssignments: stored.shapeAssignments?.length
      ? stored.shapeAssignments
      : fallback.shapeAssignments,
    fitmentQualities: stored.fitmentQualities ?? [],
    approvalRequests: stored.approvalRequests ?? [],
    approvalSteps: stored.approvalSteps ?? [],
    approvalAssignments: stored.approvalAssignments ?? [],
    // Browsers that saved before grants were seeded hold an empty list; give them the demo grants.
    approvalGrants: [
      ...(stored.approvalGrants ?? []),
      ...fallback.approvalGrants.filter(
        (grant) =>
          !stored.approvalGrants?.some(
            (row) =>
              row.approvalTypeId === grant.approvalTypeId &&
              row.appUserId === grant.appUserId,
          ),
      ),
    ],
    // Seed types and grants the stored snapshot has never seen (new approval types).
    approvalTypes: [
      ...(stored.approvalTypes ?? []),
      ...fallback.approvalTypes.filter(
        (type) => !stored.approvalTypes?.some((row) => row.id === type.id),
      ),
    ],
  };
}

function resolveState<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === 'function'
    ? (value as (previous: T) => T)(current)
    : value;
}

const WorkbenchContext = createContext<WorkbenchStore | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkbenchState>(loadState);
  const [storageMessage, setStorageMessage] = useState(
    'Preparing R&D browser storage',
  );
  const [storageError, setStorageError] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const persisted = useRef<string | null | undefined>(undefined);
  if (persisted.current === undefined) {
    try {
      persisted.current = localStorage.getItem(STORAGE_KEY);
    } catch {
      persisted.current = null;
    }
  }
  const retryPersistence = useCallback(() => {
    setSaveAttempt((attempt) => attempt + 1);
  }, []);
  const exportSnapshot = useCallback(
    () => JSON.stringify(state, null, 2),
    [state],
  );
  const updateWorkbench = useCallback(
    (transform: (state: WorkbenchState) => WorkbenchState) => {
      setState(transform);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setStorageMessage('Saving R&D…');
    async function save() {
      try {
        if (!('locks' in navigator))
          throw new Error('Use HTTPS or localhost to save R&D data.');
        await navigator.locks.request(STORAGE_KEY, () => {
          if (cancelled) return;
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw !== persisted.current)
            throw new Error(
              'R&D data changed in another window. Back up your current work, then refresh the page.',
            );
          // Preserve unreadable storage rather than replacing it with seed data.
          if (raw) {
            JSON.parse(raw);
            localStorage.setItem(STORAGE_KEY + '-previous', raw);
          }
          const next = JSON.stringify(state);
          localStorage.setItem(STORAGE_KEY, next);
          persisted.current = next;
          setStorageError(false);
          setStorageMessage('R&D saved in this browser');
        });
      } catch (cause) {
        if (!cancelled) {
          setStorageError(true);
          setStorageMessage(
            cause instanceof Error
              ? cause.message
              : 'R&D save failed. Current data remains in memory.',
          );
        }
      }
    }
    void save();
    return () => {
      cancelled = true;
    };
  }, [state, saveAttempt]);

  const entitySetter = useCallback(
    <Key extends keyof Omit<WorkbenchState, 'projectDetails'>>(key: Key) =>
      (value: SetStateAction<WorkbenchState[Key]>): void => {
        setState((current) => ({
          ...current,
          [key]: typeof value === 'function' ? value(current[key]) : value,
        }));
      },
    [],
  );

  const setConfigurations = useMemo(
    () => entitySetter('configurations'),
    [entitySetter],
  );
  const setVehicleProductShapes = useMemo(
    () => entitySetter('vehicleProductShapes'),
    [entitySetter],
  );
  const setProjects = useMemo(() => entitySetter('projects'), [entitySetter]);
  const setVisits = useCallback<Dispatch<SetStateAction<readonly Visit[]>>>(
    (value) => {
      setState((current) => {
        const visits = resolveState(value, current.visits);
        const visitStatus = new Map(
          visits.map((visit) => [visit.id, visit.status] as const),
        );
        const projectDetails = Object.fromEntries(
          Object.entries(current.projectDetails).map(([projectId, detail]) => {
            const sharedVisits = visits.filter(
              (visit) => visit.projectGroupId === projectId,
            );
            const detailVisits = detail.visits.map((visit) => {
              const status = visitStatus.get(visit.id);
              const shared = sharedVisits.find((item) => item.id === visit.id);
              return status
                ? {
                    ...visit,
                    ...(shared
                      ? {
                          staffIds: shared.staffIds,
                          scheduledAt: shared.scheduledAt,
                          performedAt: shared.performedAt,
                          projectLinks: shared.projectLinks,
                        }
                      : {}),
                    status,
                    ...(shared?.result ? { result: shared.result } : {}),
                  }
                : visit;
            });
            const missingVisits = sharedVisits
              .filter(
                (visit) =>
                  !detailVisits.some(
                    (detailVisit) => detailVisit.id === visit.id,
                  ),
              )
              .map((visit) => ({
                id: visit.id,
                type: visit.kind,
                dealer: visit.dealer,
                date: visit.date,
                time: visit.time,
                staffIds: visit.staffIds,
                scheduledAt: visit.scheduledAt,
                performedAt: visit.performedAt,
                projectLinks: visit.projectLinks,
                vehicleProjectIds: visit.vehicleProjectIds,
                status: visit.status,
                ...(visit.locationType
                  ? { locationType: visit.locationType }
                  : {}),
                ...(visit.priority ? { priority: visit.priority } : {}),
                ...(visit.note ? { note: visit.note } : {}),
                ...(visit.targetVehicleResearchId
                  ? { targetVehicleResearchId: visit.targetVehicleResearchId }
                  : {}),
                ...(visit.result ? { result: visit.result } : {}),
              }));
            const completedScanZones = new Set(
              sharedVisits
                .filter(
                  (visit) =>
                    visit.kind === 'SCAN' && visit.status === 'COMPLETED',
                )
                .flatMap((visit) => visit.vehicleProjectIds),
            );
            return [
              projectId,
              {
                ...detail,
                visits: [...detailVisits, ...missingVisits],
                zones: detail.zones.map((zone) =>
                  completedScanZones.has(zone.id) &&
                  ['Vehicle Hunt', 'Scan'].includes(zone.currentStage)
                    ? {
                        ...zone,
                        scanned: true,
                        currentStage: 'Design' as const,
                      }
                    : zone,
                ),
              },
            ];
          }),
        );
        return { ...current, visits, projectDetails };
      });
    },
    [],
  );
  const setDealers = useMemo(() => entitySetter('dealers'), [entitySetter]);
  const setComplaints = useMemo(
    () => entitySetter('complaints'),
    [entitySetter],
  );
  const setSampleRequests = useMemo(
    () => entitySetter('sampleRequests'),
    [entitySetter],
  );
  const setSampleRequestItems = useMemo(
    () => entitySetter('sampleRequestItems'),
    [entitySetter],
  );
  const setSampleShipments = useMemo(
    () => entitySetter('sampleShipments'),
    [entitySetter],
  );
  const setUniqueVehicles = useMemo(
    () => entitySetter('uniqueVehicles'),
    [entitySetter],
  );
  const setProductColors = useMemo(
    () => entitySetter('productColors'),
    [entitySetter],
  );
  const setProductMaterials = useMemo(
    () => entitySetter('productMaterials'),
    [entitySetter],
  );
  const setVehicleOptionKeys = useMemo(
    () => entitySetter('vehicleOptionKeys'),
    [entitySetter],
  );
  const setVehicleOptionValues = useMemo(
    () => entitySetter('vehicleOptionValues'),
    [entitySetter],
  );
  const setSeatCoverParts = useMemo(
    () => entitySetter('seatCoverParts'),
    [entitySetter],
  );
  const setSeatCoverCodes = useMemo(
    () => entitySetter('seatCoverCodes'),
    [entitySetter],
  );
  const setSeatCoverCodeOptionValues = useMemo(
    () => entitySetter('seatCoverCodeOptionValues'),
    [entitySetter],
  );
  const setMasterProducts = useMemo(
    () => entitySetter('masterProducts'),
    [entitySetter],
  );
  const setMasterProductSkus = useMemo(
    () => entitySetter('masterProductSkus'),
    [entitySetter],
  );
  const setMasterProductPackagings = useMemo(
    () => entitySetter('masterProductPackagings'),
    [entitySetter],
  );
  const setRegistrations = useMemo(
    () => entitySetter('registrations'),
    [entitySetter],
  );
  const setRegistrationItems = useMemo(
    () => entitySetter('registrationItems'),
    [entitySetter],
  );

  const saveProjectDetail = useCallback(
    (projectId: string, detail: ProjectDetailSnapshot) => {
      const standards = readStageDurationRevisions();
      setState((current) => {
        const next = recordStageTransitions(
          current.projectDetails[projectId],
          detail,
          CURRENT_USER_ID,
          new Date().toISOString(),
          standards,
        );
        return {
          ...current,
          projects: current.projects.map((project) =>
            project.id !== projectId
              ? project
              : {
                  ...project,
                  zoneProjects: project.zoneProjects.map((zone) => {
                    const updated = next.zones.find(
                      (entry) => entry.id === zone.id,
                    );
                    return updated
                      ? {
                          ...zone,
                          stageHistory: updated.stageHistory,
                          lastActivityAt:
                            updated.lastActivityAt ?? zone.lastActivityAt,
                        }
                      : zone;
                  }),
                },
          ),
          projectDetails: {
            ...current.projectDetails,
            [projectId]: next,
          },
        };
      });
    },
    [],
  );

  const updateProjectWorkflow = useCallback(
    (
      projectId: string,
      transform: (detail: ProjectDetailSnapshot) => ProjectDetailSnapshot,
    ) => {
      const standards = readStageDurationRevisions();
      setState((current) => {
        const detail = current.projectDetails[projectId];
        const project = current.projects.find((item) => item.id === projectId);
        if (
          !Object.prototype.hasOwnProperty.call(
            current.projectDetails,
            projectId,
          ) ||
          !project
        )
          return current;
        const next = recordStageTransitions(
          detail,
          transform(detail),
          CURRENT_USER_ID,
          new Date().toISOString(),
          standards,
        );
        // Do not introduce a second development owner for a Shape. Existing
        // ambiguous legacy links remain visible until deliberately corrected.
        if (
          next.zones.some(
            (zone) =>
              zone.productShapeId &&
              zone.productShapeId !==
                detail.zones.find((old) => old.id === zone.id)
                  ?.productShapeId &&
              (next.zones.some(
                (other) =>
                  other.id !== zone.id &&
                  other.productShapeId === zone.productShapeId,
              ) ||
                current.projects.some(
                  (other) =>
                    other.id !== projectId &&
                    other.zoneProjects.some(
                      (linked) => linked.productShapeId === zone.productShapeId,
                    ),
                )),
          )
        )
          return current;
        const zones = project.zoneProjects.map((zone) => {
          const updated = next.zones.find((item) => item.id === zone.id);
          return updated ? { ...zone, ...updated } : zone;
        });
        const summary = summarizeGroupStage(project.product, zones);
        return {
          ...current,
          projectDetails: {
            ...current.projectDetails,
            [projectId]: { ...next, stage: summary.currentStage },
          },
          projects: current.projects.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  zoneProjects: zones,
                  stage: summary.currentStage,
                  status: summary.isComplete ? 'APPROVED' : 'IN PROGRESS',
                }
              : item,
          ),
        };
      });
    },
    [],
  );

  const resetWorkbench = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    persisted.current = null;
    setState(initialState());
  }, []);

  const value = useMemo<WorkbenchStore>(
    () => ({
      ...state,
      storageMessage,
      storageError,
      retryPersistence,
      exportSnapshot,
      updateWorkbench,
      setConfigurations,
      setProjects,
      setVehicleProductShapes,
      setVisits,
      setDealers,
      setComplaints,
      setSampleRequests,
      setSampleRequestItems,
      setSampleShipments,
      setUniqueVehicles,
      setProductColors,
      setProductMaterials,
      setVehicleOptionKeys,
      setVehicleOptionValues,
      setSeatCoverParts,
      setSeatCoverCodes,
      setSeatCoverCodeOptionValues,
      setMasterProducts,
      setMasterProductSkus,
      setMasterProductPackagings,
      setRegistrations,
      setRegistrationItems,
      saveProjectDetail,
      updateProjectWorkflow,
      resetWorkbench,
    }),
    [
      storageMessage,
      storageError,
      retryPersistence,
      exportSnapshot,
      saveProjectDetail,
      updateProjectWorkflow,
      setComplaints,
      setConfigurations,
      setDealers,
      setMasterProductPackagings,
      setMasterProducts,
      setMasterProductSkus,
      setProductColors,
      setProductMaterials,
      setProjects,
      setVehicleProductShapes,
      setRegistrationItems,
      setSeatCoverCodeOptionValues,
      setSeatCoverCodes,
      setSeatCoverParts,
      setVehicleOptionKeys,
      setVehicleOptionValues,
      setRegistrations,
      setSampleRequests,
      setSampleRequestItems,
      setSampleShipments,
      setUniqueVehicles,
      setVisits,
      state,
      updateWorkbench,
      resetWorkbench,
    ],
  );

  return (
    <WorkbenchContext.Provider value={value}>
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbenchStore(): WorkbenchStore {
  const store = useContext(WorkbenchContext);
  if (!store) {
    throw new Error('useWorkbenchStore must be used inside WorkbenchProvider');
  }
  return store;
}
