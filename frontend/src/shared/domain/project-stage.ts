import type {
  ProductType,
  ProjectStage,
  VehicleZoneProject,
} from '@/shared/types/workbench';

export const PROJECT_PIPELINES: Record<ProductType, readonly ProjectStage[]> = {
  'Seat Cover': [
    'Research',
    'Vehicle Hunt',
    'Scan',
    'Design',
    'Sample',
    'Fitting',
    'Approved',
  ],
  'Floor Mat': [
    'Research',
    'Vehicle Hunt',
    'Scan',
    'Design',
    'Sample',
    'Fitting',
    'Approved',
  ],
  'Car Cover': [
    'Research',
    '3D Model',
    'Fit Review',
    'Design',
    'Sample',
    'Fitting',
    'Approved',
  ],
};

export interface GroupStageSummary {
  currentStage: ProjectStage;
  stageIndex: number;
  totalZones: number;
  passedZones: number;
  blockingZones: readonly VehicleZoneProject[];
  completedByStage: Readonly<Record<ProjectStage, number>>;
  isComplete: boolean;
}

/**
 * A project group owns no workflow position of its own. This is an
 * informational roll-up only: the earliest member stage is useful in a group
 * header, but must never be used to authorize work on every member.
 */
export function summarizeGroupStage(
  product: ProductType,
  zones: readonly VehicleZoneProject[],
): GroupStageSummary {
  const pipeline = PROJECT_PIPELINES[product];
  const lastIndex = pipeline.length - 1;
  const zoneIndexes = zones.map((zone) => {
    const index = pipeline.indexOf(zone.currentStage);
    return index < 0 ? 0 : index;
  });
  const stageIndex = zoneIndexes.length ? Math.min(...zoneIndexes) : 0;
  const currentStage = pipeline[stageIndex] ?? pipeline[0] ?? 'Research';
  const isComplete =
    zoneIndexes.length > 0 && zoneIndexes.every((index) => index === lastIndex);
  const passedZones = isComplete
    ? zoneIndexes.length
    : zoneIndexes.filter((index) => index > stageIndex).length;
  const blockingZones = isComplete
    ? []
    : zones.filter((_, index) => zoneIndexes[index] === stageIndex);
  const completedByStage = Object.fromEntries(
    pipeline.map((stage, index) => [
      stage,
      zoneIndexes.filter((zoneIndex) =>
        index === lastIndex ? zoneIndex === lastIndex : zoneIndex > index,
      ).length,
    ]),
  ) as Readonly<Record<ProjectStage, number>>;

  return {
    currentStage,
    stageIndex,
    totalZones: zones.length,
    passedZones,
    blockingZones,
    completedByStage,
    isComplete,
  };
}

/**
 * PRD 7.2 gate scope. Seat Cover zones are independent. Floor Mat F + B are
 * the required bundle and therefore cross a gate together; an optional E row
 * remains independent. Single-zone products naturally return one member.
 */
export function projectGateScope(
  product: ProductType,
  zones: readonly VehicleZoneProject[],
  vehicleProjectId: string,
): readonly VehicleZoneProject[] {
  const selected = zones.find((zone) => zone.id === vehicleProjectId);
  if (!selected) return [];
  if (product === 'Floor Mat' && ['F', 'B'].includes(selected.code)) {
    return zones.filter((zone) => ['F', 'B'].includes(zone.code));
  }
  return [selected];
}

/** Authorizes one zone project (or its explicit Floor Mat bundle). */
export function isProjectStageUnlocked(
  product: ProductType,
  zones: readonly VehicleZoneProject[],
  vehicleProjectId: string,
  requiredStage: ProjectStage,
): boolean {
  const pipeline = PROJECT_PIPELINES[product];
  const requiredIndex = pipeline.indexOf(requiredStage);
  const scope = projectGateScope(product, zones, vehicleProjectId);
  if (requiredIndex < 0 || scope.length === 0) return false;
  return scope.every((zone) => {
    const zoneIndex = pipeline.indexOf(zone.currentStage);
    return zoneIndex >= requiredIndex;
  });
}

/** Returns the concrete projects on which an operation may be started. */
export function eligibleProjectIdsForStage(
  product: ProductType,
  zones: readonly VehicleZoneProject[],
  requiredStage: ProjectStage,
): readonly string[] {
  return zones
    .filter((zone) =>
      isProjectStageUnlocked(product, zones, zone.id, requiredStage),
    )
    .map((zone) => zone.id);
}
