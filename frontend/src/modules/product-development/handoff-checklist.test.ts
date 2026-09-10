import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyHandoffChecklist,
  fillTestHandoffChecklist,
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

test('test fill completes required fields without mutating the original draft', () => {
  const draft = { ...emptyHandoffChecklist(), evidenceKey: 'current-evidence' };
  const filled = fillTestHandoffChecklist(draft, 'Kai');
  assert.deepEqual(handoffChecklistErrors(filled), []);
  assert.equal(filled.approvedBy, 'Kai');
  assert.equal(filled.evidenceKey, 'current-evidence');
  assert.ok(Object.values(filled.documents).every((item) => item.reference.startsWith('[TEST]')));
  assert.deepEqual(draft.documents, {});
  assert.equal(draft.approvalConfirmed, false);
});

test('test fill preserves existing document references and selected approver', () => {
  const filled = fillTestHandoffChecklist(completed, 'Kai');
  assert.equal(filled.approvedBy, 'Manager');
  assert.deepEqual(filled.documents, completed.documents);
  assert.deepEqual(handoffChecklistErrors(filled), []);
});

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
