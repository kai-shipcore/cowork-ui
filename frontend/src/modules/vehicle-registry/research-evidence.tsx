import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import {
  EMPTY_RESEARCH_EVIDENCE,
  RESEARCH_EVIDENCE_KEY,
  researchEvidenceListSchema,
  researchEvidenceSchema,
  validateResearchEvidence,
} from './research-evidence-model';
import '@/modules/rd-workspace/rd-workspace.css';
import { formText } from '@/modules/rd-workspace/form-text';

interface ResearchEvidenceProps {
  configuration: VehicleConfiguration;
  configurations: readonly VehicleConfiguration[];
  onClose: () => void;
}

/** Evidence and decisions are append-only; no destructive configuration merge occurs here. */
export function ResearchEvidence({
  configuration,
  configurations,
  onClose,
}: ResearchEvidenceProps): ReactElement {
  const { actor } = useOperations();
  const { records, save, saving, error } = useRdRecords(
    RESEARCH_EVIDENCE_KEY,
    researchEvidenceListSchema,
    EMPTY_RESEARCH_EVIDENCE,
  );
  const history = records.filter(
    (record) => record.configurationId === configuration.id,
  );
  const latest = history.slice(-1).pop();
  const [photo, setPhoto] = useState(latest?.photo ?? '');
  const [photoName, setPhotoName] = useState(latest?.photoName ?? '');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  return (
    <section className="rd-workspace mb-5">
      <form
        className="rd-panel"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const result = researchEvidenceSchema.safeParse({
            id: crypto.randomUUID(),
            configurationId: configuration.id,
            checkedCount: Number(data.get('count')),
            sources: formText(data, 'sources')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            photo,
            photoName,
            decision: data.get('decision'),
            mergeTargetId: data.get('target'),
            reason: data.get('reason'),
            actor: actor.name,
            at: new Date().toISOString(),
          });
          if (!result.success) {
            setMessage(
              result.error.issues.map((issue) => issue.message).join(' / '),
            );
            return;
          }
          try {
            validateResearchEvidence(result.data, configurations);
          } catch (cause) {
            setMessage(
              cause instanceof Error ? cause.message : '입력값을 확인하세요.',
            );
            return;
          }
          void save((current) => [...current, result.data]).then((ok) => {
            if (ok) setMessage('조사 근거와 판단 이력을 저장했습니다.');
          });
        }}
      >
        <div className="rd-toolbar">
          <h2>
            조사 근거 · {configuration.vehicle} / {configuration.id}
          </h2>
          <Button type="button" variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
        <p>
          {configuration.options.map((option) => option.join(': ')).join(' · ')}
        </p>
        <div className="rd-fields">
          <label>
            확인한 매물·자료 건수
            <input
              type="number"
              name="count"
              min={0}
              step={1}
              required
              defaultValue={latest?.checkedCount ?? 0}
            />
          </label>
          <label>
            구성 판단
            <select
              name="decision"
              defaultValue={latest?.decision ?? '검토 중'}
            >
              <option>검토 중</option>
              <option>별도 구성 유지</option>
              <option>병합 제안</option>
            </select>
          </label>
          <label>
            병합 제안 대상
            <select name="target" defaultValue={latest?.mergeTargetId ?? ''}>
              <option value="">해당 없음</option>
              {configurations
                .filter(
                  (item) =>
                    item.vehicle === configuration.vehicle &&
                    item.id !== configuration.id,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} ·{' '}
                    {item.options.map((option) => option[1]).join(' / ')}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          출처 URL · 한 줄에 하나
          <textarea
            name="sources"
            rows={3}
            defaultValue={latest?.sources.join('\n')}
            placeholder="https://..."
          />
        </label>
        <label>
          증빙 사진 · PNG/JPEG/WebP, 1 MB 이하
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (
                !['image/png', 'image/jpeg', 'image/webp'].includes(
                  file.type,
                ) ||
                file.size > 1024 * 1024
              ) {
                setMessage('1 MB 이하의 PNG/JPEG/WebP 사진을 선택하세요.');
                return;
              }
              setReading(true);
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  setPhoto(reader.result);
                  setPhotoName(file.name);
                  setMessage('사진을 읽었습니다. 저장 버튼으로 기록하세요.');
                }
                setReading(false);
              };
              reader.onerror = () => {
                setMessage('사진을 읽지 못했습니다.');
                setReading(false);
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {photo && (
          <div>
            <img
              className="rd-photo"
              src={photo}
              alt={'조사 증빙: ' + photoName}
            />
            <small>{photoName}</small>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPhoto('');
                setPhotoName('');
              }}
            >
              새 기록에서 사진 제외
            </Button>
          </div>
        )}
        <label>
          관찰 내용 · 분리/병합 판단 근거
          <textarea
            name="reason"
            rows={3}
            required
            maxLength={2000}
            defaultValue={latest?.reason}
          />
        </label>
        <p className="rd-note">
          조사 건수는 담당자가 확인한 수량입니다. ‘10건 이상’ 같은 임의 기준을
          적용하지 않습니다. 병합 제안은 판단 기록이며 구성·기존 프로젝트를 자동
          병합하지 않습니다.
        </p>
        <Button type="submit" disabled={saving || reading}>
          조사 근거 저장
        </Button>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
        <h2>판단 이력 · {history.length}건</h2>
        {[...history].reverse().map((record) => (
          <details key={record.id}>
            <summary className="cursor-pointer text-sm">
              {record.at.slice(0, 16).replace('T', ' ')} · {record.actor} ·{' '}
              {record.decision} · {record.checkedCount}건 확인
            </summary>
            <p className="whitespace-pre-wrap">{record.reason}</p>
            {record.mergeTargetId && <p>제안 대상: {record.mergeTargetId}</p>}
            {record.sources.map((url) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </p>
            ))}
            {record.photo && (
              <img
                className="rd-photo"
                src={record.photo}
                alt={record.photoName}
              />
            )}
          </details>
        ))}
      </form>
    </section>
  );
}
