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
      entityLabel: '색상',
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
  assert.match(html, /aria-label="Black 수정"/);
  assert.match(html, /aria-label="Black 삭제"/);
});

await test('empty reference results preserve the filter guidance', () => {
  const html = renderToStaticMarkup(
    createElement(ReferenceItemTable, {
      items: [],
      entityLabel: '재질',
      filterKey: '',
      onEdit: () => {
        /* Static rendering must not invoke user actions. */
      },
      onDelete: () => {
        /* Static rendering must not invoke user actions. */
      },
    }),
  );
  assert.match(html, /조건에 맞는 재질이 없습니다/);
  assert.match(html, /Product Type/);
});
