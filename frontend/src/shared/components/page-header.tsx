import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { DatabaseTable } from '@/shared/types/db-tables';
import { pageTitle } from '@/app/layout/page-identity';

/** A database table the screen reads or writes. */
export type TableRef =
  { name: DatabaseTable; proposed?: false } | { name: string; proposed: true };

interface PageHeaderProps {
  description: string;
  /**
   * Tables backing this screen, for cross-checking against the DDL. Rendered
   * only in development — it is a developer aid, not operator-facing chrome.
   * Omit when the mapping is not established rather than guessing.
   */
  tables?: readonly TableRef[];
  actions?: ReactNode;
}

/**
 * Developer aid listing the tables a screen reads or writes. Renders nothing
 * outside development.
 */
export function PageTables({ tables }: { tables: readonly TableRef[] }) {
  if (!import.meta.env.DEV || tables.length === 0) {
    return null;
  }

  return (
    <details className="page-tables">
      <summary>
        Related data tables{' '}
        <span className="page-tables-count">{tables.length}</span>
      </summary>
      <div className="page-tables-list">
        {tables.map((table) => (
          <span
            className={table.proposed ? 'table-chip proposed' : 'table-chip'}
            key={table.name}
            title={
              table.proposed
                ? 'This table is not in the schema (proposed or UI-only)'
                : undefined
            }
          >
            {table.name}
            {table.proposed && <em>Not in schema</em>}
          </span>
        ))}
      </div>
    </details>
  );
}

/**
 * Shared route heading, description and actions for workbench screens.
 */
export function PageHeader({ description, tables, actions }: PageHeaderProps) {
  const { pathname, search } = useLocation();
  return (
    <header className="workbench-page-header">
      <div>
        <span className="workbench-page-eyebrow">Coverland workspace</span>
        <h1>{pageTitle(pathname, search)}</h1>
        <p>{description}</p>
        {tables && <PageTables tables={tables} />}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
