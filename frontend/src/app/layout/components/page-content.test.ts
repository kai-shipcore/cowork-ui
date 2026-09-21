import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { PageContent } from './page-content';
import { Toolbar } from './toolbar';

await test('all nested route content uses one centered responsive working surface', () => {
  for (const path of [
    '/dashboard',
    '/dashboard/ecommerce',
    '/vehicle-projects',
    '/work/tasks',
    '/profiles/default',
  ]) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(
            Route,
            {
              element: createElement(PageContent, {
                children: createElement(Outlet),
              }),
            },
            createElement(Route, {
              path,
              element: createElement('h1', null, path),
            }),
          ),
        ),
      ),
    );
    assert.equal((html.match(/<main\b/g) ?? []).length, 1);
    assert.match(html, /mx-auto w-full min-w-0 max-w-\[1600px\]/);
    assert.match(html, /@container\/workbench/);
    assert.match(html, /px-4 py-6 sm:px-6 lg:py-8/);
    assert.ok(html.includes('<h1>' + path + '</h1>'));
  }
});

await test('page toolbar stays inside the content flow instead of spanning the viewport', () => {
  const html = renderToStaticMarkup(
    createElement(PageContent, {
      children: createElement(Toolbar, null, 'Page heading'),
    }),
  );
  assert.match(html, /Page heading/);
  assert.doesNotMatch(html, /lg:fixed|end-0|--sidebar-width/);
});
