import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SampleTrackingRow } from './sample-tracking';
import { SampleTrackingTable } from './sample-tracking-table';

function renderRows(rows: readonly SampleTrackingRow[]): string {
  return renderToStaticMarkup(
    createElement(SampleTrackingTable, {
      rows,
      filterKey: '',
      onOpenProject: () => {
        /* Static rendering must not invoke user actions. */
      },
      onInspect: () => {
        /* Static rendering must not invoke user actions. */
      },
      renderInspection: (row) => `Inspection ${row.id}`,
    }),
  );
}

await test('shared sample grid preserves cells, inspection actions and first-page size', () => {
  const rows: SampleTrackingRow[] = Array.from({ length: 12 }, (_, index) => ({
    id: `line-${String(index)}`,
    requestId: `request-${String(index)}`,
    projectGroupId: 'project-1',
    date: '2026-09-18',
    vehicle: '2025 Toyota RAV4',
    seatType: 'Front',
    partName: `part-${String(index)}`,
    status: 'READY',
    sampleRound: 1,
    vendor: 'Factory A',
    note: 'Handle with care',
  }));
  const html = renderRows(rows);
  assert.match(html, /Sample Part Lines/);
  assert.match(html, /Columns/);
  assert.match(html, /Inspection line-0/);
  assert.match(html, /part-9/);
  assert.doesNotMatch(html, /part-10/);
  assert.match(html, /Factory A/);
  assert.match(html, /Handle with care/);
  assert.match(html, /Receipt &amp; inspection/);
  assert.match(html, /Project/);
});

await test('empty sample rows retain the request-creation guidance', () => {
  const html = renderRows([]);
  assert.match(html, /No part lines registered/);
  assert.match(html, /sample request/);
});
