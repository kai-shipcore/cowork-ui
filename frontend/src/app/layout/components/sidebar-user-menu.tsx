import type { ReactElement } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarIndicator,
  AvatarStatus,
} from '@coverland-engineering/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@coverland-engineering/ui/dropdown-menu';
import { LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { TeamId } from '@/modules/operations/operations-model';

interface SidebarUserMenuProps {
  team: TeamId;
}

/** Restores the original demo identity; this display is not an authenticated session. */
export function SidebarUserMenu({ team }: SidebarUserMenuProps): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Kai Chung user menu"
        title="Demo user profile"
        className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar className="size-7">
          <AvatarFallback>KC</AvatarFallback>
          <AvatarIndicator className="-end-2 -top-2">
            <AvatarStatus
              variant="online"
              className="size-2.5"
              aria-hidden="true"
            />
          </AvatarIndicator>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        side="right"
        align="end"
        sideOffset={11}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar>
            <AvatarFallback>KC</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-sm font-semibold text-foreground">
              Kai Chung
            </span>
            <span className="text-xs text-muted-foreground">
              kai.c@shipcore.com
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={'/work/settings?team=' + team}>
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to={ROUTES.login}
            replace
            title="Exit demo and return to sign in"
          >
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
