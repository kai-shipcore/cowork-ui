import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  isSidebarLinkActive,
  MENU_SIDEBAR_MAIN,
  MENU_SIDEBAR_TEAM_TOOLS,
} from '../navigation';
import { SidebarPrimary } from './sidebar-primary';
import { SidebarSecondary } from './sidebar-secondary';

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
  assert.match(html, /aria-label="Home"/);
  assert.match(html, /aria-label="My Tasks"/);
  assert.doesNotMatch(html, /aria-label="R&amp;D Tools"/);
  assert.doesNotMatch(html, /href="\/vehicle-research"/);
});

await test('collapsed R&D rail exposes every tool and resource after a separator', () => {
  const html = renderRail({ collapsed: true });
  const groupPosition = html.indexOf('aria-label="R&amp;D Tools"');
  assert.ok(groupPosition > html.indexOf('role="separator"'));
  assert.equal((html.match(/role="separator"/g) ?? []).length, 3);
  assert.equal((html.match(/lucide-ellipsis/g) ?? []).length, 3);
  assert.match(html, /bg-white/);
  assert.doesNotMatch(html, /data-slot="separator"/);
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
        html.includes(
          'aria-label="' + (escapedTitle ?? '') + ' · Coming soon"',
        ),
      );
    }
    assert.doesNotMatch(
      html,
      /href="#"|href="\/vehicle-research"|href="\/vehicle-options"/,
    );
    assert.match(html, /aria-label="Resources"/);
    assert.match(html, /href="https:\/\/www\.coverland\.com"/);
    assert.match(html, /href="https:\/\/www\.icarcover\.com"/);
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
  assert.ok(activeLink[0].includes('data-active="true"'));
  assert.match(html, /stroke-width="1.5"/);
  assert.match(html, /overflow-y-auto/);
});

function menuLinks(html: string): Map<string, { label: string; icon: string }> {
  const links = new Map<string, { label: string; icon: string }>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const path = /href="([^"]+)"/.exec(match[1])?.[1];
    const icon = /\blucide-[a-z0-9-]+\b/.exec(match[2])?.[0];
    if (!path || !icon) continue;
    const label =
      /aria-label="([^"]+)"/.exec(match[1])?.[1] ??
      match[2].replace(/<[^>]*>/g, '').trim();
    links.set(path, { label, icon });
  }
  return links;
}

await test('icon rail and labelled menus use identical names and icons for every shared destination in all teams', () => {
  for (const [toolsMenuTitle, path] of [
    ['R&D Tools', '/dashboard'],
    ['Planning Tools', '/dashboard/demand-planning'],
    ['Customer Service Tools', '/dashboard/customer-services'],
    ['eCommerce Tools', '/dashboard/ecommerce'],
  ]) {
    const rail = menuLinks(
      renderRail(
        { collapsed: true, toolsMenuTitle, dashboardPath: path },
        path,
      ),
    );
    const labelled = menuLinks(
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(SidebarSecondary, { toolsMenuTitle }),
        ),
      ),
    );
    assert.ok(labelled.size >= 6);
    for (const [destination, expected] of labelled) {
      assert.deepEqual(rail.get(destination), expected, destination);
    }
    assert.equal(rail.get(path)?.icon, 'lucide-house');
  }
});

await test('shared active matching respects query filters and detail routes without matching similar prefixes', () => {
  assert.equal(isSidebarLinkActive('/work/tasks', '/work/tasks?team=rd'), true);
  assert.equal(
    isSidebarLinkActive('/work/requests/REQ-1', '/work/requests?team=rd'),
    true,
  );
  assert.equal(
    isSidebarLinkActive('/vehicle-projects-old', '/vehicle-projects'),
    false,
  );
  assert.equal(isSidebarLinkActive('/dashboard', '#'), false);
});
