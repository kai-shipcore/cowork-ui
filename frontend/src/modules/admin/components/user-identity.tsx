import { Avatar, AvatarFallback } from '@coverland-engineering/ui/avatar';
import { userInitials } from '../user-management-model';

interface UserIdentityProps {
  name: string;
  email: string;
}

/** Avatar initials beside the name and email, as the users and invitations grids show a person. */
export function UserIdentity({ name, email }: UserIdentityProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">
          {userInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>
    </div>
  );
}
