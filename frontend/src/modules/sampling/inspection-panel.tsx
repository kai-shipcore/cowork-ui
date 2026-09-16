import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  inspectionErrors,
  sampleStatus,
} from '@/shared/domain/sample-inspection';
import type { SampleRequestItem } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import '@/modules/product-shapes/shape-management.css';

export function InspectionPanel() {
  const {
    sampleRequestItems,
    sampleRequests,
    sampleShipments,
    appUsers,
    updateWorkbench,
  } = useWorkbenchStore();
  const [selected, setSelected] = useState('');
  const [drawing, setDrawing] = useState('');
  const [reflected, setReflected] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const item = sampleRequestItems.find((row) => row.id === selected);
  const save = () => {
    if (!item) return;
    const next: SampleRequestItem = {
      ...item,
      drawingMatch: drawing === '' ? undefined : drawing === 'YES',
      revisionReflected: (reflected ||
        undefined) as SampleRequestItem['revisionReflected'],
      inspectedAt: new Date().toISOString(),
      inspectedBy: CURRENT_USER_ID,
      inspectionNote: note.trim(),
    };
    const errors = inspectionErrors(next);
    if (
      !appUsers.some(
        (user) => user.id === CURRENT_USER_ID && user.status === 'ACTIVE',
      )
    )
      errors.push('활성 검수자 계정이 필요합니다.');
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    updateWorkbench((state) => ({
      ...state,
      sampleRequestItems: state.sampleRequestItems.map((row) =>
        row.id === next.id ? next : row,
      ),
    }));
    setMessage(`검수 저장: ${sampleStatus(next)}`);
  };
  return (
    <section className="shape-section">
      <h3>항목별 입고·검수</h3>
      <p>
        도면 준비와 샘플 검수는 별도입니다. 최초 차수는 수정 반영을 비워 둘 수
        있습니다.
      </p>
      <label>
        요청 항목{' '}
        <select
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setDrawing('');
            setReflected('');
            setNote('');
            setMessage('');
          }}
        >
          <option value="">선택</option>
          {sampleRequestItems.map((row) => (
            <option key={row.id} value={row.id}>
              {row.sampleRequestId} · {row.vehicleProductDesignId} ·{' '}
              {row.sampleRound}차 · {sampleStatus(row)}
            </option>
          ))}
        </select>
      </label>
      {item && (
        <>
          <p>
            {
              sampleRequests.find(
                (request) => request.id === item.sampleRequestId,
              )?.factory
            }{' '}
            · Revision {item.vehicleProductDesignRevisionId} · 입고{' '}
            {item.sampleReceivedAt ?? '미입고'}
          </p>
          {!item.productionStartedAt && !item.sampleShipmentId && (
            <Button
              variant="outline"
              disabled={
                !sampleRequests.find(
                  (request) => request.id === item.sampleRequestId,
                )?.sentAt
              }
              onClick={() => {
                updateWorkbench((state) => ({
                  ...state,
                  sampleRequestItems: state.sampleRequestItems.map((row) =>
                    row.id === item.id && !row.productionStartedAt
                      ? {
                          ...row,
                          productionStartedAt: new Date().toISOString(),
                        }
                      : row,
                  ),
                }));
              }}
            >
              이 항목 생산 시작
            </Button>
          )}
          {!item.sampleReceivedAt && (
            <Button
              variant="outline"
              disabled={
                !sampleShipments.some(
                  (shipment) =>
                    shipment.id === item.sampleShipmentId &&
                    shipment.shippedAt &&
                    Date.parse(shipment.shippedAt) <= Date.now(),
                )
              }
              onClick={() => {
                updateWorkbench((state) => ({
                  ...state,
                  sampleRequestItems: state.sampleRequestItems.map((row) =>
                    row.id === item.id &&
                    !row.sampleReceivedAt &&
                    state.sampleShipments.some(
                      (shipment) =>
                        shipment.id === row.sampleShipmentId &&
                        shipment.shippedAt &&
                        Date.parse(shipment.shippedAt) <= Date.now(),
                    )
                      ? { ...row, sampleReceivedAt: new Date().toISOString() }
                      : row,
                  ),
                }));
              }}
            >
              이 항목 입고 확인
            </Button>
          )}
          <label>
            도면 일치{' '}
            <select
              value={drawing}
              onChange={(event) => {
                setDrawing(event.target.value);
              }}
            >
              <option value="">선택</option>
              <option value="YES">일치</option>
              <option value="NO">불일치 · 공장 문제</option>
            </select>
          </label>
          <label>
            수정 반영{' '}
            <select
              value={reflected}
              onChange={(event) => {
                setReflected(event.target.value);
              }}
            >
              <option value="">미판정 / 최초 차수 해당 없음</option>
              <option value="CORRECT">정확히 반영</option>
              <option value="PARTIAL">일부 반영</option>
              <option value="NOT_REFLECTED">미반영</option>
            </select>
          </label>
          <label>
            검수 사유{' '}
            <input
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </label>
          <Button disabled={!item.sampleReceivedAt} onClick={save}>
            검수 저장
          </Button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
