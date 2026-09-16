import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShapeAssignment } from '../types/db-workflow';
import type { VehicleProductShape, VehicleZone } from '../types/workbench';
import { assignmentErrors } from './shape-assignment';

const shapes = [
  { id: 's', productTypeId: 'PT-CC', status: 'ACTIVE' },
  { id: 's2', productTypeId: 'PT-CC', status: 'ACTIVE' },
] as VehicleProductShape[];
const zones = [{ id: 'z', productTypeId: 'PT-CC' }] as VehicleZone[];
const assignment: ShapeAssignment = {
  id: 'a',
  uniqueVehicleId: 'v',
  vehicleZoneId: 'z',
  vehicleProductShapeId: 's',
  type: 'PRIMARY',
  validFrom: '2026-01-01',
};
void test('sales vehicles may share shape but each zone has one current primary', () => {
  assert.deepEqual(
    assignmentErrors(assignment, 'PT-CC', shapes, zones, []),
    [],
  );
  assert.deepEqual(
    assignmentErrors(
      { ...assignment, id: 'a2', uniqueVehicleId: 'v2' },
      'PT-CC',
      shapes,
      zones,
      [assignment],
    ),
    [],
  );
  assert.ok(
    assignmentErrors(
      { ...assignment, id: 'a2', vehicleProductShapeId: 's2' },
      'PT-CC',
      shapes,
      zones,
      [assignment],
    ).length,
  );
  assert.deepEqual(
    assignmentErrors(
      { ...assignment, id: 'a2', vehicleProductShapeId: 's2' },
      'PT-CC',
      shapes,
      zones,
      [{ ...assignment, validTo: '2026-01-02' }],
    ),
    [],
  );
});
void test('alternative priority, active state and product/zone are validated', () => {
  assert.ok(
    assignmentErrors(
      { ...assignment, type: 'ALTERNATIVE' },
      'PT-CC',
      shapes,
      zones,
      [],
    ).length,
  );
  assert.ok(
    assignmentErrors(
      { ...assignment, substitutionPriority: 1 },
      'PT-CC',
      shapes,
      zones,
      [],
    ).length,
  );
  assert.ok(assignmentErrors(assignment, 'PT-SC', shapes, zones, []).length);
  assert.ok(
    assignmentErrors(
      assignment,
      'PT-CC',
      [{ ...shapes[0], status: 'IN_DEVELOPMENT' }],
      zones,
      [],
    ).length,
  );
});
