import { ScrollArea } from '@coverland-engineering/ui/scroll-area';
import { Separator } from '@coverland-engineering/ui/separator';
import { useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
import { getAdminMenu, getResourcesMenu } from '../navigation';
import { SidebarPrimaryMenu } from './sidebar-primary-menu';
import { SidebarResourcesMenu } from './sidebar-resources-menu';
import { SidebarSearch } from './sidebar-search';

interface SidebarSecondaryProps {
  toolsMenuTitle: string;
}

export function SidebarSecondary({ toolsMenuTitle }: SidebarSecondaryProps) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  return (
    <ScrollArea className="grow shrink-0 h-[calc(100vh-1rem)] lg:h-[calc(100vh-4rem)] mt-0 mb-2.5">
      <SidebarSearch />
      <SidebarPrimaryMenu toolsMenuTitle={toolsMenuTitle} />
      <Separator className="my-2.5" />
      <SidebarResourcesMenu items={getResourcesMenu(team)} />
      <Separator className="my-2.5" />
      <SidebarResourcesMenu title="Admin Tools" items={getAdminMenu()} />
      <Separator className="my-2.5" />
    </ScrollArea>
  );
}
