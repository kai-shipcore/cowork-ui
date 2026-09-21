import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScheduleAgenda } from './schedule-agenda';

await test('week/day agenda presents dates and disables booking until a queue item is selected', () => {
  for (const mode of ['week', 'day'] as const) {
    const html = renderToStaticMarkup(
      createElement(ScheduleAgenda, {
        mode,
        visits: [],
        users: [],
        scanQueue: [],
        fittingQueue: [],
        onVisit: () => {
          /* SSR has no clicks. */
        },
        onBook: () => {
          /* SSR has no clicks. */
        },
      }),
    );
    assert.equal(
      (html.match(/class="rd-day"/g) ?? []).length,
      mode === 'week' ? 7 : 1,
    );
    assert.match(html, /No pending work is currently eligible for scheduling/);
    assert.match(html, /disabled=""/);
    assert.match(html, /Pending work to schedule/);
  }
});
