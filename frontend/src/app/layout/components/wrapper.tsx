import { useState } from 'react';
import { Outlet } from 'react-router-dom';
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
  const [selectedTeam, setSelectedTeam] = useState(teams[0]);

  return (
    <>
      <Header selectedTeam={selectedTeam} onTeamChange={setSelectedTeam} />
      {!isMobile && <Sidebar toolsMenuTitle={selectedTeam.toolsMenuTitle} />}
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
