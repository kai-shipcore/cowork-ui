import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
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
import { Plus, Search, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import type {
  SeatCoverCode,
  SeatCoverCodeOptionValue,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

/**
 * `seat_cover_code` dictionary plus its `seat_cover_code_x_option_value`
 * links.
 *
 * The links are the point: they tie a style code to the option dictionary so a
 * code can be suggested from a research vehicle's options. A code with no
 * links can never be suggested.
 */
export function SeatCoverCodePanel({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const {
    seatCoverCodes,
    setSeatCoverCodes,
    seatCoverCodeOptionValues,
    setSeatCoverCodeOptionValues,
    vehicleOptionKeys,
    vehicleOptionValues,
  } = useWorkbenchStore();
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [linkDialogFor, setLinkDialogFor] = useState<SeatCoverCode>();
  const [linkValueId, setLinkValueId] = useState('');

  // Seat cover codes only ever encode Seat Cover options.
  const seatOptionKeys = vehicleOptionKeys.filter(
    (optionKey) => optionKey.productTypeId === 'PT-SC',
  );
  const seatOptionValues = vehicleOptionValues.filter((value) =>
    seatOptionKeys.some(
      (optionKey) => optionKey.id === value.vehicleOptionKeyId,
    ),
  );
  const keyNameOf = (valueId: string) => {
    const value = seatOptionValues.find((item) => item.id === valueId);
    const optionKey = seatOptionKeys.find(
      (item) => item.id === value?.vehicleOptionKeyId,
    );
    return { key: optionKey?.name ?? '—', value: value?.value ?? valueId };
  };
  const linksOf = (styleCode: SeatCoverCode) =>
    seatCoverCodeOptionValues.filter(
      (link) => link.seatCoverCodeId === styleCode.id,
    );

  const normalized = query.trim().toLowerCase();
  const visible = seatCoverCodes.filter(
    (styleCode) =>
      !normalized ||
      `${styleCode.code} ${styleCode.description ?? ''}`
        .toLowerCase()
        .includes(normalized),
  );
  const {
    pageItems: pagedCodes,
    pagination,
    setPagination,
  } = useWorkbenchPagination(visible, query);
  const duplicateCode = seatCoverCodes.some(
    (styleCode) => styleCode.code.toLowerCase() === code.trim().toLowerCase(),
  );

  function addCode(): void {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || duplicateCode) return;
    const now = new Date().toISOString();
    setSeatCoverCodes((current) => [
      ...current,
      {
        id: `SCC-${trimmed}`,
        code: trimmed,
        ...(description.trim() ? { description: description.trim() } : {}),
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setCode('');
    setDescription('');
    setCodeDialogOpen(false);
  }

  function addLink(styleCode: SeatCoverCode): void {
    if (!linkValueId) return;
    const now = new Date().toISOString();
    const link: SeatCoverCodeOptionValue = {
      id: `SCCX-${styleCode.code}-${linkValueId}`,
      seatCoverCodeId: styleCode.id,
      vehicleOptionValueId: linkValueId,
      createdAt: now,
      updatedAt: now,
    };
    setSeatCoverCodeOptionValues((current) => [...current, link]);
    setLinkValueId('');
    setLinkDialogFor(undefined);
  }

  function removeLink(linkId: string): void {
    setSeatCoverCodeOptionValues((current) =>
      current.filter((link) => link.id !== linkId),
    );
  }

  const alreadyLinked =
    linkDialogFor !== undefined &&
    linksOf(linkDialogFor).some(
      (link) => link.vehicleOptionValueId === linkValueId,
    );

  return (
    <>
      <div className="grid-toolbar">
        <div className="grid-toolbar-filters">
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input
              aria-label="Code 또는 설명 검색"
              placeholder="Code 검색"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
        </div>
        <div className="grid-toolbar-actions">
          <Button variant="primary" onClick={() => setCodeDialogOpen(true)}>
            <Plus /> Code 등록
          </Button>
        </div>
      </div>

      {visible.length ? (
        <>
          <div className="option-key-rows">
            {pagedCodes.map((styleCode) => {
              const links = linksOf(styleCode);
              return (
                <div className="option-key-row" key={styleCode.id}>
                  <div className="option-key-name">
                    <span className="option-key-title">
                      <span className="reference-code">{styleCode.code}</span>
                      <StatusBadge
                        label={styleCode.status}
                        tone={
                          styleCode.status === 'ACTIVE' ? 'success' : 'neutral'
                        }
                      />
                    </span>
                    <small>{styleCode.description ?? '설명 없음'}</small>
                  </div>
                  <div className="option-value-list">
                    {links.length ? (
                      links.map((link) => {
                        const named = keyNameOf(link.vehicleOptionValueId);
                        return (
                          <span className="option-value-chip" key={link.id}>
                            <em>{named.key}</em>
                            {named.value}
                            <button
                              type="button"
                              aria-label={`${named.value} 연결 해제`}
                              onClick={() => removeLink(link.id)}
                            >
                              <Trash2 />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="muted-text">
                        연결된 옵션 값이 없습니다. 연결하지 않으면 research
                        차량의 옵션으로부터 이 코드를 추천할 수 없습니다.
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLinkValueId('');
                      setLinkDialogFor(styleCode);
                    }}
                  >
                    <Plus /> 옵션 값 연결
                  </Button>
                </div>
              );
            })}
          </div>
          <WorkbenchPagination
            recordCount={visible.length}
            pagination={pagination}
            onPaginationChange={setPagination}
          />
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <strong>조건에 맞는 Code가 없습니다.</strong>
          <p>검색어를 바꿔 보세요.</p>
        </div>
      )}

      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat Cover Code 등록</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Code
              <Input
                placeholder="예: 424BEN"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <label>
              설명 (선택)
              <Input
                placeholder="예: 40/20/40 split-cushion bench"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              Code는 연식이 들어가지 않습니다 — 연식은 패턴 이름이 담당하므로
              모델연도마다 코드가 늘지 않습니다. Shape 이름과는 다른 코드
              체계입니다.
            </div>
            {duplicateCode && code.trim() && (
              <div className="dialog-error">같은 Code가 이미 있습니다.</div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!code.trim() || duplicateCode}
              onClick={addCode}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linkDialogFor !== undefined}
        onOpenChange={(open) => !open && setLinkDialogFor(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{linkDialogFor?.code} · 옵션 값 연결</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              옵션 값
              <Select value={linkValueId} onValueChange={setLinkValueId}>
                <SelectTrigger aria-label="옵션 값">
                  <SelectValue placeholder="옵션 값 선택" />
                </SelectTrigger>
                <SelectContent>
                  {seatOptionValues.map((value) => {
                    const named = keyNameOf(value.id);
                    return (
                      <SelectItem value={value.id} key={value.id}>
                        {named.key} = {named.value}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </label>
            <div className="dialog-note">
              연결한 값들이 이 코드의 의미가 됩니다. Vehicle Options에서 값을
              먼저 등록해야 여기에 나타납니다.
            </div>
            {alreadyLinked && (
              <div className="dialog-error">이미 연결된 값입니다.</div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogFor(undefined)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!linkValueId || alreadyLinked}
              onClick={() => linkDialogFor && addLink(linkDialogFor)}
            >
              연결
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
