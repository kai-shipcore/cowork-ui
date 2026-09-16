import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ProjectDetailSnapshot,
  SampleRequest,
  SampleRequestItem,
  VehicleProjectGroup,
} from '@/shared/types/workbench';
import { seatTypeLabel, toSampleTrackingRows } from './sample-tracking';

const project = {
  id: 'PG-1',
  productTypeId: 'PT-SC',
  vehicle: '2024–2026 Hyundai Santa Fe Hybrid',
  vehicleResearchId: 'VR-1',
  fNumber: '20856',
  options: [
    ['Powertrain', 'Hybrid'],
    ['2nd Row Seat', 'Bench'],
  ],
  product: 'Seat Cover',
  zoneProjects: [
    {
      id: 'PG-1-B',
      projectGroupId: 'PG-1',
      productTypeId: 'PT-SC',
      vehicleResearchId: 'VR-1',
      zoneId: 'Z-B',
      code: 'B',
      label: '2nd Row',
      managerId: 'USR-KAI',
      currentStage: 'Sample',
    },
  ],
  stage: 'Sample',
  status: 'IN PROGRESS',
  created: '2026-05-01',
} as unknown as VehicleProjectGroup;

const request: SampleRequest = {
  id: 'SR-1',
  projectGroupId: 'PG-1',
  vehicle: project.vehicle,
  product: 'Seat Cover',
  factory: 'Tianhong',
  note: 'request memo',
  createdAt: '2026-05-20T09:00:00-07:00',
};

const items: SampleRequestItem[] = [
  {
    id: 'SRI-BT',
    sampleRequestId: 'SR-1',
    vehicleProductDesignId: 'D-BT',
    vehicleProductDesignRevisionId: 'REV-BT-3',
    sampleRound: 3,
    priority: 'NORMAL',
    note: 'Backrest creased at rear (see checklist)',
  },
  {
    id: 'SRI-BHM',
    sampleReceivedAt: '2026-05-24',
    inspectedAt: '2026-05-25',
    inspectedBy: 'USR-KAI',
    drawingMatch: true,
    revisionReflected: 'CORRECT',
    sampleRequestId: 'SR-1',
    vehicleProductDesignId: 'D-BHM',
    vehicleProductDesignRevisionId: 'REV-BHM-1',
    sampleRound: 3,
    priority: 'NORMAL',
  },
  {
    id: 'SRI-BB',
    sampleRequestId: 'SR-1',
    vehicleProductDesignId: 'D-BB',
    vehicleProductDesignRevisionId: 'REV-BB-1',
    sampleRound: 3,
    priority: 'NORMAL',
  },
];

const projectDetails = {
  'PG-1': {
    designs: [
      {
        id: 'D-BT',
        name: 'BT-HD-SF-Ben2Hy-26-M',
        vehicleProjectId: 'PG-1-B',
        revisions: [{ id: 'REV-BT-3', revisionNumber: 3 }],
      },
      {
        id: 'D-BHM',
        name: 'BHM-HD-SF-Ben2Hy-26-M',
        vehicleProjectId: 'PG-1-B',
        revisions: [
          {
            id: 'REV-BHM-1',
            revisionNumber: 1,
            sampleApprovedAt: '2026-05-25T10:00:00-07:00',
          },
        ],
      },
    ],
  },
} as unknown as Record<string, ProjectDetailSnapshot>;

function rows() {
  return toSampleTrackingRows({
    requests: [request],
    items,
    projects: [project],
    projectDetails,
  });
}

test('produces one row per request line in sheet order', () => {
  const [sampleRow] = rows();

  assert.equal(rows().length, 3);
  assert.deepEqual(sampleRow, {
    id: 'SRI-BT',
    requestId: 'SR-1',
    projectGroupId: 'PG-1',
    date: '2026-05-20',
    vehicle: '2024–2026 Hyundai Santa Fe Hybrid',
    seatType: '2nd Row · 2nd Row Seat Bench',
    partName: 'BT-HD-SF-Ben2Hy-26-M',
    status: 'SAMPLE',
    sampleRound: 3,
    vendor: 'Tianhong',
    note: 'Backrest creased at rear (see checklist)',
  });
});

test('marks a line Ready once its revision sample was approved', () => {
  const [, readyRow] = rows();

  assert.equal(readyRow?.partName, 'BHM-HD-SF-Ben2Hy-26-M');
  assert.equal(readyRow?.status, 'READY');
  assert.equal(readyRow?.sampleRound, 3);
});

test('falls back to the design id and request note when the design is unknown', () => {
  const [, , unknownRow] = rows();

  assert.equal(unknownRow?.partName, 'D-BB');
  assert.equal(unknownRow?.status, 'SAMPLE');
  assert.equal(unknownRow?.note, 'request memo');
});

test('labels the seat type from the zone and seat options', () => {
  assert.equal(seatTypeLabel(undefined, []), '—');
  assert.equal(
    seatTypeLabel('Front Row', [
      ['Front Seat', 'Bucket'],
      ['Seats', '5 Seats'],
    ]),
    'Front Row · Front Seat Bucket',
  );
});
