import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAGE_PRODUCTS } from '@/app/stage-duration-model';
import { StageDurationEditor } from './stage-duration-editor';

await test('unset standards show suggested values for all four priorities pending explicit save', () => {
  const html = renderToStaticMarkup(
    createElement(StageDurationEditor, {
      product: STAGE_PRODUCTS[0],
      canEdit: true,
      saving: false,
      onSave: () => Promise.resolve(true),
    }),
  );
  assert.match(html, /Suggested durations/);
  assert.equal((html.match(/type="number"/g) ?? []).length, 24);
  assert.match(html, /Load suggested durations/);
  for (const priority of ['URGENT', 'HIGH', 'NORMAL', 'LOW'])
    assert.match(html, new RegExp(`${priority} Standard duration`));
  assert.match(html, /type="submit" disabled=""/);
});

await test('read-only viewers cannot edit any duration or submit standards', () => {
  const html = renderToStaticMarkup(
    createElement(StageDurationEditor, {
      product: STAGE_PRODUCTS[1],
      canEdit: false,
      saving: false,
      onSave: () => Promise.resolve(false),
    }),
  );
  assert.match(html, /3D Model/);
  assert.match(html, /Fit Review/);
  assert.doesNotMatch(html, /Vehicle Hunt/);
  for (const input of html.match(/<input[^>]*>/g) ?? [])
    assert.match(input, /disabled=""/);
});
