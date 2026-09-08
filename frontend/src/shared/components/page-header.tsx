import type { ReactNode } from 'react';

/** A database table the screen reads or writes. */
export interface TableRef {
  name: string;
  /** True when the table is not in the schema (proposed, or a UI-only stand-in). */
  proposed?: boolean;
}

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
 * Keeps the page description and primary actions consistent across R&D
 * screens. The page name itself comes from the header breadcrumbs, so it is
 * deliberately not repeated here.
 */
export function PageHeader({ description, tables, actions }: PageHeaderProps) {
  const showTables =
    import.meta.env.DEV && tables !== undefined && tables.length > 0;

  return (
    <header className="workbench-page-header">
      <div>
        <p>{description}</p>
        {showTables && (
          <details className="page-tables">
            <summary>
              Tables <span className="page-tables-count">{tables.length}</span>
            </summary>
            <div className="page-tables-list">
              {tables.map((table) => (
                <span
                  className={
                    table.proposed ? 'table-chip proposed' : 'table-chip'
                  }
                  key={table.name}
                  title={
                    table.proposed
                      ? '스키마에 없는 테이블입니다 (제안 또는 UI 전용)'
                      : undefined
                  }
                >
                  {table.name}
                  {table.proposed && <em>미존재</em>}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
