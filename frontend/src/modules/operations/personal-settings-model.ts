import { z } from 'zod';
import {
  PEOPLE,
  TEAM_IDS,
  teamHome,
  type Person,
  type TeamId,
  type WorkRequest,
} from './operations-model';

const notificationSchema = z.object({
  created: z.boolean(),
  status: z.boolean(),
  comment: z.boolean(),
  document: z.boolean(),
});

export const personalSettingsSchema = z
  .object({
    version: z.literal(1),
    displayName: z.string().trim().min(1, 'Enter a display name.').max(40),
    jobTitle: z.string().trim().max(60),
    introduction: z.string().trim().max(240),
    startTeam: z.enum(TEAM_IDS),
    startPage: z.enum(['dashboard', 'tasks']),
    priority: z.enum(['normal', 'high', 'urgent']),
    autoFillApproval: z.boolean(),
    targetTeam: z.enum(TEAM_IDS),
    assigneeId: z.string(),
    reviewerId: z.string(),
    notifications: notificationSchema,
  })
  .superRefine((value, context) => {
    const assignee = PEOPLE.find((person) => person.id === value.assigneeId);
    const reviewer = PEOPLE.find((person) => person.id === value.reviewerId);
    if (assignee?.team !== value.targetTeam || assignee.role !== 'member') {
      context.addIssue({
        code: 'custom',
        path: ['assigneeId'],
        message: 'Select an assignee from the receiving team.',
      });
    }
    if (
      reviewer?.team !== value.targetTeam ||
      reviewer.role !== 'lead' ||
      reviewer.id === assignee?.id
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reviewerId'],
        message: 'Select a receiving-team approver other than the assignee.',
      });
    }
  });

export type PersonalSettings = z.infer<typeof personalSettingsSchema>;
export type NotificationKind = keyof PersonalSettings['notifications'];
export const NOTIFICATION_OPTIONS: {
  kind: NotificationKind;
  title: string;
  description: string;
}[] = [
  {
    kind: 'created',
    title: 'New work requests',
    description: 'New requests assigned or addressed to me',
  },
  {
    kind: 'status',
    title: 'Approvals & progress',
    description:
      'Approval requests, rejections, completions, and other status updates addressed to me',
  },
  {
    kind: 'comment',
    title: 'Comments & mentions',
    description: 'Activity that mentions me directly in a comment',
  },
  {
    kind: 'document',
    title: 'Document changes',
    description: 'Document additions and version changes addressed to me',
  },
];

/** The prototype supports one receiving-team reviewer, not arbitrary approval powers. */
export function teamApprovalDefaults(
  team: TeamId,
): Pick<PersonalSettings, 'targetTeam' | 'assigneeId' | 'reviewerId'> {
  return {
    targetTeam: team,
    assigneeId:
      PEOPLE.find((person) => person.team === team && person.role === 'member')
        ?.id ?? '',
    reviewerId:
      PEOPLE.find((person) => person.team === team && person.role === 'lead')
        ?.id ?? '',
  };
}

/** Preferences are isolated by demo actor, never interpreted as company identity. */
export function defaultPersonalSettings(actor: Person): PersonalSettings {
  return {
    version: 1,
    displayName: actor.name,
    jobTitle: '',
    introduction: '',
    startTeam: actor.team,
    startPage: 'dashboard',
    priority: 'normal',
    autoFillApproval: true,
    ...teamApprovalDefaults(actor.team),
    notifications: {
      created: true,
      status: true,
      comment: true,
      document: true,
    },
  };
}

/** Read only this actor's device-local settings; corrupt data is not overwritten. */
export function readPersonalSettings(
  actor: Person,
  storage: Pick<Storage, 'getItem'>,
): PersonalSettings {
  const raw = storage.getItem('coverland-personal-settings-v1:' + actor.id);
  return raw
    ? personalSettingsSchema.parse(JSON.parse(raw))
    : defaultPersonalSettings(actor);
}

/** Failed reads supply safe defaults without overwriting stored preferences. */
export function loadPersonalSettings(actor: Person): {
  settings: PersonalSettings;
  error: string;
} {
  try {
    return {
      settings:
        typeof window === 'undefined'
          ? defaultPersonalSettings(actor)
          : readPersonalSettings(actor, window.localStorage),
      error: '',
    };
  } catch {
    return {
      settings: defaultPersonalSettings(actor),
      error:
        'Unable to read personal settings. Defaults are shown and the saved copy has not been overwritten. Check browser storage and reopen this page.',
    };
  }
}

/** Validate before persistence so a failed write cannot become a successful save. */
export function savePersonalSettings(
  actor: Person,
  settings: PersonalSettings,
  storage: Pick<Storage, 'setItem'>,
): PersonalSettings {
  const validated = personalSettingsSchema.parse(settings);
  storage.setItem(
    'coverland-personal-settings-v1:' + actor.id,
    JSON.stringify(validated),
  );
  return validated;
}

/** Explicit shortcut only; changing settings never interrupts the current route. */
export function personalStartPath(settings: PersonalSettings): string {
  return settings.startPage === 'tasks'
    ? '/work/tasks?team=' + settings.startTeam
    : teamHome(settings.startTeam);
}

/** Only valid receiving-team defaults are applied to a newly composed request. */
export function requestApprovalDefaults(
  settings: PersonalSettings,
  targetTeam: TeamId,
): { assigneeId: string; reviewerId: string } {
  if (!settings.autoFillApproval) return { assigneeId: '', reviewerId: '' };
  return targetTeam === settings.targetTeam
    ? { assigneeId: settings.assigneeId, reviewerId: settings.reviewerId }
    : teamApprovalDefaults(targetTeam);
}

/** Filtering hides presentation only; the original activity log is preserved. */
export function visiblePersonalNotifications(
  requests: WorkRequest[],
  actorId: string,
  settings: PersonalSettings,
): { request: WorkRequest; event: WorkRequest['events'][number] }[] {
  return requests
    .flatMap((request) =>
      request.events
        .filter(
          (event) =>
            event.mentions.includes(actorId) &&
            settings.notifications[event.kind],
        )
        .map((event) => ({ request, event })),
    )
    .sort((a, b) => b.event.at.localeCompare(a.event.at));
}
