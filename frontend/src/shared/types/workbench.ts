import type { ProjectStageRecord } from './db-workflow';

export type ProductType =
  | 'Seat Cover'
  | 'Car Cover'
  | 'Floor Mat'
  | 'Steering Wheel Cover'
  | 'Window Shield';

export type StatusTone =
  'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'purple' | 'cyan';

export interface VehicleConfiguration {
  id: string;
  productTypeId?: ProductTypeId;
  vehicleModelId?: string;
  yearStart?: number;
  yearEnd?: number;
  status?: 'ACTIVE' | 'ON_HOLD' | 'REJECTED';
  optionValueIds?: readonly string[];
  vehicle: string;
  vehicleClass: string;
  options: readonly (readonly [string, string])[];
  researchStatus: 'RESEARCHING' | 'COMPLETE';
  projectGroupIds: readonly string[];
}

export interface VehicleZoneProject {
  id: string;
  projectGroupId: string;
  productTypeId: string;
  vehicleResearchId: string;
  zoneId: string;
  code: string;
  label: string;
  managerId: string;
  currentStage: ProjectStage;
  /** Operational fields belong to the zone project, never to its group. */
  status?: 'ACTIVE' | 'ON_HOLD' | 'CANCELLED' | 'MERGED';
  stageHistory?: readonly ProjectStageRecord[];
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  stageTargetDays?: readonly { stage: string; targetDays: number }[];
  targetAt?: string;
  lastActivityAt?: string;
  productShapeId?: string;
  mergedIntoProjectId?: string;
  /** Local workflow evidence; persisted with the project stage, not the Size master. */
  sizeReview?: ProjectSizeReview;
  productionHandoff?: {
    completedAt: string;
    completedBy: string;
    reference: string;
    evidenceKey: string;
    checklist?: HandoffChecklist;
  };
  handoffChecklist?: HandoffChecklist;
  shapeReviewHistory?: readonly ProjectSizeReview[];
  reworkRequestedAt?: string;
}

export interface HandoffChecklist {
  evidenceKey?: string;
  documents: Record<string, { reference: string; confirmed: boolean }>;
  vehicleConfirmed: boolean;
  projectNumberConfirmed: boolean;
  approvedBy: string;
  approvalConfirmed: boolean;
}

export interface ProjectSizeReview {
  meetingAt?: string;
  participants?: readonly string[];
  approvalMethod?: 'VERBAL';
  rejectionType?: 'DOCUMENT' | 'PATTERN';
  affectedDesignIds?: readonly string[];
  outcome?: 'APPROVED' | 'REJECTED';
  reviewedBy: string;
  reviewedAt: string;
  blueprintReference: string;
  note: string;
  evidenceKey: string;
}

export type ProductShapeStatus = 'IN_DEVELOPMENT' | 'ACTIVE' | 'RETIRED';

export interface ProductShapeDimension {
  length: number;
  frontWidth?: number;
  backWidth?: number;
  height: number;
  unit: 'CM' | 'IN';
}

export const PRODUCT_TYPES = [
  { id: 'PT-SC', product: 'Seat Cover' },
  { id: 'PT-CC', product: 'Car Cover' },
  { id: 'PT-FM', product: 'Floor Mat' },
  { id: 'PT-SWC', product: 'Steering Wheel Cover' },
  { id: 'PT-WS', product: 'Window Shield' },
] as const;

export type ProductTypeId = (typeof PRODUCT_TYPES)[number]['id'];

/**
 * A `product_color` or `product_material` row. Both tables carry the same
 * shape; the collection they live in is what distinguishes them. `code` feeds
 * the generated SKU, so it is unique per product type.
 */
export interface ProductReferenceItem {
  id: string;
  productTypeId: ProductTypeId;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `app_user` — an internal staff account, the actor behind project
 * ownership, task assignment and activity. Deactivated via status,
 * never deleted.
 */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** Rendered into pattern names; NULL when not a designer. */
  designerInitial?: string;
  createdAt: string;
  updatedAt: string;
}

/** `vehicle_zone` — which part of the vehicle a product covers. */
export interface VehicleZone {
  id: string;
  productTypeId: ProductTypeId;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `vehicle_option_key` — the option dictionary's keys, scoped per product
 * type. Untitled charts (Car Cover) use one generic `Submodel` key.
 */
export interface VehicleOptionKey {
  id: string;
  productTypeId: ProductTypeId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** `vehicle_option_value` — the possible values of one option key. */
export interface VehicleOptionValue {
  id: string;
  vehicleOptionKeyId: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `seat_cover_part` — a seat cover pattern part kind (FA, FH, FMB, ...).
 *
 * `isCustom: false` is the closed legacy set of universal one-pattern-fits-many
 * parts; those rows carry `vehicleProductDesignId` because the part IS its own
 * pattern. New rows are always custom.
 */
export interface SeatCoverPart {
  id: string;
  name: string;
  description?: string;
  vehicleZoneId: string;
  /** Which piece of the seat (ARM, BOTTOM, HEADREST, ...); open-ended. */
  category: string;
  isForMiddleSeat: boolean;
  isCustom: boolean;
  vehicleProductDesignId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

/**
 * `seat_cover_code` — a seat style code (424BEN, 46BENMEG, ...), deliberately
 * year-free. A different code space from `vehicle_product_shape.name`.
 */
export interface SeatCoverCode {
  id: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

/**
 * `seat_cover_code_x_option_value` — the option values a seat style code
 * encodes, so a code can be suggested from a research vehicle's options.
 */
export interface SeatCoverCodeOptionValue {
  id: string;
  seatCoverCodeId: string;
  vehicleOptionValueId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * SKU colour-type segment (`1TO` 1-tone, `STI` stitch only, `STR` stripe).
 *
 * NOT a database concept: `product_color` and `product_material` carry only
 * code and name. The colour-type grouping, and which materials allow which
 * types, come from the "SKU Format" document and live as constants in
 * `modules/product-registry/sku-format.ts`.
 */
export type ColorType = '1TO' | 'STI' | 'STR';

export type MasterProductStatus =
  'DRAFT' | 'ACTIVE' | 'CLOSEOUT' | 'DISCONTINUED';

/**
 * `master_product` joined with its `vehicle_product` 1:1 child.
 *
 * The shape columns are the product's identity: either `exterior` alone, or
 * one to three of front / rear / third row. One filled = a row-level product,
 * several = a pre-packed set. SKU segments are rendered from the shapes'
 * names and never parsed back out of the sku string.
 */
export interface MasterProduct {
  id: string;
  productTypeId: ProductTypeId;
  sku: string;
  status: MasterProductStatus;
  productMaterialId: string;
  productColorId: string;
  exteriorShapeId?: string;
  frontShapeId?: string;
  rearShapeId?: string;
  thirdRowShapeId?: string;
  vehicleProductDesignId?: string;
  /** F# of the unique vehicle this product was registered for. */
  fNumber: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `master_product_sku` — effective-dated SKU history. Renaming a SKU issues a
 * new row and closes the previous one; rows are never edited in place.
 */
export interface MasterProductSku {
  id: string;
  masterProductId: string;
  sku: string;
  validFrom: string;
  validTo?: string;
  note?: string;
}

/** `master_product_packaging` — effective-dated packaging spec history. */
export interface MasterProductPackaging {
  id: string;
  masterProductId: string;
  length: number;
  width: number;
  height: number;
  dimensionUnit: string;
  weight: number;
  weightUnit: string;
  validFrom: string;
  validTo?: string;
}

/**
 * `vehicle_product_registration` — a batch request to register products.
 * Approval is per registration, not per item, and there is no reject state: a
 * request that should not proceed is deleted while still pending.
 */
export interface VehicleProductRegistration {
  id: string;
  requestedBy: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  note?: string;
}

/**
 * `vehicle_product_registration_item` plus its
 * `registration_item_x_vehicle_product_shape` links. `masterProductId` is unique
 * across all items, so a product can never be registered twice.
 */
export interface VehicleProductRegistrationItem {
  id: string;
  registrationId: string;
  masterProductId: string;
  /** Zone projects that justify this product. */
  vehicleProjectIds: readonly string[];
  /** registration_item_x_vehicle_product_shape; legacy project IDs are read-only. */
  sourceShapeIds?: readonly string[];
  note?: string;
}

/**
 * `vehicle_product_shape` — the final approved Size, identified by the size
 * chart's code (`F-10`, `CN-M`, `S1-TT-SI03`). This name IS the SKU's size
 * segment; Car Cover splits it at the first hyphen around the material.
 *
 * The DDL table carries id / product_type_id / name / lifecycle status.
 * `dimensions` is the optional `vehicle_product_shape_dimension` satellite;
 * source/adoption and global fitting fields are legacy UI compatibility data,
 * never project references or evidence of current project approval.
 */
export interface VehicleProductShape {
  composition?: {
    sourceProjectId: string;
    sourceZoneId: string;
    parts: readonly {
      designId: string;
      partId?: string;
      name: string;
      revisionId: string;
      revisionNumber: number;
      quantity: number;
    }[];
    blueprintUrl: string;
    status: 'DRAFT' | 'COMPLETE';
    updatedAt: string;
    updatedBy: string;
  };
  id: string;
  productTypeId: string;
  name: string;
  status: ProductShapeStatus;
  source: 'NEW' | 'ADOPTED';
  /** Present for product families with shape-level dimensions (currently CC). */
  dimensions?: ProductShapeDimension;
  sourceAssetId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  note?: string;
  adoptedFromShapeId?: string;
  fittingConfirmedBy?: string;
  fittingConfirmedAt?: string;
}

export interface VehicleProjectGroup {
  id: string;
  productTypeId: string;
  vehicle: string;
  vehicleResearchId: string;
  fNumber?: string;
  options: readonly (readonly [string, string])[];
  product: ProductType;
  zoneProjects: readonly VehicleZoneProject[];
  stage: string;
  status: 'IN PROGRESS' | 'APPROVED' | 'PENDING';
  created: string;
}

export interface FieldVisitProjectLink {
  id: string;
  fieldVisitId: string;
  vehicleProjectId: string;
  type: 'SCAN' | 'FITTING';
  targetVehicleResearchId?: string;
  result?: 'PASS' | 'FAIL';
  note?: string;
}

export interface Visit {
  /** app_user IDs represented by field_visit_staff. */
  staffIds?: readonly string[];
  scheduledAt?: string;
  performedAt?: string;
  /** Direct field_visit_x_vehicle_project associations. */
  projectLinks?: readonly FieldVisitProjectLink[];

  id: string;
  vehicle: string;
  projectGroupId: string;
  product: ProductType;
  vehicleProjectIds: readonly string[];
  dealer: string;
  date: string;
  time: string;
  /** @deprecated Only retained to migrate older browser snapshots. */
  taskIds: readonly string[];
  kind: 'SCAN' | 'FITTING';
  status: 'SCHEDULED' | 'COMPLETED';
  locationType?:
    'DEALERSHIP' | 'OWNER_VEHICLE' | 'OFFICE' | 'FACTORY' | 'OTHER';
  priority?: 'URGENT' | 'NORMAL';
  note?: string;
  targetVehicleResearchId?: string;
  result?: 'PASS' | 'FAIL';
}

export interface Dealer {
  id: string;
  name: string;
  brand: string;
  type: 'Dealer' | 'Rental' | 'Partner';
  address: string;
  contact: string;
  note: string;
  lastVisit: string;
}

export interface Complaint {
  id: string;
  fNumber: string;
  vehicle: string;
  product: ProductType;
  issue: string;
  design: string;
  revision: string;
  reported: string;
  owner: string;
  status: 'OPEN' | 'REWORK' | 'RESOLVED';
}

export interface SampleRequest {
  id: string;
  projectGroupId: string;
  vehicle: string;
  product: ProductType;
  factory: string;
  note?: string;
  sentAt?: string;
  sentBy?: string;
  createdAt: string;
}

/** `sample_request_item` — one design revision and one globally unique round. */
export interface SampleRequestItem {
  id: string;
  sampleRequestId: string;
  vehicleProductDesignId: string;
  vehicleProductDesignRevisionId: string;
  sampleRound: number;
  priority: 'URGENT' | 'NORMAL';
  /** Sample Tracking "Note" for this part. */
  note?: string;
  sampleReceivedAt?: string;
  sampleShipmentId?: string;
  revisionReflected?: 'CORRECT' | 'PARTIAL' | 'NOT_REFLECTED';
  productionStartedAt?: string;
  drawingMatch?: boolean;
  inspectedAt?: string;
  inspectedBy?: string;
  inspectionNote?: string;
  verificationNote?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  issueSource?: 'DESIGN' | 'FACTORY';
}

/** `sample_shipment` — a physical outbound that can carry many request lines. */
export interface SampleShipment {
  id: string;
  factory: string;
  sampleReadyAt?: string;
  shippedAt?: string;
  expectedArrivalDate?: string;
  arrivedAt?: string;
  /** Carrier tracking number or factory dispatch reference. */
  externalReference?: string;
  note?: string;
}

/** What the operator records when a shipment is created; the rest is system-set. */
export type SampleShipmentDetails = Pick<
  SampleShipment,
  | 'sampleReadyAt'
  | 'shippedAt'
  | 'expectedArrivalDate'
  | 'externalReference'
  | 'note'
>;

export interface UniqueVehicle {
  id?: string;
  productTypeId?: ProductTypeId;
  vehicleModelId?: string;
  yearStart?: number;
  yearEnd?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED';
  optionValueIds?: readonly string[];
  optionHash?: string;
  fNumber: string;
  vehicle: string;
  product: ProductType;
  vehicleResearchId: string;
  options: readonly (readonly [string, string])[];
  projectGroupId: string;
  shapes: readonly string[];
  skuStatus: 'DRAFT' | 'REQUESTED' | 'ACTIVE';
}

export type ProjectStage =
  | 'Research'
  | 'Vehicle Hunt'
  | 'Scan'
  | '3D Model'
  | 'Fit Review'
  | 'Design'
  | 'Sample'
  | 'Fitting'
  | 'Approved';

export interface ZoneProject extends VehicleZoneProject {
  scanned: boolean;
  /** @deprecated Legacy display value. Use productShape instead. */
  shape?: string;
  productShape?: VehicleProductShape;
}

export type ProjectTaskType =
  'SCAN' | 'FITTING' | 'DESIGN' | 'REVIEW' | 'ADMIN' | 'OTHER';

export interface ProjectTask {
  id: string;
  vehicleProjectId: string;
  type: ProjectTaskType;
  title: string;
  assignedTo?: string;
  assignedAt?: string;
  requestedBy: string;
  created: string;
  closedAt?: string;
  status: 'OPEN' | 'ACCEPTED' | 'DONE' | 'FAILED' | 'CANCELLED';
}

export interface ProjectVisit {
  /** app_user IDs represented by field_visit_staff. */
  staffIds?: readonly string[];
  scheduledAt?: string;
  performedAt?: string;
  /** Direct field_visit_x_vehicle_project associations. */
  projectLinks?: readonly FieldVisitProjectLink[];

  id: string;
  type: 'SCAN' | 'FITTING';
  dealer: string;
  date: string;
  time: string;
  vehicleProjectIds: readonly string[];
  /** @deprecated Only retained to migrate older browser snapshots. */
  taskIds?: readonly string[];
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  locationType?:
    'DEALERSHIP' | 'OWNER_VEHICLE' | 'OFFICE' | 'FACTORY' | 'OTHER';
  priority?: 'URGENT' | 'NORMAL';
  note?: string;
  targetVehicleResearchId?: string;
  /** DDL permits a verdict only for FITTING items. */
  result?: 'PASS' | 'FAIL';
}

export interface ProjectDesign {
  requiresRevisionAfterReview?: boolean;
  libraryPartId?: string;
  libraryRevisionId?: string;
  id: string;
  productTypeId: string;
  vehicleProjectId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  quantity: number;
  details: ProjectDesignDetails;
  revisions: readonly ProjectDesignRevision[];
  fittingConfirmed: boolean;
}

export interface ProjectDesignRevision {
  id: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
  revisionNumber: number;
  note: string;
  createdBy: string;
  createdAt: string;
  sampleApprovedAt?: string;
  sampleApprovedBy?: string;
  /** Content identity is used to block accidentally reusing the old DXF. */
  dxfFileName?: string;
  dxfFingerprint?: string;
  changeRequest?: RevisionChangeRequest;
  executionVerifications?: readonly RevisionExecutionVerification[];
}

export interface RevisionExecutionVerification {
  sampleRequestItemId: string;
  verdict: 'CORRECT' | 'PARTIAL' | 'NOT_REFLECTED';
  note: string;
  verifiedAt: string;
  verifiedBy: string;
  issueSource?: 'FACTORY';
}

export interface RevisionChangeRequest {
  issueSource: string;
  issueArea: string;
  instruction: string;
  referenceImageName: string;
  referenceImageDataUrl?: string;
  previousRevisionId: string;
  previousDxfFileName: string;
  previousDxfFingerprint: string;
  newDxfFileName: string;
  newDxfFingerprint: string;
  designerConfirmed: true;
  confirmedBy: string;
  confirmedAt: string;
}

export type ProjectDesignDetails =
  SeatCoverDesignDetails | CarCoverDesignDetails | FloorMatDesignDetails;

export interface SeatCoverDesignDetails {
  kind: 'SEAT_COVER';
  vehicleResearchId: string;
  seatCoverPartId: string;
  seatCoverCodeId: string;
  partName: string;
  category: string;
  side: 'DRIVER' | 'PASSENGER' | 'CENTER' | 'UNIVERSAL';
  isForMiddleSeat: boolean;
  isCustom: boolean;
  designedBy: string;
}

export interface CarCoverDesignDetails {
  kind: 'CAR_COVER';
  vehicleResearchId: string;
  designedBy: string;
}

export interface FloorMatDesignDetails {
  kind: 'FLOOR_MAT';
  vehicleResearchId: string;
  vehicleZoneId: string;
}

/** One part of a project sample request with its Sample Tracking memo. */
export interface ProjectSampleLine {
  designId: string;
  note?: string;
}

export interface ProjectSample {
  id: string;
  factory: string;
  items: number;
  /** The exact part designs included in this request round. */
  designIds?: readonly string[];
  /** Per-part status and memo; takes precedence over designIds when present. */
  lines?: readonly ProjectSampleLine[];
  round: number;
  status: 'REQUESTED' | 'SHIPPED' | 'ARRIVED' | 'APPROVED';
  /** ISO timestamp of creation; becomes `sample_request.created_at`. */
  requestedAt?: string;
  note?: string;
  /**
   * Recorded at Mark Shipped (details) and Mark Arrived (`arrivedAt`);
   * becomes this request's `sample_shipment`.
   */
  shipment?: SampleShipmentDetails & Pick<SampleShipment, 'arrivedAt'>;
}

export interface ProjectAsset {
  id: string;
  type: 'SCAN' | 'PATTERN FILE' | 'PHOTO' | '3D MODEL' | 'OTHER';
  name: string;
  scope: string;
  addedBy: string;
  date: string;
}

export interface ProjectActivityItem {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
}

export interface ProjectDetailSnapshot {
  stage: ProjectStage;
  zones: readonly ZoneProject[];
  tasks: readonly ProjectTask[];
  visits: readonly ProjectVisit[];
  designs: readonly ProjectDesign[];
  samples: readonly ProjectSample[];
  assets: readonly ProjectAsset[];
  activity: readonly ProjectActivityItem[];
  fNumber?: string;
}
