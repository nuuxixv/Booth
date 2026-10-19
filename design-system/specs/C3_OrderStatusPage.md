# 사양 시트 — C3 고객 주문 상태 (OrderStatusPage)

> 이 시트는 고객 주문 상태 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-10-19 **준비중(preparing) 배너·자동 갱신 실 페이지 구현 완료**(frontend-engineer). `OrderStatusPage.jsx`에 준비중 배너(이모지 📝·색 `STATUS_COLORS.preparing`·보조문 2줄 C3 표 그대로) 추가. 준비중일 때 상품·결제 카드 대신 플레이스홀더("담당자가 담는 상품이 이곳에 표시돼요")+주문자 정보 카드(`OrdererInfoCard`, 일반 흐름과 공유 — 복제 방지)만. **자동 갱신은 준비중일 때만** 5초 간격 `get_order_by_token` 재조회, 결제대기(또는 다른 상태)로 바뀌면 멈춤(상태 전환·언마운트 시 `clearInterval` 정리). 학회 종료 처리로 준비중 주문이 삭제돼 RPC가 null을 주면 폴링을 멈추고 첫 조회 실패와 동일한 "주문을 찾을 수 없습니다" 미존재 안내로 전환. `AutoRefreshStrip`(소형 CircularProgress, `components/PinOrderParts.jsx`) 표시, 전환 시 제거. 상태 상수·theme는 백엔드(PR #79)에서 이미 `preparing` 반영 완료(`constants/orderStatus.js`·`theme.js` STATUS). `REVENUE_STATUSES` 불변(미포함). 검증: lint 신규 0·vitest 전체 373 passed·build 성공. 상세는 아래 **§준비중(preparing) 배너** 절.
> 이전 갱신: 2026-10-19 **준비중(preparing) 배너 신설 — PIN 주문(현장 도움)**(product-designer, 시안·사양 단계). 미완료 상태 `preparing`(라벨 **준비중**, 색 `#64748B`)을 **6번째 배너**로 추가. 고객이 PIN으로 배송지만 입력·제출했는데 담당자가 아직 상품을 담지 않은 경우의 상태. 준비중 동안만 몇 초마다 자동 갱신(결제대기가 되면 멈춤), 이후 기존 결제대기 흐름에 합류. 시안: `inpsyt-order-frontend/src/components/PinOrderCustomerPreview.jsx`(`/preview/pin-order-customer`, 단계 토글 ⑥·⑦). 기획: `DOCS/PRD_현장도움주문.md` §3·§4·§6.
> 이전 갱신: 2026-05-13 신설 (M2 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderStatusPage.jsx` (297줄, 단일 파일 + 내부 보조 컴포넌트 `SectionTitle`·`ItemsCard`)
- 진입 라우트: `inpsyt-order-frontend/src/App.jsx:49` — `<Route path="/order/status/:token" element={<OrderStatusPage />} />`
- 진입 트리거:
  - C1 주문 제출 직후 `OrderPage.jsx:193` — `navigate('/order/status/${token}')`
  - 어드민 OrderDetailModal `OrderDetailModal.jsx:352` — `href` 링크
  - 카카오 알림톡 본문 — `inpsyt-order-frontend/src/api/alimtalk.js:30`이 `${FRONTEND_URL}/order/status/${order.access_token}` 형태로 박는 URL
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_COLORS` — 라벨은 이 페이지에서 자체 매핑)
- DB RPC: `supabase/migrations/20260415_004_update_order_functions.sql` (현행본) + `20260407_rls_token_based_access.sql` (원본) — `get_order_by_token(p_token uuid) RETURNS json`, `SECURITY DEFINER`, anon·authenticated 모두 EXECUTE 권한 부여
- DB 스키마: C1 시트 참조 (`orders`, `order_items`, `events`, `products`)

## 사용자 시나리오
주문 제출 직후 자동 리다이렉트되거나, 결제 완료 후 받은 카카오 알림톡(`status='paid'` 트리거 발화)의 URL을 탭해서 들어오는 화면이다. 토큰 한 개만 알면 누구나 접근 가능하지만 토큰이 UUID라 추측 불가. 1차 사용자는 50대 의사가 부스에서 결제 직후, 또는 학회가 끝나고 며칠 뒤 알림톡으로 진입. 화면 한 장에 "지금 어떤 상태인지·언제 받을지·뭘 샀는지·얼마 냈는지" 를 압축해 보여준다. 추가 액션은 없음 — 보기 전용 화면이다. 합배송된 부모/자식 주문은 한 화면에 1차/2차로 통합 표시한다.

## 진입 흐름
- [ ] URL 파라미터 `token` 추출 (`useParams`)
- [ ] `token`이 있으면 `supabase.rpc('get_order_by_token', { p_token: token })` 호출 (`fetchOrder`)
- [ ] RPC 응답은 **토큰 주인 본인 주문 1건만** 반환 → `setOrder(data)`. 형제 주문 상세(child_orders/parent_order)는 응답에 없음(2026-07-13 노출 최소화).
- [ ] RPC가 데이터 없음(`!data`) 또는 에러(`rpcError`) 시 `setError('주문을 찾을 수 없습니다.')` (catch는 모든 예외를 동일 메시지로 흡수)
- [ ] `token` 자체가 falsy면 `fetchOrder` 자체를 호출하지 않음 (line 101) — 이 경우 로딩 스피너만 계속 도는 상태가 되므로 **확인 필요** (실제로는 `/order/status/:token` 라우트가 token 없는 경로를 매칭하지 않으므로 도달 어려움)

### 토큰 기반 접근 제어 (RLS·RPC 구조)
- [ ] `get_order_by_token`은 `SECURITY DEFINER`로 RLS 우회 — anon 사용자도 토큰 한 개만 알면 1행만 조회 가능
- [ ] `access_token`은 UUID(`gen_random_uuid()`, `20260406_add_access_token_to_orders.sql`) — 순차 ID 노출 방지가 도입 이유
- [ ] 만료 개념 없음 — 토큰은 한 번 발급되면 계속 유효. 학회 종료 후에도 접근 가능
- [ ] 잘못된 토큰(존재하지 않는 UUID): RPC가 null 반환 → "주문을 찾을 수 없습니다" 화면
- [ ] 형식 오류 토큰(UUID 아닌 문자열): Supabase가 `rpcError` 반환 → 동일하게 catch 흡수 → 동일 화면

## 상단 상태 배너 문구 (`getBannerConfig`, `OrderStatusPage.jsx:22-73`)
- 이모지·`STATUS_COLORS` **6종**(2026-10-19 준비중 추가)·라벨(`STATUS_TO_KOREAN`)은 고정. `subMessage`만 상태·현장구매 여부로 분기.
- `edd`(도착예정일) = `!order.is_on_site_sale ? order.events?.estimated_delivery_date : null` — 현장구매는 항상 null.
- **현장수령 문구는 `order.is_on_site_sale`로 직접 분기**(2026-07-06). edd null 사유가 현장구매인지 단순 미설정인지 구분 못 하므로 edd 유무 분기만으로는 부정확 → 플래그 직접 판정.

| status | 이모지 | 배송 주문(is_on_site_sale=false) | 현장수령(is_on_site_sale=true) |
|---|---|---|---|
| preparing | 📝 | `['담당자가 상품을 담고 있어요.', '상품과 금액이 표시되면 담당자와 함께 확인해 주세요.']` | (동일 — PIN 주문은 배송지 입력 흐름이라 보통 배송 주문) |
| pending | ⏳ | edd 있으면 `['지금 결제 시 {edd} 도착', '담당자를 통해 결제해 주세요.']`, 없으면 `['담당자를 통해 결제해 주세요.']` | `['담당자를 통해 결제해 주세요.']` |
| paid | 📦 | edd 있으면 `{edd} 도착 예정`, 없으면 `출고 준비 중입니다.` | `결제 완료 · 현장 수령 주문입니다` |
| completed | 🎉 | completedAt 있으면 `{completedAt} 배송 출발`, 없으면 `배송 출발` | `현장 수령 완료` |
| cancelled | ❌ | `결제 전 취소된 주문건입니다.` | (동일) |
| refunded | ↩️ | `결제 취소된 주문건입니다.` | (동일) |

### 준비중(preparing) 배너 — PIN 주문(현장 도움) (2026-10-19 신설)
> 기획 `DOCS/PRD_현장도움주문.md` §3·§4·§6 / 상태 상수는 두 트랙(고객·어드민) 공통. **1글자도 바꾸지 말 것.**
- [ ] **상태 상수**: 코드 `preparing` / 라벨 **준비중** / 색 `#64748B`(slate). `STATUS_COLORS`·`STATUS_TO_KOREAN`·`theme.js` STATUS에 6번째로 추가. **`REVENUE_STATUSES`에는 넣지 않는다**(미완료·매출 미포함). `ALLOWED_TRANSITIONS`에는 목록 UI 전이가 없으므로 넣지 않음(결제대기 전환은 서버가 자동 — 상품+고객정보 둘 다 채워질 때).
- [ ] **이모지**: 📝(제안 — "담당자가 작성·준비 중". 기존 5종 ⏳📦🎉❌↩️과 겹치지 않게 선택. 확정 아님, 건우님 선호 있으면 교체).
- [ ] **발생 조건**: 고객이 PIN으로 **배송지만 입력·제출**했는데 담당자가 아직 상품을 담지 않은 경우(상품 0개 제출 허용). 서버가 상품(1개 이상)+고객정보 둘 다 채워지는 순간 결제대기로 자동 전환.
- [ ] **subMessage**(배열 2줄): "담당자가 상품을 담고 있어요." / "상품과 금액이 표시되면 담당자와 함께 확인해 주세요." 현장수령/edd 분기 없음(준비중은 금액 미확정이라 도착 안내도 없음).
- [ ] **본문 구성**(준비중일 때): 결제 요약·상품 카드는 금액이 미확정이므로 띄우지 않고, **상품 자리에 플레이스홀더**("담당자가 담는 상품이 이곳에 표시돼요") + **주문자 정보 카드**(제출한 배송지)만. 결제대기로 바뀌면 기존 §주문 상품 카드 + §결제 요약 카드 흐름에 그대로 합류.
- [ ] **자동 갱신**: 준비중 동안만 몇 초마다 다시 조회(`get_order_by_token` 재호출). **결제대기가 되면 멈춘다.** 갱신 중임을 알리는 안내 스트립 1줄(소형 `CircularProgress` + "몇 초마다 자동으로 새로고침되고 있어요") — 결제대기 전환 시 스트립 제거. 과장된 애니메이션 금지(표준 로딩 인디케이터만). **갱신 중 RPC가 null(학회 종료로 준비중 주문 삭제)이면 폴링을 멈추고 "주문을 찾을 수 없습니다" 미존재 안내로 전환**한다(이전 준비중 화면을 그대로 두지 않음).
- [ ] 취소 분기(`cancelled`/`refunded`)와 무관 — 준비중 주문은 학회 종료 처리 때 삭제(PRD §4), 고객 화면에서 취소 상태로 보이지 않는다.

### `STATUS_TO_KOREAN` · `STATUS_COLORS` 확장안 (`constants/orderStatus.js`, `theme.js`)
```js
// STATUS_TO_KOREAN
preparing: '준비중',   // ← 신규(맨 앞, pending 이전)
pending:   '결제대기', paid: '결제완료', completed: '처리완료', cancelled: '주문취소', refunded: '결제취소',

// STATUS_COLORS  (theme.js STATUS 도 동일 키·값으로 동기)
preparing: '#64748B',  // ← 신규. slate. 미완료·중립 톤
pending:   '#F59E0B', paid: '#10B981', completed: '#6366F1', cancelled: '#EF4444', refunded: '#F43F5E',

// REVENUE_STATUSES  (불변 — preparing 미포함)
['pending', 'paid', 'completed']
```
> 시안(`PinOrderCustomerPreview.jsx`)은 로컬 상수(`PREPARING_COLOR`·`PREPARING_LABEL`)로 그린다. 위 확장은 **백엔드(PR #79)에서 `constants/orderStatus.js`·`theme.js` STATUS에 반영 완료** — `OrderStatusPage.jsx`는 이 공용 상수를 그대로 쓴다(구현 단계 2026-10-19).

## 합배송 노출 정책 (2026-07-13 확정)
합배송이어도 각 고객은 **본인 주문 1건만** 본다. 다른 참여자 정보(이름·상품·연락처·주소·금액)는 백엔드 응답 단계에서 차단 → 화면은 단일 주문과 동일한 본인 주문 카드를 렌더한다.
- **응답 부가 필드**: `is_grouped`(bool), `is_representative`(bool), `representative_name`(string|null). child_orders/parent_order/is_group_parent/parent_order_id/representative_child_id는 응답에 없음.
- **안내 문구 1줄** (주문자 정보 카드 하단, caption):
  - `is_grouped && !is_representative` → `"{representative_name} 님의 주소로 함께 보내드립니다."` (representative_name null이면 문구 생략)
  - `is_grouped && is_representative && 배송지 있음` → `"주문하신 다른 분과 함께 회원님 주소로 배송됩니다."`
  - `is_grouped && is_representative && 배송지 없음(현장수령)` → `"주문하신 다른 분과 함께 처리됩니다."` (엣지: 대표가 현장수령이면 "회원님 주소로" 문구가 어색 → 톤 완화)
  - `is_grouped === false` → 문구 없음(현행)
- **상태 배너**: 본인 `order.status` 기준(그룹 종합상태 뷰 폐기).
- **취소 분기**: 본인 `order.order_items`만 취소 표시.

## 변경 이력
- 2026-10-19 **준비중(preparing) 배너·자동 갱신 실 페이지 구현 완료**(frontend-engineer). `OrderStatusPage.jsx`에 준비중 배너(📝·`STATUS_COLORS.preparing`·보조문 2줄) + 준비중 전용 본문(상품/결제 카드 대신 플레이스홀더 + 주문자 정보 카드 `OrdererInfoCard`, 일반 흐름과 공유) + **준비중일 때만** 5초 폴링(`get_order_by_token`, 결제대기 전환 시 정지·타이머 정리) + `AutoRefreshStrip`. 상태 상수·theme는 백엔드 PR #79에서 이미 반영됨(이번에 `OrderStatusPage.jsx` 렌더로 연결). `REVENUE_STATUSES` 불변. 취소 분기와 독립. 검증: lint 신규 0·vitest 373 passed·build 성공.
- 2026-10-19 **준비중(preparing) 배너 신설 — PIN 주문(현장 도움)**(product-designer, 시안·사양). 6번째 상태 배너 `preparing`(라벨 준비중·색 `#64748B`·이모지 📝 제안) 추가 — §상단 상태 배너 표·§준비중 배너 절·§확장안. 준비중 동안만 자동 갱신(결제대기 되면 멈춤)·금액 미확정이라 상품 플레이스홀더+주문자 정보만, 결제대기로 합류. `REVENUE_STATUSES` 불변(미포함). 시안 `PinOrderCustomerPreview.jsx`(단계 ⑥ 준비중 / ⑦ 결제대기). 실 상수·theme 반영과 실 페이지 구현은 위 '구현 완료' 줄 참조.
- 2026-07-13 합배송 고객주문서 노출 최소화 — 위 "합배송 노출 정책" 반영. `summarizeGroupStatus` 기반 그룹 종합 배너·"함께 배송되는 주문" child 순회·묶음 PriceBlock·묶음 배송지 카드 **전부 폐기**, 본인 주문 카드 + 안내 문구 1줄로 전환. `summarizeGroupStatus`/`formatGroupCustomerNames`는 어드민(GroupOrderModal·FulfillmentPage·OrderManagementPage)에서 계속 사용 → utils/groupOrder.js 유지, OrderStatusPage에서만 미사용화. **backend `get_order_by_token` 재작성(본인 1건+부가필드)과 동시 배포.**
- 2026-07-08 합배송 껍데기 부모 모델(폐기) — 토큰 order를 그룹 루트로 정규화 → `child_orders[]` 순회로 "함께 배송되는 주문" 그룹 뷰. **2026-07-13 노출 최소화로 대체됨.**
