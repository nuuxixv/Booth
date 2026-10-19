# 사양 시트 — A2 주문 상세 모달 (OrderDetailModal)

> 이 시트는 어드민 주문 상세·편집 모달의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안 부재 화면이므로 실 컴포넌트(`OrderDetailModal.jsx`)가 사실상의 기획이다. 시안이 작성되면 이 시트에 모든 항목이 1:1로 반영되어야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-10-19 **준비중(PIN 주문) 상세 — 실 페이지 구현 완료**(frontend-engineer). `OrderSections.jsx`: 준비중 상태 행=뱃지+PIN(`match_code`) 칩+취소, "준비 상태"(ReadinessRow) 카드, 주문자/배송지 빈 상태 문구, 결제대기 자동 전환(`handleSaveItems`·`handleSaveCustomer` 두 곳, `shouldPromoteToPending` 판정, `orders` UPDATE에 `status:'pending'` 동봉, `status_history`는 트리거 담당)+"결제 준비 완료" 토스트·알림음(`playBeep`)+상위 중복 억제(`onLocalPromote`). 상품 담기=기존 `ProductPickerDialog` 편집 경로 재사용. 배송지 3필드 분리 유지. 시안 `PinOrderAdminPreview.jsx` 단계 ③④.
> 이전 갱신: 2026-10-19 **준비중(PIN 주문) 상세 확장(사양·시안 단계)**(product-designer). 준비중 상태의 상세에 PIN 재표시 · "상품 n종 / 고객 정보 ○✕" 준비 상태 줄 · 상품 담기(`ProductPickerDialog` 재사용) · 결제대기 자동 전환 · "결제 준비 완료" 알림(토스트·알림음) · 함께 확인 안내를 추가. 아래 "## 준비중(PIN 주문) 상세 확장" 참조. 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) 단계 ③④. 근거 `DOCS/PRD_현장도움주문.md` §4·§5. (구현·DB는 별도.)
> 이전 갱신: 2026-10-12 **stale 테스트 2건 정합화 + 편집 진입 서술 정리**. `OrderDetailModal.test.jsx`의 실패 2건(전역 `/편집/i` 버튼 단일 조회 → 섹션별 Edit 아이콘 4개 다중매칭, `update_order_details` RPC 기대)은 78e440f(2026-07-07 섹션별 인라인 편집 재설계, CTO·CPO 검수 통과)부터 이어진 **테스트 쪽 불일치**로 판정(코드 회귀 아님 — 코드 무수정). 테스트를 섹션 제목 기준 편집 버튼 조회 + `orders` 부분 UPDATE 기대로 교체, 회귀 테스트 상품 목에 `is_discountable:true` 보강(412ba7b 할인 공식 정합). 두 테스트 모두 변이 검증(배송비 할인가 기준 회귀·주문자명 UPDATE 누락을 주입하면 실패) 확인. 시트 본문에 남아 있던 전역 "편집/저장 토글"·헤더 아이콘·`handleSaveAll` 서술을 현행으로 정리. 검증: 전체 vitest 329 pass·0 fail·2 skip, lint 0.
> 이전 갱신: 2026-08-25 **상품 추가 = 고객 프론트 상품 선택 UX 재사용**(frontend-engineer, tech-cto 위임). 편집 모드 "상품 추가" 버튼이 **첫 상품 자동 삽입**을 폐기하고 신규 `ProductPickerDialog`(고객 `ProductSelectionStep` 재사용: 검사군 트리·검색·인기/신규 필터)를 연다. 담기 임시 카트 확정 시 각 항목을 `editedOrderItems`에 `{product_id, quantity}`로 append(이미 있는 상품이면 **수량 합산**, 중복 행 금지). 가격·스냅샷은 기존 파이프라인(useEffect 재계산 + handleSaveItems payload)이 그대로 처리 — 신설 없음. 어드민 자유도 원칙상 `visibleCategories=null`(전 상품 노출). 태그 우선 정렬은 행사 `tags ∪ host_society`(getEvents가 host_society 미포함이라 admin에선 tags만, graceful). 기존 행별 Autocomplete는 담긴 행 교체·수정용으로 유지. `ProductSelectionStep` 내부 무수정. 검증: build·lint 신규 0, 전체 테스트 294 pass·2 fail(기존 편집버튼 다중매칭, 증가 0).
> 이전 갱신: 2026-08-18 **상품 표 행별 할인 가시화**(frontend-engineer, 프리뷰 QA 수정). 할인가 셀에 **할인율 % 보조표기**(정가 대비 역산 `round((1−할인가/정가)×100)` — 스냅샷 주문은 당시 실제율, 0%인 행은 `-`), 합계 셀에 **행별 할인액 보조표기**(`−(정가−할인가)×수량`) 추가. 신규 열이 아닌 셀 보조표기(모달 폭 제약). 계산은 `getDiscountedUnit`/스냅샷 우선 규칙 유지, %는 표시된 정가·할인가에서 역산(표시 정합 보장). 목적: 어떤 상품이 몇 % 할인됐는지 육안 구분 + **고객(정가·%·할인가) < 어드민(정가·%·할인가·할인액)** 정보량 원칙. 검증: build·lint 신규 0·pricing.test 14. (OrderDetailModal.test 편집버튼 다중매칭 실패 2건은 기존 실패로 무관 — HEAD 베이스라인 동일 확인.)
> 이전 갱신: 2026-08-18 **편집 상품 금액 계산 정정 + 스냅샷 우선**(frontend-engineer, tech-cto 위임). 상품 편집 소계 재계산(useEffect)·저장 payload(order_items 직접 write)·표 표시 3곳(OrderSections)의 할인가를 공용 유틸 `getDiscountedUnit(product, discountRate)`로 교체. 기존 `originalPrice*(1-discountRate)`는 **`Math.round` 누락·`is_discountable` 미반영·`discount_override` 미반영**이었음(동시 해소). **저장 payload는 서버(create-order)를 우회하는 직접 DB write라 이 공식이 정본.** 배송비 판정은 정가(할인 전) 총액 기준 유지(회귀 가드 보존). **표 표시(비편집=기존 아이템)는 스냅샷 우선** — `item.price_at_purchase`가 있으면 그걸 표시, 없을 때만 유틸 폴백. **동작 변경**: 과거 비할인(is_discountable=false) 상품에도 행사 할인이 잘못 적용되던 표시·저장이 바로잡힘(운영 DB 불일치 0건 확인 — 깨질 기존 동작 없음). **근인 = `OrderManagementPage:237` productsMap 화이트리스트**에 `is_discountable`이 없어 OrderSections가 못 보던 것 → map에 `is_discountable`·`discount_override` 추가. 검증: build·lint 신규 0·pricing.test 14. (참고: `OrderDetailModal.test`의 편집 버튼 다중매칭 실패 2건은 SectionCard 다(多)편집 리팩터 이후 잔존한 기존 실패로 본 작업과 무관 — mockProducts에 `is_discountable:true` 추가해 렌더 테스트만 정합화.)
> 이전 갱신: 2026-07-07 섹션별 인라인 편집 재설계.

## 참조 파일
- 상품 추가 피커: `inpsyt-order-frontend/src/components/ProductPickerDialog.jsx` — 고객 `ProductSelectionStep` 재사용 래퍼(2026-08-25). `OrderSections`의 편집 모드 "상품 추가"가 여는 다이얼로그
- 재사용 원본: `inpsyt-order-frontend/src/components/ProductSelectionStep.jsx` (고객 주문서 step0, 무수정 재사용). `fetchAllProducts`·`fetchTestGroups` 자체 호출
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderDetailModal.jsx` (헤더·⋮메뉴·삭제·합배송 연계·푸터 래퍼) + `inpsyt-order-frontend/src/components/OrderSections.jsx` (섹션 본문·섹션별 인라인 편집 로직, 2026-07-08 추출)
- 테스트: `inpsyt-order-frontend/src/components/OrderDetailModal.test.jsx` — 렌더·배송비 정가 기준 회귀·주문자 섹션 저장(`orders` 부분 UPDATE, RPC 미호출). 편집 버튼은 섹션마다 하나라 **섹션 제목 기준으로 조회**(`getSectionEditButton`)
- 호출 위치: `inpsyt-order-frontend/src/components/OrderManagementPage.jsx` 행 클릭 시
- 관련 API:
  - `src/api/orders.js` — `linkOrders`(parentOrderId, childOrderId, settings), `searchOrdersForLinking`(term, excludeOrderId)
  - `src/api/alimtalk.js` — `sendAlimtalk`(orderId) (브라우저 직접 fetch, Edge Function 호출 금지)
- 직접 supabase 호출(컴포넌트 내부):
  - `supabase.from('site_settings').select('*').single()` (line 91-97) — 배송비 정책
  - `supabase.from('orders').select(...).eq('id', parent_order_id).single()` (line 158-163) — 부모 주문 로드
  - `supabase.from('orders').select(...).eq('parent_order_id', order.id)` (line 167-171) — 자식 주문들 로드
  - **(2026-07-07 재설계) `update_order_details` RPC 호출 폐지.** 섹션별 부분 UPDATE로 전환:
    - 주문자: `supabase.from('orders').update({ customer_name, phone_number, inpsyt_id }).eq('id', order.id)` (`handleSaveCustomer`)
    - 배송지: `supabase.from('orders').update({ shipping_address, customer_request }).eq('id', order.id)` (`handleSaveShipping`)
    - 메모: `supabase.from('orders').update({ admin_memo }).eq('id', order.id)` (`handleSaveMemo`)
    - 상품(비연계 단일 주문만): `order_items.delete().eq('order_id', order.id)` → `order_items.insert(bulk)` → `orders.update({ total_cost, discount_amount, delivery_fee, final_payment }).eq('id', order.id)` (`handleSaveItems`)
  - `supabase.from('orders').update({ status }).eq('id', order.id)` — 상태만 변경(현행 유지)
  - `supabase.from('order_items').delete().eq('order_id', order.id)` + `supabase.from('orders').delete().eq('id', order.id)` (line 274-277) — 삭제
- DB 함수: `supabase/migrations/20260415_004_update_order_functions.sql` 의 `update_order_details(order_id_param int, updates_param jsonb, items_param jsonb)` — **이 모달에서는 2026-07-07부터 미사용**(함수 자체는 잔존)
- 상태 이력 트리거: `supabase/migrations/20260406_add_status_history_to_orders.sql` — `status` 변경 시 `status_history` jsonb에 자동 누적
- 결제완료 알림 트리거: `supabase/migrations/20250722070342_create_paid_order_trigger.sql` (`notify_order_paid`) — DB 알림만, 알림톡과 무관
- 알림톡 발송 사양: `ONESHOT.md` (msgagent 구형 TLS → 브라우저 직접 fetch만 가능)
- 우편번호 검색 라이브러리: `react-daum-postcode`
- 상태 한국어 매핑(전달받음): `inpsyt-order-frontend/src/constants/orderStatus.js` 의 `STATUS_TO_KOREAN`

## 사용자 시나리오
어드민(master·editor·viewer)이 주문 관리 페이지에서 한 행을 클릭하면 이 모달이 열린다. 학회 종료 후 사무실에서 결제 누락분을 paid로 바꾸고 알림톡이 자동 발송되는 것을 확인하거나, 고객이 전화로 주소를 정정해 달라고 하면 해당 섹션(주문자·배송지·관리자 메모·상품)의 편집 아이콘을 눌러 그 섹션만 수정하고 저장한다(학회는 읽기전용). 같은 고객이 학회 폐막 후 “책 1권만 추가요”라고 하면 “연계 주문 연결”로 원주문을 찾아 child로 묶어 배송비 절감 효과를 즉시 확인한다. master는 잘못 들어온 주문을 통째로 삭제할 수 있다. viewer는 모든 컨트롤이 비활성화돼 조회만 가능하다. 데스크톱에서는 가운데 정렬된 카드 모달, 모바일·태블릿에서는 하단에서 올라오는 Drawer.

## 진입 흐름
- 진입: `OrderManagementPage`의 테이블 행 클릭(체크박스·상태 셀 제외) 또는 모바일 카드 클릭
- prop으로 받는 값: `order`, `open`, `onClose`, `statusToKorean`, `productsMap`, `products`, `events`, `addNotification`, `onUpdate`, `productsLoading`, `hasPermission`
- 모달 사이즈: 데스크톱 maxWidth 800, 모바일 SwipeableDrawer(95vh)
- `order.access_token` 있으면 헤더 ⋮ 메뉴에 “고객 주문서 열기” 항목 표시 (2026-07-07 헤더 아이콘 → ⋮ 메뉴 이동)

## 표시 정보 (라벨 단위, 누락 금지)

### 헤더 (2026-07-07 재설계)
- [ ] 모달 제목: “상품주문정보 조회” (Typography variant h5)
- [ ] **⋮ 드롭다운**(`MoreVertIcon`, X 왼쪽, `access_token` 또는 `master`일 때만 노출) — MUI Menu(EventManagementPage 패턴):
  - ① “고객 주문서 열기”(`OpenInNewIcon`, `order.access_token` 있을 때만, `/order/status/{token}` 새 탭)
  - ② Divider(둘 다 노출 시)
  - ③ “주문건 삭제”(`DeleteIcon`, color error.main, `master`만, 기존 `deleteConfirmOpen` 다이얼로그 재사용)
- [ ] 닫기 아이콘 `CloseIcon`
- **제거**: 전역 편집/저장 토글 버튼(섹션별 인라인 편집으로 대체), 상단 알림톡 재발송 버튼(→ 알림톡 InfoRow 인라인), 헤더 OpenInNew 아이콘(→ ⋮), 헤더 삭제 아이콘(→ ⋮)

### 주문 상세 정보 섹션 (Table, line 382)
- [ ] **상품주문번호** — `displayId` 가공:
  - parent_order_id 있으면 `{id}({parent_id})` (이 주문이 child)
  - linkedChildren 있으면 `{id}-{N+1}` (이 주문이 parent, N=자식 수)
  - 그 외 `{id}` 그대로
- [ ] **주문일** — `new Date(order.created_at).toLocaleString('ko-KR')` 풀 포맷 (yyyy. M. d. 오전/오후 hh:mm:ss)
- [ ] **학회명** — **(2026-07-07) 읽기전용 확정**: `events.find(e => e.id === order.event_id)?.name || 'N/A'` 텍스트만. 편집 Select 제거. 할인율 계산도 항상 `order.event_id` 기준
- [ ] **상태** — Select 상시 노출 (편집 모드 아닐 때도 변경 가능). `orders:edit` 없으면 disabled. **변경 즉시 저장** (`handleSaveStatusOnly`). 5개 옵션: `statusToKorean` 전체 (pending/paid/completed/cancelled/refunded)
- [ ] **주문 성격** (조건부, `status === 'pending'` AND `orders:edit`) — ToggleButtonGroup exclusive [일반배송 | 현장수령]. `order.is_on_site_sale`로 초기 선택 표시. pending 아니면 행 자체 비노출(결제 후 금액 변경 방지). 변경 시 배송비 재계산(현장수령→0, 일반배송→정가 기준 무료배송 임계치, create-order `is_on_site_sale ? 0` 규칙과 동일) + before→after 캡션(배송비/최종결제) 즉시 표시 + "변경 저장" 버튼 노출. 저장 = `orders` 직접 단일 UPDATE `{ is_on_site_sale, delivery_fee, final_payment }`(update_order_details 경유 금지)
- [ ] **알림톡** (조건부, `!is_on_site_sale` — 현장수령은 발송 대상이 아니라 행 자체 비노출). **(2026-07-07) 위치를 "상태" InfoRow 바로 아래로 이동**:
  - failed: “실패 {alimtalk_attempted_at ko-KR}: {alimtalk_error}” — error.main, fontWeight 600
  - sent (`alimtalk_status='sent'` 또는 레거시 `alimtalk_sent_at`만 존재): “발송됨 {alimtalk_sent_at ko-KR}”
  - 그 외: “미발송” (muted)
  - **우측 인라인 재발송 버튼**(outlined small, 조건 `orders:edit` AND `status==='paid'`, 실패 시 `color="error"`) — 헤더에서 이 행으로 이동. `handleResendAlimtalk` 재사용
  - 재발송·paid 자동발송 결과로 로컬 상태(`alimtalk`) 즉시 갱신 — 모달 재오픈 없이 반영

### 상태 이력 섹션 (조건부, line 384-386, 544-604)
- [ ] `order.status_history` 배열 길이 > 0일 때만 노출
- [ ] 헤더: “상태 이력” + (접힘 시) “{N-1}개 이전 이력” 캡션 + ExpandMore/Less 아이콘
- [ ] 현재 상태 행(항상 표시, 헤더 직하 grey.50 배경): 상태 Chip + 변경시각(`yyyy.MM.dd hh:mm:ss`) + “현재” 우측 Chip(primary outlined)
- [ ] 이전 상태 행(Collapse): 상태 Chip(작게) + 변경시각(secondary)

### 주문자 정보 섹션 (Table, line 387)
- [ ] **주문자명** — 조회: `order.customer_name` / 편집: TextField
- [ ] **연락처** — 조회: `formatPhone(order.phone_number) || 'N/A'`(하이픈 포맷 표시) / 편집: TextField + **011자리수 포맷터** (`010-XXXX-XXXX`, 최대 11자리 digit). hyphen 자동 삽입 규칙: ≤3=raw, 4-7=`XXX-XXXX`, 8+=`XXX-XXXX-XXXX` (입력 하이픈 UX 유지 — 저장 시 DB 트리거가 숫자만으로 정규화)
- **불변식: `phone_number` 정본=숫자만 저장(DB 트리거). 표시는 `formatPhone`, 검색은 `normalizePhone` 숫자 비교. 쓰기(insert/update)는 하이픈 포함 값을 그대로 보내도 트리거가 정규화 — 프론트는 표시/검색만 정규화 담당**
- [ ] **인싸이트 ID** — 조회: `order.inpsyt_id || 'N/A'` / 편집: TextField (자유 입력)

### 배송지 정보 섹션 (Table, line 388) — **3필드 분리 절대 금지**
- [ ] **우편번호** — 조회/편집 모두 readOnly 텍스트 표시 (`shipping_address.postcode`). Daum 검색으로만 채워짐
- [ ] **주소(도로명)** — 조회: `shipping_address.address || 'N/A'` / 편집: readOnly Typography + “검색” 버튼 → Daum 우편번호 Dialog (zIndex 1400)
- [ ] **상세 주소** — 조회: `shipping_address.detail || 'N/A'` / 편집: 독립 TextField (자유 입력)
- [ ] **배송 메모** — 조회: `order.customer_request || '없음'` / 편집: TextField (자유 입력)

### 관리자 메모 섹션 (Table, line 389)
- [ ] **관리자 메모** — 조회: `order.admin_memo || '작성된 메모가 없습니다.'` (whiteSpace pre-wrap) / 편집: TextField multiline rows=3, placeholder “관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요.”

### 연계 주문 섹션 (line 391-426)
- [ ] 섹션 헤더: “연계 주문” + (조건부, `orders:edit` AND `!parent_order_id`) “연계 주문 연결” 버튼
- [ ] (조건부, linkedParent 있음) Alert info — “원주문 (1차)” + `#{id} · {customer_name} · {final_payment.toLocaleString()}원 [status Chip]`
- [ ] (조건부, linkedChildren 있음) Alert warning 각 자식별 — “추가 주문 (2차)” + 동일 포맷
- [ ] (둘 다 없을 때) “연계된 주문이 없습니다.” Typography secondary
- [ ] **확인 필요** — child 주문(이 모달의 order가 child) 에서도 “연계 주문 연결” 버튼은 숨겨지지만, 부모 주문 1개와 형제 자식 주문(같은 parent 공유)을 함께 보여주지는 않음. parent–child 트리의 1단계만 본다.

### 주문 상품 목록 섹션 (Table, line 427)
- [ ] **(2026-07-07) 편집 잠금 정책**: 연계 주문(`parent_order_id != null || linkedChildren.length > 0`)이면 **Edit 아이콘 숨김 + 읽기전용 + 안내 캡션 "연계 주문의 상품은 각 개별 주문 상세에서 수정하세요."** (자식 아이템의 부모 흡수 붕괴 차단). 비연계 단일 주문만 상품 섹션 편집 허용
- [ ] 헤더: 상품명 · 정가 · 할인가 · 수량 · 합계 · (조건부, `orders:edit`) 현장수령 · (조건부, `orders:edit` AND `editingSection==='items'`) 작업
- [ ] **현장수령 컬럼** (조건부, `orders:edit`) — 각 상품행 Checkbox. `item.on_site_pickup` 반영. **편집모드 무관 상시 활성**(canEdit일 때). **(2026-07-07) 단, `editingSection==='items'`인 동안 disable**(편집버퍼 충돌 방지). 체크 즉시 `order_items.on_site_pickup` UPDATE(낙관적 반영, 실패 시 원복+에러 토스트). **금액 불변**. `item.id` 없으면(미저장 신규행) disabled. 연계 병합 아이템은 각 item의 원본 `order_id`(groupLinkedOrders 주입)로 UPDATE 타깃 지정
  - **B=true(`order.is_on_site_sale`) 시 A 체크 잠금**(B가 A의 상위 계층): 체크박스 `disabled` + `checked` 강제 표시(개별 값과 무관하게 전체 현장수령으로 간주), 컬럼 헤더 라벨 "현장수령"→"전체 현장수령", title "전체 현장수령 주문 — 개별 지정 불가". **A 값(`on_site_pickup`)은 DB로 변경하지 않음(보존)** — disabled라 `handleToggleOnSitePickup` 미호출, `handleSaveOnSiteSale`도 `orders`만 UPDATE. B를 일반배송으로 되돌리면 보존된 원래 개별 체크가 그대로 복원(추가 작업 없음)
- [ ] 행 데이터: `editedOrderItems`(편집 중) 또는 `order.mergedItems || order.order_items`(조회)
- [ ] 상품명 — 조회: `item.product_name || productsMap[item.product_id]?.name || '알 수 없는 상품'` / 편집: Autocomplete (전체 products 옵션, name으로 검색, getOptionLabel name)
- [ ] 정가 — `item.list_price || productsMap[item.product_id]?.list_price || 0`.toLocaleString()원
- [ ] 할인가 — 편집: `getDiscountedUnit(product, discountRate)` / 조회: 스냅샷 `item.price_at_purchase` 우선, 없으면 유틸 폴백.toLocaleString()원 + **보조표기(별도 열 아님): 할인율 %**. 정가 대비 역산 `round((1 − 할인가/정가) × 100)` — 조회(스냅샷) 주문은 당시 **실제 할인율**을, 편집 중이면 재계산된 할인가 기준을 반영(현재 행사율을 과거 주문에 재적용하지 않음). 할인 있는 행 `N% 할인`(error.main·bold), **할인 0%인 행은 `-`(text.disabled)로 명시**. (2026-08-18 추가 — 육안 구분·고객<어드민 정보량 원칙)
- [ ] 수량 — 조회: 숫자만 / 편집: TextField type number (min 0)
- [ ] 합계 — `discountedPrice * quantity`.toLocaleString()원 + **보조표기(별도 열 아님): 행별 할인액** `−((정가 − 할인가) × 수량)`원(error.main, 할인 있는 행만). 모달 폭 제약으로 신규 열 대신 할인가/합계 셀 보조표기 채택. (2026-08-18 추가)
- [ ] (조건부, 편집 모드) 삭제 아이콘 `CloseIcon`(error) — `handleRemoveOrderItem`
- [ ] (조건부, 편집 모드) “상품 추가” 버튼 — **`ProductPickerDialog`를 연다**(2026-08-25, 첫 상품 자동 삽입 폐기). 고객 프론트 `ProductSelectionStep`을 그대로 재사용(검사군 카드·검색·인기/신규 필터). 담기 임시 카트를 확정하면 각 항목이 `{product_id, quantity}`로 `editedOrderItems`에 append(이미 있는 상품이면 수량 합산). 다이얼로그 하단 바 "담은 상품 N개 · 합계 …원" + [취소]/[추가하기]. props: `discountRate`(order.event_id 기준)·`eventTags`(tags∪host_society)·`eventName`·`visibleCategories=null`(어드민 전 상품). 기존 행별 Autocomplete는 담긴 행 교체·수정용으로 유지
- [ ] (productsLoading 시) CircularProgress 한 줄

### 결제 정보 섹션 (Table, line 428)
- [ ] **정가의 합** — `subtotal.toLocaleString()`원
- [ ] **할인된 금액** — `totalDiscount.toLocaleString()`원
- [ ] **배송비** — `shippingFee.toLocaleString()`원
- [ ] **총 결제 금액** — `finalTotal.toLocaleString()`원 (fontWeight bold, fontSize 1.1rem)
- [ ] 조회 모드 값 출처: `order.total_cost` / `order.discount_amount` / `order.delivery_fee` / `order.final_payment`
- [ ] 편집 모드 값 출처: 클라이언트 재계산 (학회 할인율 + 무료배송 임계치 적용, line 125-149)

### 푸터 (line 430)
- [ ] “닫기” 버튼 (outlined, 모바일 fullWidth) — `onClose`

### 연계 주문 검색 Dialog (linkDialogOpen, line 441-500)
- [ ] 제목: “연계 주문 연결”
- [ ] 안내문: “현재 주문(#{order.id})을 다른 주문의 추가 주문으로 연결합니다. 고객명 또는 연락처로 원주문을 검색하세요.”
- [ ] 검색 TextField (placeholder “고객명 또는 연락처 입력”) + “검색” 버튼 (Enter 키도 트리거). `searchOrdersForLinking`: 고객명 ilike + **연락처 숫자만 추출(2자리↑) `phone_number.ilike.%{digits}%`**(하이픈/괄호 무관)
- [ ] 결과 List dense, 각 항목:
  - primary: `#{id} · {customer_name} · {final_payment.toLocaleString()}원`
  - secondary: `{created_at yyyy. MM. dd}` · **굵게**(`연계 시 {saved.toLocaleString()}원 절감 ({freeShipping ? '무료배송' : '합배송'})`) — `freeShipping`이면 #10B981(초록), 아니면 #6366F1(보라)
- [ ] 검색 결과 없음 시 “검색 결과가 없습니다.” Typography
- [ ] 푸터: “취소” 버튼

### 삭제 확인 Dialog (deleteConfirmOpen, line 503-520)
- [ ] 제목: “주문 삭제” (fontWeight 700)
- [ ] 본문 1: “주문 **#{id}** ({customer_name})을 삭제합니다.”
- [ ] 본문 2 (secondary): “이 작업은 되돌릴 수 없습니다.”
- [ ] 푸터: “취소” / “삭제”(contained error, deleting 시 CircularProgress)

### Daum 우편번호 Dialog (showPostcode, line 523-539)
- [ ] 제목: “주소 검색”
- [ ] `DaumPostcode` 컴포넌트 (height 60vh)
- [ ] 완료 시 `addressType === 'R'` (도로명)이면 동명·건물명을 괄호로 부착, 그 외는 `data.address` 그대로

## 액션·기능 (누락 금지)

### 섹션별 인라인 편집·저장 (2026-07-07 재설계 — 전역 편집 폐지)
- [ ] 편집 state = 단일 `editingSection`(`null | 'customer' | 'shipping' | 'memo' | 'items'`). 한 번에 한 섹션만 편집
- [ ] 각 SectionCard 헤더 action 슬롯: 조회 시 **Edit 아이콘**(`EditIcon` fontSize 18, `orders:edit` 시만, title "편집"). 편집 시 값 InfoRow→TextField, action 슬롯→[취소](text)·[저장](contained small). 저장 중 `CircularProgress size 14`
- [ ] **편집 중 카드 강조**: 테두리 `primary.main` 1px만(배경 물들이기·컬러바 금지)
- [ ] **소프트 가드**: 한 섹션 편집 중이면 다른 섹션 Edit 아이콘 `disabled` + title "편집 중인 섹션을 먼저 저장하거나 취소하세요". 물리적 dim/클릭차단 없음
- [ ] **저장 후**: 모달 유지 + 해당 섹션 조회상태 복귀(`onClose` 금지) + `onUpdate()` 재조회
- [ ] **취소**: 해당 섹션 `edited*` state만 `order` 원본값으로 재초기화
- [ ] 저장 경로: 주문자/배송지/메모 = `orders` 부분 UPDATE, 상품(비연계 단일만) = `order_items` 재작성 + `orders` 금액 4필드 UPDATE. **`update_order_details` RPC 미사용**
- [ ] 할인율은 학회 읽기전용화로 항상 `order.event_id` 기준 재계산(상품 편집 중 `editingSection==='items'`)

### 상태 변경 (편집 모드 무관 — 항상 즉시 저장)
- [ ] 상태 Select 변경 → `handleSaveStatusOnly(newStatus)` → `supabase.from('orders').update({ status }).eq('id', order.id)` → 토스트 + `onUpdate()`
- [ ] `status → paid` 전환 시 `is_on_site_sale=false` 면 **`sendAlimtalk(order.id)` 비동기 호출** → 결과 토스트 (성공/실패)
- [ ] DB 트리거가 `status_history` 자동 누적

### 현장수령 (상품별 · A)
- [ ] **권한**: `orders:edit`. 편집모드 진입 불필요(상시 활성)
- [ ] `handleToggleOnSitePickup(index)` → 낙관적 로컬 토글 → `supabase.from('order_items').update({ on_site_pickup }).eq('id', item.id).eq('order_id', targetOrderId)` → 실패 시 원복 + 에러 토스트, 성공 시 `onUpdate()`
- [ ] 금액 계산에 영향 없음(A는 금액 불변)
- [ ] **(2026-07 확정) 라인 단위 제약 — 부분 현장수령 불가**: `on_site_pickup`은 order_items **라인 단위 BOOLEAN**. "같은 상품 여러 개 중 일부만 현장수령"(예: 3개 중 1개)은 **표현 불가** — 라인 전체가 현장수령이거나 전체 배송. 수량 분할 미지원. 실태조사(전체주문 77건 중 주문전체 현장수령 1건·품목단위 0건, "일부만 현장수령" 운영 경험 0)로 **수량 분할 재설계 기각 확정(YAGNI, 오버엔지니어링 방어)**. 부분 현장수령이 실제로 필요해지면 운영 수기 처리(관리자 메모) 후 재검토.

### 주문 성격 전환 (주문 단위 · B, pending 전용)
- [ ] **권한·조건**: `orders:edit` AND `status === 'pending'`
- [ ] 세그먼트 전환 → 로컬 상태만 변경(즉시 저장 아님). 변경 시 배송비·최종결제 before→after 캡션 + "변경 저장" 버튼 노출
- [ ] `handleSaveOnSiteSale` → `supabase.from('orders').update({ is_on_site_sale, delivery_fee, final_payment }).eq('id', order.id)` → 성공 토스트 + `onUpdate()` + `onClose()`. **update_order_details 경유 안 함**(그 RPC는 이 3필드 중 final_payment만 반영)

### 알림톡 재발송
- [ ] **노출 조건**: `orders:edit` AND `status === 'paid'` AND `!is_on_site_sale`
- [ ] 동작: `sendAlimtalk(order.id)` → 결과 토스트 + 로컬 `alimtalk` 상태 갱신(성공=sent/실패=failed) + `onUpdate()` (성공·실패 모두 — 목록 실패 칩 동기화)
- [ ] (해소 2026-06-10) “알림톡” InfoRow로 마지막 발송/실패 시각·사유 표시 — 위 표시 정보 섹션 참조
- [ ] paid 자동발송(`handleSaveStatusOnly`)의 결과 콜백도 동일하게 로컬 `alimtalk` 갱신 + `onUpdate()`

### 삭제
- [ ] **권한**: `master` 전용. editor·viewer 모두 노출 안 됨
- [ ] `handleDeleteConfirm` → `order_items` 삭제 → `orders` 삭제 (트랜잭션 보호 없음, 두 쿼리 순차)
- [ ] **확인 필요** — `order_items` 삭제 성공 후 `orders` 삭제 실패하면 고아 데이터. 트랜잭션 RPC로 묶을지 부채

### 연계 주문 연결
- [ ] **노출 조건**: `orders:edit` AND `!parent_order_id` (이 주문이 아직 child가 아닐 때만)
- [ ] 검색: `searchOrdersForLinking(term, excludeOrderId)` — `customer_name` 또는 `phone_number` ilike, parent_order_id null인 후보만, 최대 10건, 자기 자신 제외
- [ ] 연결: `linkOrders(parent.id, this.id)` — RPC 아니라 클라이언트 트랜잭션:
  - 현재 주문에 `parent_order_id` 세팅
  - `delivery_fee` 0으로 변경
  - `final_payment` 재계산: `child.total_cost - child.discount_amount - (parent가 paid·completed이고 delivery_fee>0이면 parent.delivery_fee 차감)`
  - **확인 필요** — 합산 금액이 free_shipping_threshold 이상인지 검증 없이 항상 `delivery_fee=0`. parent가 무료배송 자격이 안 되는데도 child 배송비를 0으로 만드는 의미. `api/orders.js:144-151` 의 “PAID 상태 + delivery_fee>0인 parent에서만 차감” 조건과 “delivery_fee=0”이 항상 적용되는 것의 정합성 검토 필요.

### 우편번호 검색
- [ ] 편집 모드에서 주소 셀의 “검색” 버튼 → DaumPostcode Dialog
- [ ] 완료 시 `editedShippingAddress` (도로명·동·건물명 가공) + `editedShippingPostcode` 세팅. 상세 주소는 별도 TextField로 직접 입력 유지

### 외부 링크 — 고객 주문 조회
- [ ] `OpenInNewIcon` 클릭 → `/order/status/{access_token}` 새 탭. 어드민이 고객이 받는 알림톡 링크를 직접 열어볼 수 있는 운영 도구.

## 입력 폼 구조 (편집 모드 — 분리/통합 절대 금지)

`OrderDetailModal`은 섹션별 편집에서 아래 필드를 다룬다. 어떤 통합도 금지. **(2026-07-07) 학회는 읽기전용 확정으로 편집 필드에서 제외**.

- [ ] **상태**: Select (statusToKorean 전체, 편집모드 무관 즉시저장)
- [ ] **주문자명**: TextField
- [ ] **연락처**: TextField + 자동 포맷터 (digit only 11자리)
- [ ] **인싸이트 ID**: TextField
- [ ] **우편번호**: readOnly 표시 (Daum 검색 결과의 zonecode)
- [ ] **주소(도로명)**: readOnly + “검색” 버튼 → Daum
- [ ] **상세 주소**: 독립 TextField
- [ ] **배송 메모(customer_request)**: TextField
- [ ] **관리자 메모(admin_memo)**: TextField multiline rows=3
- [ ] **주문 상품 목록**: 각 행 Autocomplete(상품)·TextField(수량)로 담긴 행 교체·수정. “상품 추가” 버튼은 `ProductPickerDialog`(고객 상품 선택 UX 재사용)를 열어 검사군 트리·검색으로 담기(2026-08-25). 삭제 아이콘으로 행 제거.

**시안 절대 금지 사항**:
1. 우편번호+도로명 주소+상세 주소를 한 줄로 통합
2. 배송 메모와 관리자 메모를 한 필드로 통합 (전자=고객 전달 사항, 후자=내부 메모, 노출 권한·의미가 완전히 다름)
3. 상품 검색을 단일 input으로 단순화 (Autocomplete + 수량 TextField + 삭제 아이콘 + “상품 추가” 4컴포넌트 유지)

## 권한별 차이

`hasPermission(key)` 호출 기준:

- [ ] **master**: 모든 기능 + ⋮ 메뉴 “주문건 삭제” 노출
- [ ] **`orders:edit` 보유 (editor 포함)**: 섹션별 Edit 아이콘(주문자·배송지·관리자 메모·상품)·상태 Select 활성·연계 연결·알림톡 재발송 활성. 삭제는 불가.
- [ ] **`orders:view` 만 보유 (viewer)**: 섹션 Edit 아이콘 비노출, 상태 Select disabled. 조회만 가능.
- [ ] (참고) `orders:view` 권한 없으면 OrderManagementPage 자체에 진입 불가하므로 이 모달도 열리지 않음

## 데이터 모델

### `orders` (이 모달이 SELECT/UPDATE/DELETE하는 필드)
- `id` (bigint), `parent_order_id` (bigint nullable), `customer_name` (text), `phone_number` (text)
- `shipping_address` (jsonb) — `{ postcode, address, detail }`
- `customer_request` (text), `admin_memo` (text), `inpsyt_id` (text)
- `is_on_site_sale` (boolean) — 알림톡 재발송 노출 조건 + B 주문 성격 전환(pending 전용, UPDATE 대상: is_on_site_sale/delivery_fee/final_payment)에 사용
- `event_id` (bigint, FK)
- `status` (text — pending/paid/completed/cancelled/refunded)
- `status_history` (jsonb) — 트리거 자동 갱신
- `total_cost` / `discount_amount` / `delivery_fee` / `final_payment` (numeric)
- `access_token` (uuid) — 외부 링크 노출에 사용
- `alimtalk_sent_at` (timestamptz nullable) — “알림톡” InfoRow의 발송 시각 (2026-06-10 표시 추가)
- `alimtalk_status` (text nullable) — `'sent'` | `'failed'` | null. InfoRow 분기·재발송 버튼 강조 기준
- `alimtalk_error` (text nullable) — 실패 사유 표시
- `alimtalk_attempted_at` (timestamptz nullable) — 실패 시각 표시
- `created_at` (timestamptz)

### `order_items` (조회·일괄 재삽입)
- `id, order_id, product_id, quantity, price_at_purchase`
- 스냅샷: `product_name, product_code, category, list_price`
- `on_site_pickup` (boolean, DEFAULT false) — 상품별 현장수령(출고 제외) 플래그. 현장수령 체크박스가 `.eq('id', item.id)` 직접 UPDATE. 상품 섹션 저장(`handleSaveItems`)의 재삽입 payload에도 `on_site_pickup` 포함(편집저장 시 유실 방지). `ALL_ITEMS_SELECT`(api/orders.js)에 `id, on_site_pickup` 포함

### `events` (join)
- `id, name, discount_rate`

### `site_settings`
- `free_shipping_threshold, shipping_cost` — 편집 모드 재계산에 사용

### `update_order_details` RPC (마이그레이션 `20260415_004_update_order_functions.sql`)
- 시그니처: `(order_id_param int, updates_param jsonb, items_param jsonb)`
- 동작: orders UPDATE → order_items DELETE all → order_items INSERT bulk
- **UPDATE 절에 포함되는 필드 (이것만 반영됨)**: `status, customer_name, phone_number, shipping_address, customer_request, final_payment, event_id, admin_memo`
- **클라이언트가 보내지만 RPC가 무시하는 필드**: `inpsyt_id, total_cost, discount_amount, delivery_fee`
- **이건 명백한 부채. CTO 검수 권장.** 편집 모드에서 인싸이트 ID·정가합·할인액·배송비를 수정해도 DB에 반영 안 됨 (final_payment만 반영). 클라이언트와 RPC 시그니처 불일치.

### `linkOrders` (클라이언트 함수, RPC 아님)
- `api/orders.js:128-168` — `supabase.from('orders').update(...).eq('id', childOrderId)` 단일 쿼리
- 반환: `{ combinedListPrice, freeShipping, parentPaidShipping, newFinalPayment, originalFinalPayment, saved }`

### `searchOrdersForLinking` (클라이언트 함수)
- 검색 조건: `customer_name ilike` OR `phone_number ilike`. 숫자 10-11자리면 하이픈 포맷으로도 검색
- `parent_order_id IS NULL` 인 주문만 (이미 child인 주문은 parent가 될 수 없음)

## 빈 상태·로딩·오류 처리

- [ ] 로딩: `productsLoading` 시 주문 상품 목록 행 한 줄에 CircularProgress
- [ ] 빈 상태 — 연계 주문 없음: “연계된 주문이 없습니다.” Typography
- [ ] 빈 상태 — 연계 검색 결과 없음: “검색 결과가 없습니다.”
- [ ] 빈 상태 — 상태 이력 없음: 섹션 자체 비노출
- [ ] 오류: `addNotification(..., 'error')` 토스트만. 모달 내 잔류 alert 없음
- [ ] 알림톡 발송 실패: warning 토스트 (재발송 버튼은 그대로 노출되어 재시도 가능)

## 핵심 발견 (CTO 검수 권장)

1. **(해소 2026-07-07) `update_order_details` RPC 시그니처 불일치 부채.** 섹션별 인라인 편집 재설계로 `handleSaveAll`+RPC 호출을 폐지하고 섹션별 `orders` 부분 UPDATE로 전환. `inpsyt_id`는 `handleSaveCustomer`가 직접 UPDATE, 금액 4필드(`total_cost·discount_amount·delivery_fee·final_payment`)는 `handleSaveItems`가 직접 UPDATE → 이전에 silent fail하던 필드들이 정상 반영. RPC는 더 이상 이 모달에서 호출되지 않음(마이그레이션 함수 자체는 잔존하나 미사용).

2. **삭제는 트랜잭션 보호 없음.** `order_items` 삭제 → `orders` 삭제 두 쿼리가 별도 호출(line 274-277). 첫 번째만 성공하면 고아 order_items가 남거나, 두 번째만 실패하면 빈 주문이 남는다. `delete_order` RPC로 묶거나 ON DELETE CASCADE를 검토할 부채.

3. **`linkOrders`는 무조건 `delivery_fee = 0`.** `api/orders.js:155` UPDATE에서 합산 금액이 무료배송 임계치 미만이어도 child의 배송비를 0으로 만든다. 반환값(`combinedListPrice`, `freeShipping`)은 계산하지만 실 UPDATE에는 반영 안 됨. 운영 의도가 “일단 묶으면 배송비 안 받는다”라면 의도대로지만, “무료배송 자격 충족 시에만 0”이라면 버그. **건우님 확인 필요**.

4. **(해소 2026-06-10) 알림톡 발송 이력 UI 미노출.** 주문 상세 정보 섹션 “알림톡” InfoRow로 발송됨/실패/미발송 + 시각·사유를 표시한다. 실패 시 재발송 버튼이 error 색으로 강조된다.

5. **상태 셀이 편집 모드와 별개로 항상 활성.** 다른 필드는 “편집” 토글이 필요한데 상태만 그렇지 않다(line 382 안의 Select). 운영상 빠른 paid 전환을 위한 의도지만, “편집 모드 아닐 때 실수로 상태가 바뀌는” 사고 가능성. 시안에서 명시적 confirm 도입할지 결정 필요.

## 시안 부재로 인한 결정 사항

시안이 없으므로 다음을 “이 시트의 결정”으로 박는다:

- 모달 구조 7섹션 유지: 헤더 → 주문 상세 → 상태 이력 → 주문자 정보 → 배송지 정보 → 관리자 메모 → 연계 주문 → 주문 상품 목록 → 결제 정보 → 푸터
- 배송지 정보는 3-row Table 유지 (우편번호·주소·상세 주소 분리)
- 편집은 섹션별 인라인(Edit 아이콘 → [취소]·[저장]), 한 번에 한 섹션만 (2026-07-07 재설계로 전역 “편집 ↔ 저장” 토글 대체)
- 상태 Select는 섹션 편집 무관 항상 활성 (단, viewer는 disabled)
- 알림톡 재발송 버튼은 “알림톡” InfoRow 우측 인라인 노출(2026-07-07 헤더에서 이동), 자동 발송과 수동 발송의 분리 의도 유지
- 모바일은 SwipeableDrawer(bottom, 95vh), 데스크톱은 가운데 정렬 카드(maxWidth 800)

## 준비중(PIN 주문) 상세 확장 (2026-10-19, 실 페이지 구현 완료)

> 근거: `DOCS/PRD_현장도움주문.md` §4(담당자 흐름 4·5·6)·§5. PIN 주문으로 생성된 주문은 `status='preparing'`(준비중)으로 이 모달에 들어온다. **기존 섹션 구조(주문 상세 정보 / 주문자 정보 / 배송지 정보 / 관리자 메모 / 주문 상품 목록 / 결제 정보)는 그대로** 쓰고, 준비중일 때의 표시·동작만 아래를 더한다. 상태 상수 `preparing`/라벨 `준비중`/색 `#64748B`는 `A1_OrderManagementPage.md`의 상태 상수 확장과 공유(단일 소스).

### 준비중 — 주문 상세 정보 섹션
- [ ] **상태 행에 준비중 뱃지 + PIN 재표시.** "상태" InfoRow(또는 그 옆)에 준비중 `StatusBadge`와 함께 `match_code`(PIN 4자리)를 칩으로 노출. **고객이 제출하면 PIN은 반납되어 사라진다**(결제대기 전환 시 미표시).
- [ ] **"상품 n종 / 고객 정보 ○✕" 준비 상태 줄.** 상품 담긴 종 수와 고객 정보 유무를 두 개의 상태 칩(○=채움·accent.revenue soft / ✕=비움·중립)으로 보여 준다. 캡션: "상품(1개 이상)과 고객 정보가 모두 채워지면 자동으로 결제대기로 바뀌고 '결제 준비 완료' 알림이 울려요".
- [ ] 준비중은 상태 Select의 전이가 `['cancelled']`뿐(결제대기 전환은 자동이라 드롭다운 대상 아님 — A1 상태 전이 참조). 취소는 목록·상세에서 가능.

### 준비중 — 주문자/배송지 섹션
- [ ] 고객 제출 전에는 **주문자 정보·배송지 정보가 비어 있음.** 주문자 섹션은 빈 상태("고객이 아직 제출하지 않았어요 — PIN으로 배송지를 입력·제출하면 표시됩니다"), 배송지 섹션은 "고객 제출 전에는 배송지가 비어 있습니다".
- [ ] 고객 제출 후(결제대기): 주문자명·연락처·인싸이트 ID, 배송지 **3필드 분리(우편번호·주소·상세 주소) + 배송 메모** 그대로 표시(통합 금지 — 기존 §배송지 정보 규칙 유지).

### 준비중 — 주문 상품 목록(상품 담기)
- [ ] **"상품 담기" = 기존 `ProductPickerDialog`(고객 상품 선택 UX 재사용) 그대로 사용.** 담김 상품은 행사 할인율·배송비 자동 계산(기존 파이프라인). 미리 담아도, 고객 제출 뒤 담아도 됨.
- [ ] 고객은 상품을 수정하지 않는다(상품 칸=담당자, 배송지 칸=고객). 서로 덮어쓰지 않음(PRD §2).

### 결제대기 자동 전환 + 알림 (구현 완료 — 2026-10-19 2차 보완 반영)
- [x] **상품(1개 이상) + 고객 정보가 둘 다 채워지는 순간 자동으로 `preparing → pending`(결제대기).** 별도 "확정" 버튼 없음(PRD §7). 담당자가 상품을 저장하는 순간에도 전환(고객이 상품 없이 먼저 제출한 경우). **구현(DB 기준 판정):** 상세 창이 오래되어 로컬 `customer_name`이 stale일 수 있으므로, `handleSaveItems`는 금액 UPDATE 뒤 `.update({status:'pending', match_code:null}).eq('status','preparing').not('customer_name','is',null).neq('customer_name','').select(...)`를 한 번 더 실행해 **돌아온 행으로 전환을 판정**하고 돌아온 고객 필드를 로컬에 합친다. `handleSaveCustomer`는 로컬 입력값이 정본이라 `shouldPromoteToPending`로 판정하고 승격 시 `match_code:null` 동봉. `status_history`는 트리거(trg_status_history) 담당 — 프론트 미기록.
- [x] **승격 시 PIN 반납(`match_code=null`)** — 사양 "결제대기 전환 시 PIN 미표시"와 일치(두 경로 모두).
- [x] 전환 순간 **"결제 준비 완료" 알림(토스트 + 알림음).** 본인 저장 전환 = `OrderSections` 토스트+`playBeep`(+`onLocalPromote`로 목록 중복 억제). 원격 제출 전환 = `OrderManagementPage` 실시간 알림.
- [x] **상세 창 실시간 갱신:** 준비중 주문을 보여 주는 동안 그 주문 id의 UPDATE를 구독(`order-detail-{id}`)해 고객 필드·상태·PIN만 로컬 병합 → "고객 정보 ○✕"가 즉시 갱신. 편집 중 상품 버퍼·편집 중 섹션 입력은 보호. 채널은 언마운트/준비중 이탈 시 정리.
- [x] 결제대기 전환 후 하단에 **함께 확인 안내 + "카드 결제 진행" 버튼.** PIN 주문에서 온 주문(`status_history`에 preparing 이력)이고 상태 pending일 때만 노출. 버튼은 새 결제 경로를 만들지 않고 **기존 `handleStatusSelect('paid')`**(확인·알림톡 기존 경로)를 호출. 준비중 동안엔 "고객 정보 ○가 되면 자동 결제대기" 안내 박스(시안 ④).

### 시안 반영
- [ ] 시안: `src/components/PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) — 단계 ③(준비중 상세: PIN·준비 상태 줄·상품 담기), ④(고객 제출 → 결제대기 전환 + "결제 준비 완료" 토스트·알림음 + 함께 확인·카드 결제).

## 변경 이력
- 2026-10-19 준비중(PIN 주문) 상세 — 2차 보완(frontend-engineer, 메인 Claude 검수) — **(1) 결제대기 전환 누락 수정(핵심):** 상세 창이 열린 채 고객이 상품 없이 배송지를 먼저 제출하면 로컬 `customer_name`이 null이라 승격이 누락되던 결함을, `handleSaveItems`에서 금액 UPDATE 뒤 **DB 기준 조건부 UPDATE(.eq('status','preparing')·고객명 존재)로 판정**하도록 교체(돌아온 고객 필드 로컬 병합). **(2) PIN 반납:** 두 승격 경로 모두 `match_code:null` 동봉. **(3) 상세 실시간 구독:** 준비중 주문 id의 UPDATE 구독으로 고객 필드·상태·PIN 즉시 반영(편집 중 상품/입력 보호, 채널 id별 고유·정리). **(4) "결제 준비 완료"+"카드 결제 진행" 버튼 복원(룰 D 생략 철회):** status_history에 preparing 이력 있는 pending 주문에만 노출, 기존 `handleStatusSelect('paid')` 재사용. 준비중 안내 박스도 추가. 검증: lint 신규 0, vitest(pinOrder 20건) 통과, build OK.
- 2026-10-19 준비중(PIN 주문) 상세 — 실 페이지 구현 완료(frontend-engineer) — `OrderSections.jsx`에 준비중 상세 반영: 상태 행 = 준비중 뱃지 + `PinChip`(order.match_code) + 취소 텍스트 버튼(canEdit), "준비 상태" 카드(`ReadinessRow` — 상품 n종/고객 정보 ○✕), 주문자 섹션 빈 상태(EmptyState)·배송지 빈 상태 문구(둘 다 편집은 유지 — 담당자 직접 입력 가능). 결제대기 자동 전환: `shouldPromoteToPending({status,itemCount,customerName})` 순수 판정을 `handleSaveItems`(금액 4필드 UPDATE에 status 동봉)·`handleSaveCustomer`(고객 UPDATE에 status 동봉) 두 곳에 적용, `status_history`는 트리거(trg_status_history) 담당이라 프론트 미기록. 전환 시 "결제 준비 완료" 토스트 + `playBeep` + `onLocalPromote`(목록 중복 알림 억제). 상품 담기 = 기존 items 편집 → `ProductPickerDialog` 경로 재사용. `OrderDetailModal`은 `onLocalPromote` pass-through 1줄만. 검증: lint 신규 0, vitest 통과, build OK.
- 2026-10-19 준비중(PIN 주문) 상세 확장(사양·시안 단계, product-designer) — 준비중 상태 상세에 PIN 재표시(제출 시 소멸)·"상품 n종 / 고객 정보 ○✕" 준비 상태 줄·상품 담기(ProductPickerDialog 재사용)·결제대기 자동 전환·"결제 준비 완료" 토스트/알림음·함께 확인·카드 결제 안내 추가. 기존 6섹션·배송지 3필드 분리 보존. 상태 상수는 A1과 공유(preparing/준비중/#64748B, ALLOWED_TRANSITIONS.preparing=['cancelled']). 시안 `PinOrderAdminPreview.jsx`(`/preview/pin-order-admin`) 단계 ③④. 근거 `DOCS/PRD_현장도움주문.md` §4·§5.
- 2026-05-29 신설 — M3-13 선행. 시안 부재 화면이므로 실 컴포넌트가 단일 진실 소스. RPC 시그니처 불일치 1건, 삭제 트랜잭션 부재 1건, linkOrders 배송비 정책 모호 1건, 알림톡 이력 UI 미노출 1건을 부채 후보로 기록. 시안 작업 착수 시 이 시트의 핵심 발견 5건을 먼저 정리한 뒤 진행.
- 2026-05-29 M3-13 시안 정합 — 시안 부재이므로 사양 시트 단일 진실 소스 기반 토큰·합성 컴포넌트 적용.
  - 합성 컴포넌트 적용: `SectionCard`(7섹션), `InfoRow`(주문 상세·주문자·배송지 12행), `StatusBadge`(상태 이력·연계 주문), `PriceBlock`(결제 정보), `ActionSlot`(푸터).
  - Modal/Drawer/Dialog 라운드를 `theme.radii.lg`·`md`·`sm` 토큰으로 교체. raw hex 0, 인라인 fontSize 0, fontWeight 800 본문 0.
  - 정보 구조·필드·액션 전부 보존(7섹션 유지, 배송지 3필드 분리, 연계 주문 Alert→tone 카드, 상태 이력 Accordion).
  - 보존: 모든 API/RPC/Edge Function 호출(`update_order_details`, `linkOrders`, `searchOrdersForLinking`, `sendAlimtalk`, 삭제·status 단건 update, `site_settings` 조회), 권한별 분기, 편집 토글, 자동 알림톡, Daum 우편번호 Dialog.
  - 부채 5건은 손대지 않음(별도 사이클 — CTO 검수 권장).
- 2026-06-10 알림톡 발송 결과 가시화 — 주문 상세 정보 섹션에 “알림톡” InfoRow 추가(발송됨 {시각} / 실패 {시각}: {사유} / 미발송, 현장수령은 행 비노출). `alimtalk_status='failed'`면 헤더 재발송 버튼 `color="error"` 강조. 재발송·paid 자동발송 결과를 로컬 상태로 즉시 반영 + `onUpdate()`로 목록 칩 동기화. 핵심 발견 4번 해소.
- 2026-07-07 현장수령(A·B) 추가 —
  - A: 주문 상품 목록에 `orders:edit` 조건 "현장수령" 체크박스 컬럼 신설. 상시 활성 즉시 저장(`order_items.on_site_pickup` UPDATE, `.eq('id', item.id).eq('order_id', targetOrderId)`), 낙관적 반영·실패 원복. 금액 불변. `handleSaveAll` items_param에 `on_site_pickup` 보존. `ALL_ITEMS_SELECT`에 `id, on_site_pickup` 추가.
  - B: 주문 상세 정보 섹션에 "주문 성격" ToggleButtonGroup(pending·`orders:edit` 전용). 전환 시 배송비 재계산(create-order `is_on_site_sale ? 0` 규칙 정합, 정가 기준 무료배송 임계치) + before→after 캡션 + "변경 저장" 버튼. `orders` 직접 단일 UPDATE(is_on_site_sale/delivery_fee/final_payment), update_order_details 경유 안 함.
  - 정보구조 보존: 기존 표시 항목·필드 삭제/통합 0. 현장수령 컬럼·주문 성격 행만 신규 추가.
- 2026-07-07 A/B 계층 UX 보정 — B(`is_on_site_sale`)를 A의 상위 계층으로. B=true면 상품별 A 체크박스 disabled + checked 강제 표시, 헤더 라벨 "전체 현장수령"으로 치환. **A 값(`on_site_pickup`)은 DB 불변 보존** — B 일반배송 복귀 시 원래 개별 체크 자동 복원. `handleSaveOnSiteSale`은 `orders`만 UPDATE 재확인(order_items 무접촉).
- 2026-07-07 섹션별 인라인 편집 재설계 (CTO·CPO 검수 통과) —
  - 전역 `isEditing`+`handleSaveAll`(RPC 통째 재작성) 폐지 → 단일 `editingSection` state(`null|customer|shipping|memo|items`). 섹션마다 Edit 아이콘으로 그 칸만 독립 편집·저장·취소.
  - 저장 경로: 주문자(`customer_name·phone_number·inpsyt_id`)·배송지(`shipping_address`+`customer_request`)·메모(`admin_memo`)는 `orders` 부분 UPDATE. 상품(비연계 단일 주문만)은 `order_items` delete→bulk insert + `orders` 금액 4필드 UPDATE. `update_order_details` RPC 미사용.
  - **연계 주문 상품 잠금**(치명 리스크 차단): 연계면 상품 Edit 숨김 + 읽기전용 + 안내 캡션. 자식 아이템의 부모 흡수 붕괴 차단.
  - 소프트 가드(다른 섹션 Edit disabled+title, 물리 차단 없음), 저장 후 모달 유지(조회상태 복귀)+`onUpdate()`.
  - 헤더 재구성: 편집/저장·알림톡 재발송·OpenInNew·삭제 아이콘 제거 → ⋮ 드롭다운(고객 주문서 열기 / 주문건 삭제, EventManagementPage 패턴).
  - 알림톡 InfoRow를 "상태" 아래로 이동 + 우측 인라인 재발송 버튼. 학회명 읽기전용화(할인율 계산 `order.event_id` 기준). 현장수령 체크박스는 `editingSection==='items'` 중 disable.
  - 모달 radius: 데스크톱 `modalStyle`에 `overflow:'hidden'` 추가, 헤더 isMobile 전용 radius 정리.
  - 정보구조 보존: 배송지 3필드·배송메모·관리자메모 분리 유지. 표시 항목·라벨 삭제/통합 0. AI 시그니처(컬러바·그라데이션·가짜통계) 0.
  - 핵심 발견 1(RPC 시그니처 불일치 부채) 해소 — inpsyt_id·금액 4필드가 부분 UPDATE로 정상 반영.
- 2026-07-08 OrderSections 추출 + 합배송 재설계 —
  - **섹션 본문 추출**: 주문 상세(상태/알림톡/주문성격)·상태이력·주문자·배송지·메모·상품·결제 + 섹션별 인라인 편집 로직 전부를 `OrderSections.jsx` 공유 컴포넌트로 이전. `OrderDetailModal`은 헤더/푸터/⋮메뉴/삭제/연계 컨테이너 래퍼로 축소. `GroupOrderModal`의 자식 토글이 동일 `OrderSections`를 재사용(자식 편집).
  - **상품 편집 잠금 재정의**: `parent_order_id != null` 일괄 잠금 폐지 → 병합 아이템에 다른 주문(order_id 불일치) 아이템이 섞였거나 `is_group_parent`일 때만 잠금. 자식 단건·비연계 단건은 자기 아이템만 → 편집 허용(껍데기 모델은 흡수 붕괴 없음).
  - **구 연계 연결 Dialog 폐기** → `LinkPreviewDialog`(검색·다중선택·묶음 배송지 RadioGroup·배송비 변화/절감·Case A/B Alert·"다시 나눌 수 없습니다" 확인 체크 → `linkOrders(childIds, repChildId)`). 신규 시그니처(구 2인자 `linkOrders(parentId, childId)` 호출부 제거).
  - **회귀**: 비연계 단일 주문 편집·저장·상태 변경·알림톡 재발송·삭제·현장수령·주문성격(B) 동작 보존. 정보구조·3필드 분리 유지.
  - **stale 테스트**: `OrderDetailModal.test.jsx` 2건(전역 편집 버튼·`update_order_details` RPC 기대)은 78e440f(섹션별 편집 재설계)부터 이미 red — 현 아키텍처와 불일치. 이번 리팩터로 신규 실패 없음(회귀 0).
- 2026-08-25 상품 추가 = 고객 상품 선택 UX 재사용 (frontend-engineer, tech-cto 위임) —
  - **첫 상품 자동 삽입 폐기**: `handleAddOrderItem`이 `products[0]` 삽입 대신 신규 `ProductPickerDialog`를 연다.
  - **`ProductPickerDialog`(신규)**: 고객 `ProductSelectionStep`을 Dialog(fullWidth·maxWidth md, 모바일 fullScreen)에 무수정 재사용. 검사군 트리·검색·인기/신규 필터·태그 우선 정렬을 어드민에서 그대로 사용. 담기 임시 카트는 다이얼로그 로컬 state, 하단 바 "담은 상품 N개 · 합계 …원" + [취소]/[추가하기].
  - **병합**: `handlePickerConfirm`이 임시 카트를 `editedOrderItems`에 append — 이미 있는 상품이면 수량 합산(중복 행 생성 금지), 신규는 `{product_id, quantity}`(현행 형태). 가격 재계산·저장 payload는 기존 파이프라인 그대로(신설 0).
  - **props**: `discountRate`=order.event_id 행사율, `eventTags`=행사 tags∪host_society(getEvents가 host_society 미포함이라 admin은 tags만·graceful), `eventName`, `visibleCategories=null`(어드민 자유도 — 전 상품 노출).
  - **보존**: 기존 행별 Autocomplete(담긴 행 교체·수정용)·수량 TextField·삭제 아이콘·현장수령 컬럼·합배송 잠금(itemsLocked)·권한 게이트 유지. `ProductSelectionStep` 무수정(고객 화면 회귀 0). 표시 항목·라벨 삭제/통합 0.
  - **검증**: build EXIT 0·lint 신규 0(변경 파일 clean), 전체 vitest 294 pass·2 fail(기존 편집버튼 다중매칭, 증가 0)·2 skip.
- 2026-08-25 합배송 무료배송 판정 기준(free_shipping_basis) 확장 —
  - **프론트 2곳**: `LinkPreviewDialog`(묶음 미리보기)·`ShippingPickModal`(대표 취소 위임)의 배송비 판정을 정가 고정 → `site_settings.free_shipping_basis` 설정 경유로 교체. 공유 함수 `constants/shipping.js`의 `shippingBasisAmount` + 신설 `combinedOrderTotals` 사용.
  - **묶음 합계 유도** (`combinedOrderTotals`): 정가 합 = Σ `total_cost`, 할인가 합 = Σ (`final_payment` − `delivery_fee`). `final_payment = 할인가 합 + delivery_fee` 불변식은 배송비를 조정하는 전 경로(create-order·합배송 RPC)가 두 값을 함께 갱신해 유지.
  - **서버 3 RPC 동일 규칙**: `link_orders_into_group`·`reassign_group_representative`·`delete_order_group`이 같은 기준으로 재판정(마이그레이션 `20260825000100`). basis 컬럼 미적용 환경은 create-order 와 동일한 undefined_column graceful fallback → 정가 폴백.
  - **회귀 0**: basis NULL('미설정')·'list_price'면 판정식 기존과 동일(정가 합 ≥ 임계치). 0원 무료 규칙(create-order 의 0원 → 무료)은 합배송엔 기존에도 없었고 이번에도 도입하지 않음(동작 무변경 우선).
- 2026-10-12 stale 테스트 2건 정합화 (코드 무수정) —
  - **판정**: 실패 원인은 테스트가 전역 편집 버튼 1개(`getByRole('button', { name: /편집/i })`)와 `update_order_details` RPC를 기대한 것. 현행 UI는 섹션별 Edit 아이콘(title “편집”) 4개 → 다중매칭 throw. 78e440f(2026-07-07, CTO·CPO 검수 통과) 의도된 재설계이므로 **테스트를 현행에 맞춤**.
  - **[REGRESSION] 배송비 정가 기준**: '주문 상품 목록' 섹션 편집 버튼으로 진입 → `총 결제 금액` 행이 28,800원인지 직접 단언(기존 `getAllByText` ≥1은 표 셀만으로도 통과하던 약한 단언) + 31,800원 부재. 고가 상품 목에 `is_discountable:true` 추가(412ba7b 이후 할인 대상만 행사율 적용).
  - **주문자 섹션 저장**: '주문자 정보' 섹션 편집 → 주문자명 변경 → [저장] → `from('orders').update({ customer_name: '김민준', … }).eq('id', 1)` + `rpc` 미호출 + 토스트 “주문자 정보가 저장되었습니다.” 단언. 모킹 chain에 `update` 추가.
  - **변이 검증**: 배송비 판정을 할인가 기준으로 바꾸면 회귀 테스트 실패, 주문자명을 UPDATE에서 빼면 저장 테스트 실패 — 두 테스트가 실제 결함을 잡음을 확인 후 원복.
  - **시트 본문 정리**: 참조 파일(OrderSections·테스트 추가, 줄 수 삭제), 사용자 시나리오·진입 흐름·권한별 차이·시안 부재 결정의 전역 “편집/저장 토글”·헤더 아이콘 서술, `order_items`의 `handleSaveAll` 서술을 현행으로 갱신. 정보 구조·필드·액션 변경 0.
  - **검증**: 전체 vitest 329 pass·0 fail·2 skip(기존 2 fail 해소), 테스트 파일 lint 0.
