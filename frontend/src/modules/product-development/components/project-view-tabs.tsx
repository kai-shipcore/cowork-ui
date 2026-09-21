import type { ReactElement, ReactNode } from 'react';
import { Card } from '@coverland-engineering/ui/card';
import {
  ContentTabs,
  ContentTabsPanel,
} from '@coverland-engineering/ui/content-tabs';
import { Columns3, List } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface ProjectViewTabsProps {
  list: ReactNode;
  board: ReactNode;
  toolbar?: ReactNode;
}

/** URL-controlled project views keep the grid mounted when switching tabs. */
export function ProjectViewTabs({
  list,
  board,
  toolbar,
}: ProjectViewTabsProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'board' ? 'board' : 'list';

  return (
    <Card className="min-w-0 overflow-hidden">
      <ContentTabs
        label="프로젝트 보기"
        value={view}
        onValueChange={(value) => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('view', value);
            return next;
          });
        }}
        items={[
          { value: 'list', label: '목록', icon: <List /> },
          { value: 'board', label: '단계별 보드', icon: <Columns3 /> },
        ]}
        className="[--primary:#2F80FF] [--color-primary:#2F80FF]"
      >
        {toolbar}
        <ContentTabsPanel value="list">{list}</ContentTabsPanel>
        <ContentTabsPanel value="board">{board}</ContentTabsPanel>
      </ContentTabs>
    </Card>
  );
}
