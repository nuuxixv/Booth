# 사양 시트 — A1 주문 관리 (OrderManagementPage)

> 이 시트는 어드민 주문 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-10-19 **준비중(PIN 주문) 상태 — 실 페이지 구현 완료**(frontend-engineer). `OrderManagementPage`: 준비중 뱃지+PIN(`match_code`) 칩·고객명 "작성 중" muted·행 체크박스 disabled+Tooltip·전이 취소만(데스크톱) 반영. "+신규 주문" 분기(PIN/수기) + PIN 생성 다이얼로그 연결. 원격 제출 실시간 알림(클라이언트 id 집합) 추가. 매출·출고·합배송·일괄 변경(selectableOrderIds·bulk 드롭다운) 제외는 백엔드 선행(PR #79)으로 이미 반영 — 검증 완료. 시안 `PinOrderAdminPreview.jsx`.
> 이전 갱신: 2026-10-19 **준비중(PIN 주문) 상태 확장(사양·시안 단계)**(product-designer). 상태 6종째 `preparing`(준비중) 추가 · 목록 준비중 뱃지 옆 PIN 표시 · 매출·출고·합배송·일괄 변경 제외 · 상태 전이 취소만. 아래 "## 준비중(PIN 주문) 상태 확장" 참조. 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) 단계 ⑤. 근거 `DOCS/PRD_현장도움주문.md` §4·§6.
> 이전 갱신: 2026-05-28 신설 (M3 frontend 위임 사전 — 게이트 1.5 통과 목적).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderManagementPage.jsx` (866줄)
- 시안: `inpsyt-order-frontend/src/components/OrderManagementPreview.jsx` (453줄)
- 의존 모달: `inpsyt-order-frontend/src/components/OrderDetailModal.jsx` (607줄), `inpsyt-order-frontend/src/components/NewOrderModal.jsx` (572줄)
- 관련 API: `inpsyt-order-frontend/src/api/orders.js` (`getOrders`·`groupLinkedOrders`·`linkOrders`·`searchOrdersForLinking`), `src/api/alimtalk.js` (`sendAlimtalk`), `src/api/events.js`, `src/api/products.js`
- 빈 상태/로딩 컴포넌트: `inpsyt-order-frontend/src/components/EmptyState.jsx`, `TableSkeleton.jsx`
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_TO_KOREAN`)
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20250808040516_add_admin_memo_to_orders.sql` + `20260406_add_access_token_to_orders.sql` + `20260406_add_status_history_to_orders.sql` + `20260407_add_alimtalk_fields_to_orders.sql` + `20260415_002_add_order_item_snapshots.sql`
- 결제완료 트리거: `supabase/migrations/20250722070342_create_paid_order_trigger.sql` (`notify_order_paid`)
- 상태 이력 트리거: `supabase/migrations/20260406_add_status_history_to_orders.sql` (`append_status_history`)
- 알림톡 발송 사양: `ONESHOT.md` (브라우저 직접 fetch — Edge Function 호출 불가)
- 우편번호 검색 라이브러리: `react-daum-postcode`

## 사용자 시나리오
어드민(master·editor·viewer)이 데스크톱 또는 태블릿에서 본다. 학회 종료 후 사무실에서 결제 누락·취소 처리, 학회 중 부스에서 즉시 신규 현장 주문 추가가 주 시나리오. (출고 반출은 출고관리 화면에서 처리하며, 엑셀 반출은 2026-07-20 폐지 — 웹에서 직접 처리.) 한 화면에서 1년 800건 누적 전체를 페이지네이션(10건/페이지)으로 훑는다. 페이지 진입 시 기본 30일치만 표시되고, 검색·필터로 좁히는 흐름이다. 모바일은 카드 리스트, 데스크톱은 테이블 + 우측 액션. 부분 실패(알림톡 일부 누락)는 토스트로 알려 모달에서 재발송하도록 안내한다.

## 진입 흐름
- [ ] `/admin/orders` 라우트 — 메인 어드민 메뉴에서 진입
- [ ] 권한 가드: `orders:view` 또는 `master` 권한 없으면 “접근 권한 없음” 메시지만 출력 (line 610-612)
- [ ] URL 쿼리스트링 `?status=paid` 등으로 진입 시 해당 상태가 초기 필터로 적용됨 (line 181)
- [ ] 한 행 클릭 → `OrderDetailModal` 오픈 (편집·연계·삭제·알림톡 재발송 가능)
- [ ] 합배송 만들기(`LinkPreviewDialog`): 열자마자 같은 학회(`baseOrder.event_id`)의 연계 가능한 주문을 기본 목록으로 표시(`getLinkableOrdersByEvent`, parent 없음·취소/환불 제외·껍데기 부모 제외, 최신순 최대 200). 검색바는 로컬 필터(고객명 부분일치 + 연락처는 `normalizePhone` 숫자 비교, 서버 재조회 아님). 후보 없으면 “같은 학회에 연계 가능한 주문이 없습니다”
- [ ] 신규 주문 버튼 → `NewOrderModal` 오픈

## 표시 정보 (라벨 단위, 누락 금지)

### 페이지 헤더 (line 616-619)
- [ ] `ShoppingCartIcon` (primary.main, fontSize 1.4rem) — 페이지 제목 아이콘
- [ ] 페이지 제목 텍스트: “주문 관리” (Typography variant h6, fontWeight 700)
- [ ] (시안만 보유) 부제: 총 N건 / 오늘 접수 M건 — 실 페이지에는 없음. **확인 필요**

### 필터 영역 (Paper 또는 SwipeableDrawer로 감쌈, line 473-608)
- [ ] 날짜 프리셋 칩 6종: “오늘” / “최근 2일” / “최근 3일” / “최근 7일” / “최근 30일” / “전체” (라운드 8px, 클릭 시 startDate·endDate 동시 세팅. “전체”는 두 날짜를 **null**로 세팅 → `applyBaseFilters`가 기간 조건 스킵 = 전 기간 조회. 전 기간 이름 검색용, 2026-08-18) — `DATE_PRESETS` 모듈 상수, 클릭 시 `SET_FILTERS`(다중 필드 원자 갱신)
  - **활성 표시(2026-08-18)**: 현재 startDate·endDate가 어느 프리셋과 일치하면 그 칩만 `filled`+`color=primary`(나머지 outlined). 판정은 `activePresetDays` useMemo — endDate가 오늘이고 startDate가 프리셋 시작일과 `yyyy-MM-dd` 일치하는 것을 탐색(시분초 무시). 둘 다 null이면 “전체” 활성, 어느 것과도 안 맞으면(사용자 임의 기간) 활성 칩 없음
- [ ] 학회 멀티 선택 드롭다운: 라벨 “행사 선택”, 기본값 “전체”, 1개 선택 시 학회명, 2개+ 시 “N개 선택” — line 490-513
  - **행사 선택 시 기간 자동 전체 전환(2026-08-18)**: `selectedEvents`가 **없음→있음**으로 바뀌는 순간에만 startDate·endDate를 null(전체)로 함께 세팅(`handleEventsChange`) — 그 학회 주문이 기간에 안 잘리고 전부 보이게. UI에도 반영돼 “전체” 칩이 활성·기간 필드가 비워짐(조용한 무시 아님). 이후 재선택(있음→있음)·해제(있음→없음)는 기간을 건드리지 않음(사용자가 다시 좁힐 자유 보존)
  - MenuItem: 체크박스 + 학회명(primary) + 시작일 `yyyy.M.d`(secondary caption, null이면 “시작일 미정”)
  - 옵션 정렬: `sortEventsForDropdown` — 오늘±7일 이내 시작 학회 최상단 고정, 그 다음 나머지. 각 그룹 내부 start_date 내림차순, null 맨 뒤 (`getEvents` 결과에 적용, `src/utils/eventSort.js`)
  - 렌더: `groupEventsForDropdown`으로 pinned/rest 분리, 상단 고정 그룹과 내림차순 그룹 사이 `<Divider/>`로 구분(양쪽 그룹 모두 있을 때만)
- [ ] 주문 상태 멀티 선택 드롭다운: 라벨 “주문 상태”, 5종(`pending`/`paid`/`completed`/`cancelled`/`refunded`) 멀티 체크 가능 — line 516-537
- [ ] 통합 검색 TextField: 라벨 “이름·연락처·ID·주문번호 검색”. `applyBaseFilters`가 `.or()`로 다중 필드 부분일치(`customer_name`·`phone_number`·`inpsyt_id` ilike). 추가 규칙: (1) **연락처 숫자 통검색 — 검색어의 숫자만 추출(`term.replace(/\D/g,'')`)해 2자리 이상이면 `phone_number.ilike.%{digits}%` 절 append. `phone_number` 정본이 숫자만 저장이므로 하이픈/공백/괄호 무엇으로 입력해도 매칭(`searchOrdersForLinking`과 동일 규칙)**, (2) `#?숫자` 형태면 `id.eq.{숫자}` 절 추가(비숫자면 미추가 — PostgREST 에러 방지), (3) 검색어 내 콤마·괄호는 `.or()` 파서 충돌 방지로 공백 치환. 단일쿼리·상품필터 Step1 idQuery 양쪽 공유 — api/orders.js:19-42
- [ ] 기간 입력: 라벨 “기간” — `ui/DateField mode="range"` **단일 캘린더 2클릭**(첫 클릭=시작·둘째 클릭=종료, `시작 ≤ 종료` 자동 정렬은 range 캘린더가 처리). 기본값 = today−7 ~ today(최근 7일). 시작일·종료일 2필드 분리 폐기(2026-08-18 통합). reducer는 Date 객체 저장 유지 — `value={{start,end}}`는 `format(…,'yyyy-MM-dd')`로 ISO 변환, `onChange({start,end})`는 `new Date(iso)`로 되돌려 `startDate`·`endDate` 두 상태로 분해 `SET_FILTERS`. ×(클리어) 시 `{start:'',end:''}` → 두 상태 null(전체 기간)
- [ ] “초기화” 버튼 (`RestartAltIcon` 시작 아이콘) — 모든 필터·검색어를 기본값으로 — line 567-573
- [ ] 상품명 검색 TextField: 라벨 “상품명 검색” — `order_items.product_name` 부분 일치 — line 577-584
- [ ] 카테고리 칩 4종: “전체” / “검사 구매” / “도서 구매” / “도구 구매” — secondary 색, filled/outlined 토글 — line 585-604

### 모바일 전용 — 필터 트리거 (line 621-639)
- [ ] “필터 (N)” 버튼 — N은 활성 필터 개수(학회·상태·고객명·상품명·카테고리 합산, line 454-460)
- [ ] 클릭 시 `SwipeableDrawer`(bottom)에서 동일 필터 컨트롤 표시
- [ ] 드로어 제목: “주문 필터”
- [ ] 드로어 하단 “확인” 버튼 (드로어 닫기)

### 액션 툴바 (테이블 상단, line 647-690)
- [ ] (조건부, `orders:edit`이고 선택된 주문 있을 때) “N개 선택됨” 라벨 (subtitle1, fontWeight bold) — line 651-653
- [ ] (조건부) “상태 일괄 변경” Select — 5개 상태 옵션 — line 654-663
- [ ] (조건부) “적용” 버튼 (contained, `bulkStatus` 비어 있으면 disabled) — line 664-666
- [ ] (조건부, `orders:edit`) “+ 신규 주문” 버튼 (contained primary)
- [ ] ~~“엑셀 다운로드” 버튼 + 엑셀 메뉴 3종(도서/검사/전체)~~ — **2026-07-20 폐지.** 웹에서 직접 처리하므로 엑셀 반출 제거(버튼·Menu·`handleExcelDownload`·`exportOrderExcel` 삭제)

### 데스크톱 테이블 (line 749-833)
- [ ] 헤더 셀: bgcolor grey.200, fontWeight bold, stickyHeader
- [ ] (조건부, `orders:edit`) 체크박스 컬럼 — 헤더 indeterminate/all 동작 — line 753-762
- [ ] “주문번호” 컬럼 — `formatOrderId(order)` (`#{id}`, child면 `#{id}({parent_id})`, parent에 자식 있으면 `#{id}-{N+1}`) — line 438-446, 815
- [ ] “고객명” 컬럼 — `order.customer_name` — line 816
- [ ] “학회명” 컬럼 — `events.find(e => e.id === order.event_id)?.name`, 없으면 "N/A" — line 817
- [ ] “총 금액” 컬럼 — `order.final_payment.toLocaleString()`원 (천 단위 콤마, 원 단위) — line 818
- [ ] “주문일시” 컬럼 — `yyyy-MM-dd HH:mm` — line 819
- [ ] “상태” 컬럼 — `Select`. 옵션은 **상태기계 필터**(`ALLOWED_TRANSITIONS[order.status]`, `orderStatus.js`): **허용 전이만** 노출(`pending→[paid,cancelled]`, `paid→[refunded]`). **현재 상태는 메뉴에 넣지 않고 닫힘 표시값으로만 고정**(`value="" + displayEmpty + renderValue={() => 현재상태}`) — 열면 전이 후보만, 닫으면 현재 상태 표시. completed 전이는 목록 노출 금지(출고관리 전용), pending 회귀 금지. `orders:edit` 없으면 disabled. **허용 전이가 0개인 종결(completed·cancelled·refunded)이면 Select 대신 읽기전용 `StatusBadge` 렌더**
- [ ] (조건부, `alimtalk_status === 'failed'`) 상태 셀 하단 “알림톡 실패” 칩 — error 토큰(`palette.error.main` alpha 채움+보더), 미발송(null)·sent는 칩 없음
- [ ] 행 클릭 시 (체크박스·상태 셀 제외) `OrderDetailModal` 오픈 — line 815-819 onClick
- [ ] 체크박스는 행 클릭 이벤트 stopPropagation — line 194-212

### 모바일 카드 리스트 (line 692-747)
- [ ] 카드 stack (간격 2)
- [ ] 카드 상단: (조건부 체크박스 + 주문일자 `yyyy-MM-dd`) ← → (상태 칩) — line 714-733
  - 상태 칩 색: `completed`=success / `pending`=warning / 그 외 default
  - (조건부, `alimtalk_status === 'failed'`) 상태 칩 좌측에 “알림톡 실패” 칩 — 데스크톱과 동일 error 토큰
- [ ] 카드 본문: 고객명 (fontWeight bold, 1.1rem) + 학회명 (body2 secondary), 우측에 결제금액 (fontWeight bold, primary.main) — line 734-740
- [ ] 카드 클릭 → 상세 모달 오픈
- [ ] 선택 시 테두리 primary.main + borderWidth 2 — line 711

### 페이지네이션 (line 835-837)
- [ ] MUI `Pagination` 컴포넌트, count = `Math.ceil(totalOrders / 10)`, color primary

## 액션·기능 (누락 금지)

### 필터·검색
- [ ] 학회 멀티 선택 → `selectedEvents` 변경 → `currentPage=1` 리셋 → 재조회
- [ ] 주문 상태 멀티 선택 → `selectedStatuses` 변경 → 재조회
- [ ] 고객명 검색 → `searchTerm` 변경 → `ilike %term%` 조회
- [ ] 기간(range DateField) → 단일 캘린더 2클릭으로 start·end 동시 산출(ISO yyyy-MM-dd 주고받음). reducer는 Date 객체 저장 유지 — 컴포넌트 경계에서 Date↔ISO 어댑팅. 두 날짜 모두 null이면 `applyBaseFilters`가 기간 조건 스킵(전체 기간)
- [ ] 날짜 프리셋 클릭 → 즉시 두 날짜 모두 변경 (라이브 갱신). “전체” 프리셋·range 클리어(×)·행사 첫 선택 시 두 날짜 null → 전 기간 조회
- [ ] 행사 첫 선택(없음→있음) → 기간 자동 전체(null) + “전체” 칩 활성. `activeFilterCount`는 기간을 세지 않으므로(항상 값 존재) 전체 기간 전환이 카운트를 왜곡하지 않음
- [ ] 상품명 검색 → `productSearchTerm` 변경 → order_items.product_name `ilike` (Step 1로 주문 ID 추출 → Step 2로 본 쿼리)
- [ ] 카테고리 칩 토글 → `selectedProductCategory` 변경 → order_items.category `eq` 필터
- [ ] 초기화 버튼 → 모든 필터·검색어·날짜 기본값(최근 7일) 복원

### 선택·일괄
- [ ] 전체 체크 → 현재 페이지의 **단독 실 주문 ID만** 선택. **합배송 그룹 소속(껍데기·자식 전부, 대표 포함)은 제외** — `selectableOrderIds(state.orders)`(`utils/groupOrder.js`). 헤더 체크박스 indeterminate/all 판정도 이 목록 기준
- [ ] 개별 체크 → 토글 (stopPropagation). **합배송 자식 행에는 체크박스 없음**(껍데기·그룹 자식 행은 `<TableCell padding="checkbox" />` 빈 셀). 단, **부모가 현재 페이지 밖인 고아 자식**은 단독 행(`renderSingleRow`)·카드(`renderMobileSingle`)로 렌더되며 `parent_order_id`가 있으므로 **체크박스를 disabled 처리** + Tooltip "합배송 주문은 개별 행 또는 상세에서 변경하세요"
- [ ] 상태 일괄 변경 적용 → **최종 가드**: `partitionBulkSelectable(state.orders, selectedOrders)`로 그룹 소속을 걸러내 `allowedIds`만 실행. 제외분이 있으면 "합배송 묶음 N건은 제외했습니다 — 개별 변경을 이용하세요." 경고 토스트. 실행 대상 0건이면 선택만 비우고 종료. `allowedIds`로 `bulk_update_order_status` RPC 호출, **paid 일괄 전환 시 알림톡 순차 발송**(`for of`로 직렬, 대상=`allowedIds`), 부분 실패는 카운트 + 첫 실패 사유 표시
- [ ] **합배송 위임을 일괄 경로에 재구현하지 않는다** — 그룹 상태 변경은 반드시 개별 행·상세의 위임 경로(`classifyGroupStatusChange` → auto/pick)를 태워야 하므로, 일괄은 그룹 소속을 전부 배제하는 것으로 사고(대표 취소 시 `representative_child_id` 스테일 → 배송 사고)를 차단한다 (QA P0-2, 2026-08-25)
- [ ] **확인 필요** — `bulk_update_order_status` RPC는 마이그레이션 파일에 정의가 없음. 수동 SQL로 생성된 부채 후보. RPC 파라미터(`order_ids`, `new_status`)로 호출 중

### 행 액션
- [ ] 신규 주문 버튼 → `NewOrderModal` 오픈 (`orders:edit` 필요)
- [ ] 행 클릭 → `OrderDetailModal` 오픈
- [ ] 상태 셀 Select 변경 → `orders.status` 업데이트 + `status_history` 트리거로 이력 추가 + (newStatus=paid면) `sendAlimtalk(orderId)` 비동기 호출 — line 418-436
- [ ] **합배송 자식 행 상태 편집** — 자식 행 상태 배지가 Select로 전환(옵션=`ALLOWED_TRANSITIONS[child.status]` 전이만, 현재 상태는 닫힘 표시값으로 고정, 종결이면 읽기전용 배지). 껍데기 행은 읽기전용 종합 배지 유지. `handleGroupChildStatusChange(node, child, newStatus)`가 `classifyGroupStatusChange`로 분기:
  - `passthrough` → 기존 `handleStatusChange(child.id, newStatus)`(paid 시 알림톡 자동발송 포함)
  - `auto`(대표 취소·환불 && 남은 활성 1건) → `reassignGroupRepresentative` 후 status update → “묶음 배송지를 자동으로 옮기고 주문을 취소했습니다.” 토스트 → 재조회
  - `pick`(남은 활성 2건+) → 페이지 레벨 `ShippingPickModal`로 새 묶음 배송지 선택. **위임 경로를 건너뛰면 그룹 배송이 깨짐** — GroupOrderModal 모달 경로와 동일 규칙(단일 소스 `utils/groupOrder.js`)

### 엑셀 — 폐지 (2026-07-20)
- 엑셀 반출 기능 전면 제거. 웹에서 직접 처리하므로 엑셀 다운로드 버튼·Menu·`handleExcelDownload`·`exportOrderExcel`(`utils/orderExcel.js`)·`orderExcel.test.js`를 모두 삭제. `xlsx` 패키지는 상품관리 등 다른 화면에서 계속 사용하므로 의존성은 유지.

### 알림톡 발송 트리거 (ONESHOT 정합)
- [ ] **단일 상태 변경: status `→ paid` 시점**에 `sendAlimtalk(orderId)` 자동 호출 — line 425-432
- [ ] **일괄 상태 변경: `bulkStatus === 'paid'` 일 때만** 순차 발송 — line 301-323
- [ ] `is_on_site_sale === true` 면 발송 skip (api/alimtalk.js:24)
- [ ] `phone_number` 없으면 실패 반환
- [ ] `result_code === 0` 만 성공으로 처리. 그 외 모두 실패 토스트 (api/alimtalk.js:53)
- [ ] **발송 결과 DB 기록** (api/alimtalk.js `recordAlimtalkResult`):
  - 성공: `alimtalk_status='sent'`, `alimtalk_sent_at=now`, `alimtalk_attempted_at=now`, `alimtalk_error=null`
  - 실패(발송 시도 후): `alimtalk_status='failed'`, `alimtalk_error="{result_code} {원샷 메시지}"` (네트워크 예외면 err.message), `alimtalk_attempted_at=now`, `alimtalk_sent_at` 미변경
  - skipped(현장수령)·발송 전 실패(주문 없음·번호 없음): 기록하지 않음
  - 기록 update 실패 시 콘솔 경고만 — 발송 플로우 차단 금지 (컬럼 미적용 환경 graceful)
- [ ] 단건 상태 변경의 알림톡 결과 수신 후 `fetchOrders()` 재호출 — 실패 배지 즉시 반영
- [ ] **브라우저에서 직접 fetch** — Edge Function 호출 금지 (msgagent 구형 TLS, ONESHOT.md §60-62)
- [ ] `OrderDetailModal`에 “알림톡 재발송” 버튼 별도 존재 — `status='paid'` 이고 `is_on_site_sale=false` 이고 `orders:edit` 권한 시 노출 (`OrderDetailModal.jsx:362-371`)

### URL 쿼리 연동
- [ ] 진입 시 `?status=paid` 등으로 `selectedStatuses` 초기화 (line 181)

## 입력 폼 구조 (NewOrderModal — 분리/통합 절대 금지)

`NewOrderModal.jsx` 좌측 패널의 고객 정보 입력은 **5개 필드로 분리**되어 있다. 시안에서 임의 통합 금지.

- [ ] 현장판매 체크박스 (`is_on_site`) — 체크 시 customerName 자동(`현장판매_{timestamp}`), 나머지 입력 disable — line 268-279
- [ ] 학회/행사 Select (`selected_event_id`) — 필수, 상태 라벨(`예정`/`진행중`/`종료`) + 학회명 + 시작일 + 할인율 표시 — line 281-315
- [ ] 고객명 TextField (`name`) — 필수, `PersonIcon` startAdornment — line 319-325
- [ ] 연락처 TextField (`phone`) — 옵션, 자동 포맷(`010-0000-0000`), `PhoneIcon` startAdornment — line 326-333
- [ ] **주소 검색 TextField (`address`) — readOnly, 클릭하면 Daum 우편번호 모달** — line 334-351
- [ ] **상세주소 TextField (`detailAddress`) — `address`가 있을 때만 노출, 독립 입력** — line 352-357
- [ ] **우편번호 (`postcode`) — Daum 검색 결과의 `zonecode`로 자동 설정. 별도 UI 없음 (저장 시 jsonb에 포함)** — line 95-97
- [ ] (DB 저장) `shipping_address` jsonb = `{ postcode, address, detail }` 구조 — line 197-199

우측 패널 (상품 검색·장바구니):
- [ ] 상품명 검색 (`searchTerm`) — `matchesSearch` 유틸, 비어 있으면 인기 상품만 노출 (line 127-130)
- [ ] 카테고리 칩 — `'all' + categories` (도서·검사 + DB 추출), 단일 선택 — line 414-425
- [ ] 상품 행: 상품명·카테고리 칩·정가(할인 시 취소선 + 할인가) — line 437-494
- [ ] “담기” / “담김” 토글 — 클릭 시 cart 추가
- [ ] 장바구니: 상품명·합계·수량 ±·삭제 — line 497-543

주문 요약 (좌측 패널 하단):
- [ ] “총 상품금액”, “할인” (조건부 > 0), “배송비” (조건부 !isOnSite), “최종 결제금액” — line 362-389
- [ ] 배송비 계산: `is_on_site_sale=true` → 0 / `discountedSubtotal >= free_shipping_threshold` → 0 / 그 외 → `shipping_cost` — line 171-173

## 권한별 차이

`useAuth().hasPermission(key)` 호출 기준:

- [ ] **master**: 모든 기능 + `OrderDetailModal`의 삭제 버튼 노출 (`OrderDetailModal.jsx:373-377`)
- [ ] **`orders:edit` (editor 포함)**: 행 체크박스·일괄 상태 변경 툴바·신규 주문 버튼·상태 셀 Select·상세 모달의 편집/연계/알림톡 재발송 활성
- [ ] **`orders:view` 만 보유 (viewer)**: 모든 컨트롤 disabled. 조회·필터만 가능. 신규 주문 버튼·일괄 변경 툴바·체크박스 컬럼 모두 미표시 (엑셀 다운로드는 2026-07-20 폐지)
- [ ] **권한 둘 다 없음**: “주문 관리 페이지 접근 권한이 없습니다.” 메시지만

## 데이터 모델

### `orders` 테이블 (이 화면에서 SELECT하는 필드 + 가공)
- `id` (bigint, 시퀀스) — 표시는 `#id` 또는 `#id(parent_id)` 또는 `#id-{children+1}`
- `parent_order_id` (bigint, nullable) — 합배송 자식 주문은 이 값으로 부모 가리킴
- `customer_name` (text)
- `phone_number` (text, nullable) — **정본=숫자만 저장(DB 트리거 정규화). 표시는 `formatPhone` 유틸로 하이픈 포맷, 검색은 `normalizePhone`로 숫자만 비교**
- `shipping_address` (jsonb, nullable) — `{ postcode, address, detail }`
- `is_on_site_sale` (boolean, default false)
- `customer_request` (text, nullable)
- `admin_memo` (text, nullable)
- `inpsyt_id` (text, nullable)
- `event_id` (bigint, FK → events)
- `status` (text) — 5종: `pending`/`paid`/`completed`/`cancelled`/`refunded`
- `status_history` (jsonb, default `[]`) — 변경 트리거로 누적, 모달에서만 표시
- `created_at` (timestamptz)
- `final_payment` (numeric) — 표시·일괄 변경의 기준 금액
- `total_cost` (numeric) — 정가 합계
- `discount_amount` (numeric)
- `delivery_fee` (numeric)
- `access_token` (uuid, unique, default `gen_random_uuid()`) — 알림톡 링크에 사용
- `alimtalk_sent_at` (timestamptz, nullable) — 발송 이력
- `alimtalk_status` (text, nullable) — `'sent'` | `'failed'` | null(미발송). 목록 실패 칩·모달 상태 표시의 기준
- `alimtalk_error` (text, nullable) — 실패 사유 (`"{result_code} {메시지}"`)
- `alimtalk_attempted_at` (timestamptz, nullable) — 마지막 발송 시도 시각
- 신규 3컬럼은 `getOrders`의 `select('*')`에 자동 포함 (별도 select 변경 불필요)
- (참고) `contact`, `address`, `total_amount`, `shipping_cost` 는 `20250805_add_new_order_fields.sql`에서 추가되었으나 현재 화면 로직은 `phone_number` / `shipping_address` jsonb / `total_cost` / `delivery_fee` 를 사용 — **확인 필요**: 둘 다 컬럼이 살아 있는지, 사용 중단 컬럼이 있는지

### `order_items` (join)
- `product_id` (FK)
- `quantity` (int)
- `price_at_purchase` (numeric)
- 스냅샷 컬럼(`20260415_002_add_order_item_snapshots.sql`): `product_name`, `product_code`, `category`, `list_price`
- 조회: `getOrders` 의 `ALL_ITEMS_SELECT` = `order_items(product_id, quantity, price_at_purchase, product_name, product_code, category, list_price)` (line 17)

### `events` (join)
- `id`, `name`, `discount_rate`, `start_date`, `end_date` — `NewOrderModal`의 학회 셀렉트가 사용

### `site_settings` (단일 행)
- `free_shipping_threshold` (numeric, default 30000)
- `shipping_cost` (numeric, default 3000)
- `OrderManagementPage.fetchSettings` 가 페이지 진입 시 1회 fetch (line 262-267)

### `bulk_update_order_status` (RPC, 마이그레이션 부재 — 부채 후보)
- 호출 시그니처: `{ order_ids: bigint[], new_status: text }` (line 291-294)
- DB에 함수가 분명히 존재(코드가 작동 중)하나 `supabase/migrations/`에 정의 SQL 없음
- **확인 필요**: 수동 생성된 함수인지, 마이그레이션이 누락된 것인지

### 클라이언트 가공 — `groupLinkedOrders` (api/orders.js:210-235)
- parent 주문에 `linkedChildren`, `mergedItems`, `mergedTotal` 부여
- child 주문은 parent_order_id를 가진 채 반환 (실 페이지는 child도 목록에 그대로 표시)
- 이 페이지는 출고 화면과 달리 child를 숨기지 않는다. **확인 필요**: 합배송 child도 행으로 나타나는지 시안에서 처리 방식 합의 필요

### 상태 한국어 매핑 — `statusToKorean` (line 57-63)
- `pending` → 결제대기
- `paid` → 결제완료
- `cancelled` → 주문취소
- `refunded` → 결제취소
- `completed` → 처리완료

## 필터·뷰 모드

- 학회: 멀티 선택, 빈 배열이면 전체
- 상태: 멀티 선택, 빈 배열이면 전체. URL `?status=` 으로 초기값 주입 가능
- 고객명: 부분 일치 검색
- 상품명: 부분 일치 검색 (Step 1로 주문 ID 추출 → Step 2로 본 조회, 카테고리는 step 1에서 동시 필터링)
- 카테고리: 단일 선택 (`검사`/`도서`/`도구` 또는 ``)
- 날짜: startDate / endDate (양 끝 포함, `startOfDay`/`endOfDay` 정규화 — api/orders.js:23-27)
- 페이지 크기: 10 고정 (line 215)
- 정렬: `created_at desc` 고정

## 빈 상태·로딩·오류 처리

- [ ] 로딩 (데스크톱): `TableSkeleton rows=10` (line 773)
- [ ] 로딩 (모바일): `CircularProgress` 중앙 정렬
- [ ] 빈 상태 — 활성 필터 0개: `EmptyState message="아직 접수된 주문이 없습니다." subMessage="새로운 주문이 들어오면 여기에 표시됩니다."`
- [ ] 빈 상태 — 활성 필터 1개 이상: `EmptyState` + `SearchOffIcon` + “필터 초기화” 액션 버튼 (line 779-783)
- [ ] 오류: `addNotification(...'error')` 토스트만. 화면에 잔류 alert는 없음
- [ ] 알림톡 부분 실패: 일괄 paid 변경 시 “{성공}건 성공, {실패}건 실패 — {첫 실패 사유} — 실패 건은 모달에서 재발송하세요.” 토스트 (line 321)

## 시안(OrderManagementPreview) vs 실 페이지 — 차이 적출

frontend가 M3 사이클에서 흡수해야 할 항목:

1. **신규 주문 버튼 권한 가드 누락.** 시안은 항상 노출(line 210), 실 페이지는 `orders:edit` 권한 시에만 노출(line 671). 시안에 권한 분기 필요.
2. **상태 셀(행별 Select) 없음.** 실 페이지는 테이블 마지막 컬럼이 `Select`로 즉시 상태 변경 가능. 시안은 `StatusBadge` 읽기 전용만(line 135). 행 직접 변경 액션이 빠짐.
3. **고객 메타 컬럼 누락.**
   - 시안 컬럼: # / 주문번호 / 고객명+상품수 / 학회 / 결제금액 / 주문일시 / 상태 (7컬럼)
   - 실 페이지 컬럼: (체크) / 주문번호 / 고객명 / 학회명 / 총 금액 / 주문일시 / 상태 (7컬럼)
   - 시안의 “상품 N개” 메타는 실 페이지에 없음. **확인 필요** — 추가 노출 결정인지, 시안 추가 정보인지
4. **합배송 ID 포맷 미반영.** 실 페이지는 `#{id}-{N+1}`(부모) 또는 `#{id}({parent_id})`(자식) 표기(line 438-446). 시안은 단순 `#{id}`만(line 113-115). 합배송 표시 누락.
5. **활성 필터 카운트만 있고, 일괄 액션바 표시 조건은 동일.** 시안의 “N개 선택됨 / 일괄 적용 / 선택 해제”는 실 페이지와 거의 같다. 단, 시안에는 “선택 해제” 별도 버튼(line 383)이 있고 실 페이지에는 없음. 둘 중 어느 패턴으로 갈지 결정 필요.
6. **엑셀 메뉴 라벨 불일치.**
   - 시안: “📘 도서 출고 전용” / “📄 검사 출고 전용” / “전체 통합 (백업용)”
   - 실 페이지: “📘 도서 출고 전용 엑셀” / “📄 검사 출고 전용 엑셀” / “전체 통합 엑셀 (백업용)”
   - 어느 쪽으로 정렬할지 확정 필요.
7. **모바일 카드 뷰 누락.** 시안은 `PreviewShell` 안에서 데스크톱 레이아웃만 보여줌. 실 페이지는 `useMediaQuery('md')` 분기로 카드 리스트 별도 구현. 시안에 모바일 변형 필요.
8. **NewOrderModal·OrderDetailModal 별도 시안 없음.** A1 사이클의 범위 안인지 확정 필요. 두 모달은 입력 폼·연계 주문·삭제 등 큰 상호작용이라 별도 사양 시트(A1-1, A1-2)로 떨어뜨릴지 결정 필요.
9. **상태 필터 기본값 차이.** 시안은 `selectedStatuses = ['pending', 'paid']` 초기값(line 146), 실 페이지는 빈 배열(전체). 시안의 기본값이 “업무 중심 뷰”라면 그 의도를 기획 결정으로 박아야 한다.
10. **알림톡 발송 트리거 UI 시그널 없음.** 실 페이지는 `status → paid` 시 자동 발송 + 토스트, 상세 모달에 “알림톡 재발송” 별도 버튼. 시안에는 알림톡 관련 UI 자체가 없음. 일괄 paid 전환 시 발송 진행 상태(N건 성공/실패)를 어디서 보여줄지 정해야 한다.

## 핵심 발견 (메인 Claude 검수 시 반드시 확인)

1. **알림톡 발송은 브라우저 직접 fetch — 이 사양은 절대 바꾸지 말 것.** ONESHOT.md §60-62 명시: msgagent 서버가 구형 TLS라 Deno Edge Function에서 HandshakeFailure. 시안 만들 때 “Edge Function으로 빼서 안 보이게 처리하자”는 충동은 금지. 어드민 PC Chrome에서 발송되는 게 정상 흐름이고, 모바일·iOS는 원샷 측 제한으로 실패(이건 별 이슈). 일괄 paid 시 진행 토스트 + 실패 건 모달 재발송 UI가 운영 패턴이다.

2. **NewOrderModal의 주소는 3필드로 분리되어 있다.** `address`(도로명, Daum readOnly) / `detailAddress`(상세, 직접 입력) / `postcode`(Daum 자동). 시안이 1줄로 통합하면 A3 출고 시안 때와 똑같은 사고. 신규 주문 시안을 만든다면 이 분리를 반드시 유지.

3. **`bulk_update_order_status` RPC가 마이그레이션에 없다 — 부채.** 실 페이지 코드가 RPC를 호출하고 있고 동작도 하지만, `supabase/migrations/*.sql` 어디에도 함수 정의가 없다. 누군가 Supabase 콘솔에서 수동으로 만든 것으로 추정. 신규 환경 배포 시 깨질 수 있는 부채. CTO에 별도 보고 필요.

4. **합배송 자식 주문이 목록에 그대로 노출된다.** 출고 화면(`FulfillmentPage`)은 `parent_order_id` 있는 행을 숨기지만, 이 페이지는 `groupLinkedOrders` 결과를 필터링 없이 그대로 표시한다. 결과적으로 자식 주문(`#456(123)`)이 별도 행으로 보인다. 시안에서 합배송 관계를 어떻게 시각화할지 결정 필요.

5. **상품 필터(`productSearchTerm` + `selectedProductCategory`) 사용 시 쿼리가 2단계로 분리된다.** Step 1에서 주문 ID 추출(`!inner` join + 카테고리·상품명 eq/ilike), Step 2에서 본 조회. 결과적으로 “검사 카테고리” 필터를 켜도 행 안의 모든 order_items가 표시된다(출고 화면처럼 카테고리만 강조하지 않음). 시안이 카테고리 칩으로 행 안의 상품을 표현한다면 출고 화면(A3)의 그레이드 처리 패턴 차용 검토.

6. ~~**viewer 권한은 의외로 많은 것을 본다.**~~ **2026-07-20 해소** — 엑셀 반출 기능 전면 폐지로 viewer의 고객정보 반출 경로 자체가 사라짐. viewer는 이제 조회·필터만 가능.

## 준비중(PIN 주문) 상태 확장 (2026-10-19, 실 페이지 구현 완료)

> 근거: `DOCS/PRD_현장도움주문.md` §4(담당자 흐름)·§6(기술 요약). PIN 주문으로 생긴 미완료 주문의 상태. 신규 주문 분기·PIN 생성은 `A2_NewOrderModal.md`, 준비중 상세는 `A2_OrderDetailModal.md` 참조.
> **실 페이지 구현(2026-10-19, frontend-engineer):** 아래 항목 전부 `OrderManagementPage.jsx`에 반영. 상태 상수(`preparing`)·제외 로직(`selectableOrderIds`·bulk 드롭다운·`getLinkableOrdersByEvent`·`searchOrdersForLinking`·`getFulfillmentOrders`)은 백엔드 선행(PR #79)에 이미 있어 검증만 수행. 데스크톱 준비중 상태 셀=뱃지+PIN+취소 텍스트 버튼, 모바일 카드=뱃지+PIN(취소는 상세). 원격 제출 실시간 알림=`orders` UPDATE 구독(현재 준비중 id 집합 → pending 전환 감지, 본인 저장분은 중복 억제).

### 상태 상수 확장 (`constants/orderStatus.js` — 두 트랙 공통, 1글자도 바꾸지 말 것)
- [ ] `STATUS_TO_KOREAN.preparing = '준비중'` (6종째). `STATUS_COLORS.preparing = '#64748B'`.
- [ ] **`REVENUE_STATUSES`에 넣지 않음** — 준비중은 매출 집계 제외(미완료).
- [ ] `ALLOWED_TRANSITIONS.preparing = ['cancelled']` — **취소만.** 결제대기(`pending`) 전환은 상품+고객정보 충족 시 **자동**이라 드롭다운(상태 Select) 대상이 아니다.
- [ ] (구현 메모) 상태 컬럼은 제약 없는 글자라 값 추가만으로 동작. 뱃지 색은 `StatusBadge`/theme.status 정합화 시 동기화.

### 목록 — 준비중 행 표시
- [ ] **상태 셀: 준비중 `StatusBadge` + 옆에 PIN(`match_code`) 칩 재표시.** 고객이 제출하면 결제대기로 바뀌며 PIN 칩 사라짐.
- [ ] **상태 Select(전이) = 취소만.** `ALLOWED_TRANSITIONS.preparing=['cancelled']`이므로 열면 "취소" 1개. (목록에서 취소 가능 — PRD §5 "담당자가 주문을 잘못 만듦")
- [ ] 고객명 비어 있음(제출 전): "작성 중" 등 muted 표기. 금액은 담긴 상품 기준 표시하되 **매출 집계에는 미포함**.
- [ ] 모바일 카드도 동일(준비중 뱃지 + PIN). 휴대폰 폭 가로 스크롤 금지(기존 모바일 카드 리스트 패턴 유지, MEMORY 모바일 Read-first).

### 매출·출고·합배송·일괄 변경에서 제외
- [ ] **매출**: `REVENUE_STATUSES` 미포함 → 매출 집계·대시보드·현장 보고에서 제외(PRD §6).
- [ ] **출고**: 출고는 결제완료(`paid`)+처리완료(`completed`) 기준이라 준비중 자동 제외.
- [ ] **합배송**: 준비중은 연계(합배송) 후보에서 제외(`getLinkableOrdersByEvent` 조건에 준비중 배제).
- [ ] **일괄 상태 변경 대상 제외**: 전체 선택·헤더 체크박스가 준비중을 제외(합배송 그룹 제외와 같은 결). 준비중 행 **체크박스 disabled + Tooltip "준비중 주문은 일괄 변경 대상이 아니에요"**.

### 시안 반영
- [ ] 시안: `src/components/PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) — 단계 ⑤(주문 목록: 데스크톱 테이블 + 휴대폰 카드, 준비중 뱃지 + PIN, 체크박스 disabled, 상태 전이 취소만, 제외 캡션). 단계 ①(신규 주문 분기 진입)도 이 페이지 "+신규 주문"에서 시작.

## 변경 이력
- 2026-10-19 준비중(PIN 주문) 상태 — 2차 보완(frontend-engineer, 메인 Claude 검수) — **(1) 실시간 핸들러 확장:** 준비중 id 집합에 속한 주문의 UPDATE면 **상태와 무관하게 목록 재조회**(고객이 배송지만 먼저 제출 → "작성 중"이 고객명으로 즉시 갱신). 알림·알림음은 pending 전환일 때만(본인 저장분 중복 억제 유지). **(2) 생성 후 상세 자동 오픈 보완:** 목록 필터로 새 준비중 주문이 목록에 없을 때 `getOrderById(orderId)`(신규, `api/orders.js`) 단건 조회로 상세를 연다(목록 등장 시 열기는 폴백). **(3) PIN 생성 학회 기본값 수정:** getEvents 이름순 정렬로 엉뚱한 학회가 기본값이던 문제를 `pickDefaultPinEvent`(진행 중 KST)로 교체(상세는 A2_NewOrderModal). 검증: lint 신규 0, vitest(pinOrder 20건) 통과, build OK.
- 2026-10-19 준비중(PIN 주문) 상태 — 실 페이지 구현 완료(frontend-engineer) — `OrderManagementPage.jsx`에 준비중 행 표시(뱃지+`match_code` PIN 칩·고객명 "작성 중" muted·행 체크박스 disabled+Tooltip "준비중 주문은 일괄 변경 대상이 아니에요"·전이 취소만) 반영. "+신규 주문" 버튼이 `NewOrderBranchDialog`(PIN/수기 2택)를 먼저 열고, PIN 선택 시 `PinOrderCreateDialog`로 생성→상세 자동 오픈. 원격 제출 실시간 알림: `orders` UPDATE 구독 + 준비중 id 집합 판정(본인 저장분 중복 억제, 채널 언마운트 정리). 제외(매출·출고·합배송·일괄 변경)는 PR #79 선행분 검증. 상태 필터 드롭다운은 `STATUS_TO_KOREAN`에 preparing 포함되어 자동 노출. 검증: lint 신규 0, vitest 통과(pinOrder.test.js 9건 추가), build OK.
- 2026-10-19 준비중(PIN 주문) 상태 확장(사양·시안 단계, product-designer) — 상태 6종째 `preparing`(준비중/#64748B) 추가(REVENUE_STATUSES 미포함, ALLOWED_TRANSITIONS.preparing=['cancelled']). 목록 준비중 뱃지 옆 PIN 재표시(제출 시 소멸), 상태 전이 취소만, 고객명 "작성 중" muted. 매출·출고·합배송·일괄 변경(체크박스 disabled+Tooltip) 제외. "+신규 주문" 분기(PIN/수기)는 A2_NewOrderModal. 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) 단계 ⑤. 근거 `DOCS/PRD_현장도움주문.md` §4·§6. 상태 상수 실 반영·DB는 별도 사이클.
- 2026-08-25 QA P0-2 일괄 변경 합배송 위임 우회 차단 — 일괄 상태 변경이 `bulk_update_order_status` RPC로 직행하며 단일 변경이 강제하는 대표 배송지 위임(`classifyGroupStatusChange`→auto/pick)을 우회하던 결함 수정. 대표 주문을 일괄 취소하면 `representative_child_id`가 취소된 주문을 계속 가리켜 묶음 배송지 스테일 = 배송 사고. **방침: 일괄 경로에서 합배송 그룹 소속(껍데기·자식 전부)을 제외**(위임은 개별 행·상세 경로 몫, 재구현 안 함). (1) 전체 선택·헤더 체크박스가 `selectableOrderIds`로 그룹 소속 제외, (2) 고아 자식 단독 행/카드 체크박스 disabled+Tooltip, (3) 실행 직전 `partitionBulkSelectable`로 최종 가드(제외 N건 토스트). 순수 함수 `selectableOrderIds`·`partitionBulkSelectable`·`isGroupMemberOrder`를 `utils/groupOrder.js`에 추출, `groupOrder.test.js`에 단위 테스트 7건 추가(독립만/자식섞임/대표섞임/전부그룹). 기존 단일 변경·모달 경로 무변경.
- 2026-07-20 목록 드롭다운 현재상태 숨김 + 엑셀 반출 폐지 — (1) 목록 상태 Select를 `ALLOWED_TRANSITIONS` 직접 사용으로 변경: 현재 상태는 메뉴에서 제거하고 닫힘 표시값(`value="" + displayEmpty + renderValue`)으로만 고정, 열면 허용 전이 후보만 노출(단독 행·합배송 자식 행 동일). 종결은 읽기전용 배지 유지. `getStatusOptions`는 미사용이 되어 `orderStatus.js`·`orderStatus.test.js`에서 제거(`ALLOWED_TRANSITIONS` 검증은 유지). 상세모달(OrderSections) 상태 Select는 전체 자유전환 유지(미변경). (2) 엑셀 반출 전면 폐지 — 주문관리·출고관리(A3)의 엑셀 다운로드 버튼·Menu·핸들러·`utils/orderExcel.js`·`orderExcel.test.js` 삭제. viewer 고객정보 반출 부채(핵심 발견 6) 동시 해소. `xlsx` 의존성은 상품관리 등 잔존 사용처 있어 유지.
- 2026-05-28 신설 — M3 frontend 위임 사전 작성. 게이트 1.5 통과 목적. 시안(`OrderManagementPreview.jsx`) vs 실 페이지(`OrderManagementPage.jsx`) 차이 10건 적출. RPC 부채 1건, viewer 엑셀 권한 1건 부채 후보로 기록.
- 2026-06-10 알림톡 발송 결과 가시화 — `alimtalk_status`/`alimtalk_error`/`alimtalk_attempted_at` 컬럼 추가(backend 병렬)에 맞춰 발송 결과 DB 기록 사양 신설. 데스크톱 상태 셀·모바일 카드에 “알림톡 실패” 칩(error 토큰) 추가. 단건 paid 전환 시 알림톡 결과 수신 후 목록 재조회. 차이 적출 10번(알림톡 발송 트리거 UI 시그널 없음) 부분 해소.
- 2026-07-15 주문 코어 고도화 (P1+P2+P3) — (P2) 목록 상태 Select를 상태기계(`ALLOWED_TRANSITIONS`·`getStatusOptions`, `orderStatus.js`)로 필터: 단독 행·합배송 자식 행 모두 현재 상태 선두+허용 전이만 노출, completed 전이는 목록 금지(출고관리 전용), 종결(completed·cancelled·refunded)은 읽기전용 배지. 합배송 자식 행을 목록에서 직접 편집 가능(기존은 읽기전용 배지) — 대표 취소·환불 시 `classifyGroupStatusChange`(`utils/groupOrder.js`, GroupOrderModal과 공유 단일 소스)로 auto(1건 자동 위임)/pick(`ShippingPickModal`)/passthrough 분기. GroupOrderModal `handleStatusChangeIntercept`도 동일 함수로 리팩터(동작·문구 불변). (P1) 검색을 이름·연락처·ID·주문번호 다중 필드 `.or()`로 확장(연락처 하이픈 변형·주문번호 id.eq·콤마 방어). (P3) 엑셀 빌드를 `utils/orderExcel.js`로 추출(출고관리와 공유, 출력 바이트 불변). TDD: `orderStatus.test.js`·`groupOrder.test.js`·`orderExcel.test.js`.
- 2026-07-08 합배송 껍데기 부모 모델 — 트리 목록으로 전환. `is_group_parent` 껍데기 행(`#{대표} 외 N건` + [연계] 배지 + 유니크 이름 + 종합 상태 배지(읽기전용)+캡션 `summarizeGroupStatus`) + 자식 행 들여쓰기(borderLeft 1px grey.300, 개별 상태 읽기전용). 어느 행이든 클릭 = `GroupOrderModal`. 비연계 단독은 기존 행(상태 Select) 그대로. 체크박스·일괄 상태 변경은 껍데기 제외 실 주문만. `groupLinkedOrders`가 껍데기 자식합만 집계(중복 합산 제거), `buildOrderTree`/`summarizeGroupStatus`/`formatGroupCustomerNames`/`inferRepChild`는 `utils/groupOrder.js`. **후속: get_order_by_token·link_orders_into_group 마이그레이션 적용과 동시 배포 필요.** 검색은 자식 이름 매칭 시 껍데기 부모가 같은 페이지에 없으면 자식이 단독으로 surfacing(부모 병합은 후속 — 껍데기 선조회 미구현).
