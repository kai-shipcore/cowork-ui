import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input } from '@coverland-engineering/ui/input';
import type { HandoffChecklist } from '@/shared/types/workbench';
import {
  HANDOFF_DOCUMENTS,
  handoffChecklistErrors,
} from '../handoff-checklist';

export function HandoffChecklistForm({
  value,
  onChange,
  projectId,
  vehicle,
  zones,
}: {
  value: HandoffChecklist;
  onChange: (value: HandoffChecklist) => void;
  projectId: string;
  vehicle: string;
  zones: string;
}) {
  const count = HANDOFF_DOCUMENTS.filter(
    ([id]) =>
      value.documents[id]?.confirmed && value.documents[id]?.reference.trim(),
  ).length;
  const errors = handoffChecklistErrors(value);
  const exportReport = () => {
    const report = [
      `양산 인계 체크리스트`,
      `${projectId} · ${vehicle} · ${zones}`,
      `내보낸 시각: ${new Date().toISOString()}`,
      ...HANDOFF_DOCUMENTS.map(
        ([id, label]) =>
          `${value.documents[id]?.confirmed ? '[확인]' : '[미확인]'} ${label}: ${value.documents[id]?.reference ?? ''}`,
      ),
      `적용 차량 확인: ${value.vehicleConfirmed}`,
      `프로젝트 번호 확인: ${value.projectNumberConfirmed}`,
      `양산 인계 승인: ${value.approvalConfirmed} / ${value.approvedBy}`,
      errors.length
        ? `미완료 항목:\n${errors.join('\n')}`
        : '체크리스트 준비 완료 (실제 인계 완료 여부는 프로젝트 기록 참조)',
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', report], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId}-handoff.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="project-dialog-stack">
      <p>
        <strong>자료·인계 체크리스트</strong> · 필수 자료 {count}/6 확인
      </p>
      {HANDOFF_DOCUMENTS.map(([id, label]) => {
        const item = value.documents[id] ?? { reference: '', confirmed: false };
        return (
          <div key={id} className="handoff-document">
            <label className="shape-check">
              <Checkbox
                checked={item.confirmed}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    documents: {
                      ...value.documents,
                      [id]: { ...item, confirmed: checked === true },
                    },
                  })
                }
              />
              {label}{' '}
              <small>
                {item.confirmed && item.reference.trim()
                  ? '확인 완료'
                  : '확인 필요'}
              </small>
            </label>
            <Input
              aria-label={`${label} 자료 위치`}
              value={item.reference}
              placeholder="파일명, NAS 경로 또는 자료 링크"
              onChange={(event) =>
                onChange({
                  ...value,
                  documents: {
                    ...value.documents,
                    [id]: { reference: event.target.value, confirmed: false },
                  },
                })
              }
            />
          </div>
        );
      })}
      <p className="muted-text">
        자료를 직접 열어 확인한 뒤 체크하세요. 이 화면은 자료 위치와 확인 기록을
        저장하며 파일 업로드나 내용 자동 검증은 수행하지 않습니다.
      </p>
      <label className="shape-check">
        <Checkbox
          checked={value.vehicleConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, vehicleConfirmed: checked === true })
          }
        />
        적용 차량·옵션·Zone 확인 · {vehicle} · {zones}
      </label>
      <label className="shape-check">
        <Checkbox
          checked={value.projectNumberConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, projectNumberConfirmed: checked === true })
          }
        />
        인계 대상 프로젝트 번호 확인 · {projectId}
      </label>
      <p className="muted-text">
        공식 Shape 번호는 인계 후 Stage 14 승인 → Stage 15에서 발급합니다.
        여기서는 프로젝트 번호를 확인합니다.
      </p>
      <label>
        양산 인계 승인 담당자
        <Input
          value={value.approvedBy}
          onChange={(event) =>
            onChange({
              ...value,
              approvedBy: event.target.value,
              approvalConfirmed: false,
            })
          }
          placeholder="실제 인계 승인 담당자 이름"
        />
      </label>
      <label className="shape-check">
        <Checkbox
          checked={value.approvalConfirmed}
          onCheckedChange={(checked) =>
            onChange({ ...value, approvalConfirmed: checked === true })
          }
        />
        생산 담당자에게 자료 전달 및 양산 인계 승인을 확인했습니다.
      </label>
      <p className="muted-text">
        양산 인계 확인과 이후 Shape 최종 품질 승인은 별도입니다.
      </p>
      {errors.length > 0 && (
        <div className="shape-errors" role="status">
          <strong>아래 항목을 완료해야 인계할 수 있습니다.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="outline" onClick={exportReport}>
        인계 보고서 내보내기
      </Button>
    </div>
  );
}
