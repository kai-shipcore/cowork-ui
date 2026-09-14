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
import { Textarea } from '@coverland-engineering/ui/textarea';
import type { SampleShipmentDetails } from '@/shared/types/workbench';

interface ShipmentDialogProps {
  /** Request or sample id shown in the title. */
  subject: string;
  factory: string;
  onClose: () => void;
  onSubmit: (details: SampleShipmentDetails) => void;
}

/**
 * Records a `sample_shipment` row when a request leaves the factory:
 * dates, the carrier's tracking number and a memo.
 */
export function ShipmentDialog({
  subject,
  factory,
  onClose,
  onSubmit,
}: ShipmentDialogProps) {
  const today = new Date().toLocaleDateString('en-CA');
  const [sampleReadyAt, setSampleReadyAt] = useState('');
  const [shippedAt, setShippedAt] = useState(today);
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [note, setNote] = useState('');
  const canSubmit = Boolean(shippedAt && externalReference.trim());

  function submit(): void {
    if (!canSubmit) return;
    onSubmit({
      shippedAt,
      externalReference: externalReference.trim(),
      ...(sampleReadyAt ? { sampleReadyAt } : {}),
      ...(expectedArrivalDate ? { expectedArrivalDate } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Shipment 등록 · {subject} · {factory}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="dialog-form-grid">
            <label>
              Sample Ready At
              <Input
                type="date"
                value={sampleReadyAt}
                onChange={(event) => setSampleReadyAt(event.target.value)}
              />
            </label>
            <label>
              Shipped At
              <Input
                type="date"
                required
                value={shippedAt}
                onChange={(event) => setShippedAt(event.target.value)}
              />
            </label>
            <label>
              Expected Arrival Date
              <Input
                type="date"
                value={expectedArrivalDate}
                onChange={(event) => setExpectedArrivalDate(event.target.value)}
              />
            </label>
            <label>
              External Reference (Tracking No.)
              <Input
                required
                placeholder="SF-284910573"
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
              />
            </label>
            <label className="full-width">
              Note
              <Textarea
                rows={2}
                placeholder="포장 · 운송사 · 특이사항"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            Shipment 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
