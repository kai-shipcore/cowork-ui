import { useEffect, useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { History, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { fileFingerprint } from '@/shared/domain/revision-control';
import { PageHeader } from '@/shared/components/page-header';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import type { ProjectDesignDetails } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  importProjectParts,
  saveLibraryPart,
  usePartLibrary,
  type LibraryPart,
} from './part-library';
import './parts.css';

type SeatPosition = 'PASSENGER' | 'CENTER' | 'DRIVER';

const SEAT_POSITIONS: readonly SeatPosition[] = [
  'PASSENGER',
  'CENTER',
  'DRIVER',
];
const SEAT_POSITION_LABELS: Record<SeatPosition, string> = {
  PASSENGER: '조수석',
  CENTER: '중앙',
  DRIVER: '운전석',
};
const SEAT_POSITION_LETTERS: Partial<Record<SeatPosition, string>> = {
  PASSENGER: 'P',
  DRIVER: 'D',
};

interface SeatPiece {
  /** `seat_cover_part.category` value this piece filters by. */
  category: string;
  label: string;
  /** Label for the center seat, when it differs (backrest doubles as console). */
  centerLabel?: string;
  /** Armrest and leg support exist only on the driver / passenger seats. */
  sideOnly?: boolean;
}

function latestRevision(part: LibraryPart) {
  return part.revisions[part.revisions.length - 1];
}

const SEAT_PIECES: readonly SeatPiece[] = [
  { category: 'HEADREST', label: '헤드' },
  { category: 'TOP', label: '등받이', centerLabel: '등받이/콘솔' },
  { category: 'ARM', label: '팔걸이', sideOnly: true },
  { category: 'BOTTOM', label: '방석' },
  { category: 'LEG', label: '다리 지지대', sideOnly: true },
];

export function PartsPage() {
  const {
    seatCoverParts,
    seatCoverCodes,
    projectDetails,
    projects,
    vehicleZones,
  } = useWorkbenchStore();
  const parts = usePartLibrary();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(
    !params.has('part') && params.get('view') === 'create' ? 'create' : 'list',
  );
  const [row, setRow] = useState(params.get('zone') ?? 'F');
  const [category, setCategory] = useState('');
  const [partType, setPartType] = useState('');
  const [custom, setCustom] = useState(true);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [initial, setInitial] = useState('');
  const [code, setCode] = useState('');
  const [side, setSide] = useState<
    'DRIVER' | 'PASSENGER' | 'CENTER' | 'UNIVERSAL'
  >('DRIVER');
  const [note, setNote] = useState('');
  const [dxfFileName, setDxfFileName] = useState('');
  const [dxfFingerprint, setDxfFingerprint] = useState('');
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('ALL');
  const [selected, setSelected] = useState(params.get('part') ?? '');
  const [message, setMessage] = useState('');
  useEffect(() => {
    for (const project of projects)
      importProjectParts(
        projectDetails[project.id]?.designs ?? [],
        project.product,
      );
  }, [projects, projectDetails]);
  const types = seatCoverParts.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      vehicleZones.some(
        (zone) => zone.id === p.vehicleZoneId && zone.code === row,
      ) &&
      (!category || p.category === category) &&
      p.isCustom === custom,
  );
  const chosen = types.find((p) => p.id === partType);
  const clean = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  const prefix = chosen?.name ?? '';
  const name = [
    prefix,
    custom ? clean(make) : 'UNIVERSAL',
    custom ? clean(model) : '',
    code,
    clean(initial),
    side[0],
  ]
    .filter(Boolean)
    .join('-');
  const duplicate = parts.some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  const valid = Boolean(
    prefix &&
    clean(initial) &&
    (!custom || (clean(make) && clean(model))) &&
    code &&
    dxfFileName &&
    dxfFingerprint,
  );
  const active =
    parts.find((p) => p.id === selected) ??
    parts.find((p) => p.name === params.get('name'));
  const products = [...new Set(parts.map((p) => p.product))].sort();
  const normalizedSearch = search.trim().toLowerCase();
  const visibleParts = parts
    .filter(
      (p) =>
        (product === 'ALL' || p.product === product) &&
        (!normalizedSearch ||
          `${p.name} ${p.product} ${p.type}`
            .toLowerCase()
            .includes(normalizedSearch)),
    )
    .sort((left, right) =>
      (latestRevision(right)?.createdAt ?? '').localeCompare(
        latestRevision(left)?.createdAt ?? '',
      ),
    );
  const {
    pageItems: pagedParts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleParts, `${search}|${product}`);
  const returnTo = params.get('returnTo');
  const safeReturn = returnTo?.startsWith('/vehicle-projects?')
    ? returnTo
    : undefined;
  function create() {
    if (!valid || duplicate) return;
    const details: ProjectDesignDetails = {
      kind: 'SEAT_COVER',
      vehicleResearchId: '',
      seatCoverPartId: chosen!.id,
      seatCoverCodeId: seatCoverCodes.find((c) => c.code === code)!.id,
      partName: chosen!.name,
      category: chosen!.category,
      side,
      isForMiddleSeat: side === 'CENTER',
      isCustom: custom,
      designedBy: CURRENT_USER_ID,
    };
    const id = crypto.randomUUID();
    try {
      saveLibraryPart({
        id,
        name,
        product: 'Seat Cover',
        type: chosen!.category,
        details,
        revisions: [
          {
            id: crypto.randomUUID(),
            revisionNumber: 1,
            note: note.trim() || 'Initial version',
            createdAt: new Date().toISOString(),
            createdBy: CURRENT_USER_ID,
            dxfFileName,
            dxfFingerprint,
          },
        ],
      });
      if (safeReturn) {
        navigate(`${safeReturn}&linkPart=${id}`);
        return;
      }
      setSelected(id);
      setTab('list');
      setMessage('Part를 생성했습니다.');
      setNote('');
      setDxfFileName('');
      setDxfFingerprint('');
    } catch (error) {
      setMessage(String(error));
    }
  }
  return (
    <section className="parts-workspace">
      <PageHeader
        description="부품 라이브러리 · Name Generator · Version History"
        actions={
          safeReturn ? (
            <Button variant="outline" onClick={() => navigate(safeReturn)}>
              프로젝트로 돌아가기
            </Button>
          ) : undefined
        }
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_product_design' },
                { name: 'vehicle_product_design_revision' },
                { name: 'seat_cover_design' },
                { name: 'seat_cover_part' },
                { name: 'seat_cover_code' },
                { name: 'vehicle_zone' },
              ]
            : undefined
        }
      />
      <div className="segment-filters" role="group" aria-label="Parts 보기">
        <Button
          size="sm"
          variant={tab === 'list' ? 'mono' : 'outline'}
          onClick={() => setTab('list')}
        >
          목록 · {parts.length}
        </Button>
        <Button
          size="sm"
          variant={tab === 'create' ? 'mono' : 'outline'}
          onClick={() => setTab('create')}
        >
          생성기
        </Button>
      </div>
      {message && (
        <p className="detail-help-text" role="status">
          {message}
        </p>
      )}
      {tab === 'create' ? (
        <div className="parts-generator">
          <div className="parts-diagram-panel">
            <div className="parts-tabs">
              {[
                ['F', '1열 (Front)'],
                ['B', '2열 (Rear)'],
                ['E', '3열 (Third Row)'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={row === value}
                  onClick={() => setRow(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <h2>부위 선택</h2>
            <>
              <div className="seat-diagram">
                {SEAT_POSITIONS.map((position) => {
                  const letter = SEAT_POSITION_LETTERS[position];
                  return (
                    <div
                      className={`seat seat-${position.toLowerCase()}`}
                      key={position}
                    >
                      {SEAT_PIECES.filter(
                        (piece) => !piece.sideOnly || position !== 'CENTER',
                      ).map((piece) => {
                        const label =
                          position === 'CENTER'
                            ? (piece.centerLabel ?? piece.label)
                            : piece.label;
                        return (
                          <button
                            key={piece.category}
                            type="button"
                            className={`seat-piece seat-${piece.category.toLowerCase()}`}
                            aria-label={`${SEAT_POSITION_LABELS[position]} ${label}`}
                            aria-pressed={
                              side === position && category === piece.category
                            }
                            onClick={() => {
                              setSide(position);
                              setCategory(piece.category);
                              setPartType('');
                            }}
                          >
                            {piece.category === 'HEADREST' && letter ? (
                              <>
                                <b>{letter}</b>
                                <small>{label}</small>
                              </>
                            ) : (
                              label
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <p>부위를 선택한 뒤 오른쪽에서 Part Type을 선택하세요.</p>
              <button
                onClick={() => {
                  setCategory('');
                  setPartType('');
                }}
              >
                부위 필터 해제
              </button>
            </>
            <p className="parts-hint">
              공용 Part를 생성한 후 각 프로젝트에서 버전과 수량을 선택해
              연결합니다.
            </p>
          </div>
          <form
            className="parts-form"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div className="parts-tabs">
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => {
                  setCustom(true);
                  setPartType('');
                }}
              >
                커스텀
              </button>
              <button
                type="button"
                aria-pressed={!custom}
                onClick={() => {
                  setCustom(false);
                  setPartType('');
                }}
              >
                유니버설
              </button>
            </div>
            <>
              <label>
                Part Type
                <select
                  required
                  value={partType}
                  onChange={(e) => setPartType(e.target.value)}
                >
                  <option value="">Part 선택</option>
                  {types.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.category}
                    </option>
                  ))}
                </select>
              </label>
              {types.length === 0 && (
                <p>
                  조건에 맞는 Part Type이 없습니다. 부위 필터를 해제하거나
                  Reference Data에서 등록하세요.
                </p>
              )}
            </>
            {custom && (
              <>
                <label>
                  Make Abbreviation
                  <input
                    required
                    value={make}
                    placeholder="AC"
                    onChange={(e) => setMake(e.target.value)}
                  />
                </label>
                <label>
                  Model Abbreviation
                  <input
                    required
                    value={model}
                    placeholder="MX"
                    onChange={(e) => setModel(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              Initial
              <input
                required
                value={initial}
                placeholder="W"
                onChange={(e) => setInitial(e.target.value)}
              />
            </label>
            <>
              <label>
                Code
                <select
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                >
                  <option value="">Code 선택</option>
                  {seatCoverCodes
                    .filter((c) => c.status === 'ACTIVE')
                    .map((c) => (
                      <option key={c.id}>{c.code}</option>
                    ))}
                </select>
              </label>
              <label>
                Side
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as typeof side)}
                >
                  {['DRIVER', 'PASSENGER', 'CENTER', 'UNIVERSAL'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </>
            <label>
              Version note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label>
              초기 DXF 파일
              <input
                required
                type="file"
                accept=".dxf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    setDxfFileName('');
                    setDxfFingerprint('');
                    return;
                  }
                  setDxfFileName(file.name);
                  void fileFingerprint(file).then(setDxfFingerprint);
                }}
              />
            </label>
            <label>
              Part Name 미리보기
              <output className="part-name-preview">
                {name || '필수 항목을 선택하세요'}
              </output>
            </label>
            <p role="status">
              {duplicate
                ? '동일한 Part Name이 있습니다. 기존 Part를 사용하세요.'
                : valid
                  ? '중복 없음 · 생성 가능'
                  : '필수 항목을 입력하세요.'}
            </p>
            <button className="parts-primary" disabled={!valid || duplicate}>
              {safeReturn ? '생성 후 프로젝트에서 연결' : '+ Part 생성'}
            </button>
          </form>
        </div>
      ) : (
        <div className="parts-list">
          <div className="workbench-filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                aria-label="Part 이름, 제품군, Part Type 검색"
                placeholder="Part 이름 / 제품군 / Part Type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger
                aria-label="제품군 필터"
                className="filter-select wide"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Product: All</SelectItem>
                {products.map((item) => (
                  <SelectItem value={item} key={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || product !== 'ALL') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setProduct('ALL');
                }}
              >
                <X /> 필터 초기화
              </Button>
            )}
            <span className="filter-count">
              {visibleParts.length} / {parts.length} Parts
            </span>
          </div>
          {visibleParts.length ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Part Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedParts.map((p) => {
                    const latest = latestRevision(p);
                    const isSelected = active?.id === p.id;
                    return (
                      <TableRow
                        key={p.id}
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <TableCell>
                          <code className="part-name">{p.name}</code>
                        </TableCell>
                        <TableCell>{p.product}</TableCell>
                        <TableCell>{p.type}</TableCell>
                        <TableCell>
                          <strong>v{latest?.revisionNumber ?? 1}</strong>
                          <div className="vehicle-meta">
                            {p.revisions.length} revisions
                          </div>
                        </TableCell>
                        <TableCell>
                          {latest ? latest.createdAt.slice(0, 10) : '—'}
                          <div className="vehicle-meta">
                            {latest?.createdBy}
                          </div>
                        </TableCell>
                        <TableCell className="table-actions">
                          <Button
                            size="sm"
                            variant={isSelected ? 'mono' : 'outline'}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelected(p.id);
                              setNote('');
                            }}
                          >
                            <History /> Version History
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <WorkbenchPagination
                recordCount={visibleParts.length}
                pagination={pagination}
                onPaginationChange={setPagination}
                itemLabel="parts"
              />
            </Card>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🧩</div>
              <strong>
                {parts.length
                  ? '조건에 맞는 Part가 없습니다.'
                  : '등록된 Part가 없습니다.'}
              </strong>
              <p>
                {parts.length
                  ? '검색어나 제품군 필터를 바꿔 보세요.'
                  : '생성기에서 첫 Part를 추가하세요.'}
              </p>
            </div>
          )}
          {active && (
            <Card className="detail-panel part-history-panel">
              <CardHeader>
                <CardTitle>
                  <code className="part-name">{active.name}</code>
                  <small>Version History · {active.revisions.length}</small>
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Version History 닫기"
                  onClick={() => setSelected('')}
                >
                  <X />
                </Button>
              </CardHeader>
              <CardContent>
                {[...active.revisions].reverse().map((r) => (
                  <article className="part-version" key={r.id}>
                    <strong>v{r.revisionNumber}</strong>
                    <p>{r.note}</p>
                    {r.changeRequest && (
                      <dl className="part-revision-change">
                        <div>
                          <dt>문제 출처</dt>
                          <dd>{r.changeRequest.issueSource}</dd>
                        </div>
                        <div>
                          <dt>문제 부위</dt>
                          <dd>{r.changeRequest.issueArea}</dd>
                        </div>
                        <div>
                          <dt>수정 지시</dt>
                          <dd>{r.changeRequest.instruction}</dd>
                        </div>
                        <div>
                          <dt>참고 이미지</dt>
                          <dd>{r.changeRequest.referenceImageName}</dd>
                        </div>
                        <div>
                          <dt>DXF</dt>
                          <dd>
                            {r.changeRequest.previousDxfFileName} →{' '}
                            {r.changeRequest.newDxfFileName}
                          </dd>
                        </div>
                      </dl>
                    )}
                    {r.executionVerifications?.map((verification) => (
                      <div
                        className="part-revision-verification"
                        key={verification.sampleRequestItemId}
                      >
                        <strong>
                          {verification.verdict === 'CORRECT'
                            ? '정확히 반영'
                            : verification.verdict === 'PARTIAL'
                              ? '일부 반영'
                              : '전혀 미반영'}
                        </strong>
                        <span>{verification.note}</span>
                        <small>
                          {new Date(verification.verifiedAt).toLocaleString()} ·{' '}
                          {verification.verifiedBy}
                        </small>
                      </div>
                    ))}
                    <small>
                      {new Date(r.createdAt).toLocaleString()} · {r.createdBy}
                    </small>
                  </article>
                ))}
                <p className="detail-help-text">
                  새 Revision과 수정 요청은 프로젝트 상세의 Revision Control에서
                  생성합니다. 검증 결과는 이 이력에 자동으로 연결됩니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
