import { useEffect, useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import {
  GroupedDataGrid,
  type GroupedDataGridColumn,
  type GroupedDataGridGroup,
} from '@coverland-engineering/ui/grouped-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  Armchair,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FolderKanban,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Search,
  Siren,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { userName } from '@/shared/domain/app-user';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PROJECT_PIPELINES } from '@/shared/domain/project-stage';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type {
  ProductType,
  VehicleConfiguration,
  VehicleProjectGroup,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import {
  EMPTY_INTAKES,
  INTAKE_KEY,
  intakesSchema,
} from '@/modules/rd-workspace/intake-model';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import {
  projectStagePlan,
  readStageDurationRevisions,
  STAGE_PRIORITIES,
  stageTarget,
  type StagePriority,
} from '@/app/stage-duration-model';
import '@/modules/rd-workspace/rd-workspace.css';
import { VEHICLE_CONFIGURATIONS as INITIAL_CONFIGURATIONS } from '@/app/workbench-mock-data';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ProjectDetailBoundary } from '../components/project-detail-boundary';
import {
  ProjectDetailView,
  toDetailTab,
} from '../components/project-detail-view';
import { ProjectStageBoard } from '../components/project-stage-board';
import { ProjectViewTabs } from '../components/project-view-tabs';
import {
  countProjectHealth,
  currentStageTiming,
  filterProjectsByHealth,
  parseHealthFilter,
  projectHealth,
} from '../project-health';
import '../project-health.css';
import './vehicle-projects-page.css';

const PROJECT_STAGE_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Vehicle Hunt', value: 'Vehicle Hunt' },
  { label: 'Scan', value: 'Scan' },
  { label: '3D Model', value: '3D Model' },
  { label: 'Fit Review', value: 'Fit Review' },
  { label: 'Design', value: 'Design' },
  { label: 'Sample', value: 'Sample' },
  { label: 'Fitting', value: 'Fitting' },
  { label: 'Complete', value: 'Approved' },
] as const;
type ProjectStageFilter = (typeof PROJECT_STAGE_FILTERS)[number]['value'];

function matchesStageFilter(
  project: VehicleProjectGroup,
  zoneProject: VehicleZoneProject,
  filter: ProjectStageFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') {
    return (
      project.status === 'PENDING' || zoneProject.currentStage === 'Research'
    );
  }
  return zoneProject.currentStage === filter;
}
const INITIAL_CONFIGURATION_IDS = new Set(
  INITIAL_CONFIGURATIONS.map((configuration) => configuration.id),
);
const WIZARD_STEPS = [
  'Product Type',
  'Vehicle Configuration',
  'Zones',
  'Priority & Timing',
  'Review',
] as const;
const PRIORITY_PRESENTATION: Record<
  StagePriority,
  { label: string; pace: string }
> = {
  URGENT: { label: 'Critical', pace: '50% of standard' },
  HIGH: { label: 'Accelerated', pace: '75% of standard' },
  NORMAL: { label: 'Standard', pace: '100% of standard' },
  LOW: { label: 'Flexible', pace: '150% of standard' },
};
const PRODUCT_CHOICES: readonly {
  id: string;
  name: ProductType;
  code: string;
  icon: typeof Armchair;
}[] = [
  { id: 'PT-SC', name: 'Seat Cover', code: 'SC', icon: Armchair },
  { id: 'PT-CC', name: 'Car Cover', code: 'CC', icon: CarFront },
  { id: 'PT-FM', name: 'Floor Mat', code: 'FM', icon: RectangleHorizontal },
];

const PROJECT_MANAGERS = [
  { id: 'USR-KAI', name: 'Kai' },
  { id: 'USR-YOUNG', name: 'Young' },
  { id: 'USR-CHRISTIAN', name: 'Christian' },
  { id: 'USR-JH', name: 'JH' },
] as const;

interface ProjectZoneGridRow {
  project: VehicleProjectGroup;
  zone: VehicleZoneProject;
}

function vehicleParts(vehicle: string) {
  const match = /^(\d{4}(?:–\d{4})?)\s+(.+)$/.exec(vehicle);
  return match
    ? { years: match[1], name: match[2] }
    : { years: '', name: vehicle };
}

function zonesForConfiguration(
  product: ProductType,
  configuration: VehicleConfiguration,
) {
  if (product === 'Car Cover') return ['EX'] as const;
  const option: Partial<Record<string, string>> = Object.fromEntries(
    configuration.options,
  );
  const hasThirdRow =
    (Boolean(option['3rd Row Seat']) && option['3rd Row Seat'] !== 'N/A') ||
    /7|8/.test(option.Seats ?? '');
  return hasThirdRow ? ['F', 'B', 'E'] : ['F', 'B'];
}

function zoneLabel(product: ProductType, zone: string) {
  if (zone === 'EX') return 'Exterior';
  if (product === 'Floor Mat') {
    return { F: 'Front Row Floor', B: '2nd Row Floor', E: '3rd Row Floor' }[
      zone
    ];
  }
  return { F: 'Front Row', B: '2nd Row', E: '3rd Row' }[zone];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function stageDay(zone: VehicleZoneProject, currentDate: string) {
  const timing = currentStageTiming(zone);
  if (!timing?.startedAt) return undefined;
  const started = Date.parse(timing.startedAt);
  const current = Date.parse(`${currentDate}T00:00:00`);
  if (!Number.isFinite(started) || !Number.isFinite(current)) return undefined;
  return Math.max(1, Math.floor((current - started) / 86_400_000) + 1);
}

function stageDuration(zone: VehicleZoneProject) {
  const timing = currentStageTiming(zone);
  if (!timing?.startedAt || !timing.targetDueAt) return undefined;
  const started = Date.parse(timing.startedAt);
  const due = Date.parse(timing.targetDueAt);
  if (!Number.isFinite(started) || !Number.isFinite(due)) return undefined;
  return Math.max(1, Math.round((due - started) / 86_400_000));
}

function healthLabel(zone: VehicleZoneProject, currentDate: string) {
  const health = projectHealth(zone, currentDate);
  const days = /(\d+) days?/i.exec(health.reason)?.[1];
  if (health.value === 'late') return days ? `Overdue +${days}d` : 'Overdue';
  if (health.value === 'at-risk') {
    return health.reason === 'On hold'
      ? 'On hold'
      : days
        ? `Due in ${days}d`
        : 'At risk';
  }
  if (health.value === 'watch') return days ? `Watch · ${days}d` : 'Watch';
  if (health.value === 'complete') return 'Complete';
  if (health.value === 'inactive') return 'Inactive';
  if (health.value === 'unknown') return 'Needs data';
  return 'On track';
}

/** Product-development project groups by vehicle configuration. */
export function VehicleProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = today();
  const healthFilter = parseHealthFilter(searchParams.get('health'));
  const { records: intakes } = useRdRecords(
    INTAKE_KEY,
    intakesSchema,
    EMPTY_INTAKES,
  );
  const intake = intakes.find(
    (entry) => entry.id === searchParams.get('intake'),
  );
  const { configurations, projects, setConfigurations, setProjects, appUsers } =
    useWorkbenchStore();
  const [stageFilter, setStageFilter] = useState<ProjectStageFilter>('ALL');
  const [product, setProduct] = useState('ALL');
  const [managerFilter, setManagerFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const hasActiveFilter =
    query !== '' ||
    product !== 'ALL' ||
    stageFilter !== 'ALL' ||
    managerFilter !== 'ALL' ||
    priorityFilter !== 'ALL';
  function clearFilters(): void {
    setQuery('');
    setProduct('ALL');
    setStageFilter('ALL');
    setManagerFilter('ALL');
    setPriorityFilter('ALL');
  }
  const selectedProject = searchParams.get('project') ?? undefined;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardPriority, setWizardPriority] = useState<StagePriority>('NORMAL');
  const [wizardPlan, setWizardPlan] = useState<
    { stage: string; targetDays: number }[]
  >([]);
  const [wizardProduct, setWizardProduct] = useState<ProductType>('Seat Cover');
  const [wizardConfigurationId, setWizardConfigurationId] = useState<string>();
  const [wizardManagerId, setWizardManagerId] = useState('USR-KAI');

  const [wizardMessage, setWizardMessage] = useState('');
  const searchedProjects = projects.flatMap((project) => {
    const matchesProduct = product === 'ALL' || project.product === product;
    if (!matchesProduct) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const vehicleMatches =
      `${project.vehicle} ${project.id} ${project.fNumber ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    const zoneProjects = project.zoneProjects.filter((zone) => {
      const manager = userName(appUsers, zone.managerId);
      const matchesManager =
        managerFilter === 'ALL' || zone.managerId === managerFilter;
      const matchesPriority =
        priorityFilter === 'ALL' ||
        (priorityFilter === 'CRITICAL' &&
          (zone.priority === 'URGENT' || zone.priority === 'HIGH')) ||
        (zone.priority ?? 'NORMAL') === priorityFilter;
      const matchesQuery =
        !normalizedQuery ||
        vehicleMatches ||
        `${zone.label} ${zone.id} ${manager}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesManager && matchesPriority && matchesQuery;
    });
    return zoneProjects.length ? [{ ...project, zoneProjects }] : [];
  });
  const stageCounts = new Map(
    PROJECT_STAGE_FILTERS.map((filter) => [
      filter.value,
      searchedProjects.reduce(
        (count, project) =>
          count +
          project.zoneProjects.filter((zoneProject) =>
            matchesStageFilter(project, zoneProject, filter.value),
          ).length,
        0,
      ),
    ]),
  );
  const stageProjects = searchedProjects.flatMap((project) => {
    const zoneProjects = project.zoneProjects.filter((zoneProject) =>
      matchesStageFilter(project, zoneProject, stageFilter),
    );
    return zoneProjects.length ? [{ ...project, zoneProjects }] : [];
  });
  const healthCounts = countProjectHealth(stageProjects, currentDate);
  const visibleProjects = filterProjectsByHealth(
    stageProjects,
    healthFilter,
    currentDate,
  );
  const {
    pageItems: pagedProjects,
    pagination,
    setPagination,
  } = useWorkbenchPagination(
    visibleProjects,
    `${stageFilter}|${product}|${managerFilter}|${priorityFilter}|${query}|${healthFilter}`,
  );
  const detailProject = projects.find(
    (project) => project.id === selectedProject,
  );
  const wizardConfiguration = configurations.find(
    (configuration) => configuration.id === wizardConfigurationId,
  );
  const wizardZones = wizardConfiguration
    ? zonesForConfiguration(wizardProduct, wizardConfiguration)
    : [];
  const wizardProductChoice = PRODUCT_CHOICES.find(
    (choice) => choice.name === wizardProduct,
  );
  const nextProjectGroupId = `PG-${String(
    projects.reduce((largest, project) => {
      const value = Number(project.id.replace(/\D/g, ''));
      return Number.isFinite(value) ? Math.max(largest, value) : largest;
    }, 0) + 1,
  ).padStart(5, '0')}`;

  useEffect(() => {
    const requestedConfigurationId = searchParams.get('configuration');
    if (
      searchParams.get('new') !== '1' ||
      !requestedConfigurationId ||
      !configurations.some(
        (configuration) => configuration.id === requestedConfigurationId,
      )
    ) {
      return;
    }
    setWizardStep(1);
    setWizardProduct(intake?.product ?? 'Seat Cover');
    setWizardPriority(intake?.priority ?? 'NORMAL');
    setWizardPlan([]);
    setWizardConfigurationId(requestedConfigurationId);
    setWizardManagerId('USR-KAI');
    setWizardMessage('');
    setWizardOpen(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('new');
      next.delete('configuration');
      return next;
    });
  }, [configurations, searchParams, setSearchParams, intake]);

  const openProject = (projectId: string, zoneCode?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('project', projectId);
      if (zoneCode) next.set('zone', zoneCode);
      else next.delete('zone');
      next.delete('tab');
      return next;
    });
  };

  const closeProject = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('project');
      next.delete('zone');
      next.delete('tab');
      return next;
    });
  };

  const openWizard = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('intake');
      return next;
    });
    setWizardStep(1);
    setWizardProduct('Seat Cover');
    setWizardPriority('NORMAL');
    setWizardPlan([]);
    setWizardConfigurationId(undefined);
    setWizardManagerId('USR-KAI');
    setWizardMessage('');
    setWizardOpen(true);
  };

  const setHealthFilter = (value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'all') next.delete('health');
      else next.set('health', value);
      return next;
    });
  };

  const chooseProduct = (nextProduct: ProductType) => {
    setWizardProduct(nextProduct);
    setWizardPlan([]);
    setWizardConfigurationId((current) =>
      current &&
      !projects.some(
        (project) =>
          project.vehicleResearchId === current &&
          project.product === nextProduct,
      )
        ? current
        : undefined,
    );
    setWizardMessage('');
  };

  const createProject = () => {
    if (
      !wizardPlan.length ||
      wizardPlan.some(
        (entry) =>
          !Number.isInteger(entry.targetDays) ||
          entry.targetDays < 1 ||
          entry.targetDays > 365,
      )
    ) {
      setWizardMessage('Enter 1–365 whole days for every stage.');
      return;
    }
    if (!wizardConfiguration) return;
    if (!wizardProductChoice) return;
    if (searchParams.has('intake') && !intake) {
      setWizardMessage(
        'Unable to read the original development request. Start again from Requests.',
      );
      return;
    }
    if (
      intake &&
      (intake.status !== 'Development approved' ||
        intake.configurationId !== wizardConfiguration.id ||
        intake.product !== wizardProduct)
    ) {
      setWizardMessage(
        'The configuration and product must match the approved request. Review the request again.',
      );
      return;
    }
    if (
      projects.some(
        (project) =>
          project.vehicleResearchId === wizardConfiguration.id &&
          project.product === wizardProduct,
      )
    ) {
      setWizardMessage(
        'A project already exists for this configuration and product. Check the existing project.',
      );
      return;
    }
    const projectGroupId = nextProjectGroupId;
    const standards = readStageDurationRevisions();
    const startedAt = new Date().toISOString();
    const zoneProjects: readonly VehicleZoneProject[] = wizardZones.map(
      (code) => {
        const initialStage =
          wizardProduct === 'Car Cover' ? '3D Model' : 'Vehicle Hunt';
        return {
          id: `${projectGroupId}-${code}`,
          projectGroupId,
          productTypeId: wizardProductChoice.id,
          vehicleResearchId: wizardConfiguration.id,
          zoneId: `ZONE-${wizardProductChoice.code}-${code}`,
          code,
          label: zoneLabel(wizardProduct, code) ?? code,
          managerId: wizardManagerId,
          currentStage: initialStage,
          status: 'ACTIVE',
          priority: wizardPriority,
          stageTargetDays: wizardPlan.map((entry) => ({ ...entry })),
          lastActivityAt: startedAt,
          stageHistory: [
            {
              id: crypto.randomUUID(),
              stage: initialStage,
              stageSequence: 1,
              startedAt,
              ...stageTarget(
                standards,
                wizardProductChoice.id,
                initialStage,
                startedAt,
                wizardPriority,
                wizardPlan,
              ),
            },
          ],
        };
      },
    );
    const newProject: VehicleProjectGroup = {
      id: projectGroupId,
      productTypeId: wizardProductChoice.id,
      vehicle: wizardConfiguration.vehicle,
      vehicleResearchId: wizardConfiguration.id,
      options: wizardConfiguration.options,
      product: wizardProduct,
      zoneProjects,
      stage: wizardProduct === 'Car Cover' ? '3D Model' : 'Vehicle Hunt',
      status: 'IN PROGRESS',
      created: new Date().toISOString().slice(0, 10),
    };
    setProjects((current) => [...current, newProject]);
    setConfigurations((current) =>
      current.map((configuration) =>
        configuration.id === wizardConfiguration.id
          ? {
              ...configuration,
              projectGroupIds: [
                ...configuration.projectGroupIds,
                newProject.id,
              ],
            }
          : configuration,
      ),
    );
    setWizardOpen(false);
    openProject(newProject.id, zoneProjects[0]?.code);
  };

  const continueWizard = () => {
    setWizardMessage('');
    if (wizardStep === 2 && !wizardConfigurationId) {
      setWizardMessage('Select one vehicle configuration.');
      return;
    }
    if (wizardStep === 3 && !wizardPlan.length)
      setWizardPlan(projectStagePlan(wizardProduct, wizardPriority));
    if (
      wizardStep === 4 &&
      wizardPlan.some(
        (entry) =>
          !Number.isInteger(entry.targetDays) ||
          entry.targetDays < 1 ||
          entry.targetDays > 365,
      )
    ) {
      setWizardMessage('Enter 1–365 whole days for every stage.');
      return;
    }
    if (wizardStep === 5) {
      createProject();
      return;
    }
    setWizardStep((current) => Math.min(5, current + 1));
  };

  const urgentAndHigh = stageProjects.reduce(
    (count, project) =>
      count +
      project.zoneProjects.filter(
        (zone) => zone.priority === 'URGENT' || zone.priority === 'HIGH',
      ).length,
    0,
  );
  const managerOptions = Array.from(
    new Set(
      projects.flatMap((project) =>
        project.zoneProjects.map((zone) => zone.managerId),
      ),
    ),
  );
  const projectGridColumns: GroupedDataGridColumn<ProjectZoneGridRow>[] = [
    {
      id: 'zone',
      header: 'Zone project',
      width: 250,
      hideable: false,
      sortValue: ({ project, zone }) =>
        `${project.vehicle} ${zone.label} ${zone.id}`,
      cell: ({ project, zone }) => (
        <button
          type="button"
          className="vp-grid-zone-link"
          onClick={() => {
            openProject(project.id, zone.code);
          }}
        >
          <span className={`zone zone-${zone.code.toLowerCase()}`}>
            {zone.code}
          </span>
          <span>
            <strong>{zone.label}</strong>
            <small>{zone.id}</small>
          </span>
        </button>
      ),
    },
    {
      id: 'stage',
      header: 'Current stage',
      width: 260,
      sortValue: ({ project, zone }) => {
        const pipeline = PROJECT_PIPELINES[project.product];
        return pipeline.indexOf(zone.currentStage);
      },
      cell: ({ project, zone }) => {
        const pipeline = PROJECT_PIPELINES[project.product];
        const stageIndex = Math.max(0, pipeline.indexOf(zone.currentStage));
        const health = projectHealth(zone, currentDate);
        const day = stageDay(zone, currentDate);
        const duration = stageDuration(zone);
        return (
          <span className="vp-stage-cell">
            <span>
              <strong>
                {zone.currentStage === 'Approved'
                  ? 'Complete'
                  : zone.currentStage}
              </strong>
              <small>
                {zone.currentStage === 'Approved'
                  ? `${String(pipeline.length)} stages complete`
                  : day && duration
                    ? `Day ${String(day)} of ${String(duration)}`
                    : `Stage ${String(stageIndex + 1)} of ${String(pipeline.length)}`}
              </small>
            </span>
            <span className="vp-stage-track" aria-hidden="true">
              {pipeline.map((stageName, index) => (
                <i
                  key={stageName}
                  className={
                    index < stageIndex
                      ? 'complete'
                      : index === stageIndex
                        ? `current health-${health.value}`
                        : undefined
                  }
                />
              ))}
            </span>
          </span>
        );
      },
    },
    {
      id: 'schedule',
      header: 'Schedule',
      width: 145,
      sortValue: ({ zone }) => {
        const order = [
          'late',
          'at-risk',
          'watch',
          'unknown',
          'on-track',
          'complete',
          'inactive',
        ];
        return order.indexOf(projectHealth(zone, currentDate).value);
      },
      cell: ({ zone }) => {
        const health = projectHealth(zone, currentDate);
        return (
          <span
            className={`vp-health-badge health-${health.value}`}
            title={health.reason}
          >
            {healthLabel(zone, currentDate)}
          </span>
        );
      },
    },
    {
      id: 'manager',
      header: 'Manager',
      width: 145,
      sortValue: ({ zone }) => userName(appUsers, zone.managerId),
      cell: ({ zone }) => {
        const manager = userName(appUsers, zone.managerId);
        return (
          <span className="vp-manager">
            <span className="vp-avatar">{initials(manager)}</span>
            <strong>{manager}</strong>
          </span>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      width: 115,
      sortValue: ({ zone }) => {
        const order = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
        return order.indexOf(zone.priority ?? 'NORMAL');
      },
      cell: ({ zone }) => {
        const priority = zone.priority ?? 'NORMAL';
        return (
          <span
            className={`vp-priority-badge vp-priority-${priority.toLowerCase()}`}
          >
            {priority[0] + priority.slice(1).toLowerCase()}
          </span>
        );
      },
    },
    {
      id: 'sample',
      header: 'Sample',
      width: 90,
      sortValue: ({ zone }) =>
        zone.stageHistory?.filter((entry) => entry.stage === 'Sample').length ??
        0,
      cell: ({ zone }) => {
        const sampleRound =
          zone.stageHistory?.filter((entry) => entry.stage === 'Sample')
            .length ?? 0;
        return (
          <span className="vp-sample-value">
            {sampleRound ? `R${String(sampleRound)}` : '—'}
          </span>
        );
      },
    },
    {
      id: 'shape',
      header: 'Shape',
      width: 180,
      sortValue: ({ zone }) => zone.productShapeId ?? '',
      cell: ({ zone }) => (
        <span className="vp-shape-value">
          <strong>{zone.productShapeId ?? '—'}</strong>
          <small>{zone.productShapeId ? 'In development' : 'Not issued'}</small>
        </span>
      ),
    },
  ];
  const projectGridGroups: GroupedDataGridGroup<ProjectZoneGridRow>[] =
    pagedProjects.map((project) => {
      const vehicle = vehicleParts(project.vehicle);
      const optionSummary = project.options
        .map(([label, value]) => `${label}: ${value}`)
        .join(' · ');
      return {
        id: project.id,
        title: vehicle.name,
        description: [vehicle.years, project.id].filter(Boolean).join(' · '),
        rows: project.zoneProjects.map((zone) => ({ project, zone })),
        meta: (
          <div className="vp-grid-group-meta">
            <span
              className={`vp-product-badge vp-product-${project.product.toLowerCase().replace(/ /g, '-')}`}
            >
              {project.product}
            </span>
            <span className="vp-option-summary" title={optionSummary}>
              {optionSummary}
            </span>
            <span className="vp-zone-count">
              {project.zoneProjects.length} zones
            </span>
          </div>
        ),
      };
    });

  if (detailProject) {
    return (
      <ProjectDetailBoundary key={detailProject.id} onBack={closeProject}>
        <ProjectDetailView
          project={detailProject}
          zoneCode={searchParams.get('zone') ?? undefined}
          onBack={closeProject}
          onSelectZone={(zoneCode) => {
            openProject(detailProject.id, zoneCode);
          }}
          initialTab={toDetailTab(searchParams.get('tab'))}
        />
      </ProjectDetailBoundary>
    );
  }

  return (
    <section className="vehicle-projects-page">
      <header className="vp-page-header">
        <div className="workbench-heading">
          <h1>Vehicle Projects</h1>
          <p>
            Seat Cover · Floor Mat · Car Cover — sorted by schedule risk and
            priority
          </p>
        </div>
        <Button variant="primary" onClick={openWizard}>
          <Plus /> New Project
        </Button>
      </header>

      <div className="vp-summary-grid" aria-label="Project summary">
        {[
          {
            key: 'all',
            label: 'Active projects',
            value: stageProjects.filter((project) =>
              project.zoneProjects.some(
                (zone) =>
                  !['Approved'].includes(zone.currentStage) &&
                  !['CANCELLED', 'MERGED'].includes(zone.status ?? 'ACTIVE'),
              ),
            ).length,
            icon: FolderKanban,
          },
          {
            key: 'late',
            label: 'Overdue',
            value: healthCounts.late,
            icon: Siren,
          },
          {
            key: 'at-risk',
            label: 'Due soon (≤2d)',
            value: healthCounts['at-risk'],
            icon: Clock3,
          },
          {
            key: 'watch',
            label: 'Needs attention',
            value: healthCounts.watch + healthCounts.unknown,
            icon: CircleAlert,
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              type="button"
              className={`vp-summary-card vp-summary-${metric.key}`}
              aria-pressed={healthFilter === metric.key}
              key={metric.key}
              onClick={() => {
                setHealthFilter(
                  healthFilter === metric.key ? 'all' : metric.key,
                );
              }}
            >
              <span>
                <Icon aria-hidden="true" />
                {metric.label}
              </span>
              <strong>{metric.value}</strong>
            </button>
          );
        })}
        <button
          type="button"
          className="vp-summary-card vp-summary-priority"
          aria-pressed={priorityFilter === 'CRITICAL'}
          onClick={() => {
            setPriorityFilter(
              priorityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL',
            );
          }}
        >
          <span>
            <Siren aria-hidden="true" /> Urgent &amp; High
          </span>
          <strong>{urgentAndHigh}</strong>
        </button>
      </div>

      <ProjectViewTabs
        boardToolbar={
          <div className="vp-toolbar">
            <label className="vp-search">
              <Search aria-hidden="true" />
              <input
                aria-label="Search projects"
                placeholder="Search vehicle, project, manager"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </label>
            <label className="vp-select-field">
              <span>Category</span>
              <select
                value={product}
                onChange={(event) => {
                  setProduct(event.target.value);
                }}
              >
                <option value="ALL">All products</option>
                {PRODUCT_CHOICES.map((choice) => (
                  <option key={choice.id}>{choice.name}</option>
                ))}
              </select>
            </label>
            <label className="vp-select-field">
              <span>Stage</span>
              <select
                value={stageFilter}
                onChange={(event) => {
                  const filter = PROJECT_STAGE_FILTERS.find(
                    (entry) => entry.value === event.target.value,
                  );
                  if (filter) setStageFilter(filter.value);
                }}
              >
                {PROJECT_STAGE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label} ({stageCounts.get(filter.value) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <label className="vp-select-field">
              <span>Manager</span>
              <select
                value={managerFilter}
                onChange={(event) => {
                  setManagerFilter(event.target.value);
                }}
              >
                <option value="ALL">All managers</option>
                {managerOptions.map((managerId) => (
                  <option value={managerId} key={managerId}>
                    {userName(appUsers, managerId)}
                  </option>
                ))}
              </select>
            </label>
            <div className="vp-priority-filter" aria-label="Priority filter">
              {['URGENT', 'HIGH', 'NORMAL', 'LOW'].map((priority) => (
                <button
                  type="button"
                  className={`vp-priority vp-priority-${priority.toLowerCase()}`}
                  aria-pressed={priorityFilter === priority}
                  key={priority}
                  onClick={() => {
                    setPriorityFilter(
                      priorityFilter === priority ? 'ALL' : priority,
                    );
                  }}
                >
                  {priority[0] + priority.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            {hasActiveFilter && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X /> Clear filters
              </Button>
            )}
          </div>
        }
        board={
          <div className="rd-workspace p-5">
            <ProjectStageBoard
              currentDate={currentDate}
              projects={visibleProjects}
              onOpen={openProject}
            />
          </div>
        }
        list={
          <GroupedDataGrid
            label="Vehicle Projects"
            columns={projectGridColumns}
            groups={projectGridGroups}
            getRowId={({ zone }) => zone.id}
            sorting={{ mode: 'client' }}
            colors={{
              primary: 'var(--wb-blue)',
              primaryForeground: '#FFFFFF',
              primarySoft: 'var(--wb-soft-blue)',
            }}
            search={{
              label: 'Search projects',
              placeholder: 'Search vehicle, project, manager',
              value: query,
              onChange: setQuery,
            }}
            filters={[
              {
                id: 'product',
                label: 'Product filter',
                value: product,
                onChange: setProduct,
                options: [
                  { value: 'ALL', label: 'All products' },
                  ...PRODUCT_CHOICES.map((choice) => ({
                    value: choice.name,
                    label: choice.name,
                  })),
                ],
              },
              {
                id: 'stage',
                label: 'Stage filter',
                value: stageFilter,
                onChange: (value) => {
                  const filter = PROJECT_STAGE_FILTERS.find(
                    (entry) => entry.value === value,
                  );
                  if (filter) setStageFilter(filter.value);
                },
                options: PROJECT_STAGE_FILTERS.map((filter) => ({
                  value: filter.value,
                  label: `${filter.label} (${String(stageCounts.get(filter.value) ?? 0)})`,
                })),
              },
              {
                id: 'manager',
                label: 'Manager filter',
                value: managerFilter,
                onChange: setManagerFilter,
                options: [
                  { value: 'ALL', label: 'All managers' },
                  ...managerOptions.map((managerId) => ({
                    value: managerId,
                    label: userName(appUsers, managerId),
                  })),
                ],
              },
              {
                id: 'priority',
                label: 'Priority filter',
                value: priorityFilter,
                onChange: setPriorityFilter,
                options: [
                  { value: 'ALL', label: 'All priorities' },
                  { value: 'CRITICAL', label: 'Urgent & High' },
                  { value: 'URGENT', label: 'Urgent' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'NORMAL', label: 'Normal' },
                  { value: 'LOW', label: 'Low' },
                ],
              },
            ]}
            toolbarContent={
              hasActiveFilter && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  <X /> Clear filters
                </Button>
              )
            }
            emptyMessage="No projects match these filters."
            pagination={{
              page: pagination.pageIndex + 1,
              pageSize: pagination.pageSize,
              totalCount: visibleProjects.length,
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
        }
      />
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="project-wizard-dialog">
          <DialogHeader>
            <DialogTitle>Create Vehicle Project</DialogTitle>
          </DialogHeader>
          <DialogBody className="project-wizard-body">
            <div className="wizard-steps">
              {WIZARD_STEPS.map((stepName, index) => {
                const stepNumber = index + 1;
                return (
                  <div
                    className={`wizard-step${stepNumber === wizardStep ? ' wizard-step-current' : ''}${stepNumber < wizardStep ? ' wizard-step-complete' : ''}`}
                    key={stepName}
                  >
                    {stepNumber < wizardStep && <Check aria-hidden="true" />}
                    {stepNumber} {stepName}
                  </div>
                );
              })}
            </div>
            {wizardStep === 1 && (
              <>
                <p className="dialog-section-title">
                  What product are you developing?
                </p>
                <div className="product-choice-grid">
                  {PRODUCT_CHOICES.map((choice) => {
                    const Icon = choice.icon;
                    return (
                      <button
                        type="button"
                        className={
                          wizardProduct === choice.name ? 'selected' : undefined
                        }
                        key={choice.name}
                        onClick={() => {
                          chooseProduct(choice.name);
                        }}
                      >
                        <Icon aria-hidden="true" />
                        <strong>{choice.name}</strong>
                        <small>
                          {choice.code} · {choice.id}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="dialog-note">
                  Select a product type first to apply its zones and development
                  pipeline automatically.
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <div className="wizard-configuration-step">
                <div className="wizard-section-heading">
                  <p>
                    <strong>Select Vehicle Configuration</strong>
                    <span>
                      {' '}
                      — Completed research only · One selection = one project
                      group
                    </span>
                  </p>
                  <div className="wizard-fnumber-note">
                    <strong>F-Number: Not assigned</strong>
                    <span>
                      ⓘ F# will be assigned after the configuration is confirmed
                      through development / fitting.
                    </span>
                  </div>
                </div>
                {configurations
                  .filter(
                    (configuration) =>
                      configuration.researchStatus === 'COMPLETE' ||
                      !INITIAL_CONFIGURATION_IDS.has(configuration.id),
                  )
                  .map((configuration, index, configurations) => {
                    const vehicle = vehicleParts(configuration.vehicle);
                    const previousVehicle = configurations[index - 1]?.vehicle;
                    const usedProject = projects.find(
                      (project) =>
                        project.vehicleResearchId === configuration.id &&
                        project.product === wizardProduct,
                    );
                    const otherProjects = projects.filter(
                      (project) =>
                        project.vehicleResearchId === configuration.id &&
                        project.product !== wizardProduct,
                    );
                    return (
                      <div key={configuration.id}>
                        {configuration.vehicle !== previousVehicle && (
                          <div className="wizard-vehicle-heading">
                            <strong>{vehicle.name}</strong>
                            <span>{vehicle.years}</span>
                            <StatusBadge
                              label="RESEARCH COMPLETE"
                              tone="success"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          className={`wizard-configuration-option${wizardConfigurationId === configuration.id ? ' selected' : ''}`}
                          disabled={Boolean(usedProject)}
                          onClick={() => {
                            setWizardConfigurationId(configuration.id);
                            setWizardMessage('');
                          }}
                        >
                          <span className="wizard-radio" aria-hidden="true" />
                          <span>
                            <ConfigChips options={configuration.options} />
                            {usedProject && (
                              <small>
                                {wizardProduct} already in development in{' '}
                                {usedProject.id} — cannot select
                              </small>
                            )}
                            {!usedProject && otherProjects.length > 0 && (
                              <small>
                                In development for another product type:{' '}
                                {otherProjects
                                  .map(
                                    (project) =>
                                      `${project.product} ${project.id}`,
                                  )
                                  .join(', ')}{' '}
                                — {wizardProduct} can be started
                              </small>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {wizardStep === 3 && wizardConfiguration && (
              <div className="wizard-zone-step">
                <div className="wizard-zone-heading">
                  <strong>Zone Project Settings</strong>
                  <span>— Confirm the zones and assignee</span>
                </div>
                <p className="wizard-configuration-summary">
                  {wizardConfiguration.vehicle} ·{' '}
                  {wizardConfiguration.options
                    .map(([, value]) => value)
                    .join(' / ')}
                </p>
                <div className="wizard-project-defaults">
                  <label>
                    Project Manager
                    <Select
                      value={wizardManagerId}
                      onValueChange={setWizardManagerId}
                    >
                      <SelectTrigger aria-label="Project Manager">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_MANAGERS.map((manager) => (
                          <SelectItem value={manager.id} key={manager.id}>
                            {manager.name} · {manager.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="wizard-zone-project-settings">
                  {wizardZones.map((zone) => {
                    return (
                      <section
                        className="wizard-zone-project-setting"
                        key={zone}
                      >
                        <div className="wizard-zone-project-heading">
                          <span className={`zone zone-${zone.toLowerCase()}`}>
                            {zone}
                          </span>
                          <div>
                            <strong>{zoneLabel(wizardProduct, zone)}</strong>
                            <small>
                              {nextProjectGroupId}-{zone} · vehicle_zone_id
                              ZONE-{wizardProductChoice?.code}-{zone}
                            </small>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
                <div className="dialog-note wizard-rule-note">
                  <strong>Handoff completes project development.</strong> After
                  parts, samples, fitting, and handoff are complete, use Shapes
                  for final review, approval, issuance, and composition. The
                  assignee applies to each created zone project.
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="wizard-timing-step">
                <header className="wizard-timing-heading">
                  <span className="wizard-timing-icon" aria-hidden="true">
                    <Clock3 />
                  </span>
                  <div>
                    <h3>Set project pace</h3>
                    <p>
                      Choose one priority for all zone projects, then fine-tune
                      the target days for each development stage.
                    </p>
                  </div>
                  <div className="wizard-timing-total">
                    <span>Planned timeline</span>
                    <strong>
                      {String(
                        wizardPlan.reduce(
                          (total, entry) => total + entry.targetDays,
                          0,
                        ),
                      )}{' '}
                      days
                    </strong>
                  </div>
                </header>

                <section className="wizard-timing-section">
                  <div className="wizard-timing-section-heading">
                    <div>
                      <span className="wizard-timing-kicker">
                        Project priority
                      </span>
                      <strong>{wizardPriority}</strong>
                    </div>
                    <span>Updates the stage defaults below</span>
                  </div>
                  <div
                    className="wizard-priority-options"
                    role="radiogroup"
                    aria-label="Project priority"
                  >
                    {STAGE_PRIORITIES.map((priority) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={wizardPriority === priority}
                        className={`wizard-priority-option priority-${priority.toLowerCase()}`}
                        key={priority}
                        onClick={() => {
                          setWizardPriority(priority);
                          setWizardPlan(
                            projectStagePlan(wizardProduct, priority),
                          );
                        }}
                      >
                        <span className="wizard-priority-radio" />
                        <strong>{priority}</strong>
                        <small>{PRIORITY_PRESENTATION[priority].label}</small>
                        <em>{PRIORITY_PRESENTATION[priority].pace}</em>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="wizard-timing-section">
                  <div className="wizard-timing-section-heading">
                    <div>
                      <span className="wizard-timing-kicker">
                        Stage target days
                      </span>
                      <strong>Project-specific schedule</strong>
                    </div>
                    <Button
                      variant="outline"
                      className="wizard-timing-reload"
                      onClick={() => {
                        setWizardPlan(
                          projectStagePlan(wizardProduct, wizardPriority),
                        );
                      }}
                    >
                      <RotateCcw /> Reload defaults
                    </Button>
                  </div>
                  <div className="wizard-timing-grid">
                    {wizardPlan.map((entry, index) => (
                      <label key={entry.stage} className="wizard-timing-field">
                        <span className="wizard-timing-stage-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="wizard-timing-stage-name">
                          {entry.stage}
                          <small>Target duration</small>
                        </span>
                        <span className="wizard-timing-input">
                          <Input
                            aria-label={`${entry.stage} target days`}
                            type="number"
                            min={1}
                            max={365}
                            step={1}
                            value={entry.targetDays || ''}
                            onChange={(event) => {
                              const days = Number(event.target.value);
                              setWizardPlan((current) =>
                                current.map((row, i) =>
                                  i === index
                                    ? { ...row, targetDays: days }
                                    : row,
                                ),
                              );
                            }}
                          />
                          <small>days</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                <p className="wizard-timing-note">
                  <Clock3 aria-hidden="true" />
                  These values are copied from Stage Standards. Your edits apply
                  only to this project and can be changed later.
                </p>
              </div>
            )}
            {wizardStep === 5 && wizardConfiguration && (
              <div className="wizard-review-step">
                <div className="wizard-review-card full-width">
                  <span>PRIORITY & TARGET DAYS</span>
                  <strong>{wizardPriority}</strong>
                  <p>
                    {wizardPlan
                      .map(
                        (entry) =>
                          `${entry.stage}: ${String(entry.targetDays)} days`,
                      )
                      .join(' · ')}
                  </p>
                </div>
                <div className="wizard-review-card">
                  <span>Product</span>
                  <strong>
                    {wizardProduct} · {wizardProductChoice?.id}
                  </strong>
                </div>
                <div className="wizard-review-card">
                  <span>Vehicle</span>
                  <strong>{wizardConfiguration.vehicle}</strong>
                </div>
                <div className="wizard-review-card">
                  <span>Configuration</span>
                  <ConfigChips options={wizardConfiguration.options} />
                </div>
                <div className="wizard-review-card">
                  <span>Project Manager</span>
                  <strong>
                    {PROJECT_MANAGERS.find(
                      (manager) => manager.id === wizardManagerId,
                    )?.name ?? wizardManagerId}{' '}
                    · {wizardManagerId}
                  </strong>
                </div>
                <p className="wizard-projects-label">PROJECTS TO CREATE</p>
                {wizardZones.map((zone) => {
                  return (
                    <div className="wizard-review-card project" key={zone}>
                      <div>
                        <span className={`zone zone-${zone.toLowerCase()}`}>
                          {zone}
                        </span>
                        <span>
                          <strong>{zoneLabel(wizardProduct, zone)}</strong>
                          <small>
                            {nextProjectGroupId}-{zone}
                          </small>
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>product_type_id</dt>
                          <dd>{wizardProductChoice?.id}</dd>
                        </div>
                        <div>
                          <dt>vehicle_zone_id</dt>
                          <dd>
                            ZONE-{wizardProductChoice?.code}-{zone}
                          </dd>
                        </div>
                        <div>
                          <dt>manager_id</dt>
                          <dd>{wizardManagerId}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
                <div className="wizard-fnumber-note full-width">
                  <strong>Shape — Issued after development</strong>
                  <span>
                    Project numbers are generated automatically. Official Shapes
                    are issued after separate post-handoff review and approval.
                  </span>
                </div>
              </div>
            )}

            {wizardMessage && (
              <p className="wizard-validation-message" role="alert">
                {wizardMessage}
              </p>
            )}
          </DialogBody>
          <DialogFooter className="project-wizard-footer">
            <div>
              {wizardStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setWizardMessage('');
                    setWizardStep((current) => current - 1);
                  }}
                >
                  <ChevronLeft /> Back
                </Button>
              )}
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setWizardOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={continueWizard}>
                {wizardStep === 5 ? 'Create Project Group' : 'Continue'}
                {wizardStep < 5 && <ChevronRight />}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
