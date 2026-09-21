import type { ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { PROJECT_HEALTH, type ProjectHealthFilter } from '../project-health';

interface ProjectHealthFiltersProps {
  value: ProjectHealthFilter;
  counts: Record<ProjectHealthFilter, number>;
  onChange: (value: ProjectHealthFilter) => void;
}

/** Shared health legend and counted filters for both project views. */
export function ProjectHealthFilters({
  value,
  counts,
  onChange,
}: ProjectHealthFiltersProps): ReactElement {
  return (
    <div className="project-health-toolbar">
      <div
        className="project-health-filters"
        role="group"
        aria-label="Project health filters"
      >
        <span className="project-health-heading">
          Progress status <small>By zone</small>
        </span>
        {[{ value: 'all', label: 'All' } as const, ...PROJECT_HEALTH].map(
          (item) => (
            <Button
              key={item.value}
              variant="outline"
              size="sm"
              className="project-health-filter"
              data-health={item.value}
              aria-pressed={value === item.value}
              onClick={() => {
                onChange(item.value);
              }}
            >
              {item.value !== 'all' && (
                <span className="project-health-dot" aria-hidden="true" />
              )}
              {item.label}
              <span className="project-health-count">{counts[item.value]}</span>
            </Button>
          ),
        )}
      </div>
      <details className="project-health-help">
        <summary>Health classification rules</summary>
        <p>
          The current stage's saved due date takes priority. Legacy projects
          without a stage due date use the overall project target.
        </p>
        <p>
          Prototype rules · Los Angeles dates · Based on days to target and
          recent activity.
        </p>
        <ul>
          <li>
            Late: Past due. At risk: On hold, due within 0–2 days, or no
            activity for at least 14 days.
          </li>
          <li>
            Watch: Due in 3–7 days or inactive for 7–13 days. On track: Due in
            at least 8 days with activity in the last 7 days.
          </li>
          <li>
            Risk signals take priority. Missing or invalid dates show
            Insufficient data. Completed, cancelled, and merged projects are
            counted separately.
          </li>
        </ul>
      </details>
    </div>
  );
}
