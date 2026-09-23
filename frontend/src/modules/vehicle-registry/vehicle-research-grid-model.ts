import type { VehicleConfiguration } from '@/shared/types/workbench';

interface ResearchVehicleGroup<T extends VehicleConfiguration> {
  id: string;
  title: string;
  description: string;
  vehicleClass: string;
  rows: T[];
}

export function vehicleResearchIdentity(vehicle: string) {
  const match = /^(\d{4}(?:[–-]\d{4})?)\s+(.+)$/.exec(vehicle.trim());
  return {
    years: match?.[1] ?? '',
    makeModel: match?.[2] ?? vehicle.trim(),
  };
}

/** Groups filtered configurations by make and model before paging. */
export function groupVehicleResearch<T extends VehicleConfiguration>(
  configurations: readonly T[],
): ResearchVehicleGroup<T>[] {
  const vehicles = new Map<string, T[]>();
  for (const configuration of configurations) {
    const { makeModel } = vehicleResearchIdentity(configuration.vehicle);
    const rows = vehicles.get(makeModel) ?? [];
    rows.push(configuration);
    vehicles.set(makeModel, rows);
  }
  return Array.from(vehicles, ([makeModel, rows]) => {
    const vehicleClass = rows[0]?.vehicleClass ?? '';
    const years = Array.from(
      new Set(
        rows
          .map((row) => vehicleResearchIdentity(row.vehicle).years)
          .filter(Boolean),
      ),
    );
    const configurationCount = new Set(
      rows.map(
        (row) =>
          (row as VehicleConfiguration & { sourceConfigurationId?: string })
            .sourceConfigurationId ?? row.id,
      ),
    ).size;
    const productCount = new Set(
      rows
        .map(
          (row) =>
            (row as VehicleConfiguration & { product?: string }).product,
        )
        .filter(Boolean),
    ).size;
    return {
      id: makeModel,
      title: makeModel,
      description: [
        years.join(', '),
        vehicleClass,
        `${String(configurationCount)} Configurations`,
        productCount ? `${String(productCount)} Product Types` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      vehicleClass,
      rows,
    };
  });
}
