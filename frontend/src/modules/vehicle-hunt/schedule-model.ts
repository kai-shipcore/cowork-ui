/** Calendar keys remain date-only across DST and month/year boundaries. */
export function shiftDate(date: string, days: number): string {
  const next = new Date(date + 'T12:00:00Z');
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Monday-based weekly view, or one selected day. */
export function scheduleDays(date: string, mode: 'week' | 'day'): string[] {
  if (mode === 'day') return [date];
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const monday = shiftDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (entry, index) => {
    void entry;
    return shiftDate(monday, index);
  });
}
