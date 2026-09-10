import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input } from '@coverland-engineering/ui/input';
import type { VehicleProductShape } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import { isSizeReviewCurrent } from './shape-model';

export function ShapeCompositionEditor({
  shape,
  onClose,
}: {
  shape: VehicleProductShape;
  onClose: () => void;
}) {
  const { projectDetails, projects, setVehicleProductShapes } =
    useWorkbenchStore();
  const sources = projects.flatMap((project) =>
    (projectDetails[project.id]?.zones ?? [])
      .filter(
        (zone) =>
          zone.productShapeId === shape.id &&
          isSizeReviewCurrent(
            zone,
            projectDetails[project.id].designs,
            projectDetails[project.id].visits,
          ),
      )
      .map((zone) => ({ project, zone })),
  );
  const [sourceId, setSourceId] = useState(
    shape.composition?.sourceZoneId ?? sources[0]?.zone.id ?? '',
  );
  const [blueprint, setBlueprint] = useState(
    shape.composition?.blueprintUrl ?? '',
  );
  const [parts, setParts] = useState(shape.composition?.parts ?? []);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const source = sources.find(({ zone }) => zone.id === sourceId);
  const approvedParts = source
    ? projectDetails[source.project.id].designs
        .filter(
          (part) =>
            part.vehicleProjectId === source.zone.id &&
            part.status === 'ACTIVE',
        )
        .map((part) => {
          const revision = [...part.revisions].sort(
            (a, b) => b.revisionNumber - a.revisionNumber,
          )[0];
          return {
            designId: part.id,
            partId: part.libraryPartId,
            name: part.name,
            revisionId: revision?.id ?? '',
            revisionNumber: revision?.revisionNumber ?? 0,
            quantity: part.quantity,
          };
        })
    : [];
  const validUrl = (() => {
    try {
      return ['http:', 'https:'].includes(new URL(blueprint.trim()).protocol);
    } catch {
      return false;
    }
  })();
  const matches =
    parts.length > 0 && JSON.stringify(parts) === JSON.stringify(approvedParts);
  const save = (complete: boolean) => {
    if (!source || (complete && (!matches || !validUrl || !confirmed))) return;
    setVehicleProductShapes((current) =>
      current.map((item) =>
        item.id === shape.id
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              composition: {
                sourceProjectId: source.project.id,
                sourceZoneId: source.zone.id,
                parts,
                blueprintUrl: blueprint.trim(),
                status: complete ? 'COMPLETE' : 'DRAFT',
                updatedAt: new Date().toISOString(),
                updatedBy: CURRENT_USER_ID,
              },
            }
          : item,
      ),
    );
    setMessage(
      complete ? '구성 등록이 완료되었습니다.' : '작성 중으로 저장했습니다.',
    );
  };
  return (
    <section className="shape-section shape-composition-editor">
      <h3>{shape.name} 구성 등록</h3>
      <p>
        담당: Pattern Designer. 승인된 모든 Part 이름·버전·수량을 등록하고, 전체
        패턴 조각을 한 장에 배치한 Blueprint를 연결합니다.
      </p>
      <div className="shape-composition-source">
        <label className="shape-composition-field">
          승인된 원본 프로젝트
          <select
            aria-label="구성 원본 프로젝트"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
              setParts([]);
              setConfirmed(false);
            }}
          >
            <option value="">프로젝트 선택</option>
            {sources.map(({ project, zone }) => (
              <option key={zone.id} value={zone.id}>
                {project.vehicle} · {zone.code}
              </option>
            ))}
          </select>
        </label>
        <div className="shape-actions">
          <Button
            variant="outline"
            disabled={!source}
            onClick={() => {
              setParts(approvedParts);
              setConfirmed(false);
            }}
          >
            승인된 전체 Part 목록 가져오기
          </Button>
        </div>
      </div>
      {!sources.length && (
        <p className="shape-errors">
          유효한 검토 승인을 마치고 이 Shape에 연결된 프로젝트가 필요합니다.
        </p>
      )}
      <div className="shape-composition-table-heading">
        <h4>Part 구성</h4>
        <span>{parts.length} Parts</span>
      </div>
      <div className="shape-table-scroll">
        <table className="shape-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Revision</th>
              <th>수량</th>
            </tr>
          </thead>
          <tbody>
            {!parts.length && (
              <tr>
                <td colSpan={3} className="shape-composition-empty">
                  원본 프로젝트를 선택하고 승인된 Part 목록을 가져오세요.
                </td>
              </tr>
            )}
            {parts.map((part) => (
              <tr key={part.designId}>
                <td>{part.name}</td>
                <td>{part.revisionNumber}</td>
                <td>{part.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!matches && (
        <p className="shape-errors">
          최신 승인 구성의 모든 Part를 가져와야 완료할 수 있습니다.
        </p>
      )}
      <div className="shape-composition-blueprint">
        <label className="shape-composition-field">
          전체 Blueprint 이미지 / 문서 링크
          <Input
            value={blueprint}
            onChange={(event) => {
              setBlueprint(event.target.value);
              setConfirmed(false);
            }}
            placeholder="https://drive.google.com/..."
          />
        </label>
        {validUrl ? (
          <a href={blueprint.trim()} target="_blank" rel="noreferrer">
            Blueprint 열어 확인 ↗
          </a>
        ) : (
          <p>열 수 있는 http 또는 https 링크를 입력하세요.</p>
        )}
      </div>
      <label className="shape-check">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(value) => setConfirmed(value === true)}
        />
        전체 Part 목록과 Blueprint가 일치하며 링크가 열리는지 확인했습니다.
        저장하면 이 Shape를 사용하는 프로젝트가 같은 구성을 참조합니다.
      </label>
      <div className="shape-actions shape-composition-footer">
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button
          variant="outline"
          disabled={!source}
          onClick={() => save(false)}
        >
          임시 저장
        </Button>
        <Button
          variant="primary"
          disabled={!source || !matches || !validUrl || !confirmed}
          onClick={() => save(true)}
        >
          구성 등록 완료
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
