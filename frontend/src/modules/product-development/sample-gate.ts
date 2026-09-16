import { canApproveRevisionSample } from '@/shared/domain/revision-control';
import type {
  ProductType,
  ProjectDesign,
  SampleRequestItem,
} from '@/shared/types/workbench';

export interface SampleGate {
  ready: boolean;
  blockers: readonly { message: string; tab: 'designs' | 'samples' }[];
}

/** The banner, approval panel, and stage transition share the same evidence. */
export function getSampleGate(
  product: ProductType,
  zones: readonly { id: string; code: string }[],
  designs: readonly ProjectDesign[],
  items: readonly SampleRequestItem[],
): SampleGate {
  const blockers: { message: string; tab: 'designs' | 'samples' }[] = [];
  if (!zones.length)
    blockers.push({ message: '대상 Zone Project가 없습니다.', tab: 'designs' });
  for (const zone of zones) {
    const zoneDesigns = designs.filter(
      (design) => design.vehicleProjectId === zone.id,
    );
    if (!zoneDesigns.length) {
      blockers.push({
        message: `${zone.code} Zone에 연결된 ${product === 'Car Cover' ? '전체 패턴' : product === 'Floor Mat' ? '금형' : 'Part / Design'}이 없습니다. 먼저 등록 또는 연결하세요.`,
        tab: 'designs',
      });
    }
    for (const design of zoneDesigns) {
      if (design.requiresRevisionAfterReview) {
        blockers.push({
          message: `${design.name}: Shape 검토에서 패턴 재작업이 요청되었습니다. 수정 Revision을 등록하고 새 샘플을 요청하세요.`,
          tab: 'designs',
        });
        continue;
      }
      const revision = design.revisions.reduce<
        ProjectDesign['revisions'][number] | undefined
      >(
        (latest, item) =>
          !latest || item.revisionNumber > latest.revisionNumber
            ? item
            : latest,
        undefined,
      );
      if (!revision) {
        blockers.push({
          message: `${design.name}: Revision을 먼저 등록하세요.`,
          tab: 'designs',
        });
        continue;
      }
      const revisionItems = items.filter(
        (item) =>
          item.vehicleProductDesignId === design.id &&
          item.vehicleProductDesignRevisionId === revision.id,
      );
      const label = `${design.name} · Rev ${revision.revisionNumber}`;
      if (!revisionItems.length) {
        blockers.push({
          message: `${label}: 현재 Revision의 샘플 요청이 없습니다. 새 Sample Request를 등록하세요.`,
          tab: 'samples',
        });
      } else if (!revisionItems.some((item) => item.sampleReceivedAt)) {
        blockers.push({
          message: `${label}: 샘플 입고 처리가 필요합니다.`,
          tab: 'samples',
        });
      } else if (
        !revisionItems.some((item) => canApproveRevisionSample(revision, item))
      ) {
        blockers.push({
          message: `${label}: 항목별 검수에서 도면 일치와 수정 반영 결과를 확인하세요.`,
          tab: 'samples',
        });
      } else if (product !== 'Floor Mat' && !revision.sampleApprovedAt) {
        blockers.push({
          message: `${label}: Sample Approval에서 현재 Revision을 승인하세요. 요청 상태의 APPROVED와는 별도입니다.`,
          tab: 'samples',
        });
      }
    }
  }
  return { ready: blockers.length === 0, blockers };
}
