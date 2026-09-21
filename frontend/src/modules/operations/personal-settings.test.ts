import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { pageTitle } from '@/app/layout/page-identity';
import { PEOPLE } from './operations-model';
import { PersonalSettings } from './personal-settings';

await test('settings shows personal sections, labeled controls, local-only scope and collapsed backup', () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(PersonalSettings, {
        actor: PEOPLE[0],
        children: createElement('div', null, 'Backup tools'),
      }),
    ),
  );
  for (const id of [
    'profile',
    'approvals',
    'workspace',
    'notifications',
    'account',
  ]) {
    assert.ok(html.includes('id="' + id + '"'));
    assert.ok(html.includes('href="#' + id + '"'));
  }
  assert.match(html, /개인 환경 설정/);
  assert.match(html, /Google Workspace 연결 대기/);
  assert.match(html, /1단계 승인/);
  assert.match(html, /이 브라우저에 저장/);
  assert.match(html, /<details class="prefs-backup">/);
  assert.match(html, /Backup tools/);
  assert.match(html, /for="approval-autofill"/);
  assert.match(html, /id="notification-comment"/);
  assert.equal(pageTitle('/work/settings', '?team=rd'), '개인 환경 설정');
});
