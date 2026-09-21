import {
  createRequest,
  type OperationsSnapshot,
  type RequestDraft,
} from './operations-model';

/** Fictitious requests for exercising cross-team handoffs. */
export function createOperationsSeed(): OperationsSnapshot {
  const at = new Date().toISOString();
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const drafts: { actor: string; draft: RequestDraft }[] = [
    {
      actor: 'cs-member',
      draft: {
        title: '[Demo] 반복 핏 불만 조사 요청',
        description:
          '고객 문의에서 동일 증상이 반복되었습니다. 적합 차량 정보와 개선 필요 여부를 확인하고 결과를 회신해 주세요.',
        sourceTeam: 'customer-services',
        targetTeam: 'rd',
        assigneeId: 'rd-member',
        reviewerId: 'USR-KAI',
        priority: 'high',
        dueDate: due,
        category: '품질 조사',
        reference: '데모 케이스 CS-001',
        referencePath: '',
      },
    },
    {
      actor: 'USR-KAI',
      draft: {
        title: '[Demo] 개발 완료 상품 출시 인계',
        description:
          '상품 사진, 적합 차량, 승인 자료를 검토한 뒤 리스팅 준비를 진행해 주세요.',
        sourceTeam: 'rd',
        targetTeam: 'ecommerce',
        assigneeId: 'commerce-member',
        reviewerId: 'commerce-lead',
        priority: 'normal',
        dueDate: due,
        category: '출시 인계',
        reference: '데모 상품',
        referencePath: '',
      },
    },
    {
      actor: 'commerce-member',
      draft: {
        title: '[Demo] 프로모션 재고 확보 요청',
        description:
          '프로모션 일정에 맞춰 가용 재고와 입고 가능 수량을 확인해 주세요.',
        sourceTeam: 'ecommerce',
        targetTeam: 'demand-planning',
        assigneeId: 'planning-member',
        reviewerId: 'planning-lead',
        priority: 'urgent',
        dueDate: due,
        category: '재고 확보',
        reference: '데모 프로모션',
        referencePath: '',
      },
    },
    {
      actor: 'planning-member',
      draft: {
        title: '[Demo] 신규 차량 제품 개발 검토',
        description:
          '수요 근거와 목표 출시 일정을 검토하고 개발 가능 여부를 회신해 주세요.',
        sourceTeam: 'demand-planning',
        targetTeam: 'rd',
        assigneeId: 'rd-member',
        reviewerId: 'USR-KAI',
        priority: 'normal',
        dueDate: due,
        category: '개발 요청',
        reference: '데모 수요 계획',
        referencePath: '',
      },
    },
  ];
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: at,
    requests: drafts.map(({ actor, draft }, index) =>
      createRequest(draft, actor, 'DEMO-' + String(index + 1), at),
    ),
  };
}
