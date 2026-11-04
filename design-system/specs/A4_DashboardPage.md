# 사양 시트 — A4 대시보드 (DashboardPage)

> 이 시트는 어드민 대시보드 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-29 신설 (M3-12 시안 정합 사전 — 게이트 1.5 통과 목적).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/DashboardPage.jsx` (805줄)
- 시안: `inpsyt-order-frontend/src/components/DashboardDesignPreview.jsx` (317줄)
- 의존 모달: `inpsyt-order-frontend/src/components/OrderDetailModal.jsx` (607줄)
- 라우팅: `inpsyt-order-frontend/src/components/AdminLayout.jsx:72` (`/admin/dashboard`, `dashboard:view` 권한 가드)
- 사이드바 등록: `inpsyt-order-frontend/src/components/AdminSidebar.jsx:38`
- 관련 API: `inpsyt-order-frontend/src/api/orders.js`, `events.js` (`getEvents`만 보유 — 이 페이지는 `supabase.from('events')`로 직접 호출), `products.js` (`fetchAllProducts`)
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_TO_KOREAN`, `STATUS_COLORS`, `REVENUE_STATUSES`)
- DB 스키마:
  - `supabase/migrations/20250722065000_create_events_table.sql` (events 기본 컬럼)
  - `supabase/migrations/20260313060000_add_event_structured_fields.sql` (`event_year`, `host_society`, `event_season`, `status`)
  - `supabase/migrations/20260311_create_field_reports.sql` (field_reports 테이블 정의)
  - `supabase/migrations/20250722070000_create_orders_table.sql` + 후속 추가 컬럼 마이그레이션 다수
  - `supabase/migrations/20260415_002_add_order_item_snapshots.sql` (order_items 스냅샷 컬럼)
- 시안 인프라: `inpsyt-order-frontend/src/components/ui/` (`PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`), `inpsyt-order-frontend/src/components/preview/PreviewShell.jsx`
- 알림톡 발송 사양: 이 페이지는 직접 발송 호출 없음. 상세 모달(`OrderDetailModal`) 안에서만 발생.

## 사용자 시나리오
인싸이트 직원(master·editor·viewer, `dashboard:view` 권한 보유)이 데스크톱 혹은 태블릿에서 본다. 학회 중에는 학회장 부스에서 학회·일자 필터를 잠시 좁혀 "오늘 접수" 카드와 "처리 필요(결제대기·결제완료) 알림"으로 현장 처리 상황을 빠르게 잡는다. 학회 종료 후 사무실에서는 연도·학회 누적 모드로 보고 판매 순위·매출 비교(YoY)를 짚고, 같은 화면에서 현장 보고서를 작성·저장한다. 최근 5건 주문은 클릭 시 상세 모달이 열려 즉시 편집 가능. 페이지는 `dashboard:view` 권한이 없으면 라우터에서 차단(`/admin`으로 리다이렉트, `AdminLayout.jsx:72`).

## 진입 흐름
- [ ] `/admin/dashboard` 라우트 — 어드민 진입 시 기본 리다이렉트 대상(`AdminLayout.jsx:71`)
- [ ] 권한 가드: `dashboard:view` 없으면 `/admin`으로 리다이렉트 (line 72)
- [ ] 초기 진입: `init()` 으로 events·societies·products 동기 fetch(line 370-403), 그 후 `fetchData()`가 `selectedEventIds`/`selectedYear`/`selectedSociety`/`selectedDate`/`productsMap` 의존 useEffect로 즉시 1회 실행(line 570)
- [ ] 최근 주문 행 클릭 → `OrderDetailModal` 오픈 (`handleRowClick`, line 574). 모달 `onUpdate=fetchData` 로 상태 변경 시 자동 재집계

## 표시 정보 (라벨 단위, 누락 금지)

### 페이지 헤더 (line 587-596)
- [ ] `DashboardIcon` (primary.main, fontSize 1.4rem) — 페이지 제목 아이콘
- [ ] 페이지 제목 텍스트: "대시보드" (Typography variant h6, fontWeight 700)
- [ ] 새로고침 IconButton — `RefreshIcon`, 회전 애니메이션 (`refreshing` 상태), 비활성 조건 `refreshing || loading`
- [x] ~~입금결의서 내보내기 버튼~~ — **제거(2026-06-10 건우님 확정).** 진입점을 **L2 학회 상세(`L2_EventDetail.md` 헤더 액션)로 일원화.** 대시보드의 버튼·`handleExportDeposit`·`exporting` 상태·`DownloadIcon`·`profile/user` 의존 모두 소거. export 로직(`src/utils/depositResolution.js`)과 셀 매핑 사양은 L2 쪽에서 동일하게 사용(작성자/부서 자동 채움 포함).
- [ ] (시안만 보유) 헤더 subtitle = `dashboardData.eventName` — 실 페이지는 헤더에 부제가 없고, 매출 카드 상단(line 685)에 별도 표시. **확인 필요** — 시안의 subtitle 위치로 옮길지 결정
- [ ] (시안만 보유) "새로고침" 텍스트 + outlined Button — 실 페이지는 아이콘 단독 IconButton. 두 패턴 중 결정 필요

### 계층 필터 카드 (line 598-675)
필터는 3단 계층(연도 → 학회 → 상세 행사) + 일자 칩 다단으로 구성. 단순화 금지.

- [ ] 연도 Select: 라벨 "연도 보기", 옵션 = `<em>전체 연도</em>` + `years` (events에서 `event_year` 우선, 없으면 `start_date`의 연도, 내림차순) — line 601-607
- [ ] `ChevronRightIcon` 디바이더 (모바일 숨김) — line 608
- [ ] 학회 Select: 라벨 "학회", 옵션 = `<em>모든 학회</em>` + `societies` (societies 테이블 name, 이름순 asc) — line 609-615
- [ ] `ChevronRightIcon` 디바이더 (모바일 숨김) — line 616
- [ ] 상세 행사 Select(`multiple`): 라벨 "상세 행사" — line 617-649
  - 멀티 선택, OutlinedInput
  - renderValue 규칙:
    - 빈 배열 + 필터링된 학회 행사 1건 이상 → "전체 합산"
    - 빈 배열 + 필터링된 행사 0건 → "관련 행사 없음"
    - 1건 선택 → 해당 학회명
    - 2건+ 선택 → "N개 선택"
  - 옵션 행: Checkbox + ListItemText(primary=`ev.name`, secondary=`formatEventStartDate(start_date)` 또는 "시작일 미정")
  - 옵션 정렬·렌더(2026-07-13): `filteredEventsForDropdown`에 `groupEventsForDropdown` 적용 — 오늘±7일 이내 시작 학회를 상단 고정, 그 다음 나머지(각 그룹 start_date 내림차순). 상단 고정 그룹과 내림차순 그룹 사이 `<Divider/>`로 구분(양쪽 그룹 모두 있을 때만). `src/utils/eventSort.js`
  - 관련 행사 없음 시 disabled MenuItem "관련 행사 없음" 노출
- [ ] 일자 칩(`availableDates.length > 1` 일 때만 노출)
  - **`availableDates` = 단일 상세 행사(`selectedEventIds.length === 1`)의 주문에서 '실제 매출(주문) 발생한 지난 날짜'만 distinct·KST·정렬** (2026-06-01 건우님). `start~end` 전체 enumerate 금지 — 검수/테스트 행사는 1년 내내라 365일 폭주(또 과거엔 전 행사 min→max로 145일+ 버그). 주문 없는 날은 칩 미생성. 넓은 범위/다중 선택 → `[]`(일자 탭 없이 전체 기간만). 2일짜리 행사도 주문 있는 날만(둘 다 있으면 1·2일차)
  - 서비스 현실: 연 8일(1일짜리 4 + 2일짜리 2). **1일짜리 행사 → 일자 탭 미표시(전체 기간만), 2일짜리 → 전체 기간·1일차·2일차**
  - "전체 기간" 칩 (선택 시 `selectedDate=null`, filled primary)
  - 각 일차 칩: `{idx+1}일차 · {date.slice(5)}` 라벨, 클릭 토글 — `selectedDate === date` 면 해제, 아니면 설정
- [ ] 계층 캐스케이드 리셋(side effect):
  - `selectedYear`/`selectedSociety` 변경 → `selectedEventIds=[]`, `selectedDate=null` (line 431)
  - `selectedEventIds` 변경 → `selectedDate=null` (line 432)

### Row 1 — 매출 현황 카드 (시안 정합본: hero 총매출 + 오늘접수 박스 + sub 2장)
> **2026-06-02 매출 합산 구조 변경 (건우님 승인):** 별도 `shippingRevenue` 버킷 폐기. 배송비를 검사/도서에 할당(검사 우선, 도서만 있는 주문이면 도서). `computeRevenueByCategory`(공용 유틸) 단일 소스. 매출 정의 = **결제완료(`['paid','completed']`)만** — 이전엔 `cancelled/refunded`만 제외해 `pending`(결제대기)도 매출·랭킹에 포함됐으나, 결제완료 기준으로 통일(매출·랭킹 정합).
- [ ] 헤더 subtitle: `{dashboardData.eventName}` (예: "전체 기간 누적 합계", "2026년 한국심리학회 누적 합계", "3개 행사 합계", 행사 1건 선택 시 해당 학회명)
- [ ] hero StatCard: **총 매출액** (`totalRevenue` = test + book + tool + unclassified) — `ReceiptIcon`, color `theme.accent.revenue`, **`yoyPct` trend pill (전년 동조건 비교, final_payment 기반)**
- [ ] 오늘 접수 박스 (Row 1 우측) — `todayOrdersCount`, `CartIcon`, `theme.accent.attention`
- [ ] sub StatCard **1~3장 동적 분할** (모바일 column, 데스크톱 row, flex:1 균등). **0원 버킷은 숨김** (`.filter(b => b.revenue > 0)`) — 판매 대분류 수에 따라 1~3열:
  - **검사 판매 (배송비 포함)** (`testRevenue`) — `TestIcon`, color `theme.accent.tests`
  - **도서 판매 (배송비 포함)** (`bookRevenue`) — `BookIcon`, color `theme.accent.books`
  - **도구 판매 (배송비 포함)** (`toolRevenue`) — `ToolIcon`(Build), color `CATEGORY_COLORS.tool` (#6B7684) — **도구 독립 버킷(2026-06-24 건우님 확정, 도구-검사 합산 정책 영구 폐지)**
  - (배송비 단독 카드 폐기 — 검사/도구/도서 우선순위로 1곳 흡수)
  - **바우처(이벤트 결제수단, A13 §⑨, 2026-11-04):** 검사·도서·도구 카드 금액 = **카드 결제액**(버킷 − 버킷 바우처). 노출 조건은 그대로 **총 매출 버킷 > 0**(바우처로 전액 결제된 카테고리도 카드가 사라지지 않음). 바우처 합계(`voucher`) > 0이면 **"{용어} 결제" 카드 1장 추가**(`VoucherIcon`=ConfirmationNumber, color `theme.accent.shipping`, 금액=`voucher`). 바우처 0이면 렌더 안 함(기존 화면 회귀 0). `ordersQ` select에 `voucher_amount` 추가, 용어 = `useVoucherConfig().label`. 상세·단일 소스 = `A13_VoucherEvent.md`.
- [ ] `CompactKpi` 컴포넌트 형식 (line 51-72):
  - 아이콘 박스 (정사각, fontSize 28, color bg)
  - title (variant caption, fontWeight 600, text.secondary)
  - value (variant h5, fontWeight 800, color)
  - YoY Chip (`▲` / `▼` / `-` + 절대값 %, success/error 톤). `yoyPct` null이면 미노출
- [ ] **확인 필요** — yoyPct 조건: `selectedYear !== 'all' && selectedEventIds.length === 0` 만 계산 (line 477). 학회를 골랐을 때만 의미 있는 비교(같은 학회 vs 전년 동학회) 동작인지 시안에서 분기 표시 필요

### Row 2 — 판매 순위 (판매 있는 대분류만 동적 분할, 1~3열)
판매 내역 있는 버킷만 좌우 동일 너비(flex:1)로 노출. 전부 0건이면 검사·도서 두 빈 카드 기본 노출(빈 행 방지).

- [ ] 검사 판매 순위 (`testTop5`) — `TrophyIcon`, color `theme.accent.tests` (#2B398F). 도구·도서 라벨 제외 후 검사 판정
- [ ] 도서 판매 순위 (`bookTop5`) — `TrophyIcon`, color `theme.accent.books`
- [ ] 도구 판매 순위 (`toolTop5`) — `TrophyIcon`, color `CATEGORY_COLORS.tool` (#6B7684). **도구는 검사보다 먼저 판정**(검사도구 라벨이 검사 그룹에 끼지 않게 — 매출 버킷과 정합)
- [ ] `RankingBox` 내부 구조 (line 137-199):
  - 헤더: 아이콘 + 카드 제목 + "수량순" / "금액순" Chip 토글 (default 'quantity')
  - 행: 순위 숫자 (1~3위 컬러 강조), 상품명 (1~3위 fontWeight 600, 한 줄 ellipsis + Tooltip), 수량 Chip (`{totalQuantity}부`, 1위만 컬러 배경), 매출액(`totalAmount > 0` 시 caption)
  - 빈 상태: "판매 내역 없음"
  - 5건 초과 시 "전체 보기 (N개)" / "접기" 토글 버튼

### Row 3 — 오늘 접수 + 처리 필요 알림 + 주문 처리 현황 (line 713-750)
좌측(고정 280px, 모바일 100%)에 두 블록을 한 카드 안에 적재, 우측에 상태 막대.

#### 오늘 접수 내역 (line 718-725)
- [ ] 소제목: "오늘 접수 내역" (subtitle2, fontWeight 700)
- [ ] 아이콘 박스 (`CartIcon`, color `#F59E0B`, alpha bg)
- [ ] 카운트 (variant h4, fontWeight 800, color `#F59E0B`) — `{todayOrdersCount}건`
- [ ] 부제 (caption): `누적 {totalOrders}건 중 오늘 접수`
- [ ] 계산 기준: `order.created_at >= formatISO(startOfToday())` (line 504-510). **확인 필요** — `startOfToday()`는 로컬 타임존 0시 기준. KST 운영 환경 정합 OK(브라우저 KST 가정)

#### 처리 필요 알림 박스 (line 726-738, 조건부 `hasAlerts = pendingCount > 0 || paidCount > 0`)
- [ ] 박스 색: alpha `#F59E0B`, 호버 시 진해짐, cursor pointer
- [ ] 클릭 → `navigate('/admin/orders')` (필터 없는 일반 진입)
- [ ] 헤더: `WarningIcon` + "처리 필요 알림" (caption, fontWeight 800, color `#F59E0B`)
- [ ] 항목(조건부):
  - `결제대기 N건` (`pendingCount > 0`)
  - `결제완료(출고대기) N건` (`paidCount > 0`)
- [ ] **0건일 때(`!hasAlerts`)**: 공백 대신 **한적한 빈 상태 카드** — `EmptyState` 제목 "처리하실 주문이 없어요" / 부제 "들어온 주문을 모두 처리했어요" (2026-06-01 건우님 — 공백 제거). 라벨 "결제완료(출고대기)"는 운영자 인식 보존

#### 주문 처리 현황 (StatusBar, line 75-134, 우측 카드)
- [ ] 소제목: "주문 처리 현황" (실 페이지: StatusBar 내부 line 84 / 시안: SectionCard title)
- [ ] 가로 막대 (height 28, 모서리 둥글림):
  - 5개 상태(`pending`/`paid`/`completed`/`cancelled`/`refunded`)를 0건 아닌 것만 segment 화
  - 색: `STATUS_COLORS` 매핑 — pending `#F59E0B` / paid `#10B981` / completed `#6366F1` / cancelled `#EF4444` / refunded `#F43F5E`
  - segment 비율 = `count / totalOrders`, flex 비례
  - 5% 초과 segment만 안에 숫자 라벨 노출
  - 클릭 → `navigate('/admin/orders?status={status}')`
  - Tooltip: `{한국어 상태}: N건 (X.X%)`
- [ ] 범례 (segment 칩 모음):
  - 색 점 + `{한국어 상태} {count}`
  - 클릭 → 동일 navigate
- [ ] 안내 텍스트: "상태 클릭 시 주문관리로 이동 →" (caption, 우측 정렬, text.disabled)
- [ ] 빈 상태: `totalOrders === 0` 시 컴포넌트 자체 null 반환

### Row 4 — 현장 보고서 + 최근 주문 (line 752-786)
좌우 50/50.

#### 현장 보고서 (`FieldReportSection`, line 202-337)
- [ ] 조건: `selectedEventIds.length === 1` 인 경우만 실 데이터 fetch (line 757에서 `selectedEventIds.length === 1 ? selectedEventIds[0] : null` 전달)
- [ ] `eventId` 없거나 'all'이면 안내문만: "특정 행사를 선택해야 보고서를 작성할 수 있습니다." — line 267-273
- [ ] 헤더: `EditIcon` + "현장 보고서" 제목 + (작성 모드 아닐 때) "보고서 작성" outlined 버튼 (`AddIcon`)
- [ ] 보고서 카드 리스트 — `report.day_number`(1~5) Chip, `author_name`, "편집" / "삭제" 아이콘, 본문 `pre-wrap`
- [ ] 작성/편집 폼 (`isEditing` 시):
  - 일차 Select (1~5)
  - 작성자 TextField
  - 본문 multiline TextField (minRows 5, maxRows 15)
  - 취소 / 저장 버튼
- [ ] 신규 작성 시 본문 자동 채움 템플릿 — `${eventName} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: {testRev}원\n도서 판매: {bookRev}원\n합계: {totalRev}원\n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.` — line 263
- [ ] 삭제 확인 Dialog (Dialog open, "이 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")
- [ ] **시안 누락** — 시안(line 277-283)은 "특정 행사를 선택하면 보고서를 작성할 수 있습니다" 안내문 외 다른 상태 표현 없음. 작성 모드·리스트·일차 칩·작성자·저장/취소 UI 전부 미반영

#### 최근 주문 (line 761-785)
- [ ] 소제목: "최근 주문 실시간 내역" (실 페이지) / "최근 주문" (시안)
- [ ] 최대 5건 (`recentRes` limit 5, `order_items(*, products(*))` 중첩 join)
- [ ] 행 표시:
  - 고객명 (`order.customer_name`, body2, fontWeight 600)
  - 상태 Chip (`STATUS_TO_KOREAN[status]`, 색 = `STATUS_COLORS[status]` alpha 0.12 bg + 본색 font)
  - 결제금액 (`order.final_payment.toLocaleString()`원, primary.main, fontWeight 800)
  - 일시 (`format(created_at, 'MM/dd HH:mm')`, caption, text.disabled)
- [ ] 행 클릭 → `OrderDetailModal` 오픈 (`handleRowClick`)
- [ ] 빈 상태: "주문 내역이 없습니다"
- [ ] **시안 차이** — 시안은 행 좌측에 고객 첫 글자 이니셜 아바타(36×36) 노출(line 290-293), 실 페이지는 아바타 없음. 추가 시각 장식인지 결정 필요(CLAUDE.md E절)

## 액션·기능 (누락 금지)

### 필터·캐스케이드
- [ ] 연도 변경 → `selectedYear` 변경 → 캐스케이드 리셋(`selectedEventIds=[]`, `selectedDate=null`) → `filteredEventsForDropdown` 갱신 → `fetchData` 자동 호출
- [ ] 학회 변경 → 동일 캐스케이드
- [ ] 상세 행사 변경 → `selectedDate=null` → `fetchData`
- [ ] 일자 칩 클릭 → `selectedDate` 토글 → `fetchData`
- [ ] 새로고침 버튼 → `setRefreshing(true)` → `fetchData()`

### 집계 로직(`fetchDataForEventIds`, line 456-545)
- [ ] `selectedEventIds.length === 0` 시: `filteredEventsForDropdown.map(e=>e.id)` 가 대상 (연도·학회 조건 하 전체 합계)
  - 라벨: `{selectedYear !== 'all' ? '{year}년 ' : ''}{selectedSociety} 누적 합계` 또는 `{selectedYear !== 'all' ? '{year}년 ' : '전체 기간 '}누적 합계`
- [ ] `selectedEventIds.length === 1` 시: 해당 행사명
- [ ] `selectedEventIds.length >= 2` 시: `N개 행사 합계`
- [ ] 일자 필터 활성 시: `created_at >= dateFrom (KST 0시)` and `<= dateTo (KST 23:59:59.999)` — 양 끝 포함 (line 465-466)
- [ ] 매출 계산 — **결제완료(`['paid','completed']`)만** (`computeRevenueByCategory` 내부 `PAID_STATUSES`). `pending`/`cancelled`/`refunded`는 매출·랭킹에서 제외. `statusCounts`·`todayOrdersCount`에는 전체 포함. (2026-06-02 변경 — 이전엔 pending도 매출 포함이었음)
- [ ] 카테고리 분류 (`computeRevenueByCategory`, 2026-06-24 도구 독립 3버킷):
  - 도구 매출: category가 `도구` 또는 `tool` 포함 (`검사도구`처럼 검사+도구 동시 라벨은 **도구 우선**)
  - 도서 매출: category가 `도서` 또는 `book` 포함
  - 검사 매출: 도구·도서 아니면서 `검사`/`test` 포함
  - **미분류(`unclassified`)**: 셋 중 어디에도 안 맞음 → 별도 버킷 + 콘솔 경고(집계 오염 방지). **"그 외=검사" fallback 영구 폐지**
  - 배송비 할당(주문당 1회, 우선순위 **검사 > 도구 > 도서**): 가장 우선순위 높은 버킷 1곳으로만 귀속. 미분류만 있는 주문은 미분류로 귀속
- [ ] `totalRevenue = testRevenue + bookRevenue + toolRevenue + unclassified` (각 버킷에 배송비 포함됨). **도구 분리 전후 total 불변**(미분류 0일 때 회귀 0 — 도구가 검사에서 빠져 tool로 이동할 뿐)
- [ ] YoY 계산: `selectedYear !== 'all' && selectedEventIds.length === 0` 일 때만 전년 동조건 (같은 host_society·tags 매칭) 전체 매출 비교. `prevTotal > 0` 일 때만 표시
- [ ] **확인 필요** — YoY는 전년 주문 fetch 시 `final_payment` 만 끌어와 합산하고 취소·환불 분리 안 함(line 488-491). 매출 정의 불일치 부채

### 최근 주문
- [ ] 5건 한정, 정렬 = `created_at desc`
- [ ] 행 클릭 → `OrderDetailModal` 오픈, 모달 `onUpdate=fetchData` 로 변경 후 재집계

### 현장 보고서 CRUD
- [ ] 조회: `field_reports` where `event_id = selectedEventIds[0]` order by `day_number asc, created_at desc`
- [ ] 신규: `insert { event_id, content, day_number, author_name }`
- [ ] 수정: `update { content, day_number, author_name, updated_at: now() }` where `id`
- [ ] 삭제: `delete` where `id` (Dialog 확인 필요)

### 모달 연동
- [ ] `OrderDetailModal` 호출 시 `events`/`products`/`productsMap`/`hasPermission`/`addNotification`/`statusToKorean` 모두 전달 (line 792-799)
- [ ] 모달의 `onUpdate=fetchData` — 상태 변경·삭제·연계 후 대시보드 자동 재계산

## 권한별 차이

`useAuth().hasPermission(key)` 호출 기준:

- [ ] **master/editor/viewer**: 라우터에서 `dashboard:view` 권한이 있어야 진입(AdminLayout.jsx:72). 권한 없으면 `/admin`으로 리다이렉트
- [ ] **`dashboard:view` 만 있는 viewer**: 필터·새로고침·집계 표시·최근 주문 클릭·현장 보고서 CRUD 모두 동일하게 동작 — **확인 필요** — 현장 보고서 작성/편집/삭제가 viewer에게 열려 있다(line 282 작성 버튼·line 316-318 편집/삭제 IconButton에 권한 가드 없음). field_reports RLS도 `authenticated` 전체 허용 상태(`20260311_create_field_reports.sql:17-27`). 정책 의도가 맞는지 CTO 검수 권장
- [ ] **`orders:view`/`orders:edit` 권한이 별도로 필요한 자리**:
  - 최근 주문 행 클릭 시 `OrderDetailModal` 내부 동작은 그 모달의 권한 분기를 따름 — 대시보드 자체는 클릭은 막지 않음

## 데이터 모델

### `events` 테이블 (이 화면에서 SELECT)
- `id` (bigint)
- `name` (text) — 학회명
- `start_date` (date), `end_date` (date) — 일자 칩·기간 필터
- `tags` (text[]) — `selectedSociety` 매칭에 사용 (legacy fallback)
- `event_year` (integer) — 연도 필터의 1차 출처. null이면 `start_date`의 연도 사용
- `host_society` (text) — `selectedSociety` 매칭의 1차 출처
- `event_season` (text) — 이 페이지는 사용 안 함 (`A5`에서 사용)
- 정렬: `start_date desc`

### `societies` 테이블 (이 화면에서 SELECT)
- `id`, `name` — 학회 드롭다운 옵션
- 정렬: `name asc`
- **확인 필요** — `supabase/migrations/` 어디에도 `societies` 테이블 CREATE SQL이 없음. `EventManagementPage`·`SocietyManagementDialog`·`A5` 사양 시트는 이 테이블을 전제로 동작 중. 마이그레이션 누락 부채로 추정(`bulk_update_order_status` RPC와 동일 패턴). CTO 검수 권장

### `products` 테이블 (전수 fetch, page-size 1000 페이지네이션)
- 모든 컬럼 fetch (`select '*'`, line 377)
- `productsMap` = `{[id]: product}` 구조로 메모리 저장
- 사용처: order_items에 스냅샷 컬럼이 없는 구주문(legacy) 대비 보조 매핑(line 518-521 `prod?.name`/`prod?.category` fallback)

### `orders` 테이블 (이 화면 집계 대상 SELECT)
- 집계 쿼리(`ordersQ`, line 468): `id, final_payment, delivery_fee, status, created_at, order_items(product_id, quantity, price_at_purchase, product_name, product_code, category, list_price)`
- 최근 주문(`recentQ`, line 469): `*, events(name), order_items(*, products(*))` — limit 5
- 필터: `in('event_id', eventIds)` + (옵션) `gte('created_at', dateFrom).lte('created_at', dateTo)`
- 전년 YoY(`prevOrders`, line 488): `final_payment` 만 select, `in('event_id', prevYearEvents)`

### `field_reports` 테이블
- `id` (uuid)
- `event_id` (bigint, FK → events) — NOT NULL
- `report_date` (date, default `CURRENT_DATE`)
- `day_number` (int, default 1) — 1~5일차
- `content` (text) — NOT NULL
- `author_name` (text, nullable)
- `created_at`, `updated_at` (timestamptz)
- RLS: `authenticated` 전체 CRUD 허용 (`20260311_create_field_reports.sql`)
- **확인 필요** — 권한 가드 없이 모든 어드민이 모든 보고서 편집·삭제 가능. 의도된 정책인지 CTO 검수 필요

### 집계 산출 객체 `dashboardData` (state)
- `eventName` (string)
- `totalRevenue`, `bookRevenue`, `testRevenue`, `toolRevenue` (number, 원). **검사·도서·도구는 배송비 포함값(총 매출, 바우처 포함). `shippingRevenue` 폐기(2026-06-02).** `testShipping`/`bookShipping`/`toolShipping` 각 버킷 귀속 배송비. total = test + book + tool + unclassified (2026-06-24 도구 독립 3버킷).
- `testVoucher`/`bookVoucher`/`toolVoucher`/`voucher` (number, 원, A13 §⑨ 2026-11-04) — 버킷별 바우처 결제분·합계. 카드 결제액 = 버킷 − 버킷 바우처(렌더에서 계산). 바우처 없는 학회는 전부 0.
- `yoyPct` (number | null) — 전년 동조건 대비 % (절대값+삼각형은 표시 시 가공)
- `totalOrders` (number) — 취소·환불 포함 전체 건수
- `statusCounts` (object) — 5상태별 건수
- `bookTop5`, `testTop5`, `toolTop5` (array) — 사실은 상한 없는 정렬된 전체 리스트. `RankingBox`에서 5건 잘라 노출. 도구는 검사보다 먼저 판정해 분리
- `todayOrdersCount` (number)
- `recentOrders` (array) — 5건

## 필터·뷰 모드

- 연도: 단일 선택 (Select), 기본값 `'all'`
- 학회: 단일 선택 (Select), 기본값 `'all'`
- 상세 행사: 멀티 선택 (Select multiple), 기본값 `[]`
- 일자: 단일 선택 토글 (Chip), 기본값 `null`. `availableDates.length > 1` 일 때만 노출
- 매출 정렬: `RankingBox`마다 'quantity' / 'amount' 토글, 기본 'quantity'
- 정렬: 최근 주문 `created_at desc` 고정, 랭킹은 토글 따라
- 페이지네이션 없음 — 단일 페이지 집계 전용

## 빈 상태·로딩·오류 처리

- [ ] 초기 로딩 (events 0 + loading): 중앙 정렬 `CircularProgress` 단독 (line 577-579)
- [ ] 집계 로딩 (loading): py 8 `CircularProgress` (line 678)
- [ ] 빈 결과 (`eventIds.length === 0`): `dashboardData` 가 0/[]/{} 초기값으로 세팅(line 458-461). 매출/랭킹/오늘 접수 모두 0 표시
- [ ] 랭킹 빈 상태: `RankingBox` 안 "판매 내역 없음"
- [ ] 최근 주문 빈 상태: "주문 내역이 없습니다"
- [ ] 현장 보고서 빈 상태:
  - 행사 미선택: "특정 행사를 선택해야 보고서를 작성할 수 있습니다."
  - 행사 선택 + 보고서 0건: "생성된 보고서가 없습니다"
  - 로딩: `CircularProgress size 20`
- [ ] 오류: 전부 `console.error`만, 사용자 가시 토스트 없음 — **확인 필요** (시안 정합 사이클에서 잡을 부채)

## 시안(DashboardDesignPreview) vs 실 페이지 — 차이 적출

frontend 사이클(M3-12 본 작업)이 흡수해야 할 항목:

1. **헤더 subtitle 도입 vs 매출 카드 안 행사명 위치.** 시안은 `PageHeader subtitle={data.eventName}` (line 174). 실 페이지는 매출 카드 안 제목으로 `{eventName} 매출 현황`. 두 가지 동시 노출은 중복이라 어느 자리에 둘지 결정 필요.
2. **새로고침 버튼 형식.** 시안 outlined Button("새로고침" 텍스트 + 아이콘). 실 페이지 IconButton 단독. 두 패턴 중 선택.
3. **매출 카드 레이아웃 — 시안에서 정보 추가됨.** 시안은 총 매출(`hero` 변형 StatCard) + YoY trend + "오늘 접수" 박스를 매출 카드 상단에 같이 배치하고(line 211-226), 하단에 검사·도서·배송비 3장. 실 페이지는 4장 가로 + 오늘 접수는 Row 3에 별도 분리. 정보 구조가 다름(매출 4개 KPI vs 총매출+세부 3개). 어느 쪽이 채택안인지 명시 필요.
4. **`CompactKpi` vs `StatCard`.** 실 페이지는 `CompactKpi`(이 파일 내부 정의, line 51), 시안은 `ui/StatCard`(공용). 시안 정합 = 공용 컴포넌트 채택 필요.
5. **주문 처리 현황 가로 막대 두께.** 실 페이지 height 28 + segment 내부 숫자. 시안 height 10 + 외부 칩 라벨에 숫자. 정보량 차이.
6. **"처리 필요 알림" 노출 조건.** 실 페이지: `pendingCount > 0 || paidCount > 0` 일 때만(line 583). 시안: 항상 노출. 0건일 때 빈 카드 노출이 의도된 패턴인지 결정 필요.
7. **"처리 필요" 라벨 차이.** 실 "결제대기" / "결제완료(출고대기)" vs 시안 "결제대기" / "출고 대기". 일관성 필요.
8. **상품 랭킹 행 정보량.** 실 페이지는 1위만 Chip 컬러 강조 + 수량 단위 "부" + 매출 caption. 시안은 1~3위 컬러 강조 + 수량/매출을 둘 다 행에 노출(정렬 토글에 따라 주/보조 자리 바뀜). 시안이 더 풍부. 시안 정보량으로 정합.
9. **랭킹 정렬 토글 UI.** 실 페이지 Chip 두 개. 시안 `ToggleButtonGroup`. 어드민 공통 패턴 선택 필요.
10. **현장 보고서 — 시안 미반영.** 시안은 "행사 선택 시 보고서 작성" 안내 1줄만. 실 페이지의 CRUD 인터페이스(작성 폼·일차 Chip·작성자·삭제 Dialog) 전부 누락. M3-12에서 채택안 흡수 결정 필요.
11. **최근 주문 아바타.** 시안은 고객 첫 글자 이니셜 아바타. 실 페이지 없음. AI 산출물 시그니처(CLAUDE.md E절 — 의미 없는 시각 장식)인지 판정 필요.
12. **모바일 변형.** 실 페이지는 `useMediaQuery('md')` 분기로 KPI/Row 레이아웃을 column으로 전환. 시안의 PreviewShell도 데스크톱 레이아웃 위주. 모바일 변형 별도 명시 필요.
13. **계층 필터 디바이더 아이콘.** 실 페이지 `ChevronRightIcon`(text.disabled). 시안 동일. OK.
14. **일자 칩 라벨 형식.** 실 페이지 `{idx+1}일차 ({date.slice(5)})` (`MM-DD`). 시안 `{idx+1}일차 · 04-18` (구분자 `·`). 라벨 톤만 조정.

## 핵심 발견 (메인 Claude·CTO 검수 시 반드시 확인)

1. **`societies` 테이블 마이그레이션이 누락된 부채.** 이 페이지·`A5 EventManagementPage`·`SocietyManagementDialog` 모두 `societies` 테이블을 전제로 동작하나, `supabase/migrations/` 어디에도 CREATE SQL이 없다. 코드는 작동 중 → Supabase 콘솔에서 수동 생성된 것으로 추정. `bulk_update_order_status` RPC 누락과 같은 부채 패턴. 신규 환경 배포 시 깨질 수 있음. CTO 검수 권장(A1 사양 시트에도 동일 패턴 기록되어 있음 — 정합).

2. **현장 보고서(field_reports) RLS·권한 가드가 사실상 무가드.** 마이그레이션은 `authenticated` 전체 CRUD 허용, UI에도 `hasPermission` 분기 없음. viewer 권한 사용자도 다른 사람이 쓴 보고서를 편집·삭제 가능. 실 운영 의도가 맞는지 확정 필요. RLS 완화는 금지지만 강화는 백로그로 검토 가능. CTO 검수 권장.

3. **YoY 계산이 매출 정의와 불일치.** 본 집계는 `cancelled`/`refunded`를 매출에서 제외하지만, YoY 전년 비교는 `final_payment` 만 끌어와 합산(상태 필터 없음, line 488). 같은 정의로 맞추거나, 시안의 YoY 표시에 "취소/환불 포함" 주석을 박아야 한다. 부채 후보.

4. **`도구` 카테고리가 "검사 판매액"에 합쳐진다.** line 527의 조건 `cat.includes('도구') || cat.includes('tool')` 가 testRevenue에 합산되고, `testTop5` 필터에도 동일하게 들어간다(line 538). 사업 정의상 도구(검사 도구류)가 검사 카테고리에 묶이는 게 맞는지 확인 필요. D17 카테고리 토큰(`category-tool`)이 별도로 등재된 상태와 정합 안 맞을 수 있음.

5. **YoY 비교 조건이 좁다.** `selectedYear !== 'all' && selectedEventIds.length === 0` — 즉 "어떤 연도·어떤 학회"를 골라 누적 합계로 봤을 때만 표시. 행사 1건 선택(가장 흔한 운영 화면) 시에는 YoY 없음. 의도된 디자인인지 명시 필요. 시안에 표시 조건을 박아야 흡수가 정확해진다.

6. **상품 전수 fetch 비용.** 진입 시 `fetchAllProducts`로 페이지네이션 1000씩 끝까지 끌어오고 `productsMap` 메모리 적재(line 374-384). 신상품 등록이 폭증하지 않는 한 부담 없는 규모(연 800건 운영). 단, 신규 환경에서 products가 수만 건이 된다면 N+1 위험. 부채 후보로 기록.

## 변경 이력
- 2026-11-04 **이벤트 결제수단(바우처) 반영 (A13 §⑨, frontend-engineer).** Row 1 검사·도서·도구 카드 금액 = 카드 결제액(버킷 − 버킷 바우처), 노출 조건은 총 매출 버킷 > 0 유지. 바우처 합계 > 0이면 "{용어} 결제" 카드(`VoucherIcon`/`accent.shipping`) 1장 추가. `ordersQ` select에 `voucher_amount` 추가, `computeRevenueByCategory`에서 `testVoucher·bookVoucher·toolVoucher·voucher` 수신(dashboardData 적재), 용어 = `useVoucherConfig().label`. 바우처 0 학회는 글자 단위로 현행과 동일(회귀 0). 단일 소스 = `A13_VoucherEvent.md`. lint·test(458)·build 통과.
- 2026-06-24 **매출 3버킷화 — 도구 검사에서 분리 (건우님 확정, 도구-검사 합산 정책 영구 폐지).** `computeRevenueByCategory`가 검사/도서/도구 3버킷 + 미분류(unclassified, "그 외=검사" fallback 폐지·콘솔 경고) 반환. 배송비 우선순위 검사>도구>도서 한 곳 귀속. 반환 구조에 `tool`·`toolShipping`·`unclassified` 추가, `total` 정합 유지(도구 분리 전후 total 불변 — 수동 검증 1건 560,000원 동일). 매출 카드·판매 순위 모두 0원/0건 버킷 숨김으로 1~3열 동적 분할(flex:1). 입금결의서(`depositResolution.js`)에 도구 행(11행) 추가, placeholder 삭제 루프 12~15로 +1, 양식 .xlsx 무수정. 호출처 전부 수정: DashboardPage(집계·카드·랭킹), EventDetailPage(매출 카드·FieldReportSection revenueData), EventDetailPreview(시안 mock), FieldReportSection(보고서 자동 템플릿 — 도구 매출 있을 때만 한 줄 추가). `FulfillmentPage`의 도구→검사 정규화는 출고 물류 편의로 매출 무관·무변경. `categoryColors.js` 기존 `tool` 토큰 사용(변경 불필요). lint 클린(변경 6파일 신규 위반 0). `DashboardPage.test.jsx` 여전히 `describe.skip`. (frontend-engineer)
- 2026-06-10 **입금결의서 진입점 L2 일원화 (건우님 확정).** 헤더의 "입금결의서 내보내기" 버튼·핸들러·상태 제거 — L2 학회 상세 헤더의 입금결의서(작성자/부서 자동 채움)가 단일 진입점. 대시보드는 그 외 무변경(회귀 없음). (frontend-engineer)
- 2026-06-02 매출 합산 구조 변경 + 입금결의서 export (건우님 승인):
  - 매출 집계를 공용 유틸 `computeRevenueByCategory`로 교체. 별도 `shippingRevenue` 버킷 폐기 — 배송비를 검사/도서에 할당(검사 우선). 매출 카드 "검사 판매(배송비 포함)" / "도서 판매(배송비 포함)" / 총매출(=test+book) 2+hero 구조. 배송비 단독 StatCard 제거. `ShippingIcon` import 제거.
  - **매출·랭킹 기준 변경:** 결제완료(`paid`/`completed`)만. 이전엔 `cancelled/refunded`만 제외해 `pending` 매출 포함이었음 → 결제대기는 입금 전이라 매출 제외가 옳음(util `PAID_STATUSES` 단일 소스). 랭킹(`productSales`)도 동일 기준으로 정합(이전엔 매출↔랭킹 status 기준 불일치였음). YoY는 final_payment 기반 그대로(영향 없음).
  - 입금결의서 내보내기 버튼 신설(단일 상세 행사 선택 시). `src/utils/depositResolution.js`(ExcelJS) — 양식 워크북 로드 후 셀만 채움(병합·서식·로고 보존). **ExcelJS 신규 의존성(CTO 승인 대상).**
  - 현장보고서 자동 채움 템플릿 "0. 판매 (배송비 포함)"로 라벨 명시.
  - **미검증(권한 차단):** lint/build/양식 셀 실측은 Bash 권한 거부로 미실행 — 권한 확보 후 검증 필요.
- 2026-05-29 신설 — M3-12 시안 정합 사이클 사전 작성, 게이트 1.5 통과 목적. 시안 vs 실 페이지 차이 14건 적출. `societies` 테이블 마이그레이션 누락(2건째 부채), field_reports RLS 무가드(1건), YoY 매출 정의 불일치(1건), 도구 카테고리 분류 모호성(1건) 부채 후보로 기록.
- 2026-05-29 M3-12 frontend 사이클 — DashboardPage.jsx 시안 정합 (805→723줄). 시안 차이 14건 흡수:
  - #1 헤더 subtitle 도입 (eventName 자리 이동), 매출 카드 내부 제목 제거.
  - #2 새로고침 outlined Button + "새로고침" 텍스트 (IconButton 단독 폐기).
  - #3 매출 카드 레이아웃 시안 채택 — hero StatCard(총 매출+YoY trend) + 오늘 접수 박스 + sub StatCard 3장(검사/도서/배송비). 정보량 동일, 시각 구조 흡수.
  - #4 `CompactKpi`(로컬) → 공용 `StatCard` 교체. 로컬 정의 제거.
  - #5 StatusBar height 28→10, 외부 칩 범례에 건수 노출 (시안 패턴).
  - #6 처리 필요 알림 — **실 페이지 조건 보존**: `hasAlerts` true일 때만 노출. 0건 시 빈 카드 노출은 AI 시그니처(CLAUDE.md E절)로 판단해 채택 거부. → 사양 §확인필요 결론 명시.
  - #7 처리 필요 라벨 — **실 페이지 라벨 보존**: "결제대기" / "결제완료(출고대기)". 운영자가 상태와 매치 인식 중. → 사양 §확인필요 결론 명시.
  - #8 랭킹 행 정보량 — 시안 정보량 채택 (sortBy에 따라 주/보조 자리 바뀜, 1~3위 컬러 강조).
  - #9 랭킹 토글 — Chip → `ToggleButtonGroup` 교체.
  - #10 현장 보고서 — **CRUD 전체 보존**: 작성 폼·일차 Select·작성자·삭제 Dialog·자동 채움 템플릿 모두 유지. 시안의 안내문 1줄 패턴은 행사 미선택 빈 상태에만 적용. 정보 손실 0.
  - #11 최근 주문 이니셜 박스 — 단순 이니셜 박스로 채택 (테두리 없는 gray[100] 정사각, 장식 없음, 사양 결정에 따름).
  - #12 모바일 변형 — 반응형 분기 보존.
  - #13 디바이더 — OK 유지.
  - #14 일자 칩 라벨 톤 — `{N}일차 (MM-DD)` → `{N}일차 · MM-DD` (시안 톤).
  - 추가 흡수: 일자 칩 영역에 "일자" 레이블 노출(시안). raw hex 13건 → theme.accent/status/gray 토큰. raw borderRadius 11건 → theme.radii. raw boxShadow 5건 → MuiCard 기본값 의존. SectionCard 공용 헤더로 카드 헤더 일원화.
  - 보존: API 호출(events·societies·products·orders), YoY 계산 조건(`selectedYear !== 'all' && selectedEventIds.length === 0`), 매출 정의(취소·환불 제외), 카테고리 분류(`도구`→testRevenue 포함), 캐스케이드 리셋, 일자 칩, 상세 행사 multi-select renderValue, OrderDetailModal 연동(`onUpdate=fetchData`), field_reports CRUD, 권한 가드(`dashboard:view`는 라우터 단), navigate 라우팅 (`/admin/orders?status=...`).
  - 자동 검출 5종(raw hex / raw borderRadius / rgba / raw boxShadow / raw fontSize 문자열): 모두 0건.
  - 빌드 통과(12.11s). lint 신규 위반 0 (baseline 20→17, DashboardPage 'Icon' unused 2건 + useEffect deps 1건 해소).
  - 부채 미해결: §핵심 발견 1~6 모두 그대로(시안 정합 사이클 범위 밖). YoY 매출 정의 불일치·field_reports RLS 무가드는 백로그 유지. societies 테이블 마이그레이션 누락은 CTO 검수 대상.
