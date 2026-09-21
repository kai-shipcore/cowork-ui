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
import { useNavigate } from 'react-router';
import type { ProductType, ProjectDesign } from '@/shared/types/workbench';
import { usePartLibrary } from './part-library';
import './parts.css';

export function PartLinkDialog({
  product,
  productTypeId,
  zoneId,
  returnTo,
  selectedPart,
  existing,
  onClose,
  onLink,
}: {
  product: ProductType;
  productTypeId: string;
  zoneId: string;
  returnTo: string;
  selectedPart?: string;
  existing: readonly ProjectDesign[];
  onClose: () => void;
  onLink: (design: ProjectDesign) => void;
}) {
  const library = usePartLibrary().filter((p) => p.product === product);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [id, setId] = useState(selectedPart ?? '');
  const part = library.find((p) => p.id === id);
  const [revisionId, setRevisionId] = useState('');
  const revision =
    part?.revisions.find((r) => r.id === revisionId) ??
    part?.revisions[part.revisions.length - 1];
  const [quantity, setQuantity] = useState(1);
  const duplicate = existing.some(
    (d) =>
      d.vehicleProjectId === zoneId &&
      (d.libraryPartId === id || d.name === part?.name),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="part-link-dialog">
        <DialogHeader>
          <DialogTitle>Link existing part</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="part-link-form">
            <label>
              Search parts
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name / Part type"
              />
            </label>
            <label>
              Part
              <Select
                value={id}
                onValueChange={(value) => {
                  setId(value);
                  setRevisionId('');
                }}
              >
                <SelectTrigger aria-label="Select part">
                  <SelectValue placeholder="Select a part to link" />
                </SelectTrigger>
                <SelectContent className="part-link-options" position="popper">
                  {library
                    .filter((p) =>
                      `${p.name} ${p.type}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>
            {!library.length && (
              <p>
                Registered {product} parts are not available. Create a new part
                first.
              </p>
            )}
            <label>
              Applied revision
              <Select
                value={revision?.id ?? ''}
                onValueChange={setRevisionId}
                disabled={!part?.revisions.length}
              >
                <SelectTrigger aria-label="Applied revision">
                  <SelectValue placeholder="Select a part first" />
                </SelectTrigger>
                <SelectContent className="part-link-options" position="popper">
                  {part?.revisions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      v{r.revisionNumber} · {r.note}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Project quantity
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <p className="part-link-note">
              The selected revision is pinned. Fitting on this vehicle must be
              verified separately.
            </p>
            {duplicate && <p role="alert">This part is already linked.</p>}
          </div>
        </DialogBody>
        <DialogFooter className="part-link-footer">
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/parts?${new URLSearchParams({ view: 'create', product, returnTo, zone: new URLSearchParams(returnTo.split('?')[1]).get('zone') ?? 'F' })}`,
              )
            }
          >
            Create new part
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelled
          </Button>
          <Button
            variant="primary"
            disabled={
              !part ||
              !revision ||
              duplicate ||
              !Number.isInteger(quantity) ||
              quantity < 1
            }
            onClick={() => {
              if (
                !part ||
                !revision ||
                duplicate ||
                !Number.isInteger(quantity) ||
                quantity < 1
              )
                return;
              onLink({
                id: `DS-${crypto.randomUUID()}`,
                libraryPartId: part.id,
                libraryRevisionId: revision.id,
                productTypeId,
                vehicleProjectId: zoneId,
                name: part.name,
                status: 'ACTIVE',
                quantity,
                details: { ...part.details },
                revisions: [
                  {
                    ...revision,
                    id: `REV-${crypto.randomUUID()}`,
                    sampleApprovedAt: undefined,
                    sampleApprovedBy: undefined,
                  },
                ],
                fittingConfirmed: false,
              });
            }}
          >
            Link to project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
