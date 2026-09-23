import { z } from 'zod';

export const TEAM_IDS = [
  'rd',
  'demand-planning',
  'customer-services',
  'ecommerce',
] as const;
export const TEAM_NAMES = {
  rd: 'R & D Team',
  'demand-planning': 'Demand Planning',
  'customer-services': 'Customer Services',
  ecommerce: 'eCommerce Team',
};
export type TeamId = (typeof TEAM_IDS)[number];
export const PEOPLE = [
  { id: 'USR-KAI', name: 'Kai (Demo)', team: 'rd', role: 'lead' },
  { id: 'rd-member', name: 'R&D Member (Demo)', team: 'rd', role: 'member' },
  // Workbench app users, so approval routes can be walked as each approver.
  { id: 'USR-JH', name: 'JH (Demo)', team: 'rd', role: 'member' },
  { id: 'USR-YOUNG', name: 'Young (Demo)', team: 'rd', role: 'member' },
  { id: 'USR-CHRISTIAN', name: 'Christian (Demo)', team: 'rd', role: 'member' },
  {
    id: 'planning-lead',
    name: 'Planning Reviewer (Demo)',
    team: 'demand-planning',
    role: 'lead',
  },
  {
    id: 'planning-member',
    name: 'Planning Member (Demo)',
    team: 'demand-planning',
    role: 'member',
  },
  {
    id: 'cs-lead',
    name: 'CS Reviewer (Demo)',
    team: 'customer-services',
    role: 'lead',
  },
  {
    id: 'cs-member',
    name: 'CS Member (Demo)',
    team: 'customer-services',
    role: 'member',
  },
  {
    id: 'commerce-lead',
    name: 'eCommerce Reviewer (Demo)',
    team: 'ecommerce',
    role: 'lead',
  },
  {
    id: 'commerce-member',
    name: 'eCommerce Member (Demo)',
    team: 'ecommerce',
    role: 'member',
  },
] as const;
export type Person = (typeof PEOPLE)[number];
export const STATUS_NAMES = {
  submitted: 'Submitted',
  active: 'In progress',
  blocked: 'Awaiting response',
  review: 'Pending approval',
  rejected: 'Rejected',
  done: 'Completed',
  cancelled: 'Cancelled',
};
const text = z.string().trim().min(1).max(2000);
const personId = z
  .string()
  .refine(
    (id) => PEOPLE.some((person) => person.id === id),
    'Select an assignee.',
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00Z');
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'A valid date is required.');
export const safeUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  );
}, 'Only HTTP or HTTPS document links are allowed.');
export const requestDraftSchema = z
  .object({
    title: text.max(160),
    description: text,
    sourceTeam: z.enum(TEAM_IDS),
    targetTeam: z.enum(TEAM_IDS),
    assigneeId: personId,
    reviewerId: personId,
    dueDate: date,
    priority: z.enum(['normal', 'high', 'urgent']),
    reference: z.string().max(300),
    referencePath: z
      .string()
      .max(500)
      .refine(
        (path) =>
          !path ||
          /^\/(vehicle-projects|products|samples|product-registrations)(\?|$)/.test(
            path,
          ),
        'Unsupported work link.',
      ),
    category: z.string().trim().min(1).max(80),
  })
  .superRefine((value, context) => {
    const assignee = PEOPLE.find((person) => person.id === value.assigneeId);
    const reviewer = PEOPLE.find((person) => person.id === value.reviewerId);
    if (assignee?.team !== value.targetTeam)
      context.addIssue({
        code: 'custom',
        message: 'Select an assignee from the receiving team.',
        path: ['assigneeId'],
      });
    if (
      reviewer?.team !== value.targetTeam ||
      reviewer.role !== 'lead' ||
      reviewer.id === value.assigneeId
    )
      context.addIssue({
        code: 'custom',
        message: 'Select a receiving-team reviewer other than the assignee.',
        path: ['reviewerId'],
      });
  });
export type RequestDraft = z.infer<typeof requestDraftSchema>;
const eventSchema = z.object({
  id: text,
  actorId: personId,
  at: z.iso.datetime(),
  kind: z.enum(['created', 'status', 'comment', 'document']),
  message: text,
  mentions: z.array(personId),
  from: z.string().optional(),
  to: z.string().optional(),
});
const documentSchema = z.object({
  id: text,
  name: text.max(160),
  url: safeUrl,
  version: z.number().int().positive(),
  uploadedBy: personId,
  at: z.iso.datetime(),
  approvedAt: z.iso.datetime().optional(),
});
export const requestSchema = z.object({
  ...requestDraftSchema.shape,
  id: text,
  requesterId: personId,
  status: z.enum([
    'submitted',
    'active',
    'blocked',
    'review',
    'rejected',
    'done',
    'cancelled',
  ]),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  events: z.array(eventSchema).max(5000),
  documents: z.array(documentSchema).max(1000),
});
export type WorkRequest = z.infer<typeof requestSchema>;
export type RequestStatus = WorkRequest['status'];
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime(),
    requests: z.array(requestSchema).max(10000),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.requests.map((request) => request.id)).size !==
      value.requests.length
    )
      context.addIssue({ code: 'custom', message: 'Duplicate request ID.' });
    for (const request of value.requests)
      if (!requestDraftSchema.safeParse(request).success)
        context.addIssue({
          code: 'custom',
          message: 'Invalid assignee or reviewer assignment.',
        });
  });
export type OperationsSnapshot = z.infer<typeof snapshotSchema>;
export type RequestAction =
  | { kind: 'status'; status: RequestStatus; note: string }
  | { kind: 'comment'; note: string; mentions: string[] }
  | { kind: 'document'; name: string; url: string };

/** Calendar dates are interpreted in the company's operating time zone. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function isOpen(request: WorkRequest): boolean {
  return !['done', 'cancelled'].includes(request.status);
}
export function isOverdue(request: WorkRequest): boolean {
  return isOpen(request) && request.dueDate < today();
}
export function personName(id: string): string {
  return PEOPLE.find((person) => person.id === id)?.name ?? id;
}
export function teamFromLocation(pathname: string, search: string): TeamId {
  const candidate = pathname.startsWith('/dashboard/')
    ? pathname.split('/')[2]
    : new URLSearchParams(search).get('team');
  return TEAM_IDS.find((id) => id === candidate) ?? 'rd';
}
export function teamHome(team: TeamId): string {
  return team === 'rd' ? '/dashboard' : '/dashboard/' + team;
}
export function requestLink(id: string, team: TeamId): string {
  return '/work/requests/' + encodeURIComponent(id) + '?team=' + team;
}

/** These UI rules simulate roles; production must enforce them at the API boundary. */
export function allowedTransitions(
  request: WorkRequest,
  actorId: string,
): RequestStatus[] {
  const result: RequestStatus[] = [];
  if (actorId === request.assigneeId) {
    if (['submitted', 'rejected', 'blocked'].includes(request.status))
      result.push('active');
    if (request.status === 'active') result.push('blocked', 'review');
  }
  if (actorId === request.reviewerId && request.status === 'review')
    result.push('done', 'rejected');
  if (
    actorId === request.requesterId &&
    ['submitted', 'rejected'].includes(request.status)
  )
    result.push('cancelled');
  return result;
}

export function createRequest(
  input: RequestDraft,
  actorId: string,
  id: string,
  at: string,
): WorkRequest {
  const draft = requestDraftSchema.parse(input);
  const actor = PEOPLE.find((person) => person.id === actorId);
  if (actor?.team !== draft.sourceTeam)
    throw new Error("The requesting team must match the current actor's team.");
  return {
    ...draft,
    id,
    requesterId: actorId,
    status: 'submitted',
    revision: 0,
    createdAt: at,
    updatedAt: at,
    documents: [],
    events: [
      {
        id: id + '-created',
        actorId,
        at,
        kind: 'created',
        message: 'Request created · ' + draft.title,
        mentions: [draft.assigneeId],
      },
    ],
  };
}

/** Reject stale edits and invalid transitions before mutating a request. */
export function applyRequestAction(
  request: WorkRequest,
  action: RequestAction,
  actorId: string,
  expectedRevision: number,
  at: string,
  eventId: string,
): WorkRequest {
  if (request.revision !== expectedRevision)
    throw new Error(
      'Changed in another window. Review the latest data and try again.',
    );
  if (!PEOPLE.some((person) => person.id === actorId))
    throw new Error('Check the current actor.');
  let updated = { ...request, revision: request.revision + 1, updatedAt: at };
  let event: WorkRequest['events'][number];
  if (action.kind === 'status') {
    if (!allowedTransitions(request, actorId).includes(action.status))
      throw new Error('The current actor cannot make this status change.');
    const note = text.parse(action.note);
    if (action.status === 'review' && request.documents.length === 0)
      throw new Error('Add a review document link first.');
    updated = { ...updated, status: action.status };
    if (action.status === 'done') {
      updated.documents = request.documents.map((document) =>
        request.documents.some(
          (other) =>
            other.name === document.name && other.version > document.version,
        )
          ? document
          : { ...document, approvedAt: document.approvedAt ?? at },
      );
    }
    event = {
      id: eventId,
      actorId,
      at,
      kind: 'status',
      from: request.status,
      to: action.status,
      message: STATUS_NAMES[action.status] + ' · ' + note,
      mentions: [
        action.status === 'review' ? request.reviewerId : request.requesterId,
        request.assigneeId,
      ],
    };
  } else if (action.kind === 'comment') {
    event = {
      id: eventId,
      actorId,
      at,
      kind: 'comment',
      message: text.parse(action.note),
      mentions: z.array(personId).parse(action.mentions),
    };
  } else {
    if (
      ![request.assigneeId, request.requesterId].includes(actorId) ||
      !['submitted', 'active', 'blocked', 'rejected'].includes(request.status)
    )
      throw new Error('Documents cannot be added in the current status.');
    const name = text.max(160).parse(action.name);
    const url = safeUrl.parse(action.url);
    const version =
      Math.max(
        0,
        ...request.documents
          .filter((document) => document.name === name)
          .map((document) => document.version),
      ) + 1;
    updated.documents = [
      ...request.documents,
      { id: eventId, name, url, version, uploadedBy: actorId, at },
    ];
    event = {
      id: eventId,
      actorId,
      at,
      kind: 'document',
      message: name + ' · v' + String(version) + ' Create',
      mentions: [request.assigneeId],
    };
  }
  return requestSchema.parse({
    ...updated,
    events: [...request.events, event],
  });
}
