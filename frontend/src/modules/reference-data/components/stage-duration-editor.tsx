import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import {
  durationStages,
  type STAGE_PRODUCTS,
  type StageDurationRevision,
} from '@/app/stage-duration-model';

interface StageDurationEditorProps {
  product: (typeof STAGE_PRODUCTS)[number];
  latest?: StageDurationRevision;
  canEdit: boolean;
  saving: boolean;
  onSave: (
    draft: StageDurationRevision,
    expectedId?: string,
  ) => Promise<boolean>;
}

/** Drafts never alter existing stage snapshots; stale edits must be reloaded explicitly. */
export function StageDurationEditor({
  product,
  latest,
  canEdit,
  saving,
  onSave,
}: StageDurationEditorProps): ReactElement {
  const stages = durationStages(product.name);
  const fromRevision = () =>
    stages.map((stage) =>
      String(
        latest?.stages.find((entry) => entry.stage === stage)?.targetDays ?? '',
      ),
    );
  const [values, setValues] = useState(fromRevision);
  const [baseId, setBaseId] = useState(latest?.id);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const valid = values.every(
    (value) =>
      value !== '' &&
      Number.isInteger(Number(value)) &&
      Number(value) >= 1 &&
      Number(value) <= 365,
  );
  const stale = latest?.id !== baseId;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || stale || !canEdit || saving || !note.trim()) return;
        const draft: StageDurationRevision = {
          id: crypto.randomUUID(),
          productTypeId: product.id,
          updatedAt: new Date().toISOString(),
          updatedBy: '',
          note: note.trim(),
          stages: stages.map((stage, index) => ({
            stage,
            targetDays: Number(values[index]),
          })),
        };
        void onSave(draft, baseId).then((success) => {
          if (success) {
            setBaseId(draft.id);
            setNote('');
            setMessage('저장했습니다. 앞으로 시작하는 단계부터 적용됩니다.');
          } else
            setMessage(
              '저장하지 못했습니다. 권한·입력값·다른 창의 변경 여부를 확인하세요.',
            );
        });
      }}
    >
      <div className="stage-duration-actions">
        <span>
          {latest
            ? `최근 저장: ${new Date(latest.updatedAt).toLocaleString()}`
            : '표준 기간 미설정 · 자동 목표일을 만들지 않습니다.'}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit || saving}
          onClick={() => {
            setValues(product.example.map(String));
            setMessage(
              '예시 기간을 불러왔습니다. 검토 후 저장해야 적용됩니다.',
            );
          }}
        >
          예시 불러오기
        </Button>
      </div>
      <div className="stage-duration-table">
        <table>
          <thead>
            <tr>
              <th>개발 단계</th>
              <th>표준 기간</th>
              <th>기준</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => (
              <tr key={stage}>
                <td>
                  {String(index + 1).padStart(2, '0')} · {stage}
                </td>
                <td>
                  <Input
                    aria-label={`${stage} 표준 기간`}
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    required
                    value={values[index] ?? ''}
                    disabled={!canEdit || saving}
                    onChange={(event) => {
                      const value = event.target.value;
                      setValues((current) =>
                        current.map((entry, item) =>
                          item === index ? value : entry,
                        ),
                      );
                      setMessage('');
                    }}
                  />{' '}
                  일
                </td>
                <td>
                  {stage === 'Sample'
                    ? '제작·운송·검수 포함'
                    : '단계 시작일부터 계산'}
                </td>
              </tr>
            ))}
            <tr>
              <td>개발 완료</td>
              <td>—</td>
              <td>완료 상태 · 기간 없음</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="stage-duration-total">
        <span>순차 진행 합계 · 재작업 제외</span>
        <strong>
          {valid
            ? `${String(values.reduce((sum, value) => sum + Number(value), 0))}일`
            : '각 단계에 1~365일을 입력하세요'}
        </strong>
      </div>
      <label className="stage-duration-reason">
        변경 사유
        <Input
          value={note}
          maxLength={500}
          required
          disabled={!canEdit || saving}
          placeholder="예: 공급업체 샘플 리드타임 반영"
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      <div className="stage-duration-actions">
        <p>
          앞으로 시작하는 단계에만 적용합니다.
          <br />
          진행 중·완료 단계의 목표일과 전체 프로젝트 납기는 유지됩니다.
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setValues(fromRevision());
              setBaseId(latest?.id);
              setNote('');
              setMessage('최신 저장값을 불러왔습니다.');
            }}
          >
            저장값 불러오기
          </Button>{' '}
          <Button
            type="submit"
            disabled={!canEdit || saving || stale || !valid || !note.trim()}
          >
            {saving ? '저장 중…' : '변경 저장'}
          </Button>
        </div>
      </div>
      {stale && (
        <p role="alert">
          기준이 다른 창에서 변경되었습니다. 저장값을 다시 불러오세요.
        </p>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
