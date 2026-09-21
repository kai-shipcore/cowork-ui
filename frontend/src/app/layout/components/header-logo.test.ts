import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { CarFront, Headset, ShoppingCart, TrendingUp } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { teams } from './header-logo';

await test('team selector uses recognizable, distinct icons for each department', () => {
  const expectedIcons = [
    ['R & D Team', CarFront],
    ['Demand Planning', TrendingUp],
    ['Customer Services', Headset],
    ['eCommerce Team', ShoppingCart],
  ] as const;

  assert.equal(teams.length, expectedIcons.length);
  for (const [name, icon] of expectedIcons) {
    const team = teams.find((entry) => entry.name === name);
    assert.ok(team);
    assert.equal(team.icon, icon);
    assert.match(renderToStaticMarkup(createElement(team.icon)), /<svg/);
  }
});

await test('car icon retains the selector size and inherited team color', () => {
  const html = renderToStaticMarkup(
    createElement(CarFront, { className: 'size-4' }),
  );
  assert.match(html, /lucide-car-front/);
  assert.match(html, /size-4/);
  assert.match(html, /stroke="currentColor"/);
  assert.match(html, /viewBox="0 0 24 24"/);
});
