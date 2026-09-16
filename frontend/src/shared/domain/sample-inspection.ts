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
  if (!item.sampleReceivedAt) errors.push('입고된 항목만 검수할 수 있습니다.');
  else if (!Number.isFinite(Date.parse(item.sampleReceivedAt)))
    errors.push('입고 시각이 올바르지 않습니다.');
  if (!item.inspectedBy || !item.inspectedAt)
    errors.push('검수자와 검수 시각이 필요합니다.');
  if (item.drawingMatch === undefined)
    errors.push('도면 일치 여부를 선택하세요.');
  if (item.sampleRound > 1 && !item.revisionReflected)
    errors.push('반복 샘플은 수정 반영 판정이 필요합니다.');
  const inspected = Date.parse(item.inspectedAt ?? '');
  if (
    !Number.isFinite(inspected) ||
    inspected > now ||
    inspected < Date.parse(item.sampleReceivedAt ?? '')
  )
    errors.push('검수 시각은 입고 이후부터 현재까지여야 합니다.');
  if (
    (item.drawingMatch === false ||
      (item.revisionReflected && item.revisionReflected !== 'CORRECT')) &&
    !item.inspectionNote?.trim()
  )
    errors.push('불합격 사유를 입력하세요.');
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
