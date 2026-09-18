import type { GridSort } from '@coverland-engineering/ui/flat-data-grid';
import type { ProjectDesignRevision } from '@/shared/types/workbench';
import type { LibraryPart } from './part-library';

/** The library appends revisions in version order. */
export function latestPartRevision(
  part: LibraryPart,
): ProjectDesignRevision | undefined {
  return part.revisions[part.revisions.length - 1];
}

function sortValue(
  part: LibraryPart,
  columnId: string,
): string | number | undefined {
  switch (columnId) {
    case 'name':
      return part.name;
    case 'type':
      return part.type;
    case 'version':
      return latestPartRevision(part)?.revisionNumber ?? 1;
    default:
      return latestPartRevision(part)?.createdAt;
  }
}

/** Filter and sort the entire result before paging, never just the visible page. */
export function partsGridRows(
  parts: readonly LibraryPart[],
  query: string,
  sort: GridSort | null,
): LibraryPart[] {
  const normalized = query.trim().toLowerCase();
  const rows = parts.filter((part) =>
    `${part.name} ${part.type}`.toLowerCase().includes(normalized),
  );
  const columnId = sort?.id ?? 'updated';
  const direction = sort?.direction ?? 'desc';
  return rows.sort((left, right) => {
    const a = sortValue(left, columnId);
    const b = sortValue(right, columnId);
    if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
    const comparison =
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true });
    return direction === 'asc' ? comparison : -comparison;
  });
}
