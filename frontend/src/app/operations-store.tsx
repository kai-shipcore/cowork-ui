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
          'Unable to read saved data. Existing data has not been overwritten. Please check your backup.',
      };
    }
  });
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [actor, setActor] = useState<Person>(PEOPLE[0]);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function reload() {
    try {
      setSnapshot(loadSnapshot());
      setError('');
      setMessage('Loaded the latest data from this browser.');
    } catch {
      setError(
        'Unable to read saved data. Current records have not been overwritten.',
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
        'Saved in this browser · ' +
          new Date(next.updatedAt).toLocaleTimeString('en-US'),
      );
    }
    try {
      if (!('locks' in navigator))
        throw new Error(
          'Use HTTPS or localhost in a browser that supports concurrent-write protection.',
        );
      await navigator.locks.request(STORAGE_KEY, write);
      return true;
    } catch (cause) {
      setError(
        cause instanceof z.ZodError
          ? cause.issues.map((issue) => issue.message).join(' / ')
          : cause instanceof Error
            ? cause.message
            : 'Save failed. Your input has been preserved.',
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
      if (!request) throw new Error('Request not found.');
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
          'No new requests to restore. Requests with existing IDs are not overwritten.',
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
