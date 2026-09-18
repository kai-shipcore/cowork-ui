import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import { useWorkbenchPagination } from '@/shared/components/workbench-pagination';
import type { SeatCoverPart, VehicleZone } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

/** Open-ended in the schema (no CHECK), so these are suggestions, not a union. */
const CATEGORY_SUGGESTIONS = [
  'HEADREST',
  'TOP',
  'BOTTOM',
  'ARM',
  'BACK',
  'OTHER',
] as const;

/**
 * `seat_cover_part` dictionary — the part kinds a seat cover BOM is built
 * from. The legacy universal set (`isCustom: false`) is closed: those parts
 * are their own pattern, so new rows are always custom.
 */
export function SeatCoverPartPanel({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { seatCoverParts, setSeatCoverParts, vehicleZones } =
    useWorkbenchStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [zoneId, setZoneId] = useState('ZONE-SC-F');
  const [category, setCategory] = useState<string>('HEADREST');
  const [isForMiddleSeat, setIsForMiddleSeat] = useState(false);

  const seatZones = vehicleZones.filter(
    (zone: VehicleZone) => zone.productTypeId === 'PT-SC',
  );
  const zoneLabel = (id: string) => {
    const zone = seatZones.find((item) => item.id === id);
    return zone ? `${zone.code} · ${zone.name}` : id;
  };
  const normalized = query.trim().toLowerCase();
  const visible = seatCoverParts.filter(
    (part) =>
      !normalized ||
      `${part.name} ${part.category} ${part.description ?? ''}`
        .toLowerCase()
        .includes(normalized),
  );
  const columns: FlatDataGridColumn<(typeof visible)[number]>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 210,
      sortValue: (part) => part.name,
      cell: (part) => (
        <>
          <span className="reference-code">{part.name}</span>
          {part.description && (
            <div className="vehicle-meta">{part.description}</div>
          )}
        </>
      ),
    },
    {
      id: 'zone',
      header: 'Zone',
      width: 180,
      sortValue: (part) => zoneLabel(part.vehicleZoneId),
      cell: (part) => <>{zoneLabel(part.vehicleZoneId)}</>,
    },
    {
      id: 'category',
      header: 'Category',
      width: 180,
      sortValue: (part) => part.category,
      cell: (part) => <>{part.category}</>,
    },
    {
      id: 'middle-seat',
      header: '중간석',
      width: 180,
      sortValue: (part) => Number(part.isForMiddleSeat),
      cell: (part) => (
        <>
          {part.isForMiddleSeat ? (
            <StatusBadge label="중간석" tone="purple" />
          ) : (
            <span className="muted-text">—</span>
          )}
        </>
      ),
    },
    {
      id: 'type',
      header: '구분',
      width: 180,
      sortValue: (part) => Number(part.isCustom),
      cell: (part) => (
        <>
          {part.isCustom ? (
            <StatusBadge label="Custom" tone="progress" />
          ) : (
            <>
              <StatusBadge label="Legacy universal" tone="neutral" />
              <div className="vehicle-meta">{part.vehicleProductDesignId}</div>
            </>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: '상태',
      width: 180,
      sortValue: (part) => part.status,
      cell: (part) => (
        <>
          <StatusBadge
            label={part.status}
            tone={part.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
        </>
      ),
    },
    {
      id: 'actions',
      header: '작업',
      width: 180,
      hideable: false,
      cell: (part) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toggleStatus(part);
            }}
          >
            {part.status === 'ACTIVE' ? '비활성' : '활성'}
          </Button>
        </div>
      ),
    },
  ];
  const gridTable = useReactTable({
    // Paging is owned by the surrounding filters and the shared grid pager.
    autoResetPageIndex: false,
    data: [...visible],
    columns: columns.map((column) => ({
      id: column.id,
      accessorFn: column.sortValue,
      sortUndefined: 'last',
    })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = gridTable.getRowModel().rows.map((row) => row.original);
  const activeSort = gridTable.getState().sorting.slice(0, 1).pop();
  const {
    pageItems: pagedParts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(sortedRows, query);
  const duplicate = seatCoverParts.some(
    (part) => part.name.toLowerCase() === name.trim().toLowerCase(),
  );

  function addPart(): void {
    const trimmed = name.trim();
    if (!trimmed || duplicate) return;
    const now = new Date().toISOString();
    const part: SeatCoverPart = {
      id: `SCP-${trimmed.toUpperCase()}`,
      name: trimmed,
      ...(description.trim() ? { description: description.trim() } : {}),
      vehicleZoneId: zoneId,
      category,
      isForMiddleSeat,
      // The legacy universal set is closed, so a new part is always custom.
      isCustom: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    setSeatCoverParts((current) => [...current, part]);
    setName('');
    setDescription('');
    setDialogOpen(false);
  }

  function toggleStatus(part: SeatCoverPart): void {
    setSeatCoverParts((current) =>
      current.map((item) =>
        item.id === part.id
          ? {
              ...item,
              status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  return (
    <>
      <div className="grid-toolbar">
        <div className="grid-toolbar-filters">
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input
              aria-label="Part 이름 또는 설명 검색"
              placeholder="Part 검색"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
            />
          </div>
        </div>
        <div className="grid-toolbar-actions">
          <Button
            variant="primary"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus /> Part 등록
          </Button>
        </div>
      </div>

      {visible.length ? (
        <>
          <FlatDataGrid
            embedded
            label="Seat Cover Parts"
            columns={columns}
            rows={pagedParts}
            getRowId={(part) => part.id}

            pagination={{
              page: pagination.pageIndex + 1,
              pageSize: pagination.pageSize,
              totalCount: visible.length,
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
            sorting={{
              mode: 'manual',
              value: activeSort
                ? {
                    id: activeSort.id,
                    direction: activeSort.desc ? 'desc' : 'asc',
                  }
                : null,
              onChange: (sort) => {
                gridTable.setSorting(
                  sort
                    ? [{ id: sort.id, desc: sort.direction === 'desc' }]
                    : [],
                );
              },
            }}
          />
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <strong>조건에 맞는 Part가 없습니다.</strong>
          <p>검색어를 바꿔 보세요.</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat Cover Part 등록</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Name
              <Input
                placeholder="예: FMB"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </label>
            <label>
              Zone
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger aria-label="Zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seatZones.map((zone) => (
                    <SelectItem value={zone.id} key={zone.id}>
                      {zone.code} · {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Category
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_SUGGESTIONS.map((item) => (
                    <SelectItem value={item} key={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="checkbox-field">
              <Checkbox
                checked={isForMiddleSeat}
                onCheckedChange={(checked) => {
                  setIsForMiddleSeat(Boolean(checked));
                }}
              />
              중간석 변형 (FMB vs FB)
            </label>
            <label className="full-width">
              설명 (선택)
              <Input
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </label>
            <div className="dialog-note">
              신규 Part는 항상 Custom입니다. Legacy universal part
              집합(is_custom = false)은 닫혀 있어 더 만들 수 없습니다 — 반복된
              피팅 문제로 중단된 방식입니다.
            </div>
            {duplicate && name.trim() && (
              <div className="dialog-error">
                같은 이름의 Part가 이미 있습니다.
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || duplicate}
              onClick={addPart}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
