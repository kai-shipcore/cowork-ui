import { Button } from '@coverland-engineering/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@coverland-engineering/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ProjectShapePanel } from './project-shape-panel';
import {
  applyShapeReview,
  hasCurrentFitmentQuality,
  isSizeReviewCurrent,
  shapeWorkflowLabel,
} from './shape-model';

interface ShapeReviewWorkspaceProps {
  /** Also list zones whose review is complete, with their history. */
  showAll: boolean;
  /** Make / Model text to match against the project vehicle. */
  query: string;
}

/**
 * Zone projects waiting for Shape review. Opening a row shows the review
 * detail in a side sheet; the selection lives in the URL (`project`, `zone`).
 */
export function ShapeReviewWorkspace({
  showAll,
  query,
}: ShapeReviewWorkspaceProps) {
  const {
    projects,
    projectDetails,
    updateProjectWorkflow,
    vehicleProductShapes,
    fitmentQualities,
  } = useWorkbenchStore();
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
      ({ zone }) => zone.status !== 'CANCELLED' && zone.status !== 'MERGED',
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
      vehicleProductShapes.find((shape) => shape.id === zone.productShapeId)
        ?.status !== 'ACTIVE' ||
      (snapshot &&
        !hasCurrentFitmentQuality(
          zone.id,
          snapshot.designs,
          snapshot.visits,
          fitmentQualities,
        )) ||
      !snapshot ||
      !isSizeReviewCurrent(zone, snapshot.designs, snapshot.visits)
    );
  });
  const normalizedQuery = query.trim().toLowerCase();
  const listed = (showAll ? rows : pending).filter(({ project }) =>
    project.vehicle.toLowerCase().includes(normalizedQuery),
  );
  const {
    pageItems: pagedRows,
    pagination,
    setPagination,
  } = useWorkbenchPagination(listed, `${showAll}|${normalizedQuery}`);

  const openReview = (projectId: string, zoneId: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', 'review');
      next.set('project', projectId);
      next.set('zone', zoneId);
      return next;
    });
  };
  const closeReview = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('project');
      next.delete('zone');
      return next;
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>프로젝트 / Zone</TableHead>
            <TableHead>후속 상태</TableHead>
            <TableHead>Handoff</TableHead>
            <TableHead className="action-column" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedRows.map(({ project, zone }) => (
            <TableRow key={zone.id}>
              <TableCell>
                <strong>{project.vehicle}</strong>
                <div className="vehicle-meta">
                  {project.id} · {zone.code}
                </div>
              </TableCell>
              <TableCell>
                {shapeWorkflowLabel(
                  zone,
                  projectDetails[project.id]?.designs,
                  projectDetails[project.id]?.visits,
                )}
              </TableCell>
              <TableCell>
                {zone.productionHandoff?.completedAt.slice(0, 10) ??
                  '확인 필요'}
              </TableCell>
              <TableCell className="table-actions">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReview(project.id, zone.id)}
                >
                  검토 열기
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!listed.length && (
            <TableRow>
              <TableCell colSpan={4}>
                현재 검토·발급 대기 항목이 없습니다. 신규 개발 프로젝트의
                피팅·품질 확인 후 검토하세요.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <WorkbenchPagination
        recordCount={listed.length}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
      <Sheet
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(1120px,96vw)] sm:max-w-none p-0 gap-0"
          accessibleTitle="Shape 검토"
          accessibleDescription="선택한 Zone 프로젝트의 Shape 검토 상세"
        >
          {selected && (
            <>
              <SheetHeader className="workbench-sheet-header">
                <SheetTitle>
                  {selected.project.vehicle} · {selected.zone.code}
                </SheetTitle>
                <Link
                  to={`/vehicle-projects?project=${encodeURIComponent(selected.project.id)}&zone=${encodeURIComponent(selected.zone.code)}`}
                >
                  원래 프로젝트 · 자료 · 재작업 열기 →
                </Link>
              </SheetHeader>
              <SheetBody className="workbench-sheet-body shape-management">
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
                    이전 데이터의 인계 자료가 없습니다. 원래 프로젝트에서 인계
                    완료를 기록하세요.
                  </p>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
