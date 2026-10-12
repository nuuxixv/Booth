# 사양 시트 — C1 고객 주문서 (OrderPage)

> 이 시트는 고객 주문서 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-08-25 **연락처 제출 가드 + 장바구니 sessionStorage 보존**(frontend-engineer, QA 후속). (1) **연락처 유효성 하드 차단** — 판정을 순수 함수 `isValidMobile`(`utils/formatPhone.js`, `normalizePhone` 후 `01`로 시작하는 10~11자리)로 분리(단위 테스트 8). 하드 차단은 **Step 1→2 진입 게이트 한 곳**(`OrderPage.handleNext` activeStep===1) — 미완성·지역번호(02)·과거 검수용 난수("123")로 제출되면 접수 확인 알림톡이 유실되므로 차단 + 안내 "휴대폰 번호를 확인해주세요. 접수 확인 알림톡이 이 번호로 발송됩니다.". `CustomerInfoStep` 연락처 필드는 **blur 후에만** 같은 검사로 인라인 error/헬퍼 표시(입력 중 방해 없음, 막지 않음 — 안내만). `isCustomerInfoValid`(버튼 활성)는 phone truthy 그대로 유지(버튼은 눌리되 게이트가 친절히 차단, 침묵 disabled 방지). 어드민 경로(NewOrderModal 등) 미변경. (2) **진행 내용 sessionStorage 보존**(`utils/orderDraft.js`, 단위 테스트 8) — `cart`·`customerInfo`·`activeStep`을 **행사 slug별 키**(`inpsyt:orderDraft:{slug}`)로 저장, 마운트 시 lazy-init 복원(부스 회선 불안정 대비). **localStorage 금지**(공용 태블릿에서 다음 고객에게 이전 고객 연락처 유출 방지) — sessionStorage(탭 생명주기)라 복원은 **같은 탭 안에서만** 유효. cart 스냅샷은 **그대로 복원**(서버 create-order가 product_id로 금액 재계산 → 표시 스냅샷이 최신 상품과 달라도 실제 결제 금액 무영향, 재결합 fetch 생략 = 과잉설계 방어). 카트 비면 activeStep 0 강제(깨진 리뷰 화면 방지). 제출 성공(token navigate·success dialog close) 시 클리어. 파싱 실패·구버전 스키마(v≠1) 조용히 무시. 검증: build·lint 신규 0·formatPhone.test 20(신규 8)·orderDraft.test 8(신규).
> 이전 갱신: 2026-08-18 **소분류 칩을 도구 단독 행사에만 노출 — 검사·도서 단독은 숨김**(frontend-engineer, 건우님 정정). 단일 대분류 행사(`visible_categories.length===1`)의 카테고리 칩 노출을 **대분류별 화이트리스트**로 결정한다. 판정은 순수 함수 `shouldShowCategoryChips(visibleCategories)`(`utils/testGroupDisplay.js`, `SUBCATEGORY_CHIP_CATEGORIES = ['도구']`) — 컴포넌트는 `showCategoryChips = shouldShowCategoryChips(visibleCategories)`. **도구만 노출**(소분류 3종 인지 29·언어 24·사회성 22, 총 75상품이라 칩이 짧고 실제로 잘 좁혀짐), **검사(17종·자식명 김)·도서(13종, 심리학 하나가 1,543개)는 숨김**(칩 과다·안 좁혀짐, 검사명·도서명 검색이 주 탐색 경로). 2뎁스 추가는 기각. **인기·신상품(뷰모드) 칩과 검색바는 항상 유지**(숨기는 건 카테고리 칩만). 칩 숨김 시 칩 줄 컨테이너 자체를 조건부 렌더(빈 여백·깨진 간격 없음). 검사·도서 단독에서는 `selectedCategory`가 초기값 `'all'` 고정(칩이 없어 바꿀 수 없음) → 소분류 필터 자연 비활성, 전 상품 노출. **소분류 필터 로직·util(`productMatchesSubCategory`)·검사군 옵션 단위 매칭 분기는 그대로 유지** — 도구는 `test_group_id` 없는 평면 상품이라 소분류 필터 경로를 실제로 탄다. 이전의 "소분류 2종 미만이면 숨김"(`categories.length>=2`) 규칙은 화이트리스트로 대체. 비단일 대분류(일반 학회) 대분류 칩은 회귀 없이 기존대로 노출. **대분류별 노출 여부를 단위 테스트로 검증**(도구 노출 / 검사·도서 숨김 / 다중·NULL 노출). 검증: build·lint 신규 0·testGroupDisplay.test.js 26 passed(신규 4).
> 이전 갱신: 2026-08-18 **배너 할인율 숫자 영구 제거 + 행별 할인 표기**(frontend-engineer, 프리뷰 QA 수정). (1) **헤더 부제의 `· N% 할인 적용` 숫자 표기를 오버라이드 유무와 무관하게 영구 삭제** — 조건부(`!hasOverrideProduct`)라 상품 로딩 전 잠깐 보였다가 사라지는 깜빡임 발생. 3스텝(ProductSelectionStep·CustomerInfoStep·OrderReviewStep) 모두 **행사명만** 남김. 죽은 코드(`hasOverrideProduct`·`hasOverrideItem`·`cart.some(...)`) 정리, `CustomerInfoStep`에서 이제 미사용인 `cart`·`discountRate` prop 제거(OrderPage 호출부도 정리). (2) **장바구니(CartBottomSheet)·주문확인(OrderReviewStep) 아이템 행에 할인 가시화** — `getEffectiveRate(item, discountRate) > 0`인 행만 정가 취소선(text.disabled) + 할인율 %(error.main·700) + 할인 단가; 무할인 행은 정가만(취소선·% 없음). 상품 카드(ProductCard/TestGroupCard)와 동일 시각 언어. 계산은 `utils/pricing.js` 유틸 사용(인라인 공식 금지). 검증: build·pricing.test 14·lint 신규 0.
> 이전 갱신: 2026-08-18 **상품별 할인율 오버라이드 — 고객 화면 반영**(frontend-engineer). 할인 단가 계산을 공용 유틸 `utils/pricing.js`(`getEffectiveRate`/`getDiscountedUnit`)로 일원화 — `ProductCard`·`TestGroupCard`(OptionPrice)·`CartBottomSheet`·`CostSummary`·`OrderReviewStep` 5곳의 복붙 공식 교체. **실효율 = `discount_override ?? (is_discountable ? discountRate : 0)`, 단가 = `round(list_price*(1-실효율))`**(backend create-order와 등가 정본). override가 NULL/undefined면 순수 no-op(옛 공식과 48조합×3식 0 불일치 증명). 카드의 % 표시 텍스트도 `getEffectiveRate*100` 기준으로 통일(행사율 하드코딩 제거). **배너 조건부**: 개별 할인율 상품(`discount_override!=null`)이 하나라도 있으면 헤더 부제의 `· N% 할인 적용` **숫자를 빼고 행사명만** 남긴다(품목별 실효율이 달라 단일 숫자가 오해를 부름 — 정확한 율은 각 카드에 이미 표시). 판정은 컴포넌트 로컬 — `ProductSelectionStep`=`baseProducts.some(p=>p.discount_override!=null)`, `OrderReviewStep`/`CustomerInfoStep`=`cart.some(i=>i.discount_override!=null)`. **`CustomerInfoStep`은 기존 `cart` prop을 신규로 전달받음**(OrderPage 배관 — cart는 이미 보유, 파생 state 추가 없음). 서버(create-order)는 실효율 재계산을 이미 반영(backend 병렬 커밋 44e612a). **DB**: `products.discount_override`(numeric nullable). 검증: build·pricing.test 14 passed·lint 신규 0.
> 이전 갱신: 2026-07-02 **검색 타이핑 렉 해결 + 검색 대상 단순화(4→1)**(frontend-engineer, 건우님 실동작 피드백). ①타이핑 렉 근본 해결 — 검색 input을 별도 `ProductSearchBar.jsx`로 분리(자체 `useState` + 내부 `useDebouncedValue` 250ms). input 값은 컴포넌트 내부에서만 갱신되고 **debounce된 값만** `onSearch`로 상위(`ProductSelectionStep`)에 올림. 기존엔 `searchTerm`이 상위 controlled state라 매 키입력(IME 조합 포함)마다 `ProductSelectionStep`+검사군 트리(MUI Card/Collapse 다수) 전체가 리렌더돼 자모 입력이 "가→가나다" 뭉텅이로 지연됐음. 이제 입력은 input만, 트리는 디바운스 후 1회만 갱신 → 조합 방해 제거. 상위엔 `useDebouncedValue`·`searchTerm` state·`TextField`·`InputAdornment`·`SearchIcon` import 제거, `debouncedSearch`는 SearchBar가 세팅하는 순수 state로 축소. ②검색 대상 = **상품명 원본(`name`) 단일**(4필드 폐지). 기존 검사명·약어·`option_name`·`option_label` 4필드 매칭을 `options.some(p => matchesSearch(p.name, ...))` 하나로 교체. 근거(건우님 통찰): 원본 상품명에 검사명·약어·말머리·옵션이 모두 포함(예 `K·BASC-3 한국판 정서-행동 평가시스템 부모보고형-청소년용_검사지/온라인코드(20)`) → name 단일로 정확도 유지+단순화. 검사군 단위 노출(옵션 하나라도 매칭이면 그 검사군 노출)·자동 펼침·접기 토글 자유 로직은 그대로. ③`TestGroupCard`를 `React.memo`로 감쌈 — 검색어 변경 시 매칭 안 된 카드의 불필요 재렌더 skip. memo 유효화를 위해 `onToggle`이 `(id, expanded)`를 받도록 시그니처 변경(부모가 인라인 화살표 대신 안정 콜백 `toggleGroup` 직접 전달), `onAdd`/`onIncrement`/`onDecrement`/`getCartQuantity`는 기존 `useCallback`(cart 의존)이라 검색어 변경엔 안정. order_items 불변(옵션=개별 product, cart 무변경). testGroupDisplay 그룹핑 무변경(테스트 10 유지). 검증: lint 0(변경 3파일)·build·vitest 113 passed.
> 이전 갱신: 2026-07-02 **검사 위계 진열 UX 4건 수정**(frontend-engineer, 건우님 실동작 피드백). ①검색 속도 — `useDebouncedValue`(신규 훅, 250ms)로 검색어 디바운스. 입력은 즉시 반영(TextField value)·필터/검색 계산만 지연. 그룹핑(`testGroups`)은 `baseProducts` 기준 1회·검색어 비의존(재그룹핑 없음, 기존 유지). 매 키입력 리렌더 → 타이핑 멈춘 뒤 1회로 감소(필터연산 실측 1.58ms/회, 실병목=검사군 카드+옵션 트리 리렌더). ②말머리 검색 — 매칭에 `option_label` 추가(검사명·약어·`option_name`·`option_label`). "교사용"·"청소년" 등 말머리로 검사군 노출. ③접기/펼치기 자유 — 검색 자동 펼침을 **초기 상태로만**. `expandedGroups[id]===undefined`(미조작)면 검색 매칭 여부 따름·정의됐으면 사용자 값 우선. `toggleGroup(id, currentExpanded)`가 현재 표시 상태 반대로 토글(자동 펼침 카드도 즉시 접힘). 검색어 변경 시 사용자 조작 리셋. ④옵션1개 UX 통일(**시안 §(3) 번복**) — 옵션 수 무관 모든 검사군 동일 UX(접힘→펼침→옵션 세로 리스트→담기). `TestGroupCard`의 `isSingle` 분기·바로담기 카드·`OptionPrice variant='single'` 제거. order_items 불변(옵션=개별 product, cart 무변경). testGroupDisplay 로직 무변경(그룹핑은 옵션 수 비의존, 테스트 10 유지). 검증: lint 0(변경 파일)·build·vitest 113 passed.
> 이전 갱신: 2026-07-02 **검사 위계 2뎁스 FE 구현**(frontend-engineer). 시안(아래 갱신)을 실 코드로 반영: `TestGroupCard.jsx`(신규, 3상태 카드) + `ProductSelectionStep.jsx`(검사군 리스트 ↔ 평면 그리드 분기) + `utils/testGroupDisplay.js`(그룹핑 순수 로직, 단위 테스트 10). 검사군 메타(약어·검사명·정렬)는 `fetchTestGroups()`(api/testGroups.js, graceful)로 마스터 조회 후 클라 병합 — `products` 단독엔 `test_group_id`만 있어 메타 조회 필요(GROUP BY RPC는 없음). `is_active=false` 상품·`test_groups.is_active=false` 검사군 고객 진열 제외. 검색=검사군 단위(검사명·약어·`option_name`) + 자동 펼침. graceful(컬럼 미적용 시 전부 평면). order_items 불변(옵션=개별 product, cart `{...product, quantity}`). 검증: lint 0·build·vitest 113 passed(신규 10).
> 이전 갱신: 2026-07-02 **검사 위계 2뎁스 시안 확정 — `test_group_id` 방식**(product-designer). 폐기된 `parent_code`/클라파싱 절을 새 명세로 교체: 검사군 카드 3상태(접힘/펼침/옵션1개)를 DB 컬럼값(`test_groups.name`·`.abbr`, `products.option_label`·`option_name`·`is_common`·`sort_order`) 기반으로 재정의. 말머리=`[대괄호]` 폐지·소프트 회색 틴트 라벨(`gray[100]` 배경)·괄호수량 풀어쓰기(`(20)`→`20개`, 시드 단계 정제). 검사군 카드 가격 완전 은닉(최저가 앵커도 안 함, 룰 11·12). 옵션1개는 펼침 화살표 대신 우측 담기버튼으로 구분. 진열=`is_active=true` 옵션만. graceful(룰 14) 계승. §검사군 카드 절·핵심 발견 11~14 갱신.
> 이전 갱신: 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품 칩은 유지**(건우님 결정). 상품 카드 동적 배지(`products.badges`) 렌더·`badgeMetaByName` prop·`MAX_EMPHASIS_BADGES` 상한 로직 제거. `ProductSelectionStep`의 `fetchBadges`·`badgeMaster`·`badgeMetaByName`도 제거. `is_popular`/`is_new` boolean 칩은 그대로(카테고리 칩 + 인기 + NEW). `products.badges` 코드 참조 0(drop 후 에러 0). §상품 카드 배지 영역·동적 배지 절·핵심 발견 16·17 갱신.
> 이전 갱신: 2026-06-29 **상품 카드 이미지 플레이스홀더 폐기 — 이미지 없으면 슬롯 자체 미렌더**(건우님 결정). 기존 카테고리 색 틴트 박스+ImageIcon 플레이스홀더 제거, `getProductImageUrl(image_filename)`이 null이거나 onError면 `ProductImageSlot`이 `return null`(슬롯 미렌더, 빈 박스 0). 상품명/배지/가격이 카드 상단부터 자연 배치. 이유: 행사 단위로 이미지 유무가 갈림(도구=전부 있음 / 검사·도서=전부 없음, 혼재 없음), 도서·검사는 상품명·옵션 직관성이 이미지보다 중요. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어).** §상품 카드 절 참조.
> 이전 갱신: 2026-06-29 상품 카드 1:1 이미지 슬롯 추가(PRD `DOCS/PRD_상품이미지.md`, P1). `products.image_filename`→`product-images` 공개 버킷 `getPublicUrl`. graceful(컬럼·버킷 미적용 환경 회귀 0). (※ 플레이스홀더는 위 결정으로 폐기.)
> 이전 갱신: 2026-06-29 배지 "최대 2개"는 **표출 정책(본 카드 한정)** 임을 명시 — 입력단(A6 폼·엑셀)은 무제한, 상위 2개 선별 책임은 본 카드 가드레일에 있음(건우님 확정 #1·#2, §상품 카드 동적 배지 절). 카드 코드 변경 없음(정책 문서화).
> 이전 갱신: 2026-06-29 단일 대분류 행사(visible_categories 1종) 상품 카드 상위 카테고리 칩 숨김 — 전부 같은 대분류라 무의미·혼란(`도구`→`검사` 표기 오해 제거), 소분류 칩으로 탐색. 다른 행사(없음/NULL/복수)는 기존 칩 유지(회귀 0). `ProductCard.hideCategoryBadge` prop(`ProductSelectionStep.isSingleCategory` 전달). 건우님 결정.
> 이전 갱신: 2026-06-29 상품 카드 동적 배지(`products.badges`) 표출 구현 — 강조 배지 최대 2개·priority 정렬·미등록 미표시·graceful(실 코드 변경 반영, P1 Open Question 4 확정).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderPage.jsx` (418줄, 3-step 컨테이너)
- 자식 단계: `ProductSelectionStep.jsx` / `CustomerInfoStep.jsx`(282줄) / `OrderReviewStep.jsx`(140줄)
- 보조: `OrderStepIndicator.jsx`(110줄), `FloatingBottomBar.jsx`(189줄), `CartBottomSheet.jsx`(215줄), `ProductCard.jsx`(213줄, 평면 그리드 카드), `CostSummary.jsx`(135줄)
- `TestGroupCard.jsx`(검사군 3상태 카드 — 접힘/펼침/옵션1개) + `utils/testGroupDisplay.js`(`normalizeCategory`/`buildGroupMetaMap`/`groupTestProducts` — 그룹핑·정렬 순수 로직) + `utils/testGroupDisplay.test.js`(단위 테스트 10). **(2026-07-02 FE 구현)** `test_group_id` 방식. ~~`productGroup.js`(`groupProducts`/`parseProductName`) 클라파싱~~ 은 폐기(2026-07-01) — 표시명은 DB 컬럼값(`test_groups.name`/`.abbr`, `products.option_name`/`option_label`).
- 검사군 마스터 조회: `src/api/testGroups.js`의 `fetchTestGroups()`(graceful — 테이블 미존재 시 `[]`). A6 검사군 관리와 공유하는 API 계층.
- Edge Function: `supabase/functions/create-order/index.ts` (서버측 금액 재계산 + INSERT)
- 진입 리다이렉트: `GoRedirect.jsx` (`active_event_slug` 사용)
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20260406_add_status_history_to_orders.sql` + `20260406_add_access_token_to_orders.sql` + 그 외 events/order_items/products/site_settings 관련 파일
- 외부 라이브러리: `react-daum-postcode` (우편번호 검색)

## 사용자 시나리오
의료 학회 부스를 방문한 의사·연구자가 본인 모바일로 학회 전용 링크(`/order?events={slug}`) 또는 QR을 통해 진입한다. 학회 기간 중에만 열리는 화면이고, 결제는 부스 운영자에게 카드를 건네 단말기에서 처리한다. 따라서 이 화면 자체에는 결제 모듈이 붙지 않는다 — 주문 정보를 모으고 제출하는 자리다. 본인 비용 구매라 할인 적용·무료배송 기준선이 결정에 큰 영향을 준다. 1차 사용자는 50대 의사가 안경 너머로 본다는 가정을 잊지 않는다. 진행은 3단계 — 상품 선택 → 주문자 정보 → 확인. 우측 하단 플로팅 바가 각 단계의 다음 액션을 노출한다.

## 진입 흐름
- [ ] `/order?events={slug}` 직접 진입 — `useSearchParams`로 `events` 쿼리 파라미터 추출 (`OrderPage.jsx:29`)
- [ ] `/go` 단축 진입 — `GoRedirect.jsx`가 활성 학회 슬러그(`active_event_slug`)를 받아 `/order?events={slug}`로 `window.location.replace`
- [ ] 어드민 학회 관리 화면에서 운영자가 슬러그 URL을 복사·QR 생성해 고객에게 전달 — `EventManagementPage.jsx:257·263·478·777`
- [ ] 알림톡 본문의 주문 상태 링크(`/order/status/{access_token}`)는 별개 화면 (이 시트의 범위 아님)

## 진행 내용 임시 보존 (`utils/orderDraft.js`, 2026-08-25 신설)
부스 회선이 불안정해 새로고침·탭 퇴출 시 `cart`·`customerInfo`·`activeStep`이 전량 유실되던 문제(QA) 대응.
- [ ] **저장소 = sessionStorage 한정.** localStorage 금지 — 부스 공용 태블릿에서 다음 고객에게 이전 고객 연락처가 남으면 안 됨. sessionStorage는 탭 생명주기라 탭을 닫으면 비워짐. **복원은 같은 탭 안에서만 유효**(customerInfo 포함).
- [ ] **키에 행사 slug 포함**(`inpsyt:orderDraft:{slug}`) — 행사별 격리. 다른 행사 주문서에 이전 카트가 새지 않음.
- [ ] 저장 = `cart`·`customerInfo`·`activeStep` 변경 시 자동(useEffect). 복원 = 마운트 시 lazy-init(`loadOrderDraft(eventSlug)`).
- [ ] **cart 스냅샷 그대로 복원**(product_id 재결합 fetch 생략) — 서버 `create-order`가 product_id로 금액을 재계산하므로 표시 스냅샷이 최신 상품 데이터와 달라도 실제 결제 금액엔 영향 없음(과잉설계 방어). 카트가 비면 `activeStep`은 0 강제(깨진 리뷰 화면 방지).
- [ ] **제출 성공 시 클리어**(token navigate·success dialog close 양쪽). 파싱 실패·구버전 스키마(`v≠1`)는 조용히 무시하고 빈 상태로 시작.

## 부트 화면 — 앱 로드 전·로드 실패 (`index.html`, 2026-08-13 신설)
React가 마운트되기 전까지 고객이 보는 유일한 화면. 외부 CSS·JS가 하나도 도착하지 않은 상태에서도 성립해야 하므로 인라인 마크업·인라인 스타일만 사용한다. `createRoot` 마운트 시 내용이 교체된다.

**신설 배경:** 2026-07 오티즘 현장에서 "상품을 살펴보는 중 화면이 까맣게 변하고 재접속해도 반복"되는 장애가 발생했다. 원인은 다크모드 opt-out(`color-scheme: light`)이 렌더블로킹 외부 CSS에만 있었고 `#root`에 폴백 콘텐츠가 없었던 것. 저대역에서 CSS 도착이 지연되는 구간 내내 안드로이드 강제 다크모드가 빈 캔버스를 검게 칠했다.

- [ ] `<meta name="color-scheme" content="light">` — **반드시 HTML에 둔다.** `index.css`의 `color-scheme: light`(line 75-78)만으로는 그 CSS가 도착하기 전까지 opt-out 신호가 없다
- [ ] `html, body { margin: 0 }` 인라인 `<style>` — CSS 실패 시 브라우저 기본 8px 마진이 살아나 폴백 좌우로 캔버스가 드러나는 것 방지. 값은 `index.css`와 동일하고 MUI CssBaseline이 나중에 주입되므로 정상 동작에 영향 없음
- [ ] 폴백 본문 — 흰 배경(`#FFFFFF`) 풀뷰포트, 시스템 폰트(Pretendard 미도착 상황 전제), 가운데 정렬
  - "주문서를 불러오고 있습니다" (16px / 600 / `#111111`)
  - "네트워크 상태에 따라 시간이 걸릴 수 있습니다" (14px / `#666666`)
- [ ] 12초 경과 시 보조 문구 교체 — **새로고침을 유도하지 않는다.** "네트워크가 느려 시간이 걸리고 있습니다. 그대로 기다려 주세요. 새로고침하면 처음부터 다시 받습니다."<br>타이머는 "아직 받는 중"과 "죽었다"를 구분할 수 없다. 실제로 받는 중이었다면 새로고침이 다운로드를 처음부터 되돌려 상황을 악화시킨다(저대역에서 load 19.6초 관측, 2026-08-13 건우님 지적). 새로고침 안내는 아래 실패 경로 전용이다.
- [ ] 자동 복구 1회를 쓰고도 실패하면(=회복 불가) 그때만 새로고침 안내: "불러오지 못했습니다. 새로고침해 주세요. 반복되면 브라우저를 완전히 닫고 다시 열어주세요." 실패가 확정된 뒤에는 12초 타이머가 이 문구를 덮지 못하게 막는다(`hardFailed` 가드).
- [ ] 스크립트·스타일시트 로드 실패 시 캐시 우회 1회 재시도 — 캡처 단계 `error` 이벤트로 감지, `?_boot={timestamp}` 부착. **기존 `?events={slug}` 반드시 보존.** `sessionStorage['inpsyt:bootReloaded']`로 1회 제한(무한 새로고침 방지). 폴백이 이미 교체된 뒤에는 동작하지 않음
- [ ] 배포 설정 연동(`vercel.json`) — `/assets/*`는 SPA rewrite에서 제외한다. 제외하지 않으면 없는 에셋에 404가 아니라 `200 text/html`이 나가고, 브라우저가 MIME 불일치로 스크립트·스타일시트를 거부해 영구 빈 화면이 된다(모니터링에도 404로 잡히지 않음). 콘텐츠 해시가 붙으므로 에셋은 `max-age=31536000, immutable`
- [ ] 부트 복구는 **동일 출처** 스크립트·스타일시트 실패만 대상으로 한다. 서드파티 폰트 CDN 실패는 `font-display: swap`으로 시스템 폰트가 대신 그려지면 되는 일이라 새로고침 대상이 아니다

### 초기 번들 구성 (`App.jsx`, 2026-08-13)
부스에서 QR로 들어온 고객이 어드민 앱까지 통째로 받고 있었다. 어드민 전체·로그인·주문상태·디자인 프리뷰 19개를 `React.lazy`로 분리하고 `Suspense`(폴백 = `FullScreenSpinner`)로 감쌌다. 공개 주문서(`OrderPage`)만 초기 청크에 남는다.

- [ ] index 청크 `2,519 kB → 447 kB` (gzip `726 kB → 132 kB`), 실측 JS 전송 `873 kB → 280 kB`
- [ ] 어드민은 `AdminLayout` 청크(1,743 kB)로 분리 — 사무실 회선에서만 로드됨
- [ ] `/preview/*` 라우트는 유지(초기 번들에서만 제외). 프리뷰 URL로 검수하는 흐름이 깨지지 않는다
- [ ] 폰트 비동기 로딩은 `design-system/02_DESIGN_TOKENS.md` "로딩 방식" 절 참조 — 정적 4종 ≈3.1MB에서 필요 서브셋만으로

### 저대역 검수 절차 (2026-08-13 신설 — 릴리스 전 필수)
사무실 회선에서는 3MB든 300KB든 똑같이 즉시 뜬다. 2026-07 오티즘 장애는 **느릴 때만** 드러나는 종류였고, 그래서 사전 검수를 통과했다. 릴리스 전에 행사장 회선을 재현해 아래 4개를 본다.

```bash
npm run build && npm run preview:slow -- --preset venue --cold
```

`scripts/slow-preview.mjs`가 `dist/`를 서빙한다. vite preview를 쓰지 않는 이유: 대역폭 제한이 없고, `/assets/*`에 SPA 폴백을 걸어 배포 후 스테일 에셋 상황을 재현할 수 없다. 이 스크립트는 gzip·`immutable`·`/assets` 404까지 프로덕션 규칙을 맞춘다. 프리셋 — `venue`(600kbps/500ms, 관람객 몰린 학회장), `slow-3g`·`fast-3g`(Chrome DevTools와 동일 값).

| # | 시나리오 | 만드는 방법 | 통과 기준 |
|---|---|---|---|
| A | 저대역 정상 | `/order?events={slug}` | 1~2초 내 로딩 화면(검은 화면 0), 6초 내 주문서. 12초 넘으면 "그대로 기다려 주세요"로 교체 — 새로고침 유도 문구가 나오면 실패 |
| B | 폰트 CDN 도달 불가 | 서버를 `--break-font`로 띄운다 | 시스템 폰트(또는 로컬 설치본)로 정상 렌더, **새로고침 루프 없음** |
| C | 배포 후 스테일 에셋 | 서버를 `--break-assets`로 띄운다 | 서버 404 → 폴백 전폭 → `?_boot=` 1회 재시도 → **`?events=` 보존** → 재실패 시 "불러오지 못했습니다" 문구 |
| D | OS 다크모드 | 브라우저/기기 색상 구성을 dark로 | A~C 전부에서 배경이 흰색 유지 |
| F | 고대비 모드 | Windows 설정 → 고대비(밤하늘·흰색 각 1회) | 선택된 필터가 미선택과 구분됨, CTA에 테두리 있음, 배지에 테두리 있음, 대비 4.5:1 미만 아이콘 0개 |

시나리오 B·C는 `dist/`를 수정하지 않는다. `sed`로 `index.html`을 고치는 방식은 셸마다 명령이 다르고(PowerShell에는 `sed`가 없다) 백업·복원을 잊으면 `dist`가 망가진 채 남는다. 검수 서버가 서빙 시점에만 응답을 바꾸므로 실제 라우트에서 그대로 재현된다.

폰트 전송량(4번)은 **검수 PC에 Pretendard가 설치돼 있으면 0으로 나온다.** 로컬 폰트가 `"Pretendard Variable"`을 만족시켜 웹폰트를 내려받지 않기 때문이다. 그 경우 6번이 "로컬 설치본 사용"으로 표시되며 통과다. 폰트 전송량을 실제로 재려면 Pretendard 미설치 기기에서 확인한다.

측정은 브라우저 콘솔에서. `performance.getEntriesByType('paint')`의 FCP와 `navigation.loadEventEnd`를 본다.

**2026-08-13 기준선** (venue 프리셋, 실제 행사 슬러그, 콜드):

| | 수정 전 | 수정 후 |
|---|---|---|
| 첫 화면 표시(FCP) | 없음 — mount까지 아무것도 안 그려짐 | 1,376 ms |
| 주문서 표시(load) | 15,083 ms | 5,502 ms |
| JS 전송(gzip) | 873,075 B | 279,662 B |
| 폰트 전송 | 정적 4종 ≈3.1MB 예정 | 5파일 131,016 B |
| 폰트 CSS | jsdelivr `blocking` (2,570ms) | `non-blocking` |

수정 전 FCP가 아예 없다는 게 이 장애의 정체다. `#root`가 비어 있어 그릴 것이 없었고, 그 15초 동안 안드로이드 강제 다크가 빈 캔버스를 칠했다. 이 표보다 나빠지면 회귀다.

### 고대비(forced-colors) 모드 (2026-08-18)
Windows 고대비를 켜면 OS가 우리 색을 시스템 팔레트로 강제 교체한다. 채움만으로 구분하던 것은 전부 사라지므로, 선택·버튼·배지를 테두리와 시스템 선택색으로 표현한다. 규칙은 `index.css`가 아니라 컴포넌트 `sx`·`theme.js`에 둔다(emotion이 나중에 주입해 CSS 파일 규칙이 지기 때문).

- [ ] 선택된 필터 칩 — `background: Highlight` / `color: HighlightText` / `border: 1px solid CanvasText`. 미선택은 `Canvas`/`CanvasText` + 동일 테두리. **테마 레벨에 걸지 않는다** — `filled`는 MUI 기본 variant라 "차단됨"·"N일차" 같은 상태 표시 칩 34곳까지 선택색으로 칠해진다. `ProductSelectionStep.jsx`의 `forcedColorsChipSx`로 선택 칩에만 적용
- [ ] 칩 내부 아이콘 — `color: inherit`. MUI 기본 색이 남으면 대비 2.95:1로 묻힌다(밤하늘 실측)
- [ ] contained 버튼 — `ButtonFace`/`ButtonText` + `1px solid ButtonText`. MUI contained는 테두리가 없어 채움이 붕괴하면 경계가 사라진다. 선택 의미의 `Highlight`는 쓰지 않는다(칩 선택 상태와 의미가 섞임)
- [ ] 배지(`BadgeBox`) — `1px solid CanvasText`. 소프트 틴트는 알파만 남아 배경과 구분 불가가 되므로, 카테고리 구분은 텍스트 라벨이 담당하고 테두리로 형태만 지킨다
- [ ] `index.css` §11.4는 `:focus-visible`만 담당 — 나머지 규칙은 무효였다(제거)

### 렌더 예외 (`ErrorBoundary.jsx`, 2026-08-13)
- [ ] 앱 루트를 `ErrorBoundary`로 감싼다. `CssBaseline`은 **바깥**에 둬서 폴백 상태에서도 body 배경이 유지된다(화면이 어두워지지 않음)
- [ ] 폴백은 MUI를 쓰지 않는다 — 테마·MUI 자체가 예외 원인일 수 있으므로 인라인 스타일로만 그린다
- [ ] 표시: "화면을 표시하지 못했습니다" / "새로고침하면 대부분 해결됩니다. 같은 화면이 반복되면 담당자에게 알려주세요." / `[새로고침]` 버튼(`window.location.reload()`)
- [ ] 회귀 테스트: `ErrorBoundary.test.jsx` — 정상 자식 렌더 + 예외 시 폴백·버튼 렌더

## 표시 정보 (라벨 단위, 누락 금지)

### 전 단계 공통 — 상단 헤더 (`OrderPage.jsx:271-295`)
- [ ] 좌·우 균형 공백 박스(`flex: 1`) — 가운데 정렬용
- [ ] 브랜드 타이틀 텍스트 — `variant="subtitle2"`, 굵게(`fontWeight: 800`), letter-spacing 1
  - 일반 모드: "인싸이트 · 학지사 상품 주문하기" (`color: primary.main`)
  - 현장구매 모드(트리플탭 토글, `isOnsitePurchase=true`): " · 현장구매" 접미사 추가, `color: warning.main`
- [ ] 트리플탭(600ms 내 3회 탭) 시 현장구매 모드 토글 — `tapCountRef`, `tapTimerRef` (`OrderPage.jsx:276-287`)
  - 토글 가능 조건: `activeStep < 2` (확인 단계에서는 비활성)
  - 토글 시 `Snackbar` 표시: 켤 때 "현장구매 모드로 전환됐어요" / 끌 때 "일반 배송 모드로 전환됐어요" (anchor top center, 2000ms, 코드엔 이모지 포함)

### 전 단계 공통 — 스텝 인디케이터 (`OrderStepIndicator.jsx`)
- [ ] sticky top, `bgcolor: background.paper`, 하단 1px divider, py 1.5, minHeight 56
- [ ] **전 단계(Step 0 포함) 항상 표시** — 3단계(상품선택→주문자정보→주문확인) 인디케이터 노출. (2026-06-01 건우님 — 기존 Step0 숨김 'Lounge mode' 폐기, 첫 화면부터 전체 흐름 인지)
- [ ] 3개 스텝: "상품 선택" / "주문자 정보" / "주문 확인" — 가운데 정렬, 라인 커넥터(32x2)로 연결
- [ ] 단계별 상태 표시:
  - 미완료: 회색 원(`grey.200`) + 번호, 라벨 `text.disabled`
  - 활성: `primary.main` 원 + 번호, 라벨 `primary.main`, `fontWeight: 700`
  - 완료: `primary.main` 원 + `CheckIcon`, 라벨 `text.primary`, 커넥터도 `primary.main`

### 전 단계 공통 — 에러 알림 (`OrderPage.jsx:301-309`)
- [ ] `Alert severity="error"`, dismissable(닫기 가능), `borderRadius: '12px'`, mx 2 mt 2
- [ ] 발생 조건:
  - Step 0 → 1 전환 시 장바구니 비어 있음: "상품을 1개 이상 담아주세요." (`OrderPage.jsx:131`)
  - Step 1 → 2 전환 시 필수 정보 미입력: "필수 정보(성함, 연락처, 이메일)를 입력해주세요." (`OrderPage.jsx:139` — 텍스트 안의 "이메일"은 현 코드 잔재. **이메일 컬럼이 drop된 상태이므로 시안에서는 "필수 정보(성함, 연락처)를 입력해주세요."로 정리. 실 코드 문구도 동기 수정 필요** — 확인 필요)
  - 제출 실패: "주문 처리 중 오류가 발생했습니다: {error.message}" (`OrderPage.jsx:198`)

### 전 단계 공통 — 페이지 컨테이너 (`OrderPage.jsx:259-269`)
- [ ] `minHeight: 100vh`, `display: flex`, `flexDirection: column`
- [ ] `maxWidth: 600` 가운데 정렬 (모바일 우선이지만 데스크탑 폭 제한)
- [ ] 배경색: `activeStep < 2` → `background.paper` (흰색) / `activeStep === 2` → `#F8F9FA` (회색) — 0.3s ease transition
- [ ] **레이아웃 = 풀폭 회색 음영 backdrop(`gray[100]`=#F2F4F6) + 600px 중앙 컬럼.** 컬럼(inner Box) 표면색은 Step 0·1 흰색 / Step 2 `gray[50]`. 모바일앱을 PC 가운데 둔 프레임. (2026-06-01 건우님 — 600 바깥은 음영이어야 함. ※한때 풀폭 흰색 seamless로 잘못 갔다가 복구)
- [ ] 콘텐츠 영역 하단 `pb: 100px` (플로팅 바 가림 방지)

### Step 0 — 상품 선택 (`ProductSelectionStep.jsx`)

#### 헤더 (line 152-162)
- [ ] 페이지 제목 텍스트: "상품을 선택해주세요" — `variant="h3"`, `fontWeight: 800`
- [ ] 부제(조건부, `eventName` 있을 때): "{이벤트명}"만 — `variant="body2"`, `color: text.secondary`. **`· N% 할인 적용` 숫자 표기 영구 제거**(2026-08-18, 로딩 전 깜빡임 제거 — 할인 사실은 각 상품 카드/행에서 표기). 3스텝 헤더 부제 동일.

#### 검색바 (`ProductSearchBar.jsx` — 2026-07-02 입력 격리 분리)
- [ ] `TextField` 풀너비, 시작 아이콘 `SearchIcon`(text.disabled)
- [ ] 플레이스홀더: "상품명으로 검색 (띄어쓰기로 여러 키워드)"
- [ ] 시각: **흰색 기본 아웃라인 TextField(글로벌 테마), `sx={{ mb: 2 }}`만.** (2026-06-01 건우님 결정 — /preview 목업 정합. 기존 회색 채움 `#F2F4F6`/height48/보더투명 폐기. 단 플레이스홀더의 멀티키워드 힌트는 기능 안내라 유지)
- [ ] **입력 격리(2026-07-02, 타이핑 렉 해결):** input 값·debounce는 `ProductSearchBar` 내부 로컬 `useState`+`useDebouncedValue`(250ms)로 가둔다. 상위(`ProductSelectionStep`)엔 **debounce된 값만** `onSearch(debounced)`로 전달. 매 키입력(IME 조합 포함)에 검사군 트리가 리렌더되지 않아야 함(조합 뭉텅이 입력 방지). controlled `value`를 상위 state로 두는 방식 금지.
- [ ] **검색 대상 = 상품명 원본(`name`) 단일.** 검사명·약어·말머리·옵션이 원본 상품명에 모두 포함되므로 `name` 하나로 검색(기존 검사명·약어·`option_name`·`option_label` 4필드 매칭 폐지, 2026-07-02 건우님). 매칭 판정은 검사군 단위 — 검사군의 옵션 중 `name` 매칭이 하나라도 있으면 그 검사군 노출. `matchesSearch`(공백 AND·특수문자 무시 정규화)는 그대로.

#### 뷰 모드 칩 (line 192-219)
- [ ] 가로 스크롤 영역, 칩 3개:
  - "전체" (key=`all`)
  - "인기" (key=`popular`, `StarIcon`) — 기본 선택
  - "신규출시" (key=`new`, `NewIcon` = `FiberNew`)
- [ ] 선택 시 filled+primary, 비선택 시 outlined default. **라운드 `radii.sm`(8px) = 둥근 사각(알약형 아님). 2026-06-01 목업 정합**
- [ ] 검색어가 있을 때는 뷰 모드 필터링 무시 (line 62-65)

#### 카테고리 칩 (`showCategoryChips` 조건부)
- [ ] **단일 대분류 행사(`isSingleCategory`) 중 검사·도서 단독은 이 칩 줄 자체를 렌더하지 않는다. 도구 단독은 소분류 칩을 노출한다**(화이트리스트 `SUBCATEGORY_CHIP_CATEGORIES`)(`showCategoryChips = shouldShowCategoryChips(visibleCategories)`, 2026-08-18). 검색이 주 탐색 경로. 인기·신상품 뷰모드 칩과 검색바는 유지.
- [ ] 다중 대분류(일반 학회): 동적 목록 — `['검사', '도서']` + `baseProducts`에서 추출한 `category`의 unique 합집합 + 맨 앞 "전체"(`all`). **`도구`는 `검사`로 정규화 — 별도 칩 노출 안 함, `검사` 선택 시 도구도 포함 (2026-06-01 건우님 규칙)**
- [ ] 선택 시 filled+secondary, 비선택 시 outlined default. **라운드 `radii.sm`(8px) — 뷰 모드 칩과 동일(2026-06-01 목업 정합)**

> **(구현 완료 — 2026-06-25, 행사별 판매 대분류 필터):** 행사가 "도구"만 파는 경우(오티즘 엑스포), 대분류 "도구" 칩을 숨기고 **그 하위 소분류 칩(인지/언어/상담 등, `products.sub_category` 기준)** 으로 탐색하게 한다.
> - **노출 필터(1차)**: `eventInfo.visible_categories`(events 신규 text[] 컬럼)가 값 있으면 **원본 `product.category`**(검사/도서/도구) ∈ visible_categories 인 상품만 노출(`baseProducts`, `ProductSelectionStep.jsx`). ⚠️ 매칭은 **원본 category** 기준 — 도구→검사 정규화는 칩 표시 전용이라 필터에 미적용. NULL 또는 빈 배열 → 전체 노출(기존 행사 보존). 기존 `eventTags`(tags) 필터와 AND 공존.
> - **(2026-08-18 변경) 단일 대분류 행사(`visible_categories.length === 1`) 중 **검사·도서**는 카테고리 칩 줄 전체를 숨기고, **도구는 소분류 칩을 노출한다**** — 대분류 칩(전부 같은 대분류라 무의미)뿐 아니라 아래 소분류 칩도 숨김. `showCategoryChips = shouldShowCategoryChips(visibleCategories)`. 검색이 주 탐색 경로라 카테고리 칩 없이도 충분(건우님 결정). **단, 도구 단독 행사는 예외로 소분류 칩을 노출한다**(소분류 3종뿐이라 칩이 짧고 실제로 좁혀지며, 75상품을 분류 없이 나열하면 오히려 불편). 검사·도서 단독만 숨김.
> - **(2026-06-29 추가) 상품 카드 상위 카테고리 칩도 숨김**: 단일 대분류 행사(`isSingleCategory`)에서는 `ProductCard`에 `hideCategoryBadge={true}`를 넘겨 카드 상단 카테고리 배지(§아래 ProductCard 카테고리 배지, `도구`→`검사` 표기 포함)를 **렌더하지 않음**. 전부 같은 대분류라 칩 반복이 무의미하고, `도구`→`검사` 표기가 고객에게 혼란. **강조 배지(인기/신규/동적)·상품명·가격은 영향 없음.** `도구`→`검사` 정규화 로직 자체는 다른 행사용으로 유지(단일 대분류일 때만 칩 숨김). 다른 행사(visible_categories 없음/NULL/복수 대분류)는 기존대로 카드 카테고리 칩 표시(회귀 0). 건우님 결정.
> - ~~단일 대분류 행사 카테고리 칩 = `baseProducts`에서 추출한 `sub_category` 목록~~ **(2026-08-18 칩 숨김으로 대체 — 위 항목 참조).** 소분류 칩은 **도구 단독 행사에서만** 렌더하며(검사·도서는 숨김), **소분류 필터 로직·util(`productMatchesSubCategory`)·테스트는 유지**한다(향후 칩 복원·도서 전용 행사 대비). `selectedCategory`가 `'all'` 고정이라 필터는 자연 비활성. 아래 버그 픽스 절의 검사군 소분류 매칭 로직도 코드상 그대로 남아 있다.
>   - **(2026-08-18 버그 픽스) 소분류 필터는 평면 상품과 검사군(2뎁스 카드) 양쪽에 걸린다.** 검사군은 **옵션 중 하나라도** 소분류가 일치하면 노출(`categoryFilteredGroups = testGroups.filter(g => g.options.some(p => productMatchesSubCategory(p, sub)))`). 폴백 규칙(`미지정 → '기타'`)은 평면과 동일 소스(`productMatchesSubCategory`, `utils/testGroupDisplay.js`). 카테고리 필터는 검색·뷰모드와 무관하게 항상 적용(평면 쪽과 동일). **회귀 배경**: 검사 상품이 전부 `test_group_id`로 검사군에 묶인 행사(예 kpa-2026-fall, 검사 1,126개 전량 검사군)에서 이전엔 필터가 평면(0건)에만 걸려 검사군이 전량 무반응이었음. 낡은 `showTestGroups` 게이트(단일 대분류 시 항상 `testGroups.length > 0`)는 제거하고 판정을 `categoryFilteredGroups`로 일원화.
> - 여러 대분류를 함께 파는 행사·NULL·빈 배열이면 **기존 대분류 칩**(검사/도서, 도구→검사 정규화) 그대로 노출.
> - 칩 시각(`radii.sm`·filled secondary)은 기존 패턴 유지. 소분류 색 칩 미적용(AI 시그니처 컬러 인디케이터 금지).
> - **저장 위치 확정**: A5 판매 대분류 = `events.visible_categories` 신규 text[] 컬럼(tags 겸용 기각, `20260624000000_DRAFT` 마이그레이션). graceful: 컬럼/GRANT 미적용 환경에서는 OrderPage가 `visible_categories` 뺀 레거시 select로 fallback → 전체 노출 유지.

> ⚠️ **2026-07-01 정정**: 아래 §③(`parent_code` 자동추출 + 클라 파싱 `parseProductName` + `TestGroupCard`/`productGroup.js`) 방식은 **폐기**됐고 현 브랜치에 **미구현**(해당 컴포넌트·유틸·`20260616000000` 마이그레이션 부재 — grep 확인). 검사 위계는 `DOCS/PRD_검사위계.md`의 **`test_group_id`(시드 적재) + DB 컬럼(`option_name`/`option_label`)** 방식으로 재설계됨. 표시명은 클라 파싱이 아니라 **DB 컬럼값**을 쓴다. 아래 서술은 폐기된 이력이며 FE 신규 구현 시 새 방식으로 교체 예정. **가격 은닉·검색=검사군 단위·graceful 원칙(룰 11·12·14)은 새 방식에서도 계승.**

#### [폐기·미구현] 상품 진열 — 검사군 2뎁스 (③ 자동추출 방식, 2026-06-16)
- [ ] **레이아웃 분기**: 검사·도구(`parent_code` truthy로 그룹핑됨) = **풀폭 1열 리스트**(`TestGroupCard`) / 도서·평면(`parent_code` null) = **기존 그리드**(`ProductCard`).
  - '전체' 카테고리 뷰: `[검사 리스트 블록 → 도서 그리드 블록]` 순. 각 블록 위 `overline` 미니헤더("검사 · 도구" / "도서") — 단일 카테고리 선택 시 미니헤더 미표시.
  - '검사' 칩 = 리스트 블록만 / 그 외 평면 카테고리('도서' 등) 칩 = 그리드 블록만.
- [ ] **그룹핑(클라)**: `groupProducts`(`utils/productGroup.js`)가 `parent_code`로 묶음. **graceful — `parent_code`가 truthy인 행만 그룹, falsy(미적용/도서)면 평면 단일.** 마이그레이션 미적용 환경에서도 전부 평면(기존 동작) 보존.
  - 표시명은 클라 파싱(`parseProductName`): groupName = name 마지막 `_{옵션}` 앞부분, optionName = `_` 뒤부분. 파싱 실패(`_` 없음) 시 풀네임 fallback.
- [ ] CSS Grid(도서), `gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))'`, gap 1.5
- [ ] 페이지네이션: **도서 그리드에만** 40개씩 무한 스크롤(`IntersectionObserver`, `PAGE_SIZE=40`). 검사군(340)은 페이지네이션 없이 전량 — 평균 3.3옵션·340군이라 리스트 가벼움.
- [ ] 정렬 규칙: **학회 태그 매칭 우선(`eventTags`) → 인기 상품(`is_popular`) → 이름 오름차순(`localeCompare`)**. 검사군 카드도 동일(태그 매칭=옵션 중 하나라도 매칭) → `sort_order` → 검사명. 검사군 내부 옵션 정렬은 `sort_order`→이름 유지. **`eventTags` 비면 태그 키가 전부 0 → 기존 정렬과 동일(graceful).** 태그 매칭 판정은 `productMatchesEventTags`(`utils/testGroupDisplay.js`) 단일 함수 재사용(평면·검사군 공통).
- [ ] **학회 태그는 '필터' 아니라 '정렬'(2026-08-18 변경, 건우님 결정)**: 태그 없는 상품도 숨기지 않고 아래로 내림. 근거 = `events.host_society`(주최 학회명) ↔ `products.tags` 문자열 정확 일치(별도 태그 UI 불필요). `eventTags` = `events.tags` ∪ `host_society`(중복·빈값 제거) → 지금은 tags가 전부 비어도 host_society로 동작, 향후 tags 병행 가능.
- [ ] 필터 조합: 카테고리 ∩ 뷰 모드(인기/신규/전체) ∩ 검색 (~~학회 태그 필터~~ 폐기 — 정렬로 일원화)
  - 검색 중에는 뷰 모드·태그 우선순위 무시(검색 결과 우선)
  - **검색 = 검사군 단위**: ①groupName 1차 매칭 → ②실패 시 옵션명(optionName) fallback. fallback 매칭 검사군은 펼친 상태로 노출. 옵션 낱개 결과는 쏟아내지 않음. 도서는 상품명 직접 매칭. 매칭 옵션 별색 하이라이트 안 함(룰 E).

#### 검사군 카드 (`TestGroupCard.jsx` — 2026-07-02 FE 구현 완료)
> **방식 확정(2026-07-02, product-designer 시안 → FE 구현 → UX 수정):** `test_group_id` 기반. 2뎁스 인라인 아코디언. 바텀시트·상세진입 기각(맥락 끊김·CartBottomSheet 중첩 방지). **옵션 수와 무관하게 모든 검사군이 동일 UX**(접힘→펼침→옵션 세로 리스트→담기). ~~옵션1개 특별 분기(3상태)~~ 는 **2026-07-02 번복**(건우님 실동작 피드백 — 옵션 수에 따라 UX가 갈리면 오히려 혼란, 일관된 펼침이 나음). 옵션1개 검사군도 "옵션 1개" + 펼침 화살표 → 펼치면 옵션 행(담기).
> **데이터 소스 = DB 컬럼값**(클라 파싱 아님): 검사명·약어 = `test_groups.name`/`.abbr`(마스터 `fetchTestGroups()`로 조회 후 클라 병합), 옵션 행 = 소속 `products`의 `option_label`(말머리)·`option_name`(형태명)·`list_price`·`is_common`·`sort_order`. 옵션 정렬 = `sort_order`(NULL 폴백 원본순) → 이름. 진열 = `is_active=true`인 옵션만(숨김 옵션 미노출) + `test_groups.is_active=true` 검사군만. 검사군에 노출 옵션 0개면 카드 미표시.
> **구현 메모:** 배지·스테퍼는 `ProductCard`의 `BadgeBox`(export)·스테퍼 패턴 재사용(시각 통일). 옵션 행 가격 `subtitle1`/800, 옵션1개 카드 가격 `subtitle1`/800 + fontSize 1.125rem(목업 `.single-price` 정합). 펼침 영역 `maxHeight 320 + overflowY auto`(다옵션 대응). 그룹핑·정렬은 `utils/testGroupDisplay.js` 순수 함수(단위 테스트 16 — 학회 태그 우선 정렬·`productMatchesEventTags` 포함).

> **상태 = 접힘 / 펼침 2상태(옵션 수 무관 동일).** 옵션1개 특별 분기 없음(2026-07-02 번복).

- [ ] **(1) 접힘**: `ProductCard`와 동일 1.5px 보더 Card(`radii.lg`, shadow none). CardContent `p:2`.
  - 배지(소프트 틴트 `BadgeBox` 재사용 — 솔리드 칩·그라데이션 금지, 높이 18·radius 4): "검사"(`info` 틴트) + 그룹 내 하나라도 `is_popular`면 `StarIcon`(11px)+"인기"(`accent.attention` 틴트) + 하나라도 `is_new`면 "NEW"(`error` 틴트). 그룹에 담긴 옵션 있으면 "담음 N"(`primary` 틴트).
  - **약어**(`abbr`) `caption`/600/`text.secondary` — 좌상단 보조 위계(검사명보다 낮음). abbr 없으면 이 줄 미렌더.
  - **검사명**(`name`) `subtitle1`(16/700) — 카드 주인공. 잘림 없이 wrap.
  - "옵션 N개" `body2`/`text.secondary` — **옵션 수 무관 항상 표시(옵션 1개도 "옵션 1개").** **가격 미표기**(건우님 확정 룰 11·12: 검사군 카드 가격 은닉. 최저가 앵커도 안 함 — A/B 비교 불필요·노안 숫자부담·옵션별 차이 오해 제거).
  - 우측 `ExpandMore`/`ExpandLess`(32×32) — **옵션 수 무관 항상 표시**(옵션1개도 화살표로 펼침). 그룹에 담긴 옵션 있으면 카드 보더 `primary.main`.
  - `role=button`·`aria-expanded`·Enter/Space 토글. 카드 헤더 전체가 hit-area(≥44). 포커스 시 `shadow-focus` 링.
- [ ] **(2) 펼침**: 카드 헤더 아래 `Divider`(top 1px `divider`) → 옵션 행 세로 리스트(**카드 안 카드 금지** — 행+`Divider`, `easing.toss` 0.2s `Collapse`). **행 누적만, 열 분리 금지**(PRD §2 세로 확정).
  - **옵션 행 구조**(좌측 옵션 정보 / 우측 액션):
    - **말머리 라벨**(`option_label`) — 있으면: `caption`/600/`text.secondary`, `gray[100]` 소프트 틴트 배경 + `2px 6px` padding + radius 4px 인라인 라벨(**`[대괄호]` 금지** — 배경 틴트로 구분). `is_common=true`면 라벨 문구 "공용". 말머리 없으면 이 줄 미렌더.
    - **형태명**(`option_name`) — `body2`/600/`text.primary`, 2줄 wrap. **괄호 수량 풀어쓰기**: `검사지/온라인코드(20)` → "검사지·온라인코드 20개"(표시 정제는 시드 단계에서 `option_name`에 반영, 클라 변환 아님). 형태명이 본문 위계, 말머리가 보조.
    - **가격**(`ProductCard` 할인 로직 재사용): 할인 시 정가 `caption` line-through(`text.disabled`) + `{N}%` `caption`/700 빨강(`error.main`) + 할인가 `subtitle1`/800 `primary.main`. 비할인은 최종가 `subtitle1`/800 `text.primary` 단독.
  - **우측 액션**: 카트에 없으면 "담기" 회색 outlined(테마 기본, height 40, min-width 64) / 있으면 수량 스테퍼(`primary.main` bg, 흰 텍스트, 수량 1에서 − = `DeleteIcon`, 2↑ = `RemoveIcon`).
  - 옵션 행 자체 클릭 무반응, 담기/스테퍼만 동작(`e.stopPropagation`).
- [ ] ~~**(3) 옵션 1개 검사군**: 펼침 없이 접힘 카드에 가격·담기 즉시 노출~~ — **2026-07-02 번복(건우님 실동작 피드백).** 옵션 수에 따라 UX가 갈리면 오히려 혼란 → **옵션1개도 위 (1)접힘·(2)펼침과 완전히 동일**하게 처리. 옵션1개 검사군도 "옵션 1개" + 펼침 화살표를 표시하고, 카드 클릭 시 펼쳐 옵션 행(말머리·형태명·가격·담기)을 보여준다. 검사군 카드 가격 은닉 규칙도 동일 적용(옵션1개여도 카드에 가격 없음, 가격은 펼친 옵션 행에서만). `TestGroupCard`의 `isSingle` 분기·`OptionPrice variant='single'`·바로담기 카드 코드는 제거됨.
- [ ] **다문화 등 옵션 다수(8개↑)**: 펼친 옵션 영역 `maxHeight 320 + overflowY auto`, 컨테이너 `display:flex; flexDirection:column; minHeight:0`(스크롤 결함 교훈).
- [ ] **레이아웃**: 검사군 카드는 **풀폭 1열 리스트**(그리드 아님 — 옵션 세로 리스트가 좁은 폭에서도 안정). 도서 등 평면 상품은 기존 그리드 유지. graceful: `test_group_id` 없으면(미적용/미분류) 전부 평면 그리드(기존 동작 보존, 룰 14).

#### 상품 카드 (`ProductCard.jsx`)
- [ ] 보더 1.5px — 장바구니에 있으면 `primary.main`, 없으면 `divider`
- [ ] **상품 이미지 슬롯 (배지 영역 위, mb 1) — (2026-06-29 구현, PRD `DOCS/PRD_상품이미지.md`; 2026-06-29 플레이스홀더 폐기, 건우님 결정):**
  - **1:1 정방형**(`aspectRatio: '1 / 1'`, 풀폭), `radii.sm` 라운드, `overflow: hidden`. 카드 상단에 위치(배지·상품명·가격 위).
  - `products.image_filename` 있으면 `getProductImageUrl(filename)`(`api/productImages.js` — `product-images` 공개 버킷 `getPublicUrl`, 서명URL 아님)로 `<img objectFit:cover loading:lazy>`. 배경 `gray[50]`.
  - **이미지 없으면(URL null) 또는 onError면 슬롯 자체 미렌더(`ProductImageSlot`이 `return null`).** 플레이스홀더(카테고리 색 틴트 박스·ImageIcon) **폐기**(2026-06-29). 빈 박스·여백 0 — 배지/상품명/가격이 카드 상단부터 자연 배치(CardContent flex column 첫 요소가 배지 영역). **대부분 상품이 미등록(NULL)이 정상** — 슬롯 미표시가 기본.
  - 이유: 행사 단위로 이미지 유무가 갈림(도구=전부 있음 / 검사·도서=전부 없음, **한 행사 내 혼재 없음**), 도서·검사는 상품명·옵션 직관성이 이미지보다 중요. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어).**
  - graceful: `image_filename` 컬럼·`product-images` 버킷 미적용 환경에서도 회귀 0(URL null → 슬롯 미렌더). AI 시그니처·그라데이션 없음.
  - 레이아웃 = **현재 평면 그리드 기준**(③ 검사 2뎁스 미머지 — 머지 시 `TestGroupCard` 이미지 적용 여부 재검토, PRD 명시).
- [ ] 상단 배지 영역 (mb 0.75):
  - **배지 = 솔리드 칩 아님. 소프트 틴트 박스(높이 18, radius 4px, alpha 0.12~0.14 배경 + 컬러 텍스트). 2026-06-01 /preview 목업 정합.**
  - 카테고리 배지 — `category` 있으면 표시(`도구`는 `검사`로). `검사`=`alpha(info.main,0.14)` 배경+`info.dark` 텍스트 / 그 외(`도서` 등)=`gray[200]` 배경+`text.secondary`. **단, `hideCategoryBadge=true`(단일 대분류 행사)면 이 배지 미렌더 — §행사별 판매 대분류 필터 규약 참조.**
  - 인기 배지 — `is_popular=true`일 때, `alpha(accent.attention,0.14)` 배경 + `accent.attention` 색 + **`StarIcon`(11px) + "인기" 텍스트** (★ 단독 아님)
  - 신규 배지 "NEW" — `is_new=true`일 때, `alpha(error.main,0.12)` 배경 + `error.main` 텍스트
  - 강조 배지 = 인기 + NEW(시각 순서 인기→신규). 둘 다 같은 `BadgeBox` 소프트 틴트 패턴(솔리드 칩·보더·그라데이션 금지).
  - ~~동적 배지(`products.badges`)·`MAX_EMPHASIS_BADGES` 상한·`badgeMetaByName`·미등록 미표시·graceful~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. `ProductCard`는 인기/신상품 boolean 칩만 표시, `ProductSelectionStep`의 `fetchBadges`·`badgeMaster`·`badgeMetaByName` 제거.
- [ ] 상품명 — `variant="body2"`, `fontWeight: 600`, 토큰 외 인라인 `fontSize: '0.8125rem'` 사용 중(13px) → 02 §타이포 §사용 규칙 약속 2에 따라 시안에서는 14(`body2`)로 흡수
- [ ] 가격 영역:
  - 할인 시(상품이 `is_discountable=true` AND `discountRate > 0`): 원가 line-through(`text.disabled`) + `{N}%` **빨강 텍스트**(`caption`, `error.main`, fontWeight 700 — **칩 아님**, 2026-06-01 /preview 목업 정합)
  - 최종가 — `variant="subtitle1"`, `fontWeight: 800`, 할인 시 `primary.main` 색
- [ ] 액션 영역(높이 40, 하단 고정):
  - 카트에 없으면 "담기" outlined 버튼 — **전역 테마 회색 아웃라인(`gray[300]` 보더 + `gray[800]` 텍스트). primary 파랑 override 폐기, 2026-06-01 목업 정합**
  - 카트에 있으면 수량 스테퍼 — `bgcolor: primary.main`, 흰색 텍스트, 좌측 마이너스/Delete(수량 1일 때), 가운데 수량, 우측 플러스

#### 빈 상태·로딩 (line 252-264)
- [ ] 로딩: `CircularProgress` size 32 thickness 4 가운데, py 8
- [ ] 검색 결과 없음: "검색 결과가 없습니다" + "다른 검색어를 시도해보세요" 가운데, py 8
- [ ] 무한 스크롤 추가 로딩: 하단 작은 `CircularProgress` size 24

### Step 1 — 주문자 정보 (`CustomerInfoStep.jsx`)

#### 헤더 (line 87-96)
- [ ] 페이지 제목 — `isOnsitePurchase` 분기 (2026-06-01 건우님 결정):
  - 일반(배송): **"배송 받으실 주소를 입력해주세요"**
  - 현장구매: "주문자 정보를 입력해주세요" (배송지 없으므로 기존 유지)
  - `variant="h3"`, `fontWeight: 800`
- [ ] 부제: **"{이벤트명}"만** (Step 0 헤더와 동일 패턴, 양쪽 모드 공통). `· N% 할인 적용` 숫자 제거(2026-08-18). 기존 "배송에 필요한 정보입니다"/"주문자 확인을 위한 정보입니다" 폐기

#### 섹션 1 — 필수 정보 (line 96-157)
- [ ] 섹션 헤더: `variant="overline"`, "필수 정보" — `fontWeight: 700`, `color: text.secondary`
- [ ] 필드 1: **성함** — `name="name"`, required, 시작 아이콘 `PersonIcon`(text.disabled, 20px), `inputSx` 적용(`borderRadius: '12px'`, minHeight 52, `bgcolor: '#F8F9FA'`, `fontSize: '16px'`)
- [ ] 필드 2: **연락처** — `name="phone"`, required, placeholder "010-1234-5678", maxLength 13, 시작 아이콘 `PhoneIcon`
  - 자동 하이픈 포맷팅(`handlePhoneChange`): 3-4-4 패턴
  - **유효성(2026-08-25):** 판정 = `isValidMobile`(`utils/formatPhone.js`, `normalizePhone` 후 `01`로 시작 10~11자리). **하드 차단은 Step 1→2 진입 게이트 한 곳**(`OrderPage.handleNext`) — 미완성·02 지역번호·검수용 난수 제출 시 차단 + 에러 알림 "휴대폰 번호를 확인해주세요. 접수 확인 알림톡이 이 번호로 발송됩니다."(접수 확인 알림톡이 유일한 연락 경로라 유실 방지). 필드는 **blur 후에만** 같은 검사로 인라인 error/헬퍼 표시(막지 않음·안내만), 유효/입력전엔 헬퍼 "숫자만 입력해주세요."
- [ ] 필드 3(조건부): **인싸이트 ID** — `hasOnlineCode=true`일 때만 노출. 라벨 "인싸이트 ID (온라인코드 전달용)", placeholder "인싸이트 홈페이지 ID를 입력해주세요", helperText "구매하신 온라인코드를 이 계정으로 보내드려요. 인싸이트(inpsyt.co.kr) 로그인 아이디를 입력해주세요.", 시작 아이콘 `BadgeIcon`
  - `hasOnlineCode` 판정: `utils/onlineCode.js`의 `hasOnlineCode(cartItems)` 단일 소스(서버 create-order 판정과 등가). **3상태 존중**(단순 OR 아님): `includes_online_code === true`→포함 / `=== false`→미포함(**문자열 폴백 차단, 오탐 방지**) / `null·undefined`→상품명 "온라인" 폴백(미확인·컬럼 미적용, 무회귀). `false`가 이름 매칭보다 강함 — 도서 "온라인상담개론" 등 온라인코드 무관 도서 오탐 차단. 죽은 조건 `category === '온라인코드'`는 제거(category 도메인=검사/도서/도구뿐이라 절대 참 안 됨)
  - **소프트 필수**: 온라인코드 상품인데 ID 공란으로 제출 시 확인 다이얼로그("인싸이트 ID 없이 진행하면 온라인코드 전달이 늦어질 수 있어요. 계속할까요?"). "ID 입력하기"(Step 1로 이동) / "이대로 계속"(제출). 하드블록 아님 — 부스 결제 차단 방지. 판정 지점은 `OrderPage.jsx`의 `needsInpsytIdConfirm` 단일 변수(하드블록 전환 시 `isSubmittable`에 `&& !needsInpsytIdConfirm`만 추가)
  - 라벨을 "필수"→"전달용"으로 바꾼 이유: 실제로 하드블록이 아니므로 "필수" 표기는 거짓. 출고 안전망(A3)이 공란건을 잡아준다

#### 섹션 2 — 배송지 정보 (line 159-234, `!isOnsitePurchase`일 때만)
- [ ] 구분선 `Divider` my 3
- [ ] 섹션 헤더 overline "배송지 정보"
- [ ] 필드 4: **주소 검색** — `name="address"`, readOnly, 클릭하면 Daum 우편번호 모달 오픈, 시작 아이콘 `SearchIcon`(`primary.main`), 끝에 outlined 검색 버튼
  - 입력은 절대 직접 못 함 (readOnly), 모달에서만 채워짐
- [ ] 필드 5: **상세주소** — `name="detailAddress"`, 자유 입력, 시작 아이콘 `HomeIcon`
- [ ] 필드 6: **우편번호 — 폼에서 히든** (2026-06-01 건우님). Daum 모달이 `postcode`를 자동 저장하므로 출고/어드민 데이터엔 그대로 포함, 고객 폼에만 미표시(데이터 손실 없음)
- [ ] 모달 동작 (`handleCompletePostcode`, line 50-66):
  - 도로명 주소 시 `bname`·`buildingName`을 조합한 extraAddress를 괄호로 본 주소에 붙임
  - `data.zonecode` → `postcode`, 조합된 주소 → `address`로 저장

> **주소는 세 필드 분리 입력 — 시안 통합 금지.** A3 출고 시트와 1:1 매칭되는 핵심 사실. 운영자가 출고 시 도로명/상세/우편번호를 각각 별도로 복사해 택배 전산에 옮긴다.

#### 섹션 3 — 선택사항 (line 236-269)
- [ ] 구분선 `Divider` my 3
- [ ] 섹션 헤더 overline "선택사항"
- [ ] 필드 7: **요청하실 내용** — `name="request"`, multiline rows 3, 시작 아이콘 `NoteIcon`(상단 정렬)

### Step 2 — 주문 확인 (`OrderReviewStep.jsx`)

#### 헤더 (line 35-43)
- [ ] 페이지 제목: "주문 내용을 확인해주세요" — `variant="h3"`, `fontWeight: 800`
- [ ] 부제: **"{이벤트명}"만** (Step 0 헤더와 동일 패턴). `· N% 할인 적용` 숫자 제거(2026-08-18). 기존 "모든 정보가 올바른지 확인 후 제출해주세요" 폐기 (2026-06-01 건우님 결정)

#### 카드 1 — 주문 상품 (line 45-93)
- [ ] 카드 헤더 좌측: "주문 상품 · {N}건" — `variant="h5"`, `fontWeight: 700`
- [ ] 카드 헤더 우측: "수정" 버튼 (small, `EditIcon` 14px) → `onGoToStep(0)` (Step 0으로 점프)
- [ ] 아이템 행(상품마다 반복):
  - 좌측: 상품명 (`variant="body2"`, `fontWeight: 600`) + 하단 단가 표기
    - **할인 행**(`getEffectiveRate(item, discountRate) > 0`): 정가 `caption` line-through(`text.disabled`) + `{N}%` `caption`/700 빨강(`error.main`) + "{할인단가}원 x {수량}개" `caption`(`text.secondary`) — 상품 카드와 동일 시각 언어 (2026-08-18)
    - **무할인 행**: "{단가}원 x {수량}개" `caption`(`text.secondary`) 단독(취소선·% 없음)
  - 우측: 라인 합계 (`variant="subtitle2"`, `fontWeight: 700`)
  - 행 사이 `Divider`
- [ ] 카드 보더 16px radius(인라인 — 시안에서는 토큰 라운드로 흡수), divider 보더

#### 카드 2 — 주문자 정보 (line 95-118)
- [ ] 카드 헤더 좌측: "주문자 정보" — `variant="h5"`, `fontWeight: 700`
- [ ] 카드 헤더 우측: "수정" 버튼 → `onGoToStep(1)`
- [ ] InfoRow 행 — 라벨(`variant="body2"`, `text.secondary`, minWidth 72) + 값(`variant="body2"`, `fontWeight: 500`, wordBreak break-all)
- [ ] 표시 항목 (조건부):
  - "성함": `customer_name`
  - "연락처": `customerInfo.phone`
  - "배송지"(조건부): `[postcode, address, detailAddress]` 공백 join — **한 줄 통합 표시**. 이 자리에서만은 표시용 통합. 입력·DB는 분리 그대로.
  - "인싸이트 ID"(조건부): `customerInfo.inpsytId`
  - "요청사항"(조건부): `customerInfo.request`

#### 카드 3 — 결제 정보 (`CostSummary` embedded, line 120-125)
- [ ] 섹션 제목: "결제 정보" — `variant="h5"`, `fontWeight: 700`
- [ ] 무료배송 진행바(`!isOnsitePurchase`일 때만): 회색 카드(`#F2F4F6`, radius 12) 안에 안내문 + LinearProgress. 진행·잔여·달성 판정은 `free_shipping_basis` 설정 기반 금액(정가/할인가, 기본 정가) — `shippingBasisAmount` 공유 함수 경유(2026-08-25)
  - 미달성: "무료배송까지 {남은금액}원 남았습니다!"
  - 달성: "무료배송 혜택이 적용되었습니다!"
  - LinearProgress 색: brand 그라데이션 — `linear-gradient(90deg, #2B398F 0%, #3d4db0 100%)` (시안에서는 단색 brand-700로 단순화 검토)
- [ ] 비용 행 (좌측 라벨 / 우측 값):
  - "총 상품 금액": `totalOriginalPrice` 원
  - "할인 금액"(조건부, > 0): `-{N}원`, 양쪽 모두 `error.main` 색
  - "배송비"(`!isOnsitePurchase`): 값 > 0이면 "{N}원", 0이면 "무료"
- [ ] dashed `Divider` my 2.5
- [ ] 최종 행: "최종 결제 금액" (`variant="h6"`, `fontWeight: 700`) + 최종 금액 (`variant="h3"`, `color: primary`, `fontWeight: 800`, 모바일 22px / 태블릿+ 24px — 시안에서 `title-page` 토큰으로 흡수)

#### 배송 예정일 안내 (line 127-134, `!isOnsitePurchase` AND `estimatedDeliveryDate` 있을 때)
- [ ] 회색-블루 박스: `bgcolor: rgba(43, 57, 143, 0.06)`, border `rgba(43, 57, 143, 0.18)`, radius 12, p 2, 가운데 정렬
- [ ] 문구: "지금 주문하면 {M월 d일 (E)} 도착 예정이에요." — `date-fns/format` `ko` locale, `primary.main`, `fontWeight: 600` (실제 코드엔 트럭 이모지가 앞에 붙음)

### 전 단계 공통 — 플로팅 하단 바 (`FloatingBottomBar.jsx`)
- [ ] position fixed bottom 0, **`left:0; right:0; maxWidth:600; mx:auto`로 600px 중앙 정렬** — 콘텐츠 컬럼과 동일한 auto-margin 방식이라 스크롤바 오프셋 없이 컬럼과 픽셀 정렬(`100vw` 계산 금지: 스크롤바 폭 포함돼 PC에서 ~7px 어긋나 "양옆 틈" 발생했던 원인). zIndex 1200
- [ ] `bgcolor: background.paper`, top 1px divider, `boxShadow: '0 -4px 20px rgba(0,0,0,0.08)'`
- [ ] 안전 영역: `pb: max(12px, env(safe-area-inset-bottom))`

#### Step 0 — 무료배송 안내 영역 (`!isOnsitePurchase` AND 장바구니 있음일 때, line 78-103)
- [ ] 판정 기준: OrderPage가 `shippingBasisTotal`(설정 기반 정가/할인가, 기본 정가)을 `totalPrice`로 전달 — `FloatingBottomBar`는 이 값으로 임계치 비교(2026-08-25 통일)
- [ ] 미달성 + 카트 있음: "무료배송까지 {남은}원 남았어요." (`variant="caption"`, `text.secondary`, `fontWeight: 600`) + LinearProgress(height 4)
- [ ] 달성: "배송비가 무료로 적용됐어요!" (`primary.main`, `fontWeight: 700`)

#### Step 0 — 좌측 장바구니 아이콘 (line 113-142)
- [ ] `CartIcon` (26px) + `Badge`(수량) — primary 색
- [ ] 카트 있으면 클릭하여 `CartBottomSheet` 오픈, 색 `primary.main` / 비어 있으면 `text.disabled`

#### Step 1·2 — 좌측 뒤로 가기 아이콘 (line 143-154)
- [ ] `IconButton` `ArrowBackIcon`, 48x48, `text.secondary` 색
- [ ] 클릭 시 `setActiveStep(prev - 1)` + 스크롤 top

#### 우측 CTA 버튼 (line 157-183)
- [ ] `variant="contained"`, size large, fullWidth, minHeight 52, radius 14(인라인 — 시안에서는 `radius-button`=8로 흡수)
- [ ] 단계별 라벨:
  - Step 0: **"배송지 입력하기"** (배송 주문) / **"주문서 작성하기"** (현장구매 `isOnsitePurchase`) — 2026-06-01 건우님 결정, isOnsitePurchase 분기
  - Step 1: "다음"
  - Step 2: "주문 제출하기"
- [ ] 단계별 비활성 조건(`getNextDisabled`):
  - Step 0: 장바구니 비어 있음
  - Step 1: `!isCustomerInfoValid || !hasCartItems` — **성함·연락처 + (배송 모드면 도로명주소·상세주소도) 필수.** 현장구매는 성함·연락처만. 미입력 시 '다음'/제출 차단 (2026-06-01 건우님)
  - Step 2: 위 + `isSubmitting`
- [ ] 제출 중: 아이콘 자리에 `CircularProgress` size 20, 라벨 "주문 처리 중..."
- [ ] 끝 아이콘: Step 0·1은 `ArrowForwardIcon`, Step 2는 없음

### CartBottomSheet (`CartBottomSheet.jsx`, Step 0의 카트 아이콘 클릭 시 + 'CTA 진행' 확인 시트)
> 2026-06-01 디자인 시스템 정합(M3 후속): raw-hex·인라인 토큰을 theme 토큰으로 교체. 시각·기능 동일, 라벨 구조 불변.
> 2026-06-01 확정 영역 추가(건우님): `onProceed` 전달 시 푸터 하단에 `총 N건 구매` + (배송비 시)무료배송 업셀 + 진행/추가 버튼 노출(변경이력 5 참조). 0→1 전환은 이 시트의 버튼으로 수행.
- [ ] `SwipeableDrawer` anchor bottom, `disableSwipeToOpen`, `maxHeight: 75vh`, top radius `theme.radii.lg`(16)
- [ ] 좌우 600px max 가운데 정렬 (플로팅 바와 동일 폭), `pb: env(safe-area-inset-bottom)`
- [ ] 상단 드래그 핸들 — 40x4 회색 바(`grey.300`, `theme.radii.pill`)
- [ ] 헤더 — "장바구니 {N}" (`variant="h4"`, `fontWeight: 800`, 숫자만 `primary.main`) + `CloseIcon` 우측
- [ ] 아이템 행:
  - 상단: 상품명 (`variant="body2"`, `fontWeight: 600`) + 우측 `CloseIcon` 작은 삭제 버튼
  - 중단(단가 표기, 2026-08-18): **할인 행**(`getEffectiveRate(item, discountRate) > 0`) 정가 `caption` line-through(`text.disabled`) + `{N}%` `caption`/700 빨강(`error.main`) + 할인단가 `caption`/600(`text.primary`) 한 줄(flexWrap — 좁은 바텀시트 폭 대응) / **무할인 행** 정가 `caption`(`text.secondary`) 단독. 상품 카드와 동일 시각 언어
  - 하단: 수량 스테퍼(보더 1px divider, `theme.radii.sm`=8) + 라인 합계 `variant="subtitle2"`(토큰 weight 700)
  - 수량 스테퍼: 수량 1에서 -1 누르면 `DeleteIcon`으로 전환(카트 제거), 2 이상이면 `RemoveIcon`
- [ ] 빈 상태: `ui/EmptyState`(icon=`ShoppingCartOutlined`, title="장바구니가 비어있습니다")
- [ ] 푸터(아이템 있을 때, `bgcolor: grey.50`):
  - **총 상품 금액 행**: `totalOriginalPrice`(정가 합계) — `caption`/`subtitle2`. (2026-06-01 건우님 — 시트에도 정가 대비 할인 표기)
  - **할인 금액 행**(할인 > 0): `-(totalOriginalPrice - totalPrice)`, `error.main` 빨강 — `caption`/`subtitle2`
  - 배송비 행(`!isOnsitePurchase`): 무료배송 판정은 `constants/shipping.js`의 `calcShippingFee` 공유 함수 경유(2026-08-25). `free_shipping_basis` 설정에 따라 정가/할인가 합계로 판정, 기본 정가. 무료면 "무료", 부과면 `shippingFee` 표시 (`variant="subtitle2"`)
  - 총 금액 행: 라벨 `variant="body1"`, `text.secondary` + 합계 `variant="h4"`, `primary.main`, `fontWeight: 800`
  - 현장구매(`isOnsitePurchase=true`)면 배송비 행 미표시 + 합계는 배송비 미가산

### 성공 다이얼로그 (`OrderPage.jsx:372-403`)
> 중요: 실제 플로우에서는 거의 도달하지 않는다. `create-order` 응답의 `data.order.access_token`이 있으면 `/order/status/{token}`으로 즉시 navigate하기 때문(line 191-194). 다이얼로그는 토큰이 없을 때의 fallback.
- [ ] borderRadius 16, mx 2
- [ ] 제목: "주문이 접수됐어요" — `fontWeight: 700`, 가운데, pt 4 pb 1
- [ ] 본문: "담당자를 통해 결제를 진행해 주세요. / 결제가 완료되면 카카오 알림톡으로 주문 내역을 보내드려요." (가운데, `text.secondary`, lineHeight 1.8, 사이 br)
- [ ] 액션: "닫기" contained large fullWidth → 카트 비움 + 폼 비움 + Step 0 복귀 (`handleCloseSuccessDialog`)

## 액션·기능 (누락 금지)

- [ ] 진입 시 데이터 페치(`useEffect`, line 73-124):
  1. `site_settings`에서 `*` 단일 행 조회(`free_shipping_threshold`, `shipping_cost`, `free_shipping_basis` 포함). 실패 시 기본값(30000/3000, basis=정가) 유지. `free_shipping_basis` 컬럼 미적용 시 응답에서 빠져 정가 폴백(graceful).
  2. `eventSlug` 없으면 `accessError='no_slug'` 설정 후 종료.
  3. `events` 테이블에서 `order_url_slug = eventSlug` 단일 행 조회. 없으면 `not_found`.
  4. 오늘 날짜(KST `getTodayKST`)가 `start_date~end_date` 밖이면 `expired`.
  5. 통과 시 `eventInfo` 저장 (`id`, `name`, `discount_rate`, `tags`, `host_society`, `start_date`, `end_date`, `estimated_delivery_date`). `host_society`는 primary·fallback select 양쪽에 포함(컬럼 미적용 환경 일관성).

- [ ] 접근 차단 화면(`accessError` 있을 때, line 224-256):
  - 3가지 케이스 메시지 매핑:
    - `no_slug`: 링크 이모지 + "링크를 확인해 주세요" — "학회 전용 링크로만 주문할 수 있어요. 담당자에게 올바른 링크를 받아 다시 접속해 주세요."
    - `expired`: 달력 이모지 + "주문이 가능한 날짜가 아니예요." — "주문 내역은 받아보신 알림톡에서 확인할 수 있어요." (`showLookup: true`로 코드에 표시돼 있으나 실제 lookup 버튼은 미렌더 — **확인 필요**)
    - `not_found`: 물음표 이모지 + "찾을 수 없는 링크예요" — `no_slug`와 동일 안내
  - 화면 구성: 큰 이모지(4rem) + 제목(`h6`, `fontWeight: 800`) + 본문(`body2`, `text.secondary`, whiteSpace pre-line, lineHeight 1.8)
  - 가운데 정렬, height `100dvh`, p 4

- [ ] 트리플탭으로 현장구매 모드 토글(`OrderPage.jsx:276-287`):
  - 600ms 윈도우 안에 3회 탭 시 `isOnsitePurchase` 반전
  - `activeStep === 2`일 때는 트리거 차단(확인 단계에서 모드 바뀌면 비용 재계산 혼란)
  - 상단 Snackbar로 모드 변경 안내

- [ ] 상품 담기/수량 조정 (`ProductSelectionStep.jsx:104-132`):
  - 카드 영역 클릭 시 `onAdd` (이미 카트에 있으면 차단)
  - 수량 -1이 1 미만으로 가면 카트에서 제거
  - 중복 추가 시도 시 `addNotification('이미 추가된 상품입니다.', 'info')` — `useNotification` 훅

- [ ] 우편번호 검색(`CustomerInfoStep.jsx:50-66`):
  - `react-daum-postcode`의 `DaumPostcode` 컴포넌트를 모달 안에 60vh 높이로 렌더
  - 도로명일 때 `bname` + `buildingName` 괄호 접미사 자동 조합
  - 완료 시 모달 닫고 `postcode`/`address` 필드 채움

- [ ] 단계 이동:
  - "다음": `handleNext` — 현재 단계 검증 후 `activeStep + 1`, `window.scrollTo(0, 0)`
  - "뒤로": `handleBack` — `Math.max(activeStep - 1, 0)`, scroll top
  - "수정"(Step 2의 카드 헤더): `handleGoToStep(0|1)` — 점프

- [ ] 주문 제출 (`handleSubmitOrder`, line 160-202):
  1. `eventInfo` 없으면 차단
  2. `setIsSubmitting(true)` 후 `supabase.functions.invoke('create-order', { body: {...} })` 호출
  3. body 페이로드:
     - `customer_name` ← `customerInfo.name`
     - `phone_number` ← `customerInfo.phone`
     - `shipping_address` — 객체 `{ postcode, address, detail }` (DB 표시에서는 `detailAddress`/`detail` 둘 다 fallback 처리됨 — A3 시트 참조 — **확인 필요**)
     - `inpsyt_id` ← `customerInfo.inpsytId`
     - `is_on_site_sale` ← `isOnsitePurchase` (2026-07-06 추가 — 현장구매 여부를 서버로 명시 전송)
     - `customer_request` — `isOnsitePurchase`면 `[현장구매] {원본}`으로 prefix (기존 데이터 식별·운영자 가독성 위해 유지)
     - `cart` — `[{ product_id, quantity }]` 배열
     - `event_id`
  4. 응답 토큰(`data.order.access_token`)이 있으면 `/order/status/{token}`으로 navigate
  5. 토큰 없으면 `showSuccessDialog` 열기(fallback)
  6. 실패 시 에러 알림 표시
  7. `is_on_site_sale` 컬럼 — **해소됨(2026-07-06).** create-order 페이로드에 `is_on_site_sale: isOnsitePurchase` 전송(위 3번 목록). 서버(create-order)가 이 값을 INSERT하고 현장구매 시 배송비를 부과하지 않음. `customer_request`의 `[현장구매]` 접두사는 기존 데이터 식별·운영자 가독성을 위해 병행 유지.

- [ ] 서버측 금액 재계산 (`supabase/functions/create-order/index.ts:57-84`):
  - 클라이언트가 보낸 금액은 신뢰하지 않음. 서버가 `products`·`events`·`site_settings`를 다시 조회해 재계산.
  - `is_discountable=true`인 상품만 `discount_rate` 적용 (반올림 `Math.round`)
  - 무료배송 판정: `free_shipping_basis`(정가/할인가, 기본 정가) 기준 합계가 `free_shipping_threshold` 이상이면 배송비 0 (병렬 백엔드가 클라와 동일 규칙으로 통일, 2026-08-25)
  - DB INSERT 컬럼: `total_cost` / `discount_amount` / `delivery_fee` / `final_payment` + `status_history` 배열 시작값

- [ ] 알림톡 발송:
  - `status='pending'`으로 생성 → 운영자가 어드민에서 `paid`로 변경하면 트리거(`20250722070342_create_paid_order_trigger.sql`) 발화 — 정상 알림톡 발송 경로
  - 이 화면 안에서는 알림톡을 직접 부르지 않음

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `customer_name` — `name` 단일 필드 (성+이름 분리 안 함)
- [ ] `customer_phone` — `phone` 단일 필드. 클라이언트에서 010-XXXX-XXXX 포맷팅 적용
- [ ] `inpsyt_id` — 조건부 단일 필드. **카트에 온라인코드 상품이 있을 때만 노출**. 소프트 필수(공란 제출 시 확인 다이얼로그만, 하드블록 아님). 온라인코드 탐지 = `utils/onlineCode.js` — 3상태(true=포함 / false=미포함, 문자열 폴백 차단 / null·undefined=상품명 "온라인" 폴백)
- [ ] **배송지 — 세 필드 분리 (절대 한 줄로 통합 금지):**
  - `address` (도로명, readOnly, 모달로만 채움)
  - `detailAddress` (자유 입력)
  - `postcode` (readOnly, 모달로만 채움)
- [ ] `request` — `customer_request`로 매핑되는 단일 multiline 필드 (rows 3)
- [ ] 현장구매(`isOnsitePurchase=true`)일 때 배송지 섹션 자체가 숨겨짐 — 시안에서도 이 분기 처리 반드시 반영

## 데이터 모델

### `orders` 테이블 (`20250722070000_create_orders_table.sql` + 후속 마이그레이션)
- `id` (bigint, sequence)
- `created_at` (timestamptz default now)
- `customer_name` (text)
- `customer_email` — 2026-04-08 `20260408_drop_email_column.sql`로 제거됨
- `phone_number` (text) — `20250805_add_new_order_fields.sql`엔 `contact`로 추가됐으나 현 코드는 `phone_number` 컬럼 참조. **컬럼명 변경/리네임 마이그레이션 파일 미확인 — 확인 필요**
- `shipping_address` (jsonb) — `{ postcode, address, detail|detailAddress, ... }` 객체
- `inpsyt_id` (text, nullable) — 추가 마이그레이션 파일 미확인 — 확인 필요
- `customer_request` (text, nullable) — 추가 마이그레이션 파일 미확인 — 확인 필요
- `total_cost` (numeric) — `20250805`의 `total_amount`와 컬럼명 차이. 현 코드는 `total_cost` 사용 — 확인 필요
- `discount_amount` (numeric)
- `delivery_fee` (numeric) — `20250805`의 `shipping_cost`와 컬럼명 차이 — 확인 필요
- `final_payment` (numeric)
- `is_on_site_sale` (boolean, default false) — create-order가 클라이언트 `is_on_site_sale` 페이로드를 받아 INSERT (2026-07-06 해소). true면 배송비 미부과.
- `status` (text) — `pending`/`paid`/`completed`/`cancelled`/`refunded` (생성 시점엔 컬럼 default 또는 status_history만 박힘)
- `status_history` (jsonb, default 빈 배열) — `20260406_add_status_history_to_orders.sql`. INSERT 시 첫 항목 명시.
- `access_token` (uuid, default `gen_random_uuid()`) — `20260406_add_access_token_to_orders.sql`. 결제 완료 후 `/order/status/{token}` URL 키
- `event_id` (bigint, FK → events)

### `order_items` 테이블 (`20260415_002_add_order_item_snapshots.sql`)
- `order_id`, `product_id`, `quantity`, `price_at_purchase`
- 스냅샷 컬럼(주문 시점 박제): `product_name`, `product_code`, `category`, `list_price`

### `events` 테이블 (조회만)
- `id`, `name`, `discount_rate`, `tags` (jsonb 배열), `host_society`, `start_date`, `end_date`, `order_url_slug`, `estimated_delivery_date`
- `host_society` (text) — 주최 학회명. `products.tags` 문자열과 정확 일치하도록 운영 중이라, 이 값으로 학회 관련 상품을 진열 상단 정렬(§상품 그리드 정렬 규칙). anon `GRANT SELECT (host_society)` 적용 완료(화이트리스트 12).
- `visible_categories` (text[], nullable — `20260624000000_DRAFT`): 행사 주문서 노출 대분류 화이트리스트. NULL/빈 배열=전체 노출. 값 있으면 원본 `products.category` ∈ 이 배열인 상품만. anon 공개 컬럼(GRANT 화이트리스트 포함). **graceful**: 컬럼/GRANT 미적용 시 OrderPage가 레거시 select fallback → 전체 노출.

### `products` 테이블 (조회만)
- `id`, `name`, `product_code`, `category`, `list_price`, `is_discountable`, `is_popular`, `is_new`, `tags`
- `sub_category` (text, nullable) — **소분류**. (P1) 단일 대분류 행사에서 카테고리 칩을 이 값으로 그림(마스터 `subcategories` 연동). 노출·탐색 전용.
- ~~`badges` (text[])~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. 컬럼 DB drop 예정, 코드 참조 0.
- ~~`parent_code`·`option_type` (③ `20260616000000`)~~ — **(2026-07-01 폐기·미구현)** `parent_code` 자동추출 방식은 실데이터에서 검사군을 잘못 묶어 폐기(PRD_검사위계.md 대안검토). 아래 신규 컬럼으로 대체.
- `test_group_id` (bigint, nullable FK → `test_groups.id` — 검사 위계): 소속 검사군. 시드(`상품매핑.xlsx`)로 적재. **약어는 검사군 유일키가 아님**(SCID-5 등 1약어→N검사명) → `test_groups`는 surrogate PK, 적재는 (약어+검사명) 단위.
- `option_name`(형태 옵션명)·`option_label`(말머리)·`is_common`(공용 bool)·`sort_order`·`is_active`(노출 bool, 기본 true) — 검사 위계 신규 가법 컬럼. 표시명은 **DB 컬럼값**(클라 파싱 아님).
- **graceful**: `test_group_id`가 없으면(미적용/미분류) 전부 평면 진열 → 기존 동작 보존.

### `site_settings` 테이블 (단일 행)
- `free_shipping_threshold` (default 30000)
- `shipping_cost` (default 3000)
- `free_shipping_basis` (text, `'list_price' | 'discounted'`, NULL=정가 폴백; 2026-08-25 추가 — 무료배송 판정 기준 정가/할인가 택일)

## 권한별 차이

이 페이지는 **공개 화면**(고객용). 인증 없이 접근 가능. 단, 학회 슬러그가 유효해야 한다 — 슬러그 없거나 만료·존재하지 않으면 접근 차단(위 진입 흐름 참조). 로그인 사용자 컨텍스트(`master`/`editor`/`viewer`)는 본 페이지와 무관.

## 필터·뷰 모드 (Step 0 상품 그리드)

- [ ] 뷰 모드 칩: `all`/`popular`/`new` (기본 `popular`)
- [ ] 카테고리 칩: `all` + 동적 카테고리 목록 (기본 `all`)
- [ ] 학회 태그: **정렬 우선순위로만 작동**(필터 아님). `eventTags` = `eventInfo.tags` ∪ `eventInfo.host_society`. 매칭 상품/검사군을 최상단, 나머지는 아래(숨김 없음). 2026-08-18 필터→정렬 전환.
- [ ] 검색: 상품명 부분 일치(`matchesSearch` 유틸 — 띄어쓰기로 여러 키워드 AND)

## 빈 상태·로딩·오류 처리

- [ ] 페이지 로딩(이벤트 조회 중): `CircularProgress`만 가운데 (`OrderPage.jsx:216-222`)
- [ ] 접근 차단(슬러그 없음/만료/존재 X): 위 표시 정보의 메시지 화면
- [ ] 상품 목록 로딩: `CircularProgress` size 32 가운데, py 8
- [ ] 상품 검색 결과 없음: "검색 결과가 없습니다" + "다른 검색어를 시도해보세요"
- [ ] 카트 비어 있음: CartBottomSheet 본문에 "장바구니가 비어있습니다"
- [ ] 단계 전환 실패: `Alert severity="error"` (상단, dismissable)
- [ ] 주문 제출 실패: 동일한 `Alert`에 메시지 노출, 폼·카트 유지

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **상단 헤더는 트리플탭 영역이다.** 일반 모드/현장구매 모드 두 상태가 있고 색이 바뀐다 (`primary.main` ↔ `warning.main`). 시안이 한 상태만 그리면 현장구매 모드의 시각 안내가 사라진다. 두 상태 다 시안에 둔다.
2. **Step 0에서는 스텝 인디케이터를 표시하지 않는다.** 의도된 디자인 — 첫 진입에서 사용자가 "단계가 있는 줄도 모르고" 상품만 고르게 한다. 시안에서 모든 단계에 인디케이터를 일률 표시하면 의도가 깨진다.
3. **배송지는 세 필드 분리 입력. A3 출고 시트와 1:1 매칭.** 도로명/상세/우편번호. Daum 주소 검색 모달이 도로명·우편번호를 채우고, 상세주소만 직접 입력. 시안에서 한 줄 통합 입력으로 그리면 출고 운영자가 필드 단위 복사를 못 한다.
4. **현장구매 모드에서는 배송지 섹션 자체가 숨겨진다.** 분기 처리. 시안에 두 분기를 모두 그리거나, 적어도 둘 다 명시한다.
5. **`hasOnlineCode`일 때만 인싸이트 ID 필드가 뜬다.** 카트에 온라인코드 상품(카테고리 또는 이름 매칭)이 있을 때 조건부 노출. 시안에서 항상 보이거나 항상 숨기면 안 된다.
6. **`OrderReviewStep`의 "배송지" InfoRow는 표시용 통합이지만, 입력·DB는 분리.** 이 자리에서만 한 줄로 join해서 보여줘도 된다. 단, A3 출고 화면(운영자용)의 표시까지 한 줄로 따라가면 안 된다 — 거기는 분리.
7. **에러 메시지 "성함, 연락처, 이메일"의 "이메일"은 잔재 문구.** `email` 컬럼은 2026-04-08에 제거됐다(`20260408_drop_email_column.sql`). 코드가 이 메시지에서 "이메일" 단어를 아직 들고 있다. 시안·구현 모두 "성함, 연락처"로 정리해야 정합성이 맞는다.
8. **~~현장구매 정보는 현재 `customer_request`의 `[현장구매]` prefix로만 기록된다.~~ 해소됨(2026-07-06).** create-order 페이로드에 `is_on_site_sale`을 전송하고 서버가 INSERT·배송비 미부과 처리한다. `[현장구매]` prefix는 기존 데이터 식별·운영자 가독성을 위해 병행 유지. C3(OrderStatusPage) 상태 문구도 `is_on_site_sale`로 직접 분기(현장수령 담백형 문구).
9. **CTA 라운드 14, 일반 카드 라운드 16 등 인라인 px이 다수.** M1 토큰(`radius-button`=8, `radius-md`=10)으로 흡수 대상.
10. **`fontSize: '0.8125rem'`(13px), `0.6875rem`(11px) 같은 인라인 값이 카드·칩에 다수.** 02 §타이포 §사용 규칙 약속 2 흡수 표를 그대로 적용.
11. **검사군 카드는 가격을 완전히 은닉한다.** 검사명 + "옵션 N개"만. 대표가·**최저가 앵커도 표시하지 않는다**(건우님 확정 2026-07-02 — A/B 비교 불필요, 옵션별 차이 오해·노안 숫자부담 제거). 가격은 펼친 옵션 행에서만 노출. 시안이 검사군 카드에 어떤 가격도 그리면 안 된다. **(2026-07-02 번복) 옵션 1개 검사군도 예외 없이 동일** — 카드에 가격 없음, "옵션 1개" + 화살표로 펼쳐 옵션 행에서 가격 노출(옵션 수에 따라 UX가 갈리면 혼란, 일관 펼침).
12. **말머리는 `[대괄호]`가 아니라 소프트 회색 틴트 라벨이다.** `option_label`을 `gray[100]` 배경 + `caption`/600 인라인 라벨로 표시(별색 아님 — 기존 소프트 틴트 배지 패턴 재사용). `is_common=true`면 "공용". 괄호 수량은 풀어쓴다(`(20)`→`20개` — 시드 단계에서 `option_name`에 반영, 클라 변환 아님). 형태명(`option_name`)이 본문 위계, 말머리가 보조. 시안이 대괄호·별색·괄호수량 원본을 그대로 쓰면 안 된다.
13. **표시명은 DB 컬럼값이다(클라 파싱 폐기).** 검사명·약어 = `test_groups.name`/`.abbr`, 옵션 = `products.option_label`·`option_name`. `parent_code` + 클라 `parseProductName` 방식은 2026-07-01 폐기. FE는 컬럼값을 그대로 렌더(마지막 `_` 파싱 로직 없음). 진열 옵션 = `is_active=true`인 것만(숨김 옵션 고객 미노출), 정렬 = `sort_order`→이름.
14. **검사군 진열은 graceful이어야 한다.** `test_group_id`가 없는 환경(마이그레이션 미적용)·미분류 상품은 전부 평면(기존 그리드)으로 떨어진다. 미적용이어도 화면이 깨지면 안 됨. 검색은 **검사군 단위**로, **대상은 상품명 원본(`name`) 단일**(2026-07-02 — 기존 검사명·약어·`option_name`·`option_label` 4필드 매칭 폐지. 원본 상품명에 검사명·약어·말머리·옵션이 모두 포함되므로 name 하나로 정확도 유지+단순화). 검사군의 옵션 중 `name` 매칭이 하나라도 있으면 그 검사군 노출, 옵션 낱개 쏟아냄 없음. **타이핑 렉 방지 = 입력 격리**(2026-07-02): 검색 input을 별도 `ProductSearchBar`로 분리(로컬 `useState`+내부 `useDebouncedValue` 250ms), debounce된 값만 상위에 전달 — 매 키입력(IME 조합)에 검사군 트리가 리렌더되지 않는다(조합 뭉텅이 입력 방지). controlled value를 상위 state로 두면 렉 재발. `TestGroupCard`는 `React.memo`(검색어 변경 시 비매칭 카드 재렌더 skip). **자동 펼침은 초기 상태로만** — 검색 매칭 검사군은 처음에 펼쳐지되, 사용자가 각 카드를 자유롭게 접고 펼 수 있다(검색 중에도). 검색어 변경 시 사용자 펼침 조작은 리셋된다. 같은 검사군 여러 옵션 담기는 `order_items`에 개별 product로 자연 저장(스냅샷 4필드 계약 불변).
15. **(P1) 단일 대분류 행사는 대분류 칩을 숨기고 소분류 칩으로 탐색.** 오티즘=도구 단일 → "도구" 상위 칩 숨김, 하위 소분류(인지/언어/상담) 칩 노출. 시안/구현이 도구 상위 칩을 그대로 노출하면 PRD 의도(소분류 탐색)가 깨진다. 저장 위치 확정(A5 확인 필요)과 연동되므로 1차는 사양만.
16. ~~카드당 배지 최대 2개·우선순위~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. 카드는 인기/신상품 boolean 칩만(카테고리 칩 + 인기 + NEW).
17. ~~미등록 배지명은 고객 화면 미표시~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거.

## 변경 이력
- 2026-07-02 **검색 타이핑 렉 해결 + 검색 대상 단순화 4→1 (`feature/product-hierarchy`, 실 코드 변경, 건우님 실동작 피드백)**. **①타이핑 렉(핵심)**: 신규 `ProductSearchBar.jsx`(로컬 `useState`+내부 `useDebouncedValue` 250ms, debounce된 값만 `onSearch(debounced)`로 상위 전달). `ProductSelectionStep`에서 `searchTerm` state·상위 `useDebouncedValue`·`TextField`/`InputAdornment`/`SearchIcon` import 제거 → `debouncedSearch`는 SearchBar가 세팅하는 순수 state. 기존엔 controlled `value`가 상위 state라 매 키입력(IME 조합)마다 `ProductSelectionStep`+검사군 트리(Card/Collapse 다수) 전체 리렌더 → 자모가 "가→가나다" 뭉텅이로 입력. 이제 input만 갱신·트리는 디바운스 후 1회. **②검색 대상 name 단일**: `filteredGroups` 검색 필터를 `options.some(p => matchesSearch(p.name, debouncedSearch))` 하나로 교체(4필드 폐지). 원본 상품명에 검사명·약어·말머리·옵션 전부 포함 → 정확도 유지. 검사군 단위 노출·자동 펼침·토글 자유 무변경. **③`TestGroupCard` `React.memo`**: 비매칭 카드 재렌더 skip. memo 유효화 위해 `onToggle`이 `(id, expanded)` 받도록 변경(부모가 인라인 화살표 → 안정 콜백 `toggleGroup` 직접 전달, 시그니처 `(groupId, currentExpanded)` 기존 일치). `TestGroupCard` 내부 `handleToggle = () => onToggle(id, expanded)`로 헤더 onClick/onKeyDown 연결. `onAdd`/`onIncrement`/`onDecrement`/`getCartQuantity`는 기존 `useCallback`(cart 의존)이라 검색어 변경엔 안정 → memo 효과 유효. **보존(무변경)**: `utils/testGroupDisplay.js`·테스트 10·그룹핑·`ProductCard`·cart/order_items(옵션=개별 product)·트리플탭·뷰모드/카테고리 칩·행사 필터·무한스크롤·할인/무료배송·자동펼침/접기 로직. **검증**: lint(변경 3파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build·vitest 113 passed·2 skipped. 상단 갱신·§검색바 절·핵심 발견 14 갱신.
- 2026-07-02 **검사 위계 진열 UX 4건 수정 (`feature/product-hierarchy`, 실 코드 변경, 건우님 실동작 피드백)**. **①검색 속도**: `hooks/useDebouncedValue.js`(신규, 250ms) — `searchTerm`(입력 즉시)/`debouncedSearch`(필터·검색 계산) 분리. `filteredGroups`·`filteredProducts`·페이지리셋 useMemo/useEffect 의존성을 `debouncedSearch`로 교체. 그룹핑(`testGroups`)은 `baseProducts` 기준 유지(검색어 비의존, 재그룹핑 없음). **②말머리 검색**: `filteredGroups` 옵션 매칭에 `matchesSearch(p.option_label, ...)` OR 추가. **③접기/펼치기 자유**: `expanded` 판정을 `expandedGroups[id]!==undefined ? 값 : searchMatchedGroupIds.has(id)`로 변경(자동펼침=초기값). `toggleGroup(id, currentExpanded)`가 현재 표시 상태 반대로 토글. `debouncedSearch` 변경 시 `setExpandedGroups({})` 리셋. **④옵션1개 UX 통일(시안 §(3) 번복)**: `TestGroupCard`의 `isSingle` 분기·바로담기 카드 return·`headBody` 가격 분기·`OptionPrice variant='single'` 제거 → 옵션 수 무관 접힘/펼침 2상태. **보존(무변경)**: `utils/testGroupDisplay.js`·테스트 10(그룹핑은 옵션 수 비의존)·`ProductCard`·cart/order_items·트리플탭·뷰모드/카테고리 칩·행사 필터·무한스크롤·할인/무료배송. **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build·vitest 113 passed·2 skipped. 검색 필터 실측 1.58ms/회(1134상품×3필드) — 실병목은 카드 리렌더, debounce로 매키입력→멈춘 뒤 1회. 상단 갱신·§검사군 카드 절((1)(3)·상태 메모)·핵심 발견 11·14 갱신.
- 2026-07-02 **검사 위계 2뎁스 진열 FE 구현 (`feature/product-hierarchy`, 실 코드 변경)**. **신규**: `TestGroupCard.jsx`(검사군 3상태 카드 — 접힘/펼침 인라인 아코디언/옵션1개 즉시담기; `BadgeBox`·스테퍼 패턴 재사용; 말머리=`gray[100]` 소프트 틴트 라벨·대괄호 없음; 옵션 세로 리스트 행 누적·열 분리 없음; `maxHeight 320` 스크롤; role=button·aria-expanded·Enter/Space 토글), `utils/testGroupDisplay.js`(그룹핑·정렬 순수 로직 — `test_group_id` 클라 useMemo 그룹핑, `sort_order` ASC NULL 폴백, 도구→검사 정규화), `utils/testGroupDisplay.test.js`(10 tests). **변경**: `ProductSelectionStep.jsx` — 검사군 리스트(풀폭 1열) ↔ 평면 그리드(도서·미분류) 분기 진열, `fetchTestGroups()` 병렬 로드, `is_active!==false` 노출 필터, 검색=검사군 단위(검사명·약어·`option_name` → 매칭 검사군 펼친 채 노출, 옵션 낱개 안 쏟음), 카테고리 필터 검사군 연동, 핸들러 useCallback화. `ProductCard.jsx` — `BadgeBox` export(TestGroupCard 재사용). **가격 은닉**(검사군 카드 가격 없음, 옵션1개만 예외). **graceful**: `test_group_id`/마스터 미적용 시 전부 평면(기존 그리드) — 회귀 0. **order_items 불변**: 옵션=개별 product, cart `{...product, quantity}`, create-order 무변경. **보존**: 트리플탭·뷰모드/카테고리 칩·행사 태그/판매대분류 필터·무한스크롤(평면)·무료배송/할인·`ProductCard` 이미지 슬롯·인기/NEW 칩 전부 무변경. **검증**: lint(대상 4파일 신규 위반 0)·vite build·vitest 113 passed(신규 10)·2 skipped. `theme.js` 무수정. 핵심 발견 11~14·§검사군 카드 절·참조 파일 갱신.
- 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품 칩은 유지 (실 코드 변경, 건우님 결정)**. `ProductCard.jsx` — 동적 배지 렌더(`product.badges` map)·`badgeMetaByName` prop·`MAX_EMPHASIS_BADGES` 상한·priority 정렬 로직 제거. `visibleBadges`는 인기(`is_popular`)·신규(`is_new`) boolean만(시각 순서 인기→NEW). `ProductSelectionStep.jsx` — `fetchBadges` import·`badgeMaster` state·badge fetch useEffect·`badgeMetaByName` memo·ProductCard에 넘기던 `badgeMetaByName` prop 제거(`MASTER_COLOR_FALLBACK` import도 미사용으로 제거). `products.badges` 코드 참조 0(drop 후 에러 0). 카테고리 칩·`hideCategoryBadge`·이미지 슬롯·할인 표시·수량 스테퍼 전부 무변경. **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. theme.js 무수정. §상품 카드 배지 영역·핵심 발견 16·17 갱신.
- 2026-06-29 **상품 카드 이미지 플레이스홀더 폐기 (실 코드 변경, 건우님 결정)**. `ProductCard.jsx` `ProductImageSlot` — `getProductImageUrl(image_filename)`이 null이거나 `onError`면 `return null`(슬롯 미렌더). 기존 카테고리 색 틴트 박스 + `ImageIcon`(28px) 플레이스홀더 코드·`isTest`/`tint` 분기 제거, `ImageIcon` import 삭제. 슬롯 없을 때 배지 영역이 CardContent flex column 첫 요소로 자연 상단 배치(레이아웃 안 깨짐, 빈 박스 0). **이미지 있는 상품은 1:1 슬롯 정상(회귀 0).** 이유: 행사 단위 이미지 유무 분리(혼재 없음)·도서/검사 상품명 직관성 우선. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어), theme.js 무수정, AI 시그니처 없음.** A6 `ProductThumb`도 동형(미등록 셀 비움). **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. §상품 카드 절·핵심 발견 17 갱신.
- 2026-06-25 행사별 판매 대분류 필터 **구현**(`feature/product-hierarchy`) — **실 코드 변경**: (1) `OrderPage.jsx` events select에 `visible_categories` 추가 + 컬럼/GRANT 미적용 graceful fallback(레거시 select 재조회), `ProductSelectionStep`에 `visibleCategories` prop 전달. (2) `ProductSelectionStep.jsx` `baseProducts` 필터 — **원본 category** 기준(도구→검사 정규화 전), NULL/빈 배열=전체 노출(기존 동작 보존), eventTags와 AND 공존. 단일 대분류 행사(`length===1`)는 대분류 칩 숨기고 `sub_category` 칩(localeCompare 정렬·미지정 "기타"·2종 미만 시 칩 줄 숨김), 카테고리 필터도 sub_category 기준. (3) 데이터 모델 `events.visible_categories` 추가. **보존(무변경)**: 도구→검사 정규화(칩 표시·다중/NULL/빈 행사 fallback), eventTags 필터, 뷰모드/검색/정렬/페이지네이션, ProductCard 동작. **검증**: lint(변경 4파일 0 이슈, 기존 send-alimtalk 9에러는 무관)·build 통과. 라이브 검증은 마이그레이션 적용 후.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **카테고리 칩**: 단일 대분류 행사("도구"만)는 대분류 칩 숨기고 **소분류 칩(`sub_category`, 마스터 `subcategories` 정렬)** 노출 규칙 추가. 저장 위치(A5 판매 대분류 "확인 필요")와 연동. (2) **ProductCard 배지**: 동적 배지(`products.badges`) 소프트 틴트 노출 + **가드레일(카드당 최대 2개·우선순위)** 추가. 미등록은 고객 화면 미표시. (3) 데이터 모델에 `products.sub_category`·`badges` 추가. (4) 핵심 발견 15~17 신설. **보존**: 도구→검사 정규화는 다중 대분류 행사 fallback으로 잔존(단일 대분류 행사에서만 소분류 칩 우선), 소프트 틴트 배지 패턴·radii.sm 칩·검사군 진열 전부 무변경.
- 2026-06-16 ③ 상품 계층화 — 검사 2뎁스 진열 (`feature/product-hierarchy` 브랜치, main 격리) — **신규**: `utils/productGroup.js`(그룹핑·파싱·할인가), `TestGroupCard.jsx`(검사군 3상태 카드), `ProductSelectionStep.jsx` 계층 진열(검사 리스트 ↔ 도서 그리드 분기·미니헤더·검사군 단위 검색·펼침 상태). **데이터**: `products.parent_code`/`option_type` 가법 컬럼(`20260616000000`). **graceful**: parent_code 미적용 시 전부 평면(기존 동작). **보존(무변경)**: cart·order_items 4필드 스냅샷·CartBottomSheet 풀네임·트리플탭·hasOnlineCode 조건부 인싸이트ID·주소 3필드·무료배송/할인 로직·검색 멀티키워드·도구→검사 정규화·`ProductCard` 도서 그리드 동작·뷰모드/카테고리 칩. **검증**: lint(신규 3파일 0)·build·vitest(105 passed, 신규 11). 라이브 검증은 마이그레이션 적용 후.
- 2026-06-01 주문 흐름 UX 5건 (건우님) — (1) 단계 인디케이터 **Step0 포함 전 단계 표시**(OrderStepIndicator는 이미 3단계, OrderPage가 막던 것 해제). (2) **헤더 전부 중앙정렬**(Step1 CustomerInfoStep·Step2 OrderReviewStep도 `textAlign:center`). (3) **우편번호 칸 히든**(데이터·출고정보 보존). (4) **배송 모드 배송지(도로명+상세) 필수** — `isCustomerInfoValid`에 추가, 미입력 시 '다음'/제출 차단·필드 `required` 표시. 현장구매는 성함·연락처만. (5) **0→1 전환 시 장바구니 확인 바텀시트**(토스트 폐기·건우님) — CTA가 step1로 직행하지 않고 `CartBottomSheet`를 열어 카트 요약 + 무료배송 업셀. 배송비 부과 시: `총 N건 구매 · X원 더 구매하시면 무료배송이에요` + `[그래도 주문하기]`(회색 outlined) `[상품 추가하기]`(파랑 contained = 유도 행동). 무료배송/현장구매: `총 N건 구매` + `[주문하기]`(파랑) `[상품 추가하기]`(회색). 주문하기/그래도주문하기→step1(onProceed), 상품 추가하기→시트 닫고 step0. 파일: OrderPage·CustomerInfoStep·OrderReviewStep·CartBottomSheet.
- 2026-06-01 상품 카드/하단바 목업 정합 (건우님 좌우 비교 지시) — (1) **배지 솔리드 칩 → 소프트 틴트 박스**(alpha 0.12~0.14), 인기 배지 "★" 단독 → **StarIcon+"인기"**. (2) **"담기" 버튼 파랑(primary) → 회색**(테마 기본 outlined). (3) ~~하단바 배경 풀폭~~ **철회·복구**(건우님 지시) — 하단바는 **부모 콘텐츠 컬럼(600px)에 맞춰 정렬**. 뷰포트 풀폭으로 채운 건 오판, 즉시 복구. (4) **`도구` 카테고리 → `검사`로 정규화**(별도 칩 X, 검사 필터에 포함, 카드 배지도 검사). 파일: `ProductCard.jsx`·`ProductSelectionStep.jsx`·`FloatingBottomBar.jsx`.
- 2026-06-01 고객 주문 화면 보강 (건우님 지시) — (1) **검색바** 회색 채움 `#F2F4F6` → **흰색 기본 아웃라인**(/preview 목업 정합, 플레이스홀더 멀티키워드 힌트 유지). (2) **뷰/카테고리 칩** 알약형 → `radii.sm`(8px) 둥근 사각. (3) **Step 1 헤더** `isOnsitePurchase` 분기 — 배송 "배송 받으실 주소를 입력해주세요" / 현장 "주문자 정보를 입력해주세요" 유지. (4) **Step 1·2 부제** → "{이벤트명} · N% 할인 적용"(Step 0 패턴 통일, 양쪽 모드). (5) **CTA Step 0** "주문서 작성하기" → 배송 "배송지 입력하기" / 현장 기존 유지. (6) **제출 후 OrderStatusPage 연락처** `mono`(monospace) 제거 → 일반 폰트. **보존**: 주소 3필드 분리·현장구매 배송지 숨김·할인/무료배송 로직·검색 멀티키워드 전부 무변경. **현장구매 모드 문구는 전부 기존 보존**(배송 문구 강제 주입 안 함).
- 2026-05-13 신설 — M2 시안 착수 사전 정독. `OrderPage.jsx` 외 6개 자식·보조 컴포넌트 + DB 마이그레이션 + create-order edge function 전수. 환각 방지 위해 컬럼명 불일치·문구 잔재·`is_on_site_sale` 미사용 등 의심 8건은 "확인 필요"로 표기.
- 2026-05-29 M3-10 시안 정합 — `OrderPage.jsx` + 자식 7종(`OrderStepIndicator`/`FloatingBottomBar`/`ProductCard`/`ProductSelectionStep`/`CustomerInfoStep`/`OrderReviewStep`/`CostSummary`) 토큰화. **보존**: 트리플탭 600ms 3회·Step 0 인디케이터 숨김·주소 3필드 분리(DaumPostcode 모달)·`hasOnlineCode` 조건부 인싸이트 ID·현장구매 배송지 섹션 숨김·API/Supabase/Edge Function/알림톡 트리거·`CartBottomSheet` 변경 0·성공 다이얼로그 fallback·접근 차단 화면. **교체**: 인라인 raw hex 0건(theme 토큰 경유), 인라인 `fontSize`/`borderRadius` 흡수(글로벌 MuiCard·MuiButton·MuiTextField·MuiChip 토큰 위임), `bgcolor: '#F8F9FA'` → `theme.gray[50]`, `'#F2F4F6'` → `theme.gray[100]`, `'rgba(43,57,143,...)'` → `alpha(primary.main, ...)`, 사양 §발견 7 잔재 문구 정리 — `OrderPage:139`의 "성함, 연락처, 이메일" → "성함, 연락처", 배송 예정일 안내의 트럭 이모지 → `ShippingIcon` 컴포넌트. **신규 없음**(시안 답습 0건). **사양 §발견 1~7 모두 보존 확인.**
