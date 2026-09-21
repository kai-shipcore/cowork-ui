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
      header: '컴플레인 번호',
      width: 165,
      sortValue: (entry) => entry.sourceReference,
      cell: (entry) => entry.sourceReference,
    },
    {
      id: 'vehicle',
      header: '차량 / 제품',
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
      header: '컴플레인 내용',
      width: 340,
      cell: (entry) => (
        <span className="whitespace-pre-wrap break-words">
          {entry.evidence}
        </span>
      ),
    },
    {
      id: 'configuration',
      header: '조사 구성',
      width: 170,
      sortValue: (entry) => entry.configurationId,
      cell: (entry) => entry.configurationId || '구성 미연결',
    },
    {
      id: 'import',
      header: '가져오기 상태',
      width: 145,
      sortValue: (entry) => (imported.has(entry.id) ? 1 : 0),
      cell: (entry) =>
        imported.has(entry.id) ? '가져오기 완료' : '가져오기 대기',
    },
  ];
  return (
    <FlatDataGrid
      embedded
      label="컴플레인 가져오기 목록"
      rows={rows}
      columns={columns}
      getRowId={(entry) => entry.id}
      sorting={{ mode: 'client' }}
      toolbarContent={
        <div>
          <strong>미종결 컴플레인 · {rows.length}건</strong>
          <p>
            차량·내용이 유효한 항목만 표시하며, 이미 가져온 항목은 중복 등록하지
            않습니다.
          </p>
        </div>
      }
      actions={
        <Button disabled={saving || pendingCount === 0} onClick={onImport}>
          <Download />
          {saving
            ? '가져오는 중…'
            : `미등록 ${String(pendingCount)}건 가져오기`}
        </Button>
      }
      emptyMessage="가져올 수 있는 미종결 컴플레인이 없습니다."
    />
  );
}
