import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectVisit } from '@/shared/types/workbench';
import { defaultVisitType, visitHistory } from './visit-history';

const visit = (id: string, date: string, type: ProjectVisit['type'], status: ProjectVisit['status'], result?: 'PASS' | 'FAIL'): ProjectVisit => ({
  id, date, type, status, result, time: '10:00', dealer: 'Dealer', vehicleProjectIds: ['P-B'], staffIds: [],
});
test('project stage selects workflow tab and Car Cover never defaults to Scan', () => {
  assert.equal(defaultVisitType('Seat Cover','Scan'),'SCAN');
  assert.equal(defaultVisitType('Floor Mat','Fitting'),'FITTING');
  assert.equal(defaultVisitType('Seat Cover','Approved'),'FITTING');
  assert.equal(defaultVisitType('Car Cover','Research'),'FITTING');
});
test('visit history separates work, hides cancellation, and numbers completed fittings chronologically', () => {
  const rows = [visit('pass','2026-09-16','FITTING','COMPLETED','PASS'),visit('scan','2026-09-10','SCAN','COMPLETED'),visit('cancel','2026-09-17','FITTING','CANCELLED'),visit('fail','2026-09-14','FITTING','COMPLETED','FAIL')];
  const result = visitHistory(rows,'FITTING',false);
  assert.deepEqual(result.past.map(v=>v.id),['pass','fail']);
  assert.equal(result.latest?.result,'PASS');
  assert.equal(result.rounds.get('fail'),1);
  assert.equal(result.rounds.get('pass'),2);
  assert.equal(result.cancelled,1);
  assert.equal(visitHistory(rows,'FITTING',true).past[0].id,'cancel');
  assert.equal(visitHistory(rows,'FITTING',true).latest?.id,'pass');
  assert.equal(rows[0].id,'pass');
});
test('upcoming uses nearest schedule; completed uses actual performance time', () => {
  const rows = [visit('later','2026-09-22','SCAN','SCHEDULED'),visit('near','2026-09-18','SCAN','SCHEDULED'),{...visit('performed','2026-09-01','SCAN','COMPLETED'),performedAt:'2026-09-17T10:00:00'},visit('other','2026-09-16','SCAN','COMPLETED')];
  const result = visitHistory(rows,'SCAN',false);
  assert.deepEqual(result.upcoming.map(v=>v.id),['near','later']);
  assert.equal(result.latest?.id,'performed');
  assert.equal(visitHistory([],'SCAN',false).latest,undefined);
});
