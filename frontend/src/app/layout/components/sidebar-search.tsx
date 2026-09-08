import { Badge } from '@coverland-engineering/ui/badge';
import { Input, InputWrapper } from '@coverland-engineering/ui/input';

export function SidebarSearch() {
  return (
    <div className="flex px-5 pt-2.5 shrink-0">
      <InputWrapper className="relative">
        <Input type="search" placeholder="Search" />
        <Badge className="absolute end-3 gap-1" variant="outline" size="sm">
          ⌘ K
        </Badge>
      </InputWrapper>
    </div>
  );
}
