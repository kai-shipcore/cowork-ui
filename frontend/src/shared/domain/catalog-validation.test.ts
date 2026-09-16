import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  businessDateInstant,
  packagingVersionErrors,
  periodErrors,
  skuVersionErrors,
} from './catalog-validation';

void test('Los Angeles dates use midnight offset including both DST transition dates', () => {
  assert.equal(businessDateInstant('2026-01-15'), '2026-01-15T08:00:00.000Z');
  assert.equal(businessDateInstant('2026-07-15'), '2026-07-15T07:00:00.000Z');
  assert.equal(businessDateInstant('2026-03-08'), '2026-03-08T08:00:00.000Z');
  assert.equal(businessDateInstant('2026-11-01'), '2026-11-01T07:00:00.000Z');
  assert.equal(businessDateInstant('2026-02-30'), undefined);
});
void test('closed historical SKUs cannot be reused and periods cannot precede current version', () => {
  assert.ok(
    skuVersionErrors(' sku ', '2026-01-01', [
      {
        id: '1',
        masterProductId: 'p',
        sku: 'SKU',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
      },
    ]).length,
  );
  assert.ok(periodErrors('2026-01-01', '2026-01-02').length);
  assert.ok(periodErrors('2099-01-01').length);
});
void test('packaging requires positive finite dimensions and weight', () => {
  for (const weight of [0, -1, NaN, Infinity])
    assert.ok(
      packagingVersionErrors(
        { length: 1, width: 1, height: 1, weight },
        '2026-01-01',
      ).length,
    );
  assert.deepEqual(
    packagingVersionErrors(
      { length: 1, width: 1, height: 1, weight: 1 },
      '2026-01-01',
    ),
    [],
  );
});
