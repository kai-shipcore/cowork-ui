import type { ReactElement, ReactNode } from 'react';
import { Card } from '@coverland-engineering/ui/card';
import {
  ContentTabs,
  ContentTabsPanel,
} from '@coverland-engineering/ui/content-tabs';
import { ClipboardList, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface DevelopmentRequestTabsProps {
  requests: ReactNode;
  complaints: ReactNode;
}

/** Tab navigation preserves filters and mounted form drafts without importing data. */
export function DevelopmentRequestTabs({
  requests,
  complaints,
}: DevelopmentRequestTabsProps): ReactElement {
  const [params, setParams] = useSearchParams();
  return (
    <Card className="min-w-0 overflow-hidden">
      <ContentTabs
        label="개발 요청 보기"
        value={params.get('view') === 'complaints' ? 'complaints' : 'requests'}
        onValueChange={(value) => {
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('view', value);
            return next;
          });
        }}
        items={[
          {
            value: 'requests',
            label: '개발 요청 등록',
            icon: <ClipboardList />,
          },
          {
            value: 'complaints',
            label: '컴플레인 가져오기',
            icon: <Download />,
          },
        ]}
        className="[--primary:#2F80FF] [--color-primary:#2F80FF]"
      >
        <ContentTabsPanel value="requests">{requests}</ContentTabsPanel>
        <ContentTabsPanel value="complaints">{complaints}</ContentTabsPanel>
      </ContentTabs>
    </Card>
  );
}
