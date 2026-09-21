import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { readRdRecords, writeRdRecords } from './rd-record-storage';

await test('record writes use latest saved data and survive reload', () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (key: string, value: string) => {
      void key;
      raw = value;
    },
  };
  const schema = z.array(z.number());
  const options = {
    key: 'demo',
    schema,
    defaults: [],
    update: (current: number[]) => [...current, 1],
  };
  writeRdRecords(storage, options);
  writeRdRecords(storage, options);
  assert.deepEqual(readRdRecords(storage, 'demo', schema, []), [1, 1]);
});
await test('corrupt records and invalid updates never replace the previous data', () => {
  let raw = 'corrupt';
  const storage = {
    getItem: () => raw,
    setItem: (key: string, value: string) => {
      void key;
      raw = value;
    },
  };
  const options = {
    key: 'demo',
    schema: z.array(z.number().positive()),
    defaults: [],
    update: () => [-1],
  };
  assert.throws(() => writeRdRecords(storage, options));
  assert.equal(raw, 'corrupt');
  raw = '[1]';
  assert.throws(() => writeRdRecords(storage, options));
  assert.equal(raw, '[1]');
});
await test('quota failures propagate instead of reporting successful persistence', () => {
  assert.throws(() =>
    writeRdRecords(
      {
        getItem: () => '[1]',
        setItem: () => {
          throw new Error('Quota');
        },
      },
      {
        key: 'demo',
        schema: z.array(z.number()),
        defaults: [],
        update: () => [2],
      },
    ),
  );
});
