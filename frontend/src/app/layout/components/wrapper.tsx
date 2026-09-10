import { Outlet } from 'react-router-dom';
import { useLayout } from './context';
import { Header } from './header';
import { HeaderBreadcrumbs } from './header-breadcrumbs';
import { ScreenHelp } from './screen-help';
import { Sidebar } from './sidebar';
import '../workbench-layout.css';

export function Wrapper() {
  const { isMobile } = useLayout();

  return (
    <>
      <Header />
      {!isMobile && <Sidebar />}

      <div className="grow overflow-y-auto pt-(--header-height-mobile) lg:pt-(--header-height) lg:ps-(--sidebar-width) lg:in-data-[sidebar-open=false]:ps-(--sidebar-collapsed-width) transition-all duration-300">
        <main className="workbench-content grow p-5" role="content">
          {isMobile && <HeaderBreadcrumbs />}
          <ScreenHelp />
          <Outlet />
        </main>
      </div>
    </>
  );
}
