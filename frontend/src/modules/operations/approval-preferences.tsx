import type { ReactElement } from 'react';
import { Switch } from '@coverland-engineering/ui/switch';
import { ArrowRight, GitPullRequest } from 'lucide-react';
import {
  PEOPLE,
  personName,
  TEAM_IDS,
  TEAM_NAMES,
  type Person,
} from './operations-model';
import {
  teamApprovalDefaults,
  type PersonalSettings,
} from './personal-settings-model';

interface ApprovalPreferencesProps {
  actor: Person;
  settings: PersonalSettings;
  onChange: (patch: Partial<PersonalSettings>) => void;
}

/** Personal defaults cannot change company authorization or existing requests. */
export function ApprovalPreferences({
  actor,
  settings,
  onChange,
}: ApprovalPreferencesProps): ReactElement {
  return (
    <section
      className="prefs-section"
      id="approvals"
      aria-labelledby="approvals-title"
    >
      <header>
        <GitPullRequest aria-hidden="true" />
        <div>
          <h2 id="approvals-title">My approval workflow</h2>
          <p>Create recurring team requests faster.</p>
        </div>
        <span className="prefs-badge">Single-step approval</span>
      </header>
      <div className="prefs-toggle-row">
        <div>
          <label htmlFor="approval-autofill">
            Apply approval defaults to new requests
          </label>
          <p>
            When off, choose the assignee and approver for each new request.
          </p>
        </div>
        <Switch
          id="approval-autofill"
          checked={settings.autoFillApproval}
          onCheckedChange={(autoFillApproval) => {
            onChange({ autoFillApproval });
          }}
        />
      </div>
      <div className="prefs-fields">
        <label>
          Default receiving team
          <select
            value={settings.targetTeam}
            onChange={(event) => {
              const team = TEAM_IDS.find((id) => id === event.target.value);
              if (team) onChange(teamApprovalDefaults(team));
            }}
          >
            {TEAM_IDS.map((id) => (
              <option key={id} value={id}>
                {TEAM_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            value={settings.assigneeId}
            onChange={(event) => {
              onChange({ assigneeId: event.target.value });
            }}
          >
            {PEOPLE.filter(
              (person) =>
                person.team === settings.targetTeam && person.role === 'member',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Completion approver
          <select
            value={settings.reviewerId}
            onChange={(event) => {
              onChange({ reviewerId: event.target.value });
            }}
          >
            {PEOPLE.filter(
              (person) =>
                person.team === settings.targetTeam && person.role === 'lead',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol
        className="prefs-approval-flow"
        aria-label="Approval workflow preview"
      >
        <li>
          <span>01 · Create request</span>
          <strong>{actor.name}</strong>
        </li>
        <li className="prefs-flow-arrow" aria-hidden="true">
          <ArrowRight />
        </li>
        <li>
          <span>02 · Process work</span>
          <strong>{personName(settings.assigneeId)}</strong>
        </li>
        <li className="prefs-flow-arrow" aria-hidden="true">
          <ArrowRight />
        </li>
        <li>
          <span>03 · Approve completion</span>
          <strong>{personName(settings.reviewerId)}</strong>
        </li>
      </ol>
      <p className="prefs-note">
        This demo supports one assignee and one approver per team. Changes apply
        only to new requests after saving; existing requests and company
        permissions are unchanged. Multi-step approvals, delegates, and
        observers require production integration.
      </p>
    </section>
  );
}
