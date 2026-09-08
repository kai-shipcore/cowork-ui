import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  importProjectParts,
  saveLibraryPart,
  type LibraryPart,
} from './part-library';

test('library rejects duplicate names and preserves project version snapshots', () => {
  const data = new Map<string, string>();
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
    details: { kind: 'CAR_COVER', vehicleResearchId: '', designedBy: 'user' },
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
    /동일한/,
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
  const stored = JSON.parse(
    data.get('coverland-part-library-v1')!,
  ) as LibraryPart[];
  assert.equal(stored.length, 2);
  assert.equal(
    stored.find((p) => p.name === 'Legacy')?.revisions[0].sampleApprovedAt,
    undefined,
  );
  assert.equal(stored.find((p) => p.id === part.id)?.revisions.length, 2);
});
