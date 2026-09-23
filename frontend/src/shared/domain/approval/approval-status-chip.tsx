import { StatusBadge } from '@/shared/components/status-badge';
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_TONES,
  type EntityApprovalStatus,
} from './approval-model';

interface ApprovalStatusChipProps {
  status: EntityApprovalStatus;
  /** One line under the badge: current step, who it waits on, or who closed it. */
  detail?: string;
}

/** Entity-list cell: the approval state with its one-line progress. */
export function ApprovalStatusChip({
  status,
  detail,
}: ApprovalStatusChipProps) {
  return (
    <div className="approval-status-chip">
      <StatusBadge
        label={APPROVAL_STATUS_LABELS[status]}
        tone={APPROVAL_STATUS_TONES[status]}
      />
      {detail && <small>{detail}</small>}
    </div>
  );
}
