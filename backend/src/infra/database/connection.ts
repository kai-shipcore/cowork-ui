import postgres, { type Sql } from 'postgres';
import { getRequiredEnvironmentVariable, readEnvironmentVariable } from '../environment.js';

function getDatabasePort(): number {
  const port = Number(getRequiredEnvironmentVariable('PGPORT'));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PGPORT must be a valid TCP port');
  }

  return port;
}

export function createDatabaseConnection(): Sql {
  return postgres({
    host: getRequiredEnvironmentVariable('PGHOST'),
    port: getDatabasePort(),
    database: getRequiredEnvironmentVariable('PGDATABASE'),
    username: getRequiredEnvironmentVariable('PGUSER'),
    password: getRequiredEnvironmentVariable('PGPASSWORD'),
    ssl: readEnvironmentVariable('PGSSLMODE') === 'require' ? 'require' : false,
    // The staging login role is capped at 3 connections and DBeaver typically holds 2,
    // so queries queue on one connection instead of failing with "too many connections".
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
