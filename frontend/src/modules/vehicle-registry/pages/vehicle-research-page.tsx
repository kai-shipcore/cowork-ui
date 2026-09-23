import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  ContentTabs,
  ContentTabsPanel,
} from '@coverland-engineering/ui/content-tabs';
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
import { CarFront, Files, List, Plus, Truck, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ResearchAssetLibrary } from '../research-asset-library';
import {
  RESEARCH_DETAIL_KEY,
  RESEARCH_DETAIL_SEED,
  researchDetailListSchema,
} from '../vehicle-research-detail-model';
import { groupVehicleResearch } from '../vehicle-research-grid-model';
import '../research-asset-library.css';
import './vehicle-research-page.css';

const RESEARCH_STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Researching', value: 'RESEARCHING' },
] as const;
type ResearchStatusFilter = (typeof RESEARCH_STATUS_FILTERS)[number]['value'];

interface ConfigurationCriterion {
  id: number;
  title: string;
  value: string;
}

const INITIAL_CRITERIA: readonly ConfigurationCriterion[] = [
  { id: 1, title: 'Powertrain', value: 'Hybrid' },
  { id: 2, title: 'Front Seat', value: 'Bucket' },
  { id: 3, title: '2nd Row Seat', value: 'Bench' },
];

/** Vehicle and option-combination research registry. */
export function VehicleResearchPage() {
  const navigate = useNavigate();
  const [viewParams] = useSearchParams();
  const [researchView, setResearchView] = useState<'registry' | 'assets'>(() =>
    viewParams.get('view') === 'assets' ? 'assets' : 'registry',
  );
  const { records: researchDetails } = useRdRecords(
    RESEARCH_DETAIL_KEY,
    researchDetailListSchema,
    RESEARCH_DETAIL_SEED,
  );
  const {
    configurations,
    projects,
    setConfigurations,
    vehicleOptionKeys,
    vehicleOptionValues,
  } = useWorkbenchStore();
  // The option dictionary lives in vehicle_option_key /
  // vehicle_option_value; this screen only reads it. Manage it in
  // Vehicle Options.
  const configurationValues: Readonly<
    Partial<Record<string, readonly string[]>>
  > = Object.fromEntries(
    vehicleOptionKeys
      .filter((optionKey) => optionKey.productTypeId === 'PT-SC')
      .map((optionKey) => [
        optionKey.name,
        vehicleOptionValues
          .filter((value) => value.vehicleOptionKeyId === optionKey.id)
          .map((value) => value.value),
      ]),
  );
  const [query, setQuery] = useState('');
  const [collapsedVehicles, setCollapsedVehicles] = useState<
    ReadonlySet<string>
  >(new Set());
  const [status, setStatus] = useState<ResearchStatusFilter>('ALL');
  const [product, setProduct] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState('Toyota');
  const [vehicleClass, setVehicleClass] = useState('SUV');
  const [model, setModel] = useState('');
  const [yearStart, setYearStart] = useState('2023');
  const [yearEnd, setYearEnd] = useState('2026');
  const [configurationDialogOpen, setConfigurationDialogOpen] = useState(false);
  const [configurationVehicle, setConfigurationVehicle] =
    useState<VehicleConfiguration>();
  const [criteria, setCriteria] =
    useState<readonly ConfigurationCriterion[]>(INITIAL_CRITERIA);
  const latestResearchDetails = new Map(
    researchDetails.map((detail) => [detail.configurationId, detail]),
  );

  const searchedConfigurations = configurations.filter((configuration) => {
    const matchesQuery = configuration.vehicle
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesProduct =
      product === 'ALL' ||
      configuration.projectGroupIds.some(
        (projectId) =>
          projects.find((project) => project.id === projectId)?.product ===
          product,
      );
    return matchesQuery && matchesProduct;
  });
  const statusCounts = new Map(
    RESEARCH_STATUS_FILTERS.map((filter) => [
      filter.value,
      searchedConfigurations.filter(
        (configuration) =>
          filter.value === 'ALL' ||
          configuration.researchStatus === filter.value,
      ).length,
    ]),
  );
  const visibleConfigurations = searchedConfigurations.filter(
    (configuration) =>
      status === 'ALL' || configuration.researchStatus === status,
  );
  const vehicleGroups = groupVehicleResearch(visibleConfigurations);
  const {
    pageItems: pagedVehicleGroups,
    pagination,
    setPagination,
  } = useWorkbenchPagination(vehicleGroups, `${query}|${status}|${product}`);

  function addMockVehicle(): void {
    const newConfiguration: VehicleConfiguration = {
      id: `c${String(configurations.length + 1).padStart(2, '0')}`,
      vehicle: `${yearStart}–${yearEnd} ${manufacturer} ${model.trim()}`,
      vehicleClass,
      options: [
        ['Powertrain', 'Hybrid'],
        ['Seats', '7 Seats'],
        ['2nd Row Seat', 'Captain'],
      ],
      researchStatus: 'RESEARCHING',
      projectGroupIds: [],
    };
    setConfigurations((current) => [...current, newConfiguration]);
    setModel('');
    setDialogOpen(false);
  }

  function openConfigurationDialog(configuration: VehicleConfiguration): void {
    setConfigurationVehicle(configuration);
    setCriteria(INITIAL_CRITERIA);
    setConfigurationDialogOpen(true);
  }

  function updateCriterionTitle(criterionId: number, title: string): void {
    const firstValue = configurationValues[title]?.slice(0, 1).pop() ?? '';
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === criterionId
          ? { ...criterion, title, value: firstValue }
          : criterion,
      ),
    );
  }

  function updateCriterionValue(criterionId: number, value: string): void {
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, value } : criterion,
      ),
    );
  }

  function addCriterion(): void {
    const nextId =
      Math.max(0, ...criteria.map((criterion) => criterion.id)) + 1;
    const unusedTitle =
      Object.keys(configurationValues).find(
        (title) => !criteria.some((criterion) => criterion.title === title),
      ) ?? 'Powertrain';
    setCriteria((current) => [
      ...current,
      {
        id: nextId,
        title: unusedTitle,
        value: configurationValues[unusedTitle]?.slice(0, 1).pop() ?? '',
      },
    ]);
  }

  function removeCriterion(criterionId: number): void {
    setCriteria((current) =>
      current.filter((criterion) => criterion.id !== criterionId),
    );
  }

  function saveConfiguration(): void {
    if (!configurationVehicle || !criteria.length) {
      return;
    }
    const newConfiguration: VehicleConfiguration = {
      id: `c${String(configurations.length + 1).padStart(2, '0')}`,
      vehicle: configurationVehicle.vehicle,
      vehicleClass: configurationVehicle.vehicleClass,
      options: criteria.map((criterion) => [criterion.title, criterion.value]),
      researchStatus: 'COMPLETE',
      projectGroupIds: [],
    };
    setConfigurations((current) => [...current, newConfiguration]);
    setConfigurationDialogOpen(false);
  }

  function completeResearch(configuration: VehicleConfiguration): void {
    setConfigurations((current) =>
      current.map((item) =>
        item.id === configuration.id
          ? { ...item, researchStatus: 'COMPLETE' }
          : item,
      ),
    );
  }

  const columns: GroupedDataGridColumn<VehicleConfiguration>[] = [
    {
      id: 'configuration',
      header: 'Configuration',
      width: 480,
      hideable: false,
      sortValue: (configuration) =>
        configuration.options
          .map(([name, value]) => `${name}: ${value}`)
          .join(' / '),
      cell: (configuration) => (
        <button
          type="button"
          className="research-detail-link"
          onClick={() => {
            void navigate(
              `/vehicle-research/${encodeURIComponent(configuration.id)}`,
            );
          }}
        >
          <ConfigChips options={configuration.options} />
          <span>Open research detail</span>
        </button>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 150,
      sortValue: (configuration) => configuration.researchStatus,
      cell: (configuration) => (
        <StatusBadge
          label={configuration.researchStatus}
          tone={
            configuration.researchStatus === 'COMPLETE' ? 'success' : 'progress'
          }
        />
      ),
    },
    {
      id: 'project-conversion',
      header: 'Project conversion',
      width: 180,
      sortValue: (configuration) =>
        latestResearchDetails.get(configuration.id)?.projectDisposition ??
        'PENDING',
      cell: (configuration) => {
        const disposition =
          latestResearchDetails.get(configuration.id)?.projectDisposition ??
          'PENDING';
        return (
          <StatusBadge
            label={
              disposition === 'PUSH'
                ? 'Push'
                : disposition === 'HOLD'
                  ? 'On Hold'
                  : 'Not set'
            }
            tone={
              disposition === 'PUSH'
                ? 'success'
                : disposition === 'HOLD'
                  ? 'warning'
                  : 'neutral'
            }
          />
        );
      },
    },
    {
      id: 'development',
      header: 'Development',
      width: 420,
      sortValue: (configuration) => configuration.projectGroupIds.length,
      cell: (configuration) => {
        const linkedProjects = configuration.projectGroupIds.map((id) => ({
          id,
          project: projects.find((project) => project.id === id),
        }));
        return linkedProjects.length ? (
          <div className="development-project-list">
            {linkedProjects.map(({ id, project }) => (
              <button
                type="button"
                className="development-project-card"
                key={id}
                onClick={() => {
                  // React Router handles route errors; the click does not await navigation.
                  void navigate(
                    `${ROUTES.vehicleProjects}?project=${encodeURIComponent(id)}`,
                  );
                }}
              >
                <span>
                  <strong>{project?.product ?? 'Development'}</strong>
                  <small>{id}</small>
                </span>
                <StatusBadge
                  label={project?.stage ?? 'PROJECT'}
                  tone="progress"
                />
              </button>
            ))}
          </div>
        ) : configuration.researchStatus === 'COMPLETE' ? (
          <div className="development-empty-state">
            <span>No development yet</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // React Router handles route errors; the click does not await navigation.
                void navigate(
                  `${ROUTES.vehicleProjects}?new=1&configuration=${encodeURIComponent(configuration.id)}`,
                );
              }}
            >
              <Plus /> Start Development
            </Button>
          </div>
        ) : (
          <div className="development-locked-state">
            <span>Available after Research Complete</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                completeResearch(configuration);
              }}
            >
              Research Complete
            </Button>
          </div>
        );
      },
    },
  ];
  const groups: GroupedDataGridGroup<VehicleConfiguration>[] =
    pagedVehicleGroups.map((group) => {
      const firstConfiguration = group.rows.slice(0, 1).pop();
      return {
        id: group.id,
        title: group.title,
        description: group.description,
        rows: group.rows,
        meta: (
          <>
            <span className="research-vehicle-icon" aria-hidden="true">
              {group.vehicleClass === 'Truck' ? <Truck /> : <CarFront />}
            </span>
            {firstConfiguration && (
              <Button
                size="sm"
                variant="dashed"
                aria-label={`${group.id} Add configuration`}
                onClick={() => {
                  openConfigurationDialog(firstConfiguration);
                }}
              >
                <Plus /> Configuration
              </Button>
            )}
          </>
        ),
      };
    });

  return (
    <section>
      <PageHeader
        description="Register vehicle → Add configuration (option combination) → Development available after Research Complete · No F# at this stage"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_research' },
                { name: 'vehicle_research_x_option_value' },
                { name: 'vehicle_option_key' },
                { name: 'vehicle_option_value' },
                { name: 'vehicle_model' },
                { name: 'vehicle_make' },
                { name: 'vehicle_class' },
              ]
            : undefined
        }
      />

      <Card className="vehicle-research-surface">
        <ContentTabs
          key={researchView}
          label="Vehicle research view"
          value={researchView}
          onValueChange={(value) => {
            const nextView = value === 'assets' ? 'assets' : 'registry';
            setResearchView(nextView);
            void navigate(
              nextView === 'assets'
                ? `${ROUTES.vehicleResearch}?view=assets`
                : ROUTES.vehicleResearch,
              { replace: true },
            );
          }}
          items={[
            { value: 'registry', label: 'Research Registry', icon: <List /> },
            { value: 'assets', label: 'Asset Files', icon: <Files /> },
          ]}
        >
          <ContentTabsPanel value="registry">
            <GroupedDataGrid
              embedded
              className="vehicle-research-grid"
              label="Vehicle Research"
              columns={columns}
              groups={groups}
              getRowId={(configuration) => configuration.id}
              collapsedGroupIds={collapsedVehicles}
              onCollapsedGroupIdsChange={setCollapsedVehicles}
              sorting={{ mode: 'client' }}
              colors={{
                primary: 'var(--wb-blue)',
                primaryForeground: '#FFFFFF',
                primarySoft: 'var(--wb-soft-blue)',
              }}
              search={{
                label: 'Search make or model',
                placeholder: 'Search make / model',
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
                    { value: 'Seat Cover', label: 'Seat Cover' },
                    { value: 'Car Cover', label: 'Car Cover' },
                    { value: 'Floor Mat', label: 'Floor Mat' },
                  ],
                },
              ]}
              toolbarContent={
                <>
                  <div
                    className="stage-tabs"
                    role="group"
                    aria-label="Research status"
                  >
                    {RESEARCH_STATUS_FILTERS.map((filter) => (
                      <button
                        type="button"
                        key={filter.value}
                        className="stage-tab"
                        aria-pressed={status === filter.value}
                        onClick={() => {
                          setStatus(filter.value);
                        }}
                      >
                        {filter.label}
                        <span className="stage-tab-count">
                          {statusCounts.get(filter.value) ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                  {(query || product !== 'ALL' || status !== 'ALL') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQuery('');
                        setProduct('ALL');
                        setStatus('ALL');
                      }}
                    >
                      <X /> Clear filters
                    </Button>
                  )}
                </>
              }
              actions={
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigate(ROUTES.vehicleOptions);
                    }}
                  >
                    Manage vehicle options
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setDialogOpen(true);
                    }}
                  >
                    <Plus /> Register vehicle
                  </Button>
                </>
              }
              emptyMessage="No matching vehicles found."
              pagination={{
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
                totalCount: vehicleGroups.length,
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
          </ContentTabsPanel>
          <ContentTabsPanel value="assets">
            <ResearchAssetLibrary
              configurations={configurations}
              onOpenEvidence={(configurationId) => {
                void navigate(
                  `/vehicle-research/${encodeURIComponent(configurationId)}`,
                );
              }}
            />
          </ContentTabsPanel>
        </ContentTabs>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register vehicle</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Make
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger aria-label="Make">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toyota">Toyota</SelectItem>
                  <SelectItem value="Honda">Honda</SelectItem>
                  <SelectItem value="Ford">Ford</SelectItem>
                  <SelectItem value="Tesla">Tesla</SelectItem>
                  <SelectItem value="Hyundai">Hyundai</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Vehicle class
              <Select value={vehicleClass} onValueChange={setVehicleClass}>
                <SelectTrigger aria-label="Vehicle class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUV">SUV</SelectItem>
                  <SelectItem value="Sedan">Sedan</SelectItem>
                  <SelectItem value="Truck">Truck</SelectItem>
                  <SelectItem value="Coupe">Coupe</SelectItem>
                  <SelectItem value="Wagon">Wagon</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Model
              <Input
                placeholder="Example: RAV4"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                }}
              />
            </label>
            <div className="year-range-fields">
              <label>
                Model year from
                <Input
                  min="1900"
                  max="2100"
                  type="number"
                  value={yearStart}
                  onChange={(event) => {
                    setYearStart(event.target.value);
                  }}
                />
              </label>
              <label>
                Model year to
                <Input
                  min="1900"
                  max="2100"
                  type="number"
                  value={yearEnd}
                  onChange={(event) => {
                    setYearEnd(event.target.value);
                  }}
                />
              </label>
            </div>
            <div className="dialog-note">
              After registration, add configuration options that affect product
              fitment.
            </div>
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
              className="vehicle-register-submit"
              variant="primary"
              onClick={addMockVehicle}
              disabled={!model.trim() || !yearStart || !yearEnd}
            >
              Register vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={configurationDialogOpen}
        onOpenChange={setConfigurationDialogOpen}
      >
        <DialogContent className="configuration-dialog">
          <DialogHeader>
            <DialogTitle>Add vehicle configuration</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {configurationVehicle && (
              <div className="configuration-vehicle-card">
                <span>Vehicle</span>
                <strong>{configurationVehicle.vehicle}</strong>
              </div>
            )}
            <div className="configuration-dialog-label">
              Configuration Title / Value
              <span>— Only combinations affecting product fitment</span>
            </div>
            <div className="configuration-criteria-list">
              {criteria.map((criterion, index) => (
                <div className="configuration-criterion" key={criterion.id}>
                  <span className="criterion-number">{index + 1}</span>
                  <Select
                    value={criterion.title}
                    onValueChange={(title) => {
                      updateCriterionTitle(criterion.id, title);
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Configuration criterion ${String(index + 1)}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(configurationValues).map((title) => (
                        <SelectItem value={title} key={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={criterion.value}
                    onValueChange={(value) => {
                      updateCriterionValue(criterion.id, value);
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Configuration value ${String(index + 1)}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(configurationValues[criterion.title] ?? []).map(
                        (value) => (
                          <SelectItem value={value} key={value}>
                            {value}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    aria-label={`${String(index + 1)}· Remove criterion`}
                    mode="icon"
                    variant="ghost"
                    onClick={() => {
                      removeCriterion(criterion.id);
                    }}
                    disabled={criteria.length === 1}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              className="add-configuration-criterion"
              variant="dashed"
              onClick={addCriterion}
            >
              <Plus /> Add configuration criterion
            </Button>
          </DialogBody>
          <DialogFooter className="configuration-dialog-footer">
            <Button
              variant="outline"
              onClick={() => {
                setConfigurationDialogOpen(false);
              }}
            >
              Cancelled
            </Button>
            <Button
              className="vehicle-register-submit"
              variant="primary"
              onClick={saveConfiguration}
              disabled={!criteria.length}
            >
              Register configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
