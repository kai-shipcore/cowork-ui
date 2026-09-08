import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card, CardTable } from '@coverland-engineering/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ConfigChips } from '@/shared/domain/config-chips';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

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

function vehicleParts(vehicle: string) {
  const match = vehicle.match(/^(\d{4}(?:–\d{4})?)\s+(.+)$/);
  return match
    ? { years: match[1], name: match[2] }
    : { years: '', name: vehicle };
}

/** Vehicle and option-combination research registry. */
export function VehicleResearchPage() {
  const navigate = useNavigate();
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
  const configurationValues: Readonly<Record<string, readonly string[]>> =
    Object.fromEntries(
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
  const [status, setStatus] = useState('ALL');
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

  const visibleConfigurations = configurations.filter((configuration) => {
    const matchesQuery = configuration.vehicle
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus =
      status === 'ALL' || configuration.researchStatus === status;
    const matchesProduct =
      product === 'ALL' ||
      configuration.projectGroupIds.some(
        (projectId) =>
          projects.find((project) => project.id === projectId)?.product ===
          product,
      );
    return matchesQuery && matchesStatus && matchesProduct;
  });
  const vehicleGroups = Array.from(
    visibleConfigurations.reduce((groups, configuration) => {
      const current = groups.get(configuration.vehicle) ?? [];
      groups.set(configuration.vehicle, [...current, configuration]);
      return groups;
    }, new Map<string, VehicleConfiguration[]>()),
  ).map(([vehicle, groupedConfigurations]) => ({
    vehicle,
    configurations: groupedConfigurations,
    vehicleClass: groupedConfigurations[0]?.vehicleClass ?? '',
  }));
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
    const firstValue = configurationValues[title]?.[0] ?? '';
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
        value: configurationValues[unusedTitle]?.[0] ?? '',
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

  return (
    <section>
      <PageHeader
        description="차량 등록 → Configuration(옵션 조합) 등록 → Research Complete 시 개발 가능 · 이 단계에서는 F# 없음"
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
        actions={
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            <Plus /> 차량 등록
          </Button>
        }
      />

      <div className="workbench-filters">
        <div className="search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label="Make 또는 Model 검색"
            placeholder="Make / Model 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Research 상태" className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Status: All</SelectItem>
            <SelectItem value="COMPLETE">Complete</SelectItem>
            <SelectItem value="RESEARCHING">Researching</SelectItem>
          </SelectContent>
        </Select>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger aria-label="Product 필터" className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Product: All</SelectItem>
            <SelectItem value="Seat Cover">Seat Cover</SelectItem>
            <SelectItem value="Car Cover">Car Cover</SelectItem>
            <SelectItem value="Floor Mat">Floor Mat</SelectItem>
          </SelectContent>
        </Select>
        <span className="filter-count">
          {visibleConfigurations.length} configurations
        </span>
      </div>

      <div className="research-vehicle-list">
        {pagedVehicleGroups.map((group) => {
          const vehicle = vehicleParts(group.vehicle);
          return (
            <Card className="research-vehicle-card" key={group.vehicle}>
              <div className="research-vehicle-header">
                <div>
                  <h2>{vehicle.name}</h2>
                  <span>
                    {vehicle.years} · {group.vehicleClass}
                  </span>
                  <small>{group.configurations.length} Configurations</small>
                </div>
                <Button
                  size="sm"
                  variant="dashed"
                  onClick={() =>
                    openConfigurationDialog(group.configurations[0])
                  }
                >
                  <Plus /> Configuration
                </Button>
              </div>
              <CardTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="research-configuration-column">
                        Configuration
                      </TableHead>
                      <TableHead className="research-status-column">
                        Research
                      </TableHead>
                      <TableHead>Development</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.configurations.map((configuration) => {
                      const linkedProjects = configuration.projectGroupIds.map(
                        (projectId) => ({
                          id: projectId,
                          project: projects.find(
                            (project) => project.id === projectId,
                          ),
                        }),
                      );
                      return (
                        <TableRow key={configuration.id}>
                          <TableCell>
                            <strong className="configuration-id">
                              {configuration.id}
                            </strong>
                            <ConfigChips options={configuration.options} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              label={
                                configuration.researchStatus === 'COMPLETE'
                                  ? 'COMPLETE'
                                  : 'RESEARCHING'
                              }
                              tone={
                                configuration.researchStatus === 'COMPLETE'
                                  ? 'success'
                                  : 'progress'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {linkedProjects.length ? (
                              <div className="development-project-list">
                                {linkedProjects.map(({ id, project }) => (
                                  <button
                                    type="button"
                                    className="development-project-card"
                                    key={id}
                                    onClick={() =>
                                      navigate(
                                        `${ROUTES.vehicleProjects}?project=${encodeURIComponent(id)}`,
                                      )
                                    }
                                  >
                                    <span>
                                      <strong>
                                        {project?.product ?? 'Development'}
                                      </strong>
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
                                  onClick={() =>
                                    navigate(
                                      `${ROUTES.vehicleProjects}?new=1&configuration=${encodeURIComponent(configuration.id)}`,
                                    )
                                  }
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
                                  onClick={() =>
                                    completeResearch(configuration)
                                  }
                                >
                                  Research Complete
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardTable>
            </Card>
          );
        })}
        <WorkbenchPagination
          recordCount={vehicleGroups.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          itemLabel="vehicles"
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>차량 등록</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              제조사
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger aria-label="제조사">
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
              차급
              <Select value={vehicleClass} onValueChange={setVehicleClass}>
                <SelectTrigger aria-label="차급">
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
              모델
              <Input
                placeholder="예: RAV4"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
            </label>
            <div className="year-range-fields">
              <label>
                연식 시작
                <Input
                  min="1900"
                  max="2100"
                  type="number"
                  value={yearStart}
                  onChange={(event) => setYearStart(event.target.value)}
                />
              </label>
              <label>
                연식 끝
                <Input
                  min="1900"
                  max="2100"
                  type="number"
                  value={yearEnd}
                  onChange={(event) => setYearEnd(event.target.value)}
                />
              </label>
            </div>
            <div className="dialog-note">
              등록 후 제품 적용에 영향을 주는 Configuration 옵션을 추가할 수
              있습니다. 이 단계에서는 F#이 발급되지 않습니다.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              className="vehicle-register-submit"
              variant="primary"
              onClick={addMockVehicle}
              disabled={!model.trim() || !yearStart || !yearEnd}
            >
              차량 등록
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
            <DialogTitle>Vehicle Configuration 추가</DialogTitle>
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
              <span>— 제품 적용에 영향을 주는 조합만</span>
            </div>
            <div className="configuration-criteria-list">
              {criteria.map((criterion, index) => (
                <div className="configuration-criterion" key={criterion.id}>
                  <span className="criterion-number">{index + 1}</span>
                  <Select
                    value={criterion.title}
                    onValueChange={(title) =>
                      updateCriterionTitle(criterion.id, title)
                    }
                  >
                    <SelectTrigger
                      aria-label={`Configuration 기준 ${index + 1}`}
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
                    onValueChange={(value) =>
                      updateCriterionValue(criterion.id, value)
                    }
                  >
                    <SelectTrigger aria-label={`Configuration 값 ${index + 1}`}>
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
                    aria-label={`${index + 1}번 기준 삭제`}
                    mode="icon"
                    variant="ghost"
                    onClick={() => removeCriterion(criterion.id)}
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
              <Plus /> Configuration 기준 추가
            </Button>
          </DialogBody>
          <DialogFooter className="configuration-dialog-footer">
            <span>이 단계에서는 F#이 발급되지 않습니다</span>
            <Button
              variant="outline"
              onClick={() => setConfigurationDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="vehicle-register-submit"
              variant="primary"
              onClick={saveConfiguration}
              disabled={!criteria.length}
            >
              Configuration 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
