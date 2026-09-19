import { useLayout } from './context';
import { HeaderBreadcrumbs } from './header-breadcrumbs';
import { HeaderLogo, type Team } from './header-logo';
import { HeaderToolbar } from './header-toolbar';

interface HeaderProps {
  selectedTeam: Team;
  onTeamChange: (team: Team) => void;
}

export function Header({ selectedTeam, onTeamChange }: HeaderProps) {
  const { isMobile } = useLayout();

  return (
    <header className="flex items-stretch fixed z-10 top-0 start-0 end-0 shrink-0 bg-background/95 border-b border-border backdrop-blur-sm supports-backdrop-filter:bg-background/60 h-(--header-height-mobile) lg:h-(--header-height) pe-[var(--removed-body-scroll-bar-size,0px)]">
      <div className="@container grow pe-5 flex items-stretch justify-between gap-2.5">
        <div className="flex items-stretch gap-x-6">
          <HeaderLogo selectedTeam={selectedTeam} onTeamChange={onTeamChange} />
          {!isMobile && <HeaderBreadcrumbs />}
        </div>
        <HeaderToolbar />
      </div>
    </header>
  );
}
