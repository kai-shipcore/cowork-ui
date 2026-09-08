export type ProductType = 'Seat Cover' | 'Car Cover' | 'Floor Mat';

export type StatusTone =
  'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'purple' | 'cyan';

export interface VehicleConfiguration {
  id: string;
  vehicle: string;
  vehicleClass: string;
  options: ReadonlyArray<readonly [string, string]>;
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
  status?: 'ACTIVE' | 'ON_HOLD' | 'CANCELLED';
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  targetAt?: string;
  lastActivityAt?: string;
  productShapeId?: string;
  adoptedProjectId?: string;
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
 * `master_product` joined with its `vehicle_cover_product` 1:1 child.
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
 * `registration_item_x_vehicle_project` links. `masterProductId` is unique
 * across all items, so a product can never be registered twice.
 */
export interface VehicleProductRegistrationItem {
  id: string;
  registrationId: string;
  masterProductId: string;
  /** Zone projects that justify this product. */
  vehicleProjectIds: readonly string[];
  note?: string;
}

/**
 * `vehicle_product_shape` — one physical pattern, identified by the size
 * chart's code (`F-10`, `CN-M`, `S1-TT-SI03`). This name IS the SKU's size
 * segment; Car Cover splits it at the first hyphen around the material.
 *
 * The DDL table carries id / product_type_id / name / lifecycle status.
 * `dimensions` is the optional `vehicle_product_shape_dimension` satellite;
 * source/adoption fields are a UI read model of `vehicle_project`.
 */
export interface VehicleProductShape {
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
  options: ReadonlyArray<readonly [string, string]>;
  product: ProductType;
  zoneProjects: readonly VehicleZoneProject[];
  stage: string;
  status: 'IN PROGRESS' | 'APPROVED' | 'PENDING';
  created: string;
}

export interface Visit {
  id: string;
  vehicle: string;
  projectGroupId: string;
  product: ProductType;
  vehicleProjectIds: readonly string[];
  dealer: string;
  date: string;
  time: string;
  /**
   * Tasks this visit carries out. The visit has no assignee of its own — the
   * people going are the assignees of these tasks, which is why
   * `field_visit` carries no assignee column.
   */
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
  note?: string;
  sampleReceivedAt?: string;
  sampleShipmentId?: string;
}

/** `sample_shipment` — a physical outbound that can carry many request lines. */
export interface SampleShipment {
  id: string;
  factory: string;
  sampleReadyAt?: string;
  shippedAt?: string;
  expectedArrivalDate?: string;
  arrivedAt?: string;
  shipmentReference?: string;
  note?: string;
}

export interface UniqueVehicle {
  fNumber: string;
  vehicle: string;
  product: ProductType;
  vehicleResearchId: string;
  options: ReadonlyArray<readonly [string, string]>;
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
  id: string;
  type: 'SCAN' | 'FITTING';
  dealer: string;
  date: string;
  time: string;
  vehicleProjectIds: readonly string[];
  /**
   * Tasks this visit carries out. Work is designated as a task first, then a
   * visit schedules where and when it happens, so one visit can close several
   * tasks at once — and the visit's assignees ARE these tasks' assignees, so
   * the visit stores no assignee of its own. Optional because snapshots
   * persisted before this field existed do not carry it.
   */
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
  revisionNumber: number;
  note: string;
  createdBy: string;
  createdAt: string;
  sampleApprovedAt?: string;
  sampleApprovedBy?: string;
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

export interface ProjectSample {
  id: string;
  factory: string;
  items: number;
  round: number;
  status: 'REQUESTED' | 'SHIPPED' | 'ARRIVED' | 'APPROVED';
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
