import type { ShapeAssignment } from '../types/db-workflow';
import type { VehicleProductShape, VehicleZone } from '../types/workbench';

export function assignmentErrors(
  input: ShapeAssignment,
  productTypeId: string,
  shapes: readonly VehicleProductShape[],
  zones: readonly VehicleZone[],
  history: readonly ShapeAssignment[],
): string[] {
  const errors: string[] = [];
  const shape = shapes.find((row) => row.id === input.vehicleProductShapeId);
  if (shape?.productTypeId !== productTypeId || shape.status !== 'ACTIVE')
    errors.push('같은 제품 유형의 확정 Shape만 적용할 수 있습니다.');
  if (
    !zones.some(
      (zone) =>
        zone.id === input.vehicleZoneId && zone.productTypeId === productTypeId,
    )
  )
    errors.push('제품 유형에 맞는 Zone을 선택하세요.');
  if (input.type === 'PRIMARY' && input.substitutionPriority !== undefined)
    errors.push('PRIMARY에는 대체 순위를 지정할 수 없습니다.');
  if (
    input.type === 'ALTERNATIVE' &&
    (!Number.isInteger(input.substitutionPriority) ||
      (input.substitutionPriority ?? 0) <= 0)
  )
    errors.push('대체 순위는 양의 정수여야 합니다.');
  const peers = history.filter(
    (row) =>
      row.id !== input.id &&
      row.uniqueVehicleId === input.uniqueVehicleId &&
      row.vehicleZoneId === input.vehicleZoneId &&
      !row.validTo,
  );
  if (
    peers.some(
      (row) => row.vehicleProductShapeId === input.vehicleProductShapeId,
    )
  )
    errors.push('이 Zone에 이미 적용된 Shape입니다.');
  if (input.type === 'PRIMARY' && peers.some((row) => row.type === 'PRIMARY'))
    errors.push('기존 PRIMARY 적용을 종료한 후 변경하세요.');
  if (
    input.type === 'ALTERNATIVE' &&
    peers.some(
      (row) =>
        row.type === 'ALTERNATIVE' &&
        row.substitutionPriority === input.substitutionPriority,
    )
  )
    errors.push('이미 사용 중인 대체 순위입니다.');
  if (
    !Number.isFinite(Date.parse(input.validFrom)) ||
    Date.parse(input.validFrom) > Date.now()
  )
    errors.push('적용 시작 시각을 확인하세요.');
  return errors;
}
