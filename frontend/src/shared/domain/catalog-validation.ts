import type {
  MasterProductPackaging,
  MasterProductSku,
} from '../types/workbench';

/** A date entered by this workbench is a Los Angeles business date, including DST. */
export function businessDateInstant(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(midnight) ||
    new Date(midnight).toISOString().slice(0, 10) !== date
  )
    return undefined;
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(midnight + 8 * 3600000))
    .find((part) => part.type === 'timeZoneName')?.value;
  return new Date(
    `${date}T00:00:00${offset?.replace('GMT', '') ?? '-08:00'}`,
  ).toISOString();
}

export function periodErrors(
  date: string,
  currentStart?: string,
  now = Date.now(),
): string[] {
  const instant = businessDateInstant(date);
  if (!instant) return ['Enter a valid effective start date.'];
  if (Date.parse(instant) > now)
    return [
      'Future effective dates are not supported. Choose today or an earlier date.',
    ];
  if (currentStart && Date.parse(instant) < Date.parse(currentStart))
    return [
      'The new effective date cannot precede the current version. Record same-day changes on the next date.',
    ];
  return [];
}

export function skuVersionErrors(
  sku: string,
  date: string,
  history: readonly MasterProductSku[],
  currentStart?: string,
): string[] {
  return [
    ...(!sku.trim() ? ['Enter a SKU.'] : []),
    ...(history.some(
      (row) => row.sku.trim().toLowerCase() === sku.trim().toLowerCase(),
    )
      ? ['This SKU is in use or appears in history. It cannot be reused.']
      : []),
    ...periodErrors(date, currentStart),
  ];
}

export function packagingVersionErrors(
  values: Pick<
    MasterProductPackaging,
    'length' | 'width' | 'height' | 'weight'
  >,
  date: string,
  currentStart?: string,
): string[] {
  return [
    ...(!Object.values(values).every(
      (value) => Number.isFinite(value) && value > 0,
    )
      ? ['Length, width, height, and weight must be positive numbers.']
      : []),
    ...periodErrors(date, currentStart),
  ];
}
