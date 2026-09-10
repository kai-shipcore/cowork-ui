import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/shared/components/page-header';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import {
  PRODUCT_TYPES,
  type VehicleProductShape,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ShapeCompositionEditor } from './shape-composition-editor';
import { ShapeEditor } from './shape-editor';
import {
  compositionIsCurrent,
  dimensionsLabel,
  SHAPE_STATUSES,
  shapeUsage,
} from './shape-model';
import { ShapeReviewWorkspace } from './shape-review-workspace';
import './shape-management.css';

export function ProductShapesPage() {
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    projects,
    projectDetails,
  } = useWorkbenchStore();
  const [params, setParams] = useSearchParams();
  const view =
    params.get('view') ?? (params.get('shape') ? 'issued' : 'review');
  const [query, setQuery] = useState(params.get('shape') ?? '');
  const [product, setProduct] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [editing, setEditing] = useState<VehicleProductShape | 'NEW'>();
  const [expanded, setExpanded] = useState<string>();
  const [compositionId, setCompositionId] = useState<string | undefined>(
    params.get('shape') ?? undefined,
  );
  const filtered = shapes.filter(
    (shape) =>
      (product === 'ALL' || shape.productTypeId === product) &&
      (status === 'ALL' || shape.status === status) &&
      `${shape.name} ${shape.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const {
    pageItems: pagedShapes,
    pagination,
    setPagination,
  } = useWorkbenchPagination(filtered, `${view}|${query}|${product}|${status}`);
  return (
    <section className="shape-management">
      <PageHeader
        description="Shape — 검토·승인 후 확정한 최종 Shape와 적용 프로젝트를 관리합니다."
        tables={[
          { name: 'vehicle_product_shape' },
          { name: 'vehicle_product_shape_dimension' },
          { name: 'vehicle_project' },
        ]}
        actions={
          <>
            <Link to="/vehicle-projects">개발 프로젝트 →</Link>
          </>
        }
      />
      <div className="shape-actions">
        <Button
          variant={view === 'review' ? 'primary' : 'outline'}
          onClick={() => setParams({ view: 'review' })}
        >
          검토·발급 대기
        </Button>
        <Button
          variant={view === 'issued' ? 'primary' : 'outline'}
          onClick={() => setParams({ view: 'issued' })}
        >
          발급된 Shape
        </Button>
      </div>
      {view === 'review' ? (
        <ShapeReviewWorkspace />
      ) : (
        <>
          <div className="shape-info">
            <strong>발급된 Shape · 구성 등록</strong>
            <p>
              프로젝트 Handoff → 검토·승인 → Shape 발급 → Part 구성·Blueprint
              등록
            </p>
            <p>
              Shape가 같으면 여러 차량 프로젝트가 같은 Shape를 참조합니다. Part
              구성·수정 버전과 피팅 결과는 각 프로젝트에서 관리합니다.
            </p>
          </div>
          <div className="shape-filters">
            <Input
              aria-label="Shape 검색"
              placeholder="Shape 번호 또는 ID 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="제품 유형 필터"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
            >
              <option value="ALL">전체 제품 유형</option>
              {PRODUCT_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.product}
                </option>
              ))}
            </select>
            <select
              aria-label="Shape 상태 필터"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">전체 상태</option>
              {Object.entries(SHAPE_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span>{filtered.length}개</span>
          </div>
          <div className="shape-table-scroll">
            <table className="shape-table">
              <thead>
                <tr>
                  <th>Shape</th>
                  <th>제품 유형</th>
                  <th>상태</th>
                  <th>치수</th>
                  <th>구성 등록</th>
                  <th>적용 프로젝트</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {pagedShapes.map((shape) => {
                  const usage = shapeUsage(shape.id, projects);
                  return (
                    <tr key={shape.id}>
                      <td>
                        <strong>{shape.name}</strong>
                        <small>{shape.id}</small>
                      </td>
                      <td>
                        {PRODUCT_TYPES.find(
                          (item) => item.id === shape.productTypeId,
                        )?.product ?? shape.productTypeId}
                      </td>
                      <td>{SHAPE_STATUSES[shape.status]}</td>
                      <td>{dimensionsLabel(shape.dimensions)}</td>
                      <td>
                        {compositionIsCurrent(shape, projectDetails)
                          ? '구성 등록 완료'
                          : shape.composition?.status === 'COMPLETE'
                            ? '원본 변경 · 재확인 필요'
                            : shape.composition
                              ? '작성 중'
                              : '구성 등록 대기'}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCompositionId(shape.id)}
                        >
                          Part / Blueprint
                        </Button>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setExpanded(
                              expanded === shape.id ? undefined : shape.id,
                            )
                          }
                          aria-expanded={expanded === shape.id}
                        >
                          {usage.length}개 · 보기
                        </Button>
                        {expanded === shape.id && (
                          <div className="shape-usage">
                            {usage.length ? (
                              usage.map(({ project, zone }) => (
                                <Link
                                  key={zone.id}
                                  to={`/vehicle-projects?project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(zone.code)}&tab=overview`}
                                >
                                  {project.vehicle} · {zone.code} ·{' '}
                                  {zone.currentStage}
                                </Link>
                              ))
                            ) : (
                              <span>연결된 프로젝트가 없습니다.</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(shape)}
                        >
                          수정
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7}>검색 조건에 맞는 Shape가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <WorkbenchPagination
            recordCount={filtered.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            itemLabel="shapes"
          />
          {compositionId &&
            shapes.find((shape) => shape.id === compositionId) && (
              <ShapeCompositionEditor
                key={compositionId}
                shape={shapes.find((shape) => shape.id === compositionId)!}
                onClose={() => setCompositionId(undefined)}
              />
            )}
          {editing && (
            <ShapeEditor
              key={editing === 'NEW' ? 'NEW' : editing.id}
              shape={editing === 'NEW' ? undefined : editing}
              shapes={shapes}
              usageCount={
                editing === 'NEW' ? 0 : shapeUsage(editing.id, projects).length
              }
              onClose={() => setEditing(undefined)}
              onSave={(shape) => {
                setVehicleProductShapes((current) => [
                  ...current.filter((item) => item.id !== shape.id),
                  shape,
                ]);
                setEditing(undefined);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
