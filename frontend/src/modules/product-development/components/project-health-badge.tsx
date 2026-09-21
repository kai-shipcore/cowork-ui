import type { ReactElement } from 'react';
import { PROJECT_HEALTH, type ProjectHealth } from '../project-health';

interface ProjectHealthBadgeProps {
  value: ProjectHealth;
  reason: string;
}

/** A text label accompanies every health color, including non-active states. */
export function ProjectHealthBadge({
  value,
  reason,
}: ProjectHealthBadgeProps): ReactElement {
  return (
    <span className="project-health-badge" data-health={value} title={reason}>
      <span className="project-health-dot" aria-hidden="true" />
      {PROJECT_HEALTH.find((item) => item.value === value)?.label}
      <span className="sr-only"> · {reason}</span>
    </span>
  );
}
