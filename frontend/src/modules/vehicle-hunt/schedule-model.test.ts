import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleDays, shiftDate } from './schedule-model';

await test('week view begins Monday and spans month and year boundaries', () => {
  assert.deepEqual(scheduleDays('2027-01-01', 'week'), [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ]);
  assert.deepEqual(scheduleDays('2026-09-21', 'day'), ['2026-09-21']);
});
await test('day navigation handles leap years and DST without skipping days', () => {
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
});
