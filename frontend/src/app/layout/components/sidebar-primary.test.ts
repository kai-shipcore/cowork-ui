import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MENU_SIDEBAR_MAIN, MENU_SIDEBAR_TEAM_TOOLS } from '../navigation';
import { SidebarPrimary } from './sidebar-primary';

function renderRail(
  props: ComponentProps<typeof SidebarPrimary>,
  path = '/dashboard',
): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(SidebarPrimary, props),
    ),
  );
}

await test('expanded rail keeps common shortcuts without duplicating team tools', () => {
  const html = renderRail({ collapsed: false });
  assert.match(html, /aria-label="Dashboard"/);
  assert.match(html, /aria-label="My Tasks"/);
  assert.doesNotMatch(html, /aria-label="R&amp;D Tools"/);
  assert.doesNotMatch(html, /href="\/vehicle-research"/);
});

await test('collapsed R&D rail exposes every tool and resource after a separator', () => {
  const html = renderRail({ collapsed: true });
  const groupPosition = html.indexOf('aria-label="R&amp;D Tools"');
  assert.ok(groupPosition > html.indexOf('role="separator"'));
  for (const item of MENU_SIDEBAR_MAIN.find(
    (group) => group.title === 'R&D Tools',
  )?.children ?? []) {
    assert.ok(html.includes('href="' + (item.path ?? '') + '"'));
  }
  assert.match(html, /aria-label="Resources"/);
  assert.match(html, /href="\/vehicle-options"/);
  assert.match(html, /href="\/reference-data"/);
  assert.match(html, /href="\/work\/requests\?team=rd"/);
  assert.match(html, /href="\/work\/reports\?team=rd"/);
});

await test('switching teams selects their own icons without inventing placeholder links', () => {
  for (const [title, team] of [
    ['Planning Tools', 'demand-planning'],
    ['Customer Service Tools', 'customer-services'],
    ['eCommerce Tools', 'ecommerce'],
  ]) {
    const path = '/dashboard/' + team;
    const html = renderRail(
      { collapsed: true, toolsMenuTitle: title, dashboardPath: path },
      path,
    );
    assert.ok(html.includes('aria-label="' + title + '"'));
    assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 4);
    for (const item of MENU_SIDEBAR_TEAM_TOOLS[title] ?? []) {
      const escapedTitle = item.title?.replace(/&/g, '&amp;');
      assert.ok(
        html.includes('aria-label="' + (escapedTitle ?? '') + ' · 준비 중"'),
      );
    }
    assert.doesNotMatch(
      html,
      /href="#"|href="\/vehicle-research"|aria-label="Resources"/,
    );
    assert.ok(html.includes('href="/work/requests?team=' + team + '"'));
  }
});

await test('active tool remains a real link with current-page indication on detail routes', () => {
  const html = renderRail(
    { collapsed: true },
    '/vehicle-projects?project=PG-1',
  );
  const activeLink = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
  assert.equal(activeLink.length, 1);
  assert.ok(activeLink[0].includes('href="/vehicle-projects"'));
  assert.ok(activeLink[0].includes('aria-label="Vehicle Projects"'));
  assert.match(html, /overflow-y-auto/);
});
