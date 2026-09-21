import { useState, type SyntheticEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  PEOPLE,
  requestLink,
  TEAM_IDS,
  TEAM_NAMES,
  type TeamId,
} from './operations-model';

const TEMPLATES = [
  {
    title: 'CS → R&D 품질 조사',
    team: 'rd',
    category: '품질 조사',
    description:
      '고객 증상:\n해당 차량/제품:\n발생 빈도:\n필요한 조사 및 회신:',
  },
  {
    title: 'R&D → eCommerce 출시 인계',
    team: 'ecommerce',
    category: '출시 인계',
    description:
      '개발 완료 범위:\n적합 차량:\n상품 사진/승인 자료:\n출시 목표일:',
  },
  {
    title: 'Planning → R&D 개발 요청',
    team: 'rd',
    category: '개발 요청',
    description: '수요 근거:\n예상 수량:\n대상 차량/제품:\n목표 출시일:',
  },
  {
    title: 'eCommerce → Planning 재고 확보',
    team: 'demand-planning',
    category: '재고 확보',
    description: '판매 채널:\n프로모션 일정:\n예상 판매량:\n필요 입고일:',
  },
] as const;

export function RequestForm({ team }: { team: TeamId }) {
  const { actor, add, saving } = useOperations();
  const { projects, masterProducts } = useWorkbenchStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [targetTeam, setTargetTeam] = useState<TeamId>('rd');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('일반 요청');
  const [referenceId, setReferenceId] = useState(params.get('reference') ?? '');

  function formText(data: FormData, key: string): string {
    const value = data.get(key);
    return typeof value === 'string' ? value : '';
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const references = [
      ...projects.map((entry) => ({
        id: entry.id,
        label: entry.id + ' · ' + entry.vehicle,
        path: '/vehicle-projects?project=' + encodeURIComponent(entry.id),
      })),
      ...masterProducts.map((entry) => ({
        id: entry.id,
        label: entry.sku + ' · ' + entry.fNumber,
        path: '/products?product=' + encodeURIComponent(entry.id),
      })),
    ];
    const reference = references.find((entry) => entry.id === referenceId);
    const priority = form.get('priority');
    const id = await add({
      title: formText(form, 'title'),
      description,
      sourceTeam: actor.team,
      targetTeam,
      assigneeId: formText(form, 'assignee'),
      reviewerId: formText(form, 'reviewer'),
      dueDate: formText(form, 'due'),
      priority:
        priority === 'urgent' || priority === 'high' ? priority : 'normal',
      category,
      reference: reference?.label ?? formText(form, 'reference'),
      referencePath: reference?.path ?? '',
    });
    if (id) void navigate(requestLink(id, team));
  }

  return (
    <form
      className="ops-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h2>팀 간 업무 요청</h2>
      <p>
        요청 팀: {TEAM_NAMES[actor.team]} · 등록 후 수신 담당자가 접수하고 지정
        검토자가 완료를 승인합니다.
      </p>
      <label>
        요청 템플릿
        <select
          defaultValue=""
          onChange={(event) => {
            const template = TEMPLATES.find(
              (entry) => entry.title === event.target.value,
            );
            if (template) {
              setTargetTeam(template.team);
              setCategory(template.category);
              setDescription(template.description);
            }
          }}
        >
          <option value="">직접 작성</option>
          {TEMPLATES.map((template) => (
            <option key={template.title}>{template.title}</option>
          ))}
        </select>
      </label>
      <label>
        제목
        <Input name="title" required maxLength={160} />
      </label>
      <div className="ops-two">
        <label>
          수신 팀
          <select
            value={targetTeam}
            onChange={(event) => {
              const id = TEAM_IDS.find((entry) => entry === event.target.value);
              if (id) setTargetTeam(id);
            }}
          >
            {TEAM_IDS.map((id) => (
              <option key={id} value={id}>
                {TEAM_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          업무 유형
          <Input
            value={category}
            required
            maxLength={80}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          />
        </label>
        <label>
          처리 담당자
          <select
            key={'assignee-' + targetTeam}
            name="assignee"
            required
            defaultValue={
              PEOPLE.find(
                (person) =>
                  person.team === targetTeam && person.role === 'member',
              )?.id
            }
          >
            {PEOPLE.filter(
              (person) =>
                person.team === targetTeam && person.role === 'member',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          완료 검토자
          <select key={'reviewer-' + targetTeam} name="reviewer" required>
            {PEOPLE.filter(
              (person) => person.team === targetTeam && person.role === 'lead',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          마감일 (Los Angeles)
          <Input name="due" type="date" required />
        </label>
        <label>
          우선순위
          <select name="priority">
            <option value="normal">보통</option>
            <option value="high">높음</option>
            <option value="urgent">긴급</option>
          </select>
        </label>
      </div>
      <label>
        관련 프로젝트 / SKU
        <select
          value={referenceId}
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        >
          <option value="">직접 참조 입력</option>
          <optgroup label="프로젝트">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.id} · {project.vehicle}
              </option>
            ))}
          </optgroup>
          <optgroup label="상품 SKU">
            {masterProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.fNumber}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {!referenceId && (
        <label>
          관련 SKU / 샘플 / CS 케이스
          <Input
            name="reference"
            maxLength={300}
            placeholder="식별번호와 이름"
          />
        </label>
      )}
      <label>
        요청 내용
        <textarea
          required
          maxLength={2000}
          rows={6}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <p>관련 문서와 첨부 링크는 요청 등록 후 추가할 수 있습니다.</p>
      <Button type="submit" disabled={saving}>
        {saving ? '저장 중…' : '요청 등록'}
      </Button>
    </form>
  );
}
