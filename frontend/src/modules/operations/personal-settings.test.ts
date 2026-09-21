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
  assert.match(html, /Personal Settings/);
  assert.match(html, /Google Workspace not connected/);
  assert.match(html, /Single-step approval/);
  assert.match(html, /Saved in this browser/);
  assert.match(html, /<details class="prefs-backup">/);
  assert.match(html, /Backup tools/);
  assert.match(html, /for="approval-autofill"/);
  assert.match(html, /id="notification-comment"/);
  assert.equal(pageTitle('/work/settings', '?team=rd'), 'Personal Settings');
});
