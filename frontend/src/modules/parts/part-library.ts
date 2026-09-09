import { useSyncExternalStore } from 'react';
import type {
  ProductType,
  ProjectDesign,
  ProjectDesignDetails,
  ProjectDesignRevision,
} from '@/shared/types/workbench';

export interface LibraryPart {
  id: string;
  name: string;
  product: ProductType;
  type: string;
  details: ProjectDesignDetails;
  revisions: readonly ProjectDesignRevision[];
}
const KEY = 'coverland-part-library-v1';
let raw = '';
let cached: readonly LibraryPart[] = [];
function snapshot() {
  const next = localStorage.getItem(KEY) ?? '[]';
  if (next !== raw) {
    raw = next;
    try {
      const parsed: unknown = JSON.parse(next);
      cached = Array.isArray(parsed) ? parsed : [];
    } catch {
      cached = [];
    }
  }
  return cached;
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('part-library-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('part-library-change', callback);
  };
}
export function usePartLibrary() {
  return useSyncExternalStore(subscribe, snapshot);
}
export function saveLibraryPart(part: LibraryPart) {
  const items = snapshot();
  if (
    items.some(
      (item) =>
        item.id !== part.id &&
        item.name.toLowerCase() === part.name.toLowerCase(),
    )
  )
    throw new Error('동일한 이름의 Part가 이미 있습니다.');
  localStorage.setItem(
    KEY,
    JSON.stringify([...items.filter((item) => item.id !== part.id), part]),
  );
  window.dispatchEvent(new Event('part-library-change'));
}
export function importProjectParts(
  designs: readonly ProjectDesign[],
  product: ProductType,
) {
  for (const design of designs) {
    const existing = snapshot().find(
      (part) => part.name.toLowerCase() === design.name.toLowerCase(),
    );
    saveLibraryPart({
      id: existing?.id ?? crypto.randomUUID(),
      name: design.name,
      product,
      type:
        design.details.kind === 'SEAT_COVER'
          ? design.details.category
          : product,
      details: design.details,
      revisions: design.revisions.map((revision) => ({ ...revision })),
    });
  }
}
