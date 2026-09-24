import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appUserListSchema } from './app-user-dto';

const ROW = {
  id: '0199a0c2-0000-7000-8000-000000000001',
  email: 'jane@coverland.com',
  name: 'Jane Kim',
  status: 'ACTIVE',
  departmentId: '01a0b554-47a4-7d51-98a8-2031a7706b48',
  departmentName: 'Research & Development',
  appRoleId: '01a0b554-47cc-775d-b9ef-73a4e27eb58c',
  appRoleName: 'Designer',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

await test('the users response accepts every app_user status and an optional designer initial', () => {
  const parsed = appUserListSchema.safeParse([
    ROW,
    { ...ROW, id: '2', email: 'b@coverland.com', status: 'INVITED' },
    {
      ...ROW,
      id: '3',
      email: 'c@coverland.com',
      status: 'INACTIVE',
      designerInitial: 'JK',
    },
  ]);
  assert.equal(parsed.success, true);
});

await test('the users response rejects rows the page cannot render', () => {
  assert.equal(
    appUserListSchema.safeParse([{ ...ROW, status: 'DELETED' }]).success,
    false,
  );
  assert.equal(
    appUserListSchema.safeParse([{ ...ROW, name: '' }]).success,
    false,
  );
  assert.equal(appUserListSchema.safeParse({ users: [ROW] }).success, false);
  assert.equal(
    appUserListSchema.safeParse([{ ...ROW, departmentId: undefined }]).success,
    false,
  );
});
