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
        aria-label="프로젝트 상태 필터"
      >
        <span className="project-health-heading">
          진행 상태 <small>Zone 기준</small>
        </span>
        {[{ value: 'all', label: '전체' } as const, ...PROJECT_HEALTH].map(
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
        <summary>상태 판정 기준</summary>
        <p>
          현재 단계에 저장된 목표일을 우선 사용합니다. 단계 목표가 없는 기존
          프로젝트는 전체 프로젝트 목표일을 사용합니다.
        </p>
        <p>
          프로토타입 기준 · LA 날짜 기준 · 목표일까지 남은 날짜와 최근 활동
          기록을 사용합니다.
        </p>
        <ul>
          <li>
            Late: 목표일 초과. At risk: 진행 보류, 목표일이 오늘~2일 이내, 또는
            14일 이상 활동 없음.
          </li>
          <li>
            Watch: 목표일이 3~7일 이내 또는 7~13일 활동 없음. On track:
            목표일까지 8일 이상 남고 최근 7일 내 활동.
          </li>
          <li>
            위험 신호를 우선 표시합니다. 판정에 필요한 날짜가 없거나 잘못되면
            정보 부족으로 표시합니다. 완료·취소·병합은 별도 집계합니다.
          </li>
        </ul>
      </details>
    </div>
  );
}
