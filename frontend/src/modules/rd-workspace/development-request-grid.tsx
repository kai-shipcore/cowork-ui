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
      header: '차량 / 제품',
      width: 240,
      sortValue: (entry) => entry.vehicle,
      cell: (entry) => (
        <div>
          <strong>{entry.vehicle}</strong>
          <br />
          <small>
            {entry.product} · {entry.configurationId || '구성 미연결'}
          </small>
        </div>
      ),
    },
    {
      id: 'source',
      header: '유입 · 수요',
      width: 240,
      sortValue: (entry) => entry.source,
      cell: (entry) => (
        <div>
          {entry.source}
          <br />
          <small>
            Notify {entry.notifyCount} / 불만 {entry.complaintCount} / B2B{' '}
            {entry.b2bUnits}
            {entry.releaseDate && ` / 출시 ${entry.releaseDate}`}
          </small>
        </div>
      ),
    },
    {
      id: 'priority',
      header: '우선순위',
      width: 120,
      sortValue: (entry) =>
        ['LOW', 'NORMAL', 'HIGH', 'URGENT'].indexOf(entry.priority),
      cell: (entry) => entry.priority,
    },
    {
      id: 'status',
      header: '검토 결과',
      width: 130,
      sortValue: (entry) => entry.status,
      cell: (entry) => entry.status,
    },
    {
      id: 'project',
      header: '프로젝트',
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
          entry.status === '개발 승인' &&
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
              프로젝트 생성 →
            </Link>
          );
        return (
          <small>
            {entry.status === '개발 승인'
              ? '조사 완료 구성 연결 필요'
              : '검토 후 생성'}
          </small>
        );
      },
    },
    {
      id: 'review',
      header: '검토',
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
          근거 · 검토
        </Button>
      ),
    },
  ];
  return (
    <FlatDataGrid
      embedded
      label="개발 요청 검토 대기열"
      rows={rows}
      columns={columns}
      getRowId={(entry) => entry.id}
      sorting={{ mode: 'client' }}
      search={{
        label: '개발 요청 검색',
        placeholder: '차량 / 유입 경로 / 출처 검색',
        value: query,
        onChange: (value) => {
          onFilter('q', value);
        },
      }}
      filters={[
        {
          id: 'status',
          label: '검토 상태',
          value: status,
          options: ['전체', ...INTAKE_STATUSES].map((value) => ({
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
          검토 대기열 · {rows.length}건
        </span>
      }
      actions={actions}
      emptyMessage="조건에 맞는 요청이 없습니다. 검색 조건을 변경하거나 새 요청을 등록하세요."
    />
  );
}
