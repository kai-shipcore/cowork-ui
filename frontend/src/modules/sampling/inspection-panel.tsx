import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { inspectionErrors } from '@/shared/domain/sample-inspection';
import type { SampleRequestItem } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import './inspection.css';

export function InspectionPanel({
  itemId,
  onSaved,
  onDirty,
}: {
  itemId: string;
  onSaved: () => void;
  onDirty: () => void;
}) {
  const {
    sampleRequestItems,
    sampleRequests,
    sampleShipments,
    appUsers,
    updateWorkbench,
  } = useWorkbenchStore();
  const item = sampleRequestItems.find((row) => row.id === itemId);
  const [drawing, setDrawing] = useState(
    item?.drawingMatch === undefined ? '' : item.drawingMatch ? 'YES' : 'NO',
  );
  const [reflected, setReflected] = useState<string>(
    item?.revisionReflected ?? '',
  );
  const [note, setNote] = useState(item?.inspectionNote ?? '');
  const [message, setMessage] = useState('');
  const save = () => {
    if (!item) return;
    const next: SampleRequestItem = {
      ...item,
      drawingMatch: drawing === '' ? undefined : drawing === 'YES',
      revisionReflected: (reflected ||
        undefined) as SampleRequestItem['revisionReflected'],
      inspectedAt: new Date().toISOString(),
      inspectedBy: CURRENT_USER_ID,
      inspectionNote: note.trim(),
    };
    const errors = inspectionErrors(next);
    if (
      !appUsers.some(
        (user) => user.id === CURRENT_USER_ID && user.status === 'ACTIVE',
      )
    )
      errors.push('An active inspector account is required.');
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    updateWorkbench((state) => ({
      ...state,
      sampleRequestItems: state.sampleRequestItems.map((row) =>
        row.id === next.id ? next : row,
      ),
    }));
    setMessage('Inspection results saved and reflected in the list.');
    onSaved();
  };
  return (
    <section className="sample-inspection-form space-y-4">
      <h3>Item receipt & inspection</h3>
      <p>
        Drawing preparation and sample inspection are separate. Change
        implementation can be blank for the first round.
      </p>
      {item && (
        <>
          <p>
            {
              sampleRequests.find(
                (request) => request.id === item.sampleRequestId,
              )?.factory
            }{' '}
            · Revision {item.vehicleProductDesignRevisionId} · Received{' '}
            {item.sampleReceivedAt
              ? new Date(item.sampleReceivedAt).toLocaleString('en-US')
              : 'Not received · Confirm receipt before inspection.'}
          </p>
          {!item.productionStartedAt && !item.sampleShipmentId && (
            <Button
              variant="outline"
              disabled={
                !sampleRequests.find(
                  (request) => request.id === item.sampleRequestId,
                )?.sentAt
              }
              onClick={() => {
                updateWorkbench((state) => ({
                  ...state,
                  sampleRequestItems: state.sampleRequestItems.map((row) =>
                    row.id === item.id && !row.productionStartedAt
                      ? {
                          ...row,
                          productionStartedAt: new Date().toISOString(),
                        }
                      : row,
                  ),
                }));
              }}
            >
              Start production for this item
            </Button>
          )}
          {!item.sampleReceivedAt && (
            <Button
              variant="outline"
              disabled={
                !sampleShipments.some(
                  (shipment) =>
                    shipment.id === item.sampleShipmentId &&
                    shipment.shippedAt &&
                    Date.parse(shipment.shippedAt) <= Date.now(),
                )
              }
              onClick={() => {
                updateWorkbench((state) => ({
                  ...state,
                  sampleRequestItems: state.sampleRequestItems.map((row) =>
                    row.id === item.id &&
                    !row.sampleReceivedAt &&
                    state.sampleShipments.some(
                      (shipment) =>
                        shipment.id === row.sampleShipmentId &&
                        shipment.shippedAt &&
                        Date.parse(shipment.shippedAt) <= Date.now(),
                    )
                      ? { ...row, sampleReceivedAt: new Date().toISOString() }
                      : row,
                  ),
                }));
              }}
            >
              Confirm receipt of this item
            </Button>
          )}
          <label>
            Drawing match{' '}
            <select
              value={drawing}
              onChange={(event) => {
                setDrawing(event.target.value);
                onDirty();
                setMessage('');
              }}
            >
              <option value="">Select</option>
              <option value="YES">Matches</option>
              <option value="NO">Mismatch · Factory issue</option>
            </select>
          </label>
          <label>
            Change implementation{' '}
            <select
              value={reflected}
              onChange={(event) => {
                setReflected(event.target.value);
                onDirty();
                setMessage('');
              }}
            >
              <option value="">
                Not assessed / Not applicable to first round
              </option>
              <option value="CORRECT">Fully implemented</option>
              <option value="PARTIAL">Partially implemented</option>
              <option value="NOT_REFLECTED">Not implemented</option>
            </select>
          </label>
          <label>
            Inspection reason{' '}
            <textarea
              rows={3}
              placeholder="Enter a reason for drawing mismatches or unimplemented changes."
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                onDirty();
                setMessage('');
              }}
            />
          </label>
          <Button disabled={!item.sampleReceivedAt} onClick={save}>
            Save inspection
          </Button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
