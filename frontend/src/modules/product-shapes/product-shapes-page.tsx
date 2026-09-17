import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { Switch } from '@coverland-engineering/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { ClipboardCheck, Search, Shapes } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
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

const SHAPE_VIEWS = [
  { value: 'review', label: '검토·발급 대기', icon: ClipboardCheck },
  { value: 'issued', label: '개발·확정 Shape', icon: Shapes },
] as const;

export function ProductShapesPage() {
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    projects,
    projectDetails,
  } = useWorkbenchStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view =
    params.get('view') ?? (params.get('shape') ? 'issued' : 'review');
  const [showAll, setShowAll] = useState(false);
  const [reviewQuery, setReviewQuery] = useState('');
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
        description="Shape — 개발 Shape 생성부터 품질 검토·확정까지 관리합니다. 판매 차량 적용은 F#에서 별도로 기록합니다."
        tables={[
          { name: 'vehicle_product_shape' },
          { name: 'vehicle_product_shape_dimension' },
          { name: 'vehicle_project' },
        ]}
      />
      <Card>
        <div className="grid-tabs-row">
          <div className="stage-tabs" role="group" aria-label="Shape 보기">
            {SHAPE_VIEWS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className="stage-tab"
                aria-pressed={view === value}
                onClick={() => setParams({ view: value })}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-toolbar">
          <div className="grid-toolbar-filters">
            {view === 'review' ? (
              <>
                <div className="search-field">
                  <Search aria-hidden="true" />
                  <Input
                    aria-label="Make 또는 Model 검색"
                    placeholder="Make / Model 검색"
                    value={reviewQuery}
                    onChange={(event) => setReviewQuery(event.target.value)}
                  />
                </div>
                <label className="collapse-all-toggle">
                  <Switch
                    size="sm"
                    checked={showAll}
                    onCheckedChange={setShowAll}
                  />
                  완료 항목과 검토 이력도 표시
                </label>
              </>
            ) : (
              <>
                <div className="search-field">
                  <Search aria-hidden="true" />
                  <Input
                    aria-label="Shape 검색"
                    placeholder="Shape 번호 또는 ID 검색"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger
                    aria-label="제품 유형 필터"
                    className="filter-select wide"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 제품 유형</SelectItem>
                    {PRODUCT_TYPES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger
                    aria-label="Shape 상태 필터"
                    className="filter-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 상태</SelectItem>
                    {Object.entries(SHAPE_STATUSES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="grid-toolbar-actions">
            <Button
              variant="outline"
              onClick={() => navigate('/vehicle-projects')}
            >
              개발 프로젝트
            </Button>
          </div>
        </div>
        {view === 'review' ? (
          <ShapeReviewWorkspace showAll={showAll} query={reviewQuery} />
        ) : (
          <>
            <div className="shape-info">
              <strong>개발·확정 Shape · 구성 등록</strong>
              <p>
                개발 Shape → 피팅·품질 검토 → Shape 확정 → Handoff · Part
                구성·Blueprint 등록
              </p>
              <p>
                Shape가 같으면 여러 차량 프로젝트가 같은 Shape를 참조합니다.
                Part 구성·수정 버전과 피팅 결과는 각 프로젝트에서 관리합니다.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shape</TableHead>
                  <TableHead>제품 유형</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>치수</TableHead>
                  <TableHead>구성 등록</TableHead>
                  <TableHead>적용 프로젝트</TableHead>
                  <TableHead className="action-column" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedShapes.map((shape) => {
                  const usage = shapeUsage(shape.id, projects);
                  return (
                    <TableRow key={shape.id}>
                      <TableCell>
                        <strong>{shape.name}</strong>
                        <div className="vehicle-meta">{shape.id}</div>
                      </TableCell>
                      <TableCell>
                        {PRODUCT_TYPES.find(
                          (item) => item.id === shape.productTypeId,
                        )?.product ?? shape.productTypeId}
                      </TableCell>
                      <TableCell>{SHAPE_STATUSES[shape.status]}</TableCell>
                      <TableCell>{dimensionsLabel(shape.dimensions)}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="table-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(shape)}
                        >
                          수정
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      검색 조건에 맞는 Shape가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <WorkbenchPagination
              recordCount={filtered.length}
              pagination={pagination}
              onPaginationChange={setPagination}
            />
          </>
        )}
      </Card>
      {compositionId && shapes.find((shape) => shape.id === compositionId) && (
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
    </section>
  );
}
