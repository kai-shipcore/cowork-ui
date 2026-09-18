import type { VehicleConfiguration } from '@/shared/types/workbench';

interface ResearchVehicleGroup {
  id: string;
  title: string;
  description: string;
  vehicleClass: string;
  rows: VehicleConfiguration[];
}

/** Groups filtered configurations before paging; full vehicle labels keep collapse ids stable. */
export function groupVehicleResearch(
  configurations: readonly VehicleConfiguration[],
): ResearchVehicleGroup[] {
  const vehicles = new Map<string, VehicleConfiguration[]>();
  for (const configuration of configurations) {
    const rows = vehicles.get(configuration.vehicle) ?? [];
    rows.push(configuration);
    vehicles.set(configuration.vehicle, rows);
  }
  return Array.from(vehicles, ([vehicle, rows]) => {
    const match = /^(\d{4}(?:–\d{4})?)\s+(.+)$/.exec(vehicle);
    const vehicleClass = rows[0]?.vehicleClass ?? '';
    return {
      id: vehicle,
      title: match?.[2] ?? vehicle,
      description: [
        match?.[1],
        vehicleClass,
        `${String(rows.length)} Configurations`,
      ]
        .filter(Boolean)
        .join(' · '),
      vehicleClass,
      rows,
    };
  });
}
