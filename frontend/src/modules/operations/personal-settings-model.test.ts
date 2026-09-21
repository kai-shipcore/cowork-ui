import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PEOPLE,
  requestDraftSchema,
  TEAM_IDS,
  teamHome,
} from './operations-model';
import { createOperationsSeed } from './operations-seed';
import {
  defaultPersonalSettings,
  personalSettingsSchema,
  personalStartPath,
  readPersonalSettings,
  requestApprovalDefaults,
  savePersonalSettings,
  teamApprovalDefaults,
  visiblePersonalNotifications,
} from './personal-settings-model';

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

await test('personal settings persist and remain isolated by actor without altering identity', () => {
  const storage = memoryStorage();
  const actor = PEOPLE[0];
  const draft = {
    ...defaultPersonalSettings(actor),
    displayName: '  My profile  ',
    priority: 'high' as const,
  };
  savePersonalSettings(actor, draft, storage);
  const restored = readPersonalSettings(actor, storage);
  assert.equal(restored.displayName, 'My profile');
  assert.equal(restored.priority, 'high');
  assert.equal(
    readPersonalSettings(PEOPLE[1], storage).displayName,
    PEOPLE[1].name,
  );
  assert.equal(actor.name, 'Kai (Demo)');
  assert.equal(draft.displayName, '  My profile  ');
});

await test('all teams produce valid receiving-team approval defaults for new requests', () => {
  for (const team of TEAM_IDS) {
    const settings = {
      ...defaultPersonalSettings(PEOPLE[0]),
      ...teamApprovalDefaults(team),
    };
    assert.equal(personalSettingsSchema.safeParse(settings).success, true);
    const draft = {
      title: 'Test',
      description: 'Test request',
      sourceTeam: 'rd',
      targetTeam: team,
      ...requestApprovalDefaults(settings, team),
      dueDate: '2026-10-01',
      priority: settings.priority,
      reference: '',
      referencePath: '',
      category: 'General request',
    };
    assert.equal(requestDraftSchema.safeParse(draft).success, true);
    assert.deepEqual(
      requestApprovalDefaults({ ...settings, autoFillApproval: false }, team),
      { assigneeId: '', reviewerId: '' },
    );
  }
});

await test('switching the receiving team never keeps another team approver', () => {
  const settings = defaultPersonalSettings(PEOPLE[0]);
  assert.equal(
    requestApprovalDefaults(settings, 'ecommerce').reviewerId,
    'commerce-lead',
  );
  assert.equal(
    personalSettingsSchema.safeParse({ ...settings, reviewerId: 'cs-lead' })
      .success,
    false,
  );
  assert.equal(
    personalSettingsSchema.safeParse({
      ...settings,
      reviewerId: settings.assigneeId,
    }).success,
    false,
  );
  assert.equal(
    personalSettingsSchema.safeParse({ ...settings, displayName: ' ' }).success,
    false,
  );
});

await test('corrupt and unsupported preferences are not overwritten on read', () => {
  const storage = memoryStorage();
  const key = 'coverland-personal-settings-v1:' + PEOPLE[0].id;
  for (const raw of ['invalid json', '{"version":2}', '{}']) {
    storage.setItem(key, raw);
    assert.throws(() => readPersonalSettings(PEOPLE[0], storage));
    assert.equal(storage.getItem(key), raw);
  }
});

await test('invalid values and unavailable storage never report a successful save', () => {
  const storage = memoryStorage();
  const settings = defaultPersonalSettings(PEOPLE[0]);
  savePersonalSettings(PEOPLE[0], settings, storage);
  assert.throws(() =>
    savePersonalSettings(
      PEOPLE[0],
      { ...settings, reviewerId: 'unknown' },
      storage,
    ),
  );
  assert.deepEqual(readPersonalSettings(PEOPLE[0], storage), settings);
  assert.throws(() =>
    savePersonalSettings(PEOPLE[0], settings, {
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    }),
  );
});

await test('personal start shortcuts preserve the selected team and screen', () => {
  for (const team of TEAM_IDS) {
    const settings = { ...defaultPersonalSettings(PEOPLE[0]), startTeam: team };
    assert.equal(personalStartPath(settings), teamHome(team));
    assert.equal(
      personalStartPath({ ...settings, startPage: 'tasks' }),
      '/work/tasks?team=' + team,
    );
  }
});

await test('notification preferences filter personal activity without deleting history', () => {
  const requests = createOperationsSeed().requests;
  const before = JSON.stringify(requests);
  const settings = defaultPersonalSettings(PEOPLE[0]);
  const actorId = requests[0].events[0].mentions[0];
  assert.ok(actorId);
  const all = visiblePersonalNotifications(requests, actorId, settings);
  assert.ok(all.length > 0);
  assert.ok(all.every(({ event }) => event.mentions.includes(actorId)));
  const none = visiblePersonalNotifications(requests, actorId, {
    ...settings,
    notifications: {
      created: false,
      status: false,
      comment: false,
      document: false,
    },
  });
  assert.equal(none.length, 0);
  assert.equal(JSON.stringify(requests), before);
});
