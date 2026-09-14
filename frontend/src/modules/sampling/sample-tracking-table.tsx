import { Card } from '@coverland-engineering/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@coverland-engineering/ui/table';
import { sampleRoundLabel } from '@/shared/domain/sample-request';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  useWorkbenchPagination,
  WorkbenchPagination,
} from '@/shared/components/workbench-pagination';
import type { SampleTrackingRow } from './sample-tracking';

interface SampleTrackingTableProps {
  rows: readonly SampleTrackingRow[];
  /** Resets the page when the surrounding filters change. */
  filterKey: string;
  onOpenProject: (projectGroupId: string) => void;
}

/** Sample Tracking sheet view (Stage 8): one part per row, sheet column order. */
export function SampleTrackingTable({
  rows,
  filterKey,
  onOpenProject,
}: SampleTrackingTableProps) {
  const { pageItems, pagination, setPagination } = useWorkbenchPagination(
    rows,
    filterKey,
  );

  if (!rows.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <strong>등록된 부품 행이 없습니다.</strong>
        <p>
          프로젝트 상세의 Samples 탭에서 Sample Request를 만들면 부품마다 한
          행씩 생성됩니다.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Row / Seat Type</TableHead>
            <TableHead>Part Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sample Round</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.date}</TableCell>
              <TableCell>
                <div className="vehicle-name compact">{row.vehicle}</div>
                <button
                  type="button"
                  className="project-reference project-reference-link"
                  onClick={() => onOpenProject(row.projectGroupId)}
                >
                  {row.requestId}
                </button>
              </TableCell>
              <TableCell>{row.seatType}</TableCell>
              <TableCell>
                <code>{row.partName}</code>
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={row.status === 'READY' ? 'Ready' : 'Sample'}
                  tone={row.status === 'READY' ? 'success' : 'progress'}
                />
              </TableCell>
              <TableCell>{sampleRoundLabel(row.sampleRound)}</TableCell>
              <TableCell>{row.vendor}</TableCell>
              <TableCell>
                {row.note ? row.note : <span className="muted-text">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <WorkbenchPagination
        recordCount={rows.length}
        pagination={pagination}
        onPaginationChange={setPagination}
        itemLabel="rows"
      />
    </Card>
  );
}
