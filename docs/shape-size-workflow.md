# Shape 운영 흐름

## 기준

- 사용자 확인: **Product Shape와 최종 Size Number는 같은 개념이며, 제품 화면에서는 Shape로 용어를 통일한다.** 아래 원본 문서 인용에 사용된 Size도 Shape를 뜻한다. 내부 `sizeReview` 키는 기존 저장 데이터 호환을 위해 유지한다.
- `CL_WB_PRD_V04_쉬운한글_전체번역.docx` §6 개발 단계, §11 승인, §15 Size 발급·인계 자료.
- `Seat_Cover_Workflow_final.pdf` 8–9쪽: 피팅 결과·Blueprint·최종 Parts 목록 검토(14) → 승인 후 New Size Generation(15) → Size별 Part / Blueprint 정리(16).
- Seat Cover 번호 예는 F-xxx / B-xxx / E-xxx. 다른 제품의 번호 체계 및 자동 채번 규칙은 이 문서들만으로 추정하지 않는다.

## 화면 역할

Vehicle Projects에는 Shape 상태 요약이나 Shape 탭을 표시하지 않는다. 개발 완료 안내에서만 별도 Shape 메뉴로 이동할 수 있다. 기존 `tab=shapes` 링크는 Overview로 호환 처리하고 Shape 연결 데이터는 보존한다.

1. 프로젝트 개발: 패턴 → 샘플 → 피팅 → **Stage 13 양산 인계 완료 = 개발 완료**. Shape 발급 여부는 개발 완료 조건이 아니다. 내부 `Approved` 단계 값은 저장 호환성을 유지하고 화면에서는 개발 완료로 표시한다.
2. `/product-shapes`의 **검토 대기**: 인계 완료 프로젝트를 선택한다. Stage 14에서 인계 이후 회의 일시, PM / Director 및 Pattern Designer·Scan Team·Coordinator·Manual Design 참석자를 기록한다. 최신 피팅, 최종 Parts 목록, Blueprint를 검토하고 회의 중 구두 승인 결과를 저장한다.
3. Stage 15: 현재 자료에 유효한 승인이 있어야 신규 Shape를 발급하거나 기존 Shape를 해당 프로젝트에 연결할 수 있다. 별도 관리 화면에서 승인 없이 신규 번호를 만드는 진입점은 제거했다.
4. **발급된 Shape**: 검색·수정·적용 프로젝트 조회와 Stage 16 구성 등록을 진행한다. Pattern Designer가 승인된 프로젝트의 전체 Part 이름·Revision·수량을 가져와 저장하고 전체 패턴 배치도인 Blueprint 링크를 연결한다. 임시 저장과 구성 등록 완료를 구분한다. 원본 승인이나 Part 구성이 변경되면 재확인이 필요하다고 표시한다.
5. 문서 반려: 개발 완료 상태를 유지하고 자료 보완 후 재검토한다. 패턴 반려: 영향 Part를 지정하고 원래 프로젝트의 Sample 단계(Stage 7)로 복귀한다. 해당 Part는 새 Revision·샘플이 필요하며, 새 피팅과 재인계 후 다시 검토한다. 기존 Shape 참조와 검토·프로젝트 이력은 유지한다.
6. 공유 Shape 수정은 사용 중인 모든 프로젝트에 반영된다. 다른 Shape를 만들려면 기존 번호를 덮어쓰지 않고 새 번호를 발급한다. 사용 중지는 신규 연결을 막고 기존 참조를 보존한다.

## 데이터와 검증

- Shape master는 `vehicle_product_shape`, 선택 치수는 `vehicle_product_shape_dimension`에 대응한다.
- 프로젝트 연결은 `vehicle_project.vehicle_product_shape_id`에 해당하는 `productShapeId` 하나다. 삭제된 `adoptedProjectId`는 이전 저장 데이터에서 제거하며 Shape나 병합 프로젝트 ID로 추정 변환하지 않는다.
- `mergedIntoProjectId`는 별도 프로젝트 병합 참조다. 이번 작업은 병합 기능을 추가하지 않는다.
- 이전 UI의 전역 Shape 피팅 플래그는 최종 Shape 승인 증거로 사용하지 않는다. 중앙 master에 없는 예전 초안은 `확정 여부 확인 필요`로 가져온다.
- Part 버전·수량·구성 또는 피팅 기록이 변경되면 기존 검토 기록은 재검토가 필요하다. 최신 피팅 이후 만들어진 버전은 재피팅이 필요하다.
- 현 앱은 localStorage 기반 시제품이다. `sizeReview`는 프로젝트별 검토 증거 DTO이며 ERD에 새 컬럼이 구현되었다는 의미가 아니다. 실 DB 연동 시 `vehicle_project_stage`의 승인 담당자·시각·노트와 증빙 저장 방식을 확정해야 한다.
- PM / Director 선택은 실제 업무 검토 결과를 기록하는 UI이다. 계정 역할·승인권한, 서버 검증·동시 채번 및 파일 존재 확인은 아직 구현되어 있지 않다. PRD의 CEO 승인 예외는 서버 권한 설계 시 함께 반영해야 한다.
- 양산 인계 완료는 F#나 Shape를 발급하지 않는다. 기존 F# 데이터는 보존한다. Shape 번호와 Configuration 식별자는 서로 다른 용도다.
- `productionHandoff`, `shapeReviewHistory`, `composition`도 UI 저장 DTO이다. 제공 ERD에는 Shape와 Part 구성·Blueprint의 직접 연결이 없으므로 실 DB 연동 시 해당 관계와 승인 이력 저장 구조를 명시적으로 추가/확정해야 한다. Stage 16 화면이 실제 Google Sheets나 운영 DB를 수정하는 것은 아니다.

## 검증

`shape-model.test.ts`: 프로젝트별 승인·연결 게이트, 최신 피팅 실패, 재작업 후 검토 무효화, 제품별 중복 번호, 치수 유효성, 기존 저장 데이터 이행과 공유 참조를 검증한다.
