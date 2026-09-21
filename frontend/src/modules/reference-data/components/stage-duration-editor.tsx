import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import {
  durationStages,
  type STAGE_PRODUCTS,
  type StageDurationRevision,
} from '@/app/stage-duration-model';

interface StageDurationEditorProps {
  product: (typeof STAGE_PRODUCTS)[number];
  latest?: StageDurationRevision;
  canEdit: boolean;
  saving: boolean;
  onSave: (
    draft: StageDurationRevision,
    expectedId?: string,
  ) => Promise<boolean>;
}

/** Drafts never alter existing stage snapshots; stale edits must be reloaded explicitly. */
export function StageDurationEditor({
  product,
  latest,
  canEdit,
  saving,
  onSave,
}: StageDurationEditorProps): ReactElement {
  const stages = durationStages(product.name);
  const fromRevision = () =>
    stages.map((stage) =>
      String(
        latest?.stages.find((entry) => entry.stage === stage)?.targetDays ?? '',
      ),
    );
  const [values, setValues] = useState(fromRevision);
  const [baseId, setBaseId] = useState(latest?.id);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const valid = values.every(
    (value) =>
      value !== '' &&
      Number.isInteger(Number(value)) &&
      Number(value) >= 1 &&
      Number(value) <= 365,
  );
  const stale = latest?.id !== baseId;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || stale || !canEdit || saving || !note.trim()) return;
        const draft: StageDurationRevision = {
          id: crypto.randomUUID(),
          productTypeId: product.id,
          updatedAt: new Date().toISOString(),
          updatedBy: '',
          note: note.trim(),
          stages: stages.map((stage, index) => ({
            stage,
            targetDays: Number(values[index]),
          })),
        };
        void onSave(draft, baseId).then((success) => {
          if (success) {
            setBaseId(draft.id);
            setNote('');
            setMessage('Saved. Applies to stages started from now on.');
          } else
            setMessage(
              'Save failed. Check permissions, values, and changes in other windows.',
            );
        });
      }}
    >
      <div className="stage-duration-actions">
        <span>
          {latest
            ? `Last saved: ${new Date(latest.updatedAt).toLocaleString('en-US')}`
            : 'Standard durations not set · Due dates are not generated automatically.'}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit || saving}
          onClick={() => {
            setValues(product.example.map(String));
            setMessage(
              'Example durations loaded. Review and save to apply them.',
            );
          }}
        >
          Load example
        </Button>
      </div>
      <div className="stage-duration-table">
        <table>
          <thead>
            <tr>
              <th>Development stage</th>
              <th>Standard duration</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => (
              <tr key={stage}>
                <td>
                  {String(index + 1).padStart(2, '0')} · {stage}
                </td>
                <td>
                  <Input
                    aria-label={`${stage} Standard duration`}
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    required
                    value={values[index] ?? ''}
                    disabled={!canEdit || saving}
                    onChange={(event) => {
                      const value = event.target.value;
                      setValues((current) =>
                        current.map((entry, item) =>
                          item === index ? value : entry,
                        ),
                      );
                      setMessage('');
                    }}
                  />{' '}
                  days
                </td>
                <td>
                  {stage === 'Sample'
                    ? 'Includes production, shipping, and inspection'
                    : 'Counted from the stage start date'}
                </td>
              </tr>
            ))}
            <tr>
              <td>Development complete</td>
              <td>—</td>
              <td>Completed status · No duration</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="stage-duration-total">
        <span>Sequential total · Excludes rework</span>
        <strong>
          {valid
            ? `${String(values.reduce((sum, value) => sum + Number(value), 0))} days`
            : 'Enter 1–365 days for each stage'}
        </strong>
      </div>
      <label className="stage-duration-reason">
        Reason for change
        <Input
          value={note}
          maxLength={500}
          required
          disabled={!canEdit || saving}
          placeholder="Example: Updated supplier sample lead time"
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      <div className="stage-duration-actions">
        <p>
          Applies only to stages started from now on.
          <br />
          Due dates for active and completed stages and the overall project
          target remain unchanged.
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setValues(fromRevision());
              setBaseId(latest?.id);
              setNote('');
              setMessage('Loaded the latest saved values.');
            }}
          >
            Reload saved values
          </Button>{' '}
          <Button
            type="submit"
            disabled={!canEdit || saving || stale || !valid || !note.trim()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      {stale && (
        <p role="alert">
          Standards changed in another window. Reload the saved values.
        </p>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
