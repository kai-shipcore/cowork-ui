import { Badge, BadgeDot } from '@coverland-engineering/ui/badge';
import type { StatusTone } from '@/shared/types/workbench';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const BADGE_STYLES: Record<StatusTone, string> = {
  neutral: 'workbench-badge badge-neutral',
  progress: 'workbench-badge badge-progress',
  success: 'workbench-badge badge-success',
  warning: 'workbench-badge badge-warning',
  danger: 'workbench-badge badge-danger',
  purple: 'workbench-badge badge-purple',
  cyan: 'workbench-badge badge-cyan',
};

/** Displays a compact status marker using the shared Storybook badge. */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <Badge appearance="light" size="sm" className={BADGE_STYLES[tone]}>
      <BadgeDot />
      {label}
    </Badge>
  );
}
