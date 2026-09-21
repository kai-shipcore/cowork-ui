import type { z } from 'zod';

/** All local records cross the same schema boundary on read. */
export function readRdRecords<T>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  schema: z.ZodType<T>,
  defaults: T,
): T {
  const raw = storage.getItem(key);
  return raw ? schema.parse(JSON.parse(raw)) : defaults;
}

/** Caller holds a Web Lock; validation happens before overwriting the latest record. */
export function writeRdRecords<T>(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  options: {
    key: string;
    schema: z.ZodType<T>;
    defaults: T;
    update: (current: T) => T;
  },
): T {
  const current = readRdRecords(
    storage,
    options.key,
    options.schema,
    options.defaults,
  );
  const next = options.schema.parse(options.update(current));
  storage.setItem(options.key, JSON.stringify(next));
  return next;
}
