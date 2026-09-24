import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppUserDto } from './app-user-dto';
import {
  filterUsers,
  formatJoinedDate,
  userInitials,
} from './user-management-model';

const DIRECTORY: readonly AppUserDto[] = [
  {
    id: 'u1',
    email: 'jane@coverland.com',
    name: 'Jane Kim',
    status: 'ACTIVE',
    departmentId: 'd-eng',
    departmentName: 'Engineering',
    appRoleId: 'r-dev',
    appRoleName: 'Developer',
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
  },
  {
    id: 'u2',
    email: 'andy@coverland.com',
    name: 'Andy Kang',
    status: 'INACTIVE',
    designerInitial: 'AK',
    departmentId: 'd-rd',
    departmentName: 'Research & Development',
    appRoleId: 'r-designer',
    appRoleName: 'Designer',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
];

await test('users filter by search text, role and status together', () => {
  const all = {
    query: '',
    departmentId: 'ALL',
    appRoleId: 'ALL',
    status: 'ALL' as const,
  };
  assert.deepEqual(
    filterUsers(DIRECTORY, all).map((user) => user.id),
    ['u1', 'u2'],
  );
  assert.deepEqual(
    filterUsers(DIRECTORY, { ...all, query: 'ANDY' }).map((user) => user.id),
    ['u2'],
  );
  assert.deepEqual(
    filterUsers(DIRECTORY, { ...all, appRoleId: 'r-dev' }).map(
      (user) => user.id,
    ),
    ['u1'],
  );
  assert.deepEqual(
    filterUsers(DIRECTORY, { ...all, departmentId: 'd-rd' }).map(
      (user) => user.id,
    ),
    ['u2'],
  );
  assert.deepEqual(
    filterUsers(DIRECTORY, { ...all, status: 'INACTIVE' }).map(
      (user) => user.id,
    ),
    ['u2'],
  );
  assert.deepEqual(
    filterUsers(DIRECTORY, {
      ...all,
      query: 'jane',
      status: 'INACTIVE',
    }),
    [],
  );
});

await test('avatar initials take the first letter of up to three words', () => {
  assert.equal(userInitials('Jane Kim'), 'JK');
  assert.equal(userInitials('Tenaga Ahli Programmer Senior'), 'TAP');
  assert.equal(userInitials('User 635'), 'U6');
  assert.equal(userInitials('  pavan '), 'P');
  assert.equal(userInitials(''), '?');
});

await test('joined dates render as a long US date and tolerate bad input', () => {
  assert.equal(
    formatJoinedDate('2026-09-08T10:00:00.000Z'),
    'September 8, 2026',
  );
  assert.equal(formatJoinedDate('not a date'), '—');
});
