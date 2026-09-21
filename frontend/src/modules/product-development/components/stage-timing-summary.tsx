import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { VehicleZoneProject } from '@/shared/types/workbench';
import { reportDate } from '@/modules/rd-workspace/report-date';
import { currentStageTiming } from '../project-health';

/** Show the frozen stage target separately from the overall delivery deadline. */
export function StageTimingSummary({
  zone,
}: {
  zone: VehicleZoneProject;
}): ReactElement {
  const timing = currentStageTiming(zone);
  return (
    <section className="shape-section" aria-label="현재 단계 일정">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>
          현재 단계 일정 ·{' '}
          {zone.currentStage === 'Approved' ? '개발 완료' : zone.currentStage}
        </strong>
        <Link
          to={
            '/reference-data?tab=stages&product=' +
            encodeURIComponent(zone.productTypeId)
          }
        >
          단계 기준 설정
        </Link>
      </div>
      {zone.currentStage === 'Approved' ? (
        <p>개발 완료 · 표준 기간과 목표일을 새로 계산하지 않습니다.</p>
      ) : (
        <p>
          시작 {reportDate(timing?.startedAt) ?? '기록 없음'} · 적용 표준{' '}
          {timing?.targetDays !== undefined
            ? `${String(timing.targetDays)}일`
            : '미설정'}{' '}
          · 단계 목표 {reportDate(timing?.targetDueAt) ?? '미설정'}
        </p>
      )}
      <p>
        전체 프로젝트 목표 {reportDate(zone.targetAt) ?? '미지정'} · 기준 변경은
        다음 단계 시작부터 적용됩니다.
      </p>
    </section>
  );
}
