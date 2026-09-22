import type { ReactElement } from 'react';
import { PageHeader } from '@/shared/components/page-header';
import { RdPerformance } from './rd-performance';

/** Standalone home for the R&D performance report, previously a tab under Work Reports. */
export function PerformanceDashboardPage(): ReactElement {
  return (
    <section>
      <PageHeader description="Cycle time, completions, and stage deviations against period targets." />
      <RdPerformance />
    </section>
  );
}
