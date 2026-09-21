import { ScrollArea } from '@coverland-engineering/ui/scroll-area';
import { Separator } from '@coverland-engineering/ui/separator';
import { Link, useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
import { getWorkspaceMenu, isSidebarLinkActive } from '../navigation';
import { SidebarPrimaryMenu } from './sidebar-primary-menu';
import { SidebarResourcesMenu } from './sidebar-resources-menu';
import { SidebarSearch } from './sidebar-search';

interface SidebarSecondaryProps {
  toolsMenuTitle: string;
}

export function SidebarSecondary({ toolsMenuTitle }: SidebarSecondaryProps) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  const menu = getWorkspaceMenu(team);
  return (
    <ScrollArea className="grow shrink-0 h-[calc(100vh-1rem)] lg:h-[calc(100vh-4rem)] mt-0 mb-2.5">
      <SidebarSearch />
      <SidebarPrimaryMenu toolsMenuTitle={toolsMenuTitle} />
      <Separator className="my-2.5" />
      {team === 'rd' && <SidebarResourcesMenu />}
      <Separator className="my-2.5" />
      <div className="grid gap-3 px-5 py-3 text-sm">
        <span className="text-xs text-muted-foreground">Common Workspace</span>
        {[menu.reports, menu.settings].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-current={
              isSidebarLinkActive(pathname, item.path) ? 'page' : undefined
            }
            className="flex items-center gap-2 rounded-md py-1 hover:text-primary aria-[current=page]:bg-muted"
          >
            <item.icon
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.5}
            />
            {item.title}
          </Link>
        ))}
      </div>
      <Separator className="my-2.5" />
    </ScrollArea>
  );
}
