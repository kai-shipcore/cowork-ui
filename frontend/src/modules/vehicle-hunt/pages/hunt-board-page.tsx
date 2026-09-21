import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@coverland-engineering/ui/button';
import { Card, CardContent } from '@coverland-engineering/ui/card';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { UserPicker } from '@coverland-engineering/ui/user-picker';
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Phone,
  Plus,
  Ruler,
  ScanLine,
  Search,
  Store,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { userName } from '@/shared/domain/app-user';
import { createProjectVisit } from '@/shared/domain/field-visit';
import { eligibleProjectIdsForStage } from '@/shared/domain/project-stage';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import type { Dealer, Visit } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { HuntWorkList } from '../components/hunt-work-list';
import { ScheduleAgenda } from '../components/schedule-agenda';
import '@/modules/rd-workspace/rd-workspace.css';
import { huntRow } from '../hunt-rows';

const WORKBENCH_TIME_ZONE = 'America/Los_Angeles';

function workbenchToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WORKBENCH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

const TODAY = workbenchToday();

type DealerTypeFilter = 'ALL' | Dealer['type'];
/** Radix Select cannot hold an empty value, so "all" is spelled out. */
const ALL_FILTER = 'ALL';
/** Calendar legend entries; each doubles as a click-to-filter toggle. */
const CALENDAR_LEGEND = [
  { value: 'SCAN', label: 'Scan', dot: 'scan' },
  { value: 'FITTING', label: 'Fitting', dot: 'fitting' },
  { value: 'COMPLETED', label: 'Completed', dot: 'completed' },
] as const;
type CalendarLegend = (typeof CALENDAR_LEGEND)[number]['value'];

function matchesCalendarLegend(visit: Visit, legend?: CalendarLegend): boolean {
  if (!legend) return true;
  if (legend === 'COMPLETED') return visit.status === 'COMPLETED';
  return visit.kind === legend && visit.status !== 'COMPLETED';
}

const DEALER_TYPE_FILTERS: readonly {
  value: DealerTypeFilter;
  label: string;
}[] = [
  { value: 'ALL', label: 'All' },
  { value: 'Dealer', label: 'Dealer' },
  { value: 'Rental', label: 'Rental' },
  { value: 'Partner', label: 'Partner' },
];

/** Scan, fitting, calendar, and dealer scheduling workspace. */
export function HuntBoardPage() {
  const navigate = useNavigate();
  const {
    projects,
    projectDetails,
    visits,
    setVisits,
    dealers,
    setDealers,
    appUsers,
  } = useWorkbenchStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visitProjectId, setVisitProjectId] = useState('');
  const [visitDealer, setVisitDealer] = useState('Galpin Ford');
  const [visitKind, setVisitKind] = useState<Visit['kind']>('SCAN');
  const [visitDate, setVisitDate] = useState(
    new Date().toLocaleDateString('en-CA'),
  );
  const [visitTime, setVisitTime] = useState('10:00');
  const [visitZoneIds, setVisitZoneIds] = useState<readonly string[]>([]);
  const [staffIds, setStaffIds] = useState<readonly string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(TODAY.year, TODAY.month - 1, 1),
  );
  const [selectedDay, setSelectedDay] = useState<number>();
  const [selectedVisitId, setSelectedVisitId] = useState<string>();
  const [filterQuery, setFilterQuery] = useState('');
  const [calendarDealer, setCalendarDealer] = useState('');
  const [calendarAssignee, setCalendarAssignee] = useState('');
  const [calendarLegend, setCalendarLegend] = useState<CalendarLegend>();
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>(
    'month',
  );
  const [dealerQuery, setDealerQuery] = useState('');
  const [dealerType, setDealerType] = useState<DealerTypeFilter>('ALL');
  const [selectedDealerId, setSelectedDealerId] = useState<string>();
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false);
  const [dealerName, setDealerName] = useState('');
  const [dealerBrand, setDealerBrand] = useState('');
  const [dealerNewType, setDealerNewType] = useState<Dealer['type']>('Dealer');
  const [dealerAddress, setDealerAddress] = useState('');
  const [dealerContact, setDealerContact] = useState('');
  const [dealerNote, setDealerNote] = useState('');

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthNumber = calendarMonthIndex + 1;
  const calendarMonthKey = `${String(calendarYear)}-${String(calendarMonthNumber).padStart(2, '0')}`;
  const calendarDays = Array.from(
    { length: new Date(calendarYear, calendarMonthNumber, 0).getDate() },
    (_, index) => index + 1,
  );
  const calendarBlanks = Array.from(
    { length: new Date(calendarYear, calendarMonthIndex, 1).getDay() },
    (_, index) => `blank-${String(index)}`,
  );

  const normalizedQuery = filterQuery.trim().toLowerCase();
  const matchesVisitFilters = (visit: Visit) =>
    (!normalizedQuery ||
      `${visit.vehicle} ${visit.projectGroupId} ${visit.dealer} ${visitAssigneeNames(visit)}`
        .toLowerCase()
        .includes(normalizedQuery)) &&
    (!calendarDealer || visit.dealer === calendarDealer) &&
    (!calendarAssignee || (visit.staffIds ?? []).includes(calendarAssignee)) &&
    matchesCalendarLegend(visit, calendarLegend);
  const visibleVisits = visits.filter(matchesVisitFilters);
  const scanRows = projects
    .map((project) =>
      huntRow(project, projectDetails[project.id], visits, 'SCAN'),
    )
    .filter((row) => row.eligible);
  const fittingRows = projects
    .map((project) =>
      huntRow(project, projectDetails[project.id], visits, 'FITTING'),
    )
    .filter((row) => row.eligible);
  const scanWaitingProjects = scanRows
    .filter((row) => !row.done)
    .map((row) => row.project);
  const fittingProjects = fittingRows
    .filter((row) => !row.done)
    .map((row) => row.project);
  const visitsOnDay = (day: number) =>
    visibleVisits.filter(
      (visit) =>
        visit.date.startsWith(`${calendarMonthKey}-`) &&
        Number(visit.date.slice(-2)) === day,
    );
  const normalizedDealerQuery = dealerQuery.trim().toLowerCase();
  const searchedDealers = dealers.filter(
    (dealer) =>
      !normalizedDealerQuery ||
      `${dealer.name} ${dealer.brand} ${dealer.address} ${dealer.contact} ${dealer.note}`
        .toLowerCase()
        .includes(normalizedDealerQuery),
  );
  const visibleDealers = searchedDealers.filter(
    (dealer) => dealerType === 'ALL' || dealer.type === dealerType,
  );
  const visitProject = projects.find(
    (project) => project.id === visitProjectId,
  );
  const eligibleVisitZones = visitProject
    ? huntRow(
        visitProject,
        projectDetails[visitProjectId],
        visits,
        visitKind,
      ).remaining.filter((zone) =>
        eligibleProjectIdsForStage(
          visitProject.product,
          new Map(Object.entries(projectDetails)).get(visitProjectId)?.zones ??
            visitProject.zoneProjects,
          visitKind === 'SCAN' ? 'Scan' : 'Fitting',
        ).includes(zone.id),
      )
    : [];
  function visitAssigneeNames(visit: Visit) {
    return visit.staffIds?.length
      ? visit.staffIds.map((id) => userName(appUsers, id)).join(', ')
      : 'Unassigned';
  }

  const selectedDayVisits = selectedVisitId
    ? visits.filter((visit) => visit.id === selectedVisitId)
    : selectedDay === undefined
      ? []
      : visitsOnDay(selectedDay);
  const selectedDealer = dealers.find(
    (dealer) => dealer.id === selectedDealerId,
  );
  const selectedDealerVisits = visits.filter(
    (visit) => visit.dealer === selectedDealer?.name,
  );

  function openProject(projectId: string): void {
    // React Router handles route errors; clicks do not await navigation.
    void navigate(
      `${ROUTES.vehicleProjects}?project=${encodeURIComponent(projectId)}`,
    );
  }

  function openVisitDialog(projectId?: string): void {
    setVisitZoneIds([]);
    setStaffIds([]);
    setVisitProjectId(
      projectId ??
        scanWaitingProjects.slice(0, 1).pop()?.id ??
        fittingProjects.slice(0, 1).pop()?.id ??
        '',
    );
    setDialogOpen(true);
  }

  function saveVisit(): void {
    const project = projects.find((item) => item.id === visitProjectId);
    if (!project) return;
    const vehicleProjectIds = visitZoneIds.filter((id) =>
      eligibleVisitZones.some((zone) => zone.id === id),
    );
    if (!vehicleProjectIds.length || !visitDate || !visitTime) return;
    const record = createProjectVisit({
      type: visitKind,
      dealer: visitDealer,
      date: visitDate,
      time: visitTime,
      vehicleProjectIds,
      staffIds,
      locationType: 'DEALERSHIP',
      priority: 'NORMAL',
      targetVehicleResearchId: project.vehicleResearchId,
    });
    const visit: Visit = {
      ...record,
      status: 'SCHEDULED',
      taskIds: [],
      vehicle: project.vehicle,
      projectGroupId: project.id,
      product: project.product,
      kind: visitKind,
    };
    setVisits((current) => [...current, visit]);
    setDialogOpen(false);
  }

  function openDealerDialog(): void {
    setDealerName('');
    setDealerBrand('');
    setDealerNewType('Dealer');
    setDealerAddress('');
    setDealerContact('');
    setDealerNote('');
    setDealerDialogOpen(true);
  }

  function saveDealer(): void {
    const nextNumber =
      Math.max(
        0,
        ...dealers.map((dealer) => Number(dealer.id.replace(/\D/g, ''))),
      ) + 1;
    const dealer: Dealer = {
      id: `d${String(nextNumber)}`,
      name: dealerName.trim(),
      brand: dealerBrand.trim(),
      type: dealerNewType,
      address: dealerAddress.trim(),
      contact: dealerContact.trim(),
      note: dealerNote.trim(),
      lastVisit: '—',
    };
    setDealers((current) => [...current, dealer]);
    setDealerDialogOpen(false);
  }

  return (
    <section>
      <PageHeader
        description="Scans, fittings, and dealer visits at a glance — Schedule → Visit → Complete · Batch visits supported (one visit ↔ multiple zone projects)"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'field_visit' },
                { name: 'field_visit_x_vehicle_project' },
                { name: 'dealership' },
                { name: 'vehicle_project' },
              ]
            : undefined
        }
        actions={
          <Button
            variant="primary"
            onClick={() => {
              openVisitDialog();
            }}
          >
            <CalendarPlus /> Schedule visit
          </Button>
        }
      />

      <Tabs defaultValue="scan" className="hunt-tabs">
        <TabsList variant="line" className="grid-tabs-list">
          <TabsTrigger value="scan">
            <ScanLine aria-hidden="true" />
            Scan
            <span className="stage-tab-count">
              {scanWaitingProjects.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="fitting">
            <Ruler aria-hidden="true" />
            Fitting
            <span className="stage-tab-count">{fittingProjects.length}</span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays aria-hidden="true" />
            Calendar
            <span className="stage-tab-count">{visibleVisits.length}</span>
          </TabsTrigger>
          <TabsTrigger value="dealers">
            <Store aria-hidden="true" />
            Dealer Directory
            <span className="stage-tab-count">{visibleDealers.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent forceMount value="scan" className="hunt-tab-content">
          <HuntWorkList
            kind="SCAN"
            rows={scanRows}
            onProject={openProject}
            assignees={visitAssigneeNames}
            onSchedule={(id) => {
              setVisitKind('SCAN');
              setVisitZoneIds([]);
              openVisitDialog(id);
            }}
            onVisit={(visit) => {
              setCalendarMonth(new Date(`${visit.date}T12:00:00`));
              setSelectedDay(Number(visit.date.slice(-2)));
              setSelectedVisitId(visit.id);
            }}
          />
        </TabsContent>
        <TabsContent forceMount value="fitting" className="hunt-tab-content">
          <HuntWorkList
            kind="FITTING"
            rows={fittingRows}
            onProject={openProject}
            assignees={visitAssigneeNames}
            onSchedule={(id) => {
              setVisitKind('FITTING');
              setVisitZoneIds([]);
              openVisitDialog(id);
            }}
            onVisit={(visit) => {
              setCalendarMonth(new Date(`${visit.date}T12:00:00`));
              setSelectedDay(Number(visit.date.slice(-2)));
              setSelectedVisitId(visit.id);
            }}
          />
        </TabsContent>

        <TabsContent value="calendar" className="hunt-tab-content">
          <div className="grid-toolbar">
            <div className="grid-toolbar-filters">
              <div className="search-field">
                <Search aria-hidden="true" />
                <Input
                  aria-label="Search visits"
                  placeholder="Search vehicle / Project ID"
                  value={filterQuery}
                  onChange={(event) => {
                    setFilterQuery(event.target.value);
                  }}
                />
              </div>
              <Select
                value={calendarDealer || ALL_FILTER}
                onValueChange={(value) => {
                  setCalendarDealer(value === ALL_FILTER ? '' : value);
                }}
              >
                <SelectTrigger
                  aria-label="Dealer"
                  className="filter-select wide"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All dealers</SelectItem>
                  {dealers.map((dealer) => (
                    <SelectItem key={dealer.id} value={dealer.name}>
                      {dealer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <UserPicker
                value={appUsers.find((user) => user.id === calendarAssignee)}
                users={appUsers}
                label="Assignee"
                placeholder="All assignees"
                searchPlaceholder="Search name or email…"
                emptyMessage="No matching users."
                clearLabel="All assignees"
                onChange={(userId) => {
                  setCalendarAssignee(userId ?? '');
                }}
              />
              {(filterQuery ||
                calendarDealer ||
                calendarAssignee ||
                calendarLegend) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFilterQuery('');
                    setCalendarDealer('');
                    setCalendarAssignee('');
                    setCalendarLegend(undefined);
                  }}
                >
                  <X /> Reset
                </Button>
              )}
            </div>
          </div>

          <div className="hunt-tab-body">
            <div
              className="flex gap-2 mb-4"
              role="group"
              aria-label="View schedule"
            >
              {(['month', 'week', 'day'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={calendarView === mode ? 'primary' : 'outline'}
                  onClick={() => {
                    setCalendarView(mode);
                  }}
                >
                  {mode === 'month'
                    ? 'Month'
                    : mode === 'week'
                      ? 'Week'
                      : 'Day'}
                </Button>
              ))}
            </div>
            {calendarView !== 'month' ? (
              <ScheduleAgenda
                mode={calendarView}
                visits={visibleVisits}
                users={appUsers}
                scanQueue={scanWaitingProjects}
                fittingQueue={fittingProjects}
                onVisit={(id) => {
                  setSelectedVisitId(id);
                }}
                onBook={(projectId, kind, date) => {
                  setVisitKind(kind);
                  setVisitDate(date);
                  openVisitDialog(projectId);
                }}
              />
            ) : (
              <>
                <div className="calendar-toolbar">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDay(undefined);
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() - 1,
                            1,
                          ),
                      );
                    }}
                  >
                    ← Previous month
                  </Button>
                  <h2>
                    {calendarMonth.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDay(undefined);
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + 1,
                            1,
                          ),
                      );
                    }}
                  >
                    Next month →
                  </Button>
                  <Input
                    className="calendar-month-picker"
                    aria-label="Select month to display"
                    type="month"
                    value={calendarMonthKey}
                    onChange={(event) => {
                      const [year, month] = event.target.value
                        .split('-')
                        .map(Number);
                      if (!year || !month) return;
                      setSelectedDay(undefined);
                      setCalendarMonth(new Date(year, month - 1, 1));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      calendarYear === TODAY.year &&
                      calendarMonthNumber === TODAY.month
                    }
                    onClick={() => {
                      setSelectedDay(undefined);
                      setCalendarMonth(
                        new Date(TODAY.year, TODAY.month - 1, 1),
                      );
                    }}
                  >
                    Today
                  </Button>
                  <div
                    className="calendar-legend"
                    role="group"
                    aria-label="Visit type filter"
                  >
                    {CALENDAR_LEGEND.map((legend) => (
                      <button
                        type="button"
                        key={legend.value}
                        className="calendar-legend-item"
                        aria-pressed={calendarLegend === legend.value}
                        onClick={() => {
                          setCalendarLegend((current) =>
                            current === legend.value ? undefined : legend.value,
                          );
                        }}
                      >
                        <i className={`calendar-legend-dot ${legend.dot}`} />{' '}
                        {legend.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="month-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    (day) => (
                      <div className="weekday" key={day}>
                        {day}
                      </div>
                    ),
                  )}
                  {calendarBlanks.map((blank) => (
                    <div key={blank} />
                  ))}
                  {calendarDays.map((day) => {
                    const dayVisits = visitsOnDay(day);
                    const isToday =
                      day === TODAY.day &&
                      calendarMonthNumber === TODAY.month &&
                      calendarYear === TODAY.year;
                    const dayClass = isToday
                      ? 'calendar-day today'
                      : 'calendar-day';
                    const dayContent = (
                      <>
                        <span className="day-number">
                          {day}
                          {isToday ? ' · Today' : ''}
                        </span>
                        {dayVisits.map((visit) => (
                          <span
                            className={`calendar-event ${visit.kind.toLowerCase()}${
                              visit.status === 'COMPLETED' ? ' completed' : ''
                            }`}
                            key={visit.id}
                          >
                            <small className="calendar-event-kind">
                              {visit.time} ·{' '}
                              {visit.kind === 'SCAN' ? 'Scan' : 'Fitting'}
                            </small>
                            <strong>{visit.dealer}</strong>
                            <small>
                              {visitAssigneeNames(visit)} ·{' '}
                              {visit.projectGroupId}
                            </small>
                          </span>
                        ))}
                      </>
                    );

                    if (!dayVisits.length) {
                      return (
                        <div className={dayClass} key={day}>
                          {dayContent}
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        className={`${dayClass} has-visits`}
                        key={day}
                        aria-label={`${calendarMonthKey}-${String(day).padStart(2, '0')}: ${String(dayVisits.length)} visits · View details`}
                        onClick={() => {
                          setSelectedDay(day);
                        }}
                      >
                        {dayContent}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dealers" className="hunt-tab-content">
          <div className="grid-toolbar">
            <div className="grid-toolbar-filters">
              <div className="search-field">
                <Search aria-hidden="true" />
                <Input
                  aria-label="Search source name, brand, address, or contact"
                  placeholder="Name / Brand / Address / Contact"
                  value={dealerQuery}
                  onChange={(event) => {
                    setDealerQuery(event.target.value);
                  }}
                />
              </div>
              <div className="stage-tabs" role="group" aria-label="Source type">
                {DEALER_TYPE_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.value}
                    className="stage-tab"
                    aria-pressed={dealerType === filter.value}
                    onClick={() => {
                      setDealerType(filter.value);
                    }}
                  >
                    {filter.label}
                    <span className="stage-tab-count">
                      {
                        searchedDealers.filter(
                          (dealer) =>
                            filter.value === 'ALL' ||
                            dealer.type === filter.value,
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-toolbar-actions">
              <Button variant="primary" onClick={openDealerDialog}>
                <Plus /> Add vehicle source
              </Button>
            </div>
          </div>

          <div className="hunt-tab-body">
            {visibleDealers.length ? (
              <div className="dealer-grid">
                {visibleDealers.map((dealer) => (
                  <Card key={dealer.id}>
                    <CardContent
                      className="dealer-card-content selectable"
                      onClick={() => {
                        setSelectedDealerId(dealer.id);
                      }}
                    >
                      <div className="dealer-title">
                        <div>
                          <h3>
                            <button
                              type="button"
                              className="dealer-name-button"
                              onClick={() => {
                                setSelectedDealerId(dealer.id);
                              }}
                            >
                              {dealer.name}
                            </button>
                          </h3>
                          <p>{dealer.brand}</p>
                        </div>
                        <StatusBadge
                          label={dealer.type}
                          tone={
                            dealer.type === 'Dealer'
                              ? 'progress'
                              : dealer.type === 'Rental'
                                ? 'warning'
                                : 'purple'
                          }
                        />
                      </div>
                      <div className="dealer-info">
                        <span>
                          <MapPin />
                          {dealer.address}
                        </span>
                        <span>
                          <Phone />
                          {dealer.contact}
                        </span>
                        <em>※ {dealer.note}</em>
                      </div>
                      <div className="dealer-footer">
                        <span>Last visit {dealer.lastVisit}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setVisitDealer(dealer.name);
                            openVisitDialog();
                          }}
                        >
                          Schedule visit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <strong>No matching vehicle sources.</strong>
                <p>Try changing the search term or type filter.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule visit</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Project Group
              <Select
                value={visitProjectId}
                onValueChange={(value) => {
                  setVisitProjectId(value);
                  setVisitZoneIds([]);
                }}
              >
                <SelectTrigger aria-label="Project Group">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem value={project.id} key={project.id}>
                      {project.id} · {project.vehicle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Vehicle source
              <Select value={visitDealer} onValueChange={setVisitDealer}>
                <SelectTrigger aria-label="Dealer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dealers.map((dealer) => (
                    <SelectItem value={dealer.name} key={dealer.id}>
                      {dealer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Visit type
              <Select
                value={visitKind}
                onValueChange={(value) => {
                  setVisitKind(value as Visit['kind']);
                  setVisitZoneIds([]);
                }}
              >
                <SelectTrigger aria-label="Visit type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCAN">SCAN</SelectItem>
                  <SelectItem value="FITTING">FITTING</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Date
              <Input
                type="date"
                value={visitDate}
                onChange={(event) => {
                  setVisitDate(event.target.value);
                }}
              />
            </label>
            <label>
              Time
              <Input
                type="time"
                value={visitTime}
                onChange={(event) => {
                  setVisitTime(event.target.value);
                }}
              />
            </label>
            <fieldset className="visit-zone-picker full-width">
              <legend>Target Zone Projects - {visitKind}</legend>
              {eligibleVisitZones.map((zone) => (
                <label key={zone.id}>
                  <Checkbox
                    checked={visitZoneIds.includes(zone.id)}
                    onCheckedChange={(checked) => {
                      setVisitZoneIds((current) =>
                        checked === true
                          ? [...new Set([...current, zone.id])]
                          : current.filter((id) => id !== zone.id),
                      );
                    }}
                  />
                  <span>
                    {zone.code} - {zone.id}
                  </span>
                </label>
              ))}
              {!eligibleVisitZones.length && <p>No eligible zone projects.</p>}
            </fieldset>
            <fieldset className="visit-zone-picker two-column full-width">
              <legend>Visit Staff</legend>
              {appUsers
                .filter((user) => user.status === 'ACTIVE')
                .map((user) => (
                  <label key={user.id}>
                    <Checkbox
                      checked={staffIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setStaffIds((current) =>
                          checked === true
                            ? [...new Set([...current, user.id])]
                            : current.filter((id) => id !== user.id),
                        );
                      }}
                    />
                    <span>{user.name}</span>
                  </label>
                ))}
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={
                !visitZoneIds.some((id) =>
                  eligibleVisitZones.some((zone) => zone.id === id),
                ) ||
                !visitDate ||
                !visitTime
              }
              onClick={saveVisit}
            >
              Save booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDay !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDay(undefined);
            setSelectedVisitId(undefined);
          }
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>
              {calendarMonthKey}-{String(selectedDay ?? 0).padStart(2, '0')}{' '}
              Schedule {selectedDayVisits.length} items
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="detail-card-list">
            {selectedDayVisits.map((visit) => (
              <div className="detail-card" key={visit.id}>
                <div className="visit-kind-heading">
                  <StatusBadge
                    label={`${visit.kind} Visit`}
                    tone={visit.kind === 'SCAN' ? 'progress' : 'cyan'}
                    size="lg"
                  />
                  <span>Owner {visitAssigneeNames(visit)}</span>
                </div>
                <strong>
                  {visit.dealer} · {visit.date} {visit.time}
                </strong>
                <dl className="detail-rows">
                  <div>
                    <dt>Visit</dt>
                    <dd>
                      <span className="visit-reference">{visit.id}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Vehicle</dt>
                    <dd>{visit.vehicle}</dd>
                  </div>
                  <div>
                    <dt>Product</dt>
                    <dd>{visit.product}</dd>
                  </div>
                  <div>
                    <dt>Project Group</dt>
                    <dd>
                      <button
                        type="button"
                        className="project-reference project-reference-link"
                        onClick={() => {
                          openProject(visit.projectGroupId);
                        }}
                      >
                        {visit.projectGroupId}
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Zone</dt>
                    <dd>
                      {visit.vehicleProjectIds.length ? (
                        <div className="zone-list">
                          {visit.vehicleProjectIds.map((vehicleProjectId) => (
                            <span
                              className="zone-project-reference"
                              key={vehicleProjectId}
                            >
                              {vehicleProjectId}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge
                        label={
                          visit.status === 'COMPLETED'
                            ? 'Visit complete'
                            : 'Scheduled'
                        }
                        tone={
                          visit.status === 'COMPLETED' ? 'success' : 'progress'
                        }
                      />
                    </dd>
                  </div>
                </dl>
                {visit.status === 'SCHEDULED' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setVisits((current) =>
                        current.map((item) =>
                          item.id === visit.id
                            ? {
                                ...item,
                                status: 'COMPLETED',
                                performedAt: new Date().toISOString(),
                              }
                            : item,
                        ),
                      );
                    }}
                  >
                    Complete visit
                  </Button>
                )}
                {visit.kind === 'FITTING' && (
                  <p className="muted-text">
                    Fitting completion depends on project design fitment
                    verification and Shape confirmation.
                  </p>
                )}
              </div>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDay(undefined);
                setSelectedVisitId(undefined);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dealerDialogOpen} onOpenChange={setDealerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add vehicle source</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Source name
              <Input
                placeholder="Example: Galpin Ford"
                value={dealerName}
                onChange={(event) => {
                  setDealerName(event.target.value);
                }}
              />
            </label>
            <label>
              Brands served
              <Input
                placeholder="Example: Ford / Lincoln"
                value={dealerBrand}
                onChange={(event) => {
                  setDealerBrand(event.target.value);
                }}
              />
            </label>
            <label>
              Type
              <Select
                value={dealerNewType}
                onValueChange={(value) => {
                  setDealerNewType(value as Dealer['type']);
                }}
              >
                <SelectTrigger aria-label="Source type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dealer">Dealer</SelectItem>
                  <SelectItem value="Rental">Rental</SelectItem>
                  <SelectItem value="Partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Area / Address
              <Input
                placeholder="Example: North Hills, CA"
                value={dealerAddress}
                onChange={(event) => {
                  setDealerAddress(event.target.value);
                }}
              />
            </label>
            <label className="full-width">
              Contact
              <Input
                placeholder="Example: J. Alvarez · (818) 555-0134"
                value={dealerContact}
                onChange={(event) => {
                  setDealerContact(event.target.value);
                }}
              />
            </label>
            <label className="full-width">
              Visit notes
              <Input
                placeholder="Example: Friday morning visits preferred"
                value={dealerNote}
                onChange={(event) => {
                  setDealerNote(event.target.value);
                }}
              />
            </label>
            <div className="dialog-note">
              Vehicle sources are shared across scan and fitting visits. The
              latest visit date updates when a visit is completed.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDealerDialogOpen(false);
              }}
            >
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={!dealerName.trim() || !dealerAddress.trim()}
              onClick={saveDealer}
            >
              Add vehicle source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDealer !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedDealerId(undefined);
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>Vehicle source details</DialogTitle>
          </DialogHeader>
          {selectedDealer && (
            <DialogBody className="detail-card-list">
              <div className="detail-card">
                <span className="detail-card-label">
                  {selectedDealer.type} · {selectedDealer.brand}
                </span>
                <strong>{selectedDealer.name}</strong>
                <dl className="detail-rows">
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedDealer.address}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{selectedDealer.contact}</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{selectedDealer.note || '—'}</dd>
                  </div>
                  <div>
                    <dt>Last visit</dt>
                    <dd>{selectedDealer.lastVisit}</dd>
                  </div>
                  <div>
                    <dt>Total visits</dt>
                    <dd>{selectedDealerVisits.length} items</dd>
                  </div>
                </dl>
              </div>

              <div className="detail-card">
                <span className="detail-card-label">Visit history</span>
                {selectedDealerVisits.length ? (
                  <dl className="detail-rows">
                    {selectedDealerVisits.map((visit) => (
                      <div key={visit.id}>
                        <dt>
                          {visit.date} {visit.time}
                        </dt>
                        <dd className="dealer-visit-row">
                          <span className="visit-reference">{visit.id}</span>
                          <span>
                            {visit.kind === 'SCAN' ? 'Scan' : 'Fitting'} ·{' '}
                            {visitAssigneeNames(visit)}
                          </span>
                          <StatusBadge
                            label={
                              visit.status === 'COMPLETED'
                                ? 'Visit complete'
                                : 'Scheduled'
                            }
                            tone={
                              visit.status === 'COMPLETED'
                                ? 'success'
                                : 'progress'
                            }
                          />
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span className="muted-text">
                    No visit history for this vehicle source yet.
                  </span>
                )}
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDealerId(undefined);
              }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!selectedDealer) return;
                setVisitDealer(selectedDealer.name);
                setSelectedDealerId(undefined);
                openVisitDialog();
              }}
            >
              <CalendarPlus /> Schedule visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
