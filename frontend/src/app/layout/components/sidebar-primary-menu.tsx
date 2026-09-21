import { useCallback } from 'react';
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuIndicator,
  AccordionMenuItem,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@coverland-engineering/ui/accordion-menu';
import { Badge } from '@coverland-engineering/ui/badge';
import { Link, useLocation } from 'react-router';
import {
  teamFromLocation,
  teamHome,
} from '@/modules/operations/operations-model';
import {
  MENU_SIDEBAR_MAIN,
  MENU_SIDEBAR_TEAM_TOOLS,
  type MenuItem,
} from '@/app/layout/navigation';

// Same open-by-default trick as SidebarResourcesMenu: selecting the trigger
// value makes AccordionMenu expand the titled group on first render.
const TOOLS_GROUP_VALUE = 'rd-tools';
const TOOLS_GROUP_TRIGGER = 'rd-tools-trigger';

function renderItems(children: MenuItem[] | undefined) {
  return children?.map((child, index) => {
    const content = (
      <>
        {child.icon && <child.icon />}
        <span>{child.title}</span>
        {child.badge == 'Beta' && (
          <Badge size="sm" variant="destructive" appearance="light">
            {child.badge}
          </Badge>
        )}
      </>
    );

    return (
      <AccordionMenuItem
        key={child.title ?? index}
        value={child.path ?? child.title ?? String(index)}
      >
        {child.path ? (
          <Link to={child.path}>{content}</Link>
        ) : (
          <div
            className="flex items-center gap-2 text-muted-foreground"
            aria-disabled="true"
          >
            {content}
            <span className="text-[10px]">준비 중</span>
          </div>
        )}
      </AccordionMenuItem>
    );
  });
}

interface SidebarPrimaryMenuProps {
  toolsMenuTitle: string;
}

export function SidebarPrimaryMenu({
  toolsMenuTitle,
}: SidebarPrimaryMenuProps) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  const teamToolItems = MENU_SIDEBAR_TEAM_TOOLS[toolsMenuTitle];

  // Memoize matchPath to prevent unnecessary re-renders
  const matchPath = useCallback(
    (path: string): boolean =>
      path.split('?')[0] === pathname ||
      (path.length > 1 && pathname.startsWith(path) && path !== '/dashboard'),
    [pathname],
  );

  return (
    <AccordionMenu
      selectedValue={TOOLS_GROUP_TRIGGER}
      matchPath={matchPath}
      type="single"
      collapsible
      defaultValue={TOOLS_GROUP_TRIGGER}
      className="space-y-7.5 px-2.5"
      classNames={{
        item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100',
        subTrigger:
          'text-xs font-normal text-muted-foreground hover:bg-transparent',
        subContent: 'ps-0',
        group: '',
      }}
    >
      {MENU_SIDEBAR_MAIN.map((item, index) =>
        item.title ? (
          <AccordionMenuSub key={index} value={TOOLS_GROUP_VALUE}>
            <AccordionMenuSubTrigger value={TOOLS_GROUP_TRIGGER}>
              <span>{toolsMenuTitle}</span>
              <AccordionMenuIndicator />
            </AccordionMenuSubTrigger>

            <AccordionMenuSubContent
              type="single"
              collapsible
              parentValue={TOOLS_GROUP_TRIGGER}
            >
              {renderItems(teamToolItems ?? item.children)}
            </AccordionMenuSubContent>
          </AccordionMenuSub>
        ) : (
          <AccordionMenuGroup key={index}>
            {renderItems([
              {
                title: 'Home',
                path: teamHome(team),
                icon: item.children?.[0]?.icon,
              },
              {
                title: 'My Tasks',
                path: '/work/tasks?team=' + team,
                icon: item.children?.[1]?.icon,
              },
              {
                title: '팀 간 요청',
                path: '/work/requests?team=' + team,
                icon: item.children?.[1]?.icon,
              },
              {
                title: '알림 · 활동',
                path: '/work/notifications?team=' + team,
                icon: item.children?.[1]?.icon,
              },
            ])}
          </AccordionMenuGroup>
        ),
      )}
    </AccordionMenu>
  );
}
