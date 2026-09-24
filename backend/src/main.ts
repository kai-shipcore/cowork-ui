import { createServer } from 'node:http';
import { createRequestListener } from './api/request-listener.js';
import { createAppUserService } from './application/app-user.service.js';
import { createPostgresAppUserRepository } from './infra/database/app-user.repository.js';
import { createDatabaseConnection } from './infra/database/connection.js';
import { readEnvironmentVariable } from './infra/environment.js';

/** Port 3000 is taken by the Coverland_Workbench API on developer machines. */
const DEFAULT_PORT = 3100;

function getPort(): number {
  const raw = readEnvironmentVariable('PORT');
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid TCP port');
  }
  return port;
}

const port = getPort();
const database = createDatabaseConnection();
const service = createAppUserService(createPostgresAppUserRepository(database));
const server = createServer(createRequestListener(service));

server.listen(port, () => {
  console.log(`Workbench API listening on http://localhost:${String(port)}`);
});
