import type {
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
} from '@/shared/types/workbench';
import { reportDate } from '@/modules/rd-workspace/report-date';

/** Only inspected parts count as evaluated; missing inspection is not a pass. */
export function hasVendorFailure(item: SampleRequestItem): boolean {
  return (
    Boolean(item.inspectedAt ?? item.verifiedAt) &&
    (item.drawingMatch === false ||
      item.revisionReflected === 'PARTIAL' ||
      item.revisionReflected === 'NOT_REFLECTED')
  );
}

/** Actual arrival is compared with promised arrival; undated shipments stay out of the denominator. */
export function vendorQualityReport(
  requests: readonly SampleRequest[],
  items: readonly SampleRequestItem[],
  shipments: readonly SampleShipment[],
  today: string,
) {
  const factories = [
    ...new Set([
      ...requests.map((request) => request.factory),
      ...shipments.map((shipment) => shipment.factory),
    ]),
  ].sort();
  return factories.map((factory) => {
    const requestIds = new Set(
      requests
        .filter((request) => request.factory === factory)
        .map((request) => request.id),
    );
    const lines = items.filter((item) => requestIds.has(item.sampleRequestId));
    const inspected = lines.filter((item) => item.inspectedAt);
    const failed = inspected.filter(hasVendorFailure);
    const transport = shipments.filter(
      (shipment) => shipment.factory === factory,
    );
    const measured = transport.filter(
      (shipment) =>
        shipment.arrivedAt &&
        shipment.expectedArrivalDate &&
        Number.isFinite(Date.parse(shipment.arrivedAt)) &&
        Number.isFinite(Date.parse(shipment.expectedArrivalDate)),
    );
    const onTime = measured.filter(
      (shipment) =>
        (reportDate(shipment.arrivedAt) ?? '') <=
        (reportDate(shipment.expectedArrivalDate) ?? ''),
    );
    const overdue = transport.filter(
      (shipment) =>
        !shipment.arrivedAt &&
        shipment.expectedArrivalDate &&
        shipment.expectedArrivalDate.slice(0, 10) < today,
    );
    return {
      factory,
      requested: lines.length,
      inspected: inspected.length,
      failed: failed.length,
      measured: measured.length,
      onTime: onTime.length,
      overdue: overdue.length,
    };
  });
}

/** Group the same design's failed rounds; a new failure gets a new case revision, reopening review. */
export function vendorFailureCases(
  requests: readonly SampleRequest[],
  items: readonly SampleRequestItem[],
) {
  const groups = new Map<
    string,
    {
      factory: string;
      designId: string;
      projectId: string;
      items: SampleRequestItem[];
    }
  >();
  for (const item of items.filter(hasVendorFailure)) {
    const request = requests.find((entry) => entry.id === item.sampleRequestId);
    if (!request) continue;
    const key = request.factory + ':' + item.vehicleProductDesignId;
    const existing = groups.get(key);
    groups.set(key, {
      factory: request.factory,
      designId: item.vehicleProductDesignId,
      projectId: request.projectGroupId,
      items: [...(existing?.items ?? []), item],
    });
  }
  return [...groups].map(([key, group]) => ({
    ...group,
    id:
      key +
      ':' +
      group.items
        .map((item) => item.id)
        .sort()
        .join(','),
    rounds: new Set(group.items.map((item) => item.sampleRound)).size,
  }));
}
