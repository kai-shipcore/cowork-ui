import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
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
import type { PaginationState } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import { WorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { Visit } from '@/shared/types/workbench';
import type { HuntRow } from '../hunt-rows';
import './hunt-work-list.css';

type Filter = {
  query: string;
  product: string;
  scheduled: string;
  from: string;
  to: string;
  page: PaginationState;
};
const emptyFilter = (): Filter => ({
  query: '',
  product: '',
  scheduled: '',
  from: '',
  to: '',
  page: { pageIndex: 0, pageSize: 25 },
});
/** Radix Select cannot hold an empty value, so "all" is spelled out. */
const ALL = 'ALL';

export function HuntWorkList({
  kind,
  rows,
  onProject,
  onSchedule,
  onVisit,
  assignees,
}: {
  kind: Visit['kind'];
  rows: HuntRow[];
  onProject: (id: string) => void;
  onSchedule: (id: string) => void;
  onVisit: (visit: Visit) => void;
  assignees: (visit: Visit) => string;
}) {
  const [status, setStatus] = useState<'waiting' | 'completed'>('waiting');
  const [filters, setFilters] = useState({
    waiting: emptyFilter(),
    completed: emptyFilter(),
  });
  const filter = filters[status];
  const label = kind === 'SCAN' ? '스캔' : '피팅';
  const done = status === 'completed';
  function update(patch: Partial<Filter>) {
    setFilters((current) => ({
      ...current,
      [status]: {
        ...current[status],
        ...patch,
        page: { ...current[status].page, pageIndex: 0 },
      },
    }));
  }
  const subset = rows.filter((row) => row.done === done);
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  const filtered = subset
    .filter(
      (row) =>
        `${row.project.vehicle} ${row.project.id}`
          .toLowerCase()
          .includes(filter.query.trim().toLowerCase()) &&
        (!filter.product || row.project.product === filter.product) &&
        (done
          ? !invalidRange &&
            (!filter.from || row.completedDate >= filter.from) &&
            (!filter.to ||
              (Boolean(row.completedDate) && row.completedDate <= filter.to))
          : !filter.scheduled ||
            Boolean(row.scheduled) === (filter.scheduled === 'yes')),
    )
    .sort((a, b) =>
      done
        ? b.completedDate.localeCompare(a.completedDate) ||
          a.project.id.localeCompare(b.project.id)
        : Number(Boolean(a.scheduled)) - Number(Boolean(b.scheduled)) ||
          (a.scheduled?.date ?? '').localeCompare(b.scheduled?.date ?? '') ||
          a.project.id.localeCompare(b.project.id),
    );
  const pagination = {
    ...filter.page,
    pageIndex: Math.min(
      filter.page.pageIndex,
      Math.max(0, Math.ceil(filtered.length / filter.page.pageSize) - 1),
    ),
  };
  const shown = filtered.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  const statusTabs = [
    { value: 'waiting', label: '대기', count: rows.filter((r) => !r.done) },
    { value: 'completed', label: '완료', count: rows.filter((r) => r.done) },
  ] as const;
  return (
    <div className="hunt-work-list">
      <div className="grid-toolbar">
        <div
          className="grid-toolbar-filters"
          aria-label={`${label} ${done ? '완료' : '대기'} 검색 및 필터`}
        >
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input
              aria-label={`${label} ${done ? '완료' : '대기'} 검색`}
              placeholder="차량명 · 프로젝트 ID 검색"
              value={filter.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </div>
          <Select
            value={filter.product || ALL}
            onValueChange={(value) =>
              update({ product: value === ALL ? '' : value })
            }
          >
            <SelectTrigger aria-label="제품군" className="filter-select wide">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 제품군</SelectItem>
              {[
                'Seat Cover',
                'Floor Mat',
                ...(kind === 'FITTING' ? ['Car Cover'] : []),
              ].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {done ? (
            <>
              <Input
                className="hunt-date-input"
                type="date"
                aria-label="완료 방문일 · 시작"
                value={filter.from}
                onChange={(e) => update({ from: e.target.value })}
              />
              <Input
                className="hunt-date-input"
                type="date"
                aria-label="완료 방문일 · 종료"
                value={filter.to}
                onChange={(e) => update({ to: e.target.value })}
              />
            </>
          ) : (
            <Select
              value={filter.scheduled || ALL}
              onValueChange={(value) =>
                update({ scheduled: value === ALL ? '' : value })
              }
            >
              <SelectTrigger aria-label="일정 상태" className="filter-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체 일정</SelectItem>
                <SelectItem value="no">미예약</SelectItem>
                <SelectItem value="yes">예약됨</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div
            className="stage-tabs"
            role="group"
            aria-label={`${label} 처리 상태`}
          >
            {statusTabs.map((tab) => (
              <button
                type="button"
                key={tab.value}
                className="stage-tab"
                aria-pressed={status === tab.value}
                onClick={() => setStatus(tab.value)}
              >
                {tab.label}
                <span className="stage-tab-count">{tab.count.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid-toolbar-actions">
          <Button variant="outline" onClick={() => update(emptyFilter())}>
            필터 초기화
          </Button>
        </div>
      </div>
      {invalidRange && (
        <p className="hunt-list-note" role="alert">
          종료일은 시작일 이후로 선택하세요.
        </p>
      )}
      {done && (
        <p className="hunt-list-note muted-text">
          최근 완료 방문순 · 날짜는 마지막 완료 방문일이며, 방문 기록 없이
          완료된 항목은 ‘미기록’으로 표시됩니다.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>차량 · 제품군</TableHead>
            <TableHead>프로젝트 ID</TableHead>
            <TableHead>{done ? '완료 구역' : `남은 ${label} 구역`}</TableHead>
            <TableHead>
              {done ? '최종 완료 방문일' : '다음 방문 일정 · 딜러'}
            </TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="action-column" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => (
            <TableRow key={row.project.id}>
              <TableCell>
                <strong>{row.project.vehicle}</strong>
                <div className="vehicle-meta">{row.project.product}</div>
              </TableCell>
              <TableCell>
                <button
                  className="project-reference project-reference-link"
                  onClick={() => onProject(row.project.id)}
                >
                  {row.project.id}
                </button>
              </TableCell>
              <TableCell>
                <div className="zone-list">
                  {(done ? row.completed : row.remaining).map((z) => (
                    <span
                      className={`zone zone-${z.code.toLowerCase()}`}
                      key={z.id}
                    >
                      {z.code}
                    </span>
                  ))}
                </div>
                {!done && (
                  <div className="vehicle-meta">
                    {row.remaining.length}개 구역 남음
                  </div>
                )}
              </TableCell>
              <TableCell>
                {done ? (
                  row.completedDate || '미기록'
                ) : row.scheduled ? (
                  <>
                    <div>
                      {row.scheduled.date} {row.scheduled.time}
                    </div>
                    <div>{row.scheduled.dealer}</div>
                    <small>{assignees(row.scheduled)}</small>
                  </>
                ) : (
                  '예약된 일정 없음'
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={
                    done
                      ? `${label} 완료`
                      : row.completed.length
                        ? `일부 완료 · ${row.remaining.length}개 남음`
                        : row.scheduled
                          ? '예약됨'
                          : '미예약'
                  }
                  tone={
                    done
                      ? 'success'
                      : row.completed.length
                        ? 'warning'
                        : row.scheduled
                          ? 'progress'
                          : 'neutral'
                  }
                />
                {!done && row.completed.length > 0 && (
                  <div className="vehicle-meta">
                    {row.scheduled ? '예약됨' : '미예약'}
                  </div>
                )}
              </TableCell>
              <TableCell className="table-actions">
                {done ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onProject(row.project.id)}
                  >
                    프로젝트 보기
                  </Button>
                ) : row.scheduled ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (row.scheduled) onVisit(row.scheduled);
                    }}
                  >
                    일정 보기
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onSchedule(row.project.id)}
                  >
                    일정 잡기
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!shown.length && (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="empty-inline">
                  {subset.length
                    ? '검색 조건에 맞는 항목이 없습니다. 검색어나 필터를 변경하세요.'
                    : `${label} ${done ? '완료' : '대기'} 프로젝트가 없습니다.`}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <WorkbenchPagination
        recordCount={filtered.length}
        pagination={pagination}
        onPaginationChange={(action) =>
          setFilters((current) => ({
            ...current,
            [status]: {
              ...current[status],
              page: typeof action === 'function' ? action(pagination) : action,
            },
          }))
        }
      />
    </div>
  );
}
