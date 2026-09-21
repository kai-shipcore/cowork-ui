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
          <h2 id="approvals-title">나의 결재 라인</h2>
          <p>반복되는 팀 간 요청을 더 빠르게 작성하세요.</p>
        </div>
        <span className="prefs-badge">1단계 승인</span>
      </header>
      <div className="prefs-toggle-row">
        <div>
          <label htmlFor="approval-autofill">새 요청에 결재 기본값 적용</label>
          <p>끄면 요청을 작성할 때 담당자와 결재자를 직접 선택합니다.</p>
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
          기본 수신 팀
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
          처리 담당자
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
          완료 결재자
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
      <ol className="prefs-approval-flow" aria-label="결재 흐름 미리보기">
        <li>
          <span>01 · 요청 작성</span>
          <strong>{actor.name}</strong>
        </li>
        <li className="prefs-flow-arrow" aria-hidden="true">
          <ArrowRight />
        </li>
        <li>
          <span>02 · 업무 처리</span>
          <strong>{personName(settings.assigneeId)}</strong>
        </li>
        <li className="prefs-flow-arrow" aria-hidden="true">
          <ArrowRight />
        </li>
        <li>
          <span>03 · 완료 결재</span>
          <strong>{personName(settings.reviewerId)}</strong>
        </li>
      </ol>
      <p className="prefs-note">
        현재 데모는 팀별 담당자·결재자 각 1명입니다. 저장 후 새 요청에만
        적용되며 기존 요청과 회사 권한은 바뀌지 않습니다. 다단계
        결재·대결자·참조자는 운영 시스템 연결 시 확장할 항목입니다.
      </p>
    </section>
  );
}
