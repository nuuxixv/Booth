# 사양 시트 — A2 고객 주문 상태 (OrderStatusPage) — ⛔ 폐기

> **⛔ 폐기 (2026-10-19) — C3_OrderStatusPage.md 참조.** 이 시트는 C3_OrderStatusPage.md와 동일 화면(`OrderStatusPage.jsx`)을 중복 기술한다(README "중복 의심" 표기). 단일 진실 소스는 **C3_OrderStatusPage.md**이며, 준비중(preparing) 배너 등 신규 갱신은 C3에만 반영한다. 아래 본문은 과거 기록으로만 보존한다.

> 이 시트는 고객 주문 상태 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-26 신설 (M2 고객용 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderStatusPage.jsx` (297줄)
- 라우트: `inpsyt-order-frontend/src/App.jsx:49` — `/order/status/:token`
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_TO_KOREAN`, `STATUS_COLORS`)
- 알림톡 본문 링크: `inpsyt-order-frontend/src/api/alimtalk.js:30`
- 어드민 상세 모달 링크: `inpsyt-order-frontend/src/components/OrderDetailModal.jsx:352`
- 주문 제출 후 navigate: `inpsyt-order-frontend/src/components/OrderPage.jsx:193`
- RPC 정의: `supabase/migrations/20260407_rls_token_based_access.sql` 의 `get_order_by_token`, 갱신본 `supabase/migrations/20260415_004_update_order_functions.sql`
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20260406_add_access_token_to_orders.sql` + `20260406_add_status_history_to_orders.sql` + `20260415_002_add_order_item_snapshots.sql`

## 사용자 시나리오
의료 학회 부스에서 주문서를 제출한 의사·연구자가 두 경로로 진입한다. (1) 주문 직후 자동 navigate — `OrderPage`가 `create-order` 응답의 `access_token`을 받아 `/order/status/{token}`으로 이동, 또는 (2) `status=paid`로 변경되었을 때 받은 알림톡 본문의 링크를 탭. 본인이 카드 결제를 마치고 학회장을 떠난 뒤, 또는 며칠 후 도착 예정일을 확인하고 싶을 때 다시 들어와 본다. 토큰만으로 본인 주문 1건의 상태·상품·배송지·결제금액을 볼 수 있다. 인증 없음. 출고·배송 추적 기능은 없다 — 도착 예정일(`estimated_delivery_date`)을 안내하는 자리까지가 끝이다.

## 진입 흐름
- [ ] `/order/status/:token` 직접 진입 — `useParams`로 `token` 추출 (line 72)
- [ ] 자동 진입 #1 — 주문 제출 성공 시 `OrderPage`가 `data.order.access_token`을 사용해 `/order/status/{token}`으로 navigate (`OrderPage.jsx:193`)
- [ ] 자동 진입 #2 — 알림톡 본문의 상태 링크 (`status → paid` 트리거로 발송. `api/alimtalk.js:30`)
- [ ] 어드민에서 진입 — `OrderDetailModal`의 “고객 상태 화면 열기” 링크 (`OrderDetailModal.jsx:352`)
- [ ] 인증 불필요. 토큰만 있으면 누구나 1건 조회 가능 (UUID 추측 불가 — `20260406_add_access_token_to_orders.sql` 주석 참조)

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 상태 배너 (line 142-159)
- [ ] 배경색: `STATUS_COLORS[order.status]` 풀-블리드. 텍스트는 모두 흰색 계열 (`#fff` / `rgba(255,255,255,0.9)` / `rgba(255,255,255,0.65)`)
- [ ] 큰 이모지 — 상태별 분기 (`getBannerConfig`, line 17-67):
  - `pending` → ⏳
  - `paid` → 📦
  - `completed` → 🎉
  - `cancelled` → ❌
  - `refunded` → ↩️
  - 기타 → 📋 (fallback)
- [ ] 상태 라벨 (`banner.label`, h6 fontWeight 800): “결제대기” / “결제완료” / “처리완료” / “주문취소” / “결제취소”
- [ ] 보조 메시지 (`banner.subMessage`, body2 — 배열일 수도 단일 string일 수도. 배열이면 줄바꿈으로 표시):
  - `pending`: ① `estimated_delivery_date`(이하 `edd`) 있고 현장구매 아닐 때 — [“지금 결제 시 {M.d(E)} 도착”, “담당자를 통해 결제해 주세요.”]  ② 없으면 [“담당자를 통해 결제해 주세요.”]
  - `paid`: `edd`(현장구매 아닐 때만) 있으면 “{M.d(E)} 도착 예정”, 없으면 “출고 준비 중입니다.”
  - `completed`: `status_history`에서 `completed`로 바뀐 가장 최근 시각이 있으면 “{M.d(E)} 배송 출발”, 없으면 “배송 출발”
  - `cancelled`: “결제 전 취소된 주문건입니다.”
  - `refunded`: “결제 취소된 주문건입니다.”
- [ ] 접수 메타 캡션 (caption, white 65%): “{yyyy년 M월 d일 HH:mm 접수} · {events.name 있을 때만 학회명}” — line 155-158
- [ ] **중요: 현장구매(`is_on_site_sale=true`) 주문은 `edd`를 표시하지 않음.** `getBannerConfig` line 18에서 `!order.is_on_site_sale`일 때만 `edd`를 사용. 현장구매는 배송 안내 자체가 의미 없음.

### 취소 분기 (`status` ∈ {`cancelled`, `refunded`}, line 162-166)
- [ ] 섹션 제목 “취소된 주문 상품”
- [ ] `ItemsCard`에 `cancelled=true` 전달 → 상품명·합계 텍스트 `text.disabled` + 가로 취소선
- [ ] 결제 요약 카드·주문자 정보 카드·요청사항 카드는 **모두 숨김** (line 167의 else 분기로만 표시)

### 정상 분기 — 주문 상품 카드 (line 169-182)
- [ ] 연계 주문 있음 (`hasLinked=true`):
  - 섹션 제목 #1: “1차 주문 상품” → `firstOrder.order_items`로 `ItemsCard`
  - 섹션 제목 #2: “2차 주문 상품” → `secondOrder.order_items`로 `ItemsCard`, **칩 “추가 주문” 부착** (`primary.main` 배경, 흰 글씨, height 20, radius 6, fontSize 0.68rem)
- [ ] 단일 주문: 섹션 제목 “주문 상품” → `order.order_items`로 `ItemsCard` (칩 없음)
- [ ] **연계 순서 결정 규칙** (line 127-131):
  - 현재 주문에 `parent_order_id`가 있으면(=현재가 child) → parent가 1차, 현재 주문이 2차
  - 현재 주문이 parent(child_orders 있음) → 현재가 1차, child(첫 번째)가 2차
  - **child가 여러 개여도 두 번째까지만 보여줌. 3차 이상 child는 화면에 나타나지 않음** (line 93에서 `child_orders[0]`만 사용)

#### ItemsCard 내부 (line 274-295)
- [ ] 카드: 흰 배경, 1px divider 보더, radius 12, p 2, mb 3, 행 간 gap 1.5
- [ ] 칩(있을 때, “추가 주문” 등): flex-start 정렬, mb 0.5, 위 표시 정보 참조
- [ ] 각 행:
  - 좌측 상품명 (body2, lineHeight 1.4) — `item.product_name || item.products?.name || 상품 fallback`
  - 좌측 하단 메타 (caption, text.secondary) — “{category} · {quantity}개”. `category`는 `item.category || item.products?.category`
  - 우측 합계 (body2, fontWeight 600) — `price_at_purchase × quantity` 천 단위 콤마 + “원”
  - 취소 상태(`cancelled=true`)일 때: 상품명·합계 모두 취소선 + `text.disabled`, 합계 fontWeight 400
- [ ] **카테고리 칩 시각 강조 없음.** 출고 화면(A3)의 분류 칩(`도서`=#3B82F6, `검사`=#6366F1)과 달리, 고객 화면에서는 카테고리가 텍스트 메타로만 표시된다. 이건 의도된 차이 — 출고 운영자에게는 분리 작업 신호가 필요하지만 고객에게는 정보 정도만 충분.

### 결제 요약 카드 (line 184-223, 취소가 아닌 경우만)
- [ ] 카드: 흰 배경, 1px divider 보더, radius 12, p 2, mb 3
- [ ] 연계 주문 있음:
  - 행 1: 라벨 “1차 결제금액” (body2, text.secondary) / 값 `firstOrder.final_payment` 원
  - 행 2: 라벨 “2차 결제금액” / 값 `secondOrder.final_payment` 원
  - 구분선(1px divider, pt 1)
  - 행 3: 라벨 “합산 결제금액” (subtitle2, fontWeight 700) / 값 `totalFinalPayment` 원 (subtitle2, fontWeight 700, **색상 = 상태 배너 색**)
- [ ] 단일 주문:
  - 행 1: 라벨 “배송비” / 값 `delivery_fee === 0` 일 때 “무료”, 아니면 “{N}원”
  - 구분선
  - 행 2: 라벨 “최종 결제금액” (subtitle2, fontWeight 700) / 값 `final_payment` (색상 = 상태 배너 색)
- [ ] **합산 결제금액 계산**: `(order.final_payment ?? 0) + (linkedOrder.final_payment ?? 0)` — null 안전 (line 135-137)
- [ ] **연계 분기에는 배송비 행이 없음.** 단일 주문 분기에서만 표시. 시안에서 임의 추가 금지.
- [ ] **할인 금액·총 상품 금액 같은 세부 내역 표시 없음.** 고객은 최종 결제 금액만 본다. (어드민의 출고/상세 화면과 차이) 시안에서 임의 추가 금지.

### 주문자 정보 카드 (line 226-242)
- [ ] 섹션 제목 “주문자 정보”
- [ ] 카드: 흰 배경, 1px divider 보더, radius 12, p 2, mb 3, gap 0.75
- [ ] 행 구조: 라벨(body2, text.disabled, minWidth 56, flexShrink 0) + 값(body2)
- [ ] 표시 항목 (조건부):
  - “이름”: `customer_name`
  - “연락처”: `phone_number`
  - “인싸이트 ID”(조건부): `inpsyt_id` 있을 때만
  - **배송지 분기 (line 232-235)**:
    - `shipping_address.address` 있으면 → 라벨 “배송지”, 값 `address` + 공백 + (`detail` 또는 빈 문자열) 트림 (한 줄 공백 join)
    - 없으면 → 라벨 “배송”, 값 “현장 수령”
  - **여기서는 한 줄 통합 표시.** 입력·DB·출고 화면은 분리이지만, 고객 확인용 표시 자리는 한 줄로 통합되어 있다. C1 시트 핵심 발견 #6과 동일한 원칙.
- [ ] 우편번호(`shipping_address.postcode`)는 이 카드에 **표시되지 않는다.** 현 코드 그대로 (line 233은 `address` + `detail`만 join). 시안에서 임의로 우편번호를 추가하면 코드 동기 필요.

### 요청사항 카드 (line 245-250, 조건부)
- [ ] `order.customer_request`가 있을 때만 노출
- [ ] 카드: 흰 배경, 1px divider 보더, radius 12, p 2, mb 3
- [ ] 상단 라벨 “요청사항” (caption, text.secondary, fontWeight 600, mb 0.25)
- [ ] 본문 (body2) — `customer_request` 그대로
- [ ] **`OrderPage`의 현장구매 모드에서는 `customer_request`에 `[현장구매] ` 접두사가 박혀 있음** (`OrderPage.jsx:182`). 시안에서 이 prefix를 노출할지 숨길지 정책 결정 필요. **확인 필요.**
- [ ] **`admin_memo`는 표시되지 않는다.** 운영자 메모는 고객에게 노출 금지. 시안에 추가 금지.

### 문의 푸터 (line 254-262)
- [ ] 가운데 정렬, pb 5
- [ ] caption, text.disabled
- [ ] 텍스트: “문의사항이 있으신가요? {이메일 링크}”
- [ ] 이메일 링크: `mailto:inpsytorder@inpsyt.co.kr` (style color inherit) — 표시 텍스트 동일

## 액션·기능 (누락 금지)
- [ ] 진입 시 RPC 호출 — `supabase.rpc(get_order_by_token, { p_token: token })` (line 81-82). 1회만, 자동 갱신 없음.
- [ ] RPC 응답으로 `setOrder(data)` + 연계 주문 분기:
  - `data.parent_order` 있으면 → `linkedOrder = { role: parent, ...data.parent_order }`
  - 없고 `data.child_orders.length > 0` 이면 → `linkedOrder = { role: child, ...data.child_orders[0] }` (첫 번째 child만)
- [ ] 실패 시 `error` 메시지 “주문을 찾을 수 없습니다.” 후 fallback 화면 (line 95-96)
- [ ] **사용자 입력 없음.** 모든 액션은 표시만. 단일 외부 액션은 문의 이메일 링크.
- [ ] **출고/배송 알림 액션 없음.** “배송조회” 버튼·“운송장 보기” 링크 같은 것 일체 없음. 시안에 추가 금지(서비스 모델상 부재).
- [ ] **재발송 알림톡 요청 액션 없음.** 어드민에서만 가능한 영역. 고객 화면에 추가 금지.
- [ ] **주문 취소·환불 요청 액션 없음.** 카드 단말기·운영자 응대로 처리. 고객 화면에 추가 금지.

## 입력 폼 구조
이 화면은 입력 폼이 없다. 표시 전용.

## 권한별 차이
- **공개 화면 (anon).** 인증 없이 접근. 토큰(UUID)만 있으면 누구나 1건 조회 가능.
- 토큰은 UUID v4 → 추측 불가, URL 노출 안전 (`20260406_add_access_token_to_orders.sql` 주석)
- `get_order_by_token`은 `SECURITY DEFINER` — RLS 우회. anon/authenticated 모두 GRANT EXECUTE.
- 로그인 사용자(`master`/`editor`/`viewer`) 컨텍스트는 본 페이지와 무관.

## 데이터 모델

### RPC `get_order_by_token(p_token uuid) RETURNS json`
- 정의: `supabase/migrations/20260407_rls_token_based_access.sql`, 갱신본 `20260415_004_update_order_functions.sql` (스냅샷 컬럼 + products fallback 추가)
- 반환 JSON 객체 구조:
  - `id` (bigint)
  - `customer_name` (text)
  - `phone_number` (text)
  - `shipping_address` (jsonb 객체) — `{ postcode, address, detail|detailAddress, ... }`
  - `final_payment` (numeric)
  - `delivery_fee` (numeric)
  - `status` (text — `pending`/`paid`/`completed`/`cancelled`/`refunded`)
  - `created_at` (timestamptz)
  - `customer_request` (text, nullable)
  - `inpsyt_id` (text, nullable) — `20260415_004` 버전에서 추가
  - `is_on_site_sale` (boolean)
  - `status_history` (jsonb array — `[{status, changed_at}, ...]`)
  - `parent_order_id` (bigint, nullable)
  - `events` (object) — 전체 row (`id`, `name`, `discount_rate`, `tags`, `start_date`, `end_date`, `order_url_slug`, `estimated_delivery_date` 등)
  - `order_items` (array):
    - `quantity`, `price_at_purchase`
    - `product_name`, `product_code`, `category`, `list_price` — 스냅샷 우선, 없으면 products fallback
    - `products` (object) — 현재 시점 products row (fallback용)
  - `parent_order` (object 또는 null) — `{ id, final_payment, delivery_fee, status, order_items[...] }`
  - `child_orders` (array 또는 null) — `[{ id, final_payment, delivery_fee, status, order_items[...] }, ...]`

### 화면에서 실제로 읽는 필드
- `order.status` — 배너 분기 핵심
- `order.created_at` — 접수 메타
- `order.events?.name` — 접수 메타
- `order.events?.estimated_delivery_date` — pending/paid 배너 메시지 (`!is_on_site_sale`일 때만)
- `order.status_history` — completed 배너의 “배송 출발” 시점 추출
- `order.is_on_site_sale` — `edd` 표시 게이트
- `order.customer_name`, `order.phone_number`, `order.inpsyt_id`
- `order.shipping_address.address`, `order.shipping_address.detail`
- `order.customer_request`
- `order.delivery_fee`, `order.final_payment`
- `order.parent_order_id`, `order.parent_order`, `order.child_orders[0]`
- `order.order_items[].quantity`, `price_at_purchase`, `product_name`, `category`, `products?.name`, `products?.category`

### 화면에서 읽지 않는 필드 (참고)
- `admin_memo`, `total_cost`, `discount_amount`, `event_id`(객체 join으로만), `access_token`(URL에서만 사용)

## 상태별 UI 분기 요약 (한눈에)

| status | 이모지 | 라벨 | 보조 메시지 (배송 + `edd` 있음) | 보조 메시지 (현장구매 또는 `edd` 없음) | 본문 |
|---|---|---|---|---|---|
| pending | ⏳ | 결제대기 | “지금 결제 시 {edd} 도착” + “담당자를 통해 결제해 주세요.” | “담당자를 통해 결제해 주세요.” | 정상(상품·결제·주문자·요청사항) |
| paid | 📦 | 결제완료 | “{edd} 도착 예정” | “출고 준비 중입니다.” | 정상 |
| completed | 🎉 | 처리완료 | “{completed 시각} 배송 출발” 또는 “배송 출발” (edd 사용 안 함) | 동일 | 정상 |
| cancelled | ❌ | 주문취소 | “결제 전 취소된 주문건입니다.” | 동일 | 취소 상품 카드만 |
| refunded | ↩️ | 결제취소 | “결제 취소된 주문건입니다.” | 동일 | 취소 상품 카드만 |

## 빈 상태·로딩·오류 처리
- [ ] 로딩(RPC 호출 중): `CircularProgress` 가운데, height 100dvh (line 104-110)
- [ ] 오류·미존재(`error || !order`): 가운데 정렬 화면 (line 112-122)
  - ❓ 이모지 (3rem)
  - 제목 “주문을 찾을 수 없습니다” (h6, fontWeight 700)
  - 본문 “링크가 올바른지 확인하거나 담당자에게 문의해주세요.” (body2, text.secondary)
  - height 100dvh, p 4, gap 2
- [ ] 부분 데이터 부재 처리:
  - `events?.name` 없으면 접수 메타 캡션의 학회명 부분 자체 생략 (line 157)
  - `customer_request` 없으면 요청사항 카드 자체 미렌더 (line 245)
  - `inpsyt_id` 없으면 주문자 정보 카드의 해당 행 자체 미렌더
  - `shipping_address.address` 없으면 “배송지” 행이 아닌 “배송: 현장 수령” 행으로 대체
  - `linkedOrder.order_items` 없거나 `firstOrder?.order_items`가 undefined일 때 — `ItemsCard`에 `items={undefined}` 전달되어 `items?.map`이 무시됨 (line 279). 즉 빈 카드. **시안에서는 이 케이스의 시각 처리(빈 카드를 그대로 둘지, 카드 자체를 숨길지) 정책 결정 필요. 확인 필요.**

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **상태 배너 5색은 `STATUS_COLORS` 상수로 박혀 있다.** `pending #F59E0B` / `paid #10B981` / `completed #6366F1` / `cancelled #EF4444` / `refunded #F43F5E`. **결제 요약의 합산/최종 결제금액 색도 이 배너 색을 따라간다(line 202, 217).** 시안의 색 토큰은 이 5종을 의미적으로 유지해야 한다 — 배너 색을 바꾸면 결제 요약의 강조 색도 같이 바뀌어야 정합이 맞는다.

2. **현장구매(`is_on_site_sale=true`) 주문은 도착 예정일을 보여주지 않는다.** `getBannerConfig` line 18의 `!order.is_on_site_sale` 가드. 현장 수령 주문에 “X월 X일 도착” 안내가 나가면 사용자가 혼란. 시안의 `pending`·`paid` 상태 변형도 현장/배송 두 케이스를 별도로 그려야 한다 (pending·paid 각각 ±edd 4변형 + completed·cancelled·refunded 3변형 = 총 7변형).

3. **연계 주문 표시는 “1차/2차”로 고정.** parent/child를 자동 정렬해서 1차=parent, 2차=child로 표시한다(line 127-131). child가 여러 개라도 첫 번째만 표시(line 93). 시안에서 “원본/추가” 또는 “주문 #1/#2” 같은 다른 라벨링을 도입하면 코드 동기 필요. 또한 **3차 이상의 연계는 화면에 못 들어온다** — 데이터 정합성 한계로 시안에서도 동일하게 가정한다.

4. **고객 화면에는 카테고리 칩 시각 강조가 없다.** 출고 화면(A3)이 “도서”/“검사” 색 칩을 필수로 박는 것과 달리, 고객 화면은 “{category} · {quantity}개” 텍스트 캡션만 사용한다 (line 286). 이 차이는 의도된 것 — 운영자에게는 분류 작업 신호가 필요하지만 고객은 자기가 뭘 샀는지 알면 충분. 시안에서 색 칩을 임의로 추가하면 어드민과 고객의 위계 신호가 섞인다.

5. **결제 요약 단일/연계 두 분기의 행 구성이 비대칭이다.** 단일은 “배송비 + 최종 결제금액” 2행, 연계는 “1차 + 2차 + 합산” 3행으로 배송비 행이 사라진다. 시안에서 두 분기를 동일 카드 슬롯에 통합하려 할 때 정보 손실 주의. 운영자가 합배송한 주문의 배송비 내역을 고객이 따로 알 필요는 없다는 결정으로 추정 — **이 결정의 의도 확인 필요.**

6. **페어 화면 `/order/lookup` 라우트가 App.jsx에 등록되어 있지 않다.** OrderLookupPage 컴포넌트는 존재하지만 라우트 미연결 상태(A2 OrderLookup 시트의 핵심 발견과 교차 참조). OrderStatusPage 자체는 정상 작동(라우트 등록됨, 알림톡·OrderPage·OrderDetailModal에서 진입). 이 사실은 본 시트의 변경 사항은 아니지만 페어 화면의 미연결 상태를 인지하고 시안 진행해야 한다.

## 합배송 노출 정책 (2026-07-13 확정 — 위 "연계 1차/2차" 서술 대체)
> 아래 표시정보의 "연계 주문(1차/2차)", "합산 결제금액", "child_orders/parent_order" 관련 서술은 **폐기**되었다. 합배송이어도 각 고객은 **본인 주문 1건만** 본다.
- **정책**: 다른 참여자 정보(이름·상품·연락처·주소·금액)는 백엔드 `get_order_by_token` 응답 단계에서 차단. 화면은 단일 주문과 동일한 본인 주문 카드 렌더.
- **응답 부가 필드**: `is_grouped`(bool), `is_representative`(bool), `representative_name`(string|null — 대표가 본인이면 null), `co_recipient_names`(string[] — 함께 배송되는 타인 이름, 동일인 제외, 전부 동일인이면 빈 배열). child_orders/parent_order/is_group_parent/parent_order_id는 응답에 없음.
- **안내 문구 1줄**(주문자 정보 카드 하단, caption, text.secondary) — **4분기** (배송지 유무로 나누지 않음. "회원님"·"처리됩니다" 문구 폐기):
  - `is_grouped && is_representative && co_recipient_names.length` → `"{co_recipient_names.join(', ')} 님의 주문 상품이 함께 배송됩니다."`
  - `is_grouped && is_representative && co_recipient_names 빈 배열`(전부 동일인) → `"묶음배송 예정입니다."`
  - `is_grouped && !is_representative && representative_name` → `"{representative_name} 님의 주소지로 함께 배송됩니다."`
  - `is_grouped && !is_representative && representative_name === null`(대표가 본인) → `"묶음배송 예정입니다."`
  - 단일 주문(`is_grouped === false`) → 문구 없음.
- **상태 배너**: 본인 `order.status` 기준. **취소 분기**: 본인 `order_items`만.
- **어드민 교차 참조**: 어드민 `GroupOrderModal`은 전원 정보 유지 + 자식별 "고객 주문서 열기" 링크(`/order/status/{child.access_token}`, 새 탭)로 이 화면에 진입. 상세는 설계 스펙 `docs/superpowers/specs/2026-07-09-합배송-고객주문서-노출최소화-design.md` §4.

## 변경 이력
- 2026-07-13 (2차) 합배송 안내 문구 4분기 재작성 — 구 2분기("{대표명} 님의 주소로 함께 보내드립니다." / "주문하신 다른 분과 함께 회원님 주소로 배송됩니다.")를 폐기하고 대표/비대표 × 동일인 여부로 4분기화. 응답에 `co_recipient_names`(string[]) 추가. 배송지 유무 분기 제거, "회원님"·"처리됩니다" 문구 완전 삭제. 어드민 `GroupOrderModal`에 자식별 "고객 주문서 열기" 링크 신설(교차 참조).
- 2026-07-13 합배송 고객주문서 노출 최소화 — 위 "합배송 노출 정책" 반영. 구 "연계 1차/2차" 및 껍데기 그룹 뷰(child 순회·합산 PriceBlock·묶음 배송지)를 폐기하고 본인 주문 카드 + 안내 문구 1줄로 전환. `summarizeGroupStatus` OrderStatusPage 미사용화(utils/groupOrder.js는 어드민 화면에서 계속 사용 → 유지). backend RPC 재작성과 동시 배포.
- 2026-05-26 신설 — M2 고객용 시안 착수 사전 정독. `OrderStatusPage.jsx` 297줄 전수 + `get_order_by_token` RPC + 5상태 배너 분기 + 연계 주문 1차/2차 정렬 규칙 + 현장구매 가드 + RLS 보안 모델(20260407 anon SELECT 철회 후 토큰 RPC만 허용) 모두 확인. 환각 방지 위해 `customer_request`의 현장구매 prefix 노출 정책, 연계 child가 비어있을 때의 빈 카드 처리, 단일/연계 배송비 행 비대칭 의도 3건은 “확인 필요”로 표기.
- 2026-05-29 M3-11 시안 정합 — `OrderStatusPage.jsx` 단일 파일 토큰화(시안 `CustomerOrderStatusPreview` 답습). **보존**: 상태 배너 5종 분기·이모지·subMessage 텍스트·`STATUS_COLORS` 배너 색·현장구매(`is_on_site_sale`) `edd` 비표시 가드·연계 주문 1차/2차 정렬(현재 child면 parent=1차, parent면 현재=1차)·`child_orders[0]`만 사용·취소 분기에서 결제/주문자/요청 카드 숨김·`customer_request` 현장구매 prefix 노출·우편번호 미표시·`get_order_by_token` RPC 호출·access_token 검증·문의 메일 링크·빈 상태/로딩 처리. **교체**: 인라인 raw hex 0건(`'#fff'` → `theme.palette.common.white`, `'rgba(255,255,255,...)'` → `alpha(white, ...)`), `borderRadius: '12px'` → `theme.radii.md`, `border: '1px solid' + borderColor: 'divider'` → `border: '1px solid ${theme.palette.divider}'` 통합, `SectionTitle`은 시안과 동일하게 `Typography variant="overline"`(02 §타이포 토큰), 주문자 정보 카드 라벨+값 행 → `InfoRow` 합성 컴포넌트(연락처는 `mono`), 결제 요약 → `PriceBlock` 합성 컴포넌트(합계 색은 배너 색 유지), 상품 가격 셀 `fontFeatureSettings: '"tnum" 1'` 추가, fallback 배너 색 `'#8B95A1'` → `theme.gray[500]`, Chip `borderRadius` 토큰화. **신규 없음**(시안 답습 0건, 카테고리 색 칩 추가 금지 §발견 #4 준수). **사양 핵심 발견 1~6 모두 보존 확인.**
