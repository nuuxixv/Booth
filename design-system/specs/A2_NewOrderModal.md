# 사양 시트 — A2 신규 주문 모달 (NewOrderModal)

> 이 시트는 어드민 신규 주문 등록 모달의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안 부재 화면이므로 실 컴포넌트(`NewOrderModal.jsx`)가 사실상의 기획이다. 시안이 작성되면 이 시트에 모든 항목이 1:1로 반영되어야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-10-19 **PIN 주문 분기 확장(사양·시안 단계)**(product-designer). "+신규 주문"에 **[PIN 주문]/[수기 주문] 분기**를 앞단에 추가. PIN 주문 생성 화면(학회 자동 선택·상품 0개 생성·PIN 4자리 크게 표시·복사) 신설. 수기 주문 = 현행 NewOrderModal **전면 보존**. 아래 "## PIN 주문 (현장 도움 주문) 확장" 참조. 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`). 근거 `DOCS/PRD_현장도움주문.md` §4. (구현·DB는 별도 — 이번은 사양·시안만.)
> 이전 갱신: 2026-08-18 **할인 단가 유틸 경유**(frontend-engineer). `calcDiscountedPrice`와 검색 리스트 할인 표시 판정(`isDisc`)을 공용 유틸 `utils/pricing.js`(`getDiscountedUnit`/`getEffectiveRate`)로 교체 — `discount_override` 반영(실효율 = `discount_override ?? (is_discountable ? discountRate : 0)`). override가 NULL/undefined면 순수 no-op. 검증: build·pricing.test 14 passed·lint 신규 0.
> 이전 갱신: 2026-05-29 신설 (M3-13 선행 — 시안 부재 단일 진실 소스 박기).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/NewOrderModal.jsx` (572줄)
- 호출 위치: `inpsyt-order-frontend/src/components/OrderManagementPage.jsx` 상단 “+ 신규 주문” 버튼 (orders:edit 권한 시)
- 관련 유틸: `inpsyt-order-frontend/src/utils/search.js` 의 `matchesSearch(name, term)` — 상품명 검색
- 관련 hook: `inpsyt-order-frontend/src/hooks/useNotification.js`
- 직접 supabase 호출(컴포넌트 내부):
  - `supabase.from('orders').insert({...}).select().single()` (line 201-216) — 주문 헤더 생성
  - `supabase.from('order_items').insert(orderItems)` (line 226) — 상품 행 일괄 삽입
- **Edge Function 미사용** — 고객 측 `create-order` Edge Function(`supabase/functions/create-order/index.ts`)을 우회하고 클라이언트에서 직접 두 번의 insert를 수행한다. 가격·할인·배송비 계산은 모두 클라이언트에서 한다.
- prop으로 받는 사전 로드 데이터:
  - `events` (학회 목록 — sortedEvents로 start_date desc 정렬)
  - `products` (전체 상품 — is_popular, is_discountable 포함)
  - `settings` (`free_shipping_threshold, shipping_cost`)
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20260406_add_access_token_to_orders.sql` + `20260406_add_status_history_to_orders.sql` + `20260415_002_add_order_item_snapshots.sql`
- 상태 이력 트리거: insert 후 `status_history` jsonb는 트리거(`append_status_history`)가 채워주지 않음 — **확인 필요** (트리거가 UPDATE OF status만 처리하면 INSERT 시점 첫 항목은 비어 있을 수 있음)
- 우편번호 검색 라이브러리: `react-daum-postcode`

## 사용자 시나리오
어드민(`orders:edit` 권한 보유자)이 학회 부스에서 “전화로 결제 약속만 받은 주문”·“현장에서 책 1권 산 주문”·“직원 내부 테스트 주문”을 직접 등록한다. 학회/행사를 먼저 고르고(할인율이 여기서 결정됨), 현장판매 체크박스로 배송 흐름을 끌지 살릴지 결정한 뒤, 고객명·연락처·주소(필요 시)를 입력하고, 오른쪽 패널에서 상품을 검색·장바구니에 담는다. 좌측 하단의 주문 요약이 라이브로 갱신된다. 저장하면 `status='pending'`으로 들어가며, 결제가 확인되면 운영자가 별도로 주문 관리에서 `paid` 전환 → 알림톡 자동 발송. 데스크톱·태블릿은 좌우 2단(좌 300px / 우 1fr), 모바일은 세로 스택.

## 진입 흐름
- 진입: `OrderManagementPage` 상단 “+ 신규 주문” 버튼 (`orders:edit` 권한 필요)
- prop: `open`, `onClose`, `onSuccess`, `events`, `products`, `settings`
- 진입 시 useEffect로 모든 state 초기화 (line 71-84)
- 모달 사이즈: maxWidth `md`, fullWidth. 내부 컨텐트 height 560px(데스크톱)

## 표시 정보 (라벨 단위, 누락 금지)

### 헤더 (line 248-251)
- [ ] 모달 제목: “신규 주문 추가” (variant h6, fontWeight 700)
- [ ] 닫기 아이콘 `CloseIcon`

### 좌측 패널 — 고객 정보·학회·요약 (line 257-391)

#### 현장판매 체크박스 (line 268-279)
- [ ] FormControlLabel + Checkbox(`isOnSite`)
- [ ] 라벨: “현장판매” (body2, fontWeight 600)
- [ ] 체크 시: 고객명·연락처·우편번호·주소·상세주소를 모두 비워서 입력 disable (조건부 렌더링 — `!isOnSite && (...)`로 입력 필드 전체가 숨겨짐, line 317-359)

#### 학회/행사 Select — 필수 (line 281-315)
- [ ] InputLabel: “학회 / 행사 *”
- [ ] 정렬: `start_date desc` (가장 최근 학회가 위로) — line 240-243
- [ ] 옵션 표시 형식 (line 291-311):
  - 상단: 상태 뱃지(`예정`/`진행중`/`종료` — 색상 매핑 #0984e3/#00b894/#b2bec3, alpha 0.12 배경) + 학회명 (fontWeight 600, lineHeight 1.3)
  - 하단 캡션: `{start_date}{discount_rate > 0 && ` · 할인 {round(rate*100)}%`}`
- [ ] 상태 계산: `start_date`/`end_date` 기준 — start보다 이전이면 “예정”, end보다 이후면 “종료”, 그 외 “진행중” (line 37-45)

#### 고객명 TextField — 필수 (현장판매 아닐 때, line 319-325)
- [ ] 라벨: “고객명 *”
- [ ] `PersonIcon` startAdornment (text.secondary, fontSize 18)
- [ ] 검증: `!isOnSite && !name.trim()` 이면 “고객명을 입력해주세요.” warning 토스트

#### 연락처 TextField (현장판매 아닐 때, line 326-333)
- [ ] 라벨: “연락처” (옵션)
- [ ] `PhoneIcon` startAdornment
- [ ] placeholder: “010-0000-0000”
- [ ] maxLength 13
- [ ] 자동 포맷터(line 108-114): digit only → ≤3=raw, 4-7=`XXX-XXXX`, 8+=`XXX-XXXX-XXXX`

#### 주소 검색 TextField — readOnly (현장판매 아닐 때, line 334-351)
- [ ] 라벨: “주소 검색”
- [ ] value: `address`
- [ ] `HomeIcon` startAdornment, **endAdornment에 “검색” outlined 미니 버튼** (사실상 이중 트리거 — TextField 자체 클릭으로도 모달 오픈)
- [ ] readOnly, cursor pointer
- [ ] 클릭 시 → DaumPostcode Modal 오픈 (`postcodeOpen`)

#### 상세 주소 TextField (현장판매 아닐 때, **address 있을 때만**, line 352-357)
- [ ] 라벨: “상세주소”
- [ ] value: `detailAddress`, 자유 입력
- [ ] 노출 조건: `address` 가 비어 있지 않을 때 (Daum 검색 완료 후에만 노출)

#### 우편번호 (UI 없음 — 데이터만)
- [ ] `postcode` state는 Daum 검색의 `zonecode`로 자동 세팅 (line 95)
- [ ] 화면에 별도 입력/표시 UI 없음
- [ ] 저장 시 `shipping_address.postcode`에 포함

#### 주문 요약 (cart.length > 0일 때만, line 362-390)
- [ ] 섹션 제목: “주문 요약” (subtitle2, fontWeight 700)
- [ ] **총 상품금액** — `totalAmount.toLocaleString()`원 (= 정가의 합)
- [ ] (조건부, discountAmount > 0) **할인** — `- {discountAmount.toLocaleString()}`원 (error 색)
- [ ] (조건부, `!isOnSite`) **배송비** — `{deliveryFee > 0 ? '{fee}원' : '무료'}`
- [ ] (조건부, `isOnSite`) 배송비 라인 자체 비노출
- [ ] **최종 결제금액** — `finalPayment.toLocaleString()`원 (fontWeight 800, primary.main)

### 우측 패널 — 상품 검색·장바구니 (line 394-545)

#### 상품명 검색 TextField (line 397-411)
- [ ] placeholder: “상품명으로 검색”
- [ ] `SearchIcon` startAdornment
- [ ] 비어 있을 때: `is_popular = true` 상품만 표시 (line 128-130)
- [ ] 검색어 있을 때: `matchesSearch(p.name, term)` (한글 초성·jamo 분해 검색, `utils/search.js`)
- [ ] 둥근 12px, 배경 #F2F4F6, border transparent (시각 톤이 다른 입력과 다름 — 검색 강조)

#### 카테고리 칩 (line 414-426)
- [ ] 옵션: `['all', '도서', '검사', ...products에서 추출된 카테고리]` (line 117-121)
- [ ] 라벨: `all`은 “전체”, 나머지는 카테고리명 그대로
- [ ] 단일 선택, 토글: 선택 시 filled+primary / 비선택 outlined+default
- [ ] 효과: `selectedCategory !== 'all'` 시 filter 추가
- [ ] 최대 50건 슬라이스 (line 134)

#### 상품 리스트 (line 429-494)
- [ ] 각 행:
  - 상품명 (fontWeight 600, ellipsis, lineHeight 1.3) — line 457-459
  - (조건부) 카테고리 Chip — height 16, fontSize 0.6rem, borderRadius 4
  - 가격 (caption secondary):
    - `is_discountable && discountRate > 0` 시: 정가 취소선 → 할인가 (red #d32f2f, fontWeight 700)
    - 그 외: 정가만
  - 우측: “담기”(contained, 미담김 시) 또는 “담김”(outlined Chip, 담김 시)
- [ ] 담김 행은 배경에 primary alpha 0.04 살짝
- [ ] 빈 상태: 검색어 있으면 “검색 결과가 없습니다”, 없으면 “인기 상품이 없습니다”

#### 장바구니 (cart.length > 0일 때, line 497-544)
- [ ] 섹션 제목: “장바구니 ({cart.length}종)” (subtitle2, fontWeight 700)
- [ ] 최대 height 160 + 내부 스크롤
- [ ] 각 행 (grey.50, border, borderRadius 1.5):
  - 상품명 (ellipsis)
  - 합계: `discounted * quantity` toLocaleString()원 (primary.main, fontWeight 700)
  - 수량 컨트롤: `-`(RemoveIcon) / 수량 숫자 (fontWeight 700) / `+`(AddIcon) — `IconButton` 22x22
  - 삭제 아이콘 (CloseIcon, text.disabled)

### 푸터 (line 549-559)
- [ ] “취소” 버튼 — `onClose` (saving 중 disabled)
- [ ] “주문 추가” 버튼 (contained):
  - disabled 조건: `saving || cart.length === 0`
  - saving 중: CircularProgress 16 + “저장 중...”
  - 그 외: “주문 추가”

### Daum 우편번호 Modal (line 563-567)
- [ ] `Modal` (zIndex 1400) — `Dialog`가 아니라 `Modal`. 다른 모달들과 다른 패턴
- [ ] 가로 90% / maxWidth 400 / borderRadius 2 / overflow hidden
- [ ] `DaumPostcode` (height 60vh)
- [ ] 완료 시: `addressType === 'R'` (도로명)이면 동·건물명 괄호 부착, 그 외 `data.address` 그대로

## 액션·기능 (누락 금지)

### 현장판매 토글
- [ ] 체크 시: 고객 정보 5필드(name·phone·postcode·address·detailAddress) 클리어 + 입력 영역 자체 비노출
- [ ] 저장 시: `customer_name = '현장판매_{Date.now()}'` 자동 세팅, `shipping_address = null`, `is_on_site_sale = true`

### 학회 선택 → 할인율 적용
- [ ] `selectedEvent.discount_rate` 가 모든 가격 계산의 기준
- [ ] 할인 적용 조건: `product.is_discountable && discountRate > 0` — 둘 다 만족해야 할인가 표시 (`calcDiscountedPrice`, line 140-143)
- [ ] 학회 미선택 시 정가만 표시

### 주소 검색
- [ ] 주소 TextField 자체 또는 endAdornment “검색” 버튼 클릭 → `setPostcodeOpen(true)`
- [ ] Daum 완료 → `postcode`(zonecode) + `address`(full address with 건물명) 동시 세팅
- [ ] 상세 주소 TextField는 address 채워진 이후에야 노출

### 상품 검색·필터
- [ ] 검색어 비어 있을 때: `is_popular = true` 상품만 표시 (인기 상품 우선 노출 — 운영 편의)
- [ ] 카테고리 단일 선택 (멀티 아님)
- [ ] 결과 최대 50건 슬라이스

### 장바구니 조작
- [ ] “담기” 클릭 → cart에 quantity=1로 추가 (이미 있으면 무시, line 145-148)
- [ ] `+` → quantity 증가
- [ ] `-` → quantity 감소, 0 되면 cart에서 자동 제거 (line 154-160)
- [ ] 삭제 아이콘 → cart에서 완전 제거

### 저장 (handleSave, line 183-238)
- [ ] 검증 순서:
  1. `!isOnSite && !name.trim()` → “고객명을 입력해주세요.” warning
  2. `!selectedEventId` → “학회(행사)를 선택해주세요.” warning
  3. `cart.length === 0` → “상품을 1개 이상 담아주세요.” warning
- [ ] 데이터 변환:
  - `customer_name`: 현장판매면 `현장판매_{Date.now()}`, 아니면 `name.trim()`
  - `shipping_address`: 현장판매면 `null`, 아니면 주소·우편번호 있을 때만 `{ postcode, address: address.trim(), detail: detailAddress.trim() }`
- [ ] insert orders 페이로드:
  - `customer_name, phone_number || null, shipping_address, event_id, is_on_site_sale, status: 'pending', total_cost, discount_amount, delivery_fee, final_payment`
- [ ] insert order_items 페이로드:
  - `order_id, product_id, quantity, price_at_purchase: calcDiscountedPrice(product)`
  - **스냅샷 컬럼(`product_name, product_code, category, list_price`) 누락** — `update_order_details` RPC는 채우지만 NewOrderModal의 insert는 안 채움. **부채**.
- [ ] 성공 시: `addNotification('신규 주문이 추가되었습니다.', 'success')` → `onSuccess?.()` (페이지 새로고침 트리거) → `onClose()`

### 자동 채워지는 필드 (insert에 명시되지 않으나 DB가 채움)
- `id` — 시퀀스
- `created_at` — DEFAULT now()
- `access_token` — DEFAULT gen_random_uuid()
- `status_history` — DEFAULT `'[]'::jsonb`. 트리거(`append_status_history`)는 UPDATE OF status에만 걸려 있어 **INSERT 시 첫 항목이 채워지지 않음**. **확인 필요** — `create-order` Edge Function은 `status_history: [{ status: 'pending', changed_at: ... }]` 를 명시적으로 넣지만(line 100), NewOrderModal은 안 넣는다. 어드민 등록 주문은 첫 상태 이력이 누락된다.

## 입력 폼 구조 (분리/통합 절대 금지)

좌측 패널 — 8개 분리 필드:

- [ ] **현장판매**: Checkbox (다른 5개 필드를 토글)
- [ ] **학회 / 행사**: Select (필수)
- [ ] **고객명**: TextField (현장판매 시 비노출, 필수)
- [ ] **연락처**: TextField + 자동 포맷터 (옵션)
- [ ] **주소(도로명)**: readOnly TextField + Daum 검색 트리거 (옵션)
- [ ] **상세주소**: 독립 TextField (address 있을 때만 노출)
- [ ] **우편번호**: state 보유, UI 없음 (Daum 자동)
- [ ] (저장 시 가공) `shipping_address` jsonb `{ postcode, address, detail }`

우측 패널 — 3개 컨트롤:

- [ ] **상품명 검색**: TextField (matchesSearch 한글 초성 지원)
- [ ] **카테고리**: 칩 단일 선택
- [ ] **장바구니**: 상품 추가/제거/수량 조정

**시안 절대 금지 사항**:
1. 우편번호+도로명+상세를 한 줄로 통합
2. 현장판매 체크박스 제거 (이게 빠지면 학회 부스 운영 흐름 자체가 깨짐)
3. 학회 Select에서 상태 뱃지(예정/진행중/종료) 제거 (잘못된 학회에 주문이 들어가는 사고 방지용)
4. 학회의 할인율 정보를 옵션 캡션에서 제거 (어드민이 할인이 들어가는지 사전 확인해야 함)
5. 상품 검색을 카테고리 필터 없이 단일 input으로 단순화
6. 장바구니의 수량 컨트롤을 단일 input으로 단순화 (±/숫자/삭제 3컴포넌트 유지)

## 권한별 차이

이 모달 자체가 `orders:edit` 권한자에게만 열린다(`OrderManagementPage.jsx:671`). 내부에는 권한 분기 없음. 진입 시점 가드만.

- [ ] **master·editor**: 모달 열리며 모든 기능 사용 가능
- [ ] **viewer**: 신규 주문 버튼 자체가 비노출. 이 모달은 영원히 안 열림

## 데이터 모델

### `orders` (이 모달이 INSERT하는 컬럼)
- 명시적 입력: `customer_name, phone_number, shipping_address, event_id, is_on_site_sale, status, total_cost, discount_amount, delivery_fee, final_payment`
- 자동 채움: `id, created_at, access_token, status_history`
- **명시되지 않아 NULL로 들어가는 컬럼**: `customer_request, admin_memo, inpsyt_id, parent_order_id, alimtalk_sent_at`
- **확인 필요** — 어드민 등록 주문에 `customer_request`(배송 메모) 입력란이 없음. 학회 부스에서 “책 빨리요” 같은 요청을 받았을 때 어디에 적나? `admin_memo`로 대신 적으라는 흐름인지, 빠뜨린 기획인지 확인 필요.

### `order_items` (INSERT 페이로드)
- 명시적 입력: `order_id, product_id, quantity, price_at_purchase`
- **스냅샷 컬럼 미입력**: `product_name, product_code, category, list_price` (`20260415_002_add_order_item_snapshots.sql`에서 추가된 컬럼들)
- 이로 인해 상품이 나중에 삭제되거나 가격이 바뀌면 “원래 어떤 상품을 어떤 가격에 샀는지” 추적 불가. `create-order` Edge Function과 `update_order_details` RPC는 모두 스냅샷을 채워 넣는데 NewOrderModal만 누락. **부채 — CTO 검수 권장**.

### `events` (조회)
- `id, name, start_date, end_date, discount_rate` — 옵션 표시·할인 계산

### `site_settings` (prop으로 전달받음)
- `free_shipping_threshold, shipping_cost, free_shipping_basis`
- 배송비 로직 (2026-08-25 통일): `constants/shipping.js`의 `calcShippingFee` 공유 함수 경유.
  - `isOnSite` → 0
  - `free_shipping_basis === 'discounted'`면 할인가(실결제) 합계, 그 외(NULL 폴백 포함) 정가 합계로 임계치 판정
  - 판정액 `=== 0` 또는 `>= threshold` → 0, 그 외 → `shipping_cost`
- **동작 변경(2026-08-25)** — 이전엔 NewOrderModal만 `discountedSubtotal`(할인가)로 판정해 3경로 중 혼자 달랐다. 이제 설정 기반으로 통일되어, **기본(정가) 설정에서는 정가 판정으로 교정된다**(CartBottomSheet·OrderSections·create-order와 동일). 관리자 설정으로 할인가 판정도 선택 가능.

## 빈 상태·로딩·오류 처리

- [ ] 빈 상태 — 상품 리스트, 검색어 있음: “검색 결과가 없습니다”
- [ ] 빈 상태 — 상품 리스트, 검색어 없음: “인기 상품이 없습니다”
- [ ] 빈 상태 — 장바구니 비어 있을 때: 주문 요약 + 장바구니 섹션 자체 비노출, 푸터의 “주문 추가” disabled
- [ ] 로딩 — 저장 중: 푸터 “주문 추가” → “저장 중...” + CircularProgress
- [ ] 오류 — 검증 실패: warning 토스트 (위 검증 순서 참조)
- [ ] 오류 — 서버 실패: `addNotification('주문 추가 실패: {message}', 'error')` 토스트, 모달은 닫히지 않음 → 사용자가 수정 후 재시도

## 핵심 발견 (CTO 검수 권장)

1. **`order_items` 스냅샷 컬럼 누락 — 부채.** `create-order` Edge Function과 `update_order_details` RPC는 `product_name, product_code, category, list_price` 4개 스냅샷을 채우는데, 어드민 신규 주문 insert(line 220-225)는 안 채운다. 결과적으로 NewOrderModal로 등록된 주문은 향후 상품이 삭제·가격 변경됐을 때 “당시 어떤 가격이었나” 복구 불가. 출고 화면 엑셀 다운로드에서 product_name이 비는 사고 가능성. **CTO 결정 사안**.

2. **`status_history` 초기 항목 누락.** `create-order` Edge Function은 INSERT 시 `status_history: [{ status: 'pending', changed_at: now }]` 를 명시적으로 박지만(line 100), NewOrderModal은 안 박는다. DB 트리거(`append_status_history`)는 UPDATE OF status에 걸려 있어 INSERT 시 발화하지 않으므로, 어드민 등록 주문은 `pending` 첫 항목이 비어 있다가 첫 상태 변경 때 비로소 이력이 생긴다. OrderDetailModal의 “상태 이력” 섹션이 첫 변경 전까지 안 보이게 되는 UX 사고. **확인 필요**.

3. **배송비 무료 기준 3경로 불일치 — 해소됨(2026-08-25).**
   - ~~`NewOrderModal`: `discountedSubtotal`(할인 후)~~ / ~~`OrderDetailModal`·`create-order`: 정가~~
   - `constants/shipping.js`의 `shippingBasisAmount`·`calcShippingFee` 공유 함수로 3경로(고객 주문서·NewOrderModal·OrderSections) 통일. `site_settings.free_shipping_basis`(정가/할인가) 설정 기반, 기본 정가. 서버 `create-order`도 병렬 백엔드가 동일 규칙으로 통일.

4. **`customer_request`(배송 메모) 입력란 부재.** 어드민이 학회 부스에서 “책 빨리 보내달라” 같은 고객 요청을 받았을 때 적을 곳이 없다. OrderDetailModal에서 편집으로 추가할 수는 있지만, 처음 등록 시점에 못 받으면 누락 사고가 잦다. 시안 작업 시 이 필드 추가할지 결정 필요.

5. **`admin_memo` 입력란 부재.** 동일 문제. “직원 테스트 주문”이나 “현금 결제 — 영수증 발급 완료” 같은 메모를 등록 시점에 못 적는다.

6. **현장판매 customer_name이 `현장판매_{Date.now()}`로 자동 채워진다.** 학회 부스에서 책 여러 권을 따로따로 팔면 `현장판매_1716969600000`, `현장판매_1716969605000` 같은 행이 잔뜩 쌓인다. 통계·집계 시 “현장판매” 로 묶기는 쉽지만, 어드민이 OrderDetailModal에서 찾아 들어갈 때 식별이 어렵다. 시안 작업 시 이 자동 명명 규칙을 보일지/감출지 결정 필요.

## 시안 부재로 인한 결정 사항

시안이 없으므로 다음을 “이 시트의 결정”으로 박는다:

- 모달 구조: 좌측 300px 고정(고객·학회·요약) + 우측 1fr(상품·장바구니) 2단 레이아웃 유지. 모바일은 세로 스택.
- 학회 Select는 옵션마다 상태 뱃지(예정/진행중/종료) + 할인율 캡션 모두 유지
- 주소는 3필드 분리 절대 유지 (uniform 1줄 input으로 통합 금지)
- 현장판매 체크박스는 모달 최상단에 유지 (운영자가 “이게 현장판매인지 아닌지” 첫 화면에서 결정해야 하는 운영 흐름)
- 상품 검색 비어 있을 때 인기 상품만 노출하는 동작 유지 (학회 부스에서 가장 많이 팔리는 책을 빠르게 찾기 위한 의도)
- 장바구니 수량 컨트롤은 ±/숫자/삭제 3컴포넌트 유지
- 푸터 “주문 추가” 버튼은 cart 비어 있을 때 disabled (실수 방지)

## PIN 주문 (현장 도움 주문) 확장 (2026-10-19, 사양·시안 단계)

> 근거: `DOCS/PRD_현장도움주문.md` §4(담당자 흐름)·§5·§6. 기존 NewOrderModal(수기 주문)은 그대로 보존하고, 그 **앞단에 분기**를 둔다. 분기는 이 모달 바깥이며, 이 모달의 내부 구조(위 표시 정보·액션·입력 폼)는 수기 주문 경로에서 1글자도 바꾸지 않는다.

### "+신규 주문" 분기 선택 (신규 — 모달 진입 앞단)
- [ ] `OrderManagementPage`의 "+신규 주문" 버튼(`orders:edit`) 클릭 → **분기 선택이 먼저**. 바로 NewOrderModal을 열지 않는다.
- [ ] 분기 2택 (이름 건우님 확정 2026-10-19):
  - [ ] **PIN 주문** — "고객이 PIN으로 배송지 입력". 선택 → PIN 주문 생성 화면.
  - [ ] **수기 주문** — "기존 방식". 선택 → 현행 `NewOrderModal` 그대로 오픈(전화·구두 주문, PIN 입력이 어려운 고객의 대체 수단).
- [ ] 분기 UI = 큰 선택 카드 2개(아이콘 + 제목 + 설명). PIN 주문 카드 primary 강조. (장식·그라데이션·가짜 통계 없음 — 룰 E)

### PIN 주문 생성 화면
- [ ] **학회 / 행사 Select — 진행 중인 학회 자동 선택.** 상태 뱃지(예정/진행중/종료) + 할인율 캡션 유지(기존 학회 Select 규칙과 동일). 다른 학회로 변경 가능.
- [ ] **상품 0개로도 생성 가능.** "상품은 지금 담지 않아도 됨" 안내. 미리 담거나 고객 제출 뒤 담는다(§4-3).
- [ ] 생성 동작(기획) = 주문 1건 `status='preparing'`(준비중) + `match_code`(PIN 4자리) 발급. 고객 정보 컬럼은 비운다(PRD §6 — 고객 제출 시 채움). 금액은 담긴 상품으로 계산(0개면 0원).
- [ ] 생성 직후 **PIN 크게 표시 + 복사**("큰 숫자 + 복사"만). 안내 문구: "고객에게 번호를 불러 주세요 … 고객이 제출하면 번호는 사라집니다". PIN은 글자(text)로 저장해 앞자리 0 유지(예 `0427`).
- [ ] 생성된 준비중 주문 → 주문 상세로 이어짐(상품 담기·상태 확인은 `A2_OrderDetailModal.md` PIN 확장). 목록·상세 준비중 뱃지 옆 PIN 재표시(A1 참조).

### 수기 주문 (현행 보존 — 변경 금지)
- [ ] 위 "## 표시 정보"·"## 액션·기능"·"## 입력 폼 구조"는 **수기 주문 경로에서 전부 그대로 유지**(현장판매 토글 · 학회 Select · 고객명 · 연락처 · 주소 3분리(도로명·상세·우편번호) · 상품 검색 · 장바구니 · 주문 요약 · 푸터). PIN 분기는 이 모달 앞단에만 추가하고 내부는 손대지 않는다.

### 시안 반영
- [ ] 시안: `src/components/PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) — 단계 ①(분기 선택), ②(PIN 주문 생성 + PIN 큰 표시·복사). 토글로 전환.

## 변경 이력
- 2026-10-19 PIN 주문 분기 확장(사양·시안 단계, product-designer) — "+신규 주문" 앞단에 [PIN 주문]/[수기 주문] 분기 신설. PIN 주문 생성 화면(학회 자동 선택·상품 0개 생성·PIN 4자리 크게+복사) 사양 추가. 수기 주문 = 현행 NewOrderModal 전면 보존(내부 무변경). 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) 단계 ①②. 근거 `DOCS/PRD_현장도움주문.md` §4. 실 구현·DB(`match_code`·인덱스·PIN 생성/조회 함수)는 별도 사이클.
- 2026-05-29 신설 — M3-13 선행. 시안 부재 화면이므로 실 컴포넌트가 단일 진실 소스. 스냅샷 컬럼 미입력 1건, status_history 초기항목 누락 1건, 배송비 기준 3중 분기 1건, customer_request·admin_memo 입력란 부재 2건을 부채 후보로 기록. 시안 작업 착수 시 이 시트의 핵심 발견 6건을 먼저 정리한 뒤 진행.
- 2026-05-29 M3-13 시안 정합 — 시안 부재이므로 사양 시트 단일 진실 소스 기반 토큰·합성 컴포넌트 적용.
  - 합성 컴포넌트 적용: `PriceBlock`(주문 요약), `ActionSlot`(푸터 취소·주문 추가), `EmptyState`(상품 검색 결과 없음).
  - Dialog/Modal 라운드·shadow를 `theme.radii.lg`·`customShadows.lg` 토큰으로 교체. raw hex 0, 인라인 fontSize 0(텍스트), fontWeight 800 본문 0.
  - 학회 상태 색은 `theme.status.paid`·`palette.info.main`·`gray[400]`로 정합(기존 raw `#0984e3`/`#00b894`/`#b2bec3` 제거). 상품 카드 카테고리 칩은 `Chip outlined`로 통일.
  - 정보 구조·필드·액션 전부 보존(좌 300→320px 패널, 학회 옵션 상태 뱃지·할인율 캡션, 주소 3필드 분리, 장바구니 ±/숫자/삭제 3컴포넌트, 현장판매 체크박스).
  - 보존: orders·order_items 직접 insert, 가격·할인·배송비 계산, Daum Modal, phone formatter, matchesSearch, 카테고리·인기 상품 필터.
  - 부채 6건은 손대지 않음(별도 사이클 — CTO 검수 권장).
