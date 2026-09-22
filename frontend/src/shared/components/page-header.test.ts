import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PageHeader } from './page-header';

await test('route headings show only the title and description and preserve actions', () => {
  for (const [path, title] of [
    ['/vehicle-research', 'Vehicle Research'],
    ['/products', 'Product Catalog'],
    ['/profiles/default', 'Profile'],
    ['/work/settings?team=rd', 'Personal Settings'],
  ]) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(PageHeader, {
          description: 'Page description',
          actions: createElement('button', { type: 'button' }, 'Create'),
        }),
      ),
    );
    assert.ok(html.includes('class="workbench-heading"'));
    assert.doesNotMatch(html, /workbench-page-eyebrow/);
    assert.ok(html.includes('<h1>' + title + '</h1>'));
    assert.ok(html.includes('<p>Page description</p>'));
    assert.ok(html.includes('<button type="button">Create</button>'));
  }
});
