type EnvironmentVariable =
  'PGHOST' | 'PGPORT' | 'PGDATABASE' | 'PGUSER' | 'PGPASSWORD' | 'PGSSLMODE' | 'PORT';

/** The only place that reads `process.env`. Blank values count as unset. */
export function readEnvironmentVariable(name: EnvironmentVariable): string | undefined {
  const value = process.env[name]?.trim();
  return value === '' ? undefined : value;
}

export function getRequiredEnvironmentVariable(name: EnvironmentVariable): string {
  const value = readEnvironmentVariable(name);

  if (!value || value === 'REPLACE_WITH_DATABASE_PASSWORD') {
    throw new Error(`${name} must be set in backend/.env`);
  }

  return value;
}
