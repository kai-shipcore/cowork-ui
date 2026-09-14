const ORDINAL_SUFFIXES: Readonly<Record<number, string>> = {
  1: 'st',
  2: 'nd',
  3: 'rd',
};
const TEEN_MIN = 11;
const TEEN_MAX = 13;

/** Sample Tracking "Sample Round" wording: `1st Sample`, `2nd Sample`, `11th Sample`. */
export function sampleRoundLabel(round: number): string {
  const lastTwo = round % 100;
  const suffix =
    lastTwo >= TEEN_MIN && lastTwo <= TEEN_MAX
      ? 'th'
      : (ORDINAL_SUFFIXES[round % 10] ?? 'th');
  return `${round}${suffix} Sample`;
}
