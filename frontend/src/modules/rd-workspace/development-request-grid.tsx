import type { ReactElement, ReactNode } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Link } from 'react-router-dom';
import type {
  VehicleConfiguration,
  VehicleProjectGroup,
} from '@/shared/types/workbench';
import {
  INTAKE_STATUSES,
  linkedIntakeProjects,
  type DevelopmentIntake,
} from './intake-model';

interface DevelopmentRequestGridProps {
  rows: readonly DevelopmentIntake[];
  projects: readonly VehicleProjectGroup[];
  configurations: readonly VehicleConfiguration[];
  query: string;
  status: string;
  onFilter: (key: string, value: string) => void;
  actions: ReactNode;
}

/** Review queue uses the same embedded grid controls as the project and report tabs. */
export function DevelopmentRequestGrid({
  rows,
  projects,
  configurations,
  query,
  status,
  onFilter,
  actions,
}: DevelopmentRequestGridProps): ReactElement {
  const columns: FlatDataGridColumn<DevelopmentIntake>[] = [
    {
      id: 'vehicle',
      header: 'Vehicle / Product',
      width: 240,
      sortValue: (entry) => entry.vehicle,
      cell: (entry) => (
        <div>
          <strong>{entry.vehicle}</strong>
          <br />
          <small>
            {entry.product} ·{' '}
            {entry.configurationId || 'No configuration linked'}
          </small>
        </div>
      ),
    },
    {
      id: 'source',
      header: 'Source / Demand',
      width: 240,
      sortValue: (entry) => entry.source,
      cell: (entry) => (
        <div>
          {entry.source}
          <br />
          <small>
            Notify {entry.notifyCount} / Complaints {entry.complaintCount} / B2B{' '}
            {entry.b2bUnits}
            {entry.releaseDate && ` / Launch ${entry.releaseDate}`}
          </small>
        </div>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      width: 120,
      sortValue: (entry) =>
        ['LOW', 'NORMAL', 'HIGH', 'URGENT'].indexOf(entry.priority),
      cell: (entry) => entry.priority,
    },
    {
      id: 'status',
      header: 'Review decision',
      width: 130,
      sortValue: (entry) => entry.status,
      cell: (entry) => entry.status,
    },
    {
      id: 'project',
      header: 'Project',
      width: 190,
      cell: (entry) => {
        const linked = linkedIntakeProjects(entry, projects);
        const config = configurations.find(
          (item) => item.id === entry.configurationId,
        );
        if (linked.length)
          return (
            <div>
              {linked.map((project) => (
                <div key={project.id}>
                  <Link
                    className="text-primary underline"
                    to={'/vehicle-projects?project=' + project.id}
                  >
                    {project.id}
                  </Link>
                </div>
              ))}
            </div>
          );
        if (
          entry.status === 'Development approved' &&
          config?.researchStatus === 'COMPLETE'
        )
          return (
            <Link
              className="text-primary underline"
              to={
                '/vehicle-projects?new=1&configuration=' +
                encodeURIComponent(config.id) +
                '&intake=' +
                encodeURIComponent(entry.id)
              }
            >
              Create project →
            </Link>
          );
        return (
          <small>
            {entry.status === 'Development approved'
              ? 'Link a completed research configuration'
              : 'Create after review'}
          </small>
        );
      },
    },
    {
      id: 'review',
      header: 'Review',
      width: 125,
      hideable: false,
      cell: (entry) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onFilter('request', entry.id);
          }}
        >
          Evidence / Review
        </Button>
      ),
    },
  ];
  return (
    <FlatDataGrid
      embedded
      label="Development request review queue"
      rows={rows}
      columns={columns}
      getRowId={(entry) => entry.id}
      sorting={{ mode: 'client' }}
      search={{
        label: 'Search development requests',
        placeholder: 'Search vehicle / Source / Reference',
        value: query,
        onChange: (value) => {
          onFilter('q', value);
        },
      }}
      filters={[
        {
          id: 'status',
          label: 'Review status',
          value: status,
          options: ['All', ...INTAKE_STATUSES].map((value) => ({
            value,
            label: value,
          })),
          onChange: (value) => {
            onFilter('status', value);
          },
        },
      ]}
      toolbarContent={
        <span className="text-sm text-muted-foreground">
          Review queue · {rows.length} items
        </span>
      }
      actions={actions}
      emptyMessage="No matching requests. Change the search filters or create a request."
    />
  );
}
