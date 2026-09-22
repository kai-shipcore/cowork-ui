import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TEAM_IDS, teamHome } from '@/modules/operations/operations-model';
import { HeaderToolbar } from './header-toolbar';

await test('header toolbar keeps only the theme toggle for every team', () => {
  for (const team of TEAM_IDS) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [teamHome(team)] },
        createElement(HeaderToolbar),
      ),
    );
    assert.match(html, /aria-label="Change theme"/);
    assert.doesNotMatch(html, /aria-label="Kai Chung user menu"/);
    assert.doesNotMatch(html, /href="\/work\/search/);
    assert.doesNotMatch(html, /href="\/work\/reports/);
    assert.doesNotMatch(html, /href="\/work\/notifications/);
    assert.doesNotMatch(html, /href="\/work\/requests/);
  }
});
