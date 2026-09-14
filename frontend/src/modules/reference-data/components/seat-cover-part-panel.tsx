import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
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
import { Plus } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
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
export function SeatCoverPartPanel({ query }: { query: string }) {
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
  const {
    pageItems: pagedParts,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visible, query);
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
      <div className="panel-actions">
        <span className="filter-count">
          {visible.length} / {seatCoverParts.length} parts
        </span>
        <Button size="sm" variant="primary" onClick={() => setDialogOpen(true)}>
          <Plus /> Part 등록
        </Button>
      </div>

      {visible.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>중간석</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="action-column" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedParts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell>
                    <span className="reference-code">{part.name}</span>
                    {part.description && (
                      <div className="vehicle-meta">{part.description}</div>
                    )}
                  </TableCell>
                  <TableCell>{zoneLabel(part.vehicleZoneId)}</TableCell>
                  <TableCell>{part.category}</TableCell>
                  <TableCell>
                    {part.isForMiddleSeat ? (
                      <StatusBadge label="중간석" tone="purple" />
                    ) : (
                      <span className="muted-text">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {part.isCustom ? (
                      <StatusBadge label="Custom" tone="progress" />
                    ) : (
                      <>
                        <StatusBadge label="Legacy universal" tone="neutral" />
                        <div className="vehicle-meta">
                          {part.vehicleProductDesignId}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={part.status}
                      tone={part.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </TableCell>
                  <TableCell className="table-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(part)}
                    >
                      {part.status === 'ACTIVE' ? '비활성' : '활성'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <WorkbenchPagination
            recordCount={visible.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            itemLabel="parts"
          />
        </Card>
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
                onChange={(event) => setName(event.target.value)}
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
                onCheckedChange={(checked) =>
                  setIsForMiddleSeat(Boolean(checked))
                }
              />
              중간석 변형 (FMB vs FB)
            </label>
            <label className="full-width">
              설명 (선택)
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
