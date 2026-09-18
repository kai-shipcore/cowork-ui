import { useEffect, useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
  type GridSort,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@coverland-engineering/ui/sheet';
import {
  CalendarClock,
  CheckCircle2,
  FileClock,
  FileImage,
  History,
  Link2,
  Plus,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { fileFingerprint } from '@/shared/domain/revision-control';
import { PageHeader } from '@/shared/components/page-header';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { ProjectDesignDetails } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  importProjectParts,
  saveLibraryPart,
  usePartLibrary,
  type LibraryPart,
} from './part-library';
import { latestPartRevision, partsGridRows } from './parts-grid-model';
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
  const [createOpen, setCreateOpen] = useState(
    !params.has('part') && params.get('view') === 'create',
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
  const [sort, setSort] = useState<GridSort | null>(null);
  const [selected, setSelected] = useState(params.get('part') ?? '');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const snapshots = new Map(Object.entries(projectDetails));
    for (const project of projects)
      importProjectParts(
        snapshots.get(project.id)?.designs ?? [],
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
  const visibleParts = partsGridRows(parts, search, sort);
  const {
    pageItems: pagedParts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visibleParts, search);
  const returnTo = params.get('returnTo');
  const safeReturn = returnTo?.startsWith('/vehicle-projects?')
    ? returnTo
    : undefined;
  const columns: FlatDataGridColumn<LibraryPart>[] = [
    {
      id: 'name',
      header: 'Part Name',
      width: 320,
      sortValue: (part) => part.name,
      cell: (part) => <code className="part-name">{part.name}</code>,
    },
    {
      id: 'type',
      header: 'Part Type',
      width: 150,
      sortValue: (part) => part.type,
      cell: (part) => part.type,
    },
    {
      id: 'version',
      header: 'Version',
      width: 130,
      sortValue: (part) => latestPartRevision(part)?.revisionNumber ?? 1,
      cell: (part) => (
        <>
          <strong>v{latestPartRevision(part)?.revisionNumber ?? 1}</strong>
          <div className="vehicle-meta">{part.revisions.length} revisions</div>
        </>
      ),
    },
    {
      id: 'updated',
      header: 'Last Updated',
      width: 170,
      sortValue: (part) => latestPartRevision(part)?.createdAt,
      cell: (part) => (
        <>
          {latestPartRevision(part)?.createdAt.slice(0, 10) ?? '—'}
          <div className="vehicle-meta">
            {latestPartRevision(part)?.createdBy}
          </div>
        </>
      ),
    },
    {
      id: 'history',
      header: 'Actions',
      width: 185,
      hideable: false,
      cell: (part) => (
        <Button
          size="sm"
          variant={active?.id === part.id ? 'mono' : 'outline'}
          aria-pressed={active?.id === part.id}
          onClick={() => {
            setSelected(part.id);
            setNote('');
          }}
        >
          <History /> Version History
        </Button>
      ),
    },
  ];
  function create() {
    const selectedCode = seatCoverCodes.find((c) => c.code === code);
    if (!valid || duplicate || !chosen || !selectedCode) return;
    const details: ProjectDesignDetails = {
      kind: 'SEAT_COVER',
      vehicleResearchId: '',
      seatCoverPartId: chosen.id,
      seatCoverCodeId: selectedCode.id,
      partName: chosen.name,
      category: chosen.category,
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
        type: chosen.category,
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
        void navigate(`${safeReturn}&linkPart=${id}`);
        return;
      }
      setSelected(id);
      setCreateOpen(false);
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
      {message && (
        <p className="detail-help-text" role="status">
          {message}
        </p>
      )}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="parts-create-sheet w-[min(1120px,96vw)] sm:max-w-none p-0 gap-0"
          accessibleTitle="Part 생성"
          accessibleDescription="공용 Part를 생성합니다."
        >
          <SheetHeader className="workbench-sheet-header">
            <div className="parts-sheet-heading">
              <span className="parts-sheet-icon" aria-hidden="true">
                <Plus />
              </span>
              <div>
                <SheetTitle>새 Part 생성</SheetTitle>
                <p>부위와 사양을 선택해 공용 Part와 첫 버전을 등록합니다.</p>
              </div>
            </div>
          </SheetHeader>
          <SheetBody className="workbench-sheet-body">
            <div className="parts-generator">
              <div className="parts-diagram-panel">
                <div className="parts-section-heading">
                  <span>01</span>
                  <div>
                    <h2>시트 부위 선택</h2>
                    <p>열과 부위를 선택하면 등록 가능한 Part가 필터링됩니다.</p>
                  </div>
                </div>
                <div className="parts-tabs">
                  {[
                    ['F', '1열 (Front)'],
                    ['B', '2열 (Rear)'],
                    ['E', '3열 (Third Row)'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={row === value}
                      onClick={() => {
                        setRow(value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
                <div className="parts-selection-guide">
                  <div>
                    <strong>원하는 부위를 선택하세요</strong>
                    <p>선택한 조건에 맞는 Part Type만 오른쪽에 표시됩니다.</p>
                  </div>
                  <button
                    type="button"
                    className="parts-reset-filter"
                    disabled={!category}
                    onClick={() => {
                      setCategory('');
                      setPartType('');
                    }}
                  >
                    <RotateCcw aria-hidden="true" />
                    부위 필터 해제
                  </button>
                </div>
                <div className="parts-workflow-note">
                  <span aria-hidden="true">
                    <Link2 />
                  </span>
                  <p>
                    생성한 공용 Part는 각 프로젝트에서 필요한{' '}
                    <strong>버전과 수량</strong>을 선택해 연결할 수 있습니다.
                  </p>
                </div>
              </div>
              <form
                id="part-create-form"
                className="parts-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  create();
                }}
              >
                <div className="parts-section-heading">
                  <span>02</span>
                  <div>
                    <h2>Part 정보</h2>
                    <p>식별 정보와 초기 버전 파일을 입력하세요.</p>
                  </div>
                </div>
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
                      onChange={(e) => {
                        setPartType(e.target.value);
                      }}
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
                        onChange={(e) => {
                          setMake(e.target.value);
                        }}
                      />
                    </label>
                    <label>
                      Model Abbreviation
                      <input
                        required
                        value={model}
                        placeholder="MX"
                        onChange={(e) => {
                          setModel(e.target.value);
                        }}
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
                    onChange={(e) => {
                      setInitial(e.target.value);
                    }}
                  />
                </label>
                <>
                  <label>
                    Code
                    <select
                      required
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                      }}
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
                      onChange={(e) => {
                        setSide(e.target.value as typeof side);
                      }}
                    >
                      {['DRIVER', 'PASSENGER', 'CENTER', 'UNIVERSAL'].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                </>
                <label>
                  Version note
                  <textarea
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                    }}
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
              </form>
            </div>
          </SheetBody>
          <SheetFooter className="workbench-sheet-footer">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="parts-primary-action"
              type="submit"
              form="part-create-form"
              disabled={!valid || duplicate}
            >
              {safeReturn ? '생성 후 프로젝트에서 연결' : 'Part 생성'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <div className="parts-list">
        <FlatDataGrid
          label="Parts"
          columns={columns}
          rows={pagedParts}
          getRowId={(part) => part.id}
          sorting={{ value: sort, onChange: setSort, mode: 'manual' }}
          search={{
            label: 'Part 이름 또는 Part Type 검색',
            placeholder: 'Part 이름 / Part Type',
            value: search,
            onChange: setSearch,
          }}
          colors={{
            primary: '#2F80FF',
            primaryForeground: '#FFFFFF',
            primarySoft: '#EFF6FF',
          }}
          actions={
            <>
              {safeReturn && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // React Router handles route errors; the click does not await navigation.
                    void navigate(safeReturn);
                  }}
                >
                  프로젝트로 돌아가기
                </Button>
              )}
              <Button
                variant="primary"
                className="parts-primary-action"
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                <Plus /> Part 생성
              </Button>
            </>
          }
          emptyMessage={
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
                  : 'Part 생성 버튼으로 첫 Part를 추가하세요.'}
              </p>
            </div>
          }
          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: visibleParts.length,
            pageSizeOptions: [5, 10, 25],
            onPageChange: (page) => {
              setPagination((current) => ({ ...current, pageIndex: page - 1 }));
            },
            onPageSizeChange: (pageSize) => {
              setPagination({ pageIndex: 0, pageSize });
            },
          }}
        />
        <Sheet
          open={Boolean(active)}
          onOpenChange={(open) => {
            if (!open) setSelected('');
          }}
        >
          {active && (
            <SheetContent
              side="right"
              className="part-history-sheet w-[min(620px,96vw)] sm:max-w-none p-0 gap-0"
              accessibleTitle={`${active.name} Version History`}
              accessibleDescription={`${String(active.revisions.length)}개의 버전 이력을 확인합니다.`}
            >
              <SheetHeader className="part-history-sheet-header">
                <div className="parts-sheet-heading">
                  <span className="parts-sheet-icon" aria-hidden="true">
                    <FileClock />
                  </span>
                  <div>
                    <SheetTitle>Version History</SheetTitle>
                    <code className="part-name">{active.name}</code>
                  </div>
                </div>
                <span className="part-history-count">
                  {active.revisions.length} revisions
                </span>
              </SheetHeader>
              <SheetBody className="part-history-sheet-body">
                <div className="part-history-timeline">
                  {[...active.revisions].reverse().map((r) => (
                    <article className="part-version" key={r.id}>
                      <div className="part-version-heading">
                        <span className="part-version-badge">
                          v{r.revisionNumber}
                        </span>
                        <div className="part-version-meta">
                          <span>
                            <CalendarClock aria-hidden="true" />
                            <time dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleString()}
                            </time>
                          </span>
                          <span>
                            <UserRound aria-hidden="true" />
                            {r.createdBy}
                          </span>
                        </div>
                      </div>
                      <div className="part-version-note">
                        <span>버전 메모</span>
                        <p>{r.note || '변경 메모 없음'}</p>
                      </div>
                      {r.changeRequest && (
                        <section className="part-revision-section">
                          <h3>변경 요청</h3>
                          <dl className="part-revision-change">
                            <div>
                              <dt>문제 출처</dt>
                              <dd>{r.changeRequest.issueSource || '—'}</dd>
                            </div>
                            <div>
                              <dt>문제 부위</dt>
                              <dd>{r.changeRequest.issueArea || '—'}</dd>
                            </div>
                            <div className="part-revision-wide">
                              <dt>수정 지시</dt>
                              <dd>{r.changeRequest.instruction || '—'}</dd>
                            </div>
                          </dl>
                          <div className="part-revision-files">
                            <div>
                              <FileImage aria-hidden="true" />
                              <span>참고 이미지</span>
                              <strong>
                                {r.changeRequest.referenceImageName || '없음'}
                              </strong>
                            </div>
                            <div>
                              <FileClock aria-hidden="true" />
                              <span>DXF 변경</span>
                              <strong>
                                {r.changeRequest.previousDxfFileName} →{' '}
                                {r.changeRequest.newDxfFileName}
                              </strong>
                            </div>
                          </div>
                        </section>
                      )}
                      {Boolean(r.executionVerifications?.length) && (
                        <section className="part-revision-section">
                          <h3>반영 검증</h3>
                          <div className="part-revision-verifications">
                            {r.executionVerifications?.map((verification) => (
                              <div
                                className="part-revision-verification"
                                data-verdict={verification.verdict}
                                key={verification.sampleRequestItemId}
                              >
                                <CheckCircle2 aria-hidden="true" />
                                <div>
                                  <strong>
                                    {verification.verdict === 'CORRECT'
                                      ? '정확히 반영'
                                      : verification.verdict === 'PARTIAL'
                                        ? '일부 반영'
                                        : '전혀 미반영'}
                                  </strong>
                                  <p>{verification.note || '검증 메모 없음'}</p>
                                  <small>
                                    {new Date(
                                      verification.verifiedAt,
                                    ).toLocaleString()}{' '}
                                    · {verification.verifiedBy}
                                  </small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </article>
                  ))}
                </div>
              </SheetBody>
              <SheetFooter className="part-history-sheet-footer">
                <p>
                  새 Revision과 수정 요청은 프로젝트 상세의 Revision Control에서
                  생성합니다. 검증 결과는 이 이력에 자동으로 연결됩니다.
                </p>
              </SheetFooter>
            </SheetContent>
          )}
        </Sheet>
      </div>
    </section>
  );
}
