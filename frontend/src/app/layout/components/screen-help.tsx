import { CircleHelp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

type Guide = { title: string; purpose: string; steps: string[]; check: string };
const guides: Record<string, Guide> = {
  '/dashboard': {
    title: 'Home',
    purpose: '현재 밀린 업무와 다음에 처리할 일을 한눈에 확인합니다.',
    steps: [
      '요약 숫자와 경고 목록에서 확인할 업무를 찾습니다.',
      '해당 항목의 링크로 원래 프로젝트나 방문 화면을 엽니다.',
      '원래 화면에서 처리한 뒤 돌아와 상태 변화를 확인합니다.',
    ],
    check:
      '샘플 수령 후 피팅 미예약, 담당자 없는 방문, 인계 대기 등은 서로 다른 조치가 필요합니다.',
  },
  '/vehicle-research': {
    title: 'Vehicle Research',
    purpose: '어떤 차량과 옵션을 개발 대상으로 삼을지 정리합니다.',
    steps: [
      '연식·차종·옵션으로 대상 차량을 찾습니다.',
      '기존 조사 내용과 제품별 개발 상태를 확인합니다.',
      '개발할 제품과 구역(Zone)을 확인하고 연결된 프로젝트로 이동합니다.',
    ],
    check:
      '차종 이름이 같아도 좌석 구성이나 옵션이 다르면 적용 대상이 다를 수 있습니다.',
  },
  '/vehicle-projects': {
    title: 'Vehicle Projects',
    purpose: '차량·제품·구역별 개발을 스캔부터 Handoff까지 진행합니다.',
    steps: [
      '목록에서 프로젝트를 선택하고 대상 Zone을 확인합니다.',
      'Overview에서 현재 단계와 다음 작업 안내를 확인합니다.',
      'Visits: 스캔 방문을 예약하고 결과를 기록합니다. 샘플 이후의 피팅 방문도 여기서 관리합니다.',
      'Parts: 개발할 부품과 현재 Revision(수정 버전)을 확인합니다.',
      'Samples: 샘플을 요청하고 배송·수령 및 현재 버전의 승인 여부를 확인합니다.',
      'Revision Control: 샘플 검증이나 피팅에서 수정이 필요하면 새 버전을 기록하고 다시 샘플을 요청합니다.',
      'Files: 필요한 자료를 확인합니다. Handoff는 단계 안내의 체크리스트에서 자료와 확인 항목을 채워 완료합니다.',
      'Activity: 진행 이력을 확인합니다. 개발 완료 뒤에는 별도 Shape 메뉴에서 검토·발급합니다.',
    ],
    check:
      '탭 순서는 참고 흐름입니다. 피팅과 수정은 반복됩니다. 버튼이 막히면 현재 Zone·현재 Revision·필수 자료와 단계 안내를 먼저 확인하세요. Shape 발급은 개발 완료의 선행 조건이 아닙니다.',
  },
  '/parts': {
    title: 'Part Management',
    purpose: '재사용하는 부품 이름과 수정 버전을 조회·관리합니다.',
    steps: [
      '제품 종류와 부품 조건으로 기존 Part를 먼저 찾습니다.',
      '새 부품이 필요하면 생성기에 필요한 코드를 선택합니다.',
      '부품의 Revision과 변경 요청·검증 기록을 확인합니다.',
    ],
    check:
      'Part는 구성 부품이고 Shape는 최종 공식 번호입니다. 부품을 만들었다고 프로젝트의 구성 연결까지 완료되는 것은 아닙니다.',
  },
  '/product-shapes': {
    title: 'Shape',
    purpose:
      '개발 완료 후 최종 검토를 거쳐 공식 Shape 번호와 제품 구성을 관리합니다.',
    steps: [
      '검토 대기에서 Handoff가 끝난 프로젝트와 Zone을 선택합니다.',
      '회의 정보·참석자와 피팅 결과·Blueprint·최종 부품 목록을 검토하고 승인 또는 반려를 기록합니다.',
      '승인 후 Shape를 발급하거나 허용된 기존 Shape를 연결합니다.',
      '발급된 Shape에서 Part 이름·버전·수량과 전체 Blueprint 링크를 등록하고 구성 완료를 확인합니다.',
    ],
    check:
      'Shape와 Size Number는 같은 개념입니다. 문서 보완은 재확인, 패턴 재작업은 원래 프로젝트의 새 샘플 요청부터 다시 진행합니다. 발급과 구성 완료는 별도입니다.',
  },
  '/hunt-board': {
    title: 'Hunt Board',
    purpose: '스캔·피팅에 필요한 실제 차량 확보와 방문 준비를 확인합니다.',
    steps: [
      '대상 차량과 프로젝트를 찾습니다.',
      '차량 확보 상황과 방문 관련 정보를 확인합니다.',
      '실제 스캔·피팅 일정과 결과는 프로젝트의 Visits에서 기록합니다.',
    ],
    check:
      '차량 확보와 방문 완료는 다릅니다. 예약만으로 스캔이나 피팅을 완료 처리하지 마세요.',
  },
  '/samples': {
    title: 'Sample Tracker',
    purpose: '여러 프로젝트의 샘플 요청·배송·수령을 모아서 추적합니다.',
    steps: [
      '프로젝트·공장·요청 번호로 검색합니다.',
      'Send Request → Create Shipment → Mark Arrived 순으로 실제 진행에 맞게 처리합니다.',
      '수령 후 원래 프로젝트에서 해당 부품의 현재 Revision을 검증·승인합니다.',
    ],
    check:
      '배송 도착은 품질 승인이 아닙니다. 이전 Revision 샘플을 받았어도 현재 Revision의 조건은 별도로 확인해야 합니다.',
  },
  '/unique-vehicles': {
    title: 'Unique Vehicles / F#',
    purpose: '적용 차량의 고유 구성과 F#를 확인합니다.',
    steps: [
      '차량과 옵션 조합을 검색합니다.',
      '구역과 연결된 개발·제품 정보를 확인합니다.',
      '제품 등록에 사용할 차량 구성이 맞는지 대조합니다.',
    ],
    check:
      'F#와 Shape는 서로 다른 정보를 나타냅니다. 번호가 있다고 모든 제품의 개발이 완료된 것은 아닙니다.',
  },
  '/products': {
    title: 'Product Catalog',
    purpose: '등록된 제품과 SKU 정보를 찾고 적용 대상을 확인합니다.',
    steps: [
      '제품 종류나 SKU로 검색합니다.',
      '제품의 상태와 적용 차량·구성 정보를 확인합니다.',
      '새 등록이나 승인 업무는 Product Registrations에서 확인합니다.',
    ],
    check: '개발 완료, Shape 구성 완료, 제품 등록 승인은 각각 별도 상태입니다.',
  },
  '/product-registrations': {
    title: 'Product Registrations',
    purpose: '제품 등록 요청을 검토하고 승인합니다.',
    steps: [
      '승인 대기 요청을 선택합니다.',
      '요청에 포함된 제품·SKU·차량과 구성 정보를 확인합니다.',
      '검토 결과를 기록하고 승인한 뒤 승인 완료 목록과 Catalog를 확인합니다.',
    ],
    check:
      'Shape 발급 승인과 제품 등록 승인을 혼동하지 마세요. 실제 공장 전달이나 외부 시스템 반영 여부는 별도 확인이 필요합니다.',
  },
  '/vehicle-options': {
    title: 'Vehicle Options',
    purpose: '차량 구성을 구분하는 옵션 기준을 관리합니다.',
    steps: [
      '대상 옵션 종류와 기존 값을 찾습니다.',
      '중복된 값이 없는지 확인하고 필요한 항목을 관리합니다.',
      '차량 조사와 프로젝트에서 같은 의미로 사용되는지 확인합니다.',
    ],
    check:
      '공용 기준값입니다. 리뷰에서는 새 시험용 값으로 확인하고 기존 값 변경의 영향을 검토하세요.',
  },
  '/reference-data': {
    title: 'Reference Data',
    purpose: '부품·제품 등에 사용하는 공통 코드와 기준 정보를 관리합니다.',
    steps: [
      '관리할 기준 정보 탭을 선택합니다.',
      '기존 코드와 명칭을 먼저 검색합니다.',
      '필요한 값을 등록하고 이를 사용하는 화면에서 선택 가능한지 확인합니다.',
    ],
    check:
      '코드 의미와 중복 여부를 먼저 합의하세요. 공통 코드 변경은 여러 화면에 영향을 줄 수 있습니다.',
  },
  '/rework-complaints': {
    title: 'Rework / Complaints',
    purpose: '품질 문제와 재작업 관련 정보를 확인합니다.',
    steps: [
      '대상 차량·제품의 문제 기록을 찾습니다.',
      '원인과 관련 프로젝트를 확인합니다.',
      '패턴 수정이 필요하면 원래 프로젝트의 Revision 및 샘플 이력과 함께 검토합니다.',
    ],
    check:
      '문제 기록을 남기는 것과 개발 단계가 실제로 재개되는 것은 별개이므로 상태를 확인하세요.',
  },
  '/profiles/default': {
    title: 'Profile',
    purpose: '현재 사용자 정보를 확인합니다.',
    steps: [
      '표시된 사용자와 프로필 정보를 확인합니다.',
      '리뷰 기록에는 실제 검토 담당자 이름을 별도로 남깁니다.',
    ],
    check:
      '화면의 사용자 표시만으로 실제 승인 권한이 검증되었다고 판단하지 마세요.',
  },
};

export function ScreenHelp() {
  const { pathname } = useLocation();
  const guide = guides[pathname];
  if (!guide) return null;
  return (
    <details
      key={pathname}
      className="mt-screen-help mb-4 rounded-lg border border-border bg-background p-3 text-sm"
    >
      <summary className="cursor-pointer font-medium">
        <CircleHelp
          aria-hidden="true"
          className="mr-2 inline-block size-4 text-blue-600"
        />
        {guide.title} 화면 도움말
      </summary>
      <div className="mt-3 space-y-3 leading-relaxed">
        <p>{guide.purpose}</p>
        <ol className="list-decimal space-y-1 pl-5">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="rounded-md bg-muted p-3">
          <strong>확인할 점: </strong>
          {guide.check}
        </p>
        <a
          className="text-blue-600 underline"
          href="/review-simulation-guide.md"
          download
        >
          팀 리뷰용 업무 시뮬레이션 문서 내려받기
        </a>
        <p className="text-xs text-muted-foreground">
          현재 리뷰용 데이터는 브라우저별로 저장됩니다. 다른 팀원의 화면과
          자동으로 공유되지 않습니다.
        </p>
      </div>
    </details>
  );
}
