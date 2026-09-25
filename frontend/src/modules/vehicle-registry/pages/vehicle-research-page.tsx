import { useState, type ChangeEvent } from 'react';
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
import { Files, List, Plus, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ConfigChips } from '@/shared/domain/config-chips';
import {
  RESEARCH_DISPOSITION_LABELS,
  RESEARCH_DISPOSITION_TONES,
  researchDisposition,
  type ResearchDisposition,
} from '@/shared/domain/research-approval';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import {
  PRODUCT_TYPES,
  type ProductType,
  type ProductTypeId,
  type VehicleConfiguration,
} from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ResearchAssetLibrary } from '../research-asset-library';
import type { ResearchAssetTarget } from '../research-asset-uploader';
import { ResearchConfigurationDialog } from '../research-configuration-dialog';
import {
  RESEARCH_CONFIGURATION_VERSION_KEY,
  RESEARCH_CONFIGURATION_VERSION_SEED,
  researchConfigurationVersionListSchema,
  type ResearchConfigurationVersion,
  type ResearchConfigurationVersionStatus,
} from '../research-configuration-version-model';
import {
  groupVehicleResearch,
  mergeProductResearchRows,
  vehicleResearchIdentity,
} from '../vehicle-research-grid-model';
import '../research-asset-library.css';
import './vehicle-research-page.css';

const RESEARCH_STATUS_FILTERS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Completed', value: 'COMPLETED' },
] as const;
type ResearchLifecycleStatus =
  (typeof RESEARCH_STATUS_FILTERS)[number]['value'];

function researchLifecycleStatus(
  status: VehicleConfiguration['researchStatus'],
): ResearchLifecycleStatus {
  if (status === 'COMPLETE') return 'COMPLETED';
  if (status === 'RESEARCHING') return 'IN_PROGRESS';
  return status;
}

interface ConfigurationCriterion {
  id: number;
  title: string;
  value: string;
}

interface ProductResearchRow extends VehicleConfiguration {
  sourceConfigurationId: string;
  productTypeId: ProductTypeId;
  product: ProductType;
  years?: string;
}

function researchVehicleParts(vehicle: string) {
  const { makeModel } = vehicleResearchIdentity(vehicle);
  const [make = '', ...modelParts] = makeModel.split(/\s+/);
  return { make, model: modelParts.join(' ') };
}

function yearsInLabel(label: string): readonly string[] {
  return label.split(',').flatMap((range) => {
    const match = /^(\d{4})(?:[–-](\d{4}))?$/.exec(range.trim());
    if (!match) return [];
    const [, startValue, endValue] = match as unknown as [
      string,
      string,
      string?,
    ];
    const start = Number(startValue);
    const end = Number(endValue ?? startValue);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) =>
      String(start + index),
    );
  });
}

/** Vehicle and option-combination research registry. */
export function VehicleResearchPage() {
  const navigate = useNavigate();
  const [viewParams, setViewParams] = useSearchParams();
  const { actor } = useOperations();
  const [researchView, setResearchView] = useState<'registry' | 'assets'>(() =>
    viewParams.get('view') === 'assets' ? 'assets' : 'registry',
  );
  const {
    configurations,
    setConfigurations,
    vehicleOptionKeys,
    vehicleOptionValues,
    approvalRequests,
  } = useWorkbenchStore();
  const [configurationProductTypeId, setConfigurationProductTypeId] = useState<
    ProductTypeId | ''
  >('');
  const [configurationYearFrom, setConfigurationYearFrom] = useState('');
  const [configurationYearTo, setConfigurationYearTo] = useState('');
  // The option dictionary lives in vehicle_option_key /
  // vehicle_option_value; this screen only reads it. Manage it in
  // Vehicle Options.
  const configurationValues: Readonly<
    Partial<Record<string, readonly string[]>>
  > = Object.fromEntries(
    vehicleOptionKeys
      .filter(
        (optionKey) => optionKey.productTypeId === configurationProductTypeId,
      )
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
  const [statuses, setStatuses] = useState<readonly string[]>([]);
  const [products, setProducts] = useState<readonly string[]>([]);
  const [handoffs, setHandoffs] = useState<readonly string[]>([]);
  const [years, setYears] = useState<readonly string[]>([]);
  const [makes, setMakes] = useState<readonly string[]>([]);
  const [models, setModels] = useState<readonly string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState('Toyota');
  const [vehicleClass, setVehicleClass] = useState('SUV');
  const [model, setModel] = useState('');
  const [yearStart, setYearStart] = useState('2023');
  const [yearEnd, setYearEnd] = useState('2026');
  const [configurationDialogOpen, setConfigurationDialogOpen] = useState(false);
  const [configurationVehicle, setConfigurationVehicle] =
    useState<VehicleConfiguration>();
  const [criteria, setCriteria] = useState<readonly ConfigurationCriterion[]>(
    [],
  );
  const configurationVersions = useRdRecords(
    RESEARCH_CONFIGURATION_VERSION_KEY,
    researchConfigurationVersionListSchema,
    RESEARCH_CONFIGURATION_VERSION_SEED,
  );
  const configurationDialogMakeModel = configurationVehicle
    ? vehicleResearchIdentity(configurationVehicle.vehicle).makeModel
    : '';
  function dispositionOf(
    configuration: ProductResearchRow,
  ): ResearchDisposition {
    return researchDisposition(approvalRequests, {
      id: configuration.sourceConfigurationId,
      projectGroupIds: configuration.projectGroupIds,
    });
  }

  const currentApprovedVersions = new Map<
    string,
    ResearchConfigurationVersion
  >();
  for (const version of configurationVersions.records) {
    if (version.status !== 'APPROVED') continue;
    const current = currentApprovedVersions.get(
      version.researchConfigurationId,
    );
    if (!current || version.versionNumber > current.versionNumber) {
      currentApprovedVersions.set(version.researchConfigurationId, version);
    }
  }
  const currentProductRows = configurations.flatMap<ProductResearchRow>(
    (configuration) => {
      const applicableProductTypes = configuration.productTypeId
        ? PRODUCT_TYPES.filter(
            (productType) => productType.id === configuration.productTypeId,
          )
        : PRODUCT_TYPES;
      return applicableProductTypes.flatMap<ProductResearchRow>(
        (productType) => {
          const productTypeId = productType.id;
          const targetId = `${configuration.id}:${productTypeId}`;
          const currentVersion = currentApprovedVersions.get(targetId);
          if (currentVersion?.action === 'DELETE') return [];
          const allowedOptionNames = new Set(
            vehicleOptionKeys
              .filter((key) => key.productTypeId === productTypeId)
              .map((key) => key.name),
          );
          const versionYears = currentVersion?.years ?? [];
          const sortedYears = [...versionYears].sort(
            (left, right) => left - right,
          );
          const yearLabel = sortedYears.length
            ? sortedYears[0] === sortedYears[sortedYears.length - 1]
              ? String(sortedYears[0])
              : `${String(sortedYears[0])}–${String(sortedYears[sortedYears.length - 1])}`
            : vehicleResearchIdentity(configuration.vehicle).years;
          const sourceOptions =
            currentVersion?.options ?? configuration.options;
          return [
            {
              ...configuration,
              id: targetId,
              vehicle: `${yearLabel} ${vehicleResearchIdentity(configuration.vehicle).makeModel}`,
              sourceConfigurationId: configuration.id,
              productTypeId,
              product: productType.product,
              options: sourceOptions.filter(([key]) =>
                allowedOptionNames.has(key),
              ),
            } satisfies ProductResearchRow,
          ];
        },
      );
    },
  );
  const mergedProductRows = mergeProductResearchRows(currentProductRows);
  const selectedConfigurationTargetId = viewParams.get('configuration');
  const selectedConfigurationRow = mergedProductRows.find(
    (row) =>
      `${row.sourceConfigurationId}:${row.productTypeId}` ===
      selectedConfigurationTargetId,
  );
  const selectedConfigurationTarget: ResearchAssetTarget | null =
    selectedConfigurationRow
      ? {
          id: `${selectedConfigurationRow.sourceConfigurationId}:${selectedConfigurationRow.productTypeId}`,
          configurationId: selectedConfigurationRow.sourceConfigurationId,
          productTypeId: selectedConfigurationRow.productTypeId,
          productLabel: selectedConfigurationRow.product,
          options: selectedConfigurationRow.options,
        }
      : null;
  const selectedMakeModel = selectedConfigurationRow
    ? vehicleResearchIdentity(selectedConfigurationRow.vehicle).makeModel
    : '';
  const selectedAvailableYears = Array.from(
    new Set(
      configurations
        .filter(
          (item) =>
            vehicleResearchIdentity(item.vehicle).makeModel ===
            selectedMakeModel,
        )
        .flatMap((item) => {
          const years = vehicleResearchIdentity(item.vehicle).years;
          const match = /^(\d{4})(?:[–-](\d{4}))?$/.exec(years);
          if (!match) return [];
          const start = Number(match[1]);
          const end = Number(match[2] ? match[2] : match[1]);
          return Array.from(
            { length: Math.max(0, end - start + 1) },
            (_, index) => start + index,
          );
        }),
    ),
  ).sort((left, right) => left - right);
  const availableYears = Array.from(
    new Set(mergedProductRows.flatMap((row) => yearsInLabel(row.years))),
  ).sort((left, right) => Number(left) - Number(right));
  const yearFilteredRows = mergedProductRows.filter(
    (row) =>
      years.length === 0 ||
      yearsInLabel(row.years).some((year) => years.includes(year)),
  );
  const availableMakes = Array.from(
    new Set(
      yearFilteredRows.map((row) => researchVehicleParts(row.vehicle).make),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const makeFilteredRows = yearFilteredRows.filter(
    (row) =>
      makes.length === 0 ||
      makes.includes(researchVehicleParts(row.vehicle).make),
  );
  const availableModels = Array.from(
    new Set(
      makeFilteredRows.map((row) => researchVehicleParts(row.vehicle).model),
    ),
  )
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const vehicleFilteredRows = makeFilteredRows.filter(
    (row) =>
      models.length === 0 ||
      models.includes(researchVehicleParts(row.vehicle).model),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const searchedProductRows = vehicleFilteredRows.filter((row) => {
    if (!normalizedQuery) return true;
    const { make, model } = researchVehicleParts(row.vehicle);
    return `${row.years} ${make} ${model}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const productFilteredRows = searchedProductRows.filter(
    (row) => products.length === 0 || products.includes(row.product),
  );
  const productCounts = new Map(
    PRODUCT_TYPES.map((productType) => [
      productType.product,
      searchedProductRows.filter((row) => row.product === productType.product)
        .length,
    ]),
  );
  const statusCounts = new Map(
    RESEARCH_STATUS_FILTERS.map((filter) => [
      filter.value,
      productFilteredRows.filter(
        (row) => researchLifecycleStatus(row.researchStatus) === filter.value,
      ).length,
    ]),
  );
  const statusFilteredRows = productFilteredRows.filter(
    (row) =>
      statuses.length === 0 ||
      statuses.includes(researchLifecycleStatus(row.researchStatus)),
  );
  const handoffOrder: readonly ResearchDisposition[] = [
    'PUSH',
    'REVIEWING',
    'HOLD',
    'PENDING',
  ];
  const handoffCounts = new Map(
    handoffOrder.map((disposition) => [
      disposition,
      statusFilteredRows.filter((row) => dispositionOf(row) === disposition)
        .length,
    ]),
  );
  const productTypeOrder = new Map(
    PRODUCT_TYPES.map((productType, index) => [productType.id, index]),
  );
  const productRows = statusFilteredRows
    .filter(
      (row) => handoffs.length === 0 || handoffs.includes(dispositionOf(row)),
    )
    .sort(
      (left, right) =>
        (productTypeOrder.get(left.productTypeId) ?? Number.MAX_SAFE_INTEGER) -
          (productTypeOrder.get(right.productTypeId) ??
            Number.MAX_SAFE_INTEGER) ||
        left.years.localeCompare(right.years, undefined, { numeric: true }) ||
        left.sourceConfigurationId.localeCompare(right.sourceConfigurationId),
    );
  const vehicleGroups = groupVehicleResearch(productRows);
  const {
    pageItems: pagedVehicleGroups,
    pagination,
    setPagination,
  } = useWorkbenchPagination(
    vehicleGroups,
    `${query}|${years.join(',')}|${makes.join(',')}|${models.join(',')}|${statuses.join(',')}|${products.join(',')}|${handoffs.join(',')}`,
  );

  function changeYears(nextYears: readonly string[]): void {
    const rowsForYears = mergedProductRows.filter(
      (row) =>
        nextYears.length === 0 ||
        yearsInLabel(row.years).some((year) => nextYears.includes(year)),
    );
    const allowedMakes = new Set(
      rowsForYears.map((row) => researchVehicleParts(row.vehicle).make),
    );
    const nextMakes = makes.filter((make) => allowedMakes.has(make));
    const allowedModels = new Set(
      rowsForYears
        .filter(
          (row) =>
            nextMakes.length === 0 ||
            nextMakes.includes(researchVehicleParts(row.vehicle).make),
        )
        .map((row) => researchVehicleParts(row.vehicle).model),
    );
    setYears(nextYears);
    setMakes(nextMakes);
    setModels((current) =>
      current.filter((modelName) => allowedModels.has(modelName)),
    );
  }

  function changeMakes(nextMakes: readonly string[]): void {
    const allowedModels = new Set(
      yearFilteredRows
        .filter(
          (row) =>
            nextMakes.length === 0 ||
            nextMakes.includes(researchVehicleParts(row.vehicle).make),
        )
        .map((row) => researchVehicleParts(row.vehicle).model),
    );
    setMakes(nextMakes);
    setModels((current) =>
      current.filter((modelName) => allowedModels.has(modelName)),
    );
  }

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
      researchStatus: 'DRAFT',
      projectGroupIds: [],
    };
    setConfigurations((current) => [...current, newConfiguration]);
    setModel('');
    setDialogOpen(false);
  }

  function openConfigurationDialog(configuration: VehicleConfiguration): void {
    setConfigurationVehicle(configuration);
    setConfigurationProductTypeId('');
    setConfigurationYearFrom('');
    setConfigurationYearTo('');
    setCriteria([]);
    setConfigurationDialogOpen(true);
  }

  function selectConfigurationProductType(productTypeId: ProductTypeId): void {
    setConfigurationProductTypeId(productTypeId);
    setCriteria([]);
  }

  function openConfigurationHistory(configuration: ProductResearchRow): void {
    const researchConfigurationId = `${configuration.sourceConfigurationId}:${configuration.productTypeId}`;
    void navigate(
      `/vehicle-research/${encodeURIComponent(configuration.sourceConfigurationId)}/configurations/${encodeURIComponent(researchConfigurationId)}`,
    );
  }

  function closeConfigurationHistory(): void {
    const next = new URLSearchParams(viewParams);
    next.delete('configuration');
    setViewParams(next, { replace: true });
  }

  async function createConfigurationVersion(
    version: ResearchConfigurationVersion,
  ) {
    return configurationVersions.save((current) => {
      const next =
        version.status === 'APPROVED'
          ? current.map((item) =>
              item.researchConfigurationId ===
                version.researchConfigurationId && item.status === 'APPROVED'
                ? { ...item, status: 'SUPERSEDED' as const }
                : item,
            )
          : current;
      return [...next, version];
    });
  }

  async function updateConfigurationVersionStatus(
    versionId: string,
    status: ResearchConfigurationVersionStatus,
  ) {
    return configurationVersions.save((current) => {
      const selected = current.find((item) => item.id === versionId);
      if (!selected) return current;
      return current.map((item) => {
        if (
          status === 'APPROVED' &&
          item.researchConfigurationId === selected.researchConfigurationId &&
          item.status === 'APPROVED'
        ) {
          return { ...item, status: 'SUPERSEDED' as const };
        }
        if (item.id !== versionId) return item;
        return {
          ...item,
          status,
          reviewedBy:
            status === 'APPROVED' || status === 'REJECTED'
              ? actor.name
              : item.reviewedBy,
          reviewedAt:
            status === 'APPROVED' || status === 'REJECTED'
              ? new Date().toISOString()
              : item.reviewedAt,
        };
      });
    });
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
    if (
      !configurationVehicle ||
      !configurationProductTypeId ||
      !configurationYearFrom ||
      !configurationYearTo
    ) {
      return;
    }
    const makeModel = vehicleResearchIdentity(
      configurationVehicle.vehicle,
    ).makeModel;
    const yearFrom = Number(configurationYearFrom);
    const yearTo = Number(configurationYearTo);
    if (yearFrom > yearTo) return;
    const yearLabel =
      yearFrom === yearTo
        ? String(yearFrom)
        : `${String(yearFrom)}–${String(yearTo)}`;
    const options = criteria.map(
      (criterion) => [criterion.title, criterion.value] as const,
    );
    setConfigurations((current) => [
      ...current,
      {
        id: `c${String(current.length + 1).padStart(2, '0')}`,
        vehicle: `${yearLabel} ${makeModel}`,
        vehicleClass: configurationVehicle.vehicleClass,
        productTypeId: configurationProductTypeId,
        options,
        researchStatus: 'DRAFT',
        projectGroupIds: [],
      },
    ]);
    setConfigurationDialogOpen(false);
  }

  const columns: GroupedDataGridColumn<ProductResearchRow>[] = [
    {
      id: 'configuration',
      header: 'Configuration',
      width: 720,
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
            openConfigurationHistory(configuration);
          }}
        >
          <span
            className={`research-product-type research-product-type-${configuration.productTypeId.toLowerCase()}`}
          >
            {configuration.product}
          </span>
          {configuration.years && (
            <span className="research-configuration-years">
              {configuration.years}
            </span>
          )}
          <ConfigChips options={configuration.options} />
        </button>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 120,
      sortValue: (configuration) =>
        researchLifecycleStatus(configuration.researchStatus),
      cell: (configuration) => (
        <StatusBadge
          label={researchLifecycleStatus(configuration.researchStatus)}
          tone={
            researchLifecycleStatus(configuration.researchStatus) ===
            'COMPLETED'
              ? 'success'
              : researchLifecycleStatus(configuration.researchStatus) ===
                  'PENDING_APPROVAL'
                ? 'warning'
                : researchLifecycleStatus(configuration.researchStatus) ===
                    'DRAFT'
                  ? 'neutral'
                  : 'progress'
          }
        />
      ),
    },
    {
      id: 'project-conversion',
      header: 'Project handoff',
      width: 150,
      sortValue: (configuration) => dispositionOf(configuration),
      cell: (configuration) => {
        const disposition = dispositionOf(configuration);
        return (
          <StatusBadge
            label={RESEARCH_DISPOSITION_LABELS[disposition]}
            tone={RESEARCH_DISPOSITION_TONES[disposition]}
          />
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 260,
      className: 'text-center',
      hideable: false,
      movable: false,
      pinnable: false,
      cell: () => null,
    },
  ];
  const groups: GroupedDataGridGroup<ProductResearchRow>[] =
    pagedVehicleGroups.map((group) => {
      const firstConfiguration = group.rows.slice(0, 1).pop();
      return {
        id: group.id,
        title: group.title,
        description: group.description,
        rows: group.rows,
        meta: (
          <>
            {firstConfiguration && (
              <>
                <Button
                  size="sm"
                  variant="dashed"
                  onClick={() => {
                    void navigate(
                      `/vehicle-research/${encodeURIComponent(firstConfiguration.sourceConfigurationId)}`,
                    );
                  }}
                >
                  Open {group.title} Research
                </Button>
                <Button
                  size="sm"
                  variant="dashed"
                  aria-label={`${group.id} Add configuration`}
                  onClick={() => {
                    const sourceConfiguration = configurations.find(
                      (item) =>
                        item.id === firstConfiguration.sourceConfigurationId,
                    );
                    if (sourceConfiguration) {
                      openConfigurationDialog(sourceConfiguration);
                    }
                  }}
                >
                  <Plus /> Configuration
                </Button>
              </>
            )}
          </>
        ),
      };
    });

  return (
    <section>
      <PageHeader />

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
          <ContentTabsPanel value="registry" className="grid-tab-content">
            <GroupedDataGrid
              embedded
              className="vehicle-research-grid"
              label="Vehicle Research"
              columns={columns}
              groups={groups}
              getRowId={(configuration) => configuration.id}
              onRowClick={(configuration) => {
                openConfigurationHistory(configuration);
              }}
              rowActionLabel={(configuration) =>
                `${configuration.product} View configuration and history`
              }
              collapsedGroupIds={collapsedVehicles}
              onCollapsedGroupIdsChange={setCollapsedVehicles}
              sorting={{ mode: 'client' }}
              colors={{
                primary: 'var(--wb-blue)',
                primaryForeground: '#FFFFFF',
                primarySoft: 'var(--wb-soft-blue)',
              }}
              search={{
                label: 'Search year, make, or model',
                placeholder: 'Search year / make / model',
                value: query,
                onChange: setQuery,
              }}
              multiSelectFilters={[
                {
                  id: 'years',
                  label: 'Year',
                  values: years,
                  onChange: changeYears,
                  options: availableYears.map((year) => ({
                    value: year,
                    label: year,
                    count: mergedProductRows.filter((row) =>
                      yearsInLabel(row.years).includes(year),
                    ).length,
                  })),
                },
                {
                  id: 'makes',
                  label: 'Make',
                  values: makes,
                  onChange: changeMakes,
                  options: availableMakes.map((make) => ({
                    value: make,
                    label: make,
                    count: yearFilteredRows.filter(
                      (row) => researchVehicleParts(row.vehicle).make === make,
                    ).length,
                  })),
                },
                {
                  id: 'models',
                  label: 'Model',
                  values: models,
                  onChange: setModels,
                  options: availableModels.map((modelName) => ({
                    value: modelName,
                    label: modelName,
                    count: makeFilteredRows.filter(
                      (row) =>
                        researchVehicleParts(row.vehicle).model === modelName,
                    ).length,
                  })),
                },
                {
                  id: 'product-types',
                  label: 'Product types',
                  values: products,
                  onChange: setProducts,
                  options: PRODUCT_TYPES.map((item) => ({
                    value: item.product,
                    label: item.product,
                    count: productCounts.get(item.product) ?? 0,
                  })),
                },
                {
                  id: 'statuses',
                  label: 'Status',
                  values: statuses,
                  onChange: setStatuses,
                  options: RESEARCH_STATUS_FILTERS.map((filter) => ({
                    value: filter.value,
                    label: filter.label,
                    count: statusCounts.get(filter.value) ?? 0,
                  })),
                },
                {
                  id: 'project-handoff',
                  label: 'Project handoff',
                  values: handoffs,
                  onChange: setHandoffs,
                  options: handoffOrder.map((disposition) => ({
                    value: disposition,
                    label: RESEARCH_DISPOSITION_LABELS[disposition],
                    count: handoffCounts.get(disposition) ?? 0,
                  })),
                },
              ]}
              toolbarContent={
                (query ||
                  years.length > 0 ||
                  makes.length > 0 ||
                  models.length > 0 ||
                  products.length > 0 ||
                  statuses.length > 0 ||
                  handoffs.length > 0) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setQuery('');
                      setYears([]);
                      setMakes([]);
                      setModels([]);
                      setProducts([]);
                      setStatuses([]);
                      setHandoffs([]);
                    }}
                  >
                    <X /> Clear filters
                  </Button>
                )
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
          <ContentTabsPanel value="assets" className="grid-tab-content">
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
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
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
                <span>Make + Model</span>
                <strong>{configurationDialogMakeModel}</strong>
              </div>
            )}
            <div className="configuration-setup-step">
              <label>
                <strong>1. Product type</strong>
                <Select
                  value={configurationProductTypeId}
                  onValueChange={(value: string) => {
                    selectConfigurationProductType(value as ProductTypeId);
                  }}
                >
                  <SelectTrigger aria-label="Product type">
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((productType) => (
                      <SelectItem value={productType.id} key={productType.id}>
                        {productType.product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <fieldset className="configuration-year-step">
              <legend>2. Year</legend>
              <div className="configuration-year-inputs">
                <label>
                  From
                  <Input
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="e.g. 2023"
                    value={configurationYearFrom}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setConfigurationYearFrom(event.target.value);
                    }}
                  />
                </label>
                <label>
                  To
                  <Input
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="e.g. 2026"
                    value={configurationYearTo}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setConfigurationYearTo(event.target.value);
                    }}
                  />
                </label>
              </div>
            </fieldset>
            <div className="configuration-dialog-label">
              3. Option values
              <span>— Only options belonging to the selected product</span>
            </div>
            {!configurationProductTypeId ? (
              <p className="configuration-step-empty">
                Select a product type before configuring option values.
              </p>
            ) : (
              <>
                <div className="configuration-criteria-list">
                  {criteria.map((criterion, index) => (
                    <div className="configuration-criterion" key={criterion.id}>
                      <span className="criterion-number">{index + 1}</span>
                      <Select
                        value={criterion.title}
                        onValueChange={(title: string) => {
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
                        onValueChange={(value: string) => {
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
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
                {criteria.length === 0 && (
                  <p className="configuration-step-empty">
                    Base vehicle — this product has no option values selected.
                  </p>
                )}
                <Button
                  className="add-configuration-criterion"
                  variant="dashed"
                  onClick={addCriterion}
                  disabled={
                    criteria.length >= Object.keys(configurationValues).length
                  }
                >
                  <Plus /> Add option value
                </Button>
              </>
            )}
          </DialogBody>
          <DialogFooter className="configuration-dialog-footer">
            <Button
              variant="outline"
              onClick={() => {
                setConfigurationDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="vehicle-register-submit"
              variant="primary"
              onClick={saveConfiguration}
              disabled={
                !configurationProductTypeId ||
                !configurationYearFrom ||
                !configurationYearTo ||
                Number(configurationYearFrom) > Number(configurationYearTo) ||
                criteria.some(
                  (criterion) => !criterion.title || !criterion.value,
                )
              }
            >
              Register configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResearchConfigurationDialog
        open={Boolean(selectedConfigurationTarget)}
        onOpenChange={(open) => {
          if (!open) closeConfigurationHistory();
        }}
        target={selectedConfigurationTarget}
        availableYears={selectedAvailableYears}
        researchStatus={selectedConfigurationRow?.researchStatus ?? 'DRAFT'}
        versions={configurationVersions.records}
        actor={actor.name}
        saving={configurationVersions.saving}
        onCreateVersion={createConfigurationVersion}
        onUpdateVersionStatus={updateConfigurationVersionStatus}
        onOpenVehicleResearch={() => {
          if (!selectedConfigurationRow || !selectedConfigurationTarget) return;
          void navigate(
            `/vehicle-research/${encodeURIComponent(selectedConfigurationRow.sourceConfigurationId)}?configuration=${encodeURIComponent(selectedConfigurationTarget.id)}`,
          );
        }}
      />
    </section>
  );
}
