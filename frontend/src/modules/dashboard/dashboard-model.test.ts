import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  SampleRequest,
  SampleRequestItem,
  VehicleConfiguration,
  VehicleProjectGroup,
  Visit,
} from '../../shared/types/workbench';
import {
  daysBetween,
  SAMPLE_FITTING_WAIT_DAYS,
  summarizeDashboard,
  type DashboardInput,
} from './dashboard-model';

const TODAY = '2026-09-09';

const configuration: VehicleConfiguration = {
  id: 'c01',
  vehicle: '2026 Honda CR-V',
  vehicleClass: 'SUV',
  options: [],
  researchStatus: 'COMPLETE',
  projectGroupIds: ['PG-1'],
};

const project: VehicleProjectGroup = {
  id: 'PG-1',
  productTypeId: 'PT-SC',
  vehicle: '2026 Honda CR-V',
  vehicleResearchId: 'c01',
  options: [],
  product: 'Seat Cover',
  stage: 'Fitting',
  status: 'IN PROGRESS',
  created: '2026-08-01',
  zoneProjects: [
    {
      id: 'PG-1-F',
      projectGroupId: 'PG-1',
      productTypeId: 'PT-SC',
      vehicleResearchId: 'c01',
      zoneId: 'ZONE-SC-F',
      code: 'F',
      label: 'Front Row',
      managerId: 'USR-KAI',
      currentStage: 'Fitting',
      status: 'ACTIVE',
      priority: 'HIGH',
      targetAt: '2026-09-05T17:00:00-07:00',
      lastActivityAt: '2026-08-20T09:00:00-07:00',
    },
  ],
};

const request: SampleRequest = {
  id: 'SR-1',
  projectGroupId: 'PG-1',
  vehicle: '2026 Honda CR-V',
  product: 'Seat Cover',
  factory: 'Tianhong',
  createdAt: '2026-08-10T09:00:00-07:00',
};

const receivedItem: SampleRequestItem = {
  id: 'SRI-1',
  sampleRequestId: 'SR-1',
  vehicleProductDesignId: 'DS-1',
  vehicleProductDesignRevisionId: 'REV-1',
  sampleRound: 3,
  priority: 'NORMAL',
  sampleReceivedAt: '2026-08-25T10:00:00-07:00',
};

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: 'VS-1',
    vehicle: '2026 Honda CR-V',
    projectGroupId: 'PG-1',
    product: 'Seat Cover',
    vehicleProjectIds: ['PG-1-F'],
    dealer: 'Galpin Ford',
    date: '2026-09-15',
    time: '10:00',
    taskIds: [],
    kind: 'FITTING',
    status: 'SCHEDULED',
    ...overrides,
  };
}

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    today: TODAY,
    projects: [project],
    projectDetails: {},
    visits: [],
    sampleRequests: [request],
    sampleRequestItems: [receivedItem],
    sampleShipments: [],
    configurations: [configuration],
    registrations: [],
    appUsers: [],
    ...overrides,
  };
}

test('daysBetween counts whole days and accepts ISO datetimes', () => {
  assert.equal(daysBetween('2026-09-01', TODAY), 8);
  assert.equal(daysBetween('2026-09-01T23:59:00-07:00', TODAY), 8);
  assert.equal(daysBetween('not a date', TODAY), 0);
});

test('a received sample with no fitting booked past the limit is a warning', () => {
  const summary = summarizeDashboard(input());
  assert.equal(summary.samplesWaitingFitting.length, 1);
  assert.ok(
    summary.samplesWaitingFitting[0]!.waitingDays > SAMPLE_FITTING_WAIT_DAYS,
  );
  assert.ok(
    summary.warnings.some((warning) => warning.kind === 'SAMPLE_WAITING'),
  );
  assert.equal(summary.repeatSampleCount, 1);
});

test('a scheduled fitting clears the sample wait', () => {
  const summary = summarizeDashboard(
    input({ visits: [visit({ staffIds: ['USR-KAI'] })] }),
  );
  assert.equal(summary.samplesWaitingFitting.length, 0);
  assert.ok(
    !summary.warnings.some((warning) => warning.kind === 'SAMPLE_WAITING'),
  );
});

test('a scheduled visit without staff is flagged as unassigned', () => {
  const summary = summarizeDashboard(input({ visits: [visit({})] }));
  assert.deepEqual(
    summary.warnings.map((warning) => warning.kind),
    ['UNASSIGNED_VISIT'],
  );
});

test('a visit whose vehicle left the registry is an orphan, not merely unassigned', () => {
  const summary = summarizeDashboard(
    input({ configurations: [], visits: [visit({})] }),
  );
  assert.deepEqual(
    summary.warnings.map((warning) => warning.kind),
    ['ORPHAN_VISIT'],
  );
});

test('overdue and stalled are counted from the zone project dates', () => {
  const summary = summarizeDashboard(input());
  assert.equal(summary.overdue.length, 1);
  // Overdue zones are not double-counted as stalled.
  assert.equal(summary.stalled.length, 0);
  assert.equal(summary.highPriority.length, 1);
  assert.equal(
    summary.stageCounts.find((entry) => entry.stage === 'Fitting')?.count,
    1,
  );
});

test('a passed fitting on a Fitting-stage zone is a pending handoff approval', () => {
  const summary = summarizeDashboard(
    input({
      visits: [
        visit({ status: 'COMPLETED', result: 'PASS', staffIds: ['USR-KAI'] }),
      ],
    }),
  );
  assert.equal(summary.handoffPending.length, 1);
  assert.ok(
    summary.actions.some((action) => action.badge === 'Pending approval'),
  );
});
