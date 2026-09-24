import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseAppRoleInput,
  parseAppUserInput,
  parseInvitationInput,
  parsePermissionAssignmentInput,
  parsePermissionIds,
  parsePermissionInput,
} from './app-user-input.js';
import { ValidationError } from './errors.js';

const VALID = {
  name: '  Jane Kim ',
  email: 'jane@coverland.com',
  departmentId: '01a0b554-47a4-7d51-98a8-2031a7706b48',
  appRoleId: '01a0b554-47cc-775d-b9ef-73a4e27eb58c',
  designerInitial: 'JK',
};

await test('a valid body is trimmed and defaults to ACTIVE', () => {
  assert.deepEqual(parseAppUserInput(VALID), {
    name: 'Jane Kim',
    email: 'jane@coverland.com',
    status: 'ACTIVE',
    designerInitial: 'JK',
    departmentId: VALID.departmentId,
    appRoleId: VALID.appRoleId,
  });
});

await test('a blank designer initial is dropped and status is kept when given', () => {
  const input = parseAppUserInput({ ...VALID, designerInitial: '  ', status: 'INVITED' });
  assert.equal(input.status, 'INVITED');
  assert.equal('designerInitial' in input, false);
});

await test('bad bodies fail on the first offending field', () => {
  const cases: [unknown, RegExp][] = [
    [null, /JSON object/],
    [{ ...VALID, name: '' }, /name/],
    [{ ...VALID, email: 'nope' }, /email/],
    [{ ...VALID, departmentId: '123' }, /departmentId/],
    [{ ...VALID, appRoleId: undefined }, /appRoleId/],
    [{ ...VALID, status: 'DELETED' }, /status/],
    [{ ...VALID, designerInitial: 'TOO-LONG-INITIAL' }, /designerInitial/],
  ];
  for (const [body, pattern] of cases) {
    assert.throws(
      () => parseAppUserInput(body),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.match(error.message, pattern);
        return true;
      },
    );
  }
});

await test('role bodies upper-case the code and reject malformed ones', () => {
  const body = { departmentId: VALID.departmentId, code: ' designer ', name: 'Designer' };
  assert.deepEqual(parseAppRoleInput(body), {
    departmentId: VALID.departmentId,
    code: 'DESIGNER',
    name: 'Designer',
  });
  assert.throws(() => parseAppRoleInput({ ...body, code: 'has space' }), ValidationError);
  assert.throws(() => parseAppRoleInput({ ...body, code: '1ST' }), ValidationError);
  assert.throws(() => parseAppRoleInput({ ...body, name: '' }), ValidationError);
  assert.throws(() => parseAppRoleInput({ ...body, departmentId: 'x' }), ValidationError);
});

await test('invitation bodies need two user ids', () => {
  const body = { appUserId: VALID.departmentId, invitedBy: VALID.appRoleId };
  assert.deepEqual(parseInvitationInput(body), body);
  assert.throws(() => parseInvitationInput({ ...body, appUserId: '' }), ValidationError);
  assert.throws(() => parseInvitationInput({ ...body, invitedBy: 'me' }), ValidationError);
});

await test('permission bodies, id lists and overrides are validated', () => {
  assert.deepEqual(parsePermissionInput({ code: ' rd_edit ', name: 'Edit R&D' }), {
    code: 'RD_EDIT',
    name: 'Edit R&D',
  });
  assert.throws(() => parsePermissionInput({ code: 'bad code', name: 'x' }), ValidationError);

  assert.deepEqual(
    parsePermissionIds({ permissionIds: [VALID.departmentId, VALID.departmentId] }),
    [VALID.departmentId],
  );
  assert.throws(() => parsePermissionIds({ permissionIds: ['nope'] }), ValidationError);
  assert.throws(() => parsePermissionIds({}), ValidationError);

  const override = { appUserId: VALID.departmentId, permissionId: VALID.appRoleId, effect: 'DENY' };
  assert.deepEqual(parsePermissionAssignmentInput(override), override);
  assert.throws(
    () => parsePermissionAssignmentInput({ ...override, effect: 'MAYBE' }),
    ValidationError,
  );
});
