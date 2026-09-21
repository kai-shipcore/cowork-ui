import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceItemTable } from './reference-item-table';

await test('reference grid retains accessible edit/delete actions and column controls', () => {
  const html = renderToStaticMarkup(
    createElement(ReferenceItemTable, {
      items: [
        {
          id: 'color-black',
          code: 'BLK',
          name: 'Black',
          productTypeId: 'PT-SC',
          createdAt: '2026-09-18T12:00:00Z',
          updatedAt: '2026-09-18T12:00:00Z',
        },
      ],
      entityLabel: 'Color',
      filterKey: '',
      onEdit: () => {
        /* Static rendering must not invoke user actions. */
      },
      onDelete: () => {
        /* Static rendering must not invoke user actions. */
      },
    }),
  );
  assert.match(html, /Columns/);
  assert.match(html, /BLK/);
  assert.match(html, /2026-09-18/);
  assert.match(html, /aria-label="Black Edit"/);
  assert.match(html, /aria-label="Black Delete"/);
});

await test('empty reference results preserve the filter guidance', () => {
  const html = renderToStaticMarkup(
    createElement(ReferenceItemTable, {
      items: [],
      entityLabel: 'Material',
      filterKey: '',
      onEdit: () => {
        /* Static rendering must not invoke user actions. */
      },
      onDelete: () => {
        /* Static rendering must not invoke user actions. */
      },
    }),
  );
  assert.match(html, /No matching Material items found/);
  assert.match(html, /product type filter/);
});
