import { Button } from '@coverland-engineering/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@coverland-engineering/ui/dropdown-menu';
import { Menu } from 'lucide-react';
import { Link } from 'react-router';
import { useLocation } from 'react-router-dom';
import { useMenu } from '@/shared/hooks/use-menu';
import { MENU_TOOLBAR } from '@/app/layout/navigation';

export function ToolbarMenuMobile() {
  const { pathname } = useLocation();
  const { isActive } = useMenu(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Menu /> Page Menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        {MENU_TOOLBAR.map((item, index) => {
          const active = isActive(item.path);

          return (
            <DropdownMenuItem
              key={index}
              asChild
              {...(active && { 'data-here': 'true' })}
            >
              <Link to={item.path ?? '#'} className="flex items-center gap-2">
                {item.icon && <item.icon />}
                {item.title}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
