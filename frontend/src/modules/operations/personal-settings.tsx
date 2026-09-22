import type { ReactElement, ReactNode } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Switch } from '@coverland-engineering/ui/switch';
import {
  Bell,
  Check,
  ChevronRight,
  Database,
  GitPullRequest,
  Monitor,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApprovalPreferences } from './approval-preferences';
import { TEAM_IDS, TEAM_NAMES, type Person } from './operations-model';
import {
  NOTIFICATION_OPTIONS,
  personalStartPath,
} from './personal-settings-model';
import { usePersonalSettings } from './use-personal-settings';

interface PersonalSettingsProps {
  actor: Person;
  children: ReactNode;
}
const SECTIONS = [
  { id: 'profile', title: 'Personal profile', icon: UserRound },
  { id: 'approvals', title: 'Approval workflow', icon: GitPullRequest },
  { id: 'workspace', title: 'Workspace preferences', icon: Monitor },
  { id: 'notifications', title: 'Notification preferences', icon: Bell },
  { id: 'account', title: 'Account & connections', icon: ShieldCheck },
];

/** Device-local personal settings; backup tools remain separate from the editor form. */
export function PersonalSettings({
  actor,
  children,
}: PersonalSettingsProps): ReactElement {
  const { draft, saved, dirty, feedback, blocked, update, save, cancel } =
    usePersonalSettings(actor);
  return (
    <div className="personal-settings">
      <div className="prefs-heading">
        <div className="workbench-heading">
          <h1>Personal Settings</h1>
          <p>
            Personalize your workspace, from your profile to your approval
            workflow.
          </p>
        </div>
        <span className="prefs-badge">
          <Monitor aria-hidden="true" />
          Saved in this browser
        </span>
      </div>
      <div className="prefs-layout">
        <aside className="prefs-sidebar">
          <div className="prefs-identity">
            <span className="prefs-avatar" aria-hidden="true">
              {saved.displayName.slice(0, 1).toUpperCase()}
            </span>
            <strong>{saved.displayName}</strong>
            <p>{TEAM_NAMES[actor.team]}</p>
            <span className="prefs-badge">Demo profile</span>
          </div>
          <nav aria-label="Personal settings sections">
            {SECTIONS.map(({ id, title, icon: Icon }) => (
              <a key={id} href={'#' + id}>
                <Icon aria-hidden="true" />
                {title}
                <ChevronRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <p className="prefs-sidebar-note">
            Settings are separate for each demo user and do not sync across
            devices.
          </p>
        </aside>
        <div className="prefs-main">
          <form
            className="prefs-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <section
              className="prefs-section"
              id="profile"
              aria-labelledby="profile-title"
            >
              <header>
                <UserRound aria-hidden="true" />
                <div>
                  <h2 id="profile-title">Personal profile</h2>
                  <p>
                    Set the name and responsibilities shown on your profile
                    card.
                  </p>
                </div>
              </header>
              <div className="prefs-fields">
                <label>
                  Display name
                  <Input
                    required
                    maxLength={40}
                    value={draft.displayName}
                    onChange={(event) => {
                      update({ displayName: event.target.value });
                    }}
                  />
                </label>
                <label>
                  Role & responsibilities
                  <Input
                    maxLength={60}
                    placeholder="Example: Product development · Vehicle fitment review"
                    value={draft.jobTitle}
                    onChange={(event) => {
                      update({ jobTitle: event.target.value });
                    }}
                  />
                </label>
                <label>
                  Team
                  <Input readOnly value={TEAM_NAMES[actor.team]} />
                  <small>
                    Team membership and permissions cannot be changed in
                    personal settings.
                  </small>
                </label>
                <label>
                  Company account
                  <Input readOnly value="Google Workspace not connected" />
                  <small>
                    Account information will appear after the company directory
                    is connected.
                  </small>
                </label>
              </div>
              <label>
                About your work
                <textarea
                  rows={3}
                  maxLength={240}
                  placeholder="Describe your responsibilities or collaboration notes. Do not enter real personal information in this demo."
                  value={draft.introduction}
                  onChange={(event) => {
                    update({ introduction: event.target.value });
                  }}
                />
              </label>
              <p className="prefs-note">
                The display name is used only in this personal profile. It does
                not change work-record authors or authentication details.
              </p>
            </section>
            <ApprovalPreferences
              actor={actor}
              settings={draft}
              onChange={update}
            />
            <section
              className="prefs-section"
              id="workspace"
              aria-labelledby="workspace-title"
            >
              <header>
                <Monitor aria-hidden="true" />
                <div>
                  <h2 id="workspace-title">Workspace preferences</h2>
                  <p>
                    Choose frequent destinations and defaults for new requests.
                  </p>
                </div>
              </header>
              <div className="prefs-fields">
                <label>
                  Start shortcut team
                  <select
                    value={draft.startTeam}
                    onChange={(event) => {
                      const startTeam = TEAM_IDS.find(
                        (id) => id === event.target.value,
                      );
                      if (startTeam) update({ startTeam });
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
                  Start shortcut page
                  <select
                    value={draft.startPage}
                    onChange={(event) => {
                      update({
                        startPage:
                          event.target.value === 'tasks'
                            ? 'tasks'
                            : 'dashboard',
                      });
                    }}
                  >
                    <option value="dashboard">Team dashboard</option>
                    <option value="tasks">My Tasks · Inbox</option>
                  </select>
                </label>
                <label>
                  Default request priority
                  <select
                    value={draft.priority}
                    onChange={(event) => {
                      const priority = event.target.value;
                      if (
                        priority === 'normal' ||
                        priority === 'high' ||
                        priority === 'urgent'
                      )
                        update({ priority });
                    }}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <div className="prefs-inline">
                <p>
                  Open your saved shortcut using the button below. This does not
                  automatically change your team or sign-in destination.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={dirty}
                >
                  <Link
                    to={personalStartPath(saved)}
                    onClick={(event) => {
                      if (dirty) event.preventDefault();
                    }}
                    aria-disabled={dirty}
                  >
                    Open my start page
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </section>
            <section
              className="prefs-section"
              id="notifications"
              aria-labelledby="notifications-title"
            >
              <header>
                <Bell aria-hidden="true" />
                <div>
                  <h2 id="notifications-title">Notification preferences</h2>
                  <p>
                    Choose activity types to show in Notifications & Activity.
                  </p>
                </div>
              </header>
              {NOTIFICATION_OPTIONS.map(({ kind, title, description }) => (
                <div className="prefs-toggle-row" key={kind}>
                  <div>
                    <label htmlFor={'notification-' + kind}>{title}</label>
                    <p>{description}</p>
                  </div>
                  <Switch
                    id={'notification-' + kind}
                    checked={draft.notifications[kind]}
                    onCheckedChange={(checked) => {
                      update({
                        notifications: {
                          ...draft.notifications,
                          [kind]: checked,
                        },
                      });
                    }}
                  />
                </div>
              ))}
              <p className="prefs-note">
                This changes display filters only; records are not deleted.
                Email and mobile push notifications are not connected yet.
              </p>
            </section>
            <section
              className="prefs-section"
              id="account"
              aria-labelledby="account-title"
            >
              <header>
                <ShieldCheck aria-hidden="true" />
                <div>
                  <h2 id="account-title">Account & connections</h2>
                  <p>
                    Company security and personal preferences are managed
                    separately.
                  </p>
                </div>
              </header>
              <div className="prefs-connection">
                <div>
                  <strong>Google Workspace</strong>
                  <p>Company sign-in & directory sync</p>
                </div>
                <span className="prefs-badge">Not connected</span>
              </div>
              <div className="prefs-connection">
                <div>
                  <strong>Permissions & approval policies</strong>
                  <p>
                    Team transfers, permissions, and delegates will be managed
                    by administrators after production integration.
                  </p>
                </div>
                <span className="prefs-badge">Administrator settings</span>
              </div>
              <p className="prefs-note">
                You are using a demo identity, not an authenticated company
                account. Do not enter passwords or real personal information.
              </p>
            </section>
            <div className="prefs-savebar">
              <div aria-live="polite">
                {feedback.error ? (
                  <p role="alert" className="prefs-error">
                    {feedback.error}
                  </p>
                ) : (
                  <p>
                    {feedback.message ||
                      (dirty
                        ? 'You have unsaved changes.'
                        : 'Changes take effect when you save.')}
                  </p>
                )}
              </div>
              <div className="prefs-save-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dirty}
                  onClick={cancel}
                >
                  Discard changes
                </Button>
                <Button type="submit" disabled={!dirty || blocked}>
                  <Check aria-hidden="true" />
                  Save changes
                </Button>
              </div>
            </div>
          </form>
          <details className="prefs-backup">
            <summary>
              <Database aria-hidden="true" />
              Demo data & backup tools<span>Advanced</span>
            </summary>
            <div className="prefs-backup-body">{children}</div>
          </details>
        </div>
      </div>
    </div>
  );
}
