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
    window.confirm('저장하지 않은 검수 내용이 있습니다. 변경 내용을 버릴까요?');
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
          <DialogTitle>샘플 입고·검수 · {requestId}</DialogTitle>
          <DialogDescription>
            {request?.vehicle} · {request?.factory} · {items.length}개 항목
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[70dvh] overflow-y-auto">
          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <p className="text-sm font-semibold">검수할 항목</p>
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
                    {item.sampleRound}차 샘플
                  </span>
                  <InspectionResult item={item} />
                </button>
              ))}
              {!items.length && (
                <p className="text-sm text-muted-foreground">
                  등록된 요청 항목이 없습니다.
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
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
