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
        message: '개인 설정을 이 브라우저에 저장했습니다.',
      });
    } catch (error) {
      setFeedback({
        error:
          error instanceof z.ZodError
            ? error.issues.map((issue) => issue.message).join(' / ')
            : '저장하지 못했습니다. 입력 내용은 유지됩니다. 브라우저 저장 공간을 확인해 주세요.',
        message: '',
      });
    }
  }
  function cancel(): void {
    setDraft(saved);
    setFeedback({
      error: initial.error,
      message: '저장된 설정으로 되돌렸습니다.',
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
