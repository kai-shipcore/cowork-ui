import {
  sampleStatus,
  type SampleStatus,
} from '@/shared/domain/sample-inspection';
import { StatusBadge } from '@/shared/components/status-badge';
import type { SampleRequestItem, StatusTone } from '@/shared/types/workbench';

const labels: Record<SampleStatus, [string, StatusTone]> = {
  REQUESTED: ['입고 전', 'neutral'],
  IN_PRODUCTION: ['생산 중', 'progress'],
  SHIPPED: ['입고 전 · 배송 중', 'progress'],
  RECEIVED: ['검수 대기', 'warning'],
  PASSED: ['검수 통과', 'success'],
  FACTORY_ISSUE: ['공장 문제', 'danger'],
  DESIGN_ISSUE: ['수정 반영 문제', 'danger'],
};

export function InspectionResult({
  item,
  compact = false,
}: {
  item: SampleRequestItem;
  compact?: boolean;
}) {
  const [label, tone] = labels[sampleStatus(item)];
  return (
    <div className="space-y-1">
      <StatusBadge label={label} tone={tone} />
      {!compact && item.inspectedAt && (
        <div className="text-xs text-muted-foreground">
          {new Date(item.inspectedAt).toLocaleString('ko-KR')}
        </div>
      )}
      {!compact && item.inspectionNote && (
        <p
          className="max-w-64 whitespace-normal break-words text-xs"
          title={item.inspectionNote}
        >
          {item.inspectionNote}
        </p>
      )}
    </div>
  );
}

/** Fixed two-line request summary; item details stay in the inspection dialog. */
export function InspectionSummary({
  items,
  onOpen,
}: {
  items: readonly SampleRequestItem[];
  onOpen: () => void;
}) {
  const statuses = items.map(sampleStatus);
  const passed = statuses.filter((status) => status === 'PASSED').length;
  const issues = statuses.filter(
    (status) => status === 'FACTORY_ISSUE' || status === 'DESIGN_ISSUE',
  ).length;
  const waiting = statuses.filter((status) => status === 'RECEIVED').length;
  const unreceived = items.length - passed - issues - waiting;
  const counts = [
    passed > 0 && `통과 ${passed}`,
    issues > 0 && `문제 ${issues}`,
    waiting > 0 && `검수 대기 ${waiting}`,
    unreceived > 0 && `입고 전 ${unreceived}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="space-y-1 whitespace-nowrap text-left underline-offset-4 hover:underline"
      aria-label={`검수 상세 열기: ${counts || '요청 항목 없음'}`}
    >
      <StatusBadge
        label={
          items.length
            ? `검수 ${passed + issues}/${items.length} · ${issues ? '문제 있음' : passed === items.length ? '전체 통과' : '진행 중'}`
            : '요청 항목 없음'
        }
        tone={
          issues
            ? 'danger'
            : items.length && passed === items.length
              ? 'success'
              : 'neutral'
        }
      />
      {counts && (
        <span className="block text-xs text-muted-foreground">{counts}</span>
      )}
    </button>
  );
}
