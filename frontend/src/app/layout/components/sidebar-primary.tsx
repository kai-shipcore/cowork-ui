import { Fragment } from 'react';
import { Separator } from '@coverland-engineering/ui/separator';
import {
  BarChart3,
  Bell,
  ClipboardList,
  GitPullRequest,
  Settings,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
import {
  MENU_SIDEBAR_MAIN,
  MENU_SIDEBAR_RESOURCES,
  MENU_SIDEBAR_TEAM_TOOLS,
  type MenuItem,
} from '../navigation';
import { SidebarIconLink } from './sidebar-icon-link';

export function SidebarPrimary({
  dashboardPath = '/dashboard',
  toolsMenuTitle = 'R&D Tools',
  collapsed = false,
}: {
  dashboardPath?: string;
  toolsMenuTitle?: string;
  collapsed?: boolean;
}) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  const links: MenuItem[] = [
    { title: 'Dashboard', path: dashboardPath, icon: BarChart3 },
    {
      title: 'My Tasks',
      path: '/work/tasks?team=' + team,
      icon: ClipboardList,
    },
    { title: '알림', path: '/work/notifications?team=' + team, icon: Bell },
    { title: '설정', path: '/work/settings?team=' + team, icon: Settings },
  ];
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
      items: [
        {
          title: '팀 간 요청',
          path: '/work/requests?team=' + team,
          icon: GitPullRequest,
        },
        {
          title: '업무 리포트',
          path: '/work/reports?team=' + team,
          icon: BarChart3,
        },
      ],
    },
  ];
  return (
    <nav
      aria-label="Quick navigation"
      className="flex min-h-0 flex-col items-center gap-3 overflow-y-auto overflow-x-hidden [scrollbar-width:none] px-2.5 py-3 w-(--sidebar-collapsed-width) shrink-0 border-e border-border bg-muted"
    >
      {links.map((item) => (
        <SidebarIconLink key={item.title} item={item} pathname={pathname} />
      ))}
      {collapsed &&
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Fragment key={group.title}>
              <Separator
                decorative={false}
                className="my-2 h-0.5 w-9 rounded-full bg-zinc-500 dark:bg-zinc-400"
              />
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
