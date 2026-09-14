import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleRoundLabel } from './sample-request';

test('labels sample rounds with English ordinals', () => {
  assert.equal(sampleRoundLabel(1), '1st Sample');
  assert.equal(sampleRoundLabel(2), '2nd Sample');
  assert.equal(sampleRoundLabel(3), '3rd Sample');
  assert.equal(sampleRoundLabel(4), '4th Sample');
  assert.equal(sampleRoundLabel(11), '11th Sample');
  assert.equal(sampleRoundLabel(22), '22nd Sample');
});
