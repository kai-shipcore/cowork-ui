import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@coverland-engineering/ui/tabs';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FolderKanban,
  Package,
  X,
  XCircle,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { FitmentQuality } from '@/shared/types/db-workflow';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  fitmentKind,
  latestFitments,
  sameFitmentTarget,
} from './fitment-model';
import './fitments.css';

function displayDate(value?: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('en-US')
    : '—';
}

export function FitmentsPage() {
  const { fitmentId } = useParams();
  const [params, setParams] = useSearchParams();
  const kind = params.get('tab') === 'parts' ? 'parts' : 'projects';
  const query = params.get('q') ?? '';
  const quality = params.get('quality') ?? 'ALL';
  const {
    fitmentQualities,
    projects,
    projectDetails,
    configurations,
    vehicleZones,
    sampleRequestItems,
  } = useWorkbenchStore();
  const [recordProject, setRecordProject] = useState('');
  const latest = latestFitments(fitmentQualities);
  const describe = (record: FitmentQuality) => {
    const group = projects.find((project) =>
      project.zoneProjects.some((zone) => zone.id === record.vehicleProjectId),
    );
    const snapshot = group ? projectDetails[group.id] : undefined;
    const zone =
      snapshot?.zones.find((row) => row.id === record.vehicleProjectId) ??
      group?.zoneProjects.find((row) => row.id === record.vehicleProjectId);
    const part = Object.values(projectDetails)
      .flatMap((detail) => detail.designs)
      .find((design) => design.id === record.vehicleProductDesignId);
    const vehicle = configurations.find(
      (row) => row.id === record.vehicleResearchId,
    );
    const masterZone = vehicleZones.find(
      (row) => row.id === record.vehicleZoneId,
    );
    return {
      group,
      zone,
      part,
      vehicle,
      vehicleName:
        vehicle?.vehicle ?? group?.vehicle ?? record.vehicleResearchId,
      projectName: record.vehicleProjectId || 'No linked project',
      partName: part?.name ?? record.vehicleProductDesignId ?? '—',
      zoneName: masterZone?.name ?? zone?.label ?? record.vehicleZoneId ?? '—',
      projectUrl: group
        ? '/vehicle-projects?' +
          new URLSearchParams({
            project: group.id,
            zone: zone?.code ?? '',
            tab: 'overview',
          }).toString()
        : undefined,
      partUrl:
        group && part
          ? '/vehicle-projects?' +
            new URLSearchParams({
              project: group.id,
              zone: zone?.code ?? '',
              tab: 'designs',
            }).toString()
          : undefined,
    };
  };
  const rows = latest.filter((record) => {
    if (
      fitmentKind(record) !== kind ||
      (quality !== 'ALL' && record.quality !== quality)
    )
      return false;
    const label = describe(record);
    return [
      label.vehicleName,
      label.projectName,
      label.partName,
      label.zoneName,
      record.source,
      record.note,
      record.id,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });
  const { pageItems, pagination, setPagination } = useWorkbenchPagination(
    rows,
    kind + query + quality,
  );
  const updateFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(key, value);
      return next;
    });
  };
  const detailUrl = (record: FitmentQuality) =>
    '/fitments/' +
    encodeURIComponent(record.id) +
    '?' +
    new URLSearchParams({
      tab: fitmentKind(record),
      q: query,
      quality,
    }).toString();
  const columns: FlatDataGridColumn<FitmentQuality>[] = [
    {
      id: 'vehicle',
      header: 'Vehicle',
      width: 240,
      cell: (record) => (
        <Link className="fitment-link" to={detailUrl(record)}>
          {describe(record).vehicleName}
          <ArrowUpRight size={14} />
        </Link>
      ),
    },
    {
      id: 'target',
      header: kind === 'parts' ? 'Part' : 'Project',
      width: 260,
      cell: (record) => (
        <>
          <strong>
            {kind === 'parts'
              ? describe(record).partName
              : describe(record).projectName}
          </strong>
          {kind === 'parts' && (
            <div className="vehicle-meta">{describe(record).projectName}</div>
          )}
        </>
      ),
    },
    {
      id: 'zone',
      header: 'Zone',
      width: 140,
      cell: (record) => describe(record).zoneName,
    },
    {
      id: 'quality',
      header: 'Quality',
      width: 110,
      cell: (record) => (
        <StatusBadge
          label={record.quality}
          tone={record.quality === 'PASS' ? 'success' : 'danger'}
        />
      ),
    },
    {
      id: 'source',
      header: 'Source',
      width: 110,
      cell: (record) => record.source,
    },
    {
      id: 'note',
      header: 'Note',
      width: 250,
      cell: (record) => (
        <span className="fitment-note-preview" title={record.note}>
          {record.note || '—'}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Recorded',
      width: 180,
      cell: (record) => displayDate(record.createdAt),
    },
  ];
  const record = fitmentQualities.find((row) => row.id === fitmentId);
  const selectedProject = projects
    .flatMap((group) => group.zoneProjects.map((zone) => ({ group, zone })))
    .find((entry) => entry.zone.id === recordProject);
  const backUrl = '/fitments?' + params.toString();
  if (fitmentId) {
    if (!record)
      return (
        <section className="fitments-page">
          <PageHeader description="Fitment record unavailable." />
          <Card className="fitment-empty">
            <h2>Fitment not found</h2>
            <p>
              This record is not available in this browser. It may have been
              removed or recorded on another device.
            </p>
            <Link to={backUrl}>Back to Fitment List</Link>
          </Card>
        </section>
      );
    const label = describe(record);
    const history = fitmentQualities
      .filter((entry) => sameFitmentTarget(entry, record))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const sample = sampleRequestItems.find(
      (entry) => entry.id === record.sampleRequestItemId,
    );
    const isLatest = history[0]?.id === record.id;
    return (
      <section className="fitments-page">
        <Link className="fitment-link" to={backUrl}>
          <ArrowLeft size={16} />
          Back to Fitment List
        </Link>
        <PageHeader
          description={
            fitmentKind(record) === 'parts'
              ? 'Part fitment · Vehicle product design compatibility'
              : 'Project fitment · Overall project compatibility'
          }
          tables={[{ name: 'vehicle_fitment_quality' }]}
        />
        <Card className="fitment-detail-card">
          <div className="fitment-detail-heading">
            <div>
              <span className="vehicle-meta">
                {fitmentKind(record) === 'parts'
                  ? 'PART FITMENT'
                  : 'PROJECT FITMENT'}{' '}
                · {isLatest ? 'Latest observation' : 'Historical observation'}
              </span>
              <h2>{label.vehicleName}</h2>
              <p>
                {fitmentKind(record) === 'parts'
                  ? label.partName
                  : label.projectName}{' '}
                · {label.zoneName}
              </p>
            </div>
            <StatusBadge
              label={record.quality}
              tone={record.quality === 'PASS' ? 'success' : 'danger'}
            />
          </div>
          <dl className="fitment-fields">
            <div>
              <dt>Vehicle research</dt>
              <dd>{label.vehicleName}</dd>
              <dd className="vehicle-meta">{record.vehicleResearchId}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>
                {label.projectUrl ? (
                  <Link to={label.projectUrl}>{label.projectName}</Link>
                ) : (
                  label.projectName
                )}
              </dd>
            </div>
            <div>
              <dt>Part · vehicle_product_design_id</dt>
              <dd>
                {label.partUrl ? (
                  <Link to={label.partUrl}>{label.partName}</Link>
                ) : (
                  label.partName
                )}
              </dd>
              <dd className="vehicle-meta">
                {record.vehicleProductDesignId ??
                  'Not applicable — project fitment'}
              </dd>
            </div>
            <div>
              <dt>Vehicle zone</dt>
              <dd>{label.zoneName}</dd>
              <dd className="vehicle-meta">{record.vehicleZoneId ?? '—'}</dd>
            </div>
            <div>
              <dt>Sample request item</dt>
              <dd>{record.sampleRequestItemId ?? 'Not linked'}</dd>
              {sample && (
                <dd>
                  Round {sample.sampleRound} · {sample.sampleRequestId}
                </dd>
              )}
            </div>
            <div>
              <dt>Source</dt>
              <dd>{record.source}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{displayDate(record.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{displayDate(record.updatedAt)}</dd>
            </div>
          </dl>
          <div className="fitment-note">
            <h3>Note</h3>
            <p>{record.note || 'No note recorded.'}</p>
          </div>
          <small className="vehicle-meta">Record ID · {record.id}</small>
        </Card>
        <Card className="fitment-detail-card">
          <h2>
            Observation history{' '}
            <span className="vehicle-meta">{history.length} records</span>
          </h2>
          <p>
            Previous observations are retained. A newer observation does not
            change this record.
          </p>
          <ol className="fitment-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <StatusBadge
                  label={entry.quality}
                  tone={entry.quality === 'PASS' ? 'success' : 'danger'}
                />
                <div>
                  <Link
                    to={detailUrl(entry)}
                    aria-current={entry.id === record.id ? 'page' : undefined}
                  >
                    {displayDate(entry.createdAt)}
                    {entry.id === record.id ? ' · Viewing' : ''}
                  </Link>
                  <p>{entry.note || 'No note'}</p>
                  <small>{entry.source}</small>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    );
  }
  return (
    <section className="fitments-page">
      <PageHeader
        description="Vehicle compatibility by project and part. Latest observation per vehicle and target."
        tables={[{ name: 'vehicle_fitment_quality' }]}
      />
      <div className="fitment-metrics">
        <Card>
          <FolderKanban size={18} />
          <span>Project Fitment</span>
          <strong>
            {latest.filter((row) => fitmentKind(row) === 'projects').length}
          </strong>
        </Card>
        <Card>
          <Package size={18} />
          <span>Part Fitment</span>
          <strong>
            {latest.filter((row) => fitmentKind(row) === 'parts').length}
          </strong>
        </Card>
        <Card>
          <CheckCircle2 size={18} />
          <span>PASS</span>
          <strong>
            {latest.filter((row) => row.quality === 'PASS').length}
          </strong>
        </Card>
        <Card>
          <XCircle size={18} />
          <span>FAIL</span>
          <strong>
            {latest.filter((row) => row.quality === 'FAIL').length}
          </strong>
        </Card>
      </div>
      <Card>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            updateFilter('tab', value);
          }}
        >
          <TabsList variant="line" className="grid-tabs-list">
            <TabsTrigger value="projects">
              <FolderKanban size={16} />
              Project Fitment
            </TabsTrigger>
            <TabsTrigger value="parts">
              <Package size={16} />
              Part Fitment
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <FlatDataGrid
          label={kind === 'parts' ? 'Part fitments' : 'Project fitments'}
          columns={columns}
          rows={pageItems}
          getRowId={(row) => row.id}
          search={{
            label: 'Search fitment',
            placeholder: 'Vehicle / Project / Part / Note',
            value: query,
            onChange: (value) => {
              updateFilter('q', value);
            },
          }}
          toolbarContent={
            (query || quality !== 'ALL') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.delete('q');
                    next.delete('quality');
                    return next;
                  });
                }}
              >
                <X /> Clear filters
              </Button>
            )
          }
          actions={
            <Select
              value={quality}
              onValueChange={(value) => {
                updateFilter('quality', value);
              }}
            >
              <SelectTrigger aria-label="Quality filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All qualities</SelectItem>
                <SelectItem value="PASS">PASS</SelectItem>
                <SelectItem value="FAIL">FAIL</SelectItem>
              </SelectContent>
            </Select>
          }
          emptyMessage={
            <div className="fitment-empty">
              <h2>
                {query || quality !== 'ALL'
                  ? 'No matching fitments'
                  : 'No fitment observations yet'}
              </h2>
              <p>
                {query || quality !== 'ALL'
                  ? 'Try another search or quality filter.'
                  : 'Record project and part observations in the project quality review. Records will appear here.'}
              </p>
            </div>
          }
          pagination={{
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            totalCount: rows.length,
            pageSizeOptions: [10, 25, 50],
            onPageChange: (page) => {
              setPagination((current) => ({ ...current, pageIndex: page - 1 }));
            },
            onPageSizeChange: (pageSize) => {
              setPagination({ pageIndex: 0, pageSize });
            },
          }}
        />
      </Card>
      <Card className="fitment-detail-card">
        <h2>Record a fitment observation</h2>
        <p>
          Open the existing project quality review to record project or part
          results with the required fitting evidence.
        </p>
        <div className="fitment-record-actions">
          <Select value={recordProject} onValueChange={setRecordProject}>
            <SelectTrigger aria-label="Project for fitment observation">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.flatMap((group) =>
                group.zoneProjects.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {group.vehicle} · {zone.id} · {zone.label}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
          {selectedProject ? (
            <Link
              className="fitment-link"
              to={
                '/product-shapes?' +
                new URLSearchParams({
                  view: 'review',
                  project: selectedProject.group.id,
                  zone: selectedProject.zone.id,
                }).toString()
              }
            >
              Open quality review <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Button disabled>Open quality review</Button>
          )}
        </div>
      </Card>
    </section>
  );
}
