import { Button } from '@coverland-engineering/ui/button';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  PEOPLE,
  teamFromLocation,
  teamHome,
} from '@/modules/operations/operations-model';
import { RelatedRequests } from '@/modules/operations/related-requests';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import '@/modules/operations/operations.css';
import { useLayout } from './context';
import { Header } from './header';
import { HeaderBreadcrumbs } from './header-breadcrumbs';
import { teams } from './header-logo';
import { ScreenHelp } from './screen-help';
import { Sidebar } from './sidebar';
import '../workbench-layout.css';
import '../metronic-theme.css';

export function Wrapper() {
  const { isMobile } = useLayout();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const selectedTeam =
    teams.find(
      (team) =>
        team.dashboardPath === teamHome(teamFromLocation(pathname, search)),
    ) ?? teams[0];
  const { actor, changeActor, message, error, saving, reload } =
    useOperations();
  const { storageMessage, storageError, retryPersistence } =
    useWorkbenchStore();

  function handleTeamChange(team: (typeof teams)[number]) {
    void navigate(team.dashboardPath);
  }

  return (
    <>
      <Header selectedTeam={selectedTeam} onTeamChange={handleTeamChange} />
      {!isMobile && (
        <Sidebar
          toolsMenuTitle={selectedTeam.toolsMenuTitle}
          dashboardPath={selectedTeam.dashboardPath}
        />
      )}
      <div className="grow overflow-y-auto pt-(--header-height-mobile) lg:pt-(--header-height) lg:ps-(--sidebar-width) lg:in-data-[sidebar-open=false]:ps-(--sidebar-collapsed-width) transition-all duration-300">
        <main className="workbench-content metronic-content grow p-5">
          {isMobile && <HeaderBreadcrumbs />}
          {storageError && (
            <div className="ops-save-error" role="alert">
              {storageMessage}{' '}
              <Button size="sm" variant="outline" onClick={retryPersistence}>
                R&D 저장 재시도
              </Button>
            </div>
          )}
          <div className="ops-demo">
            <span>
              공개 Demo · 기밀·개인정보 입력 금지 · 회사 로그인/공동 저장 연결
              전 · 기존 R&D 작업자는 Kai · {saving ? '저장 중…' : message}
            </span>
            <label>
              요청 테스트 작업자
              <select
                aria-label="데모 작업자 선택"
                value={actor.id}
                onChange={(event) => {
                  changeActor(event.target.value);
                }}
              >
                {PEOPLE.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="ops-save-error" role="alert">
              {error}{' '}
              <Button size="sm" variant="outline" onClick={reload}>
                최신 데이터 다시 읽기
              </Button>
            </div>
          )}
          <ScreenHelp />
          <Outlet />
          <RelatedRequests />
        </main>
      </div>
    </>
  );
}
