import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ReportViewTabs } from './report-view-tabs';

for (const [query, selectedLabel] of [
  ['?team=rd', 'Team Request Overview'],
  ['?team=rd&report=operations&q=sample', 'Team Request Overview'],
  ['?team=rd&report=rd', 'R&amp;D Performance'],
  ['?team=rd&report=unknown', 'Team Request Overview'],
] as const) {
  await test(`report tabs select ${selectedLabel} for ${query} and retain both panels`, () => {
    const tree = createElement(
      MemoryRouter,
      { initialEntries: ['/work/reports' + query] },
      createElement(ReportViewTabs, {
        operations: createElement('input', {
          'aria-label': 'Request search',
          defaultValue: 'sample',
        }),
        performance: createElement('input', {
          'aria-label': 'Reference month',
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
    assert.match(html, /role="tablist"[^>]*aria-label="Report type"/);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 1);
    assert.match(html, /aria-label="Request search" value="sample"/);
    assert.match(html, /aria-label="Reference month" value="2026-09"/);
    assert.match(
      html,
      /data-state="inactive"[^>]*data-\[state=inactive\]:hidden/,
    );
  });
}
