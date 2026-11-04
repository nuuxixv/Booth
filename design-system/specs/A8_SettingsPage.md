# 사양 시트 — A8 설정 (SettingsPage)

> 이 시트는 설정 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-11-04 **"이벤트 결제수단" 섹션 신설 구현**(frontend-engineer, 단일 진실 소스 `A13_VoucherEvent.md` §①). `SettingsPage.jsx`에 SectionCard "이벤트 결제수단"(배송비 정책 블록 아래) 추가 — 용어(1~10자)·숫자 버튼(칩+입력, 1~99 정수·중복 불가·최소 1)·단위 버튼(라벨 1~4자+금액 양의 정수 행, 최소 1)·결제완료 창 미리보기. 저장은 기존 "저장하기" 버튼에 합류(`site_settings.voucher_config` jsonb, `normalizeVoucherConfig`로 정리 후 저장). 컬럼 미적용 환경 PGRST204 graceful — 오류 메시지가 가리키는 키(`voucher_config`·`free_shipping_basis`)만 빼고 재시도(while 루프로 확장). 로드 시 `normalizeVoucherConfig(data.voucher_config)`로 초기화(NULL·미적용이면 기본값). 검증 실패 시 저장 버튼 비활성+필드 하단 오류 문구. 장식용 색 인디케이터·그라데이션 없음(CLAUDE.md E). 검증: vitest 471 passed·lint 신규 0·build 성공.
> 이전 갱신: 2026-06-29 **동적 배지 기능 폐기 — 소분류는 유지**(건우님 결정). 본 화면 안내 Alert를 "소분류는 상품 관리 화면에서 관리합니다"로 수정(배지 문구 제거). 소분류 마스터 단일 진실 소스 UI는 A6.
> 이전 갱신: 2026-06-29 **소분류·배지 마스터 CRUD를 상품 관리(A6)로 이동 — 본 화면에서 블록 4·5 제거**(건우님 확정 #1). SettingsPage에는 안내 Alert 1줄만 잔존. 마스터 단일 진실 소스 UI는 이제 A6.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/SettingsPage.jsx` (425줄, 현행 — PageHeader + SectionCard 3블록(리다이렉트 학회 · 배송비 정책 · 시스템 정보) + 안내 Alert + ActionSlot)
- 관련 API: `inpsyt-order-frontend/src/api/settings.js` (`getSettings`/`updateSettings`) — 단, 실제 페이지는 supabase 클라이언트로 직접 호출하므로 이 모듈을 거치지 않음
- 연계 화면: `inpsyt-order-frontend/src/components/GoRedirect.jsx` (`/go` 진입 시 `active_event_slug` 사용)
- 외부 라이브러리: `qrcode` (QR 생성)
- DB 스키마: `supabase/migrations/20260401000000_patch_rls_and_create_site_settings.sql` (`site_settings`)
- 이벤트 결제수단("이벤트 결제수단" 섹션): **`A13_VoucherEvent.md` §①**(단일 진실 소스). `site_settings.voucher_config`(jsonb) + 유틸 `src/utils/voucherConfig.js`(`normalizeVoucherConfig`·`DEFAULT_VOUCHER_CONFIG`).
- **(2026-06-29 이동) 소분류 마스터 CRUD는 A6 상품 관리 화면 소관** — 건우님 확정으로 SettingsPage→ProductManagementPage 헤더 액션부로 이동. 마스터 단일 진실 소스 UI·데이터 모델(`subcategories`)·다이얼로그·삭제 가드·색 프리셋은 이제 `A6_ProductManagementPage.md` 참조. 본 화면에는 안내 1줄만 잔존. API `src/api/masters.js`. **(2026-06-29) 동적 배지(`badges`)는 폐기** — 코드·UI 모두 제거.

## 사용자 시나리오
master 권한자가 학회 직전 한 번 들어와 (1) 이번 학회의 `/go` 단축 링크 대상 학회를 지정하고 (2) 배송비 정책을 점검한다. 인쇄물용 QR 코드는 학회 직전에 한 번 다운로드해 인싸이트 부스 안내물에 인쇄한다. 학회 중에는 거의 손대지 않는다. 변경 시 즉시 적용된다는 점이 명시되어 있다(하단 안내 Alert).

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 113-116)
- [ ] 아이콘: `SettingsIcon` (primary 색, 1.4rem)
- [ ] 타이틀: "설정" (h6, 700)

### 본문 컨테이너
- [ ] `Paper` p 4, radius 16 (인라인 — 시안에서는 radius 토큰으로 흡수)
- [ ] `Stack spacing={4}` 3블록 + 액션

### 블록 1 — 리다이렉트 학회 관리 (line 120-203)
- [ ] 섹션 제목: "리다이렉트 학회 관리" (h6, 700)
- [ ] 부제: "/go 경로로 접속 시 자동으로 이동할 학회를 설정합니다. QR 코드를 인쇄물에 활용할 수 있습니다."
- [ ] 필드: "활성 학회 선택" (`Select`)
  - 첫 옵션: "없음 (비활성)" (italic em 태그로 강조)
  - 그 외 옵션: `events` 테이블 조회 학회들 — 학회명(굵게) + 시작일 `yyyy.M.d` 캡션(null이면 "시작일 미정") 2줄. `MenuItem value`는 `order_url_slug` 유지(리다이렉트 식별값). 슬러그 캡션은 노출 불필요 판단으로 시작일로 교체(건우님 2026-07-13)
  - 옵션 정렬: `sortEventsForDropdown` — 오늘±7일 이내 시작 학회 최상단 고정, 그 다음 나머지. 각 그룹 내부 start_date 내림차순, null 맨 뒤 (`src/utils/eventSort.js`)
  - 렌더: `groupEventsForDropdown`으로 pinned/rest 분리, "선택 안 함 (비활성)" 아래 상단 고정 그룹과 내림차순 그룹 사이 `<Divider/>`로 구분(양쪽 그룹 모두 있을 때만)
- [ ] URL 안내 카드(grey.50 배경, radius 10, grey.200 보더):
  - 라벨: "리다이렉트 URL"
  - 값: `${VITE_APP_URL || window.location.origin}/go` (monospace, body1, fontWeight 500) — **2026-06-01 환경변수화 완료. `VITE_APP_URL` 우선, 미설정 시 현재 origin 기준. prod 빌드에서 `VITE_APP_URL=https://inpsytorder.vercel.app` 설정 시 기존 동작 유지.**
  - 버튼: "URL 복사" outlined + `CopyIcon` (클릭 시 클립보드 복사 + 토스트)
  - 버튼: "QR 다운로드" outlined + `DownloadIcon` (클릭 시 SVG QR 생성 다운로드)

### 블록 2 — 배송비 정책 (line 207-240)
- [ ] 섹션 제목: "배송비 정책" (h6, 700)
- [ ] 부제: "주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다."
- [ ] 필드: "무료 배송 기준 금액" (`TextField` type=number, 끝 어드먼트 "원")
  - helperText: "이 금액 이상 구매 시 배송비가 0원이 됩니다."
  - 기본값: 30000 (`SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD`, DB default 30000)
- [ ] 필드: "배송비" (`TextField` type=number, 끝 어드먼트 "원")
  - helperText: "기준 금액 미만 구매 시 부과되는 배송비입니다."
  - 기본값: 3000 (`SHIPPING_DEFAULTS.SHIPPING_COST`, DB default)
- [ ] 필드: "무료배송 적용 방식" (`RadioGroup`, 라벨 `FormLabel`, 2026-08-25 신설)
  - Divider로 위 금액 필드들과 구분
  - 옵션 1 `list_price`: "정가 기준 (기본)" — 캡션 "할인 전 금액이 {현재 임계치}원 이상이면 무료배송"
  - 옵션 2 `discounted`: "할인가 기준" — 캡션 "실제 결제 금액이 {현재 임계치}원 이상이면 무료배송"
  - 각 옵션 캡션은 `threshold` state를 실시간 반영(`{threshold.toLocaleString()}원`)
  - 하단 캡션: "변경 즉시 새 주문부터 적용됩니다. 기존 주문의 배송비는 바뀌지 않습니다."
  - 기본값·폴백: `list_price`(= 현행 정가 판정 동작)

### 블록 3 — 시스템 정보 (readonly)
- [ ] 섹션 제목: "시스템 정보" (`InfoIcon`)
- [ ] 부제: "현재 환경의 빌드 정보입니다."
- [ ] 행: "환경" — `import.meta.env.MODE` 기반 실값 뱃지(production=success, 그 외=warning). 가짜 정적값(버전·DB 리전)은 2026-06-01 제거됨.

### 블록 4 — 소분류 관리 → **A6 상품 관리로 이동 (2026-06-29 건우님 확정)**
> 소분류 마스터 CRUD 블록은 SettingsPage에서 **제거**되어 ProductManagementPage 헤더 액션부 "소분류 관리" 토글 패널로 옮겨졌다. 배지 관리 블록은 **폐기**(2026-06-29 동적 배지 기능 제거). 상세 사양(목록·다이얼로그·삭제 가드·색 프리셋·즉시 저장 흐름)은 `A6_ProductManagementPage.md` §소분류 마스터 관리 패널 참조.
- [ ] ~~SettingsPage에 안내 Alert 1줄 잔존~~ **삭제(2026-07-13 건우님 결정).** 소분류 안내 Alert("소분류는 상품 관리 화면(상단 '소분류 관리')에서 관리합니다.")는 제거됨 — 소분류 관리는 A6 상품 관리 화면에 있으며 별도 안내 불필요.

### 블록 6 — 액션 (현행)
- [ ] 우측 정렬, gap 2
- [ ] "취소" outlined (radius 10, px 3) — 클릭 시 `fetchSettings` 재호출 (입력값 폐기 + DB 값으로 복원)
- [ ] "저장하기" contained (radius 10, px 4, fontWeight 700) — 저장 중 `CircularProgress` 24

### 하단 안내 Alert (line 265-268)
- [ ] severity info, radius 12
- [ ] 본문: "설정 변경 사항은 즉시 적용됩니다. (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)"

## 액션·기능 (누락 금지)

- [ ] 진입 시 `fetchSettings` + `fetchEvents` 병렬 호출 (line 38-41)
  - `fetchSettings` — `site_settings`에서 `*` 단일 행 select. `free_shipping_threshold`/`shipping_cost`/`active_event_slug`/`free_shipping_basis` 4종 추출. `free_shipping_basis`는 컬럼 미적용 시 응답에서 빠지므로 `data.free_shipping_basis || 'list_price'` 폴백(graceful).
  - `fetchEvents` — `events`에서 `id, name, order_url_slug, start_date` select, `created_at` desc 조회 후 `sortEventsForDropdown` 재정렬
- [ ] 활성 학회 선택 → `settings.active_event_slug` state 변경 (저장 누르기 전까지는 DB 미반영)
- [ ] URL 복사 → `navigator.clipboard.writeText(REDIRECT_URL)` (`${VITE_APP_URL || origin}/go`) + 토스트 "URL이 클립보드에 복사되었습니다."
- [ ] QR 다운로드 (line 172-194):
  - `QRCode.toString(url, { type: 'svg', color: {dark:'#252525', light:'#FFFFFF'}, margin:1, width:300 })`
  - Blob 생성 → 임시 a 태그로 `qr-inpsytorder-go.svg` 다운로드
  - 성공 시 토스트, 실패 시 에러 토스트
- [ ] 배송비 필드 변경 → state만 업데이트 (저장 누르기 전까지 DB 미반영)
- [ ] 저장 (`handleSave`, line 80-101):
  - `site_settings` 테이블 update `WHERE id=1` (하드코딩, 코드 주석에 "ID 1 for now, or we can use a more robust way if needed")
  - 페이로드: `free_shipping_threshold`(parseInt), `shipping_cost`(parseInt), `active_event_slug`(빈 문자열은 null로 변환), `free_shipping_basis`(폴백 `list_price`), `updated_at`
  - `free_shipping_basis` 컬럼 미적용 환경 graceful — 저장 시 `PGRST204`면 해당 키 빼고 1회 재시도(ProductManagementPage 가법 컬럼 패턴 답습)
  - 성공 시 토스트, 실패 시 에러 토스트
- [ ] 취소 → `fetchSettings`로 DB 값 다시 가져와 폼 리셋

### (P1) 소분류 마스터 CRUD — **A6 상품 관리로 이동 (2026-06-29)**
> 소분류 마스터 CRUD 액션(fetch·추가·편집·삭제·즉시 저장·색 프리셋)은 본 화면에서 제거됨. 상세는 `A6_ProductManagementPage.md` 참조. 즉시 저장 흐름·삭제 가드·프리셋 규칙은 A6에서 동일하게 유지된다. **배지 마스터는 폐기**(2026-06-29 동적 배지 기능 제거).

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `active_event_slug` (단일 select — events 테이블의 slug 또는 빈 문자열)
- [ ] `free_shipping_threshold` (단일 number, 정수, 원 단위)
- [ ] `shipping_cost` (단일 number, 정수, 원 단위)
- [ ] `free_shipping_basis` (단일 radio, `'list_price' | 'discounted'`, 기본 `list_price`)
- [ ] **(P1) 소분류 추가/편집 다이얼로그 → A6로 이동.** 입력 폼 구조(소분류 4필드)는 A6 시트 참조. **배지 다이얼로그는 폐기**(2026-06-29).

## 권한별 차이

- master: 진입 / 변경 / 저장 가능. RLS도 master만 UPDATE 허용 (`Admins can update site_settings`).
- 일반 사용자(authenticated): SELECT 가능 (`Public can view site_settings`). 변경은 RLS에서 차단되므로 저장 시도 시 실패.
- 비로그인: SELECT 가능(공개 정책). 단, 페이지 자체는 인증된 어드민 라우트.
- 코드 측에 `hasPermission` 호출 없음 — 라우팅 가드 의존. 시안에서 비-master가 들어왔을 때 입력 필드를 disabled로 만들지 별도로 결정해야 함.

## 데이터 모델

### `site_settings` 테이블 (`20260401000000_patch_rls_and_create_site_settings.sql`)
- `id` (integer PK, default 1, **단일 행 강제**: `CHECK (id = 1)`)
- `free_shipping_threshold` (integer, NOT NULL, default 30000)
- `shipping_cost` (integer, NOT NULL, default 3000)
- `free_shipping_basis` (text, `'list_price' | 'discounted'`, NULL=미설정=정가 폴백; 2026-08-25 병렬 백엔드 추가. 무료배송 판정 기준을 정가/할인가 중 택일. 적용 범위: 일반 판정 4경로(create-order·CartBottomSheet·NewOrderModal·OrderSections) + 합배송 도메인(LinkPreviewDialog·ShippingPickModal, 서버 RPC link/reassign/delete — 2026-08-25 확장, 마이그레이션 `20260825000100`))
- `email_domains` (jsonb, NOT NULL, default `["naver.com", "gmail.com", "daum.net", "hanmail.net"]`)
- `updated_at` (timestamptz)

### `active_event_slug` 컬럼 — **마이그레이션 누락 (확인 필요)**
- SettingsPage.jsx와 GoRedirect.jsx 모두 `site_settings.active_event_slug`를 select/update하지만, `supabase/migrations/` 디렉터리에 해당 컬럼을 추가하는 SQL이 없다.
- 즉 운영 DB에는 컬럼이 추가돼 있지만 코드 베이스의 마이그레이션 이력으로는 추적되지 않는다.
- 신규 환경 부트스트랩(예: 로컬 supabase reset) 시 `active_event_slug` 컬럼이 없어 페이지 진입이 실패할 수 있다.

### `email_domains` 컬럼 — 본 페이지에서 사용 안 함
- DB에는 존재하지만 SettingsPage는 select하지 않는다. 다른 사용처가 있을 수 있음 — 본 시트 범위 밖.

> **(2026-06-29) 아래 `subcategories` 마스터 테이블은 A6 상품 관리 소관으로 이동.** 데이터 모델 정의는 `A6_ProductManagementPage.md` 참조(스키마 자체는 동일, UI 소관만 이동). **`badges` 테이블·`products.badges`는 폐기**(동적 배지 기능 제거, DB drop 예정).

### `subcategories` 테이블 (P1 신규 — DRAFT)
- `id` (PK)
- `name` (text) — 소분류명. `products.sub_category`와 **이름 자연키** 연결(FK 없음).
- `parent_category` (text) — 소속 대분류(검사/도서/도구 중 하나)
- `color` (text) — 색 토큰/hex. 고객 칩·어드민 표 색
- `sort` (integer) — 고객 화면 칩 노출 순서
- RLS: products 동형 정책 복제(완화 아님). 공개 카탈로그 자산이라 SELECT 공개, 변경은 admin.

### ~~`badges` 테이블~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. 테이블·`products.badges` 컬럼은 DB drop 예정. 코드 참조 0.

## 빈 상태·로딩·오류 처리

- [ ] 로딩(`loading=true`): 가운데 `CircularProgress` py 8 (line 103-109)
- [ ] 학회 없음: Select 옵션이 "없음 (비활성)" 하나만 표시됨 — 별도 빈 상태 메시지 없음
- [ ] 저장 중(`saving=true`): 저장 버튼이 `CircularProgress` 24로 교체, 취소 버튼 비활성
- [ ] 설정 조회 실패: 토스트 "설정 정보를 불러오는 데 실패했습니다."
- [ ] 학회 조회 실패: console.error만, UI에 표시 안 함 (line 51)
- [ ] 저장 실패: 토스트 "설정 저장 실패: {error.message}"
- [ ] QR 생성 실패: 토스트 "QR 코드 생성에 실패했습니다."

## 핵심 발견 (시안 검수 시 반드시 확인)

1. `site_settings.active_event_slug` 컬럼의 CREATE/ALTER 마이그레이션이 리포지토리에 없다. SettingsPage·GoRedirect 두 곳에서 이 컬럼을 사용하지만 마이그레이션 이력은 없다. 운영 DB에는 수동 추가됐을 것으로 추정. 신규 환경 부트스트랩이 깨지는 잠재 부채 — A7 사양 시트의 `user_profiles` 누락과 같은 카테고리.
2. ~~리다이렉트 URL이 prod URL로 하드코딩되어 있다.~~ **2026-06-01 해소.** `VITE_APP_URL` 환경변수 우선, 미설정 시 `window.location.origin` 기준으로 변경. prod 빌드에서 `VITE_APP_URL`을 설정해야 기존 prod URL이 유지된다(미설정 시 배포 도메인 origin 사용 — vercel 기본 도메인과 동일하므로 사실상 동작 동일). QR 코드도 동일 베이스로 생성.
3. 사이드바·라우트 가드 외에 페이지 자체에 권한 체크가 없다. 비-master가 어떻게든 페이지에 들어오면 저장 버튼을 누를 수 있고, RLS가 막을 뿐 UI는 "저장 가능한 것처럼" 보인다. 시안에서 비-master 분기를 그릴지(필드 disabled), 라우팅에서 완전 차단할지 결정 필요.
4. `email_domains` 컬럼은 DB에 정의됐지만 본 페이지에서 노출하지 않는다. 다른 사용처(고객 폼 이메일 도메인 화이트리스트 추정)가 있는지 확인 필요. 시안에서 이를 추가 노출할지 미노출할지 결정 항목.
5. 저장 직후 신규 주문에는 적용되지만 기존 주문에는 영향 없다는 안내 Alert가 명시되어 있다. 이 동작은 `create-order` Edge function이 매번 `site_settings`를 다시 읽기 때문(C1 시트의 서버측 금액 재계산 절 참조). 시안에서 이 안내를 보존할지·다른 위치로 옮길지 결정.
6. 인쇄용 QR이 SVG로만 다운로드된다. PNG 옵션 없음. 인쇄 업체가 PNG를 요구하는 경우도 있다 — 시안에서 추가 결정 필요.
7. Select의 "없음 (비활성)" 옵션이 italic + em 태그로 표시된다. MUI Select 내부에서 italic이 잘 안 보이는 경우가 있어, 시안에서 명시적 disabled 색 또는 "선택 안 함" 명확화 검토. (※ 현행 코드는 line 187-191에서 이미 "선택 안 함 (비활성)" disabled 색으로 정리됨 — §발견 해소 상태.)
8~11. **(P1) 마스터 CRUD 관련 핵심 발견(저장 흐름 분리·삭제 가드·색 프리셋·소분류 노출 전용)은 A6 상품 관리로 이동.** `A6_ProductManagementPage.md` §발견·§소분류 마스터 관리 패널 참조. 규칙 자체는 A6에서 동일하게 유지된다. **배지 관련 발견은 폐기**(2026-06-29 동적 배지 기능 제거).

## 변경 이력
- 2026-11-04 "배송비 정책" 섹션 맨 아래에 Switch "이벤트 결제 시 배송비 면제 사용"(기본 꺼짐) 추가. 저장은 `voucher_config.shippingWaiverEnabled`(마이그레이션 불필요). 상세 A13 §①.
- 2026-11-04 이벤트 결제수단 "숫자 버튼" **최대 5개**(5개면 입력·추가 비활성), 미리보기 배치를 결제완료 창과 동일하게(숫자 5칸 고정·단위 균등 분할). 상세 A13 §①.
- 2026-06-29 **동적 배지 기능 폐기 — 소분류는 유지** (실 코드 변경, 건우님 결정). 본 화면 안내 Alert 문구를 "소분류는 상품 관리 화면(상단 '소분류 관리')에서 관리합니다"로 수정(배지 언급 제거). `badges` 테이블·`products.badges`·배지 데이터 모델·블록 4·5의 배지 잔존 표현 정리. 소분류 마스터·안내 Alert 자체는 유지. 코드 변경은 SettingsPage 안내 문구 1줄. 배지 마스터 CRUD API·UI는 이미 A6로 이동된 상태에서 A6에서 제거됨(본 화면 영향 없음).
- 2026-06-29 **소분류·배지 마스터 CRUD를 상품 관리(A6)로 이동 — 본 화면에서 제거** (건우님 확정 #1). SettingsPage에서 블록 4(소분류)·블록 5(배지) SectionCard 2개·다이얼로그 2개·관련 state(`subcategories`/`badges`/`usage`/`subDialog`/`badgeDialog`/`masterSaving`)·핸들러(`loadMasters`/`handleSaveSub`/`handleDeleteSub`/`handleToggleSubActive`/배지 동형)·import(masters API·`ColorPresetPicker`/`SoftChip` 로컬 컴포넌트·`MASTER_COLOR_PRESETS`)를 전량 제거. 대신 **안내 Alert 1줄** "소분류·배지는 상품 관리 화면(상단 '소분류·배지 관리')에서 관리합니다"(시스템 정보 블록 아래). API `masters.js`는 ProductManagementPage가 import하여 그대로 사용(API 변경 0). 마스터 단일 진실 소스 UI = A6. 배치 이유: 상품 진열 준비 작업이 상품 관리 맥락에 더 자연스럽고, 엑셀 양식·업로드와 같은 화면에서 일괄 처리 가능(건우님 결정). 데이터 모델·핵심 발견 8~11·입력 폼·액션 절 모두 A6 참조로 정리.
- 2026-06-29 **소분류·배지 마스터 CRUD 실 코드 구현** (P1). (이후 위 항목으로 상품 관리에 이동됨) (1) **API 신설** `src/api/masters.js` — `fetchSubcategories`/`createSubcategory`/`updateSubcategory`/`deleteSubcategory`, `fetchBadges`/`createBadge`/`updateBadge`/`deleteBadge`, `fetchMasterUsageCounts`(상품 전수 집계 → 이름별 사용수). 테이블 미존재(마이그레이션 미적용) 시 빈 배열 graceful 폴백, products.badges 컬럼 미존재도 폴백. (2) **SettingsPage** — 시스템 정보 블록 뒤에 블록 4(소분류 관리)·블록 5(배지 관리) SectionCard 추가. 각 SectionCard `action`에 추가 버튼, 목록은 행 단위(소프트 틴트 칩·소속/순서·사용수·is_active Switch·편집/삭제 아이콘), 빈 상태 메시지, 사용 중(>0) 삭제 차단(아이콘 disabled + 경고 토스트). (3) **다이얼로그 2개** — 소분류(이름·소속 대분류 Select·색 프리셋·정렬순서 4필드 + 미리보기), 배지(이름·색 프리셋·우선순위 3필드 + 미리보기). 같은 대분류 내 소분류명 중복·배지명 전역 중복 검증. (4) **색 프리셋** `MASTER_COLOR_PRESETS`(9색, AA 통과 theme 토큰 계열) `constants/categoryColors.js`에 추가 — 자유 hex 금지(§발견 10). 견본 원형 클릭 선택. (5) **즉시 저장** — 다이얼로그 저장/삭제/Switch 모두 즉시 DB 반영, 하단 "저장하기"는 site_settings 전용임을 블록 상단 안내 Alert로 명시(§발견 8). (6) 배지 블록에 "인기·신상품·할인은 상품별 체크박스로 별도 관리" 안내(§블록5 참고 안내). theme.js 무수정, 마이그레이션 `20260625000000`/`20260625010000`/`20260619000000`(badges 컬럼) 적용 후 실동작. **C1 고객 카드 배지 칩 표시는 별도 트랙(미구현).**
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1 트랙·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **소분류 마스터 CRUD(블록 4) + 배지 마스터 CRUD(블록 5)** UI를 설정 페이지 내 신규 SectionCard로 배치 결정(별도 화면 신설 안 함 — 점진 개선). 각 블록 = 목록(이름·소속/색/순서·사용수·작업) + 추가 다이얼로그 + 사용 중 삭제 차단 + 미등록 안내. (2) 색=프리셋 선택 권장(AA 대비), 배지 미리보기=소프트 틴트(C1 정합). (3) 마스터 CRUD 즉시 저장 흐름 = site_settings 일괄저장과 분리 명시. (4) 데이터 모델에 `subcategories`·`badges` 테이블 추가. (5) 입력 폼 구조·핵심 발견 8~11 신설. (6) 참조 파일 현행(425줄, SectionCard 3블록)으로 정정, 액션 블록 번호 4→6. **A6 상품 폼/엑셀은 이 마스터의 소비자** — 마스터 단일 진실 소스는 본 화면.
- 2026-06-15 신규 주문 알림 강화 — **SettingsPage 변경 없음.** 신규 주문 브라우저알림·소리 ON/OFF 토글은 위임 권장대로 **헤더 종 드롭다운 하단**(AdminHeader)에 배치, 설정 페이지에는 두지 않음. 알림 설정은 학회 직전 1회가 아니라 현장에서 즉석 토글하는 성격이라 종 드롭다운이 자연스러움. 상세 사양은 S1_AdminShell §1-H·§2-J 참조.
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독. `active_event_slug` 컬럼 마이그레이션 누락 및 하드코딩 prod URL 등 잠재 부채 발견.
- 2026-05-29 M3-8 시안 정합 (PR #10~16 답습) — SettingsPage.jsx (274→약 360, MUI Paper/Divider 제거 → ui 컴포넌트 답습).
  - PageHeader 도입 (subtitle: "리다이렉트 학회 · 배송비 · 시스템 정보")
  - 블록 1·2·3 SectionCard (EventIcon · ShippingIcon · InfoIcon, padding=24)
  - 활성 학회 선택 Select 옵션: 이름 + slug 2줄, "선택 안 함 (비활성)" italic 명확화 (사양 §발견 7 반영)
  - URL 안내 카드: gray.50 박스 + 활성 학회명 컨텍스트 라인 + ActionSlot(URL 복사 · QR 다운로드)
  - 사양 §발견 1 (active_event_slug 마이그레이션 누락) → fetchSettings 응답에 컬럼 없으면 warning Alert 표시 (시안 답습)
  - 시스템 정보 SectionCard 신규 (시안 답습, readonly): 버전 / 환경(`import.meta.env.MODE` 기반) / DB 리전 — InfoRow 사용
  - 배송비 정책 요약 카드 (입력값 즉시 반영 미리보기)
  - 하단 안내 Alert 보존 (info, borderRadius radii.md)
  - 저장·취소 액션 → ActionSlot (minHeight 44, 취소: fetchSettings 재호출 / 저장: handleSave)
  - 보존: supabase 직접 호출 2종(fetchSettings/fetchEvents/handleSave), QR SVG 다운로드 로직, REDIRECT_URL 하드코딩 (사양 §발견 2 — 환경변수화는 별도 부채)
  - 자동 검출 5종 통과 (raw hex 0 / 인라인 fontSize rem-px 0 / weight 800 0 / 4배수 외 0 / touch 44 미만은 카드 내부 보조 버튼 36, 시안 답습)
- 2026-06-01 어드민 코드 정리 (DB 무관·저위험 6건 배치) — CTO 감사 후속.
  - REDIRECT_URL 환경변수화: `https://inpsytorder.vercel.app/go` 하드코딩 → `${VITE_APP_URL || window.location.origin}/go` (사양 §발견 2 해소). URL 복사·QR 다운로드 모두 동일 베이스 사용.
  - 시스템 정보 블록 가짜 항목 제거: `APP_VERSION='v2.4.1'`(가짜 정적값)·`APP_DB_REGION='ap-northeast-2'`(하드코딩) 삭제 (룰 E). "환경"(`import.meta.env.MODE` 실값) 행만 잔존.
  - 배송비 기본값 30000/3000 fallback을 `src/constants/shipping.js`의 `SHIPPING_DEFAULTS` 단일 상수 참조로 전환 (값 변경 없음, 출처 단일화). settings 우선·fallback 구조 유지.
