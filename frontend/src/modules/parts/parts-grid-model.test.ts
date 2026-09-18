import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LibraryPart } from './part-library';
import { latestPartRevision, partsGridRows } from './parts-grid-model';

function part(id: string, version: number, date: string): LibraryPart {
  return {
    id,
    name: `Part-${id}`,
    product: 'Seat Cover',
    type: 'HEADREST',
    details: {
      kind: 'SEAT_COVER',
      vehicleResearchId: 'vehicle',
      seatCoverPartId: 'headrest',
      seatCoverCodeId: 'code',
      partName: 'Headrest',
      category: 'HEADREST',
      side: 'DRIVER',
      isForMiddleSeat: false,
      isCustom: true,
      designedBy: 'designer',
    },
    revisions: [
      {
        id: `${id}-revision`,
        revisionNumber: version,
        createdAt: date,
        createdBy: 'designer',
        note: 'Revision',
      },
    ],
  };
}

const PARTS: readonly LibraryPart[] = [
  part('10', 10, '2026-09-10'),
  part('2', 2, '2026-09-12'),
  part('1', 1, '2026-09-01'),
];

await test('default ordering keeps the latest updated part first without changing store data', () => {
  const before = structuredClone(PARTS);
  const result = partsGridRows(PARTS, '', null);
  assert.deepEqual(
    result.map((row) => row.id),
    ['2', '10', '1'],
  );
  assert.deepEqual(PARTS, before);
});

await test('search matches part names and types ignoring case and surrounding spaces', () => {
  assert.deepEqual(
    partsGridRows(PARTS, ' part-10 ', null).map((row) => row.id),
    ['10'],
  );
  assert.equal(partsGridRows(PARTS, 'headrest', null).length, 3);
  assert.deepEqual(partsGridRows(PARTS, 'missing', null), []);
});

await test('sorts all matching records before a page is sliced and handles numeric names', () => {
  const ascending = partsGridRows(PARTS, '', { id: 'name', direction: 'asc' });
  assert.deepEqual(
    ascending.slice(0, 2).map((row) => row.id),
    ['1', '2'],
  );
  assert.deepEqual(
    ascending.slice(2, 4).map((row) => row.id),
    ['10'],
  );
  assert.deepEqual(
    partsGridRows(PARTS, '', { id: 'name', direction: 'desc' }).map(
      (row) => row.id,
    ),
    ['10', '2', '1'],
  );
});

await test('revision numbers sort numerically and clearing sort restores latest update order', () => {
  assert.deepEqual(
    partsGridRows(PARTS, '', { id: 'version', direction: 'asc' }).map(
      (row) => row.id,
    ),
    ['1', '2', '10'],
  );
  assert.deepEqual(
    partsGridRows(PARTS, '', { id: 'updated', direction: 'asc' }).map(
      (row) => row.id,
    ),
    ['1', '10', '2'],
  );
  assert.deepEqual(
    partsGridRows(PARTS, '', null).map((row) => row.id),
    ['2', '10', '1'],
  );
});

await test('parts without revisions use the visible version fallback and missing dates sort last', () => {
  const empty: LibraryPart = { ...part('empty', 1, ''), revisions: [] };
  assert.equal(latestPartRevision(empty), undefined);
  for (const direction of ['asc', 'desc'] as const) {
    const result = partsGridRows([empty, ...PARTS], '', {
      id: 'updated',
      direction,
    });
    assert.equal(result[result.length - 1]?.id, 'empty');
  }
  assert.deepEqual(partsGridRows([], '', null), []);
});
