import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  Activity,
  type ActivityEntry,
} from '@coverland-engineering/ui/activity/activity';
import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
import { Textarea } from '@coverland-engineering/ui/textarea';
import {
  Armchair,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  CarFront,
  ChevronRight,
  FilePlus2,
  History,
  Plus,
  RectangleHorizontal,
  ScanLine,
  Wrench,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { findUser, userName } from '@/shared/domain/app-user';
import { ConfigChips } from '@/shared/domain/config-chips';
import {
  createProjectVisit,
  migrateVisitStaff,
  type NewVisitInput,
} from '@/shared/domain/field-visit';
import { designLabel, hasDesignIdentity } from '@/shared/domain/product-design';
import {
  eligibleProjectIdsForStage,
  PROJECT_PIPELINES,
  projectGateScope,
  summarizeGroupStage,
} from '@/shared/domain/project-stage';
import {
  canApproveRevisionSample,
  fileFingerprint,
  isChangedDxf,
  revisionExecutionAccuracy,
} from '@/shared/domain/revision-control';
import { sampleStatus } from '@/shared/domain/sample-inspection';
import { mergeProjectSampleItem } from '@/shared/domain/sample-item-sync';
import { sampleRoundLabel } from '@/shared/domain/sample-request';
import { UserAvatar, UserPicker } from '@/shared/domain/user-picker';
import { PageTables, type TableRef } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import type {
  ProjectActivityItem as ActivityItem,
  AppUser,
  HandoffChecklist,
  ProjectAsset,
  ProjectDesign,
  ProjectDesignRevision,
  ProjectDetailSnapshot,
  ProjectSample,
  ProjectSampleLine,
  ProjectStage,
  ProjectVisit,
  SampleRequestItem,
  SampleShipmentDetails,
  SeatCoverCode,
  SeatCoverPart,
  UniqueVehicle,
  VehicleConfiguration,
  VehicleProjectGroup,
  Visit,
  ZoneProject,
} from '@/shared/types/workbench';
import { importProjectParts } from '@/modules/parts/part-library';
import { PartLinkDialog } from '@/modules/parts/part-link-dialog';
import {
  handoffBlockers,
  handoffReady,
  sizeReviewEvidence,
} from '@/modules/product-shapes/shape-model';
import { InspectionDialog } from '@/modules/sampling/inspection-dialog';
import { InspectionResult } from '@/modules/sampling/inspection-result';
import { ShipmentDialog } from '@/modules/sampling/shipment-dialog';
import { ShipmentSummary } from '@/modules/sampling/shipment-summary';
import { CURRENT_USER_ID } from '@/app/current-user';
import { SEED_SCAN_VISIT_DATE } from '@/app/workbench-mock-data';
import { isLegacySeedActivity, useWorkbenchStore } from '@/app/workbench-store';
import {
  emptyHandoffChecklist,
  fillTestHandoffChecklist,
  HANDOFF_DOCUMENTS,
  handoffChecklistErrors,
  prepareHandoffChecklist,
} from '../handoff-checklist';
import { getSampleGate, type SampleGate } from '../sample-gate';
import { defaultVisitType, visitHistory } from '../visit-history';
import { HandoffChecklistForm } from './handoff-checklist-form';
import { StageTimingSummary } from './stage-timing-summary';
import './project-visits.css';
import '@/modules/product-shapes/shape-management.css';

const FIXED_DETAIL_TABS = [
  'overview',
  'designs',
  'revisions',
  'samples',
  'files',
  'visits',
  'activity',
] as const;

type DetailTab = (typeof FIXED_DETAIL_TABS)[number];

/** Narrows an untrusted value (a URL query parameter) to a deep-linkable tab. */
export function toDetailTab(value: string | null): DetailTab | undefined {
  if (value === 'tasks') return 'visits';
  if (value === 'shapes') return 'overview';
  return FIXED_DETAIL_TABS.find((tab) => tab === value);
}

type DialogName =
  | 'new-configuration'
  | 'design'
  | 'revision'
  | 'visit'
  | 'sample'
  | 'file'
  | 'promote';

interface ProjectDetailViewProps {
  /** The group is the data container; the view shows one of its zone projects. */
  project: VehicleProjectGroup;
  /** Zone project to show. Falls back to the group's first zone project. */
  zoneCode?: string;
  onBack: () => void;
  onSelectZone: (zoneCode: string) => void;
  /** Tab to open on mount, for deep links from other screens. */
  initialTab?: DetailTab;
}

interface NewSampleInput {
  factory: string;
  note: string;
  lines: readonly ProjectSampleLine[];
}

interface NewDesignInput {
  vehicleProjectId: string;
  name: string;
  quantity: number;
  details: ProjectDesign['details'];
  revisionNote: string;
  revisionCreatedBy: string;
  dxfFileName: string;
  dxfFingerprint: string;
}

const DEALERS = [
  'Galpin Ford',
  'AutoNation Toyota Cerritos',
  'Enterprise Rent-A-Car',
  'LA Auto Partner',
] as const;
const FACTORIES = ['Tianhong', 'Ningbo Ruixin', 'Qingdao TX'] as const;
/** Tables the zone project detail reads or writes, grouped by tab. */
const DETAIL_TABLES: readonly TableRef[] = [
  { name: 'vehicle_project_group' },
  { name: 'vehicle_project' },
  { name: 'vehicle_project_stage_template' },
  { name: 'vehicle_project_stage' },
  { name: 'vehicle_zone' },
  { name: 'vehicle_product_shape' },
  { name: 'app_user' },
  { name: 'field_visit' },
  { name: 'field_visit_x_vehicle_project' },
  { name: 'dealership' },
  { name: 'project_x_product_design_item' },
  { name: 'vehicle_product_design' },
  { name: 'vehicle_product_design_revision' },
  { name: 'seat_cover_design' },
  { name: 'seat_cover_part' },
  { name: 'seat_cover_code' },
  { name: 'sample_request' },
  { name: 'sample_request_item' },
  { name: 'sample_shipment' },
  { name: 'asset' },
  { name: 'activity' },
];
const DESIGNERS = [
  { id: 'USR-JH', name: 'JH' },
  { id: 'USR-KAI', name: 'Kai' },
  { id: 'USR-YOUNG', name: 'Young' },
  { id: 'USR-CHRISTIAN', name: 'Christian' },
] as const;

function currentRevision(design: ProjectDesign) {
  return design.revisions.reduce((latest, revision) =>
    revision.revisionNumber > latest.revisionNumber ? revision : latest,
  );
}

function isRevisionSampleRequestable(
  design: ProjectDesign,
  sampleItems: readonly SampleRequestItem[],
): boolean {
  if (design.requiresRevisionAfterReview) return false;
  const revision = currentRevision(design);
  if (
    !sampleItems.some(
      (item) =>
        item.vehicleProductDesignId === design.id &&
        item.vehicleProductDesignRevisionId === revision.id,
    )
  )
    return true;
  if (!revision.changeRequest) return false;
  const latest = sampleItems
    .filter((item) => item.vehicleProductDesignRevisionId === revision.id)
    .sort((left, right) => right.sampleRound - left.sampleRound)
    .slice(0, 1)
    .pop();
  return (
    !latest ||
    latest.revisionReflected === 'PARTIAL' ||
    latest.revisionReflected === 'NOT_REFLECTED'
  );
}

function isSampleApproved(design: ProjectDesign): boolean {
  return Boolean(currentRevision(design).sampleApprovedAt);
}

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else
        reject(new Error('The selected file could not be read as a data URL.'));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('The selected file could not be read.'));
    });
    reader.readAsDataURL(file);
  });
}

function zoneLabel(
  product: VehicleProjectGroup['product'],
  zone: string,
): string {
  if (product === 'Car Cover') {
    return 'Exterior';
  }
  const labels: Record<string, string> = {
    F: product === 'Floor Mat' ? '1st Row' : 'Front Row',
    B: '2nd Row',
    E: '3rd Row',
  };
  return labels[zone] ?? zone;
}

/**
 * Whether the project's declared stage is already past scanning.
 *
 * `vehicle_project.current_stage` is the only record of this: the DDL folded
 * the old `scan_skipped` column into it, so a pipeline with no 'Scan' stage
 * (Car Cover works from a purchased 3D model) needs no scan at all, and any
 * later stage means the scan is behind us.
 */
function isPastScanStage(
  product: VehicleProjectGroup['product'],
  stage: VehicleProjectGroup['stage'],
): boolean {
  const pipeline: readonly string[] = PROJECT_PIPELINES[product];
  const scanIndex = pipeline.indexOf('Scan');
  return scanIndex < 0 || pipeline.indexOf(stage) > scanIndex;
}

function initialZones(project: VehicleProjectGroup): readonly ZoneProject[] {
  return project.zoneProjects.map((zoneProject, index) => ({
    ...zoneProject,
    label: zoneProject.label || zoneLabel(project.product, zoneProject.code),
    scanned: isPastScanStage(project.product, zoneProject.currentStage),
    ...(index === 0 && zoneProject.currentStage === 'Scan'
      ? { scanned: false }
      : {}),
  }));
}

/** Reads display-only labels from legacy snapshots until a productShape is assigned. */
function legacyShapeName(value: unknown): string | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'shape' in value &&
    typeof value.shape === 'string'
  ) {
    return value.shape;
  }
  return undefined;
}

/**
 * Rebuilds the zone list from the project's own zone projects, layering the
 * persisted per-zone flags on top. A saved snapshot is untrusted localStorage
 * data: it can predate a zone-id change or miss fields the render path needs
 * (`code`, `label`), and a zone that no longer exists must not survive.
 */
function mergeSavedZones(
  project: VehicleProjectGroup,
  savedZones: readonly Partial<ZoneProject>[] | undefined,
): readonly ZoneProject[] {
  const base = initialZones(project);
  if (!savedZones?.length) {
    return base;
  }
  const savedById = new Map(savedZones.map((zone) => [zone.id, zone]));
  const savedByCode = new Map(savedZones.map((zone) => [zone.code, zone]));
  return base.map((zone) => {
    const saved = savedById.get(zone.id) ?? savedByCode.get(zone.code);
    return saved
      ? {
          ...zone,
          currentStage: saved.currentStage ?? zone.currentStage,
          scanned: saved.scanned ?? zone.scanned,
          shape:
            saved.productShape?.name ??
            legacyShapeName(saved) ??
            legacyShapeName(zone),
          productShape: saved.productShape ?? zone.productShape,
          productShapeId:
            saved.productShape?.id ??
            saved.productShapeId ??
            zone.productShapeId,
          sizeReview: saved.sizeReview ?? zone.sizeReview,
          productionHandoff: saved.productionHandoff ?? zone.productionHandoff,
          handoffChecklist: saved.handoffChecklist ?? zone.handoffChecklist,
          shapeReviewHistory:
            saved.shapeReviewHistory ?? zone.shapeReviewHistory,
          reworkRequestedAt: saved.reworkRequestedAt ?? zone.reworkRequestedAt,
        }
      : zone;
  });
}

function initialVisits(project: VehicleProjectGroup): readonly ProjectVisit[] {
  if (project.id !== 'PG-00124') {
    return [];
  }
  return [
    {
      id: 'VS-01',
      type: 'SCAN',
      dealer: 'Galpin Ford',
      date: SEED_SCAN_VISIT_DATE,
      time: '10:00',
      vehicleProjectIds: project.zoneProjects
        .slice(0, 1)
        .map((item) => item.id),
      staffIds: ['USR-YOUNG'],
      status: 'SCHEDULED',
    },
  ];
}

function initialDesigns(
  project: VehicleProjectGroup,
): readonly ProjectDesign[] {
  if (
    project.product !== 'Seat Cover' ||
    !project.zoneProjects.some(
      (zoneProject) => zoneProject.currentStage === 'Design',
    )
  ) {
    return [];
  }
  const firstProjectId = project.zoneProjects[0]?.id ?? '';
  return [
    {
      id: 'DS-001',
      productTypeId: project.productTypeId,
      vehicleProjectId: firstProjectId,
      name: 'FH-J-D',
      status: 'ACTIVE',
      quantity: 1,
      details: {
        kind: 'SEAT_COVER',
        vehicleResearchId: project.vehicleResearchId,
        seatCoverPartId: 'PART-FRONT-HEADREST',
        seatCoverCodeId: 'SCC-BUCKET-01',
        partName: 'Front Headrest',
        category: 'HEADREST',
        side: 'UNIVERSAL',
        isForMiddleSeat: false,
        isCustom: false,
        designedBy: 'USR-JH',
      },
      revisions: [
        {
          id: 'REV-DS-001-1',
          revisionNumber: 1,
          note: 'Initial drawing',
          createdBy: 'USR-JH',
          createdAt: '2026-08-20T09:00:00-07:00',
        },
      ],
      fittingConfirmed: false,
    },
  ];
}

/** Full mock Project Group workspace modeled after the planning prototype. */
export function ProjectDetailView({
  project,
  zoneCode,
  onBack,
  onSelectZone,
  initialTab,
}: ProjectDetailViewProps) {
  const [partParams, setPartParams] = useSearchParams();
  const navigate = useNavigate();
  const [linkZone, setLinkZone] = useState<string>();
  const {
    vehicleProductShapes,
    projectDetails,
    saveProjectDetail,
    setProjects,
    visits: sharedVisitRecords,
    setVisits: setSharedVisits,
    sampleRequests: sharedSampleRequests,
    setSampleRequests,
    sampleRequestItems: sharedSampleRequestItems,
    sampleShipments: sharedSampleShipments,
    setSampleRequestItems,
    setSampleShipments,
    setUniqueVehicles,
    seatCoverParts,
    seatCoverCodes,
    appUsers,
    configurations,
  } = useWorkbenchStore();
  const savedDetail = new Map(Object.entries(projectDetails)).get(project.id);
  const activeUsers = appUsers.filter((user) => user.status === 'ACTIVE');
  const visitsFromSharedStore: readonly ProjectVisit[] = sharedVisitRecords
    .filter((visit) => visit.projectGroupId === project.id)
    .map((visit) => ({
      id: visit.id,
      type: visit.kind,
      dealer: visit.dealer,
      date: visit.date,
      time: visit.time,
      staffIds: migrateVisitStaff(visit, savedDetail?.tasks ?? []),
      scheduledAt: visit.scheduledAt,
      performedAt: visit.performedAt,
      projectLinks: visit.projectLinks,
      vehicleProjectIds: visit.vehicleProjectIds,
      status: visit.status,
      ...(visit.locationType ? { locationType: visit.locationType } : {}),
      ...(visit.priority ? { priority: visit.priority } : {}),
      ...(visit.note ? { note: visit.note } : {}),
      ...(visit.targetVehicleResearchId
        ? { targetVehicleResearchId: visit.targetVehicleResearchId }
        : {}),
      ...(visit.result ? { result: visit.result } : {}),
    }));
  // The shared store decides how far a request got (Sample Tracker can move
  // it too); the saved snapshot keeps what only this screen records (lines,
  // note, APPROVED) and the shipment row holds the recorded dates.
  const samplesFromSharedStore: readonly ProjectSample[] = sharedSampleRequests
    .filter((request) => request.projectGroupId === project.id)
    .map((request) => {
      const saved = savedDetail?.samples.find(
        (sample) => sample.id === request.id,
      );
      const items = sharedSampleRequestItems.filter(
        (item) => item.sampleRequestId === request.id,
      );
      const shipments = sharedSampleShipments.filter((shipment) =>
        items.some((item) => item.sampleShipmentId === shipment.id),
      );
      const allReceived =
        items.length > 0 && items.every((item) => item.sampleReceivedAt);
      const anyShipped = shipments.some((shipment) => shipment.shippedAt);
      const derivedStatus: ProjectSample['status'] = allReceived
        ? 'ARRIVED'
        : anyShipped
          ? 'SHIPPED'
          : 'REQUESTED';
      const status =
        saved &&
        SAMPLE_STATUS_ORDER.indexOf(saved.status) >
          SAMPLE_STATUS_ORDER.indexOf(derivedStatus)
          ? saved.status
          : derivedStatus;
      // Dates the shared shipment row has win; anything it lacks (an arrival
      // stamped here before the row caught up) stays from the snapshot.
      const shipment = shipments.slice(0, 1).pop();
      const recorded: NonNullable<ProjectSample['shipment']> = {
        ...(saved?.shipment ?? {}),
        ...(shipment?.sampleReadyAt
          ? { sampleReadyAt: shipment.sampleReadyAt }
          : {}),
        ...(shipment?.shippedAt ? { shippedAt: shipment.shippedAt } : {}),
        ...(shipment?.expectedArrivalDate
          ? { expectedArrivalDate: shipment.expectedArrivalDate }
          : {}),
        ...(shipment?.externalReference
          ? { externalReference: shipment.externalReference }
          : {}),
        ...(shipment?.note ? { note: shipment.note } : {}),
        ...(shipment?.arrivedAt ? { arrivedAt: shipment.arrivedAt } : {}),
      };
      return {
        ...(saved ?? {}),
        id: request.id,
        factory: request.factory,
        designIds: items.map((item) => item.vehicleProductDesignId),
        items: items.length,
        round: Math.max(1, ...items.map((item) => item.sampleRound)),
        status,
        ...(Object.keys(recorded).length ? { shipment: recorded } : {}),
      };
    });
  const completedSharedScanZones = new Set(
    sharedVisitRecords
      .filter(
        (visit) =>
          visit.projectGroupId === project.id &&
          visit.kind === 'SCAN' &&
          visit.status === 'COMPLETED',
      )
      .flatMap((visit) => visit.vehicleProjectIds),
  );
  const pipeline = PROJECT_PIPELINES[project.product];
  const initialStage = pipeline.includes(project.stage as ProjectStage)
    ? (project.stage as ProjectStage)
    : pipeline.slice(0, 1).pop();
  // savedDetail comes back from localStorage, so it is untrusted: a snapshot
  // written before this product's pipeline changed can hold a stage that no
  // longer belongs to it. Validate it the same way project.stage is validated.
  const savedStage =
    savedDetail?.stage && pipeline.includes(savedDetail.stage)
      ? savedDetail.stage
      : undefined;
  const [stage, setStage] = useState<ProjectStage>(
    savedStage ?? initialStage ?? 'Research',
  );
  const [activeTab, setActiveTab] = useState<DetailTab>(
    initialTab ?? 'overview',
  );
  const [zoneRecords, setZones] = useState<readonly ZoneProject[]>(() =>
    mergeSavedZones(project, savedDetail?.zones).map((zone) =>
      completedSharedScanZones.has(zone.id) ? { ...zone, scanned: true } : zone,
    ),
  );
  const zones = useMemo(
    () =>
      zoneRecords.map((zone) => ({
        ...zone,
        productShape: vehicleProductShapes.find(
          (shape) => shape.id === zone.productShapeId,
        ),
      })),
    [zoneRecords, vehicleProductShapes],
  );
  const designEligibleProjectIds = eligibleProjectIdsForStage(
    project.product,
    zones,
    'Design',
  );
  const sampleEligibleProjectIds = eligibleProjectIdsForStage(
    project.product,
    zones,
    'Sample',
  );
  const scanEligibleProjectIds = eligibleProjectIdsForStage(
    project.product,
    zones,
    'Scan',
  );
  const fittingEligibleProjectIds = eligibleProjectIdsForStage(
    project.product,
    zones,
    'Fitting',
  );
  // The screen shows one zone project; the group only stores its data. Gates
  // are evaluated for that project and, for Floor Mat F/B, its bundle partner.
  const focusedZone =
    zones.find((zone) => zone.code === zoneCode) ?? zones.slice(0, 1).pop();
  const focusScopeIds = new Set(
    focusedZone
      ? projectGateScope(project.product, zones, focusedZone.id).map(
          (zone) => zone.id,
        )
      : [],
  );
  const focusScope = zones.filter((zone) => focusScopeIds.has(zone.id));
  const focusedStage = focusedZone?.currentStage ?? stage;
  const isFocusEligible = (eligibleProjectIds: readonly string[]) =>
    focusedZone !== undefined && eligibleProjectIds.includes(focusedZone.id);
  const canCreateDesign = isFocusEligible(designEligibleProjectIds);
  const canRequestSample = isFocusEligible(sampleEligibleProjectIds);
  const canScheduleScan = isFocusEligible(scanEligibleProjectIds);
  const canScheduleFitting = isFocusEligible(fittingEligibleProjectIds);
  useEffect(() => {
    const aggregateStage = summarizeGroupStage(
      project.product,
      zones,
    ).currentStage;
    if (aggregateStage !== stage) setStage(aggregateStage);
  }, [project.product, stage, zones]);

  const [visits, setVisits] = useState<readonly ProjectVisit[]>(() =>
    (
      savedDetail?.visits ??
      (visitsFromSharedStore.length
        ? visitsFromSharedStore
        : initialVisits(project))
    ).map((visit) => ({
      ...visit,
      staffIds: migrateVisitStaff(visit, savedDetail?.tasks ?? []),
    })),
  );
  const [designs, setDesigns] = useState<readonly ProjectDesign[]>(
    () => savedDetail?.designs ?? initialDesigns(project),
  );
  const [samples, setSamples] = useState<readonly ProjectSample[]>(
    samplesFromSharedStore.length
      ? samplesFromSharedStore
      : (savedDetail?.samples ?? []),
  );
  const [assets, setAssets] = useState<readonly ProjectAsset[]>(
    savedDetail?.assets ?? [],
  );
  // A sample that already shipped means this group reached the Sample stage
  // once. Sitting earlier in the pipeline now is a Revision rework loop, not
  // stale data — say so, or the stage badge reads like a bug.
  const reworkSamples = samples.filter((sample) =>
    ['SHIPPED', 'ARRIVED', 'APPROVED'].includes(sample.status),
  );
  const reworkRevision = designs.reduce(
    (highest, design) =>
      Math.max(highest, currentRevision(design).revisionNumber),
    0,
  );
  const [activity, setActivity] = useState<readonly ActivityItem[]>(
    () =>
      savedDetail?.activity.filter((item) => !isLegacySeedActivity(item)) ?? [],
  );
  const [dialog, setDialog] = useState<DialogName>();
  const [dialogZone, setDialogZone] = useState<string>();
  const [dialogDesignId, setDialogDesignId] = useState<string>();
  const [visitDialogType, setVisitDialogType] =
    useState<ProjectVisit['type']>();
  const [fNumber] = useState<string | undefined>(savedDetail?.fNumber);
  useEffect(() => {
    const snapshot: ProjectDetailSnapshot = {
      stage,
      zones,
      tasks: savedDetail?.tasks ?? [],
      visits,
      designs,
      samples,
      assets,
      activity,
      ...(fNumber ? { fNumber } : {}),
    };
    saveProjectDetail(project.id, snapshot);
  }, [
    activity,
    assets,
    designs,
    fNumber,
    project.id,
    samples,
    saveProjectDetail,
    stage,
    savedDetail?.tasks,
    visits,
    zones,
  ]);

  useEffect(() => {
    setProjects((current) =>
      current.map((item) => {
        if (item.id !== project.id) return item;
        const syncedFNumber = fNumber ?? item.fNumber;
        const zoneProjects = item.zoneProjects.map((zoneProject) => {
          const currentZone = zones.find((zone) => zone.id === zoneProject.id);
          if (!currentZone) return zoneProject;
          const productShapeId = currentZone.productShapeId;

          return {
            ...zoneProject,
            currentStage: currentZone.currentStage,
            stageTargetDays: currentZone.stageTargetDays,
            productShapeId,
            sizeReview: currentZone.sizeReview,
            productionHandoff: currentZone.productionHandoff,
            shapeReviewHistory: currentZone.shapeReviewHistory,
            reworkRequestedAt: currentZone.reworkRequestedAt,
          };
        });
        const zonesChanged = zoneProjects.some(
          (zoneProject, index) =>
            zoneProject.stageTargetDays !== item.zoneProjects[index]?.stageTargetDays ||
            zoneProject.productShapeId !==
              item.zoneProjects[index]?.productShapeId ||
            zoneProject.sizeReview !== item.zoneProjects[index]?.sizeReview ||
            zoneProject.productionHandoff !==
              item.zoneProjects[index]?.productionHandoff ||
            zoneProject.currentStage !== item.zoneProjects[index]?.currentStage,
        );
        if (
          item.stage === stage &&
          item.fNumber === syncedFNumber &&
          !zonesChanged
        )
          return item;
        return {
          ...item,
          stage,
          zoneProjects,
          status: stage === 'Approved' ? 'APPROVED' : 'IN PROGRESS',
          ...(syncedFNumber ? { fNumber: syncedFNumber } : {}),
        };
      }),
    );
  }, [fNumber, project.id, setProjects, stage, zones]);

  useEffect(() => {
    const sharedVisits: readonly Visit[] = visits
      .filter((visit) => visit.status !== 'CANCELLED')
      .map((visit) => ({
        id: visit.id,
        vehicle: project.vehicle,
        projectGroupId: project.id,
        product: project.product,
        vehicleProjectIds: visit.vehicleProjectIds,
        dealer: visit.dealer,
        date: visit.date,
        time: visit.time,
        taskIds: [],
        staffIds: visit.staffIds,
        scheduledAt: visit.scheduledAt,
        performedAt: visit.performedAt,
        projectLinks: visit.projectLinks,
        kind: visit.type,
        status: visit.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
        locationType: visit.locationType ?? 'DEALERSHIP',
        priority: visit.priority ?? 'NORMAL',
        ...(visit.note ? { note: visit.note } : {}),
        ...(visit.targetVehicleResearchId
          ? { targetVehicleResearchId: visit.targetVehicleResearchId }
          : {}),
        ...(visit.type === 'FITTING' && visit.result
          ? { result: visit.result }
          : {}),
      }));
    setSharedVisits((current) => {
      const otherProjects = current.filter(
        (visit) => visit.projectGroupId !== project.id,
      );
      return [...otherProjects, ...sharedVisits];
    });
  }, [project, setSharedVisits, visits]);

  useEffect(() => {
    setSampleRequests((current) => {
      const otherProjects = current.filter(
        (request) => request.projectGroupId !== project.id,
      );
      return [
        ...otherProjects,
        ...samples.map((sample) => ({
          id: sample.id,
          projectGroupId: project.id,
          vehicle: project.vehicle,
          product: project.product,
          factory: sample.factory,
          ...(sample.note ? { note: sample.note } : {}),
          createdAt: sample.requestedAt ?? '2026-08-31T09:00:00-07:00',
          ...(sample.status !== 'REQUESTED'
            ? {
                sentAt: '2026-08-31T10:00:00-07:00',
                sentBy: CURRENT_USER_ID,
              }
            : {}),
        })),
      ];
    });
    setSampleRequestItems((current) => {
      const requestIds = new Set(samples.map((sample) => sample.id));
      const otherProjects = current.filter(
        (item) => !requestIds.has(item.sampleRequestId),
      );
      return [
        ...otherProjects,
        ...current.filter(
          (item) =>
            requestIds.has(item.sampleRequestId) &&
            !designs.some(
              (design) => design.id === item.vehicleProductDesignId,
            ),
        ),
        ...samples.flatMap((sample) => {
          const lines: readonly ProjectSampleLine[] =
            sample.lines ??
            (sample.designIds
              ? designs.filter((design) =>
                  sample.designIds?.includes(design.id),
                )
              : designs.filter((design) =>
                  current.some(
                    (item) =>
                      item.sampleRequestId === sample.id &&
                      item.vehicleProductDesignId === design.id,
                  ),
                )
            )
              .slice(0, Math.max(1, sample.items))
              .map((design) => ({ designId: design.id }));
          return lines.flatMap((line, index) => {
            const design = designs.find(
              (candidate) => candidate.id === line.designId,
            );
            if (!design) return [];
            const itemId = `SRI-${sample.id}-${String(index + 1)}`;
            // A request line stays pinned to the revision it was raised for,
            // so adding a Revision later does not rewrite earlier rounds.
            const existing = current.find(
              (item) =>
                item.sampleRequestId === sample.id &&
                item.vehicleProductDesignId === design.id,
            );
            return [
              mergeProjectSampleItem(
                {
                  id: existing?.id ?? itemId,
                  sampleRequestId: sample.id,
                  vehicleProductDesignId: design.id,
                  vehicleProductDesignRevisionId:
                    existing?.vehicleProductDesignRevisionId ??
                    currentRevision(design).id,
                  sampleRound: sample.round,
                  priority: 'NORMAL' as const,
                  ...(line.note ? { note: line.note } : {}),
                  ...(sample.status === 'ARRIVED' ||
                  sample.status === 'APPROVED'
                    ? {
                        sampleReceivedAt:
                          sample.shipment?.arrivedAt ??
                          new Date().toISOString(),
                      }
                    : {}),
                  ...(sample.status !== 'REQUESTED'
                    ? { sampleShipmentId: `SHIP-${sample.id}` }
                    : {}),
                },
                existing,
              ),
            ];
          });
        }),
      ];
    });
    setSampleShipments((current) => {
      const shipmentIds = new Set(samples.map((sample) => `SHIP-${sample.id}`));
      const otherProjects = current.filter(
        (shipment) => !shipmentIds.has(shipment.id),
      );
      return [
        ...otherProjects,
        ...samples.flatMap((sample) =>
          sample.status === 'REQUESTED'
            ? []
            : [
                {
                  id: `SHIP-${sample.id}`,
                  factory: sample.factory,
                  // Samples shipped or arrived before dates were recorded
                  // fall back to "now"; recorded values below win.
                  shippedAt: new Date().toISOString(),
                  externalReference: `TRACK-${sample.id}`,
                  ...(sample.status === 'ARRIVED' ||
                  sample.status === 'APPROVED'
                    ? { arrivedAt: new Date().toISOString() }
                    : {}),
                  ...sample.shipment,
                },
              ],
        ),
      ];
    });
  }, [
    designs,
    project,
    samples,
    setSampleRequestItems,
    setSampleRequests,
    setSampleShipments,
  ]);

  useEffect(() => {
    if (!fNumber) return;
    const uniqueVehicle: UniqueVehicle = {
      fNumber,
      vehicle: project.vehicle,
      product: project.product,
      vehicleResearchId: project.vehicleResearchId,
      options: project.options,
      projectGroupId: project.id,
      shapes: zones.flatMap((zone) => {
        const legacyName = legacyShapeName(zone);
        return zone.productShape?.name
          ? [zone.productShape.name]
          : legacyName
            ? [legacyName]
            : [];
      }),
      skuStatus: 'DRAFT',
    };
    setUniqueVehicles((current) =>
      current.some(
        (vehicle) =>
          vehicle.fNumber === fNumber || vehicle.projectGroupId === project.id,
      )
        ? current
        : [
            uniqueVehicle,
            ...current.filter(
              (vehicle) => vehicle.projectGroupId !== project.id,
            ),
          ],
    );
  }, [fNumber, project, setUniqueVehicles, zones]);

  function addActivity(title: string, detail: string): void {
    const item: ActivityItem = {
      id: `ACT-${String(activity.length + 1).padStart(3, '0')}`,
      date: '08-31',
      time: '10:30',
      title,
      detail,
    };
    setActivity((current) => [item, ...current]);
  }

  /** Writes `vehicle_project.manager_id` for one zone project. */
  function changeZoneManager(zoneId: string, userId: string | undefined): void {
    const zone = zones.find((item) => item.id === zoneId);
    setZones((current) =>
      current.map((item) =>
        item.id === zoneId ? { ...item, managerId: userId ?? '' } : item,
      ),
    );
    const assigned = activeUsers.find((user) => user.id === userId);
    addActivity(
      'Manager changed',
      `${zone?.code ?? zoneId} · ${assigned ? assigned.name : 'Assignee cleared'}`,
    );
  }

  function openDialog(
    name: DialogName,
    zone?: string,
    designId?: string,
  ): void {
    if (!focusedZone) return;
    if (
      (name === 'design' || name === 'revision') &&
      (!canCreateDesign ||
        (zone !== undefined && !designEligibleProjectIds.includes(zone)))
    )
      return;
    if (name === 'design' && project.product === 'Seat Cover') {
      importProjectParts(designs, project.product);
      setLinkZone(zone ?? focusedZone.id);
      return;
    }
    if (name === 'sample' && !canRequestSample) return;
    if (name === 'visit' && !canScheduleScan && !canScheduleFitting) return;
    setDialogZone(zone ?? (name === 'visit' ? focusedZone.id : undefined));
    setDialogDesignId(designId);
    setDialog(name);
  }

  function closeDialog(): void {
    setVisitDialogType(undefined);
    setDialog(undefined);
    setDialogZone(undefined);
    setDialogDesignId(undefined);
  }

  const sampleGate = getSampleGate(
    project.product,
    focusedStage === 'Sample'
      ? focusScope.filter((zone) => zone.currentStage === 'Sample')
      : focusScope,
    designs,
    sharedSampleRequestItems,
  );

  const handoffScope = focusScope.filter((zone) =>
    focusedStage === 'Approved'
      ? zone.id === focusedZone?.id
      : zone.currentStage === 'Fitting',
  );
  const handoffSampleGate = getSampleGate(
    project.product,
    handoffScope,
    designs,
    sharedSampleRequestItems,
  );

  function advanceStage(): void {
    const individualGateReady = (zone: ZoneProject) => {
      switch (zone.currentStage) {
        case 'Scan':
          return zone.scanned;
        case '3D Model':
        case 'Fit Review':
          return assets.some((asset) => asset.type === '3D MODEL');
        case 'Fitting':
          return false; // Development completion requires the explicit handoff action.
        case 'Design':
          return designs.some((design) => design.vehicleProjectId === zone.id);
        case 'Sample':
          return getSampleGate(
            project.product,
            [zone],
            designs,
            sharedSampleRequestItems,
          ).ready;
        default:
          return true;
      }
    };
    if (!focusedZone) return;
    const currentStage = focusedZone.currentStage;
    // Bundle members already past this stage (a partner that did not fail its
    // fitting, for example) stay where they are.
    const advancingZones = focusScope.filter(
      (zone) => zone.currentStage === currentStage,
    );
    if (!advancingZones.every(individualGateReady)) return;
    const nextStageIndex = pipeline.indexOf(currentStage) + 1;
    const nextStage = pipeline.slice(nextStageIndex, nextStageIndex + 1).pop();
    if (!nextStage) return;
    const advancingIds = new Set(advancingZones.map((zone) => zone.id));
    setZones((current) =>
      current.map((zone) =>
        advancingIds.has(zone.id) ? { ...zone, currentStage: nextStage } : zone,
      ),
    );
    addActivity(
      `${currentStage} Completed`,
      `${advancingZones.map((zone) => zone.code).join(', ')} · ${nextStage} Moved to stage`,
    );
  }

  if (!focusedZone) {
    return (
      <section className="project-workspace">
        <Button
          className="project-back-button"
          variant="ghost"
          onClick={onBack}
        >
          <ArrowLeft /> Vehicle Projects
        </Button>
        <div className="empty-inline">{project.id} has no zone projects.</div>
      </section>
    );
  }

  const focusedVisits = visits.filter((visit) =>
    visit.vehicleProjectIds.includes(focusedZone.id),
  );
  const focusedDesigns = designs.filter(
    (design) => design.vehicleProjectId === focusedZone.id,
  );
  const scopeDesigns = designs.filter((design) =>
    focusScopeIds.has(design.vehicleProjectId),
  );
  // A request belongs to the zone(s) its part designs belong to; a bundle
  // request that spans both Floor Mat zones shows under each.
  const focusedSamples = samples.filter((sample) => {
    const designIds =
      sample.lines?.map((line) => line.designId) ??
      sample.designIds ??
      sharedSampleRequestItems
        .filter((item) => item.sampleRequestId === sample.id)
        .map((item) => item.vehicleProductDesignId);
    return focusedDesigns.some((design) => designIds.includes(design.id));
  });

  return (
    <section className="project-workspace">
      {project.product === 'Seat Cover' &&
        (Boolean(linkZone) ||
          (partParams.get('linkPart') && canCreateDesign)) && (
          <PartLinkDialog
            product={project.product}
            productTypeId={project.productTypeId}
            zoneId={linkZone ?? focusedZone.id}
            existing={designs}
            selectedPart={partParams.get('linkPart') ?? undefined}
            returnTo={`/vehicle-projects?project=${project.id}&zone=${focusedZone.code}&tab=designs`}
            onClose={() => {
              setLinkZone(undefined);
              setPartParams(
                (current) => {
                  current.delete('linkPart');
                  return current;
                },
                { replace: true },
              );
            }}
            onLink={(design) => {
              setDesigns((current) => [...current, design]);
              addActivity(
                'Part linked',
                `${design.name} · v${String(design.revisions[0].revisionNumber)}`,
              );
              setActiveTab('designs');
              setLinkZone(undefined);
              setPartParams(
                (current) => {
                  current.delete('linkPart');
                  return current;
                },
                { replace: true },
              );
            }}
          />
        )}
      <Button className="project-back-button" variant="ghost" onClick={onBack}>
        <ArrowLeft /> Vehicle Projects
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          // React Router handles route errors; clicks do not await navigation.
          void navigate(
            `/product-shapes?view=review&project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(focusedZone.id)}`,
          );
        }}
      >
        Shape creation, quality review & confirmation →
      </Button>
      <ProjectHeader
        project={project}
        zone={focusedZone}
        zones={zones}
        manager={findUser(activeUsers, focusedZone.managerId)}
        onSelectZone={onSelectZone}
        onNewConfiguration={() => {
          openDialog('new-configuration');
        }}
        tables={import.meta.env.DEV ? DETAIL_TABLES : undefined}
      />
      <ProjectProgressRail
        product={project.product}
        pipeline={pipeline}
        stage={focusedStage}
        zones={[focusedZone]}
        reworkSamples={reworkSamples}
        reworkRevision={reworkRevision}
      />
      <ProjectNextActionGuide
        sampleGate={sampleGate}
        project={project}
        stage={focusedStage}
        pipeline={pipeline}
        zones={focusScope}
        visits={visits}
        designs={scopeDesigns}
        assets={assets}
        onAdvance={advanceStage}
        onOpenTab={setActiveTab}
        onPromote={() => {
          openDialog('promote');
        }}
        onOpenShape={() => {
          // React Router handles route errors; clicks do not await navigation.
          void navigate(
            `/product-shapes?view=review&project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(focusedZone.id)}`,
          );
        }}
      />
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as DetailTab);
        }}
      >
        <TabsList variant="line" size="md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="designs">
            {designLabel(project.product)}
          </TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
          <TabsTrigger value="revisions">Revision Control</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ZoneTab
            users={activeUsers}
            onManagerChange={(userId) => {
              changeZoneManager(focusedZone.id, userId);
            }}
            project={project}
            zone={focusedZone}
            visits={focusedVisits}
            designs={focusedDesigns}
            canCreateDesign={canCreateDesign}
            onAddDesign={() => {
              openDialog('design', focusedZone.id);
            }}
            onRevision={(designId) => {
              openDialog('revision', undefined, designId);
            }}
            onOpenVisits={() => {
              setActiveTab('visits');
            }}
          />
          <StageTimingSummary
            key={focusedZone.id}
            onSavePlan={(plan) => setZones((current) => current.map((zone) => zone.id === focusedZone.id ? {...zone, stageTargetDays: plan} : zone))}
            zone={
              savedDetail?.zones.find((zone) => zone.id === focusedZone.id) ??
              focusedZone
            }
          />
          <details className="shape-section">
            <summary>Stage transition history</summary>
            <p>
              Transitions recorded since this update. Actual start times for
              earlier stages are not estimated.
            </p>
            {(
              savedDetail?.zones.find((zone) => zone.id === focusedZone.id)
                ?.stageHistory ?? []
            ).map((record) => (
              <p key={record.id}>
                {record.stageSequence}. {record.stage} · Started{' '}
                {record.startedAt} · Completed{' '}
                {record.completedAt ?? 'In progress'} · Standard{' '}
                {record.targetDays !== undefined
                  ? `${String(record.targetDays)} days`
                  : 'Not set'}{' '}
                · Stage target {record.targetDueAt ?? 'Not set'}
              </p>
            ))}
          </details>
        </TabsContent>
        <TabsContent value="designs">
          <DesignsTab
            project={project}
            zones={[focusedZone]}
            designs={focusedDesigns}
            stage={focusedStage}
            canCreateDesign={canCreateDesign}
            eligibleProjectIds={designEligibleProjectIds}
            onAddDesign={(vehicleProjectId) => {
              openDialog('design', vehicleProjectId);
            }}
            onRevision={(designId) => {
              openDialog('revision', undefined, designId);
            }}
            onToggleFit={(designId) => {
              setDesigns((current) =>
                current.map((design) =>
                  design.id === designId
                    ? {
                        ...design,
                        fittingConfirmed: !design.fittingConfirmed,
                      }
                    : design,
                ),
              );
            }}
          />
        </TabsContent>
        <TabsContent value="samples">
          <SamplesTab
            stage={focusedStage}
            onCompleteStage={advanceStage}
            sampleGate={sampleGate}
            onResolveGate={(tab) => {
              setActiveTab(tab);
            }}
            product={project.product}
            designs={scopeDesigns.filter((design) =>
              sampleEligibleProjectIds.includes(design.vehicleProjectId),
            )}
            samples={focusedSamples}
            sampleItems={sharedSampleRequestItems}
            canRequestSample={canRequestSample}
            onRequest={() => {
              openDialog('sample');
            }}
            onShip={(sampleId, shipment) => {
              if (!canRequestSample) return;
              setSamples((current) =>
                current.map((sample) =>
                  sample.id === sampleId && sample.status === 'REQUESTED'
                    ? { ...sample, status: 'SHIPPED', shipment }
                    : sample,
                ),
              );
              addActivity(
                'Sample Shipped',
                `${sampleId} · ${shipment.externalReference ?? ''} · ${shipment.shippedAt ?? ''}`,
              );
            }}
            onAdvance={(sampleId) => {
              if (!canRequestSample) return;
              setSamples((current) =>
                current.map((sample) => {
                  if (sample.id !== sampleId) {
                    return sample;
                  }
                  if (sample.status === 'SHIPPED') {
                    return {
                      ...sample,
                      status: 'ARRIVED',
                      shipment: {
                        ...(sample.shipment ?? {}),
                        arrivedAt: new Date().toISOString(),
                      },
                    };
                  }
                  return { ...sample, status: 'APPROVED' };
                }),
              );
            }}
            onApproveDesign={(designId) => {
              if (!canRequestSample) return;
              setDesigns((current) =>
                current.map((design) =>
                  design.id !== designId
                    ? design
                    : {
                        ...design,
                        revisions: design.revisions.map((revision) =>
                          revision.id === currentRevision(design).id
                            ? {
                                ...revision,
                                sampleApprovedAt: new Date().toISOString(),
                                sampleApprovedBy: 'USR-KAI',
                              }
                            : revision,
                        ),
                      },
                ),
              );
              addActivity(
                'Sample revision approved',
                `${designId} · approved by USR-KAI`,
              );
            }}
            onVerifyRevision={(itemId, verdict, note) => {
              const sampleItem = sharedSampleRequestItems.find(
                (item) => item.id === itemId,
              );
              if (!sampleItem) return;
              const verifiedAt = new Date().toISOString();
              setSampleRequestItems((current) =>
                current.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        revisionReflected: verdict,
                        verificationNote: note,
                        verifiedAt,
                        verifiedBy: CURRENT_USER_ID,
                        ...(verdict === 'CORRECT'
                          ? {}
                          : { issueSource: 'FACTORY' as const }),
                      }
                    : item,
                ),
              );
              const updatedDesigns = designs.map((design) =>
                design.id === sampleItem.vehicleProductDesignId
                  ? {
                      ...design,
                      revisions: design.revisions.map((revision) =>
                        revision.id ===
                        sampleItem.vehicleProductDesignRevisionId
                          ? {
                              ...revision,
                              executionVerifications: [
                                ...(
                                  revision.executionVerifications ?? []
                                ).filter(
                                  (entry) =>
                                    entry.sampleRequestItemId !== itemId,
                                ),
                                {
                                  sampleRequestItemId: itemId,
                                  verdict,
                                  note,
                                  verifiedAt,
                                  verifiedBy: CURRENT_USER_ID,
                                  ...(verdict === 'CORRECT'
                                    ? {}
                                    : { issueSource: 'FACTORY' as const }),
                                },
                              ],
                            }
                          : revision,
                      ),
                    }
                  : design,
              );
              setDesigns(updatedDesigns);
              importProjectParts(updatedDesigns, project.product);
              addActivity(
                'Revision verification',
                `${itemId} · ${verdict} · ${note}`,
              );
            }}
          />
        </TabsContent>
        <TabsContent value="revisions">
          <RevisionControlTab
            designs={scopeDesigns}
            sampleItems={sharedSampleRequestItems}
            onRevision={(designId) => {
              openDialog('revision', undefined, designId);
            }}
          />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab
            users={activeUsers}
            assets={assets}
            onAdd={() => {
              openDialog('file');
            }}
          />
        </TabsContent>
        <TabsContent value="visits">
          <VisitsTab
            key={`${focusedZone.id}-${focusedStage}`}
            product={project.product}
            stage={focusedStage}
            users={activeUsers}
            visits={focusedVisits}
            canScheduleScan={canScheduleScan}
            canScheduleFitting={canScheduleFitting}
            onAdd={(type) => {
              setVisitDialogType(type);
              openDialog('visit');
            }}
            onCancel={(visitId) => {
              setVisits((current) =>
                current.map((visit) =>
                  visit.id === visitId
                    ? { ...visit, status: 'CANCELLED' }
                    : visit,
                ),
              );
            }}
            onComplete={(visitId, result) => {
              const visit = visits.find((item) => item.id === visitId);
              if (!visit) {
                return;
              }
              const eligibleIds =
                visit.type === 'SCAN'
                  ? scanEligibleProjectIds
                  : fittingEligibleProjectIds;
              if (
                visit.vehicleProjectIds.some((id) => !eligibleIds.includes(id))
              )
                return;
              setVisits((current) =>
                current.map((item) =>
                  item.id === visitId
                    ? {
                        ...item,
                        status: 'COMPLETED',
                        performedAt: new Date().toISOString(),
                        projectLinks: item.projectLinks?.map((link) => ({
                          ...link,
                          result:
                            item.type === 'FITTING'
                              ? (result ?? 'PASS')
                              : undefined,
                        })),
                        ...(item.type === 'FITTING'
                          ? { result: result ?? 'PASS' }
                          : { result: undefined }),
                      }
                    : item,
                ),
              );
              if (visit.type === 'SCAN') {
                setZones((current) =>
                  current.map((zone) =>
                    visit.vehicleProjectIds.includes(zone.id)
                      ? {
                          ...zone,
                          scanned: true,
                          currentStage:
                            zone.currentStage === 'Scan'
                              ? 'Design'
                              : zone.currentStage,
                        }
                      : zone,
                  ),
                );
              } else if (result !== 'FAIL') {
                setDesigns((current) =>
                  current.map((design) =>
                    visit.vehicleProjectIds.includes(design.vehicleProjectId)
                      ? { ...design, fittingConfirmed: true }
                      : design,
                  ),
                );
              } else {
                // A failed fitting sends only the zones on this visit back to
                // Design for a Revision; a Floor Mat bundle partner keeps its
                // stage.
                setDesigns((current) =>
                  current.map((design) =>
                    visit.vehicleProjectIds.includes(design.vehicleProjectId)
                      ? { ...design, fittingConfirmed: false }
                      : design,
                  ),
                );
                setZones((current) =>
                  current.map((zone) =>
                    visit.vehicleProjectIds.includes(zone.id) &&
                    zone.currentStage === 'Fitting'
                      ? { ...zone, currentStage: 'Design' }
                      : zone,
                  ),
                );
              }
              addActivity(
                visit.type === 'FITTING'
                  ? `FITTING visit completed · ${result ?? 'PASS'}`
                  : `${visit.type} Visit completed`,
                result === 'FAIL'
                  ? `${visit.vehicleProjectIds.join(', ')} · ${visit.dealer} · Returned to Design (revision rework)`
                  : `${visit.vehicleProjectIds.join(', ')} · ${visit.dealer}`,
              );
            }}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab activity={activity} />
        </TabsContent>
      </Tabs>
      <ProjectDialog
        handoffZoneCodes={handoffScope.map((zone) => zone.code).join(', ')}
        handoffDraft={prepareHandoffChecklist(
          handoffScope[0]?.handoffChecklist,
          handoffScope[0]
            ? sizeReviewEvidence(handoffScope[0].id, designs, visits)
            : '',
        )}
        onHandoffDraft={(value) => {
          setZones((current) =>
            current.map((zone) =>
              handoffScope.some((target) => target.id === zone.id)
                ? {
                    ...zone,
                    handoffChecklist: {
                      ...value,
                      evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                    },
                  }
                : zone,
            ),
          );
        }}
        handoffErrors={[
          // Shape approval and its quality review follow development handoff.
          ...handoffScope.flatMap((zone) =>
            handoffBlockers(zone, designs, visits),
          ),
          ...handoffSampleGate.blockers.map((blocker) => blocker.message),
        ]}
        allDesigns={[
          ...Object.entries(projectDetails).flatMap(([id, detail]) =>
            id === project.id ? [] : detail.designs,
          ),
          ...designs,
        ]}
        designs={designs}
        samples={samples}
        sampleItems={sharedSampleRequestItems}
        configurations={configurations}
        users={activeUsers}
        seatCoverParts={seatCoverParts}
        seatCoverCodes={seatCoverCodes}
        key={`${dialog ?? 'closed'}-${dialogZone ?? ''}-${dialogDesignId ?? ''}`}
        dialog={dialog}
        project={project}
        zones={focusScope}
        canRequestSample={canRequestSample}
        canScheduleScan={canScheduleScan}
        canScheduleFitting={canScheduleFitting}
        designEligibleProjectIds={designEligibleProjectIds}
        sampleEligibleProjectIds={sampleEligibleProjectIds}
        scanEligibleProjectIds={scanEligibleProjectIds}
        fittingEligibleProjectIds={fittingEligibleProjectIds}
        dialogZone={dialogZone}
        initialVisitType={visitDialogType}
        dialogDesignId={dialogDesignId}
        onClose={closeDialog}
        onDesign={(input) => {
          if (!designEligibleProjectIds.includes(input.vehicleProjectId))
            return;
          const allDesigns = [
            ...Object.entries(projectDetails).flatMap(([id, detail]) =>
              id === project.id ? [] : detail.designs,
            ),
            ...designs,
          ];
          if (
            !input.name.trim() ||
            allDesigns.some(
              (item) =>
                item.name.toLowerCase() === input.name.trim().toLowerCase(),
            ) ||
            hasDesignIdentity(allDesigns, input.details)
          )
            return;
          const designId = crypto.randomUUID();
          const design: ProjectDesign = {
            id: designId,
            productTypeId: project.productTypeId,
            vehicleProjectId: input.vehicleProjectId,
            name: input.name,
            status: 'ACTIVE',
            quantity: project.product === 'Seat Cover' ? input.quantity : 1,
            details: input.details,
            revisions: [
              {
                id: `REV-${designId}-1`,
                revisionNumber: 1,
                note: input.revisionNote,
                createdBy: input.revisionCreatedBy,
                createdAt: new Date().toISOString(),
                dxfFileName: input.dxfFileName,
                dxfFingerprint: input.dxfFingerprint,
              },
            ],
            fittingConfirmed: false,
          };
          setDesigns((current) => [...current, design]);
          addActivity(
            'Design created',
            `${input.name} · ${input.vehicleProjectId} · Revision 1`,
          );
          closeDialog();
        }}
        onRevision={(designId, note, createdBy, changeRequest) => {
          if (!canCreateDesign) return;
          const design = designs.find((item) => item.id === designId);
          if (!design) return;
          const revisionNumber = currentRevision(design).revisionNumber + 1;
          setDesigns((current) =>
            current.map((item) =>
              item.id === designId
                ? {
                    ...item,
                    revisions: [
                      ...item.revisions,
                      {
                        id: `REV-${designId}-${String(revisionNumber)}`,
                        revisionNumber,
                        note,
                        createdBy,
                        createdAt: new Date().toISOString(),
                        dxfFileName: changeRequest.newDxfFileName,
                        dxfFingerprint: changeRequest.newDxfFingerprint,
                        changeRequest,
                      },
                    ],
                    fittingConfirmed: false,
                    requiresRevisionAfterReview: false,
                  }
                : item,
            ),
          );
          addActivity(
            'Revision change request confirmed',
            `${design.name} · Rev ${String(revisionNumber)} · ${changeRequest.issueArea} · Factory instructions created`,
          );
          importProjectParts(
            designs.map((item) =>
              item.id === designId
                ? {
                    ...item,
                    revisions: [
                      ...item.revisions,
                      {
                        id: `REV-${designId}-${String(revisionNumber)}`,
                        revisionNumber,
                        note,
                        createdBy,
                        createdAt: new Date().toISOString(),
                        dxfFileName: changeRequest.newDxfFileName,
                        dxfFingerprint: changeRequest.newDxfFingerprint,
                        changeRequest,
                      },
                    ],
                  }
                : item,
            ),
            project.product,
          );
          closeDialog();
        }}
        onVisit={(input) => {
          const eligibleIds =
            input.type === 'SCAN'
              ? scanEligibleProjectIds
              : fittingEligibleProjectIds;
          if (
            !input.vehicleProjectIds.length ||
            input.vehicleProjectIds.some((id) => !eligibleIds.includes(id))
          )
            return;
          const visit = createProjectVisit(input);
          setVisits((current) => [...current, visit]);
          addActivity(
            `${input.type} Visit scheduled`,
            `${input.dealer} · ${input.date} ${input.time} · ${input.vehicleProjectIds.join(', ')}`,
          );
          closeDialog();
        }}
        onSample={(input) => {
          if (!canRequestSample) return;
          const lines = input.lines.filter((line) => {
            const design = scopeDesigns.find(
              (candidate) =>
                candidate.id === line.designId &&
                sampleEligibleProjectIds.includes(candidate.vehicleProjectId),
            );
            return (
              design !== undefined &&
              isRevisionSampleRequestable(design, sharedSampleRequestItems)
            );
          });
          if (!lines.length) return;
          const sample: ProjectSample = {
            id: `SR-${project.id.replace(/\D/g, '')}-${String(samples.length + 1).padStart(2, '0')}`,
            factory: input.factory,
            items: lines.length,
            designIds: lines.map((line) => line.designId),
            lines,
            round: samples.length + 1,
            status: 'REQUESTED',
            requestedAt: new Date().toISOString(),
            ...(input.note ? { note: input.note } : {}),
          };
          setSamples((current) => [...current, sample]);
          addActivity(
            'Sample Request',
            `${sample.id} · ${input.factory} · ${String(lines.length)} items`,
          );
          closeDialog();
        }}
        onFile={(name, type) => {
          const asset: ProjectAsset = {
            id: `AST-${String(assets.length + 1).padStart(3, '0')}`,
            name,
            type,
            scope: 'Group shared',
            addedBy: CURRENT_USER_ID,
            date: '2026-08-31',
          };
          setAssets((current) => [...current, asset]);
          addActivity('Asset added', `${name} · ${type}`);
          closeDialog();
        }}
        onConfiguration={(title, value, mode, note) => {
          addActivity(
            mode === 'NEW' ? 'New configuration found' : 'Research updated',
            `${title}: ${value}${note ? ` · ${note}` : ''}`,
          );
          closeDialog();
        }}
        onPromote={(checklist) => {
          const reference = HANDOFF_DOCUMENTS.map(
            ([id, label]) => `${label}: ${checklist.documents[id].reference}`,
          ).join(' / ');
          if (
            handoffChecklistErrors(checklist).length > 0 ||
            checklist.evidenceKey !==
              (handoffScope[0]
                ? sizeReviewEvidence(handoffScope[0].id, designs, visits)
                : '') ||
            !handoffScope.length ||
            !handoffScope.every((zone) =>
              handoffReady(zone, designs, visits),
            ) ||
            !handoffSampleGate.ready
          )
            return;
          const now = new Date().toISOString();
          setZones((current) =>
            current.map((zone) =>
              handoffScope.some((target) => target.id === zone.id)
                ? {
                    ...zone,
                    currentStage: 'Approved',
                    productionHandoff: {
                      completedAt: now,
                      completedBy: CURRENT_USER_ID,
                      reference,
                      checklist,
                      evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                    },
                  }
                : zone,
            ),
          );
          addActivity('Handoff complete · Development complete', reference);
          closeDialog();
        }}
      />
    </section>
  );
}

interface ProjectHeaderProps {
  project: VehicleProjectGroup;
  /** The zone project this screen is about. */
  zone: ZoneProject;
  /** Every zone project of the same group, for switching between them. */
  zones: readonly ZoneProject[];
  /** `manager_id` lives on `vehicle_project`, so this is the zone's manager. */
  manager?: AppUser;
  onSelectZone: (zoneCode: string) => void;
  onNewConfiguration: () => void;
  /** Developer aid; pass only in development. */
  tables?: readonly TableRef[];
}

function ProjectHeader({
  project,
  zone,
  zones,
  manager,
  onSelectZone,
  onNewConfiguration,
  tables,
}: ProjectHeaderProps) {
  const ProductIcon =
    project.product === 'Seat Cover'
      ? Armchair
      : project.product === 'Car Cover'
        ? CarFront
        : RectangleHorizontal;
  const productClass = project.product.toLowerCase().replace(' ', '-');
  const priority = zone.priority ?? 'NORMAL';
  const status = zone.status ?? 'ACTIVE';

  return (
    <Card className="project-group-header">
      <CardContent>
        <div className="project-group-heading">
          <div>
            <p className="project-detail-breadcrumb">Project / {zone.id}</p>
            <h1>
              {project.vehicle} · {zone.label}
            </h1>
            <p className={`project-product-type ${productClass}`}>
              <ProductIcon aria-hidden="true" />
              <span>{project.product}</span>
            </p>
          </div>
          <div className="project-group-actions">
            <StatusBadge
              label={priority}
              tone={
                priority === 'URGENT' || priority === 'HIGH'
                  ? 'warning'
                  : 'neutral'
              }
            />
            <StatusBadge
              label={status.replace('_', ' ')}
              tone={
                status === 'ACTIVE'
                  ? 'success'
                  : status === 'ON_HOLD'
                    ? 'warning'
                    : 'neutral'
              }
            />
            <Button size="sm" variant="outline" onClick={onNewConfiguration}>
              New Configuration Found
            </Button>
          </div>
        </div>
        <ConfigChips options={project.options} />
        <div className="project-group-identifiers">
          <div>
            <span>Project</span>
            <strong>{zone.id}</strong>
          </div>
          <div>
            <span>Project Group</span>
            <strong>{project.id}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{project.created}</strong>
          </div>
          <div className="project-manager-field">
            <span>Manager</span>
            {manager ? (
              <span className="manager-chip">
                <UserAvatar user={manager} />
                <span>{manager.name}</span>
              </span>
            ) : (
              <strong className="not-assigned">Not Assigned</strong>
            )}
          </div>
        </div>
        {zones.length > 1 && (
          <div
            className="project-zone-switcher"
            role="group"
            aria-label="Zone projects in this project group"
          >
            <span>Zone Projects in {project.id}</span>
            {zones.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={item.id === zone.id ? 'mono' : 'outline'}
                aria-pressed={item.id === zone.id}
                onClick={() => {
                  onSelectZone(item.code);
                }}
              >
                <span className={`zone zone-${item.code.toLowerCase()}`}>
                  {item.code}
                </span>
                {item.label}
              </Button>
            ))}
          </div>
        )}
        {tables && <PageTables tables={tables} />}
      </CardContent>
    </Card>
  );
}

interface ProjectProgressRailProps {
  product: VehicleProjectGroup['product'];
  pipeline: readonly ProjectStage[];
  stage: ProjectStage;
  zones: readonly ZoneProject[];
  reworkSamples: readonly ProjectSample[];
  reworkRevision: number;
}

const SEAT_COVER_STAGE_LABELS: Partial<Record<ProjectStage, string>> = {
  Research: 'Research',
  'Vehicle Hunt': 'Hunt',
  Scan: 'Scan / Measure',
  Design: 'Pattern',
  Sample: 'Sample',
  Fitting: 'Fitting / Handoff preparation',
  Approved: 'Handoff · Development complete',
};

const FLOOR_MAT_STAGE_LABELS: Partial<Record<ProjectStage, string>> = {
  ...SEAT_COVER_STAGE_LABELS,
};

function ProjectProgressRail({
  product,
  pipeline,
  stage,
  zones,
  reworkSamples,
  reworkRevision,
}: ProjectProgressRailProps) {
  const stageLabels =
    product === 'Seat Cover'
      ? SEAT_COVER_STAGE_LABELS
      : product === 'Floor Mat'
        ? FLOOR_MAT_STAGE_LABELS
        : {
            Fitting: 'Fitting / Handoff preparation',
            Approved: 'Handoff · Development complete',
          };
  const stageIndex = Math.max(0, pipeline.indexOf(stage));
  const isRework =
    reworkSamples.length > 0 && stageIndex < pipeline.indexOf('Sample');

  const renderZoneProgress = (zone: ZoneProject) => {
    const zoneStageIndex = Math.max(0, pipeline.indexOf(zone.currentStage));
    return (
      <div className="zone-progress-item" key={zone.id}>
        <div className="zone-progress-heading">
          <div>
            <span className={`zone zone-${zone.code.toLowerCase()}`}>
              {zone.code}
            </span>
            <strong>{zone.label}</strong>
            <code>{zone.id}</code>
          </div>
          <StatusBadge
            label={`${String(zoneStageIndex + 1)} / ${String(pipeline.length)} · ${stageLabels[zone.currentStage] ?? zone.currentStage}`}
            tone={zone.currentStage === 'Approved' ? 'success' : 'progress'}
          />
        </div>
        <div
          className="project-progress-rail zone-progress-rail circular-progress-rail"
          aria-label="Project stages"
        >
          {pipeline.map((item, index) => (
            <div
              className={
                index < zoneStageIndex || zone.currentStage === 'Approved'
                  ? 'project-progress-step done'
                  : index === zoneStageIndex
                    ? 'project-progress-step active'
                    : 'project-progress-step'
              }
              key={item}
              aria-current={index === zoneStageIndex ? 'step' : undefined}
            >
              <span>
                {index < zoneStageIndex || zone.currentStage === 'Approved'
                  ? '✓'
                  : index + 1}
              </span>
              {stageLabels[item] ?? item}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const floorMatBundle = zones.filter((zone) => ['F', 'B'].includes(zone.code));
  const independentZones =
    product === 'Floor Mat'
      ? zones.filter((zone) => !['F', 'B'].includes(zone.code))
      : zones;
  const bundleStageIndex = floorMatBundle.length
    ? Math.min(
        ...floorMatBundle.map((zone) =>
          Math.max(0, pipeline.indexOf(zone.currentStage)),
        ),
      )
    : 0;
  return (
    <Card className="project-progress-card">
      <CardHeader>
        <CardTitle>Development Progress</CardTitle>
        {isRework && <StatusBadge label="REWORK" tone="warning" />}
      </CardHeader>
      <CardContent>
        {isRework && (
          <p className="project-rework-note">
            This revision rework has returned after passing through the Sample
            stage
            {reworkRevision > 1 &&
              ` (Current revision ${String(reworkRevision)})`}{' '}
            ·{' '}
            {reworkSamples
              .map((sample) => `${sample.id} ${sample.status}`)
              .join(' · ')}
          </p>
        )}
        <div className="zone-progress-board">
          {product === 'Floor Mat' && floorMatBundle.length > 0 && (
            <section className="zone-progress-scope bundle">
              <header>
                <div>
                  <strong>F+B Floor Mat Bundle</strong>
                  <span>1st + 2nd Row must pass each Gate together</span>
                </div>
                <div>
                  <StatusBadge label="REQUIRED BUNDLE" tone="purple" />
                  <StatusBadge
                    label={`BUNDLE GATE · ${stageLabels[pipeline[bundleStageIndex]] ?? pipeline[bundleStageIndex]}`}
                    tone="progress"
                  />
                </div>
              </header>
              {floorMatBundle.map(renderZoneProgress)}
            </section>
          )}
          {independentZones.length > 0 && (
            <section className="zone-progress-scope independent">
              <header>
                <div>
                  <strong>
                    {product === 'Car Cover'
                      ? 'Single Zone Project'
                      : product === 'Floor Mat'
                        ? 'Independent Zone'
                        : 'Independent Zone Projects'}
                  </strong>
                  <span>
                    {product === 'Seat Cover'
                      ? 'Each Zone can progress and launch independently'
                      : product === 'Floor Mat'
                        ? 'Not included in the required F+B Bundle Gate'
                        : 'This product has one workflow owner and Stage'}
                  </span>
                </div>
                {product === 'Seat Cover' && (
                  <StatusBadge label="INDEPENDENT" tone="cyan" />
                )}
              </header>
              {independentZones.map(renderZoneProgress)}
            </section>
          )}
          {!zones.length && (
            <div className="empty-inline">No Zone Projects yet.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProjectNextActionGuideProps {
  sampleGate: SampleGate;
  project: VehicleProjectGroup;
  stage: ProjectStage;
  pipeline: readonly ProjectStage[];
  zones: readonly ZoneProject[];
  visits: readonly ProjectVisit[];
  designs: readonly ProjectDesign[];
  assets: readonly ProjectAsset[];
  onAdvance: () => void;
  onOpenTab: (tab: DetailTab) => void;
  onPromote: () => void;
  onOpenShape: () => void;
}

interface NextActionDefinition {
  title: string;
  description: string;
  steps: readonly string[];
  linkLabel: string;
  targetTab: DetailTab;
  primaryLabel: string;
  primaryAction: () => void;
}

function ProjectNextActionGuide({
  sampleGate,
  project,
  stage,
  pipeline,
  zones,
  visits,
  designs,
  assets,
  onAdvance,
  onOpenTab,
  onPromote,
  onOpenShape,
}: ProjectNextActionGuideProps) {
  const stageIndex = Math.max(0, pipeline.indexOf(stage));
  const stageZones = zones.filter((zone) => zone.currentStage === stage);
  const scanVisits = visits.filter((visit) => visit.type === 'SCAN');
  const allScanned = stageZones.every((zone) => zone.scanned);
  const fittingVisits = visits.filter((visit) => visit.type === 'FITTING');
  const bomReady =
    designs.length > 0 &&
    stageZones.every((zone) =>
      designs.some((design) => design.vehicleProjectId === zone.id),
    );
  const sampleReady = sampleGate.ready;
  const fittingReady =
    stageZones.length > 0 &&
    stageZones.every((zone) => handoffReady(zone, designs, visits));
  const modelAsset = assets.find((asset) => asset.type === '3D MODEL');
  // Rework: the zone is back in Design because its last fitting failed. Until
  // a new Revision exists, every current revision still carries the sample
  // approval it earned before the failed fitting.
  const stageDesigns = designs.filter((design) =>
    stageZones.some((zone) => zone.id === design.vehicleProjectId),
  );
  const completedFittings = fittingVisits.filter(
    (visit) =>
      visit.status === 'COMPLETED' &&
      visit.vehicleProjectIds.some((id) =>
        stageZones.some((zone) => zone.id === id),
      ),
  );
  const failedFitting =
    completedFittings[completedFittings.length - 1]?.result === 'FAIL';
  const revisionPending =
    stageDesigns.length > 0 && stageDesigns.every(isSampleApproved);

  let guide: NextActionDefinition;
  switch (stage) {
    case 'Research':
      guide = {
        title: 'Review the research configuration',
        description:
          'Confirm the vehicle and option combination matches the development target, then complete Research.',
        steps: [
          'Confirm vehicle and model year',
          'Confirm configuration options',
          'Complete Research',
        ],
        linkLabel: 'Review configuration in Overview',
        targetTab: 'overview',
        primaryLabel: 'Complete Research',
        primaryAction: onAdvance,
      };
      break;
    case 'Vehicle Hunt':
      guide = {
        title: 'Secure a vehicle and prepare a scan visit',
        description:
          'Choose a dealer, rental company, or partner vehicle source and complete Vehicle Hunt. Then add the scan date, assignee, and target zones in Visits.',
        steps: [
          'Choose vehicle source',
          'Complete Vehicle Hunt',
          'Schedule SCAN visit',
        ],
        linkLabel: 'Go to Visits to schedule a SCAN visit',
        targetTab: 'visits',
        primaryLabel: 'Complete Vehicle Hunt',
        primaryAction: onAdvance,
      };
      break;
    case 'Scan':
      guide = allScanned
        ? {
            title: 'Scanning is complete for this zone / bundle',
            description:
              'Review the completed scan visit and results, then move to the next stage.',
            steps: [
              'SCAN visit completed',
              'Review target zone results',
              'Complete Scan',
            ],
            linkLabel: 'Review completed results in Visits',
            targetTab: 'visits',
            primaryLabel: 'Complete Scan',
            primaryAction: onAdvance,
          }
        : {
            title:
              scanVisits.length > 0
                ? 'Complete the scheduled scan visit'
                : 'Schedule a scan visit first',
            description:
              'Check the visit schedule and target zones in Visits, then mark the visit complete after scanning on site.',
            steps: [
              'Schedule SCAN visit',
              'Perform on-site scan',
              'Complete visit',
            ],
            linkLabel: 'Check SCAN visit in Visits',
            targetTab: 'visits',
            primaryLabel:
              scanVisits.length > 0
                ? 'Open scheduled scan visit'
                : 'Schedule scan visit',
            primaryAction: () => {
              onOpenTab('visits');
            },
          };
      break;
    case '3D Model':
    case 'Fit Review':
      guide = {
        title: modelAsset
          ? stage === '3D Model'
            ? 'Review the 3D model'
            : 'Review model suitability before pattern work'
          : 'Add a 3D model file',
        description:
          'Check the model in Files and continue to the next stage. Final Shape review and issuance follow sample fitting.',
        steps: [
          'Obtain 3D model',
          'Review model files',
          'Proceed with pattern work',
        ],
        linkLabel: 'Check model files',
        targetTab: 'files',
        primaryLabel: modelAsset
          ? stage === '3D Model'
            ? 'Complete 3D Model'
            : 'Complete model review · Go to Design'
          : 'Add model file',
        primaryAction: modelAsset
          ? onAdvance
          : () => {
              onOpenTab('files');
            },
      };
      break;
    case 'Design':
      if (failedFitting) {
        guide = {
          title: 'Fitting failed — add a revision and repeat sampling',
          description:
            'The latest fitting visit failed, returning only this project to Design. Add a revision addressing the failure and complete Design to request samples for the new revision.',
          steps: [
            'Add a revision addressing the failure',
            'Complete Design, then request, receive, and approve a new sample',
            'Schedule another fitting in Visits',
          ],
          linkLabel: 'Add a revision in Design / Parts',
          targetTab: 'designs',
          primaryLabel: revisionPending
            ? 'Add revision'
            : 'Complete Design (rework)',
          primaryAction: revisionPending
            ? () => {
                onOpenTab('designs');
              }
            : onAdvance,
        };
        break;
      }
      if (project.product !== 'Seat Cover') {
        const label = designLabel(project.product);
        guide = {
          title: bomReady
            ? `${label} has been registered`
            : `${label} must be registered`,
          description:
            project.product === 'Car Cover'
              ? 'Register the complete pattern and initial revision for the research vehicle. Record later changes as new revisions of the existing pattern.'
              : 'Register a mold and initial revision for each zone. Record mold changes and rescans as new revisions of the existing mold.',
          steps: [`${label} Create`, 'Review revision', 'Complete Design'],
          linkLabel: `${label} Confirm`,
          targetTab: 'designs',
          primaryLabel: bomReady ? 'Complete Design' : `${label} Register`,
          primaryAction: bomReady
            ? onAdvance
            : () => {
                onOpenTab('designs');
              },
        };
        break;
      }
      guide = bomReady
        ? {
            title: 'Part composition is ready for this zone / bundle',
            description: 'Review the registered parts and proceed to Sample.',
            steps: ['Select existing part', 'Part linked', 'Complete Design'],
            linkLabel: 'Final parts review',
            targetTab: 'designs',
            primaryLabel: 'Complete Design',
            primaryAction: onAdvance,
          }
        : {
            title: 'Register parts for this zone / bundle',
            description:
              "Configure each zone's designs, parts, and revisions in Parts.",
            steps: [
              'Select existing part',
              'Part linked',
              'Review zone composition',
            ],
            linkLabel: 'Go to Parts',
            targetTab: 'designs',
            primaryLabel: 'Link part',
            primaryAction: () => {
              onOpenTab('designs');
            },
          };
      break;
    case 'Sample':
      guide = sampleReady
        ? {
            title: 'Sample receipt and revision approval are complete',
            description:
              'Review the approved sample results and proceed to Fitting.',
            steps: [
              'Create sample request',
              'Process shipment and receipt',
              'Complete Sample',
            ],
            linkLabel: 'Review approved sample',
            targetTab: 'samples',
            primaryLabel: 'Complete Sample',
            primaryAction: onAdvance,
          }
        : {
            title: 'Cannot complete Sample',
            description: sampleGate.blockers
              .map((blocker) => blocker.message)
              .join(' '),
            steps: [
              'Create sample request',
              'Process shipment and receipt',
              'Approve current revision',
            ],
            linkLabel:
              sampleGate.blockers[0]?.tab === 'designs'
                ? 'Review pattern / Design'
                : 'Review samples',
            targetTab: sampleGate.blockers[0]?.tab ?? 'samples',
            primaryLabel:
              sampleGate.blockers[0]?.tab === 'designs'
                ? 'Register pattern / Design'
                : 'Review incomplete items',
            primaryAction: () => {
              onOpenTab(sampleGate.blockers[0]?.tab ?? 'samples');
            },
          };
      break;
    case 'Fitting': {
      guide = {
        title:
          fittingReady && sampleReady
            ? 'Handoff completes development'
            : 'Review current sample and fitting results',
        description:
          'Hand over the final pattern, fitting results, and production materials, then record completion. Review and issue the Shape separately in Shapes after development is complete.',
        steps: [
          'Samples and fitting complete',
          'Handoff',
          'Development complete',
        ],
        linkLabel: 'Review fitting results',
        targetTab: 'visits',
        primaryLabel:
          fittingReady && sampleReady
            ? 'Record handoff completion'
            : 'Review pending work',
        primaryAction:
          fittingReady && sampleReady
            ? onPromote
            : () => {
                onOpenTab(
                  sampleReady
                    ? 'visits'
                    : (sampleGate.blockers[0]?.tab ?? 'samples'),
                );
              },
      };
      break;
    }
    case 'Approved':
      guide = {
        title: stageZones.every((zone) => zone.productionHandoff)
          ? 'Handoff complete · Development complete'
          : 'Legacy completed project · Handoff verification needed',
        description:
          'Use Shapes for the follow-up review meeting, Shape issuance, and composition. Legacy completed records require handoff verification before review.',
        steps: [
          'Development complete',
          'Review and issue Shape',
          'Add parts composition and blueprint',
        ],
        linkLabel: 'Review handoff history',
        targetTab: 'activity',
        primaryLabel: stageZones.every((zone) => zone.productionHandoff)
          ? 'Continue follow-up work in Shapes'
          : 'Record handoff verification',
        primaryAction: stageZones.every((zone) => zone.productionHandoff)
          ? onOpenShape
          : onPromote,
      };
      break;
    default:
      // `stage` round-trips through localStorage, so an unknown value must
      // degrade to a usable card instead of leaving `guide` unassigned and
      // blanking the whole screen (standards §3.15).
      guide = {
        title: 'No guidance is available for this stage',
        description: `Saved stage (${String(stage)}) is not in the ${project.product} pipeline. Continue using the individual tabs.`,
        steps: [
          'Check the current status in each tab',
          'Complete required work',
        ],
        linkLabel: 'Go to Activity',
        targetTab: 'activity',
        primaryLabel: 'View Activity',
        primaryAction: () => {
          onOpenTab('activity');
        },
      };
      break;
  }

  return (
    <aside className="project-next-action" aria-label="Next action">
      <div className="project-next-action-copy">
        <div className="project-next-action-kicker">
          <StatusBadge label="NEXT ACTION" tone="progress" />
          <span>
            Stage {stageIndex + 1}/{pipeline.length} ·{' '}
            {stage === 'Approved' ? 'Development complete' : stage}
          </span>
        </div>
        <h2>{guide.title}</h2>
        <p>
          {guide.description}{' '}
          <button
            type="button"
            className="project-next-action-link"
            onClick={() => {
              onOpenTab(guide.targetTab);
            }}
          >
            {guide.linkLabel} <ChevronRight aria-hidden="true" />
          </button>
        </p>
        <ol className="project-next-action-steps">
          {guide.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="project-next-action-controls">
        {stage === 'Approved' &&
          stageZones.every((zone) => zone.productionHandoff) && (
            <Button variant="outline" onClick={onPromote}>
              View / Recheck handoff checklist
            </Button>
          )}
        <Button
          className="project-next-action-button"
          variant="primary"
          onClick={guide.primaryAction}
        >
          {guide.primaryLabel} <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}

interface ZoneTabProps {
  users: readonly AppUser[];
  onManagerChange: (userId: string | undefined) => void;
  project: VehicleProjectGroup;
  zone: ZoneProject;
  visits: readonly ProjectVisit[];
  designs: readonly ProjectDesign[];
  canCreateDesign: boolean;
  onAddDesign: () => void;
  onRevision: (designId: string) => void;
  onOpenVisits: () => void;
}

function ZoneTab({
  users,
  onManagerChange,
  project,
  zone,
  visits,
  designs,
  canCreateDesign,
  onAddDesign,
  onRevision,
  onOpenVisits,
}: ZoneTabProps) {
  return (
    <div className="project-tab-stack">
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            {zone.label} · Zone {zone.code}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="zone-detail-list">
            <dt>Zone</dt>
            <dd>
              {zone.code} · {zone.label}
            </dd>
            <dt>Research</dt>
            <dd>{project.vehicle}</dd>
            <dt>Scan</dt>
            <dd>{zone.scanned ? 'Completed' : '—'}</dd>
            <dt>Manager</dt>
            <dd>
              <UserPicker
                label={`${zone.code} Zone project assignee`}
                value={findUser(users, zone.managerId)}
                users={users}
                onChange={onManagerChange}
              />
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            {zone.label} — {designLabel(project.product)}{' '}
            <small>{designs.length} items</small>
          </CardTitle>
          <Button
            size="sm"
            variant="primary"
            disabled={
              !canCreateDesign ||
              (project.product !== 'Seat Cover' && designs.length > 0)
            }
            title={
              canCreateDesign
                ? undefined
                : 'This zone or required Floor Mat bundle must reach the Design gate.'
            }
            onClick={onAddDesign}
          >
            <Plus />{' '}
            {project.product === 'Seat Cover'
              ? 'Link existing part'
              : `${designLabel(project.product)} Create`}
          </Button>
        </CardHeader>
        <CardContent className="design-list">
          {!canCreateDesign && (
            <div className="stage-gate-lock">
              Earlier gates are incomplete. Floor Mat front and rear zones pass
              gates together.
            </div>
          )}
          {designs.length ? (
            designs.map((design) => (
              <DesignCard
                design={design}
                key={design.id}
                onRevision={
                  canCreateDesign
                    ? () => {
                        onRevision(design.id);
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <div className="empty-inline">
              {project.product === 'Seat Cover'
                ? 'No parts linked — select existing parts and link them to the project.'
                : `Registered ${designLabel(project.product)} is missing. Register the design and its first revision.`}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>Visits</CardTitle>
          <Button size="sm" variant="outline" onClick={onOpenVisits}>
            <CalendarPlus /> Schedule Scan / Fitting
          </Button>
        </CardHeader>
        <CardContent>
          {visits.length ? (
            visits.map((visit) => (
              <VisitCard
                users={users}
                visit={visit}
                key={visit.id}
                onOpen={onOpenVisits}
              />
            ))
          ) : (
            <div className="empty-inline">No visits include this zone.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DesignsTabProps {
  project: VehicleProjectGroup;
  zones: readonly ZoneProject[];
  designs: readonly ProjectDesign[];
  stage: ProjectStage;
  canCreateDesign: boolean;
  eligibleProjectIds: readonly string[];
  onAddDesign: (vehicleProjectId: string) => void;
  onRevision: (designId: string) => void;
  onToggleFit: (designId: string) => void;
}

function DesignsTab({
  project,
  zones,
  designs,
  stage,
  canCreateDesign,
  eligibleProjectIds,
  onAddDesign,
  onRevision,
  onToggleFit,
}: DesignsTabProps) {
  return (
    <div className="project-tab-stack">
      <div className="detail-help-text">
        {project.product === 'Seat Cover'
          ? 'Select developed parts and the revisions to use from Part Management. Manage revisions there; fitting verification is recorded separately for each project.'
          : project.product === 'Car Cover'
            ? 'Register one complete pattern per research vehicle. Record pattern changes as new design revisions and check fitting results in the project.'
            : 'Register one mold per zone of the research vehicle. Record mold changes and rescans as new revisions. Surface design lines do not define separate molds.'}
      </div>
      {!canCreateDesign && (
        <div className="stage-gate-lock">
          <strong>Design gate locked</strong>
          Complete prerequisite stages for this zone or required Floor Mat
          bundle before you can
          {project.product === 'Seat Cover' ? 'link parts' : 'register designs'}
          for this project.
        </div>
      )}
      {zones.map((zone) => {
        const zoneCanCreateDesign = eligibleProjectIds.includes(zone.id);
        const zoneDesigns = designs.filter(
          (design) => design.vehicleProjectId === zone.id,
        );
        return (
          <Card className="detail-panel" key={zone.id}>
            <CardHeader>
              <CardTitle>
                <span className={`zone zone-${zone.code.toLowerCase()}`}>
                  {zone.code}
                </span>{' '}
                {zoneLabel(project.product, zone.code)} —{' '}
                {designLabel(project.product)}{' '}
                <small>{zoneDesigns.length} items</small>
              </CardTitle>
              <Button
                size="sm"
                variant="primary"
                disabled={
                  !zoneCanCreateDesign ||
                  (project.product !== 'Seat Cover' && zoneDesigns.length > 0)
                }
                title={
                  zoneCanCreateDesign
                    ? undefined
                    : 'Complete the prerequisite gates for this zone or required Floor Mat bundle first.'
                }
                onClick={() => {
                  onAddDesign(zone.id);
                }}
              >
                <Plus />{' '}
                {project.product === 'Seat Cover'
                  ? 'Link existing part'
                  : `${designLabel(project.product)} Create`}
              </Button>
            </CardHeader>
            <CardContent className="design-list">
              {zoneDesigns.length ? (
                zoneDesigns.map((design) => (
                  <DesignCard
                    design={design}
                    key={design.id}
                    onRevision={
                      zoneCanCreateDesign
                        ? () => {
                            onRevision(design.id);
                          }
                        : undefined
                    }
                    fittingMode={stage === 'Fitting'}
                    onToggleFit={() => {
                      onToggleFit(design.id);
                    }}
                  />
                ))
              ) : (
                <div className="empty-inline">
                  {project.product === 'Seat Cover'
                    ? 'No parts linked — select existing parts and link them to the project.'
                    : `Registered ${designLabel(project.product)} is missing. Register the design and its first revision.`}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface DesignCardProps {
  design: ProjectDesign;
  onRevision?: () => void;
  fittingMode?: boolean;
  onToggleFit?: () => void;
}

function DesignCard({
  design,
  onRevision,
  fittingMode,
  onToggleFit,
}: DesignCardProps) {
  const revision = currentRevision(design);
  const isApproved = isSampleApproved(design);
  const details = design.details;
  const designerId =
    details.kind === 'FLOOR_MAT' ? undefined : details.designedBy;
  return (
    <div className="design-card">
      <div className="design-card-main">
        <div className="design-title-line">
          <strong>{design.name}</strong>
          <StatusBadge
            label={design.fittingConfirmed ? 'Fitting ✓' : 'Fitting —'}
            tone={design.fittingConfirmed ? 'success' : 'neutral'}
          />
          <StatusBadge
            label={
              isApproved
                ? `Sample approved rev ${String(revision.revisionNumber)}`
                : 'Sample approved —'
            }
            tone={isApproved ? 'success' : 'neutral'}
          />
          <span className="revision-chip">Rev {revision.revisionNumber}</span>
        </div>
        <p>
          {details.kind === 'SEAT_COVER'
            ? `${details.partName} · ${details.category} · ${details.side}`
            : details.kind === 'CAR_COVER'
              ? `Car Cover · Research ${details.vehicleResearchId}`
              : `Floor Mat · Zone ${details.vehicleZoneId}`}{' '}
          {details.kind === 'SEAT_COVER'
            ? ` · Qty ${String(design.quantity)}`
            : ''}
          {designerId ? ` · ${designerId}` : ''}
        </p>
        {details.kind === 'SEAT_COVER' && (
          <div className="design-specialized-summary">
            <span>Code {details.seatCoverCodeId}</span>
            <span>Part {details.seatCoverPartId}</span>
            <span>Middle {details.isForMiddleSeat ? 'Yes' : 'No'}</span>
            <span>Custom {details.isCustom ? 'Yes' : 'No'}</span>
          </div>
        )}
        <div className="revision-history-list">
          {[...design.revisions].reverse().map((item) => (
            <div className="revision-history" key={item.id}>
              <strong>Rev {item.revisionNumber}</strong>
              <span>{item.createdAt.slice(0, 10)}</span>
              <span>by {item.createdBy}</span>
              <span>{item.note}</span>
              {item.sampleApprovedAt && (
                <span className="revision-approval-audit">
                  Approved {item.sampleApprovedAt.slice(0, 10)} ·{' '}
                  {item.sampleApprovedBy}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="design-actions">
        {fittingMode && (
          <Button
            size="sm"
            variant={design.fittingConfirmed ? 'primary' : 'outline'}
            onClick={onToggleFit}
          >
            {design.fittingConfirmed ? 'Confirmed' : 'Confirm Fit'}
          </Button>
        )}
        {onRevision && (
          <Button size="sm" variant="outline" onClick={onRevision}>
            Add new revision
          </Button>
        )}
      </div>
    </div>
  );
}

function RevisionControlTab({
  designs,
  sampleItems,
  onRevision,
}: {
  designs: readonly ProjectDesign[];
  sampleItems: readonly SampleRequestItem[];
  onRevision: (designId: string) => void;
}) {
  const [copiedRevisionId, setCopiedRevisionId] = useState('');
  const requests = designs.flatMap((design) =>
    design.revisions.flatMap((revision) =>
      revision.changeRequest
        ? [{ design, revision, request: revision.changeRequest }]
        : [],
    ),
  );
  const revisedIds = new Set(requests.map(({ revision }) => revision.id));
  const verified = sampleItems.filter(
    (item) =>
      revisedIds.has(item.vehicleProductDesignRevisionId) &&
      item.revisionReflected,
  );
  const { exact, percentage: accuracy } = revisionExecutionAccuracy(verified);
  return (
    <div className="project-tab-stack revision-control">
      <div className="detail-help-text">
        Confirm changes per part and generate factory instructions. On receipt,
        verify instruction compliance separately from fitment.
      </div>
      <SummaryCard
        label="Revision implementation accuracy"
        value={accuracy === undefined ? 'Not measured' : `${String(accuracy)}%`}
        description={`Fully implemented ${String(exact)} / verified revision samples ${String(verified.length)} · ${accuracy !== undefined && accuracy >= 95 ? 'Target met' : 'Target'} · At least 95%`}
        icon={<Wrench />}
        tone={accuracy !== undefined && accuracy >= 95 ? 'success' : 'warning'}
      />
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            Part change requests <small>{requests.length}</small>
          </CardTitle>
        </CardHeader>
        <CardContent className="revision-request-list">
          {designs.map((design) => {
            const revision = currentRevision(design);
            return (
              <div className="revision-request-row" key={design.id}>
                <div>
                  <strong>{design.name}</strong>
                  <span>Current rev {revision.revisionNumber}</span>
                </div>
                {revision.changeRequest ? (
                  <StatusBadge label="Instructions ready" tone="success" />
                ) : (
                  <span className="muted-text">No change requests</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onRevision(design.id);
                  }}
                >
                  Create change request
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            Factory change instructions <small>Changed parts only</small>
          </CardTitle>
        </CardHeader>
        <CardContent className="factory-instruction-list">
          {requests.length ? (
            requests.map(({ design, revision, request }) => (
              <article key={revision.id}>
                <header>
                  <strong>
                    {design.name} · Rev {revision.revisionNumber}
                  </strong>
                  <div className="factory-instruction-actions">
                    <StatusBadge label="For dispatch" tone="progress" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const message = [
                          `[Change request] ${design.name} · Rev ${String(revision.revisionNumber)}`,
                          `Issue source: ${request.issueSource}`,
                          `Affected area: ${request.issueArea}`,
                          `Change instructions: ${request.instruction}`,
                          `Reference image: ${request.referenceImageName}`,
                          `Drawing: ${request.previousDxfFileName} → ${request.newDxfFileName}`,
                        ].join('\n');
                        void navigator.clipboard.writeText(message).then(() => {
                          setCopiedRevisionId(revision.id);
                        });
                      }}
                    >
                      {copiedRevisionId === revision.id
                        ? 'Message copied'
                        : 'Copy instructions'}
                    </Button>
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>Issue source</dt>
                    <dd>{request.issueSource}</dd>
                  </div>
                  <div>
                    <dt>Affected area</dt>
                    <dd>{request.issueArea}</dd>
                  </div>
                  <div>
                    <dt>Change instructions</dt>
                    <dd>{request.instruction}</dd>
                  </div>
                  <div>
                    <dt>Issue image</dt>
                    <dd>
                      {request.referenceImageDataUrl && (
                        <img
                          className="revision-reference-image"
                          src={request.referenceImageDataUrl}
                          alt={`${design.name} ${request.issueArea} Issue reference`}
                        />
                      )}
                      {request.referenceImageName}
                    </dd>
                  </div>
                  <div>
                    <dt>Drawing</dt>
                    <dd>
                      {request.previousDxfFileName} → {request.newDxfFileName}
                    </dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <div className="empty-inline">No completed change requests.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RevisionVerification({
  design,
  item,
  onVerify,
}: {
  design: ProjectDesign;
  item: SampleRequestItem;
  onVerify: (
    itemId: string,
    verdict: NonNullable<SampleRequestItem['revisionReflected']>,
    note: string,
  ) => void;
}) {
  const [note, setNote] = useState(item.verificationNote ?? '');
  return (
    <div className="revision-verification">
      <div>
        <strong>{design.name} · Revision verification</strong>
        <span>
          Verify the factory followed the instructions before testing fitment.
        </span>
      </div>
      <textarea
        aria-label={`${design.name} Revision verification notes`}
        placeholder="Record measured dimensions, missing changes, and other verification notes"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      <div className="revision-verdict-actions">
        {(['CORRECT', 'PARTIAL', 'NOT_REFLECTED'] as const).map((verdict) => (
          <Button
            key={verdict}
            size="sm"
            variant={item.revisionReflected === verdict ? 'primary' : 'outline'}
            disabled={!note.trim()}
            onClick={() => {
              onVerify(item.id, verdict, note.trim());
            }}
          >
            {verdict === 'CORRECT'
              ? 'Fully implemented'
              : verdict === 'PARTIAL'
                ? 'Partially implemented'
                : 'Not implemented'}
          </Button>
        ))}
      </div>
      {item.revisionReflected && (
        <StatusBadge
          label={
            item.revisionReflected === 'CORRECT'
              ? 'Ready for fitment testing'
              : 'Factory execution issue · Track separately'
          }
          tone={item.revisionReflected === 'CORRECT' ? 'success' : 'danger'}
        />
      )}
    </div>
  );
}

interface SamplesTabProps {
  stage: ProjectStage;
  onCompleteStage: () => void;
  sampleGate: SampleGate;
  onResolveGate: (tab: DetailTab) => void;
  product: VehicleProjectGroup['product'];
  designs: readonly ProjectDesign[];
  samples: readonly ProjectSample[];
  /** Request lines, each pinned to the revision its round was raised for. */
  sampleItems: readonly SampleRequestItem[];
  canRequestSample: boolean;
  onRequest: () => void;
  /** Mark Shipped: records the shipment and moves the request to SHIPPED. */
  onShip: (sampleId: string, shipment: SampleShipmentDetails) => void;
  /** SHIPPED → ARRIVED → APPROVED. */
  onAdvance: (sampleId: string) => void;
  onApproveDesign: (designId: string) => void;
  onVerifyRevision: (
    itemId: string,
    verdict: NonNullable<SampleRequestItem['revisionReflected']>,
    note: string,
  ) => void;
}

const SAMPLE_STATUS_ORDER: readonly ProjectSample['status'][] = [
  'REQUESTED',
  'SHIPPED',
  'ARRIVED',
  'APPROVED',
];

const SAMPLE_STATUS_GROUPS = [
  {
    status: 'REQUESTED',
    emoji: '📤',
    label: 'Sent',
    description: 'Request sent · Awaiting factory dispatch',
  },
  {
    status: 'SHIPPED',
    emoji: '🚚',
    label: 'In Transit',
    description: 'In transit · Awaiting arrival confirmation',
  },
  {
    status: 'ARRIVED',
    emoji: '📦',
    label: 'Arrived',
    description: 'Arrived · Awaiting inspection and approval',
  },
  {
    status: 'APPROVED',
    emoji: '✅',
    label: 'Approved',
    description: 'Request approved',
  },
] as const;

function SamplesTab({
  stage,
  onCompleteStage,
  sampleGate,
  onResolveGate,
  product,
  designs,
  samples,
  sampleItems,
  canRequestSample,
  onRequest,
  onShip,
  onAdvance,
  onApproveDesign,
  onVerifyRevision,
}: SamplesTabProps) {
  const [shippingSample, setShippingSample] = useState<ProjectSample>();
  const [inspectionRequest, setInspectionRequest] = useState<string>();
  const [inspectionMessage, setInspectionMessage] = useState('');
  // Approval is per revision: a Rev 3 can only be approved once a sample that
  // was actually made from Rev 3 has been received.
  const isRevisionArrived = (design: ProjectDesign) =>
    sampleItems.some(
      (item) =>
        item.vehicleProductDesignRevisionId === currentRevision(design).id &&
        canApproveRevisionSample(currentRevision(design), item),
    );
  const requestedRevisionNumber = (
    sample: ProjectSample,
    design: ProjectDesign,
  ) => {
    const revisionId = sampleItems.find(
      (item) =>
        item.sampleRequestId === sample.id &&
        item.vehicleProductDesignId === design.id,
    )?.vehicleProductDesignRevisionId;
    return (
      design.revisions.find((revision) => revision.id === revisionId)
        ?.revisionNumber ?? currentRevision(design).revisionNumber
    );
  };
  const designsOfSample = (sample: ProjectSample) => {
    const designIds = new Set(
      sampleItems
        .filter((item) => item.sampleRequestId === sample.id)
        .map((item) => item.vehicleProductDesignId),
    );
    return designs.filter((design) => designIds.has(design.id));
  };
  const lineOf = (sample: ProjectSample, design: ProjectDesign) =>
    sampleItems.find(
      (item) =>
        item.sampleRequestId === sample.id &&
        item.vehicleProductDesignId === design.id,
    );
  const canApproveRequest = (sample: ProjectSample) => {
    const items = sampleItems.filter(
      (item) => item.sampleRequestId === sample.id,
    );
    return (
      items.length > 0 &&
      items.every((item) => {
        const design = designs.find(
          (candidate) => candidate.id === item.vehicleProductDesignId,
        );
        const revision = design?.revisions.find(
          (candidate) => candidate.id === item.vehicleProductDesignRevisionId,
        );
        return Boolean(revision) && canApproveRevisionSample(revision, item);
      })
    );
  };
  const gatePassed = canRequestSample && sampleGate.ready;
  const stageCompleted = stage === 'Fitting' || stage === 'Approved';
  const currentRevisionIds = new Set(
    designs.map((design) => currentRevision(design).id),
  );
  const pendingInspection = sampleItems.find(
    (item) =>
      currentRevisionIds.has(item.vehicleProductDesignRevisionId) &&
      ['RECEIVED', 'FACTORY_ISSUE', 'DESIGN_ISSUE'].includes(
        sampleStatus(item),
      ),
  );
  const requestableDesigns = samples.length
    ? designs.filter((design) =>
        isRevisionSampleRequestable(design, sampleItems),
      )
    : designs;
  return (
    <div className="project-tab-stack">
      <section
        className={
          gatePassed
            ? 'sample-progress-summary ready'
            : 'sample-progress-summary'
        }
        aria-label="Sample stage summary"
      >
        <div className="sample-progress-heading">
          <div>
            <span className="project-visit-kicker">
              Current revision · Sample
            </span>
            <h3>
              {gatePassed
                ? stageCompleted
                  ? 'Sample stage complete'
                  : 'Inspection and approval complete · Ready for Fitting'
                : !canRequestSample
                  ? 'Prepare sample request'
                  : 'Sampling in progress'}
            </h3>
            <p>
              {gatePassed
                ? stageCompleted
                  ? 'The Sample stage is complete. Review approvals and previous requests below.'
                  : 'Receipt, inspection, and approval requirements are met. Complete Sample and proceed to fitting.'
                : !canRequestSample
                  ? 'Complete Design for this zone or required bundle first.'
                  : (sampleGate.blockers[0]?.message ??
                    'Check sample progress for the current revision.')}
            </p>
          </div>
          {gatePassed && stage === 'Sample' ? (
            <Button variant="primary" onClick={onCompleteStage}>
              Complete Sample <ChevronRight />
            </Button>
          ) : gatePassed && stageCompleted ? (
            <Button
              variant="outline"
              onClick={() => {
                onResolveGate(stage === 'Fitting' ? 'visits' : 'overview');
              }}
            >
              {stage === 'Fitting'
                ? 'View fitting schedule and results'
                : 'View development completion'}
            </Button>
          ) : !canRequestSample || sampleGate.blockers[0]?.tab === 'designs' ? (
            <Button
              variant="outline"
              onClick={() => {
                onResolveGate('designs');
              }}
            >
              Review Part / Design
            </Button>
          ) : pendingInspection ? (
            <Button
              variant="primary"
              onClick={() => {
                setInspectionMessage('');
                setInspectionRequest(pendingInspection.sampleRequestId);
              }}
            >
              Review receipt and inspection
            </Button>
          ) : null}
        </div>
        {sampleGate.blockers.length > 1 && (
          <details className="sample-progress-blockers">
            <summary>
              Items to review {sampleGate.blockers.length} items
            </summary>
            <ul>
              {sampleGate.blockers.map((blocker, i) => (
                <li key={i}>{blocker.message}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {inspectionMessage && (
        <p role="status" className="text-sm text-green-700">
          {inspectionMessage}
        </p>
      )}
      {product !== 'Floor Mat' && (
        <Card className="detail-panel">
          <CardHeader>
            <CardTitle>
              Sample Approval <small>Approval for current revision</small>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {designs.length ? (
              designs.map((design) => (
                <div className="approval-row" key={design.id}>
                  <span>
                    <strong>{design.name}</strong>{' '}
                    <StatusBadge
                      label={
                        isSampleApproved(design)
                          ? `Approved Rev ${String(currentRevision(design).revisionNumber)}`
                          : 'Not approved'
                      }
                      tone={isSampleApproved(design) ? 'success' : 'neutral'}
                    />
                  </span>
                  {isSampleApproved(design) ? (
                    <small className="revision-approval-audit">
                      {currentRevision(design).sampleApprovedAt?.slice(0, 10)} ·{' '}
                      {currentRevision(design).sampleApprovedBy}
                    </small>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!isRevisionArrived(design) || !canRequestSample}
                      title={
                        isRevisionArrived(design)
                          ? undefined
                          : `Rev ${String(currentRevision(design).revisionNumber)} samples must be received before approval.`
                      }
                      onClick={() => {
                        onApproveDesign(design.id);
                      }}
                    >
                      Approve Rev {currentRevision(design).revisionNumber}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="stage-gate-lock" role="status">
                <strong>
                  Cannot complete Sample without a linked pattern / Design.
                </strong>
                <span>
                  An APPROVED sample request alone does not complete the stage.
                  Register the pattern / Design, then receive and approve its
                  revision sample.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onResolveGate('designs');
                  }}
                >
                  Register pattern / Design
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            Requests <small>{samples.length}</small>
          </CardTitle>
          <Button
            size="sm"
            variant="primary"
            onClick={onRequest}
            disabled={!requestableDesigns.length || !canRequestSample}
            title={
              !canRequestSample
                ? 'Complete the Design gate for the target zone or bundle first.'
                : samples.length && !requestableDesigns.length
                  ? 'Repeat samples require at least one part with a completed change request.'
                  : undefined
            }
          >
            <Plus /> Sample Request
          </Button>
        </CardHeader>
        {!samples.length && (
          <CardContent>
            <div className="empty-inline">
              No requests — {designLabel(product)} select a design and send a
              factory request.
            </div>
          </CardContent>
        )}
      </Card>
      <div className="sample-status-groups">
        {SAMPLE_STATUS_GROUPS.map((group) => {
          const groupedSamples = samples.filter(
            (sample) => sample.status === group.status,
          );
          if (!groupedSamples.length) return null;
          return (
            <details
              className="sample-status-group"
              key={group.status}
              data-status={group.status}
              open
            >
              <summary>
                <span className="sample-status-heading">
                  <span aria-hidden="true" className="text-lg leading-none">
                    {group.emoji}
                  </span>
                  <strong>{group.label}</strong>
                  <span className="sample-status-count">
                    {groupedSamples.length}
                  </span>
                  <small>{group.description}</small>
                </span>
              </summary>
              <div className="sample-status-content">
                {!groupedSamples.length && (
                  <p className="sample-status-empty">
                    No samples in this status.
                  </p>
                )}
                {groupedSamples.map((sample) => (
                  <details className="project-sample-entry" key={sample.id}>
                    <summary>
                      <strong>{sample.id}</strong>
                      <span className="project-sample-factory">
                        {sample.factory}
                      </span>
                      <span>
                        Round {sample.round} · {designsOfSample(sample).length}{' '}
                        items
                      </span>
                      <StatusBadge
                        label={group.label}
                        tone={
                          sample.status === 'APPROVED' ? 'success' : 'neutral'
                        }
                      />
                      <span className="project-sample-inspection-count">
                        {
                          sampleItems.filter(
                            (item) =>
                              item.sampleRequestId === sample.id &&
                              sampleStatus(item) === 'PASSED',
                          ).length
                        }
                        /
                        {
                          sampleItems.filter(
                            (item) => item.sampleRequestId === sample.id,
                          ).length
                        }{' '}
                        Inspection passed
                      </span>
                      <span className="project-visit-expand">
                        Details <ChevronRight aria-hidden="true" />
                      </span>
                    </summary>
                    <Card className="detail-panel">
                      <CardHeader>
                        <CardTitle>
                          {sample.id} · {sample.factory}
                        </CardTitle>
                        <StatusBadge
                          label={group.label}
                          tone={
                            sample.status === 'APPROVED'
                              ? 'success'
                              : sample.status === 'ARRIVED'
                                ? 'purple'
                                : sample.status === 'SHIPPED'
                                  ? 'warning'
                                  : 'progress'
                          }
                        />
                        {sample.status !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !canRequestSample ||
                              (sample.status === 'ARRIVED' &&
                                !canApproveRequest(sample))
                            }
                            title={
                              sample.status === 'ARRIVED' &&
                              !canApproveRequest(sample)
                                ? 'Review receipt, drawing match, and change implementation for each item. Request approval and current revision approval are separate.'
                                : undefined
                            }
                            onClick={() => {
                              if (sample.status === 'REQUESTED')
                                setShippingSample(sample);
                              else onAdvance(sample.id);
                            }}
                          >
                            {sample.status === 'REQUESTED'
                              ? 'Mark Shipped'
                              : sample.status === 'SHIPPED'
                                ? 'Mark Arrived'
                                : 'Approve Request'}
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInspectionMessage('');
                            setInspectionRequest(sample.id);
                          }}
                        >
                          View receipt, inspection, and saved results
                        </Button>
                        <div className="sample-items">
                          {designsOfSample(sample).map((design) => {
                            const line = lineOf(sample, design);
                            // Ready once the revision this line was made from
                            // has its sample approved; until then it is a Sample.
                            const isReady = Boolean(
                              design.revisions.find(
                                (revision) =>
                                  revision.id ===
                                  line?.vehicleProductDesignRevisionId,
                              )?.sampleApprovedAt,
                            );
                            return (
                              <div key={design.id}>
                                <strong>{design.name}</strong>
                                <span>
                                  Rev {requestedRevisionNumber(sample, design)}
                                </span>
                                <StatusBadge
                                  label={isReady ? 'Ready' : 'Sample'}
                                  tone={isReady ? 'success' : 'progress'}
                                />
                                <span>{sampleRoundLabel(sample.round)}</span>
                                {line && (
                                  <InspectionResult item={line} compact />
                                )}
                                {line?.note && (
                                  <small className="sample-line-note">
                                    {line.note}
                                  </small>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {sample.note && (
                          <p className="detail-help-text">{sample.note}</p>
                        )}
                        {sample.shipment && (
                          <ShipmentSummary shipment={sample.shipment} />
                        )}
                        {sample.status === 'ARRIVED' &&
                          sampleItems
                            .filter(
                              (item) => item.sampleRequestId === sample.id,
                            )
                            .map((item) => {
                              const design = designs.find(
                                (candidate) =>
                                  candidate.id === item.vehicleProductDesignId,
                              );
                              const revision = design?.revisions.find(
                                (candidate) =>
                                  candidate.id ===
                                  item.vehicleProductDesignRevisionId,
                              );
                              return design && revision?.changeRequest ? (
                                <RevisionVerification
                                  key={item.id}
                                  design={design}
                                  item={item}
                                  onVerify={onVerifyRevision}
                                />
                              ) : null;
                            })}
                      </CardContent>
                    </Card>
                  </details>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      {inspectionRequest && (
        <InspectionDialog
          requestId={inspectionRequest}
          onClose={() => {
            setInspectionRequest(undefined);
          }}
          onSaved={() => {
            setInspectionMessage(
              "Inspection results saved. Check the current revision's approval status.",
            );
          }}
        />
      )}
      {shippingSample && (
        <ShipmentDialog
          subject={shippingSample.id}
          factory={shippingSample.factory}
          onClose={() => {
            setShippingSample(undefined);
          }}
          onSubmit={(details) => {
            onShip(shippingSample.id, details);
            setShippingSample(undefined);
          }}
        />
      )}
    </div>
  );
}

interface FilesTabProps {
  users: readonly AppUser[];
  assets: readonly ProjectAsset[];
  onAdd: () => void;
}

function FilesTab({ users, assets, onAdd }: FilesTabProps) {
  const types: readonly ProjectAsset['type'][] = [
    'SCAN',
    'PATTERN FILE',
    'PHOTO',
    '3D MODEL',
    'OTHER',
  ];
  return (
    <div className="project-tab-stack">
      <div className="detail-help-text">
        Store files in NAS/Drive; the database keeps only{' '}
        <strong>asset reference</strong>
        as references. SCAN files are shared by the group; PATTERN FILE assets
        link to a revision.
      </div>
      {types.map((type) => {
        const rows = assets.filter((asset) => asset.type === type);
        return (
          <Card className="detail-panel" key={type}>
            <CardHeader>
              <CardTitle>
                {type} <small>{rows.length}</small>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length ? (
                rows.map((asset) => (
                  <div className="asset-row" key={asset.id}>
                    <strong>{asset.name}</strong>
                    <span>
                      {asset.scope} · {asset.date} ·{' '}
                      {userName(users, asset.addedBy)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-inline">No files</div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Button variant="outline" onClick={onAdd}>
        <FilePlus2 /> Add File Reference
      </Button>
    </div>
  );
}

/**
 * Enter/Space activation for a row that is clickable but cannot be a
 * `<button>`, because it may contain its own action buttons.
 */
function rowKeyHandler(onOpen: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };
}

interface VisitsTabProps {
  users: readonly AppUser[];
  visits: readonly ProjectVisit[];
  product: VehicleProjectGroup['product'];
  stage: ProjectStage;
  canScheduleScan: boolean;
  canScheduleFitting: boolean;
  onAdd: (type: ProjectVisit['type']) => void;
  onCancel: (visitId: string) => void;
  onComplete: (visitId: string, result?: 'PASS' | 'FAIL') => void;
}

function VisitsTab({
  users,
  visits,
  product,
  stage,
  canScheduleScan,
  canScheduleFitting,
  onAdd,
  onCancel,
  onComplete,
}: VisitsTabProps) {
  const [type, setType] = useState<ProjectVisit['type']>(() =>
    defaultVisitType(product, stage),
  );
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [limit, setLimit] = useState(10);
  const [upcomingLimit, setUpcomingLimit] = useState(3);
  const { upcoming, past, latest, rounds, cancelled } = visitHistory(
    visits,
    type,
    includeCancelled,
  );
  const name = type === 'SCAN' ? 'Scan' : 'Fitting';
  const canSchedule = type === 'SCAN' ? canScheduleScan : canScheduleFitting;
  const statusLabel = latest
    ? type === 'SCAN'
      ? 'Measurement complete'
      : (latest.result ?? 'No result recorded')
    : upcoming.length
      ? 'Scheduled'
      : 'Pending';
  const tone = latest
    ? type === 'SCAN' || latest.result === 'PASS'
      ? 'success'
      : latest.result === 'FAIL'
        ? 'danger'
        : 'warning'
    : 'neutral';

  function visitRow(visit: ProjectVisit) {
    const scheduled = visit.status === 'SCHEDULED';
    const result =
      visit.status === 'CANCELLED'
        ? 'Cancelled'
        : scheduled
          ? 'Scheduled'
          : visit.type === 'FITTING'
            ? (visit.result ?? 'No result recorded')
            : 'Measurement complete';
    return (
      <details className="project-visit-entry" key={visit.id}>
        <summary>
          <span className="project-visit-date">
            {visit.date} · {visit.time}
          </span>
          <span className="project-visit-place">{visit.dealer}</span>
          <span className="project-visit-staff">
            {visit.staffIds?.length
              ? visit.staffIds.map((id) => userName(users, id)).join(', ')
              : 'Unassigned'}
          </span>
          {type === 'FITTING' && rounds.has(visit.id) && (
            <span className="project-visit-round">
              Round {rounds.get(visit.id)}
            </span>
          )}
          <StatusBadge
            label={result}
            tone={
              result === 'PASS' || result === 'Measurement complete'
                ? 'success'
                : result === 'FAIL'
                  ? 'danger'
                  : scheduled
                    ? 'warning'
                    : 'neutral'
            }
          />
          <span className="project-visit-expand">
            Details <ChevronRight aria-hidden="true" />
          </span>
        </summary>
        <VisitCard
          users={users}
          visit={visit}
          onCancel={
            scheduled
              ? () => {
                  onCancel(visit.id);
                }
              : undefined
          }
          onComplete={
            scheduled
              ? (result) => {
                  onComplete(visit.id, result);
                }
              : undefined
          }
        />
      </details>
    );
  }

  return (
    <Card className="detail-panel project-visits">
      <CardHeader>
        <CardTitle>
          Visits{' '}
          <small>Scan and fitting progress and history for this project</small>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={type}
          onValueChange={(value) => {
            setType(value as ProjectVisit['type']);
            setLimit(10);
            setUpcomingLimit(3);
          }}
        >
          <TabsList variant="button" aria-label="Visit type">
            {product !== 'Car Cover' && (
              <TabsTrigger value="SCAN">
                <ScanLine aria-hidden="true" /> Scan
              </TabsTrigger>
            )}
            <TabsTrigger value="FITTING">
              <Wrench aria-hidden="true" /> Fitting
            </TabsTrigger>
          </TabsList>
          <TabsContent value={type} key={type}>
            {product === 'Car Cover' && (
              <p className="project-visit-hint">
                Car Cover uses 3D Model and Fit Review, so the on-site Scan tab
                is hidden.
              </p>
            )}
            <div className="project-visit-current">
              <div>
                <span className="project-visit-kicker">
                  {name} Current status
                </span>
                <div className="project-visit-status">
                  <StatusBadge label={statusLabel} tone={tone} />
                  <strong>
                    {latest
                      ? 'Based on the latest completed visit'
                      : upcoming.length
                        ? 'A visit is scheduled'
                        : 'No completed visits yet'}
                  </strong>
                </div>
                <p>
                  {latest
                    ? `${latest.date} · ${latest.dealer}`
                    : 'Bookings and actual completion are recorded separately.'}
                </p>
                {latest && (
                  <small>
                    Check NEXT ACTION above for current revision eligibility and
                    next-stage requirements.
                  </small>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={!canSchedule}
                title={
                  canSchedule
                    ? undefined
                    : `${name} Complete the stage requirements first.`
                }
                onClick={() => {
                  onAdd(type);
                }}
              >
                <Plus /> {name} Schedule visit
              </Button>
            </div>
            <section className="project-visit-section">
              <h3>
                <CalendarClock aria-hidden="true" /> Next visit{' '}
                <span>{upcoming.length} items</span>
              </h3>
              {upcoming[0] ? (
                <>
                  <VisitCard
                    users={users}
                    visit={upcoming[0]}
                    onCancel={() => {
                      onCancel(upcoming[0].id);
                    }}
                    onComplete={(result) => {
                      onComplete(upcoming[0].id, result);
                    }}
                  />
                  {upcoming.slice(1, upcomingLimit).map(visitRow)}
                  {upcoming.length > upcomingLimit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUpcomingLimit((n) => n + 10);
                      }}
                    >
                      More upcoming visits ({upcoming.length - upcomingLimit}
                      items)
                    </Button>
                  )}
                </>
              ) : (
                <p className="empty-inline">
                  Upcoming {name} visits are not available.
                </p>
              )}
            </section>
            <section className="project-visit-section">
              <div className="project-visit-history-heading">
                <h3>
                  <History aria-hidden="true" /> Past visits{' '}
                  <span>{past.length} items · Newest first</span>
                </h3>
                <label className="project-visit-cancelled">
                  <Checkbox
                    checked={includeCancelled}
                    onCheckedChange={(value) => {
                      setIncludeCancelled(value === true);
                      setLimit(10);
                    }}
                  />{' '}
                  Include cancelled ({cancelled})
                </label>
              </div>
              <p className="project-visit-hint">
                Expand a row to see details.
                {type === 'FITTING'
                  ? ' Fitting rounds follow the actual order of completed visits and are separate from sample rounds.'
                  : ''}
              </p>
              {past.length ? (
                past.slice(0, limit).map(visitRow)
              ) : (
                <p className="empty-inline">
                  Available {name} history is empty.
                </p>
              )}
              {past.length > limit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLimit((n) => n + 10);
                  }}
                >
                  Show 10 more records ({past.length - limit} remaining)
                </Button>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface VisitCardProps {
  users: readonly AppUser[];
  visit: ProjectVisit;
  onCancel?: () => void;
  onComplete?: (result?: 'PASS' | 'FAIL') => void;
  /** Set where the card is a shortcut to the Visits tab. */
  onOpen?: () => void;
}

function VisitCard({
  users,
  visit,
  onCancel,
  onComplete,
  onOpen,
}: VisitCardProps) {
  return (
    <div
      className={onOpen ? 'visit-card row-link' : 'visit-card'}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? rowKeyHandler(onOpen) : undefined}
    >
      <div className="visit-card-heading">
        <strong className={visit.type === 'SCAN' ? 'scan' : 'fitting'}>
          {visit.type === 'SCAN' ? (
            <ScanLine aria-hidden="true" />
          ) : (
            <Wrench aria-hidden="true" />
          )}
          {visit.type}
        </strong>
        <StatusBadge
          label={visit.status}
          tone={
            visit.status === 'COMPLETED'
              ? 'success'
              : visit.status === 'CANCELLED'
                ? 'neutral'
                : 'warning'
          }
        />
      </div>
      <h3>{visit.dealer}</h3>
      <p>
        {visit.date} · {visit.time} ·{' '}
        {visit.staffIds?.length
          ? visit.staffIds.map((id) => userName(users, id)).join(', ')
          : 'Unassigned'}
      </p>
      <dl>
        <dt>Location</dt>
        <dd>{visit.locationType ?? 'DEALERSHIP'}</dd>
        <dt>Priority</dt>
        <dd>{visit.priority ?? 'NORMAL'}</dd>
        {visit.performedAt && (
          <>
            <dt>Performed</dt>
            <dd>{new Date(visit.performedAt).toLocaleString('en-US')}</dd>
          </>
        )}
        {visit.targetVehicleResearchId && (
          <>
            <dt>Target Vehicle</dt>
            <dd>{visit.targetVehicleResearchId}</dd>
          </>
        )}
        {visit.note && (
          <>
            <dt>Note</dt>
            <dd>{visit.note}</dd>
          </>
        )}
        <dt>Projects</dt>
        <dd>
          <span className="zone-list">
            {visit.vehicleProjectIds.map((vehicleProjectId) => (
              <span className="zone-project-reference" key={vehicleProjectId}>
                {vehicleProjectId}
              </span>
            ))}
          </span>
        </dd>
        {visit.result && (
          <>
            <dt>Result</dt>
            <dd>{visit.result}</dd>
          </>
        )}
      </dl>
      {visit.status === 'SCHEDULED' && (
        <div className="visit-card-actions">
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {onComplete && visit.type === 'SCAN' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onComplete();
              }}
            >
              Complete Scan
            </Button>
          )}
          {onComplete && visit.type === 'FITTING' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onComplete('FAIL');
                }}
              >
                Fail
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onComplete('PASS');
                }}
              >
                Pass
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityTabProps {
  activity: readonly ActivityItem[];
}

function ActivityTab({ activity }: ActivityTabProps) {
  const entries: readonly ActivityEntry[] = activity.map((item) => ({
    id: item.id,
    type: 'SYSTEM_LOG',
    message: `${item.title} — ${item.detail}`,
    createdAt: `2026-${item.date}T${item.time}:00-07:00`,
  }));

  return (
    <Activity
      entries={entries}
      title="Activity Timeline"
      emptyMessage="No activity yet."
      systemAuthorLabel="Coverland System"
      className="project-activity-feed"
    />
  );
}

interface ProjectDialogProps {
  initialVisitType?: ProjectVisit['type'];
  handoffZoneCodes: string;
  handoffDraft?: HandoffChecklist;
  onHandoffDraft: (value: HandoffChecklist) => void;
  handoffErrors: readonly string[];
  configurations: readonly VehicleConfiguration[];
  allDesigns: readonly ProjectDesign[];
  users: readonly AppUser[];
  /** seat_cover_part / seat_cover_code dictionaries, read from the store. */
  seatCoverParts: readonly SeatCoverPart[];
  seatCoverCodes: readonly SeatCoverCode[];
  dialog?: DialogName;
  project: VehicleProjectGroup;
  zones: readonly ZoneProject[];
  designs: readonly ProjectDesign[];
  samples: readonly ProjectSample[];
  sampleItems: readonly SampleRequestItem[];
  canRequestSample: boolean;
  canScheduleScan: boolean;
  canScheduleFitting: boolean;
  designEligibleProjectIds: readonly string[];
  sampleEligibleProjectIds: readonly string[];
  scanEligibleProjectIds: readonly string[];
  fittingEligibleProjectIds: readonly string[];
  dialogZone?: string;
  dialogDesignId?: string;
  onClose: () => void;
  onDesign: (input: NewDesignInput) => void;
  onRevision: (
    designId: string,
    note: string,
    createdBy: string,
    changeRequest: NonNullable<ProjectDesignRevision['changeRequest']>,
  ) => void;
  onVisit: (input: NewVisitInput) => void;
  onSample: (input: NewSampleInput) => void;
  onFile: (name: string, type: ProjectAsset['type']) => void;
  onConfiguration: (
    title: string,
    value: string,
    mode: 'NEW' | 'FIX',
    note: string,
  ) => void;
  onPromote: (checklist: HandoffChecklist) => void;
}

function ProjectDialog({
  initialVisitType,
  handoffZoneCodes,
  handoffDraft,
  onHandoffDraft,
  handoffErrors,
  configurations,
  allDesigns,
  users,
  seatCoverParts,
  seatCoverCodes,
  dialog,
  project,
  zones,
  designs,
  samples,
  sampleItems,
  canRequestSample,
  canScheduleScan,
  canScheduleFitting,
  designEligibleProjectIds,
  sampleEligibleProjectIds,
  scanEligibleProjectIds,
  fittingEligibleProjectIds,
  dialogZone,
  dialogDesignId,
  onClose,
  onDesign,
  onRevision,
  onVisit,
  onSample,
  onFile,
  onConfiguration,
  onPromote,
}: ProjectDialogProps) {
  const [handoffValue, setHandoffValue] = useState<HandoffChecklist>(
    () => handoffDraft ?? emptyHandoffChecklist(),
  );
  const [handoffBeforeTest, setHandoffBeforeTest] =
    useState<HandoffChecklist>();
  const [zone, setZone] = useState(
    dialogZone ??
      (dialog === 'design'
        ? designEligibleProjectIds.slice(0, 1).pop()
        : undefined) ??
      zones.slice(0, 1).pop()?.id ??
      '',
  );
  const selectedZone = zones.find((item) => item.id === (dialogZone ?? zone));
  const [designName, setDesignName] = useState(
    project.product === 'Seat Cover' ? 'FH-J-D' : '',
  );
  const [designQuantity, setDesignQuantity] = useState('1');
  const [designerId, setDesignerId] = useState('USR-JH');
  const [revisionNote, setRevisionNote] = useState(
    dialog === 'revision'
      ? ''
      : project.product === 'Floor Mat'
        ? 'Initial mold'
        : 'Initial pattern',
  );
  const [revisionCreatedBy, setRevisionCreatedBy] = useState('USR-JH');
  const [initialDxfName, setInitialDxfName] = useState('');
  const [initialDxfFingerprint, setInitialDxfFingerprint] = useState('');
  const [revisionIssueSource, setRevisionIssueSource] = useState(
    'First sample fitting test',
  );
  const [revisionIssueArea, setRevisionIssueArea] = useState('');
  const [revisionInstruction, setRevisionInstruction] = useState('');
  const [revisionImageName, setRevisionImageName] = useState('');
  const [revisionImageDataUrl, setRevisionImageDataUrl] = useState('');
  const [baselineDxfName, setBaselineDxfName] = useState('');
  const [baselineDxfFingerprint, setBaselineDxfFingerprint] = useState('');
  const [newDxfName, setNewDxfName] = useState('');
  const [newDxfFingerprint, setNewDxfFingerprint] = useState('');
  const [designerConfirmed, setDesignerConfirmed] = useState(false);
  const [seatCoverPartId, setSeatCoverPartId] = useState('PART-FRONT-HEADREST');
  const [seatCoverCodeId, setSeatCoverCodeId] = useState('SCC-BUCKET-01');
  const [seatSide, setSeatSide] = useState<
    'DRIVER' | 'PASSENGER' | 'CENTER' | 'UNIVERSAL'
  >('UNIVERSAL');
  const [isForMiddleSeat, setIsForMiddleSeat] = useState(false);
  const [isCustomPart, setIsCustomPart] = useState(false);
  const [visitType, setVisitType] = useState<ProjectVisit['type']>(
    initialVisitType ??
      (canScheduleFitting && selectedZone?.currentStage === 'Fitting'
        ? 'FITTING'
        : canScheduleScan
          ? 'SCAN'
          : 'FITTING'),
  );
  const [dealer, setDealer] = useState<(typeof DEALERS)[number]>('Galpin Ford');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [time, setTime] = useState('10:00');
  const [selectedProjectIds, setSelectedProjectIds] = useState<
    readonly string[]
  >(dialogZone ? [dialogZone] : []);
  const [staffIds, setStaffIds] = useState<readonly string[]>([]);
  const [locationType, setLocationType] =
    useState<NonNullable<ProjectVisit['locationType']>>('DEALERSHIP');
  const [priority, setPriority] =
    useState<NonNullable<ProjectVisit['priority']>>('NORMAL');
  const [visitNote, setVisitNote] = useState('');
  const [targetVehicleResearchId, setTargetVehicleResearchId] = useState(
    project.vehicleResearchId,
  );
  const [factory, setFactory] =
    useState<(typeof FACTORIES)[number]>('Tianhong');
  const sampleCandidates = designs.filter(
    (design) =>
      sampleEligibleProjectIds.includes(design.vehicleProjectId) &&
      (!samples.length || isRevisionSampleRequestable(design, sampleItems)),
  );
  const [sampleNote, setSampleNote] = useState('');
  const [sampleLines, setSampleLines] = useState<
    Readonly<Record<string, ProjectSampleLine | undefined>>
  >(() =>
    Object.fromEntries(
      sampleCandidates.map((design) => [design.id, { designId: design.id }]),
    ),
  );
  const includedSampleLines = Object.values(sampleLines).filter(
    (line): line is ProjectSampleLine => line !== undefined,
  );
  const [fileName, setFileName] = useState(
    project.stage === '3D Model' ? 'vehicle_3d_model.obj' : 'RAV4_scan_v2.stl',
  );
  const [fileType, setFileType] = useState<ProjectAsset['type']>(
    project.stage === '3D Model' ? '3D MODEL' : 'SCAN',
  );
  const [configurationTitle, setConfigurationTitle] =
    useState('Under-seat Storage');
  const [configurationValue, setConfigurationValue] = useState('With Storage');
  const [configurationMode, setConfigurationMode] = useState<'NEW' | 'FIX'>(
    'NEW',
  );
  const [configurationNote, setConfigurationNote] = useState('');

  const effectiveZone = dialogZone ?? zone;
  const effectiveDesignGateUnlocked =
    designEligibleProjectIds.includes(effectiveZone);
  const designIdentityExists =
    project.product !== 'Seat Cover' &&
    hasDesignIdentity(
      allDesigns,
      project.product === 'Car Cover'
        ? {
            kind: 'CAR_COVER',
            vehicleResearchId: project.vehicleResearchId,
            designedBy: designerId,
          }
        : {
            kind: 'FLOOR_MAT',
            vehicleResearchId: project.vehicleResearchId,
            vehicleZoneId: selectedZone?.zoneId ?? '',
          },
    );
  const designNameExists = allDesigns.some(
    (item) => item.name.toLowerCase() === designName.trim().toLowerCase(),
  );
  const revisionDesign = designs.find((design) => design.id === dialogDesignId);
  const previousRevision = revisionDesign
    ? currentRevision(revisionDesign)
    : undefined;
  const previousDxfName = previousRevision?.dxfFileName ?? baselineDxfName;
  const previousDxfFingerprint =
    previousRevision?.dxfFingerprint ?? baselineDxfFingerprint;
  const revisionFilesAreSame = Boolean(
    previousDxfFingerprint &&
    newDxfFingerprint &&
    !isChangedDxf(previousDxfFingerprint, newDxfFingerprint),
  );
  const revisionRequestValid = Boolean(
    revisionIssueSource.trim() &&
    revisionIssueArea.trim() &&
    revisionInstruction.trim() &&
    revisionImageName &&
    previousRevision &&
    previousDxfName &&
    previousDxfFingerprint &&
    newDxfName &&
    newDxfFingerprint &&
    !revisionFilesAreSame &&
    designerConfirmed,
  );
  const visitEligibleProjectIds =
    visitType === 'SCAN' ? scanEligibleProjectIds : fittingEligibleProjectIds;
  const visitGateUnlocked = visitEligibleProjectIds.length > 0;
  const dialogTitles: Record<DialogName, string> = {
    'new-configuration': 'New Configuration Found',
    design: `${designLabel(project.product)} Registered · Revision 1`,
    revision: `${designLabel(project.product)} · New revision added`,
    visit: 'Schedule Visit',
    sample: 'Sample Request',
    file: 'Add File Reference',
    promote: 'Record handoff completion',
  };

  function submit(): void {
    if (!dialog) {
      return;
    }
    if (dialog === 'design') {
      if (
        !effectiveDesignGateUnlocked ||
        designIdentityExists ||
        designNameExists ||
        !designName.trim() ||
        !revisionNote.trim() ||
        !initialDxfName ||
        !initialDxfFingerprint
      )
        return;
      const zoneProject = zones.find((item) => item.id === effectiveZone);
      if (!zoneProject) return;
      const selectedPart = seatCoverParts.find(
        (item) => item.id === seatCoverPartId,
      );
      const details: ProjectDesign['details'] =
        project.product === 'Seat Cover'
          ? {
              kind: 'SEAT_COVER',
              vehicleResearchId: project.vehicleResearchId,
              seatCoverPartId,
              seatCoverCodeId,
              partName: selectedPart?.name ?? seatCoverPartId,
              category: selectedPart?.category ?? 'OTHER',
              side: seatSide,
              isForMiddleSeat,
              isCustom: isCustomPart,
              designedBy: designerId,
            }
          : project.product === 'Car Cover'
            ? {
                kind: 'CAR_COVER',
                vehicleResearchId: project.vehicleResearchId,
                designedBy: designerId,
              }
            : {
                kind: 'FLOOR_MAT',
                vehicleResearchId: project.vehicleResearchId,
                vehicleZoneId: zoneProject.zoneId,
              };
      onDesign({
        vehicleProjectId: effectiveZone,
        name: designName.trim(),
        quantity: project.product === 'Seat Cover' ? Number(designQuantity) : 1,
        details,
        revisionNote: revisionNote.trim(),
        revisionCreatedBy,
        dxfFileName: initialDxfName,
        dxfFingerprint: initialDxfFingerprint,
      });
    } else if (dialog === 'revision' && dialogDesignId) {
      if (!previousRevision || !revisionRequestValid) return;
      onRevision(dialogDesignId, revisionNote.trim(), revisionCreatedBy, {
        issueSource: revisionIssueSource.trim(),
        issueArea: revisionIssueArea.trim(),
        instruction: revisionInstruction.trim(),
        referenceImageName: revisionImageName,
        ...(revisionImageDataUrl
          ? { referenceImageDataUrl: revisionImageDataUrl }
          : {}),
        previousRevisionId: previousRevision.id,
        previousDxfFileName: previousDxfName,
        previousDxfFingerprint,
        newDxfFileName: newDxfName,
        newDxfFingerprint,
        designerConfirmed: true,
        confirmedBy: revisionCreatedBy,
        confirmedAt: new Date().toISOString(),
      });
    } else if (dialog === 'visit') {
      const vehicleProjectIds = selectedProjectIds.filter((id) =>
        visitEligibleProjectIds.includes(id),
      );
      if (!vehicleProjectIds.length || !date || !time) return;
      onVisit({
        type: visitType,
        dealer:
          locationType === 'DEALERSHIP'
            ? dealer
            : locationType.replace('_', ' '),
        date,
        time,
        vehicleProjectIds,
        staffIds,
        locationType,
        priority,
        note: visitNote.trim(),
        targetVehicleResearchId,
      });
    } else if (dialog === 'sample') {
      onSample({
        factory,
        note: sampleNote.trim(),
        lines: includedSampleLines,
      });
    } else if (dialog === 'file') {
      onFile(fileName.trim(), fileType);
    } else if (dialog === 'new-configuration') {
      onConfiguration(
        configurationTitle,
        configurationValue,
        configurationMode,
        configurationNote.trim(),
      );
    } else {
      if (!handoffChecklistErrors(handoffValue).length && !handoffErrors.length)
        onPromote(handoffValue);
    }
  }

  return (
    <Dialog
      open={Boolean(dialog)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="project-action-dialog">
        <DialogHeader>
          <DialogTitle>{dialog ? dialogTitles[dialog] : ''}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {dialog === 'new-configuration' && (
            <div className="project-dialog-stack">
              <div className="dialog-vehicle-summary">
                <span>Current Research Configuration</span>
                <strong>{project.vehicle}</strong>
                <ConfigChips options={project.options} />
              </div>
              <div className="dialog-form-grid">
                <label>
                  Option
                  <Select
                    value={configurationTitle}
                    onValueChange={setConfigurationTitle}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Powertrain">Powertrain</SelectItem>
                      <SelectItem value="Seats">Seats</SelectItem>
                      <SelectItem value="Front Seat">Front Seat</SelectItem>
                      <SelectItem value="2nd Row Seat">2nd Row Seat</SelectItem>
                      <SelectItem value="Under-seat Storage">
                        Under-seat Storage
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Value
                  <Select
                    value={configurationValue}
                    onValueChange={setConfigurationValue}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="With Storage">With Storage</SelectItem>
                      <SelectItem value="No Storage">No Storage</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="Gas">Gas</SelectItem>
                      <SelectItem value="Captain">Captain</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <fieldset className="configuration-mode-options">
                <legend>How should this be handled?</legend>
                <label>
                  <input
                    type="radio"
                    name="configuration-mode"
                    checked={configurationMode === 'NEW'}
                    onChange={() => {
                      setConfigurationMode('NEW');
                    }}
                  />
                  <span>
                    <strong>Create another Configuration</strong>
                    <small>
                      Different actual option combination — create a separate
                      research configuration
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="configuration-mode"
                    checked={configurationMode === 'FIX'}
                    onChange={() => {
                      setConfigurationMode('FIX');
                    }}
                  />
                  <span>
                    <strong>Correct current Research information</strong>
                    <small>
                      Incorrect research information — record in audit history
                    </small>
                  </span>
                </label>
              </fieldset>
              <label className="dialog-field-label">
                Reason / Notes
                <Input
                  value={configurationNote}
                  onChange={(event) => {
                    setConfigurationNote(event.target.value);
                  }}
                  placeholder="Example: Dealer confirmed the storage option was recorded incorrectly"
                />
              </label>
            </div>
          )}
          {dialog === 'design' && (
            <div className="project-dialog-stack">
              <div className="dialog-note">
                {project.product === 'Seat Cover'
                  ? 'Register the part design, quantity, and details.'
                  : project.product === 'Car Cover'
                    ? 'Register the full vehicle pattern. Manage changes for the same research vehicle as new revisions.'
                    : 'Register the mold for the selected vehicle zone. Manage mold changes and rescans as new revisions.'}{' '}
                Revision 1 is created automatically.
              </div>
              {designIdentityExists && (
                <p role="alert">
                  The same research vehicle
                  {project.product === 'Floor Mat' ? '/ zone' : ''} already has
                  a design. Add a new revision to the existing design.
                </p>
              )}
              {designNameExists && (
                <p role="alert">This design name is already in use.</p>
              )}
              <div className="dialog-form-grid">
                <label>
                  Zone Project
                  <Select
                    value={effectiveZone}
                    onValueChange={setZone}
                    disabled={Boolean(dialogZone)}
                  >
                    <SelectTrigger aria-label="Design Zone Project">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((item) => (
                        <SelectItem
                          value={item.id}
                          key={item.id}
                          disabled={!designEligibleProjectIds.includes(item.id)}
                        >
                          {item.code} · {item.label} · {item.id}
                          {!designEligibleProjectIds.includes(item.id) &&
                            ' · Gate locked'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  {project.product === 'Floor Mat'
                    ? 'Mold name'
                    : 'Pattern name'}
                  <Input
                    value={designName}
                    onChange={(event) => {
                      setDesignName(event.target.value);
                    }}
                  />
                </label>
                {project.product === 'Seat Cover' && (
                  <label>
                    Project Quantity
                    <Input
                      type="number"
                      value={designQuantity}
                      min="1"
                      onChange={(event) => {
                        setDesignQuantity(event.target.value);
                      }}
                    />
                  </label>
                )}
                {project.product !== 'Floor Mat' && (
                  <label>
                    Designer
                    <Select value={designerId} onValueChange={setDesignerId}>
                      <SelectTrigger aria-label="Designer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DESIGNERS.map((designer) => (
                          <SelectItem value={designer.id} key={designer.id}>
                            {designer.name} · {designer.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
              </div>

              {project.product === 'Seat Cover' && (
                <fieldset className="design-specialized-fields">
                  <legend>Seat Cover Details</legend>
                  <label>
                    Seat Cover Code
                    <Select
                      value={seatCoverCodeId}
                      onValueChange={setSeatCoverCodeId}
                    >
                      <SelectTrigger aria-label="Seat Cover Code">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seatCoverCodes.map((code) => (
                          <SelectItem value={code.id} key={code.id}>
                            {code.code} · {code.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Seat Cover Part
                    <Select
                      value={seatCoverPartId}
                      onValueChange={setSeatCoverPartId}
                    >
                      <SelectTrigger aria-label="Seat Cover Part">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seatCoverParts.map((partItem) => (
                          <SelectItem value={partItem.id} key={partItem.id}>
                            {partItem.name} · {partItem.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Side
                    <Select
                      value={seatSide}
                      onValueChange={(value) => {
                        setSeatSide(
                          value as
                            'DRIVER' | 'PASSENGER' | 'CENTER' | 'UNIVERSAL',
                        );
                      }}
                    >
                      <SelectTrigger aria-label="Seat Cover Side">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRIVER">Driver</SelectItem>
                        <SelectItem value="PASSENGER">Passenger</SelectItem>
                        <SelectItem value="CENTER">Center</SelectItem>
                        <SelectItem value="UNIVERSAL">Universal</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="design-boolean-fields">
                    <label>
                      <Checkbox
                        checked={isForMiddleSeat}
                        onCheckedChange={(checked) => {
                          setIsForMiddleSeat(Boolean(checked));
                        }}
                      />
                      Middle seat part
                    </label>
                    <label>
                      <Checkbox
                        checked={isCustomPart}
                        onCheckedChange={(checked) => {
                          setIsCustomPart(Boolean(checked));
                        }}
                      />
                      Custom part
                    </label>
                  </div>
                </fieldset>
              )}

              {project.product === 'Car Cover' && (
                <div className="dialog-vehicle-summary">
                  <span>Car Cover Design Detail</span>
                  <strong>Research {project.vehicleResearchId}</strong>
                  <small>Designed by {designerId}</small>
                </div>
              )}

              {project.product === 'Floor Mat' && (
                <div className="dialog-vehicle-summary">
                  <span>Floor Mat Design Detail</span>
                  <strong>
                    Vehicle Zone{' '}
                    {zones.find((item) => item.id === effectiveZone)?.zoneId}
                  </strong>
                  <small>Research {project.vehicleResearchId}</small>
                </div>
              )}

              <fieldset className="design-revision-fields">
                <legend>Revision 1</legend>
                <label>
                  Revision Author
                  <Select
                    value={revisionCreatedBy}
                    onValueChange={setRevisionCreatedBy}
                  >
                    <SelectTrigger aria-label="Revision Author">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESIGNERS.map((designer) => (
                        <SelectItem value={designer.id} key={designer.id}>
                          {designer.name} · {designer.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Revision Note
                  <Input
                    value={revisionNote}
                    onChange={(event) => {
                      setRevisionNote(event.target.value);
                    }}
                  />
                </label>
                <label>
                  Revision 1 DXF
                  <Input
                    type="file"
                    accept=".dxf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        setInitialDxfName('');
                        setInitialDxfFingerprint('');
                        return;
                      }
                      setInitialDxfName(file.name);
                      void fileFingerprint(file).then(setInitialDxfFingerprint);
                    }}
                  />
                </label>
              </fieldset>
            </div>
          )}
          {dialog === 'revision' && dialogDesignId && (
            <div className="project-dialog-stack">
              <div className="dialog-vehicle-summary">
                <span>Vehicle Product Design</span>
                <strong>
                  {designs.find((design) => design.id === dialogDesignId)?.name}
                </strong>
                <small>
                  Current Rev {previousRevision?.revisionNumber ?? '—'}
                </small>
              </div>
              <div className="dialog-form-grid">
                <label>
                  Revision Author
                  <Select
                    value={revisionCreatedBy}
                    onValueChange={setRevisionCreatedBy}
                  >
                    <SelectTrigger aria-label="Revision Author">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESIGNERS.map((designer) => (
                        <SelectItem value={designer.id} key={designer.id}>
                          {designer.name} · {designer.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Revision Note
                  <Input
                    value={revisionNote}
                    onChange={(event) => {
                      setRevisionNote(event.target.value);
                    }}
                    placeholder="Enter a reason for the change"
                  />
                </label>
                <label>
                  Issue source
                  <Input
                    value={revisionIssueSource}
                    onChange={(event) => {
                      setRevisionIssueSource(event.target.value);
                    }}
                    placeholder="Example: First sample fitting test"
                  />
                </label>
                <label>
                  Affected area
                  <Input
                    value={revisionIssueArea}
                    onChange={(event) => {
                      setRevisionIssueArea(event.target.value);
                    }}
                    placeholder="Example: Lower backrest"
                  />
                </label>
                <label className="full-width">
                  Change description
                  <textarea
                    className="revision-instruction-textarea"
                    value={revisionInstruction}
                    onChange={(event) => {
                      setRevisionInstruction(event.target.value);
                    }}
                    placeholder="Describe what to change, where, and by how much. Example: Extend the marked lower pattern by 10 mm"
                  />
                </label>
                <label>
                  Reference image
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        setRevisionImageName('');
                        setRevisionImageDataUrl('');
                        return;
                      }
                      setRevisionImageName(file.name);
                      void fileDataUrl(file).then(setRevisionImageDataUrl);
                    }}
                  />
                </label>
                <div className="revision-previous-reference">
                  <span>Previous revision · Linked automatically</span>
                  <strong>
                    {previousRevision
                      ? `Rev ${String(previousRevision.revisionNumber)}`
                      : '—'}
                  </strong>
                  <small>
                    {previousRevision?.dxfFileName ??
                      'No baseline DXF is available. Register it below once.'}
                  </small>
                </div>
                {previousRevision && !previousRevision.dxfFingerprint && (
                  <label>
                    Previous revision baseline DXF
                    <Input
                      type="file"
                      accept=".dxf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          setBaselineDxfName('');
                          setBaselineDxfFingerprint('');
                          return;
                        }
                        setBaselineDxfName(file.name);
                        void fileFingerprint(file).then(
                          setBaselineDxfFingerprint,
                        );
                      }}
                    />
                  </label>
                )}
                <label>
                  New DXF file
                  <Input
                    type="file"
                    accept=".dxf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        setNewDxfName('');
                        setNewDxfFingerprint('');
                        return;
                      }
                      setNewDxfName(file.name);
                      void fileFingerprint(file).then(setNewDxfFingerprint);
                    }}
                  />
                </label>
                {revisionFilesAreSame && (
                  <p className="revision-file-error" role="alert">
                    This is the same DXF as the previous revision. Select the
                    actual revised file.
                  </p>
                )}
                <label className="revision-designer-confirmation full-width">
                  <Checkbox
                    checked={designerConfirmed}
                    onCheckedChange={(checked) => {
                      setDesignerConfirmed(Boolean(checked));
                    }}
                  />
                  The designer confirms the change description, reference image,
                  and new DXF agree.
                </label>
              </div>
              <div className="dialog-note">
                Once required information is confirmed, factory instructions are
                generated for changed parts. The new revision remains unapproved
                until sample receipt and implementation verification.
              </div>
            </div>
          )}
          {dialog === 'visit' && (
            <div className="project-dialog-stack">
              <div className="dialog-form-grid">
                <label>
                  Location Type
                  <Select
                    value={locationType}
                    onValueChange={(value) => {
                      setLocationType(
                        value as NonNullable<ProjectVisit['locationType']>,
                      );
                    }}
                  >
                    <SelectTrigger aria-label="Location Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'DEALERSHIP',
                        'OWNER_VEHICLE',
                        'OFFICE',
                        'FACTORY',
                        'OTHER',
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Priority
                  <Select
                    value={priority}
                    onValueChange={(value) => {
                      setPriority(value as 'NORMAL' | 'URGENT');
                    }}
                  >
                    <SelectTrigger aria-label="Priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Target Vehicle
                  <Select
                    value={targetVehicleResearchId || 'NOT_REFLECTED'}
                    onValueChange={(value) => {
                      setTargetVehicleResearchId(
                        value === 'NOT_REFLECTED' ? '' : value,
                      );
                    }}
                  >
                    <SelectTrigger aria-label="Target Vehicle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Not specified</SelectItem>
                      {configurations.map((configuration) => (
                        <SelectItem
                          key={configuration.id}
                          value={configuration.id}
                        >
                          {configuration.vehicle} · {configuration.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Visit Type
                  <Select
                    value={visitType}
                    onValueChange={(value) => {
                      setVisitType(value as ProjectVisit['type']);
                      setSelectedProjectIds([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCAN" disabled={!canScheduleScan}>
                        Scan {!canScheduleScan && '· Locked'}
                      </SelectItem>
                      <SelectItem
                        value="FITTING"
                        disabled={!canScheduleFitting}
                      >
                        Fitting {!canScheduleFitting && '· Locked'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Location / Dealer
                  <Select
                    disabled={locationType !== 'DEALERSHIP'}
                    value={dealer}
                    onValueChange={(value) => {
                      setDealer(value as (typeof DEALERS)[number]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEALERS.map((item) => (
                        <SelectItem value={item} key={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Date
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                    }}
                  />
                </label>
                <label>
                  Time
                  <Input
                    type="time"
                    value={time}
                    onChange={(event) => {
                      setTime(event.target.value);
                    }}
                  />
                </label>
              </div>
              {!visitGateUnlocked && (
                <div className="stage-gate-lock">
                  <strong>{visitType} Visit gate locked</strong>
                  The target zone or required Floor Mat bundle must reach{' '}
                  {visitType === 'SCAN' ? 'Scan' : 'Fitting'} before a visit can
                  be scheduled.
                </div>
              )}
              <fieldset className="visit-zone-picker">
                <legend>Target Zone Projects - {visitType}</legend>
                {zones
                  .filter((item) => visitEligibleProjectIds.includes(item.id))
                  .map((item) => (
                    <label key={item.id}>
                      <Checkbox
                        checked={selectedProjectIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProjectIds((current) =>
                            checked === true
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id),
                          );
                        }}
                      />
                      <span>
                        {item.code} · {item.label} · {item.id}
                      </span>
                      <StatusBadge label={item.currentStage} tone="neutral" />
                    </label>
                  ))}
                {!visitGateUnlocked && (
                  <p className="muted-text">No eligible zone projects.</p>
                )}
              </fieldset>
              <fieldset className="visit-zone-picker two-column">
                <legend>Visit Staff</legend>
                {users.map((user) => (
                  <label key={user.id}>
                    <Checkbox
                      checked={staffIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setStaffIds((current) =>
                          checked === true
                            ? [...new Set([...current, user.id])]
                            : current.filter((id) => id !== user.id),
                        );
                      }}
                    />
                    <span>{user.name}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Visit Note
                <Textarea
                  value={visitNote}
                  onChange={(event) => {
                    setVisitNote(event.target.value);
                  }}
                  placeholder="Vehicle availability, equipment, or instructions for this visit."
                />
              </label>
            </div>
          )}
          {dialog === 'sample' && (
            <div className="project-dialog-stack">
              <div className="dialog-form-grid">
                <label>
                  Vendor (Factory)
                  <Select
                    value={factory}
                    onValueChange={(value) => {
                      setFactory(value as (typeof FACTORIES)[number]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FACTORIES.map((item) => (
                        <SelectItem value={item} key={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Note
                  <Input
                    value={sampleNote}
                    placeholder="Brief Slack post note · Detailed instructions go in the checklist"
                    onChange={(event) => {
                      setSampleNote(event.target.value);
                    }}
                  />
                </label>
              </div>
              <div className="sample-dialog-items">
                <strong>
                  Parts — One part = one sample tracking row · Round{' '}
                  {samples.length + 1}
                </strong>
                {sampleCandidates.map((design) => {
                  const line = sampleLines[design.id];
                  const setLine = (next: ProjectSampleLine | undefined) => {
                    setSampleLines((current) => ({
                      ...current,
                      [design.id]: next,
                    }));
                  };
                  return (
                    <div className="sample-dialog-line" key={design.id}>
                      <label>
                        <Checkbox
                          checked={line !== undefined}
                          onCheckedChange={(checked) => {
                            setLine(
                              checked ? { designId: design.id } : undefined,
                            );
                          }}
                        />
                        <span title={design.name}>
                          {design.name} · Rev{' '}
                          {currentRevision(design).revisionNumber}
                        </span>
                      </label>
                      <Input
                        aria-label={`${design.name} Note`}
                        placeholder="Note"
                        disabled={!line}
                        value={line?.note ?? ''}
                        onChange={(event) => {
                          if (line)
                            setLine({ ...line, note: event.target.value });
                        }}
                      />
                    </div>
                  );
                })}
                {!sampleCandidates.length && (
                  <p className="empty-inline">
                    No changed parts to request. Create a change request or
                    check parts marked partially or not implemented.
                  </p>
                )}
              </div>
            </div>
          )}
          {dialog === 'file' && (
            <div className="dialog-form-grid">
              <label className="full-width">
                File Name
                <Input
                  value={fileName}
                  onChange={(event) => {
                    setFileName(event.target.value);
                  }}
                />
              </label>
              <label>
                Asset Type
                <Select
                  value={fileType}
                  onValueChange={(value) => {
                    setFileType(value as ProjectAsset['type']);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCAN">SCAN</SelectItem>
                    <SelectItem value="PATTERN FILE">PATTERN FILE</SelectItem>
                    <SelectItem value="PHOTO">PHOTO</SelectItem>
                    <SelectItem value="3D MODEL">3D MODEL</SelectItem>
                    <SelectItem value="OTHER">OTHER</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Scope
                <Input defaultValue="Group shared" />
              </label>
            </div>
          )}
          {dialog === 'promote' && (
            <div className="project-dialog-stack">
              {handoffErrors.length > 0 && (
                <div role="alert" className="shape-errors">
                  {handoffErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
              <div className="dialog-note">
                Hand over final materials to production, then record development
                completion. Shape issuance is a follow-up process.
              </div>
              <HandoffChecklistForm
                users={users}
                value={handoffValue}
                onChange={(value) => {
                  setHandoffValue(value);
                  onHandoffDraft(value);
                }}
                projectId={project.id}
                vehicle={`${project.vehicle} / ${project.options.map(([key, value]) => `${key}: ${value}`).join(', ')}`}
                zones={handoffZoneCodes}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {dialog === 'promote' && (
            <label className="mr-auto flex items-center gap-2 text-sm">
              <Checkbox
                checked={handoffBeforeTest !== undefined}
                onCheckedChange={(checked) => {
                  const next =
                    checked === true
                      ? fillTestHandoffChecklist(
                          handoffValue,
                          users[0]?.name ?? '',
                        )
                      : (handoffBeforeTest ?? handoffValue);
                  setHandoffBeforeTest(
                    checked === true ? handoffValue : undefined,
                  );
                  setHandoffValue(next);
                  onHandoffDraft(next);
                }}
              />
              Fill test values
            </label>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={
              (dialog === 'promote' &&
                (handoffChecklistErrors(handoffValue).length > 0 ||
                  handoffErrors.length > 0)) ||
              (dialog === 'design' &&
                (!effectiveDesignGateUnlocked ||
                  designIdentityExists ||
                  designNameExists ||
                  !designName.trim() ||
                  !revisionNote.trim() ||
                  !initialDxfName ||
                  !initialDxfFingerprint ||
                  Number(designQuantity) < 1)) ||
              (dialog === 'revision' &&
                (!revisionNote.trim() || !revisionRequestValid)) ||
              (dialog === 'visit' &&
                (!visitGateUnlocked ||
                  !selectedProjectIds.some((id) =>
                    visitEligibleProjectIds.includes(id),
                  ) ||
                  !date ||
                  !time)) ||
              (dialog === 'sample' &&
                (!canRequestSample || !includedSampleLines.length)) ||
              (dialog === 'file' && !fileName.trim())
            }
          >
            {dialog === 'new-configuration'
              ? 'Apply'
              : dialog === 'design'
                ? `${designLabel(project.product)} Create`
                : dialog === 'revision'
                  ? 'Add Revision'
                  : dialog === 'visit'
                    ? 'Schedule Visit'
                    : dialog === 'sample'
                      ? 'Create Request'
                      : dialog === 'file'
                        ? 'Add Reference'
                        : 'Handoff complete · Development complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
