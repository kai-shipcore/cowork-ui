import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyHandoffChecklist,
  HANDOFF_DOCUMENTS,
  handoffChecklistErrors,
  prepareHandoffChecklist,
} from './handoff-checklist';

const completed = {
  ...emptyHandoffChecklist(),
  evidenceKey: 'version-1',
  documents: Object.fromEntries(
    HANDOFF_DOCUMENTS.map(([id]) => [
      id,
      { reference: `${id}.pdf`, confirmed: true },
    ]),
  ),
  vehicleConfirmed: true,
  projectNumberConfirmed: true,
  approvedBy: 'Manager',
  approvalConfirmed: true,
};

test('all six materials and vehicle, project and handoff approval are mandatory', () => {
  assert.equal(handoffChecklistErrors(completed).length, 0);
  for (const [id] of HANDOFF_DOCUMENTS) {
    assert.ok(
      handoffChecklistErrors({
        ...completed,
        documents: {
          ...completed.documents,
          [id]: { reference: '', confirmed: true },
        },
      }).length,
    );
    assert.ok(
      handoffChecklistErrors({
        ...completed,
        documents: {
          ...completed.documents,
          [id]: { reference: 'file.pdf', confirmed: false },
        },
      }).length,
    );
  }
  assert.ok(
    handoffChecklistErrors({ ...completed, vehicleConfirmed: false }).length,
  );
  assert.ok(
    handoffChecklistErrors({ ...completed, projectNumberConfirmed: false })
      .length,
  );
  assert.ok(handoffChecklistErrors({ ...completed, approvedBy: ' ' }).length);
  assert.ok(
    handoffChecklistErrors({ ...completed, approvalConfirmed: false }).length,
  );
});

test('draft checklist round trips without inventing confirmations', () => {
  const draft = JSON.parse(JSON.stringify(completed));
  assert.deepEqual(prepareHandoffChecklist(draft, 'version-1'), completed);
  assert.equal(
    handoffChecklistErrors(prepareHandoffChecklist(undefined, 'version-1'))
      .length,
    9,
  );
});

test('changed Part or fitting evidence preserves references but requires reconfirmation', () => {
  const changed = prepareHandoffChecklist(completed, 'version-2');
  assert.equal(changed.documents.parts.reference, 'parts.pdf');
  assert.equal(changed.documents.parts.confirmed, false);
  assert.equal(changed.approvalConfirmed, false);
  assert.equal(handoffChecklistErrors(changed).length, 9);
  assert.equal(completed.documents.parts.confirmed, true);
});
