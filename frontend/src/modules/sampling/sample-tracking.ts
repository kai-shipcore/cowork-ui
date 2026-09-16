import { sampleStatus } from '@/shared/domain/sample-inspection';
import type {
  ProjectDetailSnapshot,
  SampleRequest,
  SampleRequestItem,
  VehicleProjectGroup,
} from '@/shared/types/workbench';

/** Ready once the requested revision's sample was approved; Sample until then. */
export type PartStatus = 'READY' | 'SAMPLE';

/**
 * One row of the Sample Tracking sheet (Stage 8): one part of one request.
 * Field order follows the `SeatCover-Sample-Request` tab.
 */
export interface SampleTrackingRow {
  id: string;
  requestId: string;
  projectGroupId: string;
  /** Slack post date, `YYYY-MM-DD`. */
  date: string;
  /** Year range, make and model as one display string. */
  vehicle: string;
  seatType: string;
  partName: string;
  status: PartStatus;
  sampleRound: number;
  vendor: string;
  note: string;
}

interface SampleTrackingInput {
  requests: readonly SampleRequest[];
  items: readonly SampleRequestItem[];
  projects: readonly VehicleProjectGroup[];
  projectDetails: Readonly<Record<string, ProjectDetailSnapshot>>;
}

const SEAT_OPTION_KEY = /seat$/i;

/** `2nd Row · 2nd Row Seat Bench` — the zone plus every seat-form option. */
export function seatTypeLabel(
  zoneLabel: string | undefined,
  options: VehicleProjectGroup['options'],
): string {
  const seatOptions = options
    .filter(([key]) => SEAT_OPTION_KEY.test(key))
    .map(([key, value]) => `${key} ${value}`);
  return [zoneLabel, ...seatOptions].filter(Boolean).join(' · ') || '—';
}

/** Flattens requests into "one part = one row", joining project and design names. */
export function toSampleTrackingRows({
  requests,
  items,
  projects,
  projectDetails,
}: SampleTrackingInput): SampleTrackingRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return requests.flatMap((request) => {
    const project = projectById.get(request.projectGroupId);
    const designs = projectDetails[request.projectGroupId]?.designs ?? [];
    return items
      .filter((item) => item.sampleRequestId === request.id)
      .map((item) => {
        const design = designs.find(
          (candidate) => candidate.id === item.vehicleProductDesignId,
        );
        const zone = project?.zoneProjects.find(
          (candidate) => candidate.id === design?.vehicleProjectId,
        );
        const revision = design?.revisions.find(
          (candidate) => candidate.id === item.vehicleProductDesignRevisionId,
        );
        const status: PartStatus =
          revision?.sampleApprovedAt && sampleStatus(item) === 'PASSED'
            ? 'READY'
            : 'SAMPLE';
        const row: SampleTrackingRow = {
          id: item.id,
          requestId: request.id,
          projectGroupId: request.projectGroupId,
          date: request.createdAt.slice(0, 10),
          vehicle: request.vehicle,
          seatType: seatTypeLabel(zone?.label, project?.options ?? []),
          partName: design?.name ?? item.vehicleProductDesignId,
          status,
          sampleRound: item.sampleRound,
          vendor: request.factory,
          note: item.note ?? request.note ?? '',
        };
        return row;
      });
  });
}
