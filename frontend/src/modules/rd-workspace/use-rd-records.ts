import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { readRdRecords, writeRdRecords } from './rd-record-storage';

function readRecords<T>(key: string, schema: z.ZodType<T>, defaults: T): T {
  return readRdRecords(window.localStorage, key, schema, defaults);
}

/** Local prototype records with validated reads, cross-tab refresh and serialized writes. */
export function useRdRecords<T>(
  key: string,
  schema: z.ZodType<T>,
  defaults: T,
) {
  const [records, setRecords] = useState<T>(() => {
    try {
      return typeof window === 'undefined'
        ? defaults
        : readRecords(key, schema, defaults);
    } catch {
      return defaults;
    }
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    function reload() {
      try {
        setRecords(readRecords(key, schema, defaults));
        setError('');
      } catch {
        setError(
          'Unable to read saved data. Existing records have not been overwritten.',
        );
      }
    }
    reload();
    window.addEventListener('storage', reload);
    window.addEventListener(key, reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener(key, reload);
    };
  }, [key, schema, defaults]);
  async function save(update: (current: T) => T): Promise<boolean> {
    setSaving(true);
    try {
      if (!('locks' in navigator))
        throw new Error(
          'A browser supporting concurrent-write protection is required.',
        );
      await navigator.locks.request(key, () => {
        writeRdRecords(window.localStorage, { key, schema, defaults, update });
        window.dispatchEvent(new Event(key));
      });
      setError('');
      return true;
    } catch {
      setError(
        'Save failed. Check your input or browser storage. Existing records are preserved.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { records, error, saving, save };
}
