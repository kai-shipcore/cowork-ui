import { Button } from '@coverland-engineering/ui/button';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
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
  const snapshots = new Map(Object.entries(projectDetails));
  const rows = projects
    .flatMap((project) =>
      project.zoneProjects.map((record) => ({
        project,
        zone: snapshots
          .get(project.id)
          ?.zones.find((zone) => zone.id === record.id) ?? {
          ...record,
          scanned: false,
        },
      })),
    )
    .filter(
      ({ zone }) => zone.status !== 'CANCELLED' && zone.status !== 'MERGED',
    );
  const selected = rows.find(
    ({ project, zone }) =>
      project.id === params.get('project') && zone.id === params.get('zone'),
  );
  const detail = selected ? snapshots.get(selected.project.id) : undefined;
  const pending = rows.filter(({ project, zone }) => {
    const snapshot = snapshots.get(project.id);
    if (!snapshot) return true;
    return (
      !zone.productShapeId ||
      vehicleProductShapes.find((shape) => shape.id === zone.productShapeId)
        ?.status !== 'ACTIVE' ||
      !hasCurrentFitmentQuality(
        zone.id,
        snapshot.designs,
        snapshot.visits,
        fitmentQualities,
      ) ||
      !isSizeReviewCurrent(zone, snapshot.designs, snapshot.visits)
    );
  });
  const normalizedQuery = query.trim().toLowerCase();
  const listed = (showAll ? rows : pending).filter(({ project }) =>
    project.vehicle.toLowerCase().includes(normalizedQuery),
  );
  const columns: FlatDataGridColumn<(typeof listed)[number]>[] = [
    {
      id: 'project',
      header: 'Project / Zone',
      width: 210,
      sortValue: ({ project }) => project.vehicle,
      cell: ({ project, zone }) => (
        <>
          <strong>{project.vehicle}</strong>
          <div className="vehicle-meta">
            {project.id} · {zone.code}
          </div>
        </>
      ),
    },
    {
      id: 'workflow',
      header: 'Follow-up status',
      width: 180,
      sortValue: ({ project, zone }) =>
        shapeWorkflowLabel(
          zone,
          snapshots.get(project.id)?.designs,
          snapshots.get(project.id)?.visits,
        ),
      cell: ({ project, zone }) => (
        <>
          {shapeWorkflowLabel(
            zone,
            snapshots.get(project.id)?.designs,
            snapshots.get(project.id)?.visits,
          )}
        </>
      ),
    },
    {
      id: 'handoff',
      header: 'Handoff',
      width: 180,
      sortValue: ({ zone }) => zone.productionHandoff?.completedAt,
      cell: ({ zone }) => (
        <>
          {zone.productionHandoff?.completedAt.slice(0, 10) ??
            'Needs verification'}
        </>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 180,
      hideable: false,
      cell: ({ project, zone }) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              openReview(project.id, zone.id);
            }}
          >
            Open review
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...listed],
    columns: columns.map((column) => ({
      id: column.id,
      accessorFn: column.sortValue,
      sortUndefined: 'last',
    })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = gridTable.getRowModel().rows.map((row) => row.original);
  const activeSort = gridTable.getState().sorting.slice(0, 1).pop();
  const {
    pageItems: pagedRows,
    pagination,
    setPagination,
  } = useWorkbenchPagination(
    sortedRows,
    `${String(showAll)}|${normalizedQuery}`,
  );

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
      <FlatDataGrid
        embedded
        label="Shape review"
        columns={columns}
        rows={pagedRows}
        getRowId={({ zone }) => zone.id}
        emptyMessage="No items awaiting review or issuance. Review new development projects after fitting and quality verification."

        pagination={{
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalCount: listed.length,
          pageSizeOptions: [5, 10, 25],
          onPageChange: (page) => {
            setPagination((current) => ({ ...current, pageIndex: page - 1 }));
          },
          onPageSizeChange: (pageSize) => {
            setPagination({ pageIndex: 0, pageSize });
          },
        }}
        sorting={{
          mode: 'manual',
          value: activeSort
            ? { id: activeSort.id, direction: activeSort.desc ? 'desc' : 'asc' }
            : null,
          onChange: (sort) => {
            gridTable.setSorting(
              sort ? [{ id: sort.id, desc: sort.direction === 'desc' }] : [],
            );
          },
        }}
      />

      <DetailSheet
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
        title={
          selected
            ? `${selected.project.vehicle} · ${selected.zone.code}`
            : 'Shape review'
        }
        description="Shape review details for the selected zone project"
        size="lg"
        className="w-[min(1120px,96vw)] sm:max-w-none"
      >
        {selected && (
          <div className="shape-management space-y-5">
            <Link
              to={`/vehicle-projects?project=${encodeURIComponent(selected.project.id)}&zone=${encodeURIComponent(selected.zone.code)}`}
            >
              Open original project / Materials / Rework →
            </Link>
            {detail ? (
              <ProjectShapePanel
                key={selected.zone.id}
                zone={selected.zone}
                designs={detail.designs}
                visits={detail.visits}
                onOpenTab={(tab) => {
                  // React Router handles route errors; the click does not await navigation.
                  void navigate(
                    `/vehicle-projects?project=${encodeURIComponent(selected.project.id)}&zone=${encodeURIComponent(selected.zone.code)}&tab=${tab}`,
                  );
                }}
                onReview={(review) => {
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
                              ? 'Shape review verbally approved'
                              : `Shape rejected · ${review.rejectionType === 'PATTERN' ? 'Pattern rework' : 'Document corrections'}`,
                          detail: `${selected.zone.code} · ${review.reviewedBy} · ${review.note}`,
                        },
                        ...next.activity,
                      ],
                    };
                  });
                }}
                onLink={(id) => {
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
                        title: 'Shape linked',
                        detail: `${selected.zone.code} · ${id ?? 'Unlink'}`,
                      },
                      ...current.activity,
                    ],
                  }));
                }}
              />
            ) : (
              <p>
                No handoff materials in this legacy record. Record handoff
                completion in the original project.
              </p>
            )}
          </div>
        )}
      </DetailSheet>
    </>
  );
}
