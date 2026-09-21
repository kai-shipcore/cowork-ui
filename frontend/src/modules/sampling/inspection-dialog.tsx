import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { useWorkbenchStore } from '@/app/workbench-store';
import { InspectionPanel } from './inspection-panel';
import { InspectionResult } from './inspection-result';

export function InspectionDialog({
  requestId,
  itemId,
  onClose,
  onSaved,
}: {
  requestId: string;
  itemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sampleRequests, sampleRequestItems, projectDetails } =
    useWorkbenchStore();
  const request = sampleRequests.find((row) => row.id === requestId);
  const items = sampleRequestItems.filter(
    (row) => row.sampleRequestId === requestId,
  );
  const [selected, setSelected] = useState(
    itemId ??
      items.find((row) => row.sampleReceivedAt && !row.inspectedAt)?.id ??
      items[0]?.id,
  );
  const [dirty, setDirty] = useState(false);
  const allowDiscard = () =>
    !dirty ||
    window.confirm('You have unsaved inspection changes. Discard them?');
  const close = () => {
    if (allowDiscard()) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sample receipt & inspection · {requestId}</DialogTitle>
          <DialogDescription>
            {request?.vehicle} · {request?.factory} · {items.length} items
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[70dvh] overflow-y-auto">
          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Items to inspect</p>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={selected === item.id}
                  className={`w-full rounded-lg border p-3 text-left ${selected === item.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'}`}
                  onClick={() => {
                    if (selected !== item.id && allowDiscard()) {
                      setDirty(false);
                      setSelected(item.id);
                    }
                  }}
                >
                  <span className="block break-all text-sm font-semibold">
                    {projectDetails[
                      request?.projectGroupId ?? ''
                    ]?.designs.find(
                      (design) => design.id === item.vehicleProductDesignId,
                    )?.name ?? item.vehicleProductDesignId}
                  </span>
                  <span className="mb-2 block text-xs text-muted-foreground">
                    Sample round {item.sampleRound}
                  </span>
                  <InspectionResult item={item} />
                </button>
              ))}
              {!items.length && (
                <p className="text-sm text-muted-foreground">
                  No request items registered.
                </p>
              )}
            </div>
            {selected && (
              <InspectionPanel
                key={selected}
                itemId={selected}
                onDirty={() => setDirty(true)}
                onSaved={() => {
                  setDirty(false);
                  onSaved();
                }}
              />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
