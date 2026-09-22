import { useEffect, useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
  type GridSort,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
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
import { SeatCoverCodePanel } from '@/modules/reference-data/components/seat-cover-code-panel';
import { SeatCoverPartPanel } from '@/modules/reference-data/components/seat-cover-part-panel';
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
  PASSENGER: 'Passenger',
  CENTER: 'Center',
  DRIVER: 'Driver',
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
  { category: 'HEADREST', label: 'Headrest' },
  { category: 'TOP', label: 'Backrest', centerLabel: 'Backrest / Console' },
  { category: 'ARM', label: 'Armrest', sideOnly: true },
  { category: 'BOTTOM', label: 'Seat cushion' },
  { category: 'LEG', label: 'Leg support', sideOnly: true },
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
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const activeTab =
    requestedTab === 'parts' || requestedTab === 'codes'
      ? requestedTab
      : 'library';
  const [partQuery, setPartQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
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
      setMessage('Part created.');
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
        description="Part Library · Seat Cover Part · Seat Cover Code"
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
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('tab', value);
            return next;
          });
        }}
      >
        <TabsList variant="line" className="grid-tabs-list">
          <TabsTrigger value="library">Part Library</TabsTrigger>
          <TabsTrigger value="parts">
            Seat Cover Part{' '}
            <span className="stage-tab-count">{seatCoverParts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="codes">
            Seat Cover Code{' '}
            <span className="stage-tab-count">{seatCoverCodes.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="mt-0">
          <SeatCoverPartPanel query={partQuery} onQueryChange={setPartQuery} />
        </TabsContent>
        <TabsContent value="codes" className="mt-0">
          <SeatCoverCodePanel query={codeQuery} onQueryChange={setCodeQuery} />
        </TabsContent>
        <TabsContent value="library" className="mt-0">
          {message && (
            <p className="detail-help-text" role="status">
              {message}
            </p>
          )}
          <DetailSheet
            open={createOpen}
            onOpenChange={setCreateOpen}
            title="Create new part"
            description="Choose the location and specifications to create a shared part and its first revision."
            icon={<Plus />}
            size="lg"
            className="parts-create-sheet w-[min(1120px,96vw)] sm:max-w-none"
            footer={
              <>
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
                  {safeReturn
                    ? 'Link from the project after creation'
                    : 'Create part'}
                </Button>
              </>
            }
          >
            <div className="parts-generator">
              <div className="parts-diagram-panel">
                <div className="parts-section-heading">
                  <span>01</span>
                  <div>
                    <h2>Select seat area</h2>
                    <p>Select a row and area to filter available part types.</p>
                  </div>
                </div>
                <div className="parts-tabs">
                  {[
                    ['F', '1st row (Front)'],
                    ['B', '2nd row (Rear)'],
                    ['E', '3rd row'],
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
                    <strong>Select an area</strong>
                    <p>Only matching part types appear on the right.</p>
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
                    Clear area filter
                  </button>
                </div>
                <div className="parts-workflow-note">
                  <span aria-hidden="true">
                    <Link2 />
                  </span>
                  <p>
                    Link shared parts in each project by selecting the required{' '}
                    <strong>revision and quantity</strong>for that project.
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
                    <h2>Part information</h2>
                    <p>
                      Enter identifying details and the initial revision file.
                    </p>
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
                    Custom
                  </button>
                  <button
                    type="button"
                    aria-pressed={!custom}
                    onClick={() => {
                      setCustom(false);
                      setPartType('');
                    }}
                  >
                    Universal
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
                      <option value="">Select part</option>
                      {types.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  {types.length === 0 && (
                    <p>
                      No matching part types. Clear the area filter or add one
                      in Reference Data.
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
                      <option value="">Select code</option>
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
                  Initial DXF file
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
                  Part name preview
                  <output className="part-name-preview">
                    {name || 'Select the required fields'}
                  </output>
                </label>
                <p role="status">
                  {duplicate
                    ? 'This part name already exists. Use the existing part.'
                    : valid
                      ? 'No duplicates · Ready to create'
                      : 'Complete the required fields.'}
                </p>
              </form>
            </div>
          </DetailSheet>
          <div className="parts-list">
            <FlatDataGrid
              label="Parts"
              columns={columns}
              rows={pagedParts}
              getRowId={(part) => part.id}
              sorting={{ value: sort, onChange: setSort, mode: 'manual' }}
              search={{
                label: 'Search part name or type',
                placeholder: 'Part name / Type',
                value: search,
                onChange: setSearch,
              }}
              colors={{
                primary: 'var(--wb-blue)',
                primaryForeground: '#FFFFFF',
                primarySoft: 'var(--wb-soft-blue)',
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
                      Back to project
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    className="parts-primary-action"
                    onClick={() => {
                      setCreateOpen(true);
                    }}
                  >
                    <Plus /> Create part
                  </Button>
                </>
              }
              emptyMessage={
                <div className="empty-state">
                  <div className="empty-icon">🧩</div>
                  <strong>
                    {parts.length
                      ? 'No matching parts.'
                      : 'No parts registered.'}
                  </strong>
                  <p>
                    {parts.length
                      ? 'Try changing the search term or product filter.'
                      : 'Use Create part to add your first part.'}
                  </p>
                </div>
              }
              pagination={{
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
                totalCount: visibleParts.length,
                pageSizeOptions: [5, 10, 25],
                onPageChange: (page) => {
                  setPagination((current) => ({
                    ...current,
                    pageIndex: page - 1,
                  }));
                },
                onPageSizeChange: (pageSize) => {
                  setPagination({ pageIndex: 0, pageSize });
                },
              }}
            />
            {active && (
              <DetailSheet
                open
                onOpenChange={(open) => {
                  if (!open) setSelected('');
                }}
                title={`${active.name} Version History`}
                description={`${String(active.revisions.length)} revisions in history.`}
                icon={<FileClock />}
                size="md"
                className="w-[min(620px,96vw)] sm:max-w-none"
                footer={
                  <p className="text-sm text-muted-foreground">
                    Create new revisions and change requests in the project's
                    Revision Control tab. Verification results are linked to
                    this history automatically.
                  </p>
                }
              >
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
                              {new Date(r.createdAt).toLocaleString('en-US')}
                            </time>
                          </span>
                          <span>
                            <UserRound aria-hidden="true" />
                            {r.createdBy}
                          </span>
                        </div>
                      </div>
                      <div className="part-version-note">
                        <span>Revision notes</span>
                        <p>{r.note || 'No change notes'}</p>
                      </div>
                      {r.changeRequest && (
                        <section className="part-revision-section">
                          <h3>Change request</h3>
                          <dl className="part-revision-change">
                            <div>
                              <dt>Issue source</dt>
                              <dd>{r.changeRequest.issueSource || '—'}</dd>
                            </div>
                            <div>
                              <dt>Affected area</dt>
                              <dd>{r.changeRequest.issueArea || '—'}</dd>
                            </div>
                            <div className="part-revision-wide">
                              <dt>Change instructions</dt>
                              <dd>{r.changeRequest.instruction || '—'}</dd>
                            </div>
                          </dl>
                          <div className="part-revision-files">
                            <div>
                              <FileImage aria-hidden="true" />
                              <span>Reference image</span>
                              <strong>
                                {r.changeRequest.referenceImageName || 'None'}
                              </strong>
                            </div>
                            <div>
                              <FileClock aria-hidden="true" />
                              <span>DXF change</span>
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
                          <h3>Implementation verification</h3>
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
                                      ? 'Fully implemented'
                                      : verification.verdict === 'PARTIAL'
                                        ? 'Partially implemented'
                                        : 'Not implemented'}
                                  </strong>
                                  <p>
                                    {verification.note ||
                                      'No verification notes'}
                                  </p>
                                  <small>
                                    {new Date(
                                      verification.verifiedAt,
                                    ).toLocaleString('en-US')}{' '}
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
              </DetailSheet>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
