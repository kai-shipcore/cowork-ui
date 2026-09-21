import type { ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Download } from 'lucide-react';
import type { DevelopmentIntake } from './intake-model';

interface ComplaintImportGridProps {
  rows: readonly DevelopmentIntake[];
  records: readonly DevelopmentIntake[];
  saving: boolean;
  onImport: () => void;
}

/** Preview importable complaints; importing remains an explicit action, never a tab effect. */
export function ComplaintImportGrid({
  rows,
  records,
  saving,
  onImport,
}: ComplaintImportGridProps): ReactElement {
  const imported = new Set(records.map((entry) => entry.id));
  const pendingCount = rows.filter((entry) => !imported.has(entry.id)).length;
  const columns: FlatDataGridColumn<DevelopmentIntake>[] = [
    {
      id: 'reference',
      header: 'Complaint ID',
      width: 165,
      sortValue: (entry) => entry.sourceReference,
      cell: (entry) => entry.sourceReference,
    },
    {
      id: 'vehicle',
      header: 'Vehicle / Product',
      width: 240,
      sortValue: (entry) => entry.vehicle,
      cell: (entry) => (
        <div>
          <strong>{entry.vehicle}</strong>
          <br />
          <small>{entry.product}</small>
        </div>
      ),
    },
    {
      id: 'evidence',
      header: 'Complaint details',
      width: 340,
      cell: (entry) => (
        <span className="whitespace-pre-wrap break-words">
          {entry.evidence}
        </span>
      ),
    },
    {
      id: 'configuration',
      header: 'Research configuration',
      width: 170,
      sortValue: (entry) => entry.configurationId,
      cell: (entry) => entry.configurationId || 'No configuration linked',
    },
    {
      id: 'import',
      header: 'Import status',
      width: 145,
      sortValue: (entry) => (imported.has(entry.id) ? 1 : 0),
      cell: (entry) => (imported.has(entry.id) ? 'Imported' : 'Pending import'),
    },
  ];
  return (
    <FlatDataGrid
      embedded
      label="Complaint import list"
      rows={rows}
      columns={columns}
      getRowId={(entry) => entry.id}
      sorting={{ mode: 'client' }}
      toolbarContent={
        <div>
          <strong>Open complaints · {rows.length} items</strong>
          <p>
            Only valid vehicle and issue records are shown. Previously imported
            items are not added again.
          </p>
        </div>
      }
      actions={
        <Button disabled={saving || pendingCount === 0} onClick={onImport}>
          <Download />
          {saving
            ? 'Importing…'
            : `Import ${String(pendingCount)} new ${pendingCount === 1 ? 'item' : 'items'}`}
        </Button>
      }
      emptyMessage="No eligible open complaints to import."
    />
  );
}
