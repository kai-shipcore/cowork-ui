import type { SampleShipmentDetails } from '@/shared/types/workbench';

interface ShipmentSummaryProps {
  shipment: SampleShipmentDetails & { arrivedAt?: string };
}

const dateOnly = (value?: string) => value?.slice(0, 10);

/** Read-only view of a recorded `sample_shipment`: reference, dates, memo. */
export function ShipmentSummary({ shipment }: ShipmentSummaryProps) {
  const timeline = [
    shipment.sampleReadyAt && `Ready ${dateOnly(shipment.sampleReadyAt)}`,
    shipment.shippedAt && `Shipped ${dateOnly(shipment.shippedAt)}`,
    shipment.expectedArrivalDate && `ETA ${shipment.expectedArrivalDate}`,
    shipment.arrivedAt && `Arrived ${dateOnly(shipment.arrivedAt)}`,
  ].filter(Boolean);

  return (
    <div className="shipment-summary">
      <span className="tracking-code">
        {shipment.externalReference ?? 'No reference number'}
      </span>
      <div className="vehicle-meta">{timeline.join(' · ')}</div>
      {shipment.note && <div className="vehicle-meta">{shipment.note}</div>}
    </div>
  );
}
