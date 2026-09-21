import type { ReactNode } from 'react';

/** Shared centered working surface for every route inside the app shell. */
export function PageContent({ children }: { children: ReactNode }) {
  return (
    <main className="workbench-content metronic-content @container/workbench mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
      {children}
    </main>
  );
}
