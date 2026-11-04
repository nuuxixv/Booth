# 사양 시트 — A5 학회 관리 (EventManagementPage)

> 이 시트는 학회 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-11-04 **이벤트 적용 토글 — A5 코드 변경 없음(포인터)**(frontend-engineer, `A13_VoucherEvent.md` §②). 이벤트 적용 토글(`events.voucher_enabled`)은 L2 상세/생성의 공용 폼 `EventOptionalFields`에만 있고, 본 목록 화면은 편집을 `EventDetailPage`로 네비게이트하는 리스트라 저장 라운드트립이 없어 `EventManagementPage.jsx` 수정 불필요. 목록 select도 `voucher_enabled` 비의존(표시 안 함). 데이터 모델·토글 상세는 A13·A11.
> 이전 갱신: 2026-06-25 판매 대분류 선택 필드 **구현**(`events.visible_categories`) — 빈 선택 의미 정정(빈/NULL=전체 노출, PRD 초기 "0개" 기각) + 실 코드 변경 반영.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/EventManagementPage.jsx` (799줄)
- 부속 컴포넌트: `inpsyt-order-frontend/src/components/SocietyManagementDialog.jsx` ("학회 목록 관리" 모달, societies 테이블 관리)
- 관련 유틸: `inpsyt-order-frontend/src/utils/date.js` 의 `getTodayKST`, `getEventStatusKST`
- DB 스키마: `supabase/migrations/20250722065000_create_events_table.sql` + `20260313060000_add_event_structured_fields.sql` + `20260406_add_estimated_delivery_date_to_events.sql`
- 외부 라이브러리: `qrcode` (QR 코드 SVG 생성)

## 사용자 시나리오
인싸이트 직원(master 또는 editor)이 학회 일정이 잡힐 때마다 사무실 PC에서 새 학회를 등록한다. 연도·시즌·주최학회를 선택하면 행사명과 주문 URL이 자동 제안된다. 등록 후 부스 운영자에게 URL을 복사해 전달하거나, 학회장 안내데스크용으로 QR 코드 SVG를 다운로드한다. 학회 진행 중에는 거의 손대지 않는다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 322-352)
- [ ] 페이지 제목 아이콘: `EventIcon` (primary 색)
- [ ] 페이지 제목 텍스트: "학회 관리"
- [ ] 우측 액션 버튼 (`events:edit` 권한 있을 때만):
  - "학회 목록 관리" 버튼 (outlined, `SettingsIcon`)
  - "학회 추가" 버튼 (contained, `AddIcon`) — **클릭 시 전용 생성 페이지 `/admin/events/new`로 이동**(2026-07-20 모달→페이지 전환). 사양은 `A11_EventCreatePage.md` 참조.

### 상태 필터 토글 (M3-4 정합 후 — 통계 카드 4장 외형 전환)
2026-05-28 M3-4(EventManagementPage 시안 정합) 사이클에서 통계 카드 4장(그라데이션 배경)을 두 영역으로 분리해 흡수:
- 헤더 `subtitle`에 `총 N건 · 진행 중 X · 예정 Y · 종료 Z` 한 줄 통계로 통합
- 필터 영역 SectionCard 안 상태 토글 Chip 4종 (`전체 N` / `예정 Y` / `진행 중 X` / `종료 Z`)으로 통합

각 칩 클릭 시 `eventFilter` 토글:
- [ ] 전체: `events.length`, `eventFilter='all'`
- [ ] 예정: `upcomingEventsCount` (`today < start_date`), `eventFilter='upcoming'`
- [ ] 진행 중: `activeEventsCount` (`start_date <= today <= end_date`), `eventFilter='active'`
- [ ] 종료: `endedEventsCount` (`today > end_date`), `eventFilter='ended'`

> 그라데이션 배경은 신 디자인 시스템(`CLAUDE.md` E항)에서 차단 대상. 카드 4장 외형은 제거됐고, 정보는 통계 subtitle + 상태 토글로 1:1 보존됨.

### 학회 표 (line 420-559)
- [ ] 컬럼 헤더(`events:edit` 권한별): 학회명 / 상태 / 주문 URL / 할인율(중앙) / 기간 / 주최학회 / 작업(`events:edit` 시)
- [ ] 행 표시 — 누락 금지:
  - 학회명 (`event.name`, fontWeight 500)
  - 상태 칩 (`getEventStatusKST(start_date, end_date)`의 `{label, color}` 반환값)
  - **주문 URL 영역(line 470-512):**
    - URL 문자열 (`order_url_slug`, monospace, text.secondary)
    - "새 창에서 열기" 아이콘 (`OpenInNewIcon`) — 툴팁, primary 색
    - "URL 복사" 아이콘 (`CopyIcon`) — 툴팁, primary 색
    - "QR 코드" 아이콘 (`QrCode2Icon`) — 툴팁, primary 색
  - 할인율 칩 (`discount_rate * 100` %, `>0`이면 success filled, =0이면 default outlined)
  - 기간 (시작일 `yyyy.MM.dd` 굵게 + 종료일 caption "~ yyyy.MM.dd")
  - 주최학회 칩 (`host_society` 있으면 outlined 칩, 없으면 "—" disabled)
  - 작업: 편집 아이콘 (`EditIcon`)

## 액션·기능 (누락 금지)

- [ ] 통계 카드 클릭 → `eventFilter` 토글
- [ ] URL 복사 (`handleCopyUrl`) → `${origin}/order?events={slug}` 클립보드 → "주문 URL이 클립보드에 복사되었습니다." 토스트
- [ ] 새 창 열기 → `window.open` 같은 URL을 새 탭
- [ ] QR 코드 다이얼로그 열기 (`handleOpenQrDialog`) → SVG QR 생성, 다이얼로그에 표시
- [ ] 편집(⋯ 메뉴 "수정") 클릭 → **`navigate('/admin/events/{slug}?edit=1')` — L2 학회 상세로 이동해 개요 인라인 편집 자동 진입**(2026-07-28, `EventFormDialog` 모달 폐기). ⋯메뉴 "수정" 항목은 유지(제거 아님). slug 없는 행은 이동 불가 토스트.
- [ ] "학회 추가" 버튼 → **전용 생성 페이지 `/admin/events/new`로 네비게이트**(모달 아님, 2026-07-20). 빈 상태 `EmptyState`의 "학회 추가" 액션도 동일 경로.
- [ ] "학회 목록 관리" 버튼 → `SocietyManagementDialog` 열기 (societies 테이블 CRUD)
- [ ] 학회 저장 (`handleSave`):
  - name, order_url_slug 필수 검증
  - slug 정규식: `/^[a-z0-9-]+$/`
  - 중복 검증 (events 테이블에서 같은 slug 존재 여부, 자기 자신 제외)
  - 통과 시 insert 또는 update
- [ ] 학회 삭제 (master 권한 + 수정 다이얼로그 안에서만):
  - 연결된 주문(orders.event_id 일치) 건수 먼저 조회
  - 0건이면 삭제 가능, >0건이면 경고 후 차단
  - "이 행사에 연결된 주문 {N}건이 있어 삭제할 수 없습니다." 메시지
- [ ] 실시간 갱신: `supabase.channel('events_channel')`로 events 테이블 변경 구독, 변경 발생 시 `fetchEvents()` 호출
- [ ] QR SVG 다운로드 (`handleDownloadQrSvg`): 파일명 `qr-{slug}.svg`

## 입력 폼 구조 (전용 페이지 + L2 인라인 편집)

> **⚠ 2026-07-28 — `EventFormDialog` 폐기(파일 삭제).** 이 화면에는 더 이상 추가/수정 다이얼로그가 없다. **신규 생성 = 전용 페이지 `/admin/events/new`(`A11_EventCreatePage.md`), 편집 = L2 개요 인라인 편집(`L2_EventDetail.md` §5-2, `?edit=1` 진입).** 폼 필드는 공용 컴포넌트 3종(`EventAutofillFields`·`EventRequiredFields`·`EventOptionalFields`)+`useSlugCheck` 훅으로 생성·편집이 공유(정본=생성 페이지 버전). 아래 다이얼로그 line 번호·블록 설명은 **폐기된 EventFormDialog 기준 역사 기록**으로만 남긴다.
>
> **2026-07-20 — 신규 생성은 전용 페이지 `/admin/events/new`(`A11_EventCreatePage.md`)로 분리.** ~~이 다이얼로그는 L1·L2의 기존 행사 편집 전용으로 계속 사용~~(2026-07-28 폐기). 폼 상수·자동조립·slug·저장 정규화 순수 로직은 `src/utils/eventForm.js`로 추출돼 생성 페이지·편집 폼이 공유(동작 불변).
> **2026-06-10 — 다이얼로그를 `src/components/EventFormDialog.jsx`로 공용 추출.** EventManagementPage(L1)·EventDetailPage(L2 인라인 수정) 양쪽에서 사용. 폼 구조·검증·자동 채우기 규칙은 아래 그대로 1:1 보존. props = open/onClose/event(null=신규)/societies/staff/canEdit/canDelete/onSaved/onDeleted. 다이얼로그 내부 삭제(주문 건수 확인→확인 다이얼로그)도 컴포넌트가 자체 처리하며, L1의 ⋯ 메뉴 삭제 확인은 페이지(`deleteTarget`)에 잔류.
> **날짜 필드 = 공용 `ui/DateField`(경량 캘린더)로 교체(2026-06-10).** 표시 `YYYY.MM.DD(요일)`, × 버튼으로 클리어 가능. 빈 날짜는 upsert 시 null 정규화(date 컬럼 — '' 저장 오류 방지, 배송 예정일 비우기 지원).
> **2026-06-15 datepicker 고도화:** ① 시작일·종료일 별도 2필드 → **`mode="range"` DateField 1개("행사 기간", 호텔 예약식 한 캘린더 2클릭)** 로 통합. `onChange({start,end})`를 `handleChange('start_date',start)`+`handleChange('end_date',end)` 2번 호출로 분해 → **DB 컬럼(start_date/end_date) 구조 그대로 유지.** range 캘린더가 start≤end를 자동 정렬하므로 시작>종료 입력 구조적 차단. ② 배송 예정일은 별개 single 유지. ③ 캘린더 공통: 오늘 셀 테두리 강조(자동선택 안 함), 항상 6행(42셀) 고정 높이(‹ › 위치 불변), single 필드 직접 타이핑 입력(`YYYY.MM.DD`/`YYYY-MM-DD`/`YYYYMMDD` 수용, blur·Enter 시 검증·정규화, 무효 날짜는 helperText 에러+값 미반영). range 필드는 타이핑 미지원(2클릭 전제, 아이콘 클릭으로 캘린더만).

> 폼은 **세 블록**으로 나뉘며 블록마다 `Divider`로 구분(EventFormDialog.jsx 현행):
> - **Step 1 — 행사명 형식 카드**(연도/행사구분/주최학회, primary 옅은 배경 카드, line 196-260)
> - **Step 2 — 기본 정보**(행사명/주문URL/할인율/행사기간/배송예정일, line 264-322)
> - **Step 3 — 운영 정보**("운영 정보" 캡션 + 장소/참석자/비용/비고, line 326-423)
> 세 블록 통합 금지. (※ 이전 시트는 "두 블록"으로 기재했으나 2026-06-10 공용 추출 시 운영정보가 별도 블록으로 분리됨 — 본 갱신에서 3블록으로 정정.)

### Step 1 — 행사명 형식 블록 (line 569-626, primary 색 옅은 배경 카드)
- [ ] 캡션: "✦ 행사명 형식" (primary 색, 굵게)
- [ ] **연도** 선택 (`event_year`, select) — `현재년-1`부터 5개 연도, 기본 빈값
- [ ] **행사 구분** (`event_season`, **`Autocomplete freeSolo`**) — 6개 옵션(춘계학술대회 / 추계학술대회 / 연수강좌 / 보수교육 / 세미나 / 기타) + 직접 입력 가능. placeholder "목록에서 선택하거나 직접 입력"
- [ ] **주최 학회** (`host_society`, **`TextField select`**) — `societies` 테이블의 name 목록에서만 선택(자유 입력 아님). helperText "학회 목록 관리에서 추가한 학회 중 선택"

> ⚠ **(2026-07-20 정정)** 이전 시트는 `event_season`=select / `host_society`=Autocomplete freeSolo로 **뒤바꿔** 기재했다. 실 코드(`EventFormDialog.jsx:249-280`) 기준 **`event_season`=Autocomplete freeSolo(직접입력 가능), `host_society`=select(마스터 한정)** 이 정본이다. A11 시트 §핵심발견 3과 동일.

> 세 필드 모두 입력되면 자동으로 행사명과 URL slug가 생성됨(아래 액션 참조).

### Step 2 — 기본 정보 (line 264-322)
- [ ] **행사명** (`name`, 텍스트, `InputLabelProps={shrink: true}`) — helperText "위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다." (2026-06-02 — 자유 입력 명확화. 행사명을 직접 수정하면 `_nameTouched` 플래그로 이후 자동완성이 덮어쓰지 않음. `_nameTouched`는 UI 전용, DB upsert에서 제외)
- [ ] **주문 URL** (`order_url_slug`, 텍스트) — helperText "주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
- [ ] **할인율 (%)** (`discount_rate`, number) — UI는 0~100 정수, 저장은 `/100`해서 소수로. helperText "예: 15 = 15% 할인"
- [ ] **행사 기간** (`DateField mode="range"`) — `start_date`~`end_date` 단일 캘린더 2클릭. helperText "달력에서 시작일·종료일을 차례로 선택하세요." onChange 시 start_date/end_date 컬럼에 분해 저장(2026-06-15 통합)
- [ ] **배송 예정일** (`estimated_delivery_date`, DateField single) — helperText "입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."
- [ ] **(구현 완료 2026-06-25) 판매 대분류** — Step 2 **말미**(배송 예정일 아래)에 **멀티선택 토글 칩** 필드. 이 행사에서 고객 주문서에 노출할 **대분류(검사/도서/도구)** 집합을 고른다(`EventFormDialog.jsx`).
  - UI: 대분류 3종 **토글 칩**(`VISIBLE_CATEGORY_OPTIONS = ['검사','도서','도구']` 고정 상수). 선택 시 filled+primary, 비선택 outlined default, `radii.sm`. (※ 소분류는 여기서 선택하지 않음 — 대분류 선택이 그 하위 소분류 전부를 자동 포함. 고객 화면이 소분류 칩으로 탐색.)
  - **빈 선택 = 전체 노출**(NULL과 동일 의미, `20260624000000` 마이그레이션 §의미 규칙·CTO 위임 지시서 확정). PRD 초기 "빈=노출 0개" 안은 기각됨 — 기존 운영 행사(전부 NULL) 보호·graceful 위해 빈/NULL=전체노출로 통일. helperText 분기:
    - 빈 선택: "선택하지 않으면 전체 상품이 노출됩니다."
    - 1개 이상: "선택한 대분류 상품만 이 행사의 주문서에 노출됩니다. 노출 대상: 검사 N개 · ... (총 M개)"
  - **미리보기**(구현): 선택 1개 이상이면 helperText에 실 집계 카운트 라인 append. `api/products.fetchProductCountByCategory()`(다이얼로그 open 시 1회, 대분류별 상품 수). 가짜 통계 아님 — products 실 집계.
  - **저장 위치 = `events.visible_categories` 신규 text[] 컬럼**(tags 겸용 기각 — C1 태그 필터 의미 충돌 회피, backend 확정). `FORM_FIELDS`에 `visible_categories` 추가, upsert 시 배열 보장(빈 배열 그대로 저장). 미지정 환경 graceful은 C1 OrderPage select fallback이 담당.

### Step 3 — 운영 정보 (line 326-423)
- [ ] 캡션: "운영 정보" (`overline` 스타일, text.secondary 굵게)
- [ ] **장소** (`venue`, 텍스트, `PlaceIcon` 시작 어드먼트) — placeholder "예) 서울 코엑스 그랜드볼룸"
- [ ] **참석자** (`attendee_ids`, uuid[], Autocomplete multiple) — 후보 = `user_profiles` role IN (master, onsite). 칩 표시, helperText "현장 마케팅 · 마스터 중 선택"
- [ ] **비용 (원)** (`marketing_cost`, 천 단위 콤마 입력, 끝 어드먼트 "원") — 값 있으면 하단에 한글 금액 보조 표기(`numberToKoreanCurrency`)
- [ ] **비고** (`note`, multiline minRows=2) — placeholder "부스 위치, 진열 메모 등"

> ※ 판매 대분류(P0)는 Step 2 말미에 둔다(위 참조). 운영 정보(Step 3)는 내부 운영 메타라 고객 노출과 무관하므로 분리 유지.

### 다이얼로그 액션 (line 426-436)
- [ ] master 권한 + 편집 모드일 때만 "삭제" 버튼 (error 색, `DeleteIcon`, 좌측 정렬 `mr: auto`)
- [ ] "취소" 버튼
- [ ] `events:edit` 권한 있을 때 "저장" 버튼 (contained)

### 자동 채우기 규칙 (line 133-170)
- 신규 등록 모드에서만 작동(편집 시 작동 안 함)
- name 직접 입력 시 → 자동으로 slug 생성(공백 → `-`, 영문 외 제거)
- event_year + host_society + event_season 모두 채워지면 (단, 행사명을 사용자가 직접 건드리지 않은 경우 `!_nameTouched`):
  - name = `"{year} {host_society} {season}"`
  - slug = `"{society.slug_prefix}-{year}-{season_eng}-{random4}"` (랜덤 4자리 토큰으로 추측 방지)
  - season_eng: 춘계→spring / 추계→fall / 연수강좌→training / 보수교육→edu / 세미나→seminar / 기타→etc

## 권한별 차이

- `events:view` 없음 → 접근 차단 메시지
- `events:view` 있음 (viewer): 표·통계 카드·필터·URL 복사·QR 다운로드·새 창 열기 가능. "새 학회 추가" 및 "학회 목록 관리" 버튼 안 보임. 편집 컬럼 안 보임. 다이얼로그 폼 열 수 없음.
- `events:edit` 있음 (editor): 위 + 추가/수정 가능
- `master` 권한: 위 + 다이얼로그 안에서 "삭제" 버튼 사용 가능

## 데이터 모델

### `events` 테이블 (이 화면에서 SELECT/UPSERT하는 필드)
- `id` (bigint, PK)
- `created_at` (timestamptz)
- `name` (text) — 학회명
- `start_date` (date)
- `end_date` (date)
- `order_url_slug` (text, UNIQUE) — 영문 소문자/숫자/하이픈
- `event_year` (integer)
- `host_society` (text)
- `event_season` (text)
- `status` (text, default `'active'`) — UI 노출 없으나 select 컬럼에 포함됨 (확인 필요: 클라이언트에서 사용처)
- `discount_rate` (numeric) — 0~1 소수 (UI는 % 정수로 표시)
- `estimated_delivery_date` (date, nullable)
- `venue` (text, nullable) / `attendee_ids` (uuid[]) / `note` (text, nullable) / `marketing_cost` (integer, nullable) — Step 3 운영 정보 컬럼 (`20260313060000_add_event_structured_fields.sql` 등). `EventFormDialog.FORM_FIELDS`에 포함돼 upsert.
- **판매 대분류 = `visible_categories` (text[], nullable — `20260624000000_DRAFT`):** 고객 주문서 노출 대분류 화이트리스트. NULL/빈 배열=전체 노출. 값 있으면 원본 `products.category` ∈ 배열인 상품만 C1 노출. `EventFormDialog.FORM_FIELDS`에 추가됨(upsert). tags 겸용 기각(C1 태그 필터 충돌 회피). anon 공개 컬럼(GRANT 화이트리스트 포함).

### `societies` 테이블 (참조용)
- `id`, `name`, `slug_prefix`

### `orders` 테이블 (삭제 검증 시 참조)
- `event_id` (bigint, FK → events) — 연결된 주문 카운트

## 필터·뷰 모드

- 학회 필터: `all` / `active` / `upcoming` / `ended` (통계 카드로 토글)
- 기본 정렬: `start_date desc` (line 81)

## 빈 상태·로딩·오류 처리

- 로딩: `TableSkeleton rows=5 columns=7`
- 빈 상태: `EmptyState` — "해당 학회가 없습니다" + "필터를 해제하거나 새 학회를 추가하세요" + "학회 추가" 액션 (`events:edit` 권한 있을 때만)
- 오류: 토스트 처리
- 실시간 변경: Supabase realtime 구독, 변경 시 자동 reload

## QR 코드 다이얼로그 (line 752-795)
- [ ] 제목: "QR 코드"
- [ ] 본문: SVG QR 이미지 (300px width, 색 dark=`#252525`, light=`#FFFFFF`)
- [ ] 학회명 (subtitle, 굵게)
- [ ] URL 텍스트 (monospace, text.secondary)
- [ ] 액션: "SVG 다운로드" (outlined, `DownloadIcon`, borderRadius 10px) + "닫기"

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **주문 URL 컬럼은 4개 요소(URL 문자열 + 새창/복사/QR 아이콘) 묶음.** 시안이 URL만 보여주고 아이콘 3종을 빠뜨리면 운영자가 부스 안내데스크용 QR을 못 받는다.
2. **폼은 두 블록 분리 구조.** "행사명 형식" 블록(연도/시즌/주최학회)과 "자동 생성·추가 정보" 블록(행사명/URL/할인율/날짜) 사이에 `Divider`. 한 블록으로 합치면 자동 채우기 의도가 사라진다.
3. **연도·시즌·주최학회 세 필드는 별도.** Step 1에서 셋 다 채워야 자동 채우기가 작동한다. 시안에서 통합 입력으로 그리면 안 됨.
4. **시작일·종료일·배송 예정일 세 필드는 별도.** 시작/종료는 가로 배치이지만 입력은 분리. 배송 예정일은 별도 줄.
5. **할인율 단위 변환.** UI는 0~100 정수, DB는 0~1 소수. 시안에서 단위 표기 누락 금지.
6. **상태 칩 색은 `getEventStatusKST` 반환값을 따른다.** 시안이 임의 색 매핑을 만들면 안 됨 — utils와 1:1.
7. **master만 삭제 가능, 그리고 연결 주문 있으면 차단.** 시안이 모든 행에 삭제 아이콘을 직접 노출하면 안 됨(현재는 수정 다이얼로그 안에 숨겨져 있음).
8. **그라데이션 배경은 신 디자인 시스템에서 제거 대상.** 통계 카드 4장의 그라데이션은 시안에서 유지하지 말 것.
9. **(P0) 판매 대분류는 Step 2 말미에 둔다 — 대분류만 선택(소분류 선택 아님).** 대분류 선택이 그 하위 소분류 전부를 자동 포함. 시안이 소분류까지 고르게 하면 운영 부담·기획 충돌. 후보는 고정 3(검사/도서/도구).
10. **(정정·확정) 빈 선택 = 전체 노출(NULL과 동일).** PRD 초기 "빈=노출 0개" 안은 기각됨 — 기존 운영 행사(전부 NULL=전체노출) 보호·graceful 위해 빈/NULL=전체노출로 통일(`20260624000000` 마이그레이션·CTO 지시서). 빈 선택 helperText는 "선택 안 하면 전체 노출" 안내.
11. **(확정) 판매 대분류 저장 = `events.visible_categories` 신규 text[] 컬럼.** tags 겸용 기각(C1 태그 필터 충돌). 마이그레이션 적용 + anon GRANT 필요(미적용 시 C1 OrderPage가 레거시 select fallback).
12. **폼은 3블록(행사명형식/기본정보/운영정보).** 이전 시트의 "2블록" 기재는 2026-06-10 공용 추출 시점 이후 부정확 — 본 갱신에서 정정. Step 통합 금지.

## 변경 이력

- 2026-07-28 **편집 경로 L2 이관·`EventFormDialog` 폐기**(frontend-engineer). ⋯메뉴 "수정" → `navigate('/admin/events/{slug}?edit=1')`(L2 개요 인라인 편집 자동 진입, `L2_EventDetail.md` §5-2). EventFormDialog 파일 삭제 — L1에서 추가/수정 다이얼로그 및 관련 state(`formOpen`/`formEvent`/`handleOpen`/`handleClose`)·`availableSocieties`·societies fetch 제거. **⋯메뉴 삭제(`handleMenuDelete`·`deleteTarget`·확인 다이얼로그)는 존치·무변경.** 폼 필드는 공용 컴포넌트 3종(생성·편집 공유, 정본=생성 페이지). backend 무변경.
- 2026-07-20 **신규 생성 흐름 전용 페이지 분리**(`A11_EventCreatePage.md`, 라우트 `/admin/events/new`) — L1 "학회 추가" 버튼·빈 상태 액션이 모달 대신 전용 페이지로 네비게이트. **편집 경로(⋯ 메뉴 "수정"→`EventFormDialog`)는 이 화면에 그대로 유지**(신규만 이관, 리스크 격리). 폼 순수 로직(`SEASON_OPTIONS`·`FORM_FIELDS`·`applyAutofill`·`normalizeEventPayload`·slug/할인율 헬퍼)을 `src/utils/eventForm.js`로 추출해 다이얼로그·생성 페이지 공유(다이얼로그 동작 1:1 불변). **Step 1 컨트롤 타입 오기 정정**: `event_season`=Autocomplete freeSolo / `host_society`=select(이전 시트가 뒤바꿔 기재, 실 코드 기준 정정 — A11 §핵심발견 3).
- 2026-06-25 판매 대분류 선택 필드 **구현**(`feature/product-hierarchy`, `EventFormDialog.jsx`) — **실 코드 변경**: (1) Step 2 말미(배송 예정일 아래)에 **판매 대분류 토글 칩**(검사/도서/도구 고정 상수) 추가, A5 핵심발견 2의 3블록·Divider 구조 보존. (2) `FORM_FIELDS`·`emptyEvent`에 `visible_categories` 추가, upsert 배열 보장(빈 배열 그대로 저장). (3) **빈 선택 의미 정정**: PRD "빈=0개" → **빈/NULL=전체 노출**(마이그레이션·CTO 지시서 확정, 기존 행사 보호). helperText 분기 + 1개 이상 시 실 집계 미리보기(`fetchProductCountByCategory`). (4) 데이터 모델·핵심 발견 10·11 정정. **보존(무변경)**: 자동완성·slug 생성·날짜 range·운영정보 블록·삭제 로직·권한 분기. **검증**: lint(변경 0 이슈)·build 통과.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P0 트랙·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **Step 2 말미에 "판매 대분류 선택" 멀티선택 필드** 추가 — 대분류(검사/도서/도구) 다중 칩, 빈 선택=노출 0개 경고+미리보기. 선택 대분류만 C1 주문서 노출. (2) 저장 위치(events.tags 겸용 vs visible_categories 신규 컬럼)는 **backend 디테일로 "확인 필요"** 표기 — tags 겸용 시 C1 태그 필터 충돌 위험 주석. (3) **폼 구조 2블록 → 3블록 정정**(EventFormDialog 현행: 행사명형식/기본정보/운영정보), 누락됐던 Step 3 운영정보(장소/참석자/비용/비고) 표시정보 추가. (4) 라인 번호 EventFormDialog.jsx 기준으로 갱신. (5) 핵심 발견 9~12 신설. **A5 핵심발견 2(2블록 분리·Divider) 준수**하여 기존 블록 구조·자동완성 의도 보존.
- 2026-05-13 신설.
- 2026-05-28 M3-4 정합: 통계 카드 4장 외형 → 헤더 subtitle + 상태 토글 칩으로 통합 (정보 1:1 보존, 그라데이션 제거). 표 영역은 `SectionCard padding=0`으로 래핑. 헤더는 `PageHeader`, 상태 칩은 `StatusBadge(value=paid|pending|completed)`, URL 액션 묶음은 `ActionSlot`, 빈 상태는 `ui/EmptyState`로 교체. 폼 2블록 분리·할인율 단위 변환·QR 다운로드·권한 분기 보존.
- 2026-06-02 행사명 자유 입력 명확화: helperText "직접 입력·수정 가능"으로 변경(라벨 "행사명 (자동 완성)" → "행사명"). 행사명 직접 수정 시 `_nameTouched`(UI 전용 플래그)로 이후 연도/시즌/주최학회 변경이 행사명을 덮어쓰지 않게 보존. `_nameTouched`는 DB upsert에서 분리. 기존 자동완성·slug 생성·기존 옵션 유지(주최학회는 이미 Autocomplete freeSolo). 동작 추가만, 제거 0.
