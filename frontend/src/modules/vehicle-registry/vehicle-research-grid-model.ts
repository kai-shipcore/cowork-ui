import type { VehicleConfiguration } from '@/shared/types/workbench';

interface ResearchVehicleGroup<T extends VehicleConfiguration> {
  id: string;
  title: string;
  description: string;
  vehicleClass: string;
  rows: T[];
}

export interface MergeableProductResearchRow extends VehicleConfiguration {
  sourceConfigurationId: string;
  productTypeId: NonNullable<VehicleConfiguration['productTypeId']>;
  years?: string;
}

export function vehicleResearchIdentity(vehicle: string) {
  const match = /^(\d{4}(?:[–-]\d{4})?)\s+(.+)$/.exec(vehicle.trim());
  return {
    years: match?.[1] ?? '',
    makeModel: match?.[2] ?? vehicle.trim(),
  };
}

function yearRangeLabel(values: readonly string[]): string {
  const ranges = values
    .map((value) => /^(\d{4})(?:[–-](\d{4}))?$/.exec(value))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const parts = match[0].split(/[–-]/);
      const start = Number(parts[0]);
      return {
        start,
        end: parts.length > 1 ? Number(parts[1]) : start,
      };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    if (merged.length > 0) {
      const previous = merged[merged.length - 1];
      if (range.start <= previous.end + 1) {
        previous.end = Math.max(previous.end, range.end);
        continue;
      }
    }
    merged.push({ ...range });
  }
  return merged
    .map(({ start, end }) =>
      start === end ? String(start) : `${String(start)}–${String(end)}`,
    )
    .join(', ');
}

/** Combines identical product/option rows across model years. */
export function mergeProductResearchRows<T extends MergeableProductResearchRow>(
  rows: readonly T[],
): (T & { years: string })[] {
  const mergedRows = new Map<string, T[]>();
  for (const row of rows) {
    const { makeModel } = vehicleResearchIdentity(row.vehicle);
    const optionSignature = [...row.options]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}\u0000${value}`)
      .join('\u0001');
    const key = `${makeModel}\u0002${row.productTypeId}\u0002${optionSignature}`;
    const matchingRows = mergedRows.get(key) ?? [];
    matchingRows.push(row);
    mergedRows.set(key, matchingRows);
  }
  return Array.from(mergedRows.values(), (matchingRows) => {
    const first = matchingRows[0];
    const years = yearRangeLabel(
      matchingRows
        .map((row) => vehicleResearchIdentity(row.vehicle).years)
        .filter(Boolean),
    );
    return {
      ...first,
      id: matchingRows.map((row) => row.id).join(':'),
      years,
      researchStatus: matchingRows.reduce<
        VehicleConfiguration['researchStatus']
      >((earliest, row) => {
        const order = ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'];
        const normalize = (status: VehicleConfiguration['researchStatus']) =>
          status === 'COMPLETE'
            ? 'COMPLETED'
            : status === 'RESEARCHING'
              ? 'IN_PROGRESS'
              : status;
        return order.indexOf(normalize(row.researchStatus)) <
          order.indexOf(normalize(earliest))
          ? row.researchStatus
          : earliest;
      }, first.researchStatus),
      projectGroupIds: Array.from(
        new Set(matchingRows.flatMap((row) => row.projectGroupIds)),
      ),
    };
  });
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
          (row) => (row as VehicleConfiguration & { product?: string }).product,
        )
        .filter(Boolean),
    ).size;
    return {
      id: makeModel,
      title: makeModel,
      description: [
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
