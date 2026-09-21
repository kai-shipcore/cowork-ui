import type { SampleRequestItem } from '../types/workbench';

export type SampleStatus =
  | 'REQUESTED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'RECEIVED'
  | 'PASSED'
  | 'FACTORY_ISSUE'
  | 'DESIGN_ISSUE';

export function sampleStatus(item: SampleRequestItem): SampleStatus {
  if (
    item.sampleReceivedAt &&
    item.inspectedAt &&
    item.inspectedBy &&
    inspectionErrors(item).length === 0
  ) {
    if (item.drawingMatch === false) return 'FACTORY_ISSUE';
    if (
      item.revisionReflected === 'PARTIAL' ||
      item.revisionReflected === 'NOT_REFLECTED'
    )
      return 'DESIGN_ISSUE';
    if (
      item.drawingMatch === true &&
      (item.sampleRound === 1 || item.revisionReflected === 'CORRECT')
    )
      return 'PASSED';
  }
  if (item.sampleReceivedAt) return 'RECEIVED';
  if (item.sampleShipmentId) return 'SHIPPED';
  if (item.productionStartedAt) return 'IN_PRODUCTION';
  return 'REQUESTED';
}

export function inspectionErrors(
  item: SampleRequestItem,
  now = Date.now(),
): string[] {
  const errors: string[] = [];
  if (!item.sampleReceivedAt)
    errors.push('Only received items can be inspected.');
  else if (!Number.isFinite(Date.parse(item.sampleReceivedAt)))
    errors.push('Invalid receipt time.');
  if (!item.inspectedBy || !item.inspectedAt)
    errors.push('An inspector and inspection time are required.');
  if (item.drawingMatch === undefined)
    errors.push('Select the drawing match result.');
  if (item.sampleRound > 1 && !item.revisionReflected)
    errors.push('Repeat samples require an implementation assessment.');
  const inspected = Date.parse(item.inspectedAt ?? '');
  if (
    !Number.isFinite(inspected) ||
    inspected > now ||
    inspected < Date.parse(item.sampleReceivedAt ?? '')
  )
    errors.push('Inspection time must be between receipt and now.');
  if (
    (item.drawingMatch === false ||
      (item.revisionReflected && item.revisionReflected !== 'CORRECT')) &&
    !item.inspectionNote?.trim()
  )
    errors.push('Enter a failure reason.');
  return errors;
}

/** Legacy execution verification is preserved but never invented as drawing inspection. */
export function migrateSampleInspection(
  item: SampleRequestItem,
): SampleRequestItem {
  const value = item.revisionReflected as string | undefined;
  return {
    ...item,
    revisionReflected:
      value === 'EXACT'
        ? 'CORRECT'
        : value === 'NONE'
          ? 'NOT_REFLECTED'
          : item.revisionReflected,
  };
}
