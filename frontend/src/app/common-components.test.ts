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
  assert.match(html, /aria-label="차량 옵션"/);
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
      createElement(StatusBadge, { label: '검토 대기', tone }),
    );
    assert.match(html, /data-slot="status-badge"/);
    assert.match(html, /검토 대기/);
  }
});

await test('assignee adapter retains candidates, current value, selection and clearing callbacks', () => {
  const selectedIds: (string | undefined)[] = [];
  const users = [user];
  const element = UserPicker({
    value: user,
    users,
    label: '프로젝트 담당자',
    onChange: (id) => {
      selectedIds.push(id);
    },
  });
  assert.ok(isValidElement<ComponentProps<typeof SharedUserPicker>>(element));
  assert.equal(element.type, SharedUserPicker);
  assert.equal(element.props.users, users);
  assert.equal(element.props.value, user);
  assert.equal(element.props.searchPlaceholder, '이름 또는 이메일 검색...');
  assert.equal(element.props.clearLabel, '담당자 해제');
  element.props.onChange(user.id);
  element.props.onChange(undefined);
  assert.deepEqual(selectedIds, [user.id, undefined]);
  const html = renderToStaticMarkup(element);
  assert.match(html, /aria-label="프로젝트 담당자"/);
  assert.match(html, /Jane Cooper/);
});

await test('unassigned picker retains its Workbench placeholder', () => {
  const html = renderToStaticMarkup(
    createElement(UserPicker, {
      users: [],
      label: '승인자',
      onChange: () => {
        assert.fail('render must not change the assignee');
      },
    }),
  );
  assert.match(html, /담당자 지정/);
  assert.match(html, /aria-label="승인자"/);
});

await test('summary cards preserve filter pressed state and read-only metrics remain non-interactive', () => {
  const readOnly = renderToStaticMarkup(
    createElement(SummaryCard, { label: '승인 대기', value: 0 }),
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
      title: '새 Part 생성',
      description: '공용 Part 생성',
      onOpenChange: () => {
        assert.fail('render must not change sheet visibility');
      },
      children: createElement('form', { id: 'part-create-form' }),
      footer: createElement(
        'button',
        { type: 'submit', form: 'part-create-form' },
        'Part 생성',
      ),
    }),
  );
  assert.equal(html, '');
});
