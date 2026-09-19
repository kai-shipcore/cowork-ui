import { ScrollArea } from '@coverland-engineering/ui/scroll-area';
import { Separator } from '@coverland-engineering/ui/separator';
import { SidebarPrimaryMenu } from './sidebar-primary-menu';
import { SidebarResourcesMenu } from './sidebar-resources-menu';
import { SidebarSearch } from './sidebar-search';
import { SidebarWorkspacesMenu } from './sidebar-workspaces-menu';

interface SidebarSecondaryProps {
  toolsMenuTitle: string;
}

export function SidebarSecondary({ toolsMenuTitle }: SidebarSecondaryProps) {
  return (
    <ScrollArea className="grow shrink-0 h-[calc(100vh-1rem)] lg:h-[calc(100vh-4rem)] mt-0 mb-2.5">
      <SidebarSearch />
      <SidebarPrimaryMenu toolsMenuTitle={toolsMenuTitle} />
      <Separator className="my-2.5" />
      <SidebarResourcesMenu />
      <Separator className="my-2.5" />
      <SidebarWorkspacesMenu />
      <Separator className="my-2.5" />
    </ScrollArea>
  );
}
