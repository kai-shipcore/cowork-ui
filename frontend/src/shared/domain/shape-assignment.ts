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
    errors.push(
      'Only a confirmed Shape of the same product type can be assigned.',
    );
  if (
    !zones.some(
      (zone) =>
        zone.id === input.vehicleZoneId && zone.productTypeId === productTypeId,
    )
  )
    errors.push('Select a zone matching the product type.');
  if (input.type === 'PRIMARY' && input.substitutionPriority !== undefined)
    errors.push('PRIMARY assignments cannot have alternative priority.');
  if (
    input.type === 'ALTERNATIVE' &&
    (!Number.isInteger(input.substitutionPriority) ||
      (input.substitutionPriority ?? 0) <= 0)
  )
    errors.push('Alternative priority must be a positive integer.');
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
    errors.push('This Shape is already assigned to the zone.');
  if (input.type === 'PRIMARY' && peers.some((row) => row.type === 'PRIMARY'))
    errors.push('End the existing PRIMARY assignment before changing it.');
  if (
    input.type === 'ALTERNATIVE' &&
    peers.some(
      (row) =>
        row.type === 'ALTERNATIVE' &&
        row.substitutionPriority === input.substitutionPriority,
    )
  )
    errors.push('This alternative priority is already in use.');
  if (
    !Number.isFinite(Date.parse(input.validFrom)) ||
    Date.parse(input.validFrom) > Date.now()
  )
    errors.push('Check the effective start time.');
  return errors;
}
