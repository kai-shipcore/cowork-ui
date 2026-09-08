import type {
  ProductType,
  ProjectDesign,
  ProjectDesignDetails,
} from '../types/workbench';

export function designLabel(product: ProductType): string {
  return product === 'Seat Cover'
    ? 'Parts'
    : product === 'Car Cover'
      ? '전체 패턴'
      : '구역별 금형';
}

export function hasDesignIdentity(
  designs: readonly ProjectDesign[],
  details: ProjectDesignDetails,
): boolean {
  return (
    details.kind !== 'SEAT_COVER' &&
    designs.some(
      ({ details: existing }) =>
        existing.kind === details.kind &&
        existing.vehicleResearchId === details.vehicleResearchId &&
        (details.kind === 'CAR_COVER' ||
          (existing.kind === 'FLOOR_MAT' &&
            existing.vehicleZoneId === details.vehicleZoneId)),
    )
  );
}
