import { useCallback } from 'react';
import {
  AccordionMenu,
  AccordionMenuIndicator,
  AccordionMenuItem,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@coverland-engineering/ui/accordion-menu';
import { Badge } from '@coverland-engineering/ui/badge';
import { Link, useLocation } from 'react-router';
import { isExternalPath, type MenuItem } from '@/app/layout/navigation';

interface SidebarResourcesMenuProps {
  items: MenuItem[];
}

export function SidebarResourcesMenu({ items }: SidebarResourcesMenuProps) {
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
      selectedValue="resource-trigger"
      matchPath={matchPath}
      type="single"
      collapsible
      defaultValue="resource-trigger"
      className="space-y-7.5 px-2.5"
      classNames={{
        item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100',
        subTrigger:
          'text-xs font-normal text-muted-foreground hover:bg-transparent',
        subContent: 'ps-0',
      }}
    >
      <AccordionMenuSub value="resources">
        <AccordionMenuSubTrigger value="resource-trigger">
          <span>Resources</span>
          <AccordionMenuIndicator />
        </AccordionMenuSubTrigger>

        <AccordionMenuSubContent
          type="single"
          collapsible
          parentValue="resource-trigger"
        >
          {items.map((child, index) => (
            <AccordionMenuItem key={index} value={child.path ?? '#'}>
              {isExternalPath(child.path) ? (
                <a
                  href={child.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={(child.title ?? '') + ' · Opens in a new tab'}
                  onClick={(event) => {
                    // The menu item trigger calls preventDefault on bubbled
                    // clicks, which would cancel the browser's new-tab open.
                    event.stopPropagation();
                  }}
                >
                  {child.img ? (
                    <img src={child.img} alt="" className="size-4 rounded-sm" />
                  ) : (
                    child.icon && <child.icon />
                  )}
                  <span>{child.title}</span>
                </a>
              ) : (
                <Link to={child.path ?? '#'}>
                  {child.icon && <child.icon />}
                  <span>{child.title}</span>
                  {child.badge == 'Pro' && (
                    <Badge size="sm" variant="success" appearance="light">
                      {child.badge}
                    </Badge>
                  )}
                </Link>
              )}
            </AccordionMenuItem>
          ))}
        </AccordionMenuSubContent>
      </AccordionMenuSub>
    </AccordionMenu>
  );
}
