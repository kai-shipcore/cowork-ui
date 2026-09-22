import type { FitmentQuality } from '@/shared/types/db-workflow';

export type FitmentKind = 'projects' | 'parts';
export function fitmentKind(record: FitmentQuality): FitmentKind {
  return record.vehicleProductDesignId ? 'parts' : 'projects';
}
export function sameFitmentTarget(
  a: FitmentQuality,
  b: FitmentQuality,
): boolean {
  return (
    a.vehicleResearchId === b.vehicleResearchId &&
    a.vehicleProjectId === b.vehicleProjectId &&
    a.vehicleProductDesignId === b.vehicleProductDesignId &&
    a.vehicleZoneId === b.vehicleZoneId
  );
}
export function latestFitments(
  records: readonly FitmentQuality[],
): FitmentQuality[] {
  const sorted = [...records].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return sorted.filter(
    (record, index) =>
      !sorted.slice(0, index).some((newer) => sameFitmentTarget(record, newer)),
  );
}
