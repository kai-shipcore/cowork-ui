import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { today } from '@/modules/operations/operations-model';
import { useWorkbenchStore } from '@/app/workbench-store';
import { reportPeriod, summarizePerformance } from './performance-model';
import { useRdRecords } from './use-rd-records';
import './rd-workspace.css';

const targetsSchema = z.record(
  z.string(),
  z.object({
    cycle: z.number().positive(),
    completions: z.number().int().positive(),
  }),
);
const EMPTY_TARGETS: z.infer<typeof targetsSchema> = {};

/** Operational measurements use recorded dates; commercial KPIs remain explicitly unconnected. */
export function RdPerformance(): ReactElement {
  const { projects } = useWorkbenchStore();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mode, setMode] = useState('quarter');
  const [product, setProduct] = useState('전체');
  const { records, save, error, saving } = useRdRecords(
    'coverland-rd-targets-v1',
    targetsSchema,
    EMPTY_TARGETS,
  );
  const [message, setMessage] = useState('');
  const period = reportPeriod(month, mode);
  const report = summarizePerformance(
    projects.filter(
      (project) => product === '전체' || project.product === product,
    ),
    period.start,
    period.end,
  );
  const key = period.start + ':' + period.end + ':' + product;
  const targets = new Map(Object.entries(records)).get(key);
  return (
    <div className="rd-workspace">
      <div className="rd-panel">
        <div className="rd-toolbar">
          <h2>R&D 성과</h2>
          <label>
            기준 월
            <input
              type="month"
              min="1900-01"
              max="9998-12"
              required
              value={month}
              onChange={(event) => {
                if (
                  /^\d{4}-\d{2}$/.test(event.target.value) &&
                  event.target.value >= '1900-01' &&
                  event.target.value <= '9998-12'
                )
                  setMonth(event.target.value);
              }}
            />
          </label>
          <label>
            집계 단위
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
              }}
            >
              <option value="month">월</option>
              <option value="quarter">분기</option>
              <option value="year">연도</option>
            </select>
          </label>
          <label>
            제품
            <select
              value={product}
              onChange={(event) => {
                setProduct(event.target.value);
              }}
            >
              <option>전체</option>
              <option>Seat Cover</option>
              <option>Floor Mat</option>
              <option>Car Cover</option>
            </select>
          </label>
        </div>
        <p>
          {period.start} 이상 ~ {period.end} 미만 · 프로젝트 수는 Configuration
          × Zone 기준 · 현재 브라우저 기록
        </p>
        <div className="rd-fields">
          <div className="rd-panel">
            <small>개발 소요기간 중앙값</small>
            <h1>
              {report.cycleMedian === undefined
                ? '—'
                : report.cycleMedian.toFixed(1) + '일'}
            </h1>
            <p>
              단계 시작 이력 → 생산 인계 완료 · 유효 기록 {report.cycleSamples}
              건{targets && ` / 목표 ${String(targets.cycle)}일`}
            </p>
            {targets && report.cycleMedian !== undefined && (
              <p>
                목표 대비 {(report.cycleMedian - targets.cycle).toFixed(1)}일{' '}
                {report.cycleMedian <= targets.cycle ? '· 목표 이내' : '· 초과'}
              </p>
            )}
          </div>
          <div className="rd-panel">
            <small>생산 인계 완료</small>
            <h1>{report.completed}건</h1>
            <p>
              {targets
                ? `목표 ${String(targets.completions)}건 · 달성률 ${String(Math.round((report.completed / targets.completions) * 100))}%`
                : '비교 목표를 설정하세요.'}
            </p>
          </div>
          <div className="rd-panel">
            <small>판매 대비 컴플레인율</small>
            <h2>CS · 판매 데이터 미연결</h2>
            <p>모수 없이 비율을 추정하지 않습니다.</p>
          </div>
          <div className="rd-panel">
            <small>출시 후 90일 판매량</small>
            <h2>판매 채널 미연결</h2>
            <p>출시일과 주문 데이터 연결 후 집계합니다.</p>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm">
            이 기간·제품의 비교 목표 설정
          </summary>
          <form
            key={key + JSON.stringify(targets)}
            className="rd-fields mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const cycle = Number(data.get('cycle'));
              const completions = Number(data.get('completions'));
              void save((current) => ({
                ...current,
                [key]: { cycle, completions },
              })).then((ok) => {
                if (ok) setMessage('비교 목표를 저장했습니다.');
              });
            }}
          >
            <label>
              소요기간 목표 (일)
              <input
                type="number"
                name="cycle"
                min={1}
                step="0.1"
                required
                defaultValue={targets?.cycle}
              />
            </label>
            <label>
              완료 목표 (건)
              <input
                type="number"
                name="completions"
                min={1}
                step={1}
                required
                defaultValue={targets?.completions}
              />
            </label>
            <Button type="submit" disabled={saving}>
              목표 저장
            </Button>
          </form>
          <p>
            로컬 비교용 목표이며 전사 정책이나 개인 권한을 변경하지 않습니다.
          </p>
        </details>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
      </div>
      <div className="rd-panel">
        <h2>단계별 소요기간 · 완료된 단계 기준</h2>
        <p>
          각 단계의 실제 완료일이 선택 기간에 포함된 기록만 사용합니다. 진행 중
          단계와 누락된 이력은 제외합니다.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>단계</th>
                <th>중앙값 (일)</th>
                <th>완료 기록</th>
              </tr>
            </thead>
            <tbody>
              {report.stages.map((stage) => (
                <tr key={stage.stage}>
                  <td>{stage.stage}</td>
                  <td>{stage.days?.toFixed(1)}</td>
                  <td>{stage.count}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.stages.length && (
          <p className="rd-empty">이 기간에 완료된 단계 이력이 없습니다.</p>
        )}
      </div>
      <div className="rd-panel">
        <h2>집계에 포함된 생산 인계</h2>
        {report.completedProjects.map(({ project, zone }) => (
          <div className="rd-toolbar" key={zone.id}>
            <Link
              to={
                '/vehicle-projects?project=' + project.id + '&zone=' + zone.code
              }
            >
              {project.vehicle} · {zone.label}
            </Link>
            <small>{zone.productionHandoff?.completedAt.slice(0, 10)}</small>
          </div>
        ))}
        {!report.completed && (
          <p>
            완료 기록이 없습니다. 기존 데이터에 날짜가 없으면 임의로 채우지
            않습니다.
          </p>
        )}
      </div>
    </div>
  );
}
