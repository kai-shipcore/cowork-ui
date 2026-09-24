import { createDatabaseConnection } from './connection.js';

const database = createDatabaseConnection();

try {
  const [result] = await database<{ databaseName: string; serverTime: Date }[]>`
    SELECT current_database() AS "databaseName", NOW() AS "serverTime"
  `;

  if (!result) {
    throw new Error('The database connection returned no result');
  }

  console.log(`Connected to ${result.databaseName} at ${result.serverTime.toISOString()}`);
} finally {
  await database.end();
}
