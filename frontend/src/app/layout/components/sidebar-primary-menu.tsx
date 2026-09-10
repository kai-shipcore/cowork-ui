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
import { MENU_SIDEBAR_MAIN, type MenuItem } from '@/app/layout/navigation';

// Same open-by-default trick as SidebarResourcesMenu: selecting the trigger
// value makes AccordionMenu expand the titled group on first render.
const TOOLS_GROUP_VALUE = 'rd-tools';
const TOOLS_GROUP_TRIGGER = 'rd-tools-trigger';

function renderItems(children: MenuItem[] | undefined) {
  return children?.map((child, index) => (
    <AccordionMenuItem key={index} value={child.path ?? '#'}>
      <Link to={child.path ?? '#'}>
        {child.icon && <child.icon />}
        <span>{child.title}</span>
        {child.badge == 'Beta' && (
          <Badge size="sm" variant="destructive" appearance="light">
            {child.badge}
          </Badge>
        )}
      </Link>
    </AccordionMenuItem>
  ));
}

export function SidebarPrimaryMenu() {
  const { pathname } = useLocation();

  // Memoize matchPath to prevent unnecessary re-renders
  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname ||
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
              <span>{item.title}</span>
              <AccordionMenuIndicator />
            </AccordionMenuSubTrigger>

            <AccordionMenuSubContent
              type="single"
              collapsible
              parentValue={TOOLS_GROUP_TRIGGER}
            >
              {renderItems(item.children)}
            </AccordionMenuSubContent>
          </AccordionMenuSub>
        ) : (
          <AccordionMenuGroup key={index}>
            {renderItems(item.children)}
          </AccordionMenuGroup>
        ),
      )}
    </AccordionMenu>
  );
}
