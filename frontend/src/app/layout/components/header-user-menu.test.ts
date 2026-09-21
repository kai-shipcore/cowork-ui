import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TEAM_IDS, teamHome } from '@/modules/operations/operations-model';
import { HeaderToolbar } from './header-toolbar';

await test('every team keeps the original accessible user avatar and existing workspace actions', () => {
  for (const team of TEAM_IDS) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [teamHome(team)] },
        createElement(HeaderToolbar),
      ),
    );
    assert.match(html, /aria-label="Kai Chung 사용자 메뉴"/);
    assert.match(html, /aria-haspopup="menu"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />KC<\/span>/);
    assert.ok(html.includes('href="/work/reports?team=' + team + '"'));
    assert.ok(html.includes('href="/work/notifications?team=' + team + '"'));
    assert.doesNotMatch(html, /aria-label="테마 변경"/);
  }
});
