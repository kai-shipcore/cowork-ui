import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { buildHeaderBreadcrumbs } from './header-breadcrumbs';

const configuration = {
  id: 'c01',
  vehicle: '2023–2026 Toyota RAV4',
} as VehicleConfiguration;

await test('research configuration breadcrumbs preserve the full clickable hierarchy', () => {
  assert.deepEqual(
    buildHeaderBreadcrumbs(
      '/vehicle-research/c01/configurations/c01%3APT-SC',
      '',
      [configuration],
    ),
    [
      { label: 'R & D Team', to: '/dashboard' },
      { label: 'Vehicle Research', to: '/vehicle-research' },
      { label: 'Toyota RAV4', to: '/vehicle-research/c01' },
      {
        label: 'Research Configuration',
        to: '/vehicle-research/c01/configurations/c01%3APT-SC',
      },
    ],
  );
});

await test('vehicle detail breadcrumbs stop at the selected vehicle', () => {
  assert.deepEqual(
    buildHeaderBreadcrumbs('/vehicle-research/c01', '', [configuration]),
    [
      { label: 'R & D Team', to: '/dashboard' },
      { label: 'Vehicle Research', to: '/vehicle-research' },
      { label: 'Toyota RAV4', to: '/vehicle-research/c01' },
    ],
  );
});
