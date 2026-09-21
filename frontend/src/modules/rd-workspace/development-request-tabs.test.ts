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
  source: '컴플레인',
  sourceReference: 'C-1',
  notifyCount: 0,
  complaintCount: 1,
  b2bUnits: 0,
  releaseDate: '',
  evidence: '피팅 수정 필요',
  priority: 'NORMAL',
  status: '검토 대기',
  reviews: [],
  createdAt: '',
};

for (const [query, label] of [
  ['', '개발 요청 등록'],
  ['?view=requests&q=Camry&status=전체', '개발 요청 등록'],
  ['?view=complaints', '컴플레인 가져오기'],
  ['?view=unknown', '개발 요청 등록'],
] as const) {
  await test(`request tabs select ${label} for ${query} and retain draft panels`, () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/development-requests' + query] },
        createElement(DevelopmentRequestTabs, {
          requests: createElement('input', {
            'aria-label': '등록 초안',
            defaultValue: 'Camry',
          }),
          complaints: createElement('div', null, '컴플레인 그리드'),
        }),
      ),
    );
    const activeTab =
      /<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/.exec(
        html,
      )?.[0];
    assert.ok(activeTab?.includes(label));
    assert.match(html, /role="tablist"[^>]*aria-label="개발 요청 보기"/);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 1);
    assert.match(html, /aria-label="등록 초안" value="Camry"/);
    assert.match(html, /컴플레인 그리드/);
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
  assert.match(html, /미등록 1건 가져오기/);
  assert.match(html, /가져오기 완료/);
  assert.match(html, /가져오기 대기/);
  assert.match(html, /피팅 수정 필요/);
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
      /<button[^>]*disabled=""[^>]*>[\s\S]*?(?:가져오기|가져오는 중)/,
    );
    if (!rows.length)
      assert.match(html, /가져올 수 있는 미종결 컴플레인이 없습니다/);
  });
}

await test('request grid retains demand evidence, review, filters and empty state', () => {
  const props = {
    rows: [REQUEST],
    projects: [],
    configurations: [],
    query: 'Camry',
    status: '전체',
    onFilter: () => {
      assert.fail('render must not change filters');
    },
    actions: createElement('button', null, '새 개발 요청'),
  };
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(DevelopmentRequestGrid, props),
    ),
  );
  assert.match(html, /2026 Toyota Camry/);
  assert.match(html, /Notify 0 \/ 불만 1 \/ B2B 0/);
  assert.match(html, /근거 · 검토/);
  assert.match(html, /aria-label="개발 요청 검색"/);
  assert.match(html, /새 개발 요청/);
  const empty = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(DevelopmentRequestGrid, { ...props, rows: [] }),
    ),
  );
  assert.match(empty, /조건에 맞는 요청이 없습니다/);
});
