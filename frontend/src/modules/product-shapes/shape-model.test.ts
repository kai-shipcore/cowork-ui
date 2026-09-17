import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ProjectDesign,
  ProjectDetailSnapshot,
  ProjectVisit,
  VehicleProductShape,
  VehicleProjectGroup,
  ZoneProject,
} from '@/shared/types/workbench';
import { getSampleGate } from '@/modules/product-development/sample-gate';
import {
  applyShapeReview,
  collectShapes,
  compositionIsCurrent,
  handoffReady,
  hasCurrentFitmentQuality,
  isSizeReviewCurrent,
  latestFittingPassed,
  removeLegacyAdoption,
  shapeErrors,
  shapeUsage,
  sizeReady,
  sizeReviewBlockers,
  sizeReviewEvidence,
} from './shape-model';

const shape: VehicleProductShape = {
  id: 'S1',
  productTypeId: 'PT-CC',
  name: 'CN-M',
  status: 'ACTIVE',
  dimensions: { length: 450, height: 150, unit: 'CM' },
  source: 'NEW',
  createdBy: 'U1',
  createdAt: '2026-09-01',
};
const zone: ZoneProject = {
  id: 'Z1',
  projectGroupId: 'P1',
  productTypeId: 'PT-CC',
  vehicleResearchId: 'V1',
  zoneId: 'EX',
  code: 'EX',
  label: 'Exterior',
  managerId: 'U1',
  currentStage: 'Fitting',
  scanned: true,
};
const part: ProjectDesign = {
  id: 'D1',
  productTypeId: 'PT-CC',
  vehicleProjectId: 'Z1',
  name: 'Cover',
  quantity: 1,
  status: 'ACTIVE',
  fittingConfirmed: true,
  details: { kind: 'CAR_COVER', vehicleResearchId: 'V1', designedBy: 'U1' },
  revisions: [
    {
      id: 'R1',
      revisionNumber: 1,
      createdAt: '2026-09-01',
      createdBy: 'U1',
      note: 'Initial',
    },
  ],
};
const visit: ProjectVisit = {
  id: 'V1',
  type: 'FITTING',
  status: 'COMPLETED',
  result: 'PASS',
  vehicleProjectIds: ['Z1'],
  dealer: 'Dealer',
  date: '2026-09-02',
  time: '10:00',
  staffIds: ['U1'],
};
const reviewed: ZoneProject = {
  ...zone,
  currentStage: 'Approved',
  productionHandoff: {
    completedAt: '2026-09-03',
    completedBy: 'U1',
    reference: 'handoff package',
    evidenceKey: sizeReviewEvidence(zone.id, [part], [visit]),
  },
  sizeReview: {
    outcome: 'APPROVED',
    approvalMethod: 'VERBAL',
    meetingAt: '2026-09-03T10:00',
    participants: ['PM', 'Designer', 'Scan', 'Coordinator', 'Manual'],
    reviewedBy: 'U1',
    reviewedAt: '2026-09-03',
    blueprintReference: 'final-blueprint.pdf',
    note: '',
    evidenceKey: sizeReviewEvidence(zone.id, [part], [visit]),
  },
};

test('a final Size requires this project review and a master link', () => {
  assert.equal(
    sizeReady(
      { ...zone, productShape: shape, productShapeId: shape.id },
      [part],
      [visit],
    ),
    false,
  );
  assert.equal(isSizeReviewCurrent(reviewed, [part], [visit]), true);
  assert.equal(
    isSizeReviewCurrent(
      {
        ...reviewed,
        sizeReview: { ...reviewed.sizeReview!, outcome: 'REJECTED' },
      },
      [part],
      [visit],
    ),
    false,
  );
  assert.equal(sizeReady(reviewed, [part], [visit]), false);
  assert.equal(
    sizeReady(
      { ...reviewed, productShapeId: shape.id, productShape: shape },
      [part],
      [visit],
    ),
    true,
  );
  assert.equal(
    sizeReady(
      {
        ...reviewed,
        productShapeId: shape.id,
        productShape: { ...shape, status: 'RETIRED' },
      },
      [part],
      [visit],
    ),
    false,
  );
});

const reviewedDetail: ProjectDetailSnapshot = {
  stage: 'Approved',
  zones: [reviewed],
  designs: [part],
  visits: [visit],
  tasks: [],
  samples: [],
  assets: [],
  activity: [],
};

test('Shape review starts after fitting without requiring an earlier handoff', () => {
  assert.equal(zone.productShapeId, undefined);
  assert.equal(handoffReady(zone, [part], [visit]), true);
  assert.equal(sizeReviewBlockers(zone, [part], [visit]).length, 0);
  assert.equal(
    sizeReviewBlockers(
      { ...reviewed, productionHandoff: undefined },
      [part],
      [visit],
    ).length,
    0,
  );
  assert.deepEqual(sizeReviewBlockers(reviewed, [part], [visit]), []);
});

test('handoff does not require a Shape but still requires current successful fitting', () => {
  const unissued = { ...zone, productShapeId: undefined, sizeReview: undefined };
  assert.equal(handoffReady(unissued, [part], [visit]), true);
  assert.equal(handoffReady(unissued, [part], []), false);
  assert.equal(handoffReady(unissued, [part], [{ ...visit, result: 'FAIL' }]), false);
  assert.equal(handoffReady(unissued, [{ ...part, fittingConfirmed: false }], [visit]), false);
  assert.equal(handoffReady(unissued, [{ ...part, revisions: [{ ...part.revisions[0], createdAt: '2026-09-04' }] }], [visit]), false);
});

test('document rejection keeps development complete, evidence and original project link', () => {
  const linked = {
    ...reviewedDetail,
    zones: [{ ...reviewed, productShapeId: shape.id }],
  };
  const next = applyShapeReview(linked, zone.id, {
    ...reviewed.sizeReview!,
    outcome: 'REJECTED',
    rejectionType: 'DOCUMENT',
    note: 'Fix document',
    reviewedAt: '2026-09-04',
  });
  assert.equal(next.zones[0].currentStage, 'Approved');
  assert.equal(next.zones[0].productShapeId, shape.id);
  assert.deepEqual(next.designs, linked.designs);
  assert.equal(next.zones[0].shapeReviewHistory?.length, 2);
  assert.equal(
    isSizeReviewCurrent(next.zones[0], next.designs, next.visits),
    false,
  );
  const approved = applyShapeReview(next, zone.id, {
    ...reviewed.sizeReview!,
    reviewedAt: '2026-09-05',
    blueprintReference: 'corrected.pdf',
  });
  assert.equal(
    isSizeReviewCurrent(approved.zones[0], approved.designs, approved.visits),
    true,
  );
});

test('pattern rejection returns the original project to Sample and requires a new revision, sample, fitting and handoff', () => {
  const rejected = applyShapeReview(reviewedDetail, zone.id, {
    ...reviewed.sizeReview!,
    outcome: 'REJECTED',
    rejectionType: 'PATTERN',
    affectedDesignIds: [part.id],
    note: 'Wrinkles',
    reviewedAt: '2026-09-04',
  });
  assert.equal(rejected.zones[0].currentStage, 'Sample');
  assert.equal(rejected.designs[0].requiresRevisionAfterReview, true);
  assert.equal(
    getSampleGate('Car Cover', rejected.zones, rejected.designs, []).ready,
    false,
  );
  assert.equal(
    handoffReady(rejected.zones[0], rejected.designs, [visit]),
    false,
  );
  const newPart: ProjectDesign = {
    ...rejected.designs[0],
    requiresRevisionAfterReview: false,
    fittingConfirmed: true,
    revisions: [
      ...part.revisions,
      {
        ...part.revisions[0],
        id: 'R2',
        revisionNumber: 2,
        createdAt: '2026-09-05',
        sampleApprovedAt: '2026-09-06',
      },
    ],
  };
  assert.equal(
    getSampleGate('Car Cover', rejected.zones, [newPart], []).ready,
    false,
  );
  assert.equal(
    getSampleGate(
      'Car Cover',
      rejected.zones,
      [newPart],
      [
        {
          id: 'I2',
          sampleRequestId: 'S2',
          vehicleProductDesignId: part.id,
          vehicleProductDesignRevisionId: 'R2',
          sampleRound: 2,
          priority: 'NORMAL',
          sampleReceivedAt: '2026-09-06',
          drawingMatch: true,
          revisionReflected: 'CORRECT',
          inspectedAt: '2026-09-06T12:00:00Z',
          inspectedBy: 'U1',
        },
      ],
    ).ready,
    true,
  );
  const refitZone = { ...rejected.zones[0], currentStage: 'Fitting' as const };
  assert.equal(handoffReady(refitZone, [newPart], [visit]), false);
  const refit = { ...visit, id: 'V2', date: '2026-09-07' };
  assert.equal(handoffReady(refitZone, [newPart], [visit, refit]), true);
  assert.equal(
    isSizeReviewCurrent(
      { ...refitZone, currentStage: 'Approved' },
      [newPart],
      [visit, refit],
    ),
    false,
  );
});

test('a verbal review needs its meeting participants and a current handoff', () => {
  assert.equal(
    isSizeReviewCurrent(
      {
        ...reviewed,
        sizeReview: { ...reviewed.sizeReview!, participants: [] },
      },
      [part],
      [visit],
    ),
    false,
  );
  assert.equal(
    isSizeReviewCurrent(
      {
        ...reviewed,
        sizeReview: { ...reviewed.sizeReview!, approvalMethod: undefined },
      },
      [part],
      [visit],
    ),
    false,
  );
  assert.equal(
    isSizeReviewCurrent(reviewed, [{ ...part, quantity: 2 }], [visit]),
    false,
  );
});

test('is complete only for all approved parts and a Blueprint linked to the issued Shape', () => {
  const linkedDetail = {
    ...reviewedDetail,
    zones: [{ ...reviewed, productShapeId: shape.id }],
  };
  const complete: VehicleProductShape = {
    ...shape,
    composition: {
      sourceProjectId: 'P1',
      sourceZoneId: zone.id,
      parts: [
        {
          designId: part.id,
          name: part.name,
          quantity: part.quantity,
          revisionId: 'R1',
          revisionNumber: 1,
        },
      ],
      blueprintUrl: 'https://example.com/blueprint.png',
      status: 'COMPLETE',
      updatedAt: '2026-09-04',
      updatedBy: 'Designer',
    },
  };
  assert.equal(compositionIsCurrent(complete, { P1: linkedDetail }), true);
  assert.equal(
    compositionIsCurrent(
      { ...complete, composition: { ...complete.composition!, parts: [] } },
      { P1: linkedDetail },
    ),
    false,
  );
  assert.equal(
    compositionIsCurrent(
      {
        ...complete,
        composition: { ...complete.composition!, status: 'DRAFT' },
      },
      { P1: linkedDetail },
    ),
    false,
  );
  assert.equal(
    compositionIsCurrent(complete, {
      P1: { ...linkedDetail, designs: [{ ...part, quantity: 2 }] },
    }),
    false,
  );
});

test('early stages, no parts and no successful fitting cannot reach review', () => {
  for (const stage of ['3D Model', 'Fit Review', 'Design', 'Sample'] as const)
    assert.ok(
      sizeReviewBlockers({ ...zone, currentStage: stage }, [part], [visit])
        .length,
    );
  assert.ok(sizeReviewBlockers(zone, [], [visit]).length);
  assert.ok(sizeReviewBlockers(zone, [part], []).length);
  assert.ok(
    sizeReviewBlockers(zone, [{ ...part, fittingConfirmed: false }], [visit])
      .length,
  );
});

test('latest fitting failure overrides previous PASS regardless of input order; other zones cannot pass', () => {
  const failed = {
    ...visit,
    id: 'V2',
    date: '2026-09-04',
    result: 'FAIL' as const,
  };
  assert.equal(latestFittingPassed('Z1', [failed, visit]), false);
  assert.equal(latestFittingPassed('Z2', [visit]), false);
  assert.equal(
    latestFittingPassed('Z1', [{ ...visit, result: undefined }]),
    false,
  );
  assert.equal(isSizeReviewCurrent(reviewed, [part], [visit, failed]), false);
});

test('part revision, quantities and new fitting records invalidate review', () => {
  assert.ok(
    sizeReviewBlockers(
      zone,
      [
        {
          ...part,
          revisions: [{ ...part.revisions[0], createdAt: '2026-09-05' }],
        },
      ],
      [visit],
    ).length,
  );
  assert.equal(
    isSizeReviewCurrent(reviewed, [{ ...part, quantity: 2 }], [visit]),
    false,
  );
  assert.equal(
    isSizeReviewCurrent(
      reviewed,
      [
        {
          ...part,
          revisions: [
            ...part.revisions,
            { ...part.revisions[0], id: 'R2', revisionNumber: 2 },
          ],
        },
      ],
      [visit],
    ),
    false,
  );
  assert.equal(
    isSizeReviewCurrent(
      reviewed,
      [part],
      [visit, { ...visit, id: 'V2', date: '2026-09-05' }],
    ),
    false,
  );
});

test('Size uniqueness is product scoped; all dimension values must be positive finite numbers', () => {
  assert.equal(shapeErrors({ ...shape, name: ' cn-m ' }, [shape]).length, 1);
  assert.equal(
    shapeErrors({ ...shape, name: ' cn-m ' }, [shape], shape.id).length,
    0,
  );
  assert.equal(
    shapeErrors({ ...shape, productTypeId: 'PT-SC', dimensions: undefined }, [
      shape,
    ]).length,
    0,
  );
  assert.ok(
    shapeErrors(
      { ...shape, dimensions: { length: NaN, height: 10, unit: 'CM' } },
      [],
      shape.id,
    ).length,
  );
  assert.ok(
    shapeErrors(
      {
        ...shape,
        dimensions: { length: 10, height: 10, frontWidth: -1, unit: 'IN' },
      },
      [],
      shape.id,
    ).length,
  );
});

test('overall quality needs all current part observations and becomes stale after a newer part result', () => {
  const base = {
    id: 'q',
    vehicleResearchId: 'V1',
    vehicleProjectId: zone.id,
    quality: 'PASS' as const,
    source: 'REVIEW' as const,
    note: 'observed',
    evidenceKey: sizeReviewEvidence(zone.id, [part], [visit]),
    createdAt: '2026-09-03',
  };
  const observations = [
    { ...base, vehicleProductDesignId: part.id },
    { ...base, id: 'overall' },
  ];
  assert.equal(
    hasCurrentFitmentQuality(zone.id, [part], [visit], observations),
    true,
  );
  assert.equal(
    hasCurrentFitmentQuality(zone.id, [part], [visit], [base]),
    false,
  );
  assert.equal(
    hasCurrentFitmentQuality(
      zone.id,
      [part],
      [visit],
      [
        ...observations,
        {
          ...base,
          id: 'failed',
          vehicleProductDesignId: part.id,
          quality: 'FAIL',
        },
      ],
    ),
    false,
  );
  assert.equal(
    hasCurrentFitmentQuality(
      zone.id,
      [{ ...part, quantity: 2 }],
      [visit],
      observations,
    ),
    false,
  );
});

test('master edits survive reload and legacy fitting activation does not fabricate Size approval', () => {
  const detail: ProjectDetailSnapshot = {
    stage: 'Fitting',
    zones: [{ ...zone, productShape: { ...shape, name: 'Old name' } }],
    designs: [part],
    visits: [visit],
    samples: [],
    assets: [],
    activity: [],
    tasks: [],
  };
  assert.equal(
    collectShapes([shape], [], { P1: detail }, true)[0].name,
    shape.name,
  );
  assert.equal(
    collectShapes([], [], { P1: detail }, true)[0].status,
    'IN_DEVELOPMENT',
  );
  assert.equal(
    collectShapes([shape], [], { P1: detail }, false)[0].name,
    shape.name,
  );
});

test('shared Size usage spans projects and removed adoption never becomes a merge reference', () => {
  const project: VehicleProjectGroup = {
    id: 'P1',
    productTypeId: 'PT-CC',
    product: 'Car Cover',
    vehicle: 'Car',
    vehicleResearchId: 'V1',
    zoneProjects: [{ ...zone, productShapeId: shape.id }],
    options: [],
    stage: 'Fitting',
    status: 'IN PROGRESS',
    created: '2026-09-01',
  };
  assert.equal(
    shapeUsage(shape.id, [project, { ...project, id: 'P2' }]).length,
    2,
  );
  assert.deepEqual(
    removeLegacyAdoption({
      productShapeId: 'S1',
      adoptedProjectId: 'S1',
      mergedIntoProjectId: 'P9',
    }),
    { productShapeId: 'S1', mergedIntoProjectId: 'P9' },
  );
});
