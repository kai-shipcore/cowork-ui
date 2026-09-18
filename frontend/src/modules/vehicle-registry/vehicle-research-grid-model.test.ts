import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { groupVehicleResearch } from './vehicle-research-grid-model';

function configuration(id: string, vehicle: string): VehicleConfiguration {
  return {
    id,
    vehicle,
    vehicleClass: 'SUV',
    options: [['Powertrain', 'Hybrid']],
    researchStatus: 'COMPLETE',
    projectGroupIds: [`project-${id}`],
  };
}

await test('groups configurations by full vehicle identity and preserves rows and project links', () => {
  const first = configuration('a', '2023–2026 Toyota RAV4');
  const second = configuration('b', '2024 Honda CR-V');
  const third = configuration('c', first.vehicle);
  const input = [first, second, third];
  const before = structuredClone(input);
  const groups = groupVehicleResearch(input);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.id, first.vehicle);
  assert.equal(groups[0]?.title, 'Toyota RAV4');
  assert.equal(groups[0]?.description, '2023–2026 · SUV · 2 Configurations');
  assert.deepEqual(
    groups[0]?.rows.map((row) => row.id),
    ['a', 'c'],
  );
  assert.strictEqual(groups[0]?.rows[0], first);
  assert.deepEqual(groups[0]?.rows[0]?.projectGroupIds, ['project-a']);
  assert.deepEqual(input, before);
});

await test('different year ranges remain separate groups and paging never splits configurations', () => {
  const groups = groupVehicleResearch([
    configuration('a', '2023–2026 Toyota RAV4'),
    configuration('b', '2020–2022 Toyota RAV4'),
    configuration('c', '2023–2026 Toyota RAV4'),
  ]);
  assert.equal(groups.length, 2);
  assert.notEqual(groups[0]?.id, groups[1]?.id);
  assert.equal(groups.slice(0, 1)[0]?.rows.length, 2);
  assert.equal(groups.slice(1, 2)[0]?.rows.length, 1);
});

await test('filtered results retain collapse ids but reflect only matching configuration counts', () => {
  const first = configuration('a', '2024 Honda CR-V');
  const second: VehicleConfiguration = {
    ...configuration('b', first.vehicle),
    researchStatus: 'RESEARCHING',
  };
  const all = groupVehicleResearch([first, second]);
  const filtered = groupVehicleResearch(
    [first, second].filter((row) => row.researchStatus === 'COMPLETE'),
  );
  assert.equal(filtered[0]?.id, all[0]?.id);
  assert.equal(filtered[0]?.description, '2024 · SUV · 1 Configurations');
  assert.deepEqual(filtered[0]?.rows, [first]);
});

await test('empty results render no groups and labels without a year remain readable', () => {
  assert.deepEqual(groupVehicleResearch([]), []);
  const groups = groupVehicleResearch([
    { ...configuration('truck', 'Ford F-150'), vehicleClass: 'Truck' },
  ]);
  assert.equal(groups[0]?.title, 'Ford F-150');
  assert.equal(groups[0]?.description, 'Truck · 1 Configurations');
  assert.equal(groups[0]?.vehicleClass, 'Truck');
});
