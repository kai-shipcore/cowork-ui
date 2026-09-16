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
  if (!instant) return ['유효한 적용 시작일을 입력하세요.'];
  if (Date.parse(instant) > now)
    return ['미래 예약은 지원하지 않습니다. 오늘 또는 이전 날짜를 선택하세요.'];
  if (currentStart && Date.parse(instant) < Date.parse(currentStart))
    return [
      '새 적용일은 현재 버전의 시작 시각보다 빠를 수 없습니다. 같은 날 변경은 다음 날짜에 기록하세요.',
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
    ...(!sku.trim() ? ['SKU를 입력하세요.'] : []),
    ...(history.some(
      (row) => row.sku.trim().toLowerCase() === sku.trim().toLowerCase(),
    )
      ? ['현재 또는 과거 이력에 사용된 SKU입니다. 재사용할 수 없습니다.']
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
      ? ['길이·폭·높이·무게는 0보다 큰 숫자여야 합니다.']
      : []),
    ...periodErrors(date, currentStart),
  ];
}
