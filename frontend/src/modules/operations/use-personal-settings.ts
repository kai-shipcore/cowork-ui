import { useState } from 'react';
import { z } from 'zod';
import type { Person } from './operations-model';
import {
  loadPersonalSettings,
  savePersonalSettings,
  type PersonalSettings,
} from './personal-settings-model';

/** Parent keys the editor by actor so unsaved changes never cross demo identities. */
export function usePersonalSettings(actor: Person) {
  const [initial] = useState(() => loadPersonalSettings(actor));
  const [saved, setSaved] = useState(initial.settings);
  const [draft, setDraft] = useState(initial.settings);
  const [feedback, setFeedback] = useState({
    error: initial.error,
    message: '',
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function update(patch: Partial<PersonalSettings>): void {
    setDraft((current) => ({ ...current, ...patch }));
    setFeedback({ error: initial.error, message: '' });
  }
  function save(): void {
    if (initial.error) return;
    try {
      const next = savePersonalSettings(actor, draft, window.localStorage);
      setSaved(next);
      setDraft(next);
      setFeedback({
        error: '',
        message: 'Personal settings saved in this browser.',
      });
    } catch (error) {
      setFeedback({
        error:
          error instanceof z.ZodError
            ? error.issues.map((issue) => issue.message).join(' / ')
            : 'Save failed. Your input is preserved. Check browser storage.',
        message: '',
      });
    }
  }
  function cancel(): void {
    setDraft(saved);
    setFeedback({
      error: initial.error,
      message: 'Reverted to saved settings.',
    });
  }
  return {
    draft,
    saved,
    dirty,
    feedback,
    blocked: Boolean(initial.error),
    update,
    save,
    cancel,
  };
}
