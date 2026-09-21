import { Button } from '@coverland-engineering/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@coverland-engineering/ui/tooltip';
import { Circle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  isExternalPath,
  isSidebarLinkActive,
  type MenuItem,
} from '../navigation';

/** Named, keyboard-accessible shortcut; tooltips escape the scrolling rail. */
export function SidebarIconLink({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const available = Boolean(item.path && item.path !== '#' && !item.disabled);
  const external = isExternalPath(item.path);
  const label =
    (item.title ?? 'Menu') +
    (available ? (external ? ' · Opens in a new tab' : '') : ' · Coming soon');
  const active =
    available &&
    !external &&
    Boolean(item.path && isSidebarLinkActive(pathname, item.path));
  const Icon = item.icon ?? Circle;
  const visual = item.img ? (
    <img src={item.img} alt="" className="size-4 rounded-sm" />
  ) : (
    <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {available && item.path ? (
          <Button
            asChild
            mode="icon"
            variant="ghost"
            data-active={active}
            className="size-9 shrink-0 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 data-[active=true]:bg-zinc-100 data-[active=true]:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:data-[active=true]:bg-zinc-800 dark:data-[active=true]:text-zinc-100"
            aria-label={label}
          >
            {external ? (
              <a href={item.path} target="_blank" rel="noopener noreferrer">
                {visual}
              </a>
            ) : (
              <Link to={item.path} aria-current={active ? 'page' : undefined}>
                {visual}
              </Link>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            mode="icon"
            variant="ghost"
            className="size-9 shrink-0 cursor-not-allowed rounded-lg text-zinc-400 hover:bg-transparent dark:text-zinc-600 dark:hover:bg-transparent"
            aria-label={label}
            aria-disabled="true"
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
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
