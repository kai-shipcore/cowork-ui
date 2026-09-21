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
    displayName: z.string().trim().min(1, '표시 이름을 입력하세요.').max(40),
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
        message: '수신 팀의 처리 담당자를 선택하세요.',
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
        message: '처리 담당자와 다른 수신 팀의 결재자를 선택하세요.',
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
    title: '새 업무 요청',
    description: '나에게 배정되거나 전달된 새 요청',
  },
  {
    kind: 'status',
    title: '결재 및 진행 상태',
    description: '승인 요청, 반려, 완료 등 나에게 전달된 상태 변경',
  },
  {
    kind: 'comment',
    title: '댓글 · 멘션',
    description: '댓글에서 나를 직접 언급한 활동',
  },
  {
    kind: 'document',
    title: '문서 변경',
    description: '나에게 전달된 문서 등록 및 버전 변경',
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
        '개인 설정을 읽지 못했습니다. 기본값으로 표시하며 저장본은 덮어쓰지 않았습니다. 브라우저 저장 공간을 확인하고 다시 열어 주세요.',
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
