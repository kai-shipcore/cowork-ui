/** Date-only values stay unchanged; timestamps use the workbench's Los Angeles day. */
export function reportDate(value?: string): string | undefined {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
