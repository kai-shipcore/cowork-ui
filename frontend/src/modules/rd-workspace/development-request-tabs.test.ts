import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ComplaintImportGrid } from './complaint-import-grid';
import { DevelopmentRequestGrid } from './development-request-grid';
import { DevelopmentRequestTabs } from './development-request-tabs';
import type { DevelopmentIntake } from './intake-model';

const REQUEST: DevelopmentIntake = {
  id: 'intake-C-1',
  vehicle: '2026 Toyota Camry',
  configurationId: '',
  product: 'Seat Cover',
  source: 'Complaint',
  sourceReference: 'C-1',
  notifyCount: 0,
  complaintCount: 1,
  b2bUnits: 0,
  releaseDate: '',
  evidence: 'Fitting changes needed',
  priority: 'NORMAL',
  status: 'Awaiting review',
  reviews: [],
  createdAt: '',
};

for (const [query, label] of [
  ['', 'Development Requests'],
  ['?view=requests&q=Camry&status=All', 'Development Requests'],
  ['?view=complaints', 'Import Complaints'],
  ['?view=unknown', 'Development Requests'],
] as const) {
  await test(`request tabs select ${label} for ${query} and retain draft panels`, () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/development-requests' + query] },
        createElement(DevelopmentRequestTabs, {
          requests: createElement('input', {
            'aria-label': 'Registration draft',
            defaultValue: 'Camry',
          }),
          complaints: createElement('div', null, 'Complaint grid'),
        }),
      ),
    );
    const activeTab =
      /<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/.exec(
        html,
      )?.[0];
    assert.ok(activeTab?.includes(label));
    assert.match(
      html,
      /role="tablist"[^>]*aria-label="Development request view"/,
    );
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 1);
    assert.match(html, /aria-label="Registration draft" value="Camry"/);
    assert.match(html, /Complaint grid/);
    assert.match(
      html,
      /data-state="inactive"[^>]*data-\[state=inactive\]:hidden/,
    );
  });
}

await test('complaint grid previews pending and imported rows without triggering imports', () => {
  let calls = 0;
  const html = renderToStaticMarkup(
    createElement(ComplaintImportGrid, {
      rows: [REQUEST, { ...REQUEST, id: 'intake-C-2', sourceReference: 'C-2' }],
      records: [REQUEST],
      saving: false,
      onImport: () => {
        calls += 1;
      },
    }),
  );
  assert.equal(calls, 0);
  assert.match(html, /Import 1 new item/);
  assert.match(html, /Imported/);
  assert.match(html, /Pending import/);
  assert.match(html, /Fitting changes needed/);
});

for (const [rows, records, saving] of [
  [[], [], false],
  [[REQUEST], [REQUEST], false],
  [[REQUEST], [], true],
] as const) {
  await test(`import action is disabled with ${String(rows.length)} rows, ${String(records.length)} imported, saving=${String(saving)}`, () => {
    const html = renderToStaticMarkup(
      createElement(ComplaintImportGrid, {
        rows,
        records,
        saving,
        onImport: () => {
          assert.fail('render must not import');
        },
      }),
    );
    assert.match(
      html,
      /<button[^>]*disabled=""[^>]*>[\s\S]*?(?:Import|Importing)/,
    );
    if (!rows.length)
      assert.match(html, /No eligible open complaints to import/);
  });
}

await test('request grid retains demand evidence, review, filters and empty state', () => {
  const props = {
    rows: [REQUEST],
    projects: [],
    configurations: [],
    query: 'Camry',
    status: 'All',
    onFilter: () => {
      assert.fail('render must not change filters');
    },
    actions: createElement('button', null, 'New development request'),
  };
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(DevelopmentRequestGrid, props),
    ),
  );
  assert.match(html, /2026 Toyota Camry/);
  assert.match(html, /Notify 0 \/ Complaints 1 \/ B2B 0/);
  assert.match(html, /Evidence \/ Review/);
  assert.match(html, /aria-label="Search development requests"/);
  assert.match(html, /New development request/);
  const empty = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(DevelopmentRequestGrid, { ...props, rows: [] }),
    ),
  );
  assert.match(empty, /No matching requests/);
});
