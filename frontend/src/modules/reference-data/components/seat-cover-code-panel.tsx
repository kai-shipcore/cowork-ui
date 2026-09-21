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
              aria-label="Search code or description"
              placeholder="Search codes"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
        </div>
        <div className="grid-toolbar-actions">
          <Button variant="primary" onClick={() => setCodeDialogOpen(true)}>
            <Plus /> Add code
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
                    <small>{styleCode.description ?? 'No description'}</small>
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
                              aria-label={`${named.value} Unlink`}
                              onClick={() => removeLink(link.id)}
                            >
                              <Trash2 />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="muted-text">
                        No linked option values. Without a link, this code
                        cannot be suggested from research vehicle options.
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
                    <Plus /> Link option values
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
          <strong>No matching codes.</strong>
          <p>Try another search term.</p>
        </div>
      )}

      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Seat Cover code</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Code
              <Input
                placeholder="Example: 424BEN"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <label>
              Description (optional)
              <Input
                placeholder="Example: 40/20/40 split-cushion bench"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="dialog-note">
              Codes do not include model years; pattern names carry the year
              instead. This avoids creating codes for each model year. This code
              system is separate from Shape names.
            </div>
            {duplicateCode && code.trim() && (
              <div className="dialog-error">This code already exists.</div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeDialogOpen(false)}>
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={!code.trim() || duplicateCode}
              onClick={addCode}
            >
              Create
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
            <DialogTitle>
              {linkDialogFor?.code} · Link option values
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label className="full-width">
              Option value
              <Select value={linkValueId} onValueChange={setLinkValueId}>
                <SelectTrigger aria-label="Option value">
                  <SelectValue placeholder="Select option value" />
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
              Linked values define this code's meaning. Add values in Vehicle
              Options before linking them here.
            </div>
            {alreadyLinked && (
              <div className="dialog-error">This value is already linked.</div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogFor(undefined)}
            >
              Cancelled
            </Button>
            <Button
              variant="primary"
              disabled={!linkValueId || alreadyLinked}
              onClick={() => linkDialogFor && addLink(linkDialogFor)}
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
