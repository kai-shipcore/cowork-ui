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
import { UserAvatar, UserPicker } from '@/shared/domain/user-picker';
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
  ProjectStage,
  ProjectVisit,
  SampleRequestItem,
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
import { CURRENT_USER_ID } from '@/app/current-user';
import { SEED_SCAN_VISIT_DATE } from '@/app/workbench-mock-data';
import { isLegacySeedActivity, useWorkbenchStore } from '@/app/workbench-store';
import {
  emptyHandoffChecklist,
  HANDOFF_DOCUMENTS,
  handoffChecklistErrors,
  prepareHandoffChecklist,
} from '../handoff-checklist';
import { getSampleGate, type SampleGate } from '../sample-gate';
import { HandoffChecklistForm } from './handoff-checklist-form';
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
    .sort((left, right) => right.sampleRound - left.sampleRound)[0];
  return (
    !latest ||
    latest.revisionReflected === 'PARTIAL' ||
    latest.revisionReflected === 'NONE'
  );
}

function isSampleApproved(design: ProjectDesign): boolean {
  return Boolean(currentRevision(design).sampleApprovedAt);
}

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
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

/**
 * Rebuilds the zone list from the project's own zone projects, layering the
 * persisted per-zone flags on top. A saved snapshot is untrusted localStorage
 * data: it can predate a zone-id change or miss fields the render path needs
 * (`code`, `label`), and a zone that no longer exists must not survive.
 */
function mergeSavedZones(
  project: VehicleProjectGroup,
  savedZones: readonly ZoneProject[] | undefined,
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
          shape: saved.productShape?.name ?? saved.shape ?? zone.shape,
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
          note: '최초 도면',
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
  const savedDetail = projectDetails[project.id];
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
  const samplesFromSharedStore: readonly ProjectSample[] = sharedSampleRequests
    .filter((request) => request.projectGroupId === project.id)
    .map((request) => {
      const items = sharedSampleRequestItems.filter(
        (item) => item.sampleRequestId === request.id,
      );
      const shipments = sharedSampleShipments.filter((shipment) =>
        items.some((item) => item.sampleShipmentId === shipment.id),
      );
      const allReceived =
        items.length > 0 && items.every((item) => item.sampleReceivedAt);
      const anyShipped = shipments.some((shipment) => shipment.shippedAt);
      return {
        id: request.id,
        factory: request.factory,
        designIds: items.map((item) => item.vehicleProductDesignId),
        items: items.length,
        round: Math.max(1, ...items.map((item) => item.sampleRound)),
        status: allReceived ? 'ARRIVED' : anyShipped ? 'SHIPPED' : 'REQUESTED',
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
    : pipeline[0];
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
  const focusedZone = zones.find((zone) => zone.code === zoneCode) ?? zones[0];
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
            productShapeId,
            sizeReview: currentZone.sizeReview,
            productionHandoff: currentZone.productionHandoff,
            shapeReviewHistory: currentZone.shapeReviewHistory,
            reworkRequestedAt: currentZone.reworkRequestedAt,
          };
        });
        const zonesChanged = zoneProjects.some(
          (zoneProject, index) =>
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
          createdAt: '2026-08-31T09:00:00-07:00',
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
        ...samples.flatMap((sample) =>
          (sample.designIds
            ? designs.filter((design) => sample.designIds?.includes(design.id))
            : designs.filter((design) =>
                current.some(
                  (item) =>
                    item.sampleRequestId === sample.id &&
                    item.vehicleProductDesignId === design.id,
                ),
              )
          )
            .slice(0, Math.max(1, sample.items))
            .map((design, index) => {
              const itemId = `SRI-${sample.id}-${index + 1}`;
              // A request line stays pinned to the revision it was raised for,
              // so adding a Revision later does not rewrite earlier rounds.
              const existing = current.find(
                (item) =>
                  item.sampleRequestId === sample.id &&
                  item.vehicleProductDesignId === design.id,
              );
              return {
                id: existing?.id ?? itemId,
                sampleRequestId: sample.id,
                vehicleProductDesignId: design.id,
                vehicleProductDesignRevisionId:
                  existing?.vehicleProductDesignRevisionId ??
                  currentRevision(design).id,
                sampleRound: sample.round,
                priority: 'NORMAL' as const,
                ...(existing?.revisionReflected
                  ? {
                      revisionReflected: existing.revisionReflected,
                      verificationNote: existing.verificationNote,
                      verifiedAt: existing.verifiedAt,
                      verifiedBy: existing.verifiedBy,
                      issueSource: existing.issueSource,
                    }
                  : {}),
                ...(sample.status === 'ARRIVED' || sample.status === 'APPROVED'
                  ? { sampleReceivedAt: new Date().toISOString() }
                  : {}),
                ...(sample.status !== 'REQUESTED'
                  ? { sampleShipmentId: `SHIP-${sample.id}` }
                  : {}),
              };
            }),
        ),
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
                  shippedAt: new Date().toISOString(),
                  ...(sample.status === 'ARRIVED' ||
                  sample.status === 'APPROVED'
                    ? { arrivedAt: new Date().toISOString() }
                    : {}),
                  shipmentReference: `TRACK-${sample.id}`,
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
      shapes: zones.flatMap((zone) =>
        zone.productShape?.name
          ? [zone.productShape.name]
          : zone.shape
            ? [zone.shape]
            : [],
      ),
      skuStatus: 'DRAFT',
    };
    setUniqueVehicles((current) => [
      uniqueVehicle,
      ...current.filter((vehicle) => vehicle.projectGroupId !== project.id),
    ]);
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
      'Manager 변경',
      `${zone?.code ?? zoneId} · ${assigned ? assigned.name : '담당자 해제'}`,
    );
  }

  function openDialog(
    name: DialogName,
    zone?: string,
    designId?: string,
  ): void {
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
    const nextStage = pipeline[pipeline.indexOf(currentStage) + 1];
    if (!nextStage) return;
    const advancingIds = new Set(advancingZones.map((zone) => zone.id));
    setZones((current) =>
      current.map((zone) =>
        advancingIds.has(zone.id) ? { ...zone, currentStage: nextStage } : zone,
      ),
    );
    addActivity(
      `${currentStage} 완료`,
      `${advancingZones.map((zone) => zone.code).join(', ')} · ${nextStage} 단계로 이동`,
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
        <div className="empty-inline">
          {project.id}에 Zone Project가 없습니다.
        </div>
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

  return (
    <section className="project-workspace">
      {project.product === 'Seat Cover' &&
        (linkZone || (partParams.get('linkPart') && canCreateDesign)) && (
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
                'Part 연결',
                `${design.name} · v${design.revisions[0].revisionNumber}`,
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
      <ProjectHeader
        project={project}
        zone={focusedZone}
        zones={zones}
        fNumber={fNumber}
        manager={findUser(activeUsers, focusedZone.managerId)}
        onSelectZone={onSelectZone}
        onNewConfiguration={() => openDialog('new-configuration')}
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
        onPromote={() => openDialog('promote')}
        onOpenShape={() =>
          navigate(
            `/product-shapes?view=review&project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(focusedZone.id)}`,
          )
        }
      />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DetailTab)}
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
            onManagerChange={(userId) =>
              changeZoneManager(focusedZone.id, userId)
            }
            project={project}
            zone={focusedZone}
            visits={focusedVisits}
            designs={focusedDesigns}
            canCreateDesign={canCreateDesign}
            onAddDesign={() => openDialog('design', focusedZone.id)}
            onRevision={(designId) =>
              openDialog('revision', undefined, designId)
            }
            onOpenVisits={() => setActiveTab('visits')}
          />
        </TabsContent>
        <TabsContent value="designs">
          <DesignsTab
            project={project}
            zones={[focusedZone]}
            designs={focusedDesigns}
            stage={focusedStage}
            canCreateDesign={canCreateDesign}
            eligibleProjectIds={designEligibleProjectIds}
            onAddDesign={(vehicleProjectId) =>
              openDialog('design', vehicleProjectId)
            }
            onRevision={(designId) =>
              openDialog('revision', undefined, designId)
            }
            onToggleFit={(designId) =>
              setDesigns((current) =>
                current.map((design) =>
                  design.id === designId
                    ? {
                        ...design,
                        fittingConfirmed: !design.fittingConfirmed,
                      }
                    : design,
                ),
              )
            }
          />
        </TabsContent>
        <TabsContent value="samples">
          <SamplesTab
            sampleGate={sampleGate}
            onResolveGate={(tab) => setActiveTab(tab)}
            product={project.product}
            designs={scopeDesigns.filter((design) =>
              sampleEligibleProjectIds.includes(design.vehicleProjectId),
            )}
            samples={samples}
            sampleItems={sharedSampleRequestItems}
            canRequestSample={canRequestSample}
            onRequest={() => openDialog('sample')}
            onAdvance={(sampleId) => {
              if (!canRequestSample) return;
              setSamples((current) =>
                current.map((sample) => {
                  if (sample.id !== sampleId) {
                    return sample;
                  }
                  const next =
                    sample.status === 'REQUESTED'
                      ? 'SHIPPED'
                      : sample.status === 'SHIPPED'
                        ? 'ARRIVED'
                        : 'APPROVED';
                  return { ...sample, status: next };
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
                'Sample Revision 승인',
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
                        ...(verdict === 'EXACT'
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
                                  ...(verdict === 'EXACT'
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
                'Revision 반영 검증',
                `${itemId} · ${verdict} · ${note}`,
              );
            }}
          />
        </TabsContent>
        <TabsContent value="revisions">
          <RevisionControlTab
            designs={scopeDesigns}
            sampleItems={sharedSampleRequestItems}
            onRevision={(designId) =>
              openDialog('revision', undefined, designId)
            }
          />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab
            users={activeUsers}
            assets={assets}
            onAdd={() => openDialog('file')}
          />
        </TabsContent>
        <TabsContent value="visits">
          <VisitsTab
            users={activeUsers}
            visits={focusedVisits}
            canScheduleVisit={canScheduleScan || canScheduleFitting}
            onAdd={() => openDialog('visit')}
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
                  ? `FITTING Visit 완료 · ${result ?? 'PASS'}`
                  : `${visit.type} Visit 완료`,
                result === 'FAIL'
                  ? `${visit.vehicleProjectIds.join(', ')} · ${visit.dealer} · Design 단계로 되돌림 (Revision 재작업)`
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
        onHandoffDraft={(value) =>
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
          )
        }
        handoffErrors={[
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
            'Design 생성',
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
                        id: `REV-${designId}-${revisionNumber}`,
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
            'Revision 수정 요청 확정',
            `${design.name} · Rev ${revisionNumber} · ${changeRequest.issueArea} · 공장 지시서 생성`,
          );
          importProjectParts(
            designs.map((item) =>
              item.id === designId
                ? {
                    ...item,
                    revisions: [
                      ...item.revisions,
                      {
                        id: `REV-${designId}-${revisionNumber}`,
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
            `${input.type} Visit 예약`,
            `${input.dealer} · ${input.date} ${input.time} · ${input.vehicleProjectIds.join(', ')}`,
          );
          closeDialog();
        }}
        onSample={(factory, designIds) => {
          if (!canRequestSample) return;
          const candidates = scopeDesigns.filter(
            (design) =>
              sampleEligibleProjectIds.includes(design.vehicleProjectId) &&
              designIds.includes(design.id),
          );
          const eligibleDesigns = candidates.filter((design) =>
            isRevisionSampleRequestable(design, sharedSampleRequestItems),
          );
          if (!eligibleDesigns.length) return;
          const sample: ProjectSample = {
            id: `SR-${project.id.replace(/\D/g, '')}-${String(samples.length + 1).padStart(2, '0')}`,
            factory,
            items: eligibleDesigns.length,
            designIds: eligibleDesigns.map((design) => design.id),
            round: samples.length + 1,
            status: 'REQUESTED',
          };
          setSamples((current) => [...current, sample]);
          addActivity(
            'Sample Request',
            `${sample.id} · ${factory} · ${eligibleDesigns.length} items`,
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
          addActivity('Asset 등록', `${name} · ${type}`);
          closeDialog();
        }}
        onConfiguration={(title, value, mode, note) => {
          addActivity(
            mode === 'NEW' ? 'New Configuration 발견' : 'Research 정보 수정',
            `${title}: ${value}${note ? ` · ${note}` : ''}`,
          );
          closeDialog();
        }}
        onPromote={(checklist) => {
          const reference = HANDOFF_DOCUMENTS.map(
            ([id, label]) =>
              `${label}: ${checklist.documents[id]?.reference ?? ''}`,
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
          addActivity('양산 인계 완료 · 개발 완료', reference);
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
  fNumber?: string;
  /** `manager_id` lives on `vehicle_project`, so this is the zone's manager. */
  manager?: AppUser;
  onSelectZone: (zoneCode: string) => void;
  onNewConfiguration: () => void;
}

function ProjectHeader({
  project,
  zone,
  zones,
  fNumber,
  manager,
  onSelectZone,
  onNewConfiguration,
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
            <span>F-Number</span>
            <strong className={fNumber ? 'assigned-f-number' : 'not-assigned'}>
              {fNumber ?? 'Not Assigned'}
            </strong>
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
            aria-label="같은 Project Group의 Zone Project"
          >
            <span>Zone Projects in {project.id}</span>
            {zones.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={item.id === zone.id ? 'mono' : 'outline'}
                aria-pressed={item.id === zone.id}
                onClick={() => onSelectZone(item.code)}
              >
                <span className={`zone zone-${item.code.toLowerCase()}`}>
                  {item.code}
                </span>
                {item.label}
              </Button>
            ))}
          </div>
        )}
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
  Fitting: 'Fitting / 인계 준비',
  Approved: '양산 인계 · 개발 완료',
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
        : { Fitting: 'Fitting / 인계 준비', Approved: '양산 인계 · 개발 완료' };
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
            label={`${zoneStageIndex + 1} / ${pipeline.length} · ${stageLabels?.[zone.currentStage] ?? zone.currentStage}`}
            tone={zone.currentStage === 'Approved' ? 'success' : 'progress'}
          />
        </div>
        <div
          className="project-progress-rail zone-progress-rail circular-progress-rail"
          aria-label="프로젝트 진행 단계"
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
              {stageLabels?.[item] ?? item}
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
            이미 진행된 샘플이 있어 Sample 단계를 거친 뒤 되돌아온 Revision
            재작업 상태입니다
            {reworkRevision > 1 && ` (현재 Revision ${reworkRevision})`} ·{' '}
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
                    label={`BUNDLE GATE · ${stageLabels?.[pipeline[bundleStageIndex]] ?? pipeline[bundleStageIndex]}`}
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
        title: 'Research Configuration을 확인하세요',
        description:
          '차량과 옵션 조합이 개발 대상과 일치하는지 확인한 뒤 Research 단계를 완료합니다.',
        steps: [
          '차량 및 연식 확인',
          'Configuration 옵션 확인',
          'Research 단계 완료',
        ],
        linkLabel: 'Overview에서 Configuration 확인',
        targetTab: 'overview',
        primaryLabel: 'Research 단계 완료',
        primaryAction: onAdvance,
      };
      break;
    case 'Vehicle Hunt':
      guide = {
        title: '차량 확보처를 정하고 Scan Visit을 준비하세요',
        description:
          '딜러·렌터카·협력사 중 차량 확보 경로를 확인한 뒤 Vehicle Hunt 단계를 완료하세요. 다음으로 Visits 탭에서 스캔 날짜, 담당자와 대상 Zone을 등록합니다.',
        steps: [
          '차량 확보 경로 결정',
          'Vehicle Hunt 단계 완료',
          'SCAN Visit 일정 등록',
        ],
        linkLabel: 'Visits 탭으로 이동해 SCAN Visit 등록',
        targetTab: 'visits',
        primaryLabel: 'Vehicle Hunt 단계 완료',
        primaryAction: onAdvance,
      };
      break;
    case 'Scan':
      guide = allScanned
        ? {
            title: '현재 Zone / Bundle의 스캔이 완료되었습니다',
            description:
              '완료된 Scan Visit과 결과를 확인한 뒤 다음 개발 단계로 이동하세요.',
            steps: ['SCAN Visit 완료', '대상 Zone 결과 확인', 'Scan 단계 완료'],
            linkLabel: 'Visits 탭에서 완료 결과 확인',
            targetTab: 'visits',
            primaryLabel: 'Scan 단계 완료',
            primaryAction: onAdvance,
          }
        : {
            title:
              scanVisits.length > 0
                ? '예약된 Scan Visit을 진행하세요'
                : 'Scan Visit 일정을 먼저 등록하세요',
            description:
              'Visits 탭에서 차량 방문 일정과 대상 Zone을 확인하고, 현장 스캔 후 Visit을 완료 처리합니다.',
            steps: [
              'SCAN Visit 일정 등록',
              '현장 스캔 진행',
              'Visit 완료 처리',
            ],
            linkLabel: 'Visits 탭에서 SCAN Visit 확인',
            targetTab: 'visits',
            primaryLabel:
              scanVisits.length > 0
                ? '예약된 Scan Visit 열기'
                : 'Scan Visit 일정 등록하기',
            primaryAction: () => onOpenTab('visits'),
          };
      break;
    case '3D Model':
    case 'Fit Review':
      guide = {
        title: modelAsset
          ? stage === '3D Model'
            ? '3D 모델 자료를 확인하세요'
            : '패턴 작업 전 모델 적합성을 검토하세요'
          : '3D Model 파일을 등록하세요',
        description:
          'Files에서 확보한 모델을 확인하고 다음 단계로 진행하세요. 최종 Shape 검토·발급은 샘플 피팅 이후에 진행합니다.',
        steps: ['3D 모델 확보', '모델 자료 검토', '패턴 작업 진행'],
        linkLabel: '모델 자료 확인',
        targetTab: 'files',
        primaryLabel: modelAsset
          ? stage === '3D Model'
            ? '3D Model 단계 완료'
            : '모델 검토 완료 · Design으로 이동'
          : '모델 파일 등록',
        primaryAction: modelAsset ? onAdvance : () => onOpenTab('files'),
      };
      break;
    case 'Design':
      if (failedFitting) {
        guide = {
          title: '피팅 실패 — Revision을 추가하고 샘플을 다시 진행하세요',
          description:
            '마지막 FITTING Visit이 FAIL로 끝나 이 프로젝트만 Design 단계로 돌아왔습니다. 실패 원인을 반영한 Revision을 추가한 뒤 Design 단계를 완료하면 새 Revision으로 Sample을 다시 요청할 수 있습니다.',
          steps: [
            '실패 원인을 반영한 Revision 추가',
            'Design 단계 완료 후 Sample 재요청·입고·승인',
            'Visits에서 새 피팅 일정을 등록해 재피팅',
          ],
          linkLabel: 'Design / Parts에서 Revision 추가',
          targetTab: 'designs',
          primaryLabel: revisionPending
            ? 'Revision 추가하기'
            : 'Design 단계 완료 (재작업)',
          primaryAction: revisionPending
            ? () => onOpenTab('designs')
            : onAdvance,
        };
        break;
      }
      if (project.product !== 'Seat Cover') {
        const label = designLabel(project.product);
        guide = {
          title: bomReady
            ? `${label}이 등록되었습니다`
            : `${label}을 등록하세요`,
          description:
            project.product === 'Car Cover'
              ? '조사 차량의 전체 패턴과 최초 버전을 등록하고, 변경 사항은 기존 패턴의 새 버전으로 기록합니다.'
              : '각 구역의 금형과 최초 버전을 등록하고, 금형 수정·재스캔은 기존 금형의 새 버전으로 기록합니다.',
          steps: [`${label} 등록`, '버전 확인', 'Design 단계 완료'],
          linkLabel: `${label} 확인`,
          targetTab: 'designs',
          primaryLabel: bomReady ? 'Design 단계 완료' : `${label} 등록하기`,
          primaryAction: bomReady ? onAdvance : () => onOpenTab('designs'),
        };
        break;
      }
      guide = bomReady
        ? {
            title: '현재 Zone / Bundle의 Part 구성이 준비되었습니다',
            description:
              '등록된 Part 구성을 확인한 뒤 Sample 단계로 이동하세요.',
            steps: ['기존 Part 선택', 'Part 연결', 'Design 단계 완료'],
            linkLabel: 'Parts 최종 확인',
            targetTab: 'designs',
            primaryLabel: 'Design 단계 완료',
            primaryAction: onAdvance,
          }
        : {
            title: '현재 Zone / Bundle의 Part를 등록하세요',
            description:
              'Parts 탭에서 각 Zone의 디자인, 부품과 Revision을 구성합니다.',
            steps: ['기존 Part 선택', 'Part 연결', 'Zone 구성 확인'],
            linkLabel: 'Parts 탭으로 이동',
            targetTab: 'designs',
            primaryLabel: 'Part 연결하기',
            primaryAction: () => onOpenTab('designs'),
          };
      break;
    case 'Sample':
      guide = sampleReady
        ? {
            title: '샘플 입고와 Revision 승인이 완료되었습니다',
            description:
              '승인된 샘플 결과를 확인한 뒤 Fitting 단계로 이동하세요.',
            steps: [
              'Sample Request 생성',
              '배송 및 입고 처리',
              'Sample 단계 완료',
            ],
            linkLabel: '승인된 Sample 확인',
            targetTab: 'samples',
            primaryLabel: 'Sample 단계 완료',
            primaryAction: onAdvance,
          }
        : {
            title: 'Sample 단계를 완료할 수 없습니다',
            description: sampleGate.blockers
              .map((blocker) => blocker.message)
              .join(' '),
            steps: [
              'Sample Request 생성',
              '배송 및 입고 처리',
              '현재 Revision 승인',
            ],
            linkLabel:
              sampleGate.blockers[0]?.tab === 'designs'
                ? '패턴 / Design 확인'
                : 'Samples 확인',
            targetTab: sampleGate.blockers[0]?.tab ?? 'samples',
            primaryLabel:
              sampleGate.blockers[0]?.tab === 'designs'
                ? '패턴 / Design 등록하기'
                : '미완료 항목 확인하기',
            primaryAction: () =>
              onOpenTab(sampleGate.blockers[0]?.tab ?? 'samples'),
          };
      break;
    case 'Fitting': {
      guide = {
        title:
          fittingReady && sampleReady
            ? '양산 인계를 완료하면 개발이 종료됩니다'
            : '현재 샘플·피팅 결과를 확인하세요',
        description:
          '최종 패턴, 피팅 결과와 생산 자료를 인계하고 완료를 기록하세요. Shape 검토·발급은 개발 완료 후 Shape 메뉴에서 별도로 진행합니다.',
        steps: ['샘플·피팅 완료', '양산 인계', '개발 완료'],
        linkLabel: '피팅 결과 확인',
        targetTab: 'visits',
        primaryLabel:
          fittingReady && sampleReady
            ? '양산 인계 완료 기록'
            : '미완료 작업 확인',
        primaryAction:
          fittingReady && sampleReady
            ? onPromote
            : () =>
                onOpenTab(
                  sampleReady
                    ? 'visits'
                    : (sampleGate.blockers[0]?.tab ?? 'samples'),
                ),
      };
      break;
    }
    case 'Approved':
      guide = {
        title: stageZones.every((zone) => zone.productionHandoff)
          ? '양산 인계 완료 · 개발 완료'
          : '이전 완료 프로젝트 · 양산 인계 확인 필요',
        description:
          '후속 검토 회의, Shape 발급과 구성 등록은 Shape 메뉴에서 진행합니다. 기존 완료 데이터는 인계 기록을 확인한 후 검토할 수 있습니다.',
        steps: ['개발 완료', 'Shape 검토·발급', 'Part 구성·Blueprint 등록'],
        linkLabel: '양산 인계 이력 확인',
        targetTab: 'activity',
        primaryLabel: stageZones.every((zone) => zone.productionHandoff)
          ? 'Shape 메뉴에서 후속 작업 진행'
          : '양산 인계 확인 기록',
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
        title: '이 단계의 안내를 찾을 수 없습니다',
        description: `저장된 단계 값(${String(stage)})이 ${project.product} 파이프라인에 없습니다. 각 탭에서 직접 진행하세요.`,
        steps: ['탭에서 현재 상태 확인', '필요한 작업 수행'],
        linkLabel: 'Activity 탭으로 이동',
        targetTab: 'activity',
        primaryLabel: 'Activity 확인하기',
        primaryAction: () => onOpenTab('activity'),
      };
      break;
  }

  return (
    <aside className="project-next-action" aria-label="다음 작업 안내">
      <div className="project-next-action-copy">
        <div className="project-next-action-kicker">
          <StatusBadge label="NEXT ACTION" tone="progress" />
          <span>
            단계 {stageIndex + 1}/{pipeline.length} ·{' '}
            {stage === 'Approved' ? '개발 완료' : stage}
          </span>
        </div>
        <h2>{guide.title}</h2>
        <p>
          {guide.description}{' '}
          <button
            type="button"
            className="project-next-action-link"
            onClick={() => onOpenTab(guide.targetTab)}
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
              인계 체크리스트 보기 / 재확인
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
                label={`${zone.code} Zone Project 담당자`}
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
            <small>{designs.length}건</small>
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
                : '이 Zone 또는 필수 Floor Mat Bundle이 Design Gate에 도달해야 합니다.'
            }
            onClick={onAddDesign}
          >
            <Plus />{' '}
            {project.product === 'Seat Cover'
              ? '기존 Part 연결'
              : `${designLabel(project.product)} 등록`}
          </Button>
        </CardHeader>
        <CardContent className="design-list">
          {!canCreateDesign && (
            <div className="stage-gate-lock">
              이 Zone의 이전 Gate가 완료되지 않았습니다. Floor Mat F/B는 두
              Zone이 함께 Gate를 통과합니다.
            </div>
          )}
          {designs.length ? (
            designs.map((design) => (
              <DesignCard
                design={design}
                key={design.id}
                onRevision={
                  canCreateDesign ? () => onRevision(design.id) : undefined
                }
              />
            ))
          ) : (
            <div className="empty-inline">
              {project.product === 'Seat Cover'
                ? '연결된 Part가 없습니다 — 기존 Part를 선택해 프로젝트에 연결하세요.'
                : `등록된 ${designLabel(project.product)}이 없습니다. 설계와 최초 버전을 등록하세요.`}
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
            <div className="empty-inline">
              이 Zone이 포함된 방문이 없습니다.
            </div>
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
          ? 'Part Management에서 개발된 Part와 사용할 버전을 선택해 연결합니다. 버전 변경은 Part Management에서 관리하며, Fitting 검증은 프로젝트별로 기록됩니다.'
          : project.product === 'Car Cover'
            ? '조사 차량당 전체 패턴 하나를 등록합니다. 패턴 수정은 기존 설계의 새 버전으로 기록하고, Fitting 결과는 프로젝트에서 확인합니다.'
            : '조사 차량의 구역별 금형을 하나씩 등록합니다. 금형 수정·재스캔은 기존 설계의 새 버전으로 기록합니다. 표면 디자인 라인은 금형을 나누는 기준이 아닙니다.'}
      </div>
      {!canCreateDesign && (
        <div className="stage-gate-lock">
          <strong>Design Gate 잠김</strong>
          작업 대상 Zone 또는 필수 Floor Mat Bundle의 선행 단계를 완료해야
          {project.product === 'Seat Cover' ? 'Part를 연결' : '설계를 등록'}할
          수 있습니다.
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
                <small>{zoneDesigns.length}건</small>
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
                    : '이 Zone 또는 필수 Floor Mat Bundle의 선행 Gate를 먼저 완료하세요.'
                }
                onClick={() => onAddDesign(zone.id)}
              >
                <Plus />{' '}
                {project.product === 'Seat Cover'
                  ? '기존 Part 연결'
                  : `${designLabel(project.product)} 등록`}
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
                        ? () => onRevision(design.id)
                        : undefined
                    }
                    fittingMode={stage === 'Fitting'}
                    onToggleFit={() => onToggleFit(design.id)}
                  />
                ))
              ) : (
                <div className="empty-inline">
                  {project.product === 'Seat Cover'
                    ? '연결된 Part가 없습니다 — 기존 Part를 선택해 프로젝트에 연결하세요.'
                    : `등록된 ${designLabel(project.product)}이 없습니다. 설계와 최초 버전을 등록하세요.`}
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
                ? `Sample 승인 Rev ${revision.revisionNumber}`
                : 'Sample 승인 —'
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
          {details.kind === 'SEAT_COVER' ? ` · Qty ${design.quantity}` : ''}
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
            새 Revision 추가
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
        부품별 수정 요청을 확정하고 공장 지시서를 생성한 뒤, 입고 시 지시 반영
        여부를 장착 적합성과 별도로 검증합니다.
      </div>
      <Card className="detail-panel revision-metric-card">
        <CardHeader>
          <CardTitle>수정 반영 정확도</CardTitle>
        </CardHeader>
        <CardContent>
          <strong>{accuracy === undefined ? '측정 전' : `${accuracy}%`}</strong>
          <span>
            정확히 반영 {exact} / 검증된 수정 샘플 {verified.length}
          </span>
          <StatusBadge
            label={
              accuracy !== undefined && accuracy >= 95
                ? '목표 달성 · 95% 이상'
                : '목표 · 95% 이상'
            }
            tone={
              accuracy !== undefined && accuracy >= 95 ? 'success' : 'warning'
            }
          />
        </CardContent>
      </Card>
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            부품별 수정 요청 <small>{requests.length}</small>
          </CardTitle>
        </CardHeader>
        <CardContent className="revision-request-list">
          {designs.map((design) => {
            const revision = currentRevision(design);
            return (
              <div className="revision-request-row" key={design.id}>
                <div>
                  <strong>{design.name}</strong>
                  <span>현재 Rev {revision.revisionNumber}</span>
                </div>
                {revision.changeRequest ? (
                  <StatusBadge label="지시서 준비 완료" tone="success" />
                ) : (
                  <span className="muted-text">등록된 수정 요청 없음</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRevision(design.id)}
                >
                  수정 요청 작성
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card className="detail-panel">
        <CardHeader>
          <CardTitle>
            공장 수정 지시서 <small>변경 부품만 표시</small>
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
                    <StatusBadge label="발송용" tone="progress" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const message = [
                          `[수정 요청] ${design.name} · Rev ${revision.revisionNumber}`,
                          `문제 출처: ${request.issueSource}`,
                          `문제 부위: ${request.issueArea}`,
                          `수정 지시: ${request.instruction}`,
                          `참고 이미지: ${request.referenceImageName}`,
                          `도면: ${request.previousDxfFileName} → ${request.newDxfFileName}`,
                        ].join('\n');
                        void navigator.clipboard.writeText(message).then(() => {
                          setCopiedRevisionId(revision.id);
                        });
                      }}
                    >
                      {copiedRevisionId === revision.id
                        ? '메시지 복사됨'
                        : '지시 메시지 복사'}
                    </Button>
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>문제 출처</dt>
                    <dd>{request.issueSource}</dd>
                  </div>
                  <div>
                    <dt>문제 부위</dt>
                    <dd>{request.issueArea}</dd>
                  </div>
                  <div>
                    <dt>수정 지시</dt>
                    <dd>{request.instruction}</dd>
                  </div>
                  <div>
                    <dt>문제 이미지</dt>
                    <dd>
                      {request.referenceImageDataUrl && (
                        <img
                          className="revision-reference-image"
                          src={request.referenceImageDataUrl}
                          alt={`${design.name} ${request.issueArea} 문제 참고`}
                        />
                      )}
                      {request.referenceImageName}
                    </dd>
                  </div>
                  <div>
                    <dt>도면</dt>
                    <dd>
                      {request.previousDxfFileName} → {request.newDxfFileName}
                    </dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <div className="empty-inline">완료된 수정 요청이 없습니다.</div>
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
        <strong>{design.name} · 수정 반영 검증</strong>
        <span>장착 테스트 전에 공장 지시대로 제작됐는지 확인하세요.</span>
      </div>
      <textarea
        aria-label={`${design.name} 수정 반영 검증 메모`}
        placeholder="확인한 치수, 미반영 항목 등 검증 메모"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="revision-verdict-actions">
        {(['EXACT', 'PARTIAL', 'NONE'] as const).map((verdict) => (
          <Button
            key={verdict}
            size="sm"
            variant={item.revisionReflected === verdict ? 'primary' : 'outline'}
            disabled={!note.trim()}
            onClick={() => onVerify(item.id, verdict, note.trim())}
          >
            {verdict === 'EXACT'
              ? '정확히 반영'
              : verdict === 'PARTIAL'
                ? '일부 반영'
                : '전혀 미반영'}
          </Button>
        ))}
      </div>
      {item.revisionReflected && (
        <StatusBadge
          label={
            item.revisionReflected === 'EXACT'
              ? '장착 테스트 진행 가능'
              : '공장 실행 문제 · 별도 추적'
          }
          tone={item.revisionReflected === 'EXACT' ? 'success' : 'danger'}
        />
      )}
    </div>
  );
}

interface SamplesTabProps {
  sampleGate: SampleGate;
  onResolveGate: (tab: DetailTab) => void;
  product: VehicleProjectGroup['product'];
  designs: readonly ProjectDesign[];
  samples: readonly ProjectSample[];
  /** Request lines, each pinned to the revision its round was raised for. */
  sampleItems: readonly SampleRequestItem[];
  canRequestSample: boolean;
  onRequest: () => void;
  onAdvance: (sampleId: string) => void;
  onApproveDesign: (designId: string) => void;
  onVerifyRevision: (
    itemId: string,
    verdict: NonNullable<SampleRequestItem['revisionReflected']>,
    note: string,
  ) => void;
}

function SamplesTab({
  sampleGate,
  onResolveGate,
  product,
  designs,
  samples,
  sampleItems,
  canRequestSample,
  onRequest,
  onAdvance,
  onApproveDesign,
  onVerifyRevision,
}: SamplesTabProps) {
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
  const requestableDesigns = samples.length
    ? designs.filter((design) =>
        isRevisionSampleRequestable(design, sampleItems),
      )
    : designs;
  return (
    <div className="project-tab-stack">
      <div className="detail-help-text">
        흐름: Sample Request(item = design + revision + round) → Shipment → 입고
        {product === 'Floor Mat' ? '' : ' → 승인 게이트'} → Fitting.
      </div>
      {!canRequestSample && (
        <div className="stage-gate-lock">
          <strong>Sample Gate 잠김</strong>
          작업 대상 Zone 또는 필수 Floor Mat Bundle의 Design Gate가 완료되어야
          Sample Request를 생성할 수 있습니다.
        </div>
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
                ? '작업 대상 Zone 또는 Bundle의 Design Gate를 먼저 완료하세요.'
                : samples.length && !requestableDesigns.length
                  ? '두 번째 이후 샘플은 수정 요청이 완료된 부품이 있어야 합니다.'
                  : undefined
            }
          >
            <Plus /> Sample Request
          </Button>
        </CardHeader>
        <CardContent>
          {!samples.length && (
            <div className="empty-inline">
              요청이 없습니다 — {designLabel(product)} 설계를 선택해 공장에
              요청하세요.
            </div>
          )}
        </CardContent>
      </Card>
      {samples.map((sample) => (
        <Card className="detail-panel" key={sample.id}>
          <CardHeader>
            <CardTitle>
              {sample.id} · {sample.factory}
            </CardTitle>
            <StatusBadge
              label={sample.status}
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
                  (sample.status === 'ARRIVED' && !canApproveRequest(sample))
                }
                title={
                  sample.status === 'ARRIVED' && !canApproveRequest(sample)
                    ? '수정된 모든 부품이 정확히 반영됨으로 검증되어야 요청을 승인할 수 있습니다.'
                    : undefined
                }
                onClick={() => onAdvance(sample.id)}
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
            <div className="sample-items">
              {designsOfSample(sample).map((design) => (
                <div key={design.id}>
                  <strong>{design.name}</strong>
                  <span>Rev {requestedRevisionNumber(sample, design)}</span>
                  <span>Round {sample.round}</span>
                </div>
              ))}
            </div>
            {sample.status === 'ARRIVED' &&
              sampleItems
                .filter((item) => item.sampleRequestId === sample.id)
                .map((item) => {
                  const design = designs.find(
                    (candidate) => candidate.id === item.vehicleProductDesignId,
                  );
                  const revision = design?.revisions.find(
                    (candidate) =>
                      candidate.id === item.vehicleProductDesignRevisionId,
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
      ))}
      {product !== 'Floor Mat' && (
        <Card className="detail-panel">
          <CardHeader>
            <CardTitle>
              Sample Approval <small>현재 Revision 기준 승인</small>
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
                          ? `Approved Rev ${currentRevision(design).revisionNumber}`
                          : '미승인'
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
                          : `Rev ${currentRevision(design).revisionNumber}로 만든 샘플이 입고되어야 승인할 수 있습니다.`
                      }
                      onClick={() => onApproveDesign(design.id)}
                    >
                      Approve Rev {currentRevision(design).revisionNumber}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="stage-gate-lock" role="status">
                <strong>
                  연결된 패턴 / Design이 없어 Sample 단계를 완료할 수 없습니다.
                </strong>
                <span>
                  샘플 요청의 APPROVED 표시만으로는 단계가 완료되지 않습니다.
                  패턴 / Design을 등록하고 해당 Revision의 샘플 입고와 승인을
                  진행하세요.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolveGate('designs')}
                >
                  패턴 / Design 등록하기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <div className={gatePassed ? 'sample-gate passed' : 'sample-gate'}>
        <strong>
          {gatePassed ? 'Sample 게이트 통과' : 'Fitting 진행 게이트'}
        </strong>
        <span>
          {gatePassed
            ? '전 design 입고 및 승인 완료 — Overview에서 Fitting 단계로 진행하세요.'
            : sampleGate.blockers.map((blocker) => blocker.message).join(' ') ||
              '이 Zone의 이전 개발 단계가 완료되어야 합니다.'}
        </span>
        {!gatePassed && sampleGate.blockers.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onResolveGate(sampleGate.blockers[0]?.tab ?? 'samples')
            }
          >
            미완료 항목 확인
          </Button>
        )}
      </div>
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
        파일 자체는 NAS/Drive에 저장하고 DB에는 <strong>asset reference</strong>
        만 관리합니다. SCAN은 그룹 공유, PATTERN FILE은 Revision에 연결됩니다.
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
                <div className="empty-inline">파일 없음</div>
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
  canScheduleVisit: boolean;
  onAdd: () => void;
  onCancel: (visitId: string) => void;
  onComplete: (visitId: string, result?: 'PASS' | 'FAIL') => void;
}

function VisitsTab({
  users,
  visits,
  canScheduleVisit,
  onAdd,
  onCancel,
  onComplete,
}: VisitsTabProps) {
  const upcoming = visits.filter((visit) => visit.status === 'SCHEDULED');
  const past = visits.filter((visit) => visit.status !== 'SCHEDULED');
  return (
    <Card className="detail-panel">
      <CardHeader>
        <CardTitle>
          Visits <small>스캔·피팅 일정과 방문 결과</small>
        </CardTitle>
        <Button
          size="sm"
          variant="primary"
          disabled={!canScheduleVisit}
          title={
            canScheduleVisit
              ? undefined
              : '작업 대상 Zone 또는 필수 Floor Mat Bundle이 Visit Gate에 도달해야 합니다.'
          }
          onClick={onAdd}
        >
          <Plus /> Schedule Visit
        </Button>
      </CardHeader>
      <CardContent className="visit-sections">
        <section className="visit-section upcoming">
          <header>
            <div className="visit-section-title">
              <CalendarClock aria-hidden="true" />
              <div>
                <h3>Upcoming</h3>
                <p>예정된 방문 · 취소 및 완료 처리</p>
              </div>
            </div>
            <StatusBadge
              label={`${upcoming.length} SCHEDULED`}
              tone="warning"
            />
          </header>
          <div className="visit-section-list">
            {upcoming.length ? (
              upcoming.map((visit) => (
                <VisitCard
                  users={users}
                  visit={visit}
                  key={visit.id}
                  onCancel={() => onCancel(visit.id)}
                  onComplete={(result) => onComplete(visit.id, result)}
                />
              ))
            ) : (
              <div className="empty-inline">예정된 방문이 없습니다.</div>
            )}
          </div>
        </section>

        <section className="visit-section past">
          <header>
            <div className="visit-section-title">
              <History aria-hidden="true" />
              <div>
                <h3>Past Visits</h3>
                <p>완료되거나 취소된 방문 기록</p>
              </div>
            </div>
            <StatusBadge label={`${past.length} PAST`} tone="neutral" />
          </header>
          <div className="visit-section-list">
            {past.length ? (
              past.map((visit) => (
                <VisitCard users={users} visit={visit} key={visit.id} />
              ))
            ) : (
              <div className="empty-inline">지난 방문 기록이 없습니다.</div>
            )}
          </div>
        </section>
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
            <dd>{new Date(visit.performedAt).toLocaleString()}</dd>
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
            <Button size="sm" variant="primary" onClick={() => onComplete()}>
              Complete Scan
            </Button>
          )}
          {onComplete && visit.type === 'FITTING' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onComplete('FAIL')}
              >
                Fail
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onComplete('PASS')}
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
  onSample: (factory: string, designIds: readonly string[]) => void;
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
  const [zone, setZone] = useState(
    dialogZone ??
      (dialog === 'design' ? designEligibleProjectIds[0] : undefined) ??
      zones[0]?.id ??
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
        ? '최초 금형'
        : '최초 패턴',
  );
  const [revisionCreatedBy, setRevisionCreatedBy] = useState('USR-JH');
  const [initialDxfName, setInitialDxfName] = useState('');
  const [initialDxfFingerprint, setInitialDxfFingerprint] = useState('');
  const [revisionIssueSource, setRevisionIssueSource] =
    useState('1차 샘플 장착 테스트');
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
    canScheduleFitting && selectedZone?.currentStage === 'Fitting'
      ? 'FITTING'
      : canScheduleScan
        ? 'SCAN'
        : 'FITTING',
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
  const [selectedSampleDesignIds, setSelectedSampleDesignIds] = useState<
    readonly string[]
  >(sampleCandidates.map((design) => design.id));
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
    design: `${designLabel(project.product)} 등록 · Revision 1`,
    revision: `${designLabel(project.product)} · 새 버전 추가`,
    visit: 'Schedule Visit',
    sample: 'Sample Request',
    file: 'Add File Reference',
    promote: '양산 인계 완료 기록',
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
      onSample(factory, selectedSampleDesignIds);
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
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
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
                    onChange={() => setConfigurationMode('NEW')}
                  />
                  <span>
                    <strong>Create another Configuration</strong>
                    <small>
                      실제로 다른 조합인 경우 — 별도 Research Configuration 생성
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="configuration-mode"
                    checked={configurationMode === 'FIX'}
                    onChange={() => setConfigurationMode('FIX')}
                  />
                  <span>
                    <strong>Correct current Research information</strong>
                    <small>조사 정보가 틀렸던 경우 — 감사 로그 기록</small>
                  </span>
                </label>
              </fieldset>
              <label className="dialog-field-label">
                Reason / Notes
                <Input
                  value={configurationNote}
                  onChange={(event) => setConfigurationNote(event.target.value)}
                  placeholder="예: 딜러 확인 결과 Storage 옵션 오기재"
                />
              </label>
            </div>
          )}
          {dialog === 'design' && (
            <div className="project-dialog-stack">
              <div className="dialog-note">
                {project.product === 'Seat Cover'
                  ? 'Part의 디자인, 수량과 상세 정보를 등록합니다.'
                  : project.product === 'Car Cover'
                    ? '차량 전체 패턴을 등록합니다. 같은 조사 차량의 패턴 수정은 새 버전으로 관리합니다.'
                    : '선택한 차량 구역의 금형을 등록합니다. 금형 수정·재스캔은 새 버전으로 관리합니다.'}{' '}
                Revision 1이 함께 생성됩니다.
              </div>
              {designIdentityExists && (
                <p role="alert">
                  동일한 조사 차량
                  {project.product === 'Floor Mat' ? '·구역' : ''}의 설계가 이미
                  있습니다. 기존 설계에서 새 버전을 추가하세요.
                </p>
              )}
              {designNameExists && (
                <p role="alert">이미 사용 중인 설계 이름입니다.</p>
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
                  {project.product === 'Floor Mat' ? '금형 이름' : '패턴 이름'}
                  <Input
                    value={designName}
                    onChange={(event) => setDesignName(event.target.value)}
                  />
                </label>
                {project.product === 'Seat Cover' && (
                  <label>
                    Project Quantity
                    <Input
                      type="number"
                      value={designQuantity}
                      min="1"
                      onChange={(event) =>
                        setDesignQuantity(event.target.value)
                      }
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
                      onValueChange={(value) =>
                        setSeatSide(
                          value as
                            'DRIVER' | 'PASSENGER' | 'CENTER' | 'UNIVERSAL',
                        )
                      }
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
                        onCheckedChange={(checked) =>
                          setIsForMiddleSeat(Boolean(checked))
                        }
                      />
                      Middle seat part
                    </label>
                    <label>
                      <Checkbox
                        checked={isCustomPart}
                        onCheckedChange={(checked) =>
                          setIsCustomPart(Boolean(checked))
                        }
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
                    onChange={(event) => setRevisionNote(event.target.value)}
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
                  Current Rev{' '}
                  {designs.find((design) => design.id === dialogDesignId)
                    ? currentRevision(
                        designs.find(
                          (design) => design.id === dialogDesignId,
                        ) as ProjectDesign,
                      ).revisionNumber
                    : '—'}
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
                    onChange={(event) => setRevisionNote(event.target.value)}
                    placeholder="변경 사유를 입력하세요"
                  />
                </label>
                <label>
                  문제 출처
                  <Input
                    value={revisionIssueSource}
                    onChange={(event) =>
                      setRevisionIssueSource(event.target.value)
                    }
                    placeholder="예: 1차 샘플 장착 테스트"
                  />
                </label>
                <label>
                  문제 부위
                  <Input
                    value={revisionIssueArea}
                    onChange={(event) =>
                      setRevisionIssueArea(event.target.value)
                    }
                    placeholder="예: 등받이 하단"
                  />
                </label>
                <label className="full-width">
                  수정 설명
                  <textarea
                    className="revision-instruction-textarea"
                    value={revisionInstruction}
                    onChange={(event) =>
                      setRevisionInstruction(event.target.value)
                    }
                    placeholder="무엇을 어디에서 얼마나 변경할지 입력하세요. 예: 표시된 하단 패턴 길이를 10mm 늘림"
                  />
                </label>
                <label>
                  참고 이미지
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
                  <span>이전 버전 · 자동 연결</span>
                  <strong>
                    {previousRevision
                      ? `Rev ${previousRevision.revisionNumber}`
                      : '—'}
                  </strong>
                  <small>
                    {previousRevision?.dxfFileName ??
                      '기준 DXF 정보가 없어 아래에서 한 번 등록해야 합니다.'}
                  </small>
                </div>
                {previousRevision && !previousRevision.dxfFingerprint && (
                  <label>
                    이전 버전 기준 DXF
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
                  새 DXF 파일
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
                    이전 버전과 동일한 DXF입니다. 실제로 수정한 새 파일을
                    선택하세요.
                  </p>
                )}
                <label className="revision-designer-confirmation full-width">
                  <Checkbox
                    checked={designerConfirmed}
                    onCheckedChange={(checked) =>
                      setDesignerConfirmed(Boolean(checked))
                    }
                  />
                  수정 설명, 참고 이미지와 새 DXF가 일치함을 디자이너가
                  확인했습니다.
                </label>
              </div>
              <div className="dialog-note">
                필수 정보가 모두 확인되면 변경된 부품의 공장 수정 지시서가 자동
                생성됩니다. 새 Revision은 Sample 입고 및 수정 반영 검증 전까지
                미승인 상태입니다.
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
                    onValueChange={(value) =>
                      setLocationType(
                        value as NonNullable<ProjectVisit['locationType']>,
                      )
                    }
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
                    onValueChange={(value) =>
                      setPriority(value as 'NORMAL' | 'URGENT')
                    }
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
                    value={targetVehicleResearchId || 'NONE'}
                    onValueChange={(value) =>
                      setTargetVehicleResearchId(value === 'NONE' ? '' : value)
                    }
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
                    onValueChange={(value) =>
                      setDealer(value as (typeof DEALERS)[number])
                    }
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
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label>
                  Time
                  <Input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
              </div>
              {!visitGateUnlocked && (
                <div className="stage-gate-lock">
                  <strong>{visitType} Visit Gate 잠김</strong>
                  작업 대상 Zone 또는 필수 Floor Mat Bundle이{' '}
                  {visitType === 'SCAN' ? 'Scan' : 'Fitting'} 단계에 도달해야
                  일정을 등록할 수 있습니다.
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
                        onCheckedChange={(checked) =>
                          setSelectedProjectIds((current) =>
                            checked === true
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id),
                          )
                        }
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
                      onCheckedChange={(checked) =>
                        setStaffIds((current) =>
                          checked === true
                            ? [...new Set([...current, user.id])]
                            : current.filter((id) => id !== user.id),
                        )
                      }
                    />
                    <span>{user.name}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Visit Note
                <Textarea
                  value={visitNote}
                  onChange={(event) => setVisitNote(event.target.value)}
                  placeholder="Vehicle availability, equipment, or instructions for this visit."
                />
              </label>
            </div>
          )}
          {dialog === 'sample' && (
            <div className="project-dialog-stack">
              <label className="dialog-field-label">
                Factory
                <Select
                  value={factory}
                  onValueChange={(value) =>
                    setFactory(value as (typeof FACTORIES)[number])
                  }
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
              <div className="sample-dialog-items">
                <strong>Items — 현재 revision · design별 다음 round</strong>
                {sampleCandidates.map((design) => (
                  <label key={design.id}>
                    <Checkbox
                      checked={selectedSampleDesignIds.includes(design.id)}
                      onCheckedChange={(checked) =>
                        setSelectedSampleDesignIds((current) =>
                          checked
                            ? [...current, design.id]
                            : current.filter((id) => id !== design.id),
                        )
                      }
                    />
                    <span>
                      {design.name} · Rev{' '}
                      {currentRevision(design).revisionNumber} · Round{' '}
                      {samples.length + 1}
                    </span>
                  </label>
                ))}
                {!sampleCandidates.length && (
                  <p className="empty-inline">
                    요청할 수정 부품이 없습니다. 새 수정 요청을 작성하거나
                    일부·미반영 판정된 부품을 확인하세요.
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
                  onChange={(event) => setFileName(event.target.value)}
                />
              </label>
              <label>
                Asset Type
                <Select
                  value={fileType}
                  onValueChange={(value) =>
                    setFileType(value as ProjectAsset['type'])
                  }
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
                Stage 13 · 생산 담당자에게 최종 자료를 인계한 뒤 개발 완료를
                기록합니다. Shape 발급은 후속 프로세스입니다.
              </div>
              <HandoffChecklistForm
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
                (!canRequestSample || !selectedSampleDesignIds.length)) ||
              (dialog === 'file' && !fileName.trim())
            }
          >
            {dialog === 'new-configuration'
              ? 'Apply'
              : dialog === 'design'
                ? `${designLabel(project.product)} 등록`
                : dialog === 'revision'
                  ? 'Add Revision'
                  : dialog === 'visit'
                    ? 'Schedule Visit'
                    : dialog === 'sample'
                      ? 'Create Request'
                      : dialog === 'file'
                        ? 'Add Reference'
                        : '양산 인계 완료 · 개발 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
