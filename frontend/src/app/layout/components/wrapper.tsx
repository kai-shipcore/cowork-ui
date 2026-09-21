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
import { PageContent } from './page-content';
import { ResetMockDataButton } from './reset-mock-data-button';
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
      <div className="w-full min-w-0 grow overflow-y-auto pt-(--header-height-mobile) lg:pt-(--header-height) lg:ps-(--sidebar-width) lg:in-data-[sidebar-open=false]:ps-(--sidebar-collapsed-width) transition-all duration-300">
        <PageContent>
          {isMobile && <HeaderBreadcrumbs />}
          {storageError && (
            <div className="ops-save-error" role="alert">
              {storageMessage}{' '}
              <Button size="sm" variant="outline" onClick={retryPersistence}>
                Retry R&D save
              </Button>
            </div>
          )}
          <div className="ops-demo">
            <span>
              Public demo · No confidential or personal data · Company
              sign-in/shared storage not connected · R&D actor: Kai ·{' '}
              {saving ? 'Saving…' : message}
            </span>
            <div className="ops-demo-actions">
              <label>
                Request demo actor
                <select
                  aria-label="Select demo actor"
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
              <ResetMockDataButton />
            </div>
          </div>
          {error && (
            <div className="ops-save-error" role="alert">
              {error}{' '}
              <Button size="sm" variant="outline" onClick={reload}>
                Reload latest data
              </Button>
            </div>
          )}
          <ScreenHelp />
          <Outlet />
          <RelatedRequests />
        </PageContent>
      </div>
    </>
  );
}
