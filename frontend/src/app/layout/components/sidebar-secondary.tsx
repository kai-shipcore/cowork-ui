import { ScrollArea } from '@coverland-engineering/ui/scroll-area';
import { Separator } from '@coverland-engineering/ui/separator';
import { Link, useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
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
      {team === 'rd' && <SidebarResourcesMenu />}
      <Separator className="my-2.5" />
      <div className="grid gap-3 px-5 py-3 text-sm">
        <span className="text-xs text-muted-foreground">Common Workspace</span>
        <Link to={'/work/reports?team=' + team}>업무 리포트</Link>
        <Link to={'/work/settings?team=' + team}>데이터 · 운영 설정</Link>
      </div>
      <Separator className="my-2.5" />
    </ScrollArea>
  );
}
