import { Button } from '@coverland-engineering/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@coverland-engineering/ui/tooltip';
import { Circle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { MenuItem } from '../navigation';

/** Named, keyboard-accessible shortcut; tooltips escape the scrolling rail. */
export function SidebarIconLink({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const available = Boolean(item.path && item.path !== '#' && !item.disabled);
  const label = (item.title ?? '메뉴') + (available ? '' : ' · 준비 중');
  const path = item.path?.split('?')[0];
  const active =
    available &&
    (pathname === path || Boolean(path && pathname.startsWith(path + '/')));
  const Icon = item.icon ?? Circle;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {available && item.path ? (
          <Button
            asChild
            mode="icon"
            variant={active ? 'primary' : 'ghost'}
            className="shrink-0"
            aria-label={label}
          >
            <Link to={item.path} aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            mode="icon"
            variant="ghost"
            className="shrink-0 opacity-45 cursor-not-allowed"
            aria-label={label}
            aria-disabled="true"
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        )}
      </TooltipTrigger>
      {typeof document !== 'undefined' &&
        createPortal(
          <TooltipContent side="right" sideOffset={12}>
            {label}
          </TooltipContent>,
          document.body,
        )}
    </Tooltip>
  );
}
