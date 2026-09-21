import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, isValidElement, type ComponentProps } from 'react';
import { DetailSheet } from '@coverland-engineering/ui/detail-sheet';
import { StatusBadge as SharedStatusBadge } from '@coverland-engineering/ui/status-badge';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import { UserPicker as SharedUserPicker } from '@coverland-engineering/ui/user-picker';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfigChips } from '@/shared/domain/config-chips';
import { UserPicker } from '@/shared/domain/user-picker';
import { StatusBadge } from '@/shared/components/status-badge';
import type { AppUser } from '@/shared/types/workbench';

const user: AppUser = {
  id: 'person-1',
  name: 'Jane Cooper',
  email: 'jane@example.test',
  status: 'ACTIVE',
  createdAt: '2026-09-18',
  updatedAt: '2026-09-18',
};

await test('configuration options use shared metadata with accessible label/value pairs', () => {
  const html = renderToStaticMarkup(
    createElement(ConfigChips, {
      options: [
        ['Powertrain', 'Hybrid'],
        ['Seats', '7'],
      ],
    }),
  );
  assert.match(html, /data-slot="metadata-chips"/);
  assert.match(html, /aria-label="Vehicle options"/);
  assert.match(html, /<dt[^>]*>Powertrain<\/dt>/);
  assert.match(html, /<dd[^>]*>Hybrid<\/dd>/);
  assert.match(html, /<dd[^>]*>7<\/dd>/);
  assert.equal(
    renderToStaticMarkup(createElement(ConfigChips, { options: [] })),
    '',
  );
});

await test('all Workbench status tones delegate to the shared status badge', () => {
  assert.equal(StatusBadge, SharedStatusBadge);
  for (const tone of [
    'neutral',
    'progress',
    'success',
    'warning',
    'danger',
    'purple',
    'cyan',
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(StatusBadge, { label: 'Awaiting review', tone }),
    );
    assert.match(html, /data-slot="status-badge"/);
    assert.match(html, /Awaiting review/);
  }
});

await test('assignee adapter retains candidates, current value, selection and clearing callbacks', () => {
  const selectedIds: (string | undefined)[] = [];
  const users = [user];
  const element = UserPicker({
    value: user,
    users,
    label: 'Project assignee',
    onChange: (id) => {
      selectedIds.push(id);
    },
  });
  assert.ok(isValidElement<ComponentProps<typeof SharedUserPicker>>(element));
  assert.equal(element.type, SharedUserPicker);
  assert.equal(element.props.users, users);
  assert.equal(element.props.value, user);
  assert.equal(element.props.searchPlaceholder, 'Search name or email…');
  assert.equal(element.props.clearLabel, 'Assignee cleared');
  element.props.onChange(user.id);
  element.props.onChange(undefined);
  assert.deepEqual(selectedIds, [user.id, undefined]);
  const html = renderToStaticMarkup(element);
  assert.match(html, /aria-label="Project assignee"/);
  assert.match(html, /Jane Cooper/);
});

await test('unassigned picker retains its Workbench placeholder', () => {
  const html = renderToStaticMarkup(
    createElement(UserPicker, {
      users: [],
      label: 'Approver',
      onChange: () => {
        assert.fail('render must not change the assignee');
      },
    }),
  );
  assert.match(html, /Assign owner/);
  assert.match(html, /aria-label="Approver"/);
});

await test('summary cards preserve filter pressed state and read-only metrics remain non-interactive', () => {
  const readOnly = renderToStaticMarkup(
    createElement(SummaryCard, { label: 'Pending approval', value: 0 }),
  );
  assert.match(readOnly, /data-slot="summary-card"/);
  assert.match(readOnly, />0<\/strong>/);
  assert.doesNotMatch(readOnly, /<button/);
  for (const selected of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(SummaryCard, {
        label: 'Draft',
        value: 3,
        selected,
        onClick: () => {
          assert.fail('render must not change the filter');
        },
      }),
    );
    assert.match(html, new RegExp(`aria-pressed="${String(selected)}"`));
    assert.match(html, /type="button"/);
  }
});

await test('a closed detail sheet does not expose hidden form actions', () => {
  const html = renderToStaticMarkup(
    createElement(DetailSheet, {
      open: false,
      title: 'Create new part',
      description: 'Create shared part',
      onOpenChange: () => {
        assert.fail('render must not change sheet visibility');
      },
      children: createElement('form', { id: 'part-create-form' }),
      footer: createElement(
        'button',
        { type: 'submit', form: 'part-create-form' },
        'Create part',
      ),
    }),
  );
  assert.equal(html, '');
});
