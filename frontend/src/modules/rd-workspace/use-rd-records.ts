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
          '저장된 데이터를 읽지 못했습니다. 기존 기록을 덮어쓰지 않았습니다.',
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
        throw new Error('동시 저장 보호를 지원하는 브라우저가 필요합니다.');
      await navigator.locks.request(key, () => {
        writeRdRecords(window.localStorage, { key, schema, defaults, update });
        window.dispatchEvent(new Event(key));
      });
      setError('');
      return true;
    } catch {
      setError(
        '저장하지 못했습니다. 입력값 또는 브라우저 저장 공간을 확인하세요. 기존 기록은 유지됩니다.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { records, error, saving, save };
}
