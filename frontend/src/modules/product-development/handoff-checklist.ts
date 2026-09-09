import type { HandoffChecklist } from '@/shared/types/workbench';

export const HANDOFF_DOCUMENTS = [
  ['parts', '최종 부품 목록'],
  ['blueprint', 'Blueprint · 치수·Self 표시 제거'],
  ['fitting', '피팅 사진·영상'],
  ['product', '제품 사진'],
  ['manual', '매뉴얼'],
  ['design', '디자인 자료'],
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
  ).map(([, label]) => `${label}: 자료 위치 입력과 확인이 필요합니다.`);
  if (!value.vehicleConfirmed) errors.push('적용 차량·옵션·Zone을 확인하세요.');
  if (!value.projectNumberConfirmed)
    errors.push('인계 대상 프로젝트 번호를 확인하세요.');
  if (!value.approvalConfirmed || !value.approvedBy.trim())
    errors.push('양산 인계 승인 담당자와 승인 여부를 확인하세요.');
  return errors;
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
