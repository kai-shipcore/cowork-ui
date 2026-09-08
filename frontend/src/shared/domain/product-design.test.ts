import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectDesign, ProjectDesignDetails } from '../types/workbench';
import { hasDesignIdentity } from './product-design';

function design(details: ProjectDesignDetails): ProjectDesign {
  return {
    id: 'design',
    productTypeId: 'product',
    vehicleProjectId: 'project-a',
    name: 'Original',
    status: 'INACTIVE',
    quantity: 1,
    details,
    revisions: [],
    fittingConfirmed: false,
  };
}

test('car cover research cannot gain a second pattern, even if renamed or inactive', () => {
  const details: ProjectDesignDetails = {
    kind: 'CAR_COVER',
    vehicleResearchId: 'research-a',
    designedBy: 'user',
  };
  const existing = [design(details)];
  assert.equal(
    hasDesignIdentity(existing, { ...details, designedBy: 'other' }),
    true,
  );
  assert.equal(
    hasDesignIdentity(existing, {
      ...details,
      vehicleResearchId: 'research-b',
    }),
    false,
  );
});

test('floor mat permits another zone or research, but not another mold for the same pair', () => {
  const details: ProjectDesignDetails = {
    kind: 'FLOOR_MAT',
    vehicleResearchId: 'research-a',
    vehicleZoneId: 'front',
  };
  const existing = [design(details)];
  assert.equal(hasDesignIdentity(existing, { ...details }), true);
  assert.equal(
    hasDesignIdentity(existing, { ...details, vehicleZoneId: 'rear' }),
    false,
  );
  assert.equal(
    hasDesignIdentity(existing, {
      ...details,
      vehicleResearchId: 'research-b',
    }),
    false,
  );
  assert.equal(
    hasDesignIdentity(existing, {
      kind: 'CAR_COVER',
      vehicleResearchId: 'research-a',
      designedBy: 'user',
    }),
    false,
  );
});

test('seat cover continues to allow multiple component patterns', () => {
  const details: ProjectDesignDetails = {
    kind: 'SEAT_COVER',
    vehicleResearchId: 'research-a',
    seatCoverPartId: 'headrest',
    seatCoverCodeId: 'code',
    partName: 'FH',
    category: 'HEADREST',
    side: 'DRIVER',
    isForMiddleSeat: false,
    isCustom: true,
    designedBy: 'user',
  };
  assert.equal(hasDesignIdentity([design(details)], details), false);
});
