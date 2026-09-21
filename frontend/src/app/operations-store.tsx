import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import {
  applyRequestAction,
  createRequest,
  PEOPLE,
  snapshotSchema,
  type OperationsSnapshot,
  type Person,
  type RequestAction,
  type RequestDraft,
} from '@/modules/operations/operations-model';
import { createOperationsSeed } from '@/modules/operations/operations-seed';

const STORAGE_KEY = 'coverland-operations-v1';
const BACKUP_KEY = 'coverland-operations-previous-v1';
interface OperationsContextValue {
  snapshot: OperationsSnapshot;
  actor: Person;
  changeActor: (id: string) => void;
  message: string;
  error: string;
  saving: boolean;
  add: (draft: RequestDraft) => Promise<string | undefined>;
  act: (
    id: string,
    revision: number,
    action: RequestAction,
  ) => Promise<boolean>;
  reload: () => void;
  restore: (snapshot: unknown) => Promise<boolean>;
  previousBackup: () => string | null;
}
const OperationsContext = createContext<OperationsContextValue | null>(null);

function loadSnapshot(): OperationsSnapshot {
  const serialized = localStorage.getItem(STORAGE_KEY);
  return serialized
    ? snapshotSchema.parse(JSON.parse(serialized))
    : createOperationsSeed();
}

/** Prototype-only persistence. Never represents server authentication or shared storage. */
export function OperationsProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try {
      return { snapshot: loadSnapshot(), error: '' };
    } catch {
      return {
        snapshot: createOperationsSeed(),
        error:
          '저장 데이터를 읽을 수 없습니다. 기존 데이터를 덮어쓰지 않았습니다. 백업을 확인해 주세요.',
      };
    }
  });
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [actor, setActor] = useState<Person>(PEOPLE[0]);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('데모 데이터 · 이 브라우저에 저장');
  const [saving, setSaving] = useState(false);

  function reload() {
    try {
      setSnapshot(loadSnapshot());
      setError('');
      setMessage('최신 브라우저 저장 데이터를 불러왔습니다.');
    } catch {
      setError(
        '저장 데이터를 읽을 수 없습니다. 현재 자료를 덮어쓰지 않았습니다.',
      );
    }
  }
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) reload();
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  async function commit(
    update: (current: OperationsSnapshot) => OperationsSnapshot,
  ): Promise<boolean> {
    setSaving(true);
    setError('');
    function write() {
      // Web Locks serialize mutations across tabs on this origin. They do not replace database transactions.
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? snapshotSchema.parse(JSON.parse(raw)) : snapshot;
      const next = snapshotSchema.parse(update(current));
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSnapshot(next);
      setMessage(
        '브라우저 저장 완료 · ' + new Date(next.updatedAt).toLocaleTimeString(),
      );
    }
    try {
      if (!('locks' in navigator))
        throw new Error(
          '동시 저장 보호를 지원하는 HTTPS 또는 localhost 브라우저에서 사용하세요.',
        );
      await navigator.locks.request(STORAGE_KEY, write);
      return true;
    } catch (cause) {
      setError(
        cause instanceof z.ZodError
          ? cause.issues.map((issue) => issue.message).join(' / ')
          : cause instanceof Error
            ? cause.message
            : '저장에 실패했습니다. 입력 내용은 유지됩니다.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add(draft: RequestDraft) {
    const id = 'REQ-' + crypto.randomUUID();
    const success = await commit((current) => {
      const at = new Date().toISOString();
      const request = createRequest(draft, actor.id, id, at);
      return {
        ...current,
        revision: current.revision + 1,
        updatedAt: at,
        requests: [request, ...current.requests],
      };
    });
    return success ? id : undefined;
  }
  async function act(id: string, revision: number, action: RequestAction) {
    return commit((current) => {
      const request = current.requests.find((item) => item.id === id);
      if (!request) throw new Error('요청을 찾을 수 없습니다.');
      const at = new Date().toISOString();
      const updated = applyRequestAction(
        request,
        action,
        actor.id,
        revision,
        at,
        crypto.randomUUID(),
      );
      return {
        ...current,
        revision: current.revision + 1,
        updatedAt: at,
        requests: current.requests.map((item) =>
          item.id === id ? updated : item,
        ),
      };
    });
  }
  async function restore(input: unknown) {
    return commit((current) => {
      const backup = snapshotSchema.parse(input);
      const existing = new Set(current.requests.map((request) => request.id));
      const additions = backup.requests.filter(
        (request) => !existing.has(request.id),
      );
      if (!additions.length)
        throw new Error(
          '새로 복원할 요청이 없습니다. 기존 ID의 요청은 덮어쓰지 않습니다.',
        );
      return {
        ...current,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        requests: [...current.requests, ...additions],
      };
    });
  }
  return (
    <OperationsContext.Provider
      value={{
        snapshot,
        actor,
        changeActor: (id) => {
          const person = PEOPLE.find((entry) => entry.id === id);
          if (person) setActor(person);
        },
        message,
        error,
        saving,
        add,
        act,
        reload,
        restore,
        previousBackup: () => localStorage.getItem(BACKUP_KEY),
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
}
export function useOperations(): OperationsContextValue {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('OperationsProvider is required.');
  return context;
}
