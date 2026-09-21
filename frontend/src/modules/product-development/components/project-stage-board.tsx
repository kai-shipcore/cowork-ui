import type { ReactElement } from 'react';
import { userName } from '@/shared/domain/app-user';
import type { AppUser, VehicleProjectGroup } from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import { projectHealth } from '../project-health';
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
        목록과 동일한 검색·제품·단계 조건을 사용합니다. 카드를 열어 기존
        검증·승인 절차에 따라 단계를 변경하세요.
      </p>
      <div className="rd-board" aria-label="프로젝트 단계별 보드">
        {STAGES.map((stage) => {
          const entries = rows.filter(
            ({ zone }) => zone.currentStage === stage,
          );
          return (
            <section className="rd-lane" key={stage}>
              <h3>
                {stage === 'Approved' ? '개발 완료' : stage}
                <span>{entries.length}</span>
              </h3>
              {entries.map(({ project, zone }) => {
                const health = projectHealth(zone, currentDate);
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
                      목표 {zone.targetAt?.slice(0, 10) ?? '미지정'}
                    </span>
                    <small>{health.reason}</small>
                    <small>
                      최근 활동{' '}
                      {zone.lastActivityAt?.slice(0, 10) ?? '기록 없음'}
                    </small>
                  </button>
                );
              })}
              {!entries.length && <p className="rd-empty">프로젝트 없음</p>}
            </section>
          );
        })}
      </div>
      {!rows.length && <p role="status">조건에 맞는 프로젝트가 없습니다.</p>}
    </div>
  );
}
