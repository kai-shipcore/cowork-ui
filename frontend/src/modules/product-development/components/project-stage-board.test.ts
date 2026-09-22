import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VehicleProjectGroup } from '@/shared/types/workbench';
import { ProjectStageBoard } from './project-stage-board';

await test('board exposes each zone as an accessible detail action without bypassing approval gates', () => {
  const projects: VehicleProjectGroup[] = [
    {
      id: 'p1',
      productTypeId: 'PT-CC',
      vehicle: 'Board vehicle',
      vehicleResearchId: 'c1',
      options: [],
      product: 'Car Cover',
      stage: '3D Model',
      status: 'IN PROGRESS',
      created: '2026-09-21',
      zoneProjects: [
        {
          id: 'z1',
          projectGroupId: 'p1',
          productTypeId: 'PT-CC',
          vehicleResearchId: 'c1',
          zoneId: 'Z1',
          code: 'BODY',
          label: 'Body',
          managerId: '',
          currentStage: '3D Model',
          targetAt: '2026-09-18',
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    createElement(ProjectStageBoard, {
      projects,
      currentDate: '2026-09-21',
      onOpen: () => {
        /* SSR has no clicks. */
      },
    }),
  );
  assert.match(html, /Board vehicle/);
  assert.match(html, /3D Model/);
  assert.match(html, /Body · Car Cover/);
  assert.match(html, /Normal/);
  assert.match(html, /Details/);
  assert.match(html, /type="button" class="rd-board-card"/);
  assert.match(html, /data-health="late"/);
  assert.match(html, /Late/);
  assert.match(html, /Target date 3 days overdue/);
  assert.doesNotMatch(html, /Stage target/);
  assert.doesNotMatch(html, /Last activity/);
  assert.doesNotMatch(html, /draggable=/);
});
await test('empty board explains the active-filter empty state', () => {
  const html = renderToStaticMarkup(
    createElement(ProjectStageBoard, {
      projects: [],
      onOpen: () => {
        /* SSR has no clicks. */
      },
    }),
  );
  assert.match(html, /No projects match these filters/);
});

await test('each stage lane renders one page at a time', () => {
  const zoneProjects = Array.from({ length: 10 }, (_, index) => ({
    id: `zone-${String(index + 1)}`,
    projectGroupId: 'paged-project',
    productTypeId: 'PT-CC',
    vehicleResearchId: 'c1',
    zoneId: `Z${String(index + 1)}`,
    code: `ZONE-${String(index + 1)}`,
    label: `Zone ${String(index + 1)}`,
    managerId: '',
    currentStage: 'Vehicle Hunt' as const,
    targetAt: '2026-10-01',
  }));
  const project: VehicleProjectGroup = {
    id: 'paged-project',
    productTypeId: 'PT-CC',
    vehicle: 'Paginated vehicle',
    vehicleResearchId: 'c1',
    options: [],
    product: 'Car Cover',
    stage: 'Vehicle Hunt',
    status: 'IN PROGRESS',
    created: '2026-09-21',
    zoneProjects,
  };
  const html = renderToStaticMarkup(
    createElement(ProjectStageBoard, {
      projects: [project],
      currentDate: '2026-09-21',
      onOpen: () => {
        /* SSR has no clicks. */
      },
    }),
  );
  assert.match(html, /Zone 8/);
  assert.doesNotMatch(html, /Zone 9/);
  assert.match(html, /Load next 2/);
  assert.match(html, /8 of 10/);
});
