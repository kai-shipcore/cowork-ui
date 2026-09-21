import type { ReactElement } from 'react';
import { userName } from '@/shared/domain/app-user';
import type { AppUser, VehicleProjectGroup } from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import { currentStageTiming, projectHealth } from '../project-health';
import { ProjectHealthBadge } from './project-health-badge';

interface ProjectStageBoardProps {
  projects: readonly VehicleProjectGroup[];
  users: readonly AppUser[];
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

/** A board is a view of the same zone projects; it never bypasses stage approval gates. */
export function ProjectStageBoard({
  projects,
  users,
  onOpen,
  currentDate = today(),
}: ProjectStageBoardProps): ReactElement {
  const rows = projects.flatMap((project) =>
    project.zoneProjects.map((zone) => ({ project, zone })),
  );
  return (
    <div className="rd-workspace">
      <p>
        Uses the same search, product, and stage filters as the list. Open a
        card to change stages through the existing verification and approval
        process.
      </p>
      <div className="rd-board" aria-label="Project stage board">
        {STAGES.map((stage) => {
          const entries = rows.filter(
            ({ zone }) => zone.currentStage === stage,
          );
          return (
            <section className="rd-lane" key={stage}>
              <h3>
                {stage === 'Approved' ? 'Development complete' : stage}
                <span>{entries.length}</span>
              </h3>
              {entries.map(({ project, zone }) => {
                const health = projectHealth(zone, currentDate);
                const timing = currentStageTiming(zone);
                return (
                  <button
                    type="button"
                    className="rd-board-card"
                    data-health={health.value}
                    key={zone.id}
                    onClick={() => {
                      onOpen(project.id, zone.code);
                    }}
                  >
                    <ProjectHealthBadge
                      value={health.value}
                      reason={health.reason}
                    />
                    <strong>{project.vehicle}</strong>
                    <span>
                      {zone.label} · {project.product}
                    </span>
                    <span>
                      {zone.id} · {zone.priority ?? 'NORMAL'}
                    </span>
                    <small>
                      {userName(users, zone.managerId)} ·{' '}
                      {zone.status ?? 'ACTIVE'}
                    </small>
                    <span className={health.value === 'late' ? 'rd-error' : ''}>
                      {timing?.targetDueAt
                        ? 'Stage target '
                        : 'Project target '}
                      {(timing?.targetDueAt ?? zone.targetAt)?.slice(0, 10) ??
                        'Unassigned'}
                    </span>
                    {timing?.targetDays !== undefined && (
                      <small>
                        Applied standard {timing.targetDays} days · Started{' '}
                        {timing.startedAt.slice(0, 10)}
                      </small>
                    )}
                    <small>{health.reason}</small>
                    <small>
                      Last activity{' '}
                      {zone.lastActivityAt?.slice(0, 10) ?? 'No record'}
                    </small>
                  </button>
                );
              })}
              {!entries.length && <p className="rd-empty">No projects</p>}
            </section>
          );
        })}
      </div>
      {!rows.length && <p role="status">No projects match these filters.</p>}
    </div>
  );
}
