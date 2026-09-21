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
  { id: 'profile', title: '개인 프로필', icon: UserRound },
  { id: 'approvals', title: '결재 라인', icon: GitPullRequest },
  { id: 'workspace', title: '업무 환경', icon: Monitor },
  { id: 'notifications', title: '알림 설정', icon: Bell },
  { id: 'account', title: '계정 · 연결', icon: ShieldCheck },
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
        <div>
          <span className="prefs-eyebrow">MY WORKSPACE</span>
          <h1>개인 환경 설정</h1>
          <p>내 프로필부터 결재 흐름까지, 나에게 맞는 업무 공간을 만드세요.</p>
        </div>
        <span className="prefs-badge">
          <Monitor aria-hidden="true" />이 브라우저에 저장
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
            <span className="prefs-badge">데모 프로필</span>
          </div>
          <nav aria-label="개인 설정 섹션">
            {SECTIONS.map(({ id, title, icon: Icon }) => (
              <a key={id} href={'#' + id}>
                <Icon aria-hidden="true" />
                {title}
                <ChevronRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <p className="prefs-sidebar-note">
            설정은 현재 데모 사용자별로 구분됩니다. 다른 기기와는 동기화되지
            않습니다.
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
                  <h2 id="profile-title">개인 프로필</h2>
                  <p>프로필 카드에 사용할 이름과 담당 업무를 정리하세요.</p>
                </div>
              </header>
              <div className="prefs-fields">
                <label>
                  표시 이름
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
                  직무 · 담당 업무
                  <Input
                    maxLength={60}
                    placeholder="예: 제품 개발 · 차량 적합성 검토"
                    value={draft.jobTitle}
                    onChange={(event) => {
                      update({ jobTitle: event.target.value });
                    }}
                  />
                </label>
                <label>
                  소속 팀<Input readOnly value={TEAM_NAMES[actor.team]} />
                  <small>
                    소속 및 권한은 개인 설정에서 변경할 수 없습니다.
                  </small>
                </label>
                <label>
                  회사 계정
                  <Input readOnly value="Google Workspace 연결 대기" />
                  <small>회사 디렉터리 연결 후 계정 정보를 표시합니다.</small>
                </label>
              </div>
              <label>
                업무 소개
                <textarea
                  rows={3}
                  maxLength={240}
                  placeholder="담당 범위나 협업 시 참고할 내용을 적어 주세요. 데모에는 실제 개인정보를 입력하지 마세요."
                  value={draft.introduction}
                  onChange={(event) => {
                    update({ introduction: event.target.value });
                  }}
                />
              </label>
              <p className="prefs-note">
                표시 이름은 이 개인 프로필에만 사용됩니다. 업무 기록의 작성자
                이름과 인증 정보는 변경되지 않습니다.
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
                  <h2 id="workspace-title">업무 환경</h2>
                  <p>자주 여는 화면과 새 요청의 기본값을 설정하세요.</p>
                </div>
              </header>
              <div className="prefs-fields">
                <label>
                  시작 바로가기 팀
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
                  시작 바로가기 화면
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
                    <option value="dashboard">팀 대시보드</option>
                    <option value="tasks">My Tasks · 업무함</option>
                  </select>
                </label>
                <label>
                  새 요청 기본 우선순위
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
                    <option value="normal">보통</option>
                    <option value="high">높음</option>
                    <option value="urgent">긴급</option>
                  </select>
                </label>
              </div>
              <div className="prefs-inline">
                <p>
                  저장한 바로가기를 아래 버튼으로 열 수 있습니다. 현재 팀이나
                  로그인 후 경로를 자동 변경하지 않습니다.
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
                    내 시작 화면 열기
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
                  <h2 id="notifications-title">알림 설정</h2>
                  <p>‘알림 · 활동’에서 보고 싶은 활동 종류를 선택하세요.</p>
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
                화면의 표시 필터만 변경하며 기록은 삭제하지 않습니다.
                이메일·모바일 푸시 알림은 아직 연결되지 않았습니다.
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
                  <h2 id="account-title">계정 · 연결</h2>
                  <p>회사 보안과 개인 취향은 별도로 관리합니다.</p>
                </div>
              </header>
              <div className="prefs-connection">
                <div>
                  <strong>Google Workspace</strong>
                  <p>회사 로그인 · 조직 프로필 동기화</p>
                </div>
                <span className="prefs-badge">연결 대기</span>
              </div>
              <div className="prefs-connection">
                <div>
                  <strong>권한 · 결재 정책</strong>
                  <p>
                    부서 이동, 권한 부여, 대결 지정은 운영 연결 후 관리자 관리
                  </p>
                </div>
                <span className="prefs-badge">관리자 영역</span>
              </div>
              <p className="prefs-note">
                현재는 로그인된 회사 계정이 아닌 데모 사용자입니다. 비밀번호나
                실제 개인정보를 입력하지 마세요.
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
                        ? '저장하지 않은 변경사항이 있습니다.'
                        : '변경사항은 저장 버튼을 누르면 적용됩니다.')}
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
                  변경 취소
                </Button>
                <Button type="submit" disabled={!dirty || blocked}>
                  <Check aria-hidden="true" />
                  변경사항 저장
                </Button>
              </div>
            </div>
          </form>
          <details className="prefs-backup">
            <summary>
              <Database aria-hidden="true" />
              데모 데이터 · 백업 도구<span>고급</span>
            </summary>
            <div className="prefs-backup-body">{children}</div>
          </details>
        </div>
      </div>
    </div>
  );
}
