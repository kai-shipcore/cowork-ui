import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  importProjectParts,
  saveLibraryPart,
  type LibraryPart,
} from './part-library';

test('library rejects duplicate names and syncs project revision history', () => {
  const data = new Map<string, string>();
  data.set('coverland-part-library-v1', '[]');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: new EventTarget(),
  });
  const part: LibraryPart = {
    id: 'part-1',
    name: 'FH-AC-MX-W-D',
    product: 'Seat Cover',
    type: 'HEADREST',
    details: {
      kind: 'SEAT_COVER',
      vehicleResearchId: '',
      seatCoverPartId: 'PART-FRONT-HEADREST',
      seatCoverCodeId: 'CODE-W',
      partName: 'Front Headrest',
      category: 'HEADREST',
      side: 'DRIVER',
      isForMiddleSeat: false,
      isCustom: true,
      designedBy: 'user',
    },
    revisions: [
      {
        id: 'v1',
        revisionNumber: 1,
        note: 'Initial',
        createdBy: 'user',
        createdAt: '2026-09-08',
      },
    ],
  };
  saveLibraryPart(part);
  assert.throws(
    () =>
      saveLibraryPart({ ...part, id: 'part-2', name: part.name.toLowerCase() }),
    /already exists/,
  );
  const pinned = structuredClone(part.revisions[0]);
  saveLibraryPart({
    ...part,
    revisions: [...part.revisions, { ...pinned, id: 'v2', revisionNumber: 2 }],
  });
  assert.equal(pinned.revisionNumber, 1);
  importProjectParts(
    [
      {
        id: 'design',
        name: 'Legacy',
        productTypeId: 'SC',
        vehicleProjectId: 'zone',
        status: 'ACTIVE',
        quantity: 1,
        fittingConfirmed: true,
        details: part.details,
        revisions: [
          {
            ...pinned,
            sampleApprovedAt: '2026-09-08',
            sampleApprovedBy: 'user',
          },
        ],
      },
    ],
    'Car Cover',
  );
  // Only Seat Cover designs are parts; a Car Cover design must not be mirrored.
  importProjectParts(
    [
      {
        id: 'cover',
        name: 'Exterior',
        productTypeId: 'CC',
        vehicleProjectId: 'zone',
        status: 'ACTIVE',
        quantity: 1,
        fittingConfirmed: true,
        details: {
          kind: 'CAR_COVER',
          vehicleResearchId: '',
          designedBy: 'user',
        },
        revisions: [pinned],
      },
    ],
    'Car Cover',
  );
  const stored = JSON.parse(
    data.get('coverland-part-library-v1')!,
  ) as LibraryPart[];
  assert.equal(stored.length, 2);
  assert.equal(
    stored.some((p) => p.name === 'Exterior'),
    false,
  );
  assert.equal(
    stored.find((p) => p.name === 'Legacy')?.revisions[0].sampleApprovedAt,
    '2026-09-08',
  );
  assert.equal(stored.find((p) => p.id === part.id)?.revisions.length, 2);
});
