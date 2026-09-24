import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AppUserService } from '../application/app-user.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import { toAppUserDto, toInvitationDto } from './app-user.dto.js';

const USERS_PATH = '/api/users';
const DEPARTMENTS_PATH = '/api/departments';
const DEPARTMENT_PATH_PATTERN = /^\/api\/departments\/([^/]+)$/;
const APP_ROLES_PATH = '/api/app-roles';
const USER_PATH_PATTERN = /^\/api\/users\/([^/]+)$/;
const APP_ROLE_PATH_PATTERN = /^\/api\/app-roles\/([^/]+)$/;
const INVITATIONS_PATH = '/api/invitations';
const PERMISSIONS_PATH = '/api/permissions';
const PERMISSION_PATH_PATTERN = /^\/api\/permissions\/([^/]+)$/;
const ROLE_PERMISSIONS_PATH = '/api/role-permissions';
const ROLE_PERMISSIONS_PATH_PATTERN = /^\/api\/app-roles\/([^/]+)\/permissions$/;
const ASSIGNMENTS_PATH = '/api/permission-assignments';
const ASSIGNMENT_PATH_PATTERN = /^\/api\/permission-assignments\/([^/]+)$/;
const INVITATION_ACTION_PATTERN = /^\/api\/invitations\/([^/]+)\/(revoke|accept)$/;
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendMethodNotAllowed(response: ServerResponse, allowed: string): void {
  response.setHeader('allow', allowed);
  sendJson(response, 405, { message: 'Method not allowed' });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new ValidationError('Request body is too large');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    throw new ValidationError('Request body must be valid JSON', { cause: error });
  }
}

async function routeUsers(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
): Promise<void> {
  if (method === 'GET') {
    const users = await service.listAppUsers();
    sendJson(
      response,
      200,
      users.map((user) => toAppUserDto(user)),
    );
    return;
  }
  if (method === 'POST') {
    const user = await service.createAppUser(await readJsonBody(request));
    sendJson(response, 201, toAppUserDto(user));
    return;
  }
  sendMethodNotAllowed(response, 'GET, POST');
}

async function routeAppRoles(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
): Promise<void> {
  if (method === 'GET') {
    sendJson(response, 200, await service.listAppRoles());
    return;
  }
  if (method === 'POST') {
    sendJson(response, 201, await service.createAppRole(await readJsonBody(request)));
    return;
  }
  sendMethodNotAllowed(response, 'GET, POST');
}

async function routeDepartments(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
  pathname: string,
): Promise<boolean> {
  if (pathname === DEPARTMENTS_PATH) {
    if (method === 'GET') {
      sendJson(response, 200, await service.listDepartments());
    } else if (method === 'POST') {
      sendJson(response, 201, await service.createDepartment(await readJsonBody(request)));
    } else {
      sendMethodNotAllowed(response, 'GET, POST');
    }
    return true;
  }
  const match = DEPARTMENT_PATH_PATTERN.exec(pathname);
  if (!match) return false;
  const id = decodeURIComponent(match[1] ?? '');
  if (method === 'PATCH') {
    sendJson(response, 200, await service.updateDepartment(id, await readJsonBody(request)));
  } else if (method === 'DELETE') {
    await service.deleteDepartment(id);
    response.writeHead(204);
    response.end();
  } else {
    sendMethodNotAllowed(response, 'PATCH, DELETE');
  }
  return true;
}

async function routeAppRole(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
  id: string,
): Promise<void> {
  if (method === 'PATCH') {
    sendJson(response, 200, await service.updateAppRole(id, await readJsonBody(request)));
    return;
  }
  if (method === 'DELETE') {
    await service.deleteAppRole(id);
    response.writeHead(204);
    response.end();
    return;
  }
  sendMethodNotAllowed(response, 'PATCH, DELETE');
}

async function routeInvitations(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
): Promise<void> {
  if (method === 'GET') {
    const invitations = await service.listInvitations();
    sendJson(
      response,
      200,
      invitations.map((invitation) => toInvitationDto(invitation)),
    );
    return;
  }
  if (method === 'POST') {
    const invitation = await service.sendInvitation(await readJsonBody(request));
    sendJson(response, 201, toInvitationDto(invitation));
    return;
  }
  sendMethodNotAllowed(response, 'GET, POST');
}

async function routePermissions(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
  method: string,
  pathname: string,
): Promise<boolean> {
  if (pathname === PERMISSIONS_PATH) {
    if (method === 'GET') {
      sendJson(response, 200, await service.listPermissions());
    } else if (method === 'POST') {
      sendJson(response, 201, await service.createPermission(await readJsonBody(request)));
    } else {
      sendMethodNotAllowed(response, 'GET, POST');
    }
    return true;
  }
  const permissionMatch = PERMISSION_PATH_PATTERN.exec(pathname);
  if (permissionMatch) {
    const id = decodeURIComponent(permissionMatch[1] ?? '');
    if (method === 'PATCH') {
      sendJson(response, 200, await service.updatePermission(id, await readJsonBody(request)));
    } else if (method === 'DELETE') {
      await service.deletePermission(id);
      response.writeHead(204);
      response.end();
    } else {
      sendMethodNotAllowed(response, 'PATCH, DELETE');
    }
    return true;
  }
  if (pathname === ROLE_PERMISSIONS_PATH) {
    if (method !== 'GET') {
      sendMethodNotAllowed(response, 'GET');
      return true;
    }
    sendJson(response, 200, await service.listRolePermissions());
    return true;
  }
  const rolePermissionsMatch = ROLE_PERMISSIONS_PATH_PATTERN.exec(pathname);
  if (rolePermissionsMatch) {
    if (method !== 'PUT') {
      sendMethodNotAllowed(response, 'PUT');
      return true;
    }
    await service.setRolePermissions(
      decodeURIComponent(rolePermissionsMatch[1] ?? ''),
      await readJsonBody(request),
    );
    response.writeHead(204);
    response.end();
    return true;
  }
  if (pathname === ASSIGNMENTS_PATH) {
    if (method === 'GET') {
      sendJson(response, 200, await service.listPermissionAssignments());
    } else if (method === 'POST') {
      sendJson(
        response,
        201,
        await service.createPermissionAssignment(await readJsonBody(request)),
      );
    } else {
      sendMethodNotAllowed(response, 'GET, POST');
    }
    return true;
  }
  const assignmentMatch = ASSIGNMENT_PATH_PATTERN.exec(pathname);
  if (assignmentMatch) {
    if (method !== 'DELETE') {
      sendMethodNotAllowed(response, 'DELETE');
      return true;
    }
    await service.deletePermissionAssignment(decodeURIComponent(assignmentMatch[1] ?? ''));
    response.writeHead(204);
    response.end();
    return true;
  }
  return false;
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  service: AppUserService,
): Promise<void> {
  const method = request.method ?? 'GET';
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

  if (await routeDepartments(request, response, service, method, pathname)) return;

  if (pathname === USERS_PATH) {
    await routeUsers(request, response, service, method);
    return;
  }

  const userMatch = USER_PATH_PATTERN.exec(pathname);
  if (userMatch) {
    if (method !== 'PATCH') {
      sendMethodNotAllowed(response, 'PATCH');
      return;
    }
    const id = decodeURIComponent(userMatch[1] ?? '');
    const user = await service.updateAppUser(id, await readJsonBody(request));
    sendJson(response, 200, toAppUserDto(user));
    return;
  }

  if (pathname === APP_ROLES_PATH) {
    await routeAppRoles(request, response, service, method);
    return;
  }

  const roleMatch = APP_ROLE_PATH_PATTERN.exec(pathname);
  if (roleMatch) {
    await routeAppRole(request, response, service, method, decodeURIComponent(roleMatch[1] ?? ''));
    return;
  }

  if (pathname === INVITATIONS_PATH) {
    await routeInvitations(request, response, service, method);
    return;
  }

  const invitationMatch = INVITATION_ACTION_PATTERN.exec(pathname);
  if (invitationMatch) {
    if (method !== 'POST') {
      sendMethodNotAllowed(response, 'POST');
      return;
    }
    const id = decodeURIComponent(invitationMatch[1] ?? '');
    const invitation =
      invitationMatch[2] === 'accept'
        ? await service.acceptInvitation(id)
        : await service.revokeInvitation(id);
    sendJson(response, 200, toInvitationDto(invitation));
    return;
  }

  if (await routePermissions(request, response, service, method, pathname)) {
    return;
  }

  sendJson(response, 404, { message: 'Not found' });
}

function statusFor(error: unknown): number | undefined {
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  return undefined;
}

/**
 * The whole HTTP API. Framework-free on purpose (`node:http` only) until the
 * NestJS decision lands; routing stays in this one file so that move is mechanical.
 */
export function createRequestListener(service: AppUserService): RequestListener {
  return (request, response) => {
    void route(request, response, service).catch((error: unknown) => {
      const status = statusFor(error);
      if (status !== undefined && error instanceof Error) {
        sendJson(response, status, { message: error.message });
        return;
      }
      // Clients get a generic message; the cause stays in the server log.
      console.error(error);
      if (response.headersSent) {
        response.end();
      } else {
        sendJson(response, 500, { message: 'Internal server error' });
      }
    });
  };
}
