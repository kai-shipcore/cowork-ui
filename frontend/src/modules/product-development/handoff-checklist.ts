import type { HandoffChecklist } from '@/shared/types/workbench';

export const HANDOFF_DOCUMENTS = [
  ['parts', 'Final parts list'],
  ['blueprint', 'Blueprint · Dimensions and Self marks removed'],
  ['fitting', 'Fitting photos/videos'],
  ['product', 'Product photos'],
  ['manual', 'Manual'],
  ['design', 'Design files'],
] as const;

export function emptyHandoffChecklist(): HandoffChecklist {
  return {
    documents: {},
    vehicleConfirmed: false,
    projectNumberConfirmed: false,
    approvedBy: '',
    approvalConfirmed: false,
  };
}

export function handoffChecklistErrors(value: HandoffChecklist): string[] {
  const errors = HANDOFF_DOCUMENTS.filter(
    ([id]) =>
      !value.documents[id]?.confirmed || !value.documents[id]?.reference.trim(),
  ).map(([, label]) => `${label}: Enter and verify the document location.`);
  if (!value.vehicleConfirmed)
    errors.push('Confirm the vehicle, options, and zone.');
  if (!value.projectNumberConfirmed)
    errors.push('Confirm the handoff project number.');
  if (!value.approvalConfirmed || !value.approvedBy.trim())
    errors.push('Confirm the handoff approver and approval.');
  return errors;
}

/** Fills the local test checklist without submitting a handoff. */
export function fillTestHandoffChecklist(
  value: HandoffChecklist,
  approverName: string,
): HandoffChecklist {
  return {
    ...value,
    documents: Object.fromEntries(
      HANDOFF_DOCUMENTS.map(([id, label]) => [
        id,
        {
          reference: value.documents[id]?.reference.trim() || `[TEST] ${label}`,
          confirmed: true,
        },
      ]),
    ),
    vehicleConfirmed: true,
    projectNumberConfirmed: true,
    approvedBy: value.approvedBy || approverName,
    approvalConfirmed: true,
  };
}

export function prepareHandoffChecklist(
  value: HandoffChecklist | undefined,
  evidenceKey: string,
): HandoffChecklist {
  if (!value) return { ...emptyHandoffChecklist(), evidenceKey };
  if (value.evidenceKey === evidenceKey) return value;
  return {
    ...value,
    evidenceKey,
    documents: Object.fromEntries(
      Object.entries(value.documents).map(([id, item]) => [
        id,
        { ...item, confirmed: false },
      ]),
    ),
    vehicleConfirmed: false,
    projectNumberConfirmed: false,
    approvalConfirmed: false,
  };
}
