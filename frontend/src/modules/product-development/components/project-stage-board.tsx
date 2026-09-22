import { useEffect, useState, type ReactElement, type UIEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { VehicleProjectGroup } from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import { projectHealth } from '../project-health';
import { ProjectHealthBadge } from './project-health-badge';

interface ProjectStageBoardProps {
  projects: readonly VehicleProjectGroup[];
  onOpen: (projectId: string, zoneCode: string) => void;
  currentDate?: string;
}
const STAGES = [
  'Research',
  'Vehicle Hunt',
  'Scan',
  '3D Model',
  'Fit Review',
  'Design',
  'Sample',
  'Fitting',
  'Approved',
];
const LANE_PAGE_SIZE = 8;

type BoardEntry = {
  project: VehicleProjectGroup;
  zone: VehicleProjectGroup['zoneProjects'][number];
};

interface StageLaneProps {
  stage: (typeof STAGES)[number];
  entries: readonly BoardEntry[];
  currentDate: string;
  onOpen: (projectId: string, zoneCode: string) => void;
}

function StageLane({
  stage,
  entries,
  currentDate,
  onOpen,
}: StageLaneProps): ReactElement {
  const [page, setPage] = useState(1);
  const entryKey = entries.map(({ zone }) => zone.id).join('|');

  useEffect(() => {
    setPage(1);
  }, [entryKey]);

  const visibleCount = Math.min(entries.length, page * LANE_PAGE_SIZE);
  const visibleEntries = entries.slice(0, visibleCount);
  const remaining = entries.length - visibleCount;
  const totalPages = Math.max(1, Math.ceil(entries.length / LANE_PAGE_SIZE));
  const loadNextPage = () => {
    if (remaining > 0) setPage((current) => Math.min(current + 1, totalPages));
  };
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const lane = event.currentTarget;
    const distanceFromBottom =
      lane.scrollHeight - lane.scrollTop - lane.clientHeight;
    if (distanceFromBottom < 64) loadNextPage();
  };

  return (
    <section className="rd-lane">
      <h3>
        {stage === 'Approved' ? 'Development complete' : stage}
        <span>{entries.length}</span>
      </h3>
      <div
        className="rd-lane-cards"
        aria-label={`${stage} projects`}
        onScroll={handleScroll}
      >
        {visibleEntries.map(({ project, zone }) => {
          const health = projectHealth(zone, currentDate);
          const priority = zone.priority ?? 'NORMAL';
          return (
            <button
              type="button"
              className="rd-board-card"
              data-health={health.value}
              key={zone.id}
              aria-label={`Open ${project.vehicle} ${zone.label} details`}
              onClick={() => {
                onOpen(project.id, zone.code);
              }}
            >
              <span className="rd-board-card-header">
                <ProjectHealthBadge
                  value={health.value}
                  reason={health.reason}
                />
                <span
                  className={`vp-priority-badge vp-priority-${priority.toLowerCase()}`}
                >
                  {priority[0] + priority.slice(1).toLowerCase()}
                </span>
              </span>
              <strong>{project.vehicle}</strong>
              <span>
                {zone.label} · {project.product}
              </span>
              <span className="rd-board-card-footer">
                <small>{zone.id}</small>
                <span>
                  Details
                  <ChevronRight aria-hidden="true" />
                </span>
              </span>
            </button>
          );
        })}
        {!entries.length && <p className="rd-empty">No projects</p>}
        {remaining > 0 && (
          <button type="button" className="rd-lane-more" onClick={loadNextPage}>
            Load next {Math.min(LANE_PAGE_SIZE, remaining)}
            <small>
              {visibleCount} of {entries.length}
            </small>
          </button>
        )}
      </div>
    </section>
  );
}

/** A board is a view of the same zone projects; it never bypasses stage approval gates. */
export function ProjectStageBoard({
  projects,
  onOpen,
  currentDate = today(),
}: ProjectStageBoardProps): ReactElement {
  const rows = projects.flatMap((project) =>
    project.zoneProjects.map((zone) => ({ project, zone })),
  );
  return (
    <div className="rd-workspace">
      <div className="rd-board" aria-label="Project stage board">
        {STAGES.map((stage) => {
          const entries = rows.filter(
            ({ zone }) => zone.currentStage === stage,
          );
          return (
            <StageLane
              currentDate={currentDate}
              entries={entries}
              key={stage}
              stage={stage}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      {!rows.length && <p role="status">No projects match these filters.</p>}
    </div>
  );
}
