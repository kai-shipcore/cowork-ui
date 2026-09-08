import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/shared/components/page-header';
import type { ProjectDesignDetails } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  importProjectParts,
  saveLibraryPart,
  usePartLibrary,
} from './part-library';
import './parts.css';

type SeatPosition = 'PASSENGER' | 'CENTER' | 'DRIVER';

const SEAT_POSITIONS: readonly SeatPosition[] = ['PASSENGER', 'CENTER', 'DRIVER'];
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
  const [tab, setTab] = useState(params.has('part') ? 'list' : 'create');
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
  const [search, setSearch] = useState('');
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
    code,
  );
  const active =
    parts.find((p) => p.id === selected) ??
    parts.find((p) => p.name === params.get('name'));
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
            <button onClick={() => navigate(safeReturn)}>
              프로젝트로 돌아가기
            </button>
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
      <nav className="parts-tabs">
        <button
          aria-pressed={tab === 'create'}
          onClick={() => setTab('create')}
        >
          생성기
        </button>
        <button aria-pressed={tab === 'list'} onClick={() => setTab('list')}>
          목록 · {parts.length}
        </button>
      </nav>
      {message && <p role="status">{message}</p>}
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
        <div className="parts-list-layout">
          <div>
            <label>
              Part 검색
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 / 제품군 / Part Type"
              />
            </label>
            {parts
              .filter((p) =>
                `${p.name} ${p.product} ${p.type}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  className="part-list-row"
                  key={p.id}
                  aria-pressed={selected === p.id}
                  onClick={() => {
                    setSelected(p.id);
                    setNote('');
                  }}
                >
                  <strong>{p.name}</strong>
                  <span>
                    {p.product} · {p.type} · v
                    {p.revisions[p.revisions.length - 1]?.revisionNumber}
                  </span>
                </button>
              ))}
            {!parts.length && (
              <p>등록된 Part가 없습니다. 생성기에서 첫 Part를 추가하세요.</p>
            )}
          </div>
          <aside>
            {active ? (
              <>
                <h2>{active.name}</h2>
                <h3>Version History</h3>
                {active.revisions.map((r) => (
                  <article className="part-version" key={r.id}>
                    <strong>v{r.revisionNumber}</strong>
                    <p>{r.note}</p>
                    <small>
                      {new Date(r.createdAt).toLocaleString()} · {r.createdBy}
                    </small>
                  </article>
                ))}
                <label>
                  변경 내용
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  disabled={!note.trim()}
                  onClick={() => {
                    try {
                      saveLibraryPart({
                        ...active,
                        revisions: [
                          ...active.revisions,
                          {
                            id: crypto.randomUUID(),
                            revisionNumber:
                              Math.max(
                                ...active.revisions.map(
                                  (r) => r.revisionNumber,
                                ),
                              ) + 1,
                            note: note.trim(),
                            createdBy: CURRENT_USER_ID,
                            createdAt: new Date().toISOString(),
                          },
                        ],
                      });
                      setNote('');
                      setMessage(
                        '새 버전을 추가했습니다. 기존 프로젝트 적용 버전은 유지됩니다.',
                      );
                    } catch (error) {
                      setMessage(String(error));
                    }
                  }}
                >
                  새 버전 추가
                </button>
                <p>프로젝트의 적용 버전은 자동 변경되지 않습니다.</p>
              </>
            ) : (
              <p>Part를 선택하면 버전 이력을 확인할 수 있습니다.</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
