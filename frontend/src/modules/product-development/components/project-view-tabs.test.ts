import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ProjectViewTabs } from './project-view-tabs';

for (const [query, activeLabel] of [
  ['', '목록'],
  ['?view=list', '목록'],
  ['?view=board&team=rd', '단계별 보드'],
  ['?view=unknown', '목록'],
] as const) {
  await test(`project tabs select ${activeLabel} for ${query || 'the default URL'} and preserve both panels`, () => {
    const tree = createElement(
      MemoryRouter,
      { initialEntries: [`/vehicle-projects${query}`] },
      createElement(ProjectViewTabs, {
        list: createElement('div', { 'data-testid': 'project-grid' }, 'Grid'),
        board: createElement(
          'div',
          { 'data-testid': 'project-board' },
          'Board',
        ),
      }),
    );

    const html = renderToStaticMarkup(tree);

    assert.match(html, /role="tablist"[^>]*aria-label="프로젝트 보기"/);
    const activeTab =
      /<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/.exec(
        html,
      )?.[0];
    assert.ok(activeTab?.includes(activeLabel));
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.match(html, /data-testid="project-grid"/);
    assert.match(html, /data-testid="project-board"/);
    assert.match(
      html,
      /data-state="inactive"[^>]*data-\[state=inactive\]:hidden/,
    );
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 1);
  });
}
