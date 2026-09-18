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
  Plus,
  RectangleHorizontal,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { userName } from '@/shared/domain/app-user';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PROJECT_PIPELINES } from '@/shared/domain/project-stage';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type {
  ProductType,
  VehicleConfiguration,
  VehicleProjectGroup,
  VehicleZoneProject,
} from '@/shared/types/workbench';
import { resetPartLibrary } from '@/modules/parts/part-library';
import { VEHICLE_CONFIGURATIONS as INITIAL_CONFIGURATIONS } from '@/app/workbench-mock-data';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ProjectDetailBoundary } from '../components/project-detail-boundary';
import {
  ProjectDetailView,
  toDetailTab,
} from '../components/project-detail-view';

const PROJECT_STAGE_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Vehicle Hunt', value: 'Vehicle Hunt' },
  { label: 'Scan', value: 'Scan' },
  { label: 'Design', value: 'Design' },
  { label: 'Sample', value: 'Sample' },
  { label: 'Fitting', value: 'Fitting' },
  { label: '개발 완료', value: 'Approved' },
] as const;
type ProjectStageFilter = (typeof PROJECT_STAGE_FILTERS)[number]['value'];

interface ZoneProjectGridRow {
  project: VehicleProjectGroup;
  zone: VehicleZoneProject;
}

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
  'Review',
] as const;
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

function delayDisplay(zone: VehicleZoneProject) {
  if (zone.status === 'ON_HOLD') {
    return { label: 'ON HOLD', tone: 'warning' as const };
  }
  if (zone.status === 'CANCELLED') {
    return { label: 'CANCELLED', tone: 'neutral' as const };
  }
  if (zone.currentStage === 'Approved') {
    return { label: 'COMPLETE', tone: 'success' as const };
  }
  if (!zone.targetAt) {
    return { label: 'NO TARGET', tone: 'neutral' as const };
  }
  const days = Math.ceil(
    (new Date(zone.targetAt).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) {
    return {
      label: `${String(Math.abs(days))}D OVERDUE`,
      tone: 'danger' as const,
    };
  }
  if (days <= 2) {
    return { label: `DUE IN ${String(days)}D`, tone: 'warning' as const };
  }
  return { label: 'ON TRACK', tone: 'success' as const };
}

function shortDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
      }).format(date);
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

/** Product-development project groups by vehicle configuration. */
export function VehicleProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    configurations,
    projects,
    setConfigurations,
    setProjects,
    resetWorkbench,
    appUsers,
  } = useWorkbenchStore();
  const [stageFilter, setStageFilter] = useState<ProjectStageFilter>('ALL');
  const [product, setProduct] = useState('ALL');
  const [query, setQuery] = useState('');
  const selectedProject = searchParams.get('project') ?? undefined;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardProduct, setWizardProduct] = useState<ProductType>('Seat Cover');
  const [wizardConfigurationId, setWizardConfigurationId] = useState<string>();
  const [wizardManagerId, setWizardManagerId] = useState('USR-KAI');

  const [wizardMessage, setWizardMessage] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const searchedProjects = projects.filter((project) => {
    const matchesProduct = product === 'ALL' || project.product === product;
    const matchesQuery = project.vehicle
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesProduct && matchesQuery;
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
  const visibleProjects = searchedProjects.flatMap((project) => {
    const zoneProjects = project.zoneProjects.filter((zoneProject) =>
      matchesStageFilter(project, zoneProject, stageFilter),
    );
    return zoneProjects.length ? [{ ...project, zoneProjects }] : [];
  });
  const {
    pageItems: pagedProjects,
    pagination,
    setPagination,
  } = useWorkbenchPagination(
    visibleProjects,
    `${stageFilter}|${product}|${query}`,
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
    setWizardProduct('Seat Cover');
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
  }, [configurations, searchParams, setSearchParams]);

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
    setWizardStep(1);
    setWizardProduct('Seat Cover');
    setWizardConfigurationId(undefined);
    setWizardManagerId('USR-KAI');
    setWizardMessage('');
    setWizardOpen(true);
  };

  const chooseProduct = (nextProduct: ProductType) => {
    setWizardProduct(nextProduct);
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
    if (!wizardConfiguration) return;
    if (!wizardProductChoice) return;
    const projectGroupId = nextProjectGroupId;
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
          priority: 'NORMAL',
          lastActivityAt: new Date().toISOString(),
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
      setWizardMessage('Vehicle Configuration을 1개 선택하세요.');
      return;
    }
    if (wizardStep === 4) {
      createProject();
      return;
    }
    setWizardStep((current) => Math.min(4, current + 1));
  };

  const columns: GroupedDataGridColumn<ZoneProjectGridRow>[] = [
    {
      id: 'zone',
      header: 'Zone Project',
      width: 230,
      sortValue: ({ zone }) => zone.label,
      cell: ({ zone }) => (
        <div className="zone-project-identity">
          <span className={`zone zone-${zone.code.toLowerCase()}`}>
            {zone.code}
          </span>
          <span>
            <strong>{zone.label}</strong>
            <code>{zone.id}</code>
          </span>
        </div>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      width: 175,
      sortValue: ({ project, zone }) =>
        PROJECT_PIPELINES[project.product].indexOf(zone.currentStage),
      cell: ({ project, zone }) => {
        const pipeline = PROJECT_PIPELINES[project.product];
        const stageIndex = Math.max(0, pipeline.indexOf(zone.currentStage));
        return (
          <StatusBadge
            label={`${String(stageIndex + 1)} / ${String(pipeline.length)} · ${zone.currentStage === 'Approved' ? '개발 완료' : zone.currentStage}`}
            tone={zone.currentStage === 'Approved' ? 'success' : 'progress'}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: 125,
      sortValue: ({ zone }) => zone.status ?? 'ACTIVE',
      cell: ({ zone }) => (
        <StatusBadge
          label={zone.status ?? 'ACTIVE'}
          tone={zone.status === 'ON_HOLD' ? 'warning' : 'success'}
        />
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      width: 110,
      sortValue: ({ zone }) => userName(appUsers, zone.managerId),
      cell: ({ zone }) => userName(appUsers, zone.managerId),
    },
    {
      id: 'priority',
      header: 'Priority',
      width: 110,
      sortValue: ({ zone }) =>
        ({ LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 })[zone.priority ?? 'NORMAL'],
      cell: ({ zone }) => (
        <StatusBadge
          label={zone.priority ?? 'NORMAL'}
          tone={
            zone.priority === 'URGENT' || zone.priority === 'HIGH'
              ? 'warning'
              : 'neutral'
          }
        />
      ),
    },
    {
      id: 'delay',
      header: 'Delay',
      width: 140,
      sortValue: ({ zone }) => delayDisplay(zone).label,
      cell: ({ zone }) => {
        const delay = delayDisplay(zone);
        return <StatusBadge label={delay.label} tone={delay.tone} />;
      },
    },
    {
      id: 'target',
      header: 'Target',
      width: 100,
      sortValue: ({ zone }) => zone.targetAt,
      cell: ({ zone }) => shortDate(zone.targetAt),
    },
    {
      id: 'updated',
      header: 'Last Update',
      width: 120,
      sortValue: ({ project, zone }) => zone.lastActivityAt ?? project.created,
      cell: ({ project, zone }) =>
        shortDate(zone.lastActivityAt ?? project.created),
    },
  ];
  const groups: GroupedDataGridGroup<ZoneProjectGridRow>[] = pagedProjects.map(
    (project) => {
      const approvedCount = project.zoneProjects.filter(
        (zone) => zone.currentStage === 'Approved',
      ).length;
      return {
        id: project.id,
        title: project.vehicle,
        description: `${project.product} · ${project.id} · ${String(project.zoneProjects.length)} Zone Projects`,
        meta: (
          <>
            <ConfigChips options={project.options} />
            <StatusBadge
              label={`${String(approvedCount)} / ${String(project.zoneProjects.length)} APPROVED`}
              tone={
                approvedCount === project.zoneProjects.length
                  ? 'success'
                  : 'neutral'
              }
            />
          </>
        ),
        rows: project.zoneProjects.map((zone) => ({ project, zone })),
      };
    },
  );

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
    <section>
      <PageHeader
        description="차량·제품별 Zone 개발 프로젝트 · 패턴 → 샘플 → 피팅 → Handoff로 개발 완료 · 이후 Shape 메뉴에서 검토·발급"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_project_group' },
                { name: 'vehicle_project' },
                { name: 'vehicle_project_stage_template' },
                { name: 'vehicle_project_stage' },
                { name: 'vehicle_zone' },
                { name: 'vehicle_product_shape' },
                { name: 'project_x_product_design_item' },
                { name: 'vehicle_product_design' },
                { name: 'vehicle_product_design_revision' },
                { name: 'activity' },
                { name: 'asset' },
              ]
            : undefined
        }
      />

      <GroupedDataGrid
        label="Vehicle Projects"
        columns={columns}
        groups={groups}
        getRowId={({ zone }) => zone.id}
        onRowClick={({ project, zone }) => {
          openProject(project.id, zone.code);
        }}
        rowActionLabel={({ zone }) => `Open ${zone.id}`}
        collapsedGroupIds={collapsedGroups}
        onCollapsedGroupIdsChange={setCollapsedGroups}
        sorting={{ mode: 'client' }}
        colors={{
          primary: '#2F80FF',
          primaryForeground: '#FFFFFF',
          primarySoft: '#EFF6FF',
        }}
        search={{
          label: 'Make 또는 Model 검색',
          placeholder: 'Make / Model 검색',
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
              { value: 'ALL', label: 'All' },
              ...PRODUCT_CHOICES.map((choice) => ({
                value: choice.name,
                label: choice.name,
              })),
            ],
          },
        ]}
        toolbarContent={
          <div className="stage-tabs" role="group" aria-label="Project stage">
            {PROJECT_STAGE_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className="stage-tab"
                aria-pressed={stageFilter === filter.value}
                onClick={() => {
                  setStageFilter(filter.value);
                }}
              >
                {filter.label}
                <span className="stage-tab-count">
                  {stageCounts.get(filter.value) ?? 0}
                </span>
              </button>
            ))}
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                resetWorkbench();
                resetPartLibrary();
              }}
            >
              Reset Mock Data
            </Button>
            <Button variant="primary" onClick={openWizard}>
              <Plus /> New Project
            </Button>
          </>
        }
        emptyMessage="조건에 맞는 프로젝트가 없습니다."
        pagination={{
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalCount: visibleProjects.length,
          pageSizeOptions: [5, 10, 25],
          onPageChange: (page) => {
            setPagination((current) => ({ ...current, pageIndex: page - 1 }));
          },
          onPageSizeChange: (pageSize) => {
            setPagination({ pageIndex: 0, pageSize });
          },
        }}
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
                  Product Type을 먼저 선택하면 제품군에 맞는 Zone과 개발
                  Pipeline이 자동 적용됩니다.
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
                      — Research Complete만 표시 · 1개 선택 = 1 Project Group
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
                                이미 {usedProject.id}에서 {wizardProduct}(으)로
                                개발 중 — 선택 불가
                              </small>
                            )}
                            {!usedProject && otherProjects.length > 0 && (
                              <small>
                                다른 Product Type에서 개발 중:{' '}
                                {otherProjects
                                  .map(
                                    (project) =>
                                      `${project.product} ${project.id}`,
                                  )
                                  .join(', ')}{' '}
                                — {wizardProduct}(으)로는 시작 가능
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
                  <span>— 개발할 Zone과 담당자를 확인합니다</span>
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
                  <strong>Handoff 시 프로젝트 개발이 완료됩니다.</strong>{' '}
                  Part·샘플·피팅과 인계를 마친 후 Shape 메뉴에서 최종 검토·승인,
                  발급 및 구성 등록을 진행하세요. 담당자는 생성되는 각 Zone
                  프로젝트에 적용됩니다.
                </div>
              </div>
            )}

            {wizardStep === 4 && wizardConfiguration && (
              <div className="wizard-review-step">
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
                  <strong>Shape — 개발 완료 후 발급</strong>
                  <span>
                    프로젝트 번호는 자동 생성됩니다. 공식 Shape는 Handoff 후
                    별도 검토·승인을 거쳐 발급합니다.
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
                {wizardStep === 4 ? 'Create Project Group' : 'Continue'}
                {wizardStep < 4 && <ChevronRight />}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
