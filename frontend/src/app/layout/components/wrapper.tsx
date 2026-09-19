import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const routeTeam = teams.find((team) => team.dashboardPath === pathname);
  const [selectedTeam, setSelectedTeam] = useState(routeTeam ?? teams[0]);

  useEffect(() => {
    if (routeTeam) setSelectedTeam(routeTeam);
  }, [routeTeam]);

  function handleTeamChange(team: (typeof teams)[number]) {
    setSelectedTeam(team);
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
          <ScreenHelp />
          <Outlet />
        </main>
      </div>
    </>
  );
}
