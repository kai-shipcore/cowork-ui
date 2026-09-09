import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input } from '@coverland-engineering/ui/input';
import { Link } from 'react-router';
import type {
  ProjectDesign,
  ProjectSizeReview,
  ProjectVisit,
  ZoneProject,
} from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ShapeEditor } from './shape-editor';
import {
  dimensionsLabel,
  isSizeReviewCurrent,
  SHAPE_STATUSES,
  sizeReviewBlockers,
  sizeReviewEvidence,
} from './shape-model';
import './shape-management.css';

interface Props {
  zone: ZoneProject;
  designs: readonly ProjectDesign[];
  visits: readonly ProjectVisit[];
  onReview: (review: ProjectSizeReview) => void;
  onLink: (id: string | undefined) => void;
  onOpenTab: (tab: 'designs' | 'visits' | 'files') => void;
}

export function ProjectShapePanel({
  zone,
  designs,
  visits,
  onReview,
  onLink,
  onOpenTab,
}: Props) {
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    appUsers,
  } = useWorkbenchStore();
  const [editor, setEditor] = useState(false);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [blueprint, setBlueprint] = useState(
    zone.sizeReview?.blueprintReference ?? '',
  );
  const [reviewer, setReviewer] = useState(
    zone.sizeReview?.reviewedBy ?? CURRENT_USER_ID,
  );
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [meetingAt, setMeetingAt] = useState('');
  const [attendees, setAttendees] = useState({
    designer: '',
    scan: '',
    coordinator: '',
    manual: '',
  });
  const participants = [
    `PM / Director: ${reviewer}`,
    `Pattern Designer: ${attendees.designer}`,
    `Scan Team: ${attendees.scan}`,
    `Coordinator: ${attendees.coordinator}`,
    `Manual Design: ${attendees.manual}`,
  ];
  const meetingReady = Boolean(
    meetingAt &&
    Number.isFinite(Date.parse(meetingAt)) &&
    Object.values(attendees).every((name) => name.trim()) &&
    Date.parse(meetingAt) >=
      Math.floor(
        Date.parse(zone.productionHandoff?.completedAt ?? '') / 60000,
      ) *
        60000,
  );
  const [rejectionType, setRejectionType] = useState<'DOCUMENT' | 'PATTERN'>(
    'DOCUMENT',
  );
  const [affectedDesignIds, setAffectedDesignIds] = useState<readonly string[]>(
    [],
  );
  const canRequestChanges =
    zone.currentStage === 'Approved' &&
    zone.productionHandoff &&
    meetingReady &&
    note.trim() &&
    (rejectionType !== 'PATTERN' || affectedDesignIds.length > 0) &&
    appUsers.some((user) => user.id === reviewer && user.status === 'ACTIVE');
  const blockers = sizeReviewBlockers(zone, designs, visits);
  const reviewed = isSizeReviewCurrent(zone, designs, visits);
  const shape = shapes.find((item) => item.id === zone.productShapeId);
  const candidates = shapes.filter(
    (item) =>
      item.productTypeId === zone.productTypeId &&
      item.status === 'ACTIVE' &&
      `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const parts = designs.filter(
    (design) =>
      design.vehicleProjectId === zone.id && design.status === 'ACTIVE',
  );
  const reviewAllowed =
    !blockers.length &&
    meetingReady &&
    blueprint.trim() &&
    checked &&
    appUsers.some((user) => user.id === reviewer && user.status === 'ACTIVE');
  const linkAllowed =
    reviewed && (!shape || replacing) && zone.currentStage === 'Approved';
  return (
    <div className="shape-management">
      <div className="shape-info">
        <strong>Shape · {zone.code}</strong>
        <p>
          양산 인계 완료 → Stage 14 검토·승인 → Stage 15 Shape 발급·연결 → Stage
          16 구성 등록
        </p>
        <p>
          스캔·3D 모델·패턴 작업에는 Shape가 필요하지 않습니다. 기존 Shape를
          재사용해도 이 프로젝트의 피팅과 검토는 필요합니다.
        </p>
        <Link to="/product-shapes">전체 Shape 관리 →</Link>
        {zone.productionHandoff && (
          <p>
            양산 인계: {zone.productionHandoff.completedAt.slice(0, 10)} ·{' '}
            {zone.productionHandoff.reference}
          </p>
        )}
      </div>
      <section className="shape-section">
        <h3>1. 피팅 결과와 최종 자료 확인</h3>
        {blockers.length ? (
          <ul className="shape-errors">
            {blockers.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          <p>
            피팅 PASS와 Part / 패턴 버전이 준비되었습니다. Blueprint와 최종
            구성의 일치 여부를 검토하세요.
          </p>
        )}
        <div className="shape-actions">
          <Button variant="outline" onClick={() => onOpenTab('visits')}>
            피팅 Visits
          </Button>
          <Button variant="outline" onClick={() => onOpenTab('designs')}>
            최종 Part / 패턴 {parts.length}개
          </Button>
          <Button variant="outline" onClick={() => onOpenTab('files')}>
            자료 확인
          </Button>
        </div>
        {parts.length > 0 && (
          <ul>
            {parts.map((part) => (
              <li key={part.id}>
                {part.name} · 수량 {part.quantity} · Rev{' '}
                {Math.max(
                  0,
                  ...part.revisions.map((revision) => revision.revisionNumber),
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="shape-section">
        <h3>Stage 14 · Shape 검토 회의 및 구두 승인</h3>
        <p>
          참석 대상: PM / Director, Pattern Designer, Scan Team, Coordinator,
          Manual Design 담당자
        </p>
        {reviewed ? (
          <div className="shape-success">
            <strong>현재 Part 구성과 피팅 결과의 검토가 완료되었습니다.</strong>
            <p>
              {appUsers.find((user) => user.id === zone.sizeReview?.reviewedBy)
                ?.name ?? zone.sizeReview?.reviewedBy}{' '}
              · {zone.sizeReview?.reviewedAt.slice(0, 10)}
            </p>
            <p>Blueprint: {zone.sizeReview?.blueprintReference}</p>
            <p>
              회의: {zone.sizeReview?.meetingAt} · 참석자:{' '}
              {zone.sizeReview?.participants?.join(', ')} · 구두 승인
            </p>
            {zone.sizeReview?.note && <p>{zone.sizeReview.note}</p>}
          </div>
        ) : (
          <>
            {zone.sizeReview?.outcome === 'REJECTED' && (
              <div role="status" className="shape-errors">
                <strong>수정 요청: {zone.sizeReview.note}</strong>
                <p>
                  자료를 보완한 뒤 다시 검토하세요. 패턴 변경이 필요하면 새
                  Revision·샘플·피팅을 진행하세요.
                </p>
              </div>
            )}
            {zone.sizeReview && zone.sizeReview.outcome !== 'REJECTED' && (
              <p role="status" className="shape-errors">
                Part 버전·구성 또는 피팅 기록이 변경되었습니다. 현재 자료로 다시
                검토하세요. 기존 Shape 연결은 유지됩니다.
              </p>
            )}
            <div className="dialog-form-grid">
              <label>
                회의 일시 *
                <Input
                  type="datetime-local"
                  value={meetingAt}
                  onChange={(event) => setMeetingAt(event.target.value)}
                />
              </label>
              {(
                [
                  ['designer', 'Pattern Designer'],
                  ['scan', 'Scan Team'],
                  ['coordinator', 'Coordinator'],
                  ['manual', 'Manual Design'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label} 참석자 *
                  <Input
                    value={attendees[key]}
                    onChange={(event) =>
                      setAttendees((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="실제 참석자 이름"
                  />
                </label>
              ))}
              <label>
                최종 Blueprint 참조 *
                <Input
                  value={blueprint}
                  onChange={(event) => setBlueprint(event.target.value)}
                  placeholder="최종 Blueprint 파일명, NAS 경로 또는 문서 링크"
                />
              </label>
              <label>
                검토 책임자 (PM / Director) *
                <select
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                >
                  {appUsers
                    .filter((user) => user.status === 'ACTIVE')
                    .map((user) => (
                      <option value={user.id} key={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="full-width">
                검토 메모
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="최종 구성, 적합성, 재사용 Shape 판단 근거"
                />
              </label>
            </div>
            <label className="shape-check">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              회의에서 책임자가 피팅 결과·최종 Parts 목록·Blueprint를 검토하고
              Shape 발급 또는 재사용을 구두 승인했음을 기록합니다.
            </label>
            <Button
              variant="primary"
              disabled={!reviewAllowed}
              onClick={() => {
                if (!reviewAllowed) return;
                onReview({
                  meetingAt,
                  participants,
                  approvalMethod: 'VERBAL',
                  outcome: 'APPROVED',
                  reviewedBy: reviewer,
                  reviewedAt: new Date().toISOString(),
                  blueprintReference: blueprint.trim(),
                  note: note.trim(),
                  evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                });
              }}
            >
              검토 승인 기록
            </Button>
            <label>
              반려 처리
              <select
                value={rejectionType}
                onChange={(event) =>
                  setRejectionType(event.target.value as 'DOCUMENT' | 'PATTERN')
                }
              >
                <option value="DOCUMENT">문서 보완 후 재검토</option>
                <option value="PATTERN">
                  패턴 재작업 · Stage 7 새 샘플 요청으로 복귀
                </option>
              </select>
            </label>
            {rejectionType === 'PATTERN' && (
              <div>
                <p>
                  수정할 Part를 선택하세요. 해당 Part는 새 Revision과 새 샘플이
                  필요하며 프로젝트 전체를 다시 피팅·인계합니다.
                </p>
                {parts.map((part) => (
                  <label className="shape-check" key={part.id}>
                    <Checkbox
                      checked={affectedDesignIds.includes(part.id)}
                      onCheckedChange={(value) =>
                        setAffectedDesignIds((current) =>
                          value === true
                            ? [...current, part.id]
                            : current.filter((id) => id !== part.id),
                        )
                      }
                    />
                    {part.name}
                  </label>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              disabled={!canRequestChanges}
              onClick={() => {
                if (!canRequestChanges) return;
                onReview({
                  meetingAt,
                  participants,
                  rejectionType,
                  affectedDesignIds:
                    rejectionType === 'PATTERN' ? affectedDesignIds : [],
                  outcome: 'REJECTED',
                  reviewedBy: reviewer,
                  reviewedAt: new Date().toISOString(),
                  blueprintReference: blueprint.trim(),
                  note: note.trim(),
                  evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                });
                setChecked(false);
              }}
            >
              반려 기록 (사유 메모 필수)
            </Button>
            <p className="muted-text">
              인계 이후의 회의 일시, 참석자, 필수 자료, 검토 책임자, 확인 체크를
              모두 입력해야 기록할 수 있습니다. 현재 화면은 실무 승인 결과를
              기록하며 계정별 승인 권한을 검증하지 않습니다.
            </p>
          </>
        )}
      </section>
      <section className="shape-section">
        <h3>Stage 15 · 최종 Shape 발급 · 연결</h3>
        {shape ? (
          <div className="shape-success">
            <strong>
              {shape.name} · {SHAPE_STATUSES[shape.status]}
            </strong>
            <p>{dimensionsLabel(shape.dimensions)}</p>
            <Link to={`/product-shapes?shape=${encodeURIComponent(shape.id)}`}>
              Shape 정보와 적용 프로젝트 관리 →
            </Link>
            {reviewed && (
              <div className="shape-actions">
                <Button
                  variant="outline"
                  onClick={() => setReplacing(!replacing)}
                >
                  {replacing ? '변경 취소' : '연결할 Shape 변경'}
                </Button>
                {replacing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onLink(undefined);
                      setReplacing(false);
                    }}
                  >
                    이 프로젝트 연결 해제
                  </Button>
                )}
              </div>
            )}
            <p>
              발급 후 ‘발급된 Shape’에서 Stage 16 Part 구성과 Blueprint를
              등록하세요.
            </p>
          </div>
        ) : (
          <p>연결된 최종 Shape가 없습니다.</p>
        )}
        {!reviewed && (
          <p className="shape-errors">
            위 검토·승인 기록을 완료하면 신규 발급과 기존 Shape 연결이
            가능합니다.
          </p>
        )}
        {(!shape || replacing) && (
          <>
            <div className="shape-actions">
              <Button
                variant="primary"
                disabled={!linkAllowed}
                onClick={() => setEditor(true)}
              >
                신규 Shape 발급 · 연결
              </Button>
            </div>
            <p>
              같은 최종 Shape를 쓰는 경우 기존 번호를 선택하세요. 다른 Shape는
              새 번호로 발급합니다.
            </p>
            <div className="shape-filters">
              <Input
                aria-label="기존 Shape 검색"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected('');
                }}
                placeholder="기존 Shape 검색"
              />
              <select
                aria-label="연결할 기존 Shape"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">같은 제품 유형의 확정 Shape 선택</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={!linkAllowed || !selected}
                onClick={() => {
                  if (
                    linkAllowed &&
                    candidates.some((item) => item.id === selected)
                  ) {
                    onLink(selected);
                    setReplacing(false);
                  }
                }}
              >
                기존 Shape 연결
              </Button>
            </div>
            {!candidates.length && <p>선택 가능한 확정 Shape가 없습니다.</p>}
          </>
        )}
      </section>
      {(zone.shapeReviewHistory?.length ?? 0) > 0 && (
        <details className="shape-section">
          <summary>검토 이력 {zone.shapeReviewHistory?.length}건</summary>
          {zone.shapeReviewHistory?.map((review, index) => (
            <p key={`${review.reviewedAt}-${index}`}>
              {review.reviewedAt} · {review.reviewedBy} ·{' '}
              {review.outcome === 'APPROVED'
                ? '구두 승인'
                : review.rejectionType === 'PATTERN'
                  ? '패턴 반려 → Stage 7'
                  : '문서 보완'}{' '}
              · {review.note} · Blueprint: {review.blueprintReference}
            </p>
          ))}
        </details>
      )}
      {editor && (
        <ShapeEditor
          shapes={shapes}
          productTypeId={zone.productTypeId}
          issuanceApproved
          usageCount={0}
          onClose={() => setEditor(false)}
          onSave={(item) => {
            if (!linkAllowed) return;
            setVehicleProductShapes((current) => [...current, item]);
            onLink(item.id);
            setEditor(false);
            setReplacing(false);
          }}
        />
      )}
    </div>
  );
}
