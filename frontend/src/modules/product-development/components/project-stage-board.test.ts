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
      users: [],
      onOpen: () => {
        /* SSR has no clicks. */
      },
    }),
  );
  assert.match(html, /Board vehicle/);
  assert.match(html, /3D Model/);
  assert.match(html, /Unassigned/);
  assert.match(html, /type="button" class="rd-board-card"/);
  assert.match(html, /data-health="late"/);
  assert.match(html, /Late/);
  assert.match(html, /Target date 3 days overdue/);
  assert.doesNotMatch(html, /draggable=/);
});
await test('empty board explains the active-filter empty state', () => {
  const html = renderToStaticMarkup(
    createElement(ProjectStageBoard, {
      projects: [],
      users: [],
      onOpen: () => {
        /* SSR has no clicks. */
      },
    }),
  );
  assert.match(html, /No projects match these filters/);
});
