import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input } from '@coverland-engineering/ui/input';
import { UserPicker } from '@/shared/domain/user-picker';
import type { AppUser, HandoffChecklist } from '@/shared/types/workbench';
import {
  HANDOFF_DOCUMENTS,
  handoffChecklistErrors,
} from '../handoff-checklist';

export function HandoffChecklistForm({
  value,
  onChange,
  projectId,
  vehicle,
  zones,
  users,
}: {
  value: HandoffChecklist;
  onChange: (value: HandoffChecklist) => void;
  projectId: string;
  vehicle: string;
  zones: string;
  users: readonly AppUser[];
}) {
  const count = HANDOFF_DOCUMENTS.filter(
    ([id]) =>
      value.documents[id]?.confirmed && value.documents[id]?.reference.trim(),
  ).length;
  const errors = handoffChecklistErrors(value);
  const exportReport = () => {
    const report = [
      `Handoff checklist`,
      `${projectId} · ${vehicle} · ${zones}`,
      `Exported at: ${new Date().toISOString()}`,
      ...HANDOFF_DOCUMENTS.map(
        ([id, label]) =>
          `${value.documents[id]?.confirmed ? '[Verified]' : '[Not verified]'} ${label}: ${value.documents[id]?.reference ?? ''}`,
      ),
      `Fitment vehicle confirmed: ${value.vehicleConfirmed}`,
      `Project number confirmed: ${value.projectNumberConfirmed}`,
      `Handoff approval: ${value.approvalConfirmed} / ${value.approvedBy}`,
      errors.length
        ? `Incomplete items:
${errors.join('\n')}`
        : 'Checklist ready (see the project record for actual handoff completion)',
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', report], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId}-handoff.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="project-dialog-stack">
      <p>
        <strong>Documents & handoff checklist</strong> · Required documents{' '}
        {count}/6 verified
      </p>
      {HANDOFF_DOCUMENTS.map(([id, label]) => {
        const item = value.documents[id] ?? { reference: '', confirmed: false };
        return (
          <div key={id} className="handoff-document">
            <label className="shape-check">
              <Checkbox
                checked={item.confirmed}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    documents: {
                      ...value.documents,
                      [id]: { ...item, confirmed: checked === true },
                    },
                  })
                }
              />
              {label}{' '}
              <small>
                {item.confirmed && item.reference.trim()
                  ? 'Verified'
                  : 'Needs verification'}
              </small>
            </label>
            <Input
              aria-label={`${label} Document location`}
              value={item.reference}
              placeholder="File name, NAS path, or document link"
              onChange={(event) =>
                onChange({
                  ...value,
                  documents: {
                    ...value.documents,
                    [id]: { reference: event.target.value, confirmed: false },
                  },
                })
              }
            />
          </div>
        );
      })}
      <p className="muted-text">
        Open and review the material before checking this box. This screen
        stores locations and verification records; it does not upload files or
        validate their contents automatically.
      </p>
      <label className="shape-check">
        <Checkbox
          checked={value.vehicleConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, vehicleConfirmed: checked === true })
          }
        />
        Vehicle, options, and zone confirmed · {vehicle} · {zones}
      </label>
      <label className="shape-check">
        <Checkbox
          checked={value.projectNumberConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, projectNumberConfirmed: checked === true })
          }
        />
        Handoff project number confirmed · {projectId}
      </label>
      <p className="muted-text">
        The official Shape number is issued after post-handoff review and
        approval. Confirm the project number here.
      </p>
      <label>
        Handoff approver
        <UserPicker
          users={users}
          value={users.find((user) => user.name === value.approvedBy)}
          label="Handoff approver"
          onChange={(userId) =>
            onChange({
              ...value,
              approvedBy: users.find((user) => user.id === userId)?.name ?? '',
              approvalConfirmed: false,
            })
          }
          placeholder="Search and select approver"
        />
      </label>
      <label className="shape-check">
        <Checkbox
          checked={value.approvalConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, approvalConfirmed: checked === true })
          }
        />
        I have confirmed delivery to production and handoff approval.
      </label>
      <p className="muted-text">
        Handoff confirmation and final Shape quality approval are separate.
      </p>
      {errors.length > 0 && (
        <div className="shape-errors" role="status">
          <strong>Complete the following items before handoff.</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="outline" onClick={exportReport}>
        Export handoff report
      </Button>
    </div>
  );
}
