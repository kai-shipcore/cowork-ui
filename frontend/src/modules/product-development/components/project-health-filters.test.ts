import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectHealthFilters } from './project-health-filters';

await test('health legend exposes counted keyboard-accessible filters and the actual classification rules', () => {
  const html = renderToStaticMarkup(
    createElement(ProjectHealthFilters, {
      value: 'late',
      counts: {
        all: 5,
        'on-track': 1,
        watch: 1,
        'at-risk': 1,
        late: 2,
        unknown: 0,
        complete: 0,
        inactive: 0,
      },
      onChange: () => {
        /* SSR has no interactions. */
      },
    }),
  );
  assert.match(html, /aria-label="Project health filters"/);
  assert.match(html, /data-health="late" aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/<button/g) ?? []).length, 8);
  for (const label of [
    'On track',
    'Watch',
    'At risk',
    'Late',
    'Insufficient data',
    'Completed',
    'Cancelled / Merged',
  ])
    assert.ok(html.includes(label));
  assert.match(html, /at least 14 days/);
  assert.match(html, /By zone/);
});
