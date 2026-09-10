import { Link, useNavigate, useSearchParams } from 'react-router';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ProjectShapePanel } from './project-shape-panel';
import {
  applyShapeReview,
  isSizeReviewCurrent,
  shapeWorkflowLabel,
} from './shape-model';

export function ShapeReviewWorkspace() {
  const { projects, projectDetails, updateProjectWorkflow } =
    useWorkbenchStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const rows = projects
    .flatMap((project) =>
      project.zoneProjects.map((record) => ({
        project,
        zone: projectDetails[project.id]?.zones.find(
          (zone) => zone.id === record.id,
        ) ?? { ...record, scanned: false },
      })),
    )
    .filter(
      ({ zone }) =>
        zone.currentStage === 'Approved' || zone.shapeReviewHistory?.length,
    );
  const selected = rows.find(
    ({ project, zone }) =>
      project.id === params.get('project') && zone.id === params.get('zone'),
  );
  const detail = selected ? projectDetails[selected.project.id] : undefined;
  const pending = rows.filter(({ project, zone }) => {
    const snapshot = projectDetails[project.id];
    return (
      !zone.productShapeId ||
      !snapshot ||
      !isSizeReviewCurrent(zone, snapshot.designs, snapshot.visits)
    );
  });
  return (
    <div className="shape-management">
      <div className="shape-table-scroll">
        <table className="shape-table">
          <thead>
            <tr>
              <th>프로젝트 / Zone</th>
              <th>후속 상태</th>
              <th>Handoff</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(({ project, zone }) => (
              <tr key={zone.id}>
                <td>
                  {project.vehicle}
                  <small>
                    {project.id} · {zone.code}
                  </small>
                </td>
                <td>
                  {shapeWorkflowLabel(
                    zone,
                    projectDetails[project.id]?.designs,
                    projectDetails[project.id]?.visits,
                  )}
                </td>
                <td>
                  {zone.productionHandoff?.completedAt.slice(0, 10) ??
                    '확인 필요'}
                </td>
                <td>
                  <button
                    type="button"
                    className="project-next-action-link"
                    aria-expanded={selected?.zone.id === zone.id}
                    onClick={() =>
                      setParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set('view', 'review');
                        if (selected?.zone.id === zone.id) {
                          next.delete('project');
                          next.delete('zone');
                        } else {
                          next.set('project', project.id);
                          next.set('zone', zone.id);
                        }
                        return next;
                      })
                    }
                  >
                    {selected?.zone.id === zone.id ? '검토 닫기 ↑' : '검토 열기 →'}
                  </button>
                </td>
              </tr>
            ))}
            {!pending.length && (
              <tr>
                <td colSpan={4}>
                  현재 검토·발급 대기 항목이 없습니다. 신규 개발은 프로젝트에서
                  Handoff를 먼저 완료하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <section className="shape-section">
          <h3>
            {selected.project.vehicle} · {selected.zone.code}
          </h3>
          <Link
            to={`/vehicle-projects?project=${encodeURIComponent(selected.project.id)}&zone=${encodeURIComponent(selected.zone.code)}`}
          >
            원래 프로젝트 · 자료 · 재작업 열기 →
          </Link>
          {detail ? (
            <ProjectShapePanel
              key={selected.zone.id}
              zone={selected.zone}
              designs={detail.designs}
              visits={detail.visits}
              onOpenTab={(tab) =>
                navigate(
                  `/vehicle-projects?project=${encodeURIComponent(selected.project.id)}&zone=${encodeURIComponent(selected.zone.code)}&tab=${tab}`,
                )
              }
              onReview={(review) =>
                updateProjectWorkflow(selected.project.id, (current) => {
                  const next = applyShapeReview(
                    current,
                    selected.zone.id,
                    review,
                  );
                  const now = new Date();
                  return {
                    ...next,
                    activity: [
                      {
                        id: crypto.randomUUID(),
                        date: now.toISOString().slice(5, 10),
                        time: now.toTimeString().slice(0, 5),
                        title:
                          review.outcome === 'APPROVED'
                            ? 'Shape 검토 구두 승인'
                            : `Shape 반려 · ${review.rejectionType === 'PATTERN' ? '패턴 재작업' : '문서 보완'}`,
                        detail: `${selected.zone.code} · ${review.reviewedBy} · ${review.note}`,
                      },
                      ...next.activity,
                    ],
                  };
                })
              }
              onLink={(id) =>
                updateProjectWorkflow(selected.project.id, (current) => ({
                  ...current,
                  zones: current.zones.map((zone) =>
                    zone.id === selected.zone.id
                      ? {
                          ...zone,
                          productShapeId: id,
                          productShape: undefined,
                          shape: undefined,
                        }
                      : zone,
                  ),
                  activity: [
                    {
                      id: crypto.randomUUID(),
                      date: new Date().toISOString().slice(5, 10),
                      time: new Date().toTimeString().slice(0, 5),
                      title: 'Shape 연결',
                      detail: `${selected.zone.code} · ${id ?? '연결 해제'}`,
                    },
                    ...current.activity,
                  ],
                }))
              }
            />
          ) : (
            <p>
              이전 데이터의 인계 자료가 없습니다. 원래 프로젝트에서 인계 완료를
              기록하세요.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
