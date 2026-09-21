import type { ReactElement, ReactNode } from 'react';
import { Card } from '@coverland-engineering/ui/card';
import {
  ContentTabs,
  ContentTabsPanel,
} from '@coverland-engineering/ui/content-tabs';
import { ChartNoAxesCombined, ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface ReportViewTabsProps {
  operations: ReactNode;
  performance: ReactNode;
}

/** Report panels stay mounted so their filters and draft targets survive tab changes. */
export function ReportViewTabs({
  operations,
  performance,
}: ReportViewTabsProps): ReactElement {
  const [params, setParams] = useSearchParams();
  return (
    <Card className="min-w-0 overflow-hidden">
      <ContentTabs
        label="리포트 종류"
        value={params.get('report') === 'rd' ? 'rd' : 'operations'}
        onValueChange={(value) => {
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('report', value);
            return next;
          });
        }}
        items={[
          {
            value: 'operations',
            label: '팀 간 요청 현황',
            icon: <ClipboardList />,
          },
          { value: 'rd', label: 'R&D 성과', icon: <ChartNoAxesCombined /> },
        ]}
        className="[--primary:#2F80FF] [--color-primary:#2F80FF]"
      >
        <ContentTabsPanel value="operations" className="ops-report-panel">
          {operations}
        </ContentTabsPanel>
        <ContentTabsPanel value="rd" className="ops-report-panel">
          {performance}
        </ContentTabsPanel>
      </ContentTabs>
    </Card>
  );
}
