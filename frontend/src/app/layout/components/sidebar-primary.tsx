import { Fragment } from 'react';
import { Ellipsis } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
import {
  getWorkspaceMenu,
  MENU_SIDEBAR_MAIN,
  MENU_SIDEBAR_RESOURCES,
  MENU_SIDEBAR_TEAM_TOOLS,
} from '../navigation';
import { SidebarIconLink } from './sidebar-icon-link';

export function SidebarPrimary({
  dashboardPath,
  toolsMenuTitle = 'R&D Tools',
  collapsed = false,
}: {
  dashboardPath?: string;
  toolsMenuTitle?: string;
  collapsed?: boolean;
}) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  const menu = getWorkspaceMenu(team, dashboardPath);
  const links = [menu.home, menu.tasks, menu.notifications, menu.settings];
  const toolItems =
    MENU_SIDEBAR_TEAM_TOOLS[toolsMenuTitle] ??
    MENU_SIDEBAR_MAIN.find((item) => item.title === toolsMenuTitle)?.children ??
    [];
  const groups = [
    { title: toolsMenuTitle, items: toolItems },
    ...(team === 'rd'
      ? MENU_SIDEBAR_RESOURCES.map((group) => ({
          title: group.title ?? 'Resources',
          items: group.children ?? [],
        }))
      : []),
    {
      title: 'Common Workspace',
      items: [menu.requests, menu.reports],
    },
  ];
  return (
    <nav
      aria-label="Quick navigation"
      className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden [scrollbar-width:none] px-2.5 py-5 w-(--sidebar-collapsed-width) shrink-0 border-e border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      {links.map((item) => (
        <SidebarIconLink key={item.title} item={item} pathname={pathname} />
      ))}
      {collapsed &&
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Fragment key={group.title}>
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={group.title + ' Menu separator'}
                className="my-1 flex h-6 w-9 shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500"
              >
                <Ellipsis
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={1.5}
                />
              </div>
              <div
                role="group"
                aria-label={group.title}
                className="flex shrink-0 flex-col items-center gap-2"
              >
                {group.items.map((item) => (
                  <SidebarIconLink
                    key={item.title}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </div>
            </Fragment>
          ))}
    </nav>
  );
}
