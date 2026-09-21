import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ReportViewTabs } from './report-view-tabs';

for (const [query, selectedLabel] of [
  ['?team=rd', '팀 간 요청 현황'],
  ['?team=rd&report=operations&q=sample', '팀 간 요청 현황'],
  ['?team=rd&report=rd', 'R&amp;D 성과'],
  ['?team=rd&report=unknown', '팀 간 요청 현황'],
] as const) {
  await test(`report tabs select ${selectedLabel} for ${query} and retain both panels`, () => {
    const tree = createElement(
      MemoryRouter,
      { initialEntries: ['/work/reports' + query] },
      createElement(ReportViewTabs, {
        operations: createElement('input', {
          'aria-label': '요청 검색',
          defaultValue: 'sample',
        }),
        performance: createElement('input', {
          'aria-label': '기준 월',
          defaultValue: '2026-09',
        }),
      }),
    );
    const html = renderToStaticMarkup(tree);
    const activeTab =
      /<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/.exec(
        html,
      )?.[0];
    assert.ok(activeTab?.includes(selectedLabel));
    assert.match(html, /role="tablist"[^>]*aria-label="리포트 종류"/);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 1);
    assert.match(html, /aria-label="요청 검색" value="sample"/);
    assert.match(html, /aria-label="기준 월" value="2026-09"/);
    assert.match(
      html,
      /data-state="inactive"[^>]*data-\[state=inactive\]:hidden/,
    );
  });
}
