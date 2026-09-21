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
  assert.match(html, /aria-label="프로젝트 상태 필터"/);
  assert.match(html, /data-health="late" aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/<button/g) ?? []).length, 8);
  for (const label of [
    'On track',
    'Watch',
    'At risk',
    'Late',
    '정보 부족',
    '완료',
    '취소·병합',
  ])
    assert.ok(html.includes(label));
  assert.match(html, /14일 이상/);
  assert.match(html, /Zone 기준/);
});
