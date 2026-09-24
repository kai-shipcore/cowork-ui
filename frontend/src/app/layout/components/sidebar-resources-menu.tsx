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
  /** Group heading; the accordion ids derive from it. */
  title?: string;
}

export function SidebarResourcesMenu({
  items,
  title = 'Resources',
}: SidebarResourcesMenuProps) {
  const { pathname } = useLocation();
  const groupValue = title.toLowerCase().replace(/\s+/g, '-');
  const triggerValue = `${groupValue}-trigger`;

  // Memoize matchPath to prevent unnecessary re-renders
  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname ||
      (path.length > 1 && pathname.startsWith(path) && path !== '/dashboard'),
    [pathname],
  );

  return (
    <AccordionMenu
      selectedValue={triggerValue}
      matchPath={matchPath}
      type="single"
      collapsible
      defaultValue={triggerValue}
      className="space-y-7.5 px-2.5"
      classNames={{
        item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100',
        subTrigger:
          'text-xs font-normal text-muted-foreground hover:bg-transparent',
        subContent: 'ps-0',
      }}
    >
      <AccordionMenuSub value={groupValue}>
        <AccordionMenuSubTrigger value={triggerValue}>
          <span>{title}</span>
          <AccordionMenuIndicator />
        </AccordionMenuSubTrigger>

        <AccordionMenuSubContent
          type="single"
          collapsible
          parentValue={triggerValue}
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
