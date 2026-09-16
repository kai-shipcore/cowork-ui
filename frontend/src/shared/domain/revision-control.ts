import type {
  ProjectDesignRevision,
  SampleRequestItem,
} from '../types/workbench';
import { sampleStatus } from './sample-inspection';

export async function fileFingerprint(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isChangedDxf(
  previousFingerprint: string,
  nextFingerprint: string,
): boolean {
  return Boolean(
    previousFingerprint &&
    nextFingerprint &&
    previousFingerprint !== nextFingerprint,
  );
}

export function revisionExecutionAccuracy(
  items: readonly SampleRequestItem[],
): { exact: number; verified: number; percentage?: number } {
  const verifiedItems = items.filter((item) => item.revisionReflected);
  const exact = verifiedItems.filter(
    (item) => item.revisionReflected === 'CORRECT',
  ).length;
  return {
    exact,
    verified: verifiedItems.length,
    ...(verifiedItems.length
      ? { percentage: Math.round((exact / verifiedItems.length) * 1000) / 10 }
      : {}),
  };
}

export function canApproveRevisionSample(
  revision: ProjectDesignRevision | undefined,
  item: SampleRequestItem,
): boolean {
  return (
    sampleStatus(item) === 'PASSED' &&
    (!revision?.changeRequest || item.revisionReflected === 'CORRECT')
  );
}
