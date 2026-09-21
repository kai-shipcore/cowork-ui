import {
  sampleStatus,
  type SampleStatus,
} from '@/shared/domain/sample-inspection';
import { StatusBadge } from '@/shared/components/status-badge';
import type { SampleRequestItem, StatusTone } from '@/shared/types/workbench';

const labels: Record<SampleStatus, [string, StatusTone]> = {
  REQUESTED: ['Not received', 'neutral'],
  IN_PRODUCTION: ['In production', 'progress'],
  SHIPPED: ['Not received · In transit', 'progress'],
  RECEIVED: ['Awaiting inspection', 'warning'],
  PASSED: ['Inspection passed', 'success'],
  FACTORY_ISSUE: ['Factory issue', 'danger'],
  DESIGN_ISSUE: ['Change implementation issue', 'danger'],
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
          {new Date(item.inspectedAt).toLocaleString('en-US')}
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
    passed > 0 && `Passed ${passed}`,
    issues > 0 && `Issue ${issues}`,
    waiting > 0 && `Awaiting inspection ${waiting}`,
    unreceived > 0 && `Not received ${unreceived}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="space-y-1 whitespace-nowrap text-left underline-offset-4 hover:underline"
      aria-label={`Open inspection details: ${counts || 'No request items'}`}
    >
      <StatusBadge
        label={
          items.length
            ? `Inspection ${passed + issues}/${items.length} · ${issues ? 'Issues found' : passed === items.length ? 'All passed' : 'In progress'}`
            : 'No request items'
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
