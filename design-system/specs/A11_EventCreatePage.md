# 사양 시트 — A11 행사 생성 페이지 (`/admin/events/new`)

> 이 시트는 **신규 행사 생성 흐름**의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 신설 2026-07-20 · **개정 2026-07-28**(UX 검토 반영 8건 — 점진 노출·블록 통합·드롭다운 강제 등) · **개정 2026-10-12**(학회 개선 트랙 2차 — 설치/철거 시간 2칸 + 장소 구조화(장소명·주소·홀/층 상세) + DB 5컬럼 추가).

## 설계 목표 (건우님 확정 문구)

> **"이걸 페이지네이션한다고 해서 좋은 게 아니야. 그저 번거롭지 않게, 막힘 없이 생성하도록 하는 게 목표야."**

**스텝 분할(위저드)은 명시적으로 기각됐다.** 마찰의 원인 3가지를 정면으로 없앤다:

| 기존 병목 | 해법 |
|---|---|
| 13개 필드가 한눈에 다 보여 "전부 채워야 하나" 압박 | **점진 노출** — 지금 필요한 것만 순서대로 등장 |
| 좁은 모달(`maxWidth="sm"`) 세로 스크롤 | **전체 페이지 2열 레이아웃** |
| 저장 눌러야 알게 되는 검증 실패 | **입력 즉시 인라인 검증**(slug 형식·중복 포함) |

**최단 경로 = 드롭다운 3번 → 자동 완성 → 기간·배송일 → "행사 만들기".**

## 범위 결정

| 항목 | 결정 | 확정일 |
|---|---|---|
| 화면 형태 | **단일 페이지·스텝 없음**(위저드/스테퍼 기각) | 07-20 |
| 행사명 생성 | **자동 조립 유지** — 연도+주최학회+행사구분 → 행사명·주문URL 자동 생성, 수동 수정 가능 | 07-20 |
| ③진행상태·④준비노트·⑤열람이력 | 이 화면에 **넣지 않는다.** 완료 후 착지하는 **상세 페이지(L2) 섹션** | 07-20 |
| 기존 행사 편집 | ~~1차 범위 밖·`EventFormDialog` 모달~~ → **L2 개요 인라인 편집으로 이관, EventFormDialog 폐기** | 07-28 |
| 편집 필수 게이트 | **편집도 4필수**(`isRequiredComplete`) — 운영 DB 11개 행사 전부 4필드 충족(null 0건, 마찰 없음) | 07-28 |
| 블록 구조 | **자동조립 + 필수를 「행사 정보」 한 블록으로 통합** | 07-28 |
| 점진 노출 | 3단계(자동조립 → 필수 → 선택), **직접입력 탈출구 필수** | 07-28 |
| 필수 필드 | **4개** — 행사명·주문URL·행사기간·**배송예정일** | 07-28 |
| 옵션 입력 | **주최학회·행사구분 모두 드롭다운 강제** + 메뉴 내 생성 항목 | 07-28 |

### 필수 승격 근거 (코드/서비스)
- **행사 기간**: `OrderPage.jsx:127`이 `end_date < today || start_date > today`로 판정. NULL이면 두 비교 모두 false → **주문 URL이 기간 제한 없이 열린다**(학회 종료 후 주문 유입 위험).
- **배송 예정일**: 이 서비스의 본질은 **모바일 주문서 → 학회 종료 후 배송**. 고객 주문 조회에 도착 예정일이 표시되므로 생성 시점에 반드시 받는다(건우님 2026-07-28).

## 학회 개선 트랙 2차 — 설치/철거 시간 · 장소 구조화 (건우님 2026-10-12 확정)

> 이 블록은 2026-10-12 "권장안대로" 일괄 승인분(`project_booth_event_flow_track`)이다. 형제 문서 = `A12_PrepNoteTemplates.md`.
> **공용 폼(`EventOptionalFields.jsx`) 수정이므로 생성 페이지·L2 개요 편집에 동시 반영된다**(두 화면 동일 — §8-1 룰 유지).

| 항목 | 결정 | 근거 |
|---|---|---|
| 설치 시간 · 철거 시간 | **선택 그룹에 2칸 추가, 자유 텍스트**(날짜·시간 피커 금지) | 현장 표현이 "당일 07:30 쯤" · "13시 이후" · "-"처럼 모호 → 피커로 받으면 입력 불가. 준비노트에서 개요로 승격(`A12 §3` 기본 템플릿에서 제외) |
| 문의처 · 진행 시간 | **칸으로 만들지 않음** — 준비노트에 둠 | 개요 과밀 방지. `A12` 기본 템플릿 "진행 정보"에 빈 칸으로 존치 |
| 장소 | **단일 `venue` 텍스트 → 장소명 + 주소(다음 우편번호) + 홀/층 상세 3입력으로 구조화** | 도로명+상세 통합 금지(프로젝트 규칙 · `CustomerInfoStep` 선례). 카카오 키 없이 `react-daum-postcode`(이미 의존성) 사용 |
| 좌표 | **저장 안 함** | 네이버 지도는 검색어(장소명+주소)로 넘김 — 좌표 불필요(필요 시 2차) |
| 기존 `venue` | **deprecated 존치** — 자동 변환 없이 `venue_name`으로 백필 복사, 운영자가 수정하며 정리(점진 정규화) | 지불증·라운드트립 폴백 유지. 일괄 파싱은 오류 위험 |

### 장소 보조 액션 (건우님 확정)
- [ ] **주소 복사** — 주소를 누르거나 복사 버튼 → 클립보드 복사. 복사 대상 = **`venue_address`만(도로명 주소만 — 홀·층 상세 `venue_detail` 결합 안 함, 건우님 2026-10-12).** `navigator.clipboard.writeText`(어드민 = Windows/Android HTTPS, `feedback_cross_platform_compat`).
- [ ] **지도(작은 "지도" 버튼)** — 검색어 = `장소명 + 주소`(`venue_name` + `venue_address`, trim). **네이버 지도 1종만** 웹 URL 새 탭(`https://map.naver.com/p/search/{encodeURIComponent(검색어)}`). 카카오맵·티맵 버튼 없음(주소 복사로 어느 지도 앱이든 붙여넣기 가능). 형태 = 아이콘 + 짧은 라벨 "지도"(text 버튼 수준, 담백).
  - **터치 기기에서만 노출(건우님 2026-10-12).** 판정 = 화면 너비 아닌 터치 입력(`useMediaQuery('(hover: none) and (pointer: coarse)')`) — 현장 태블릿·휴대폰 노출, 사무실 PC 숨김.
  - **읽기 화면(L2 개요)에만 둔다(권장안). 입력 폼(생성·편집)에는 지도 버튼을 두지 않고 복사 버튼만** — 입력 중에는 지도 불필요, 개요에서 현장 이동 시 사용.
  - 앱 딥링크(`nmap://search?query=...&appname=inpsytorder.vercel.app`)는 **범위 밖 — 실측 후 추가 검토**(PC·앱 미설치는 웹 폴백).

### 실측 후 확정 (구현 전 메인 Claude 검증)
- [ ] 네이버 웹 지도 최신 URL 형식(`https://map.naver.com/p/search/{검색어}`)이 Windows PC·Android 태블릿·iPad에서 올바른 결과를 여는지 실측.
- [ ] 앱 딥링크 스킴(`nmap://search?query=&appname=inpsytorder.vercel.app`) 동작·폴백 타이밍 실측. 실측 전까지는 **웹 URL 단일 경로**만 구현.

## 참조 파일

- **신규 컴포넌트:** `inpsyt-order-frontend/src/components/EventCreatePage.jsx`
- **공용 폼 컴포넌트(2026-07-28 추출):** `EventAutofillFields.jsx` · `EventRequiredFields.jsx` · `EventOptionalFields.jsx` — 생성 페이지·L2 편집이 공유
- 공용 slug 검사 훅: `inpsyt-order-frontend/src/hooks/useSlugCheck.js`
- 공용 순수 로직: `inpsyt-order-frontend/src/utils/eventForm.js` (+ `eventForm.test.js`)
- ~~기존 편집 폼: `EventFormDialog.jsx`~~ — **폐기(2026-07-28).** 편집은 L2 개요 인라인으로 이관, 공용 폼 컴포넌트 3종으로 이원화 부채 제거
- 진입점(L1): `EventManagementPage.jsx` — "새 학회 추가" 버튼
- 착지점·편집: `EventDetailPage.jsx`(L2 개요 인라인 편집)
- 학회 마스터 관리: `SocietyManagementDialog.jsx`(추가 = 학회명 + URL 태그 2필드)
- 주문 가능 판정: `OrderPage.jsx:127`
- 관련 API: `api/events.js`(`getSocieties`), `api/products.js`(`fetchProductCountByCategory`)
- 공용 UI: `components/ui/`(`PageHeader`, `SectionCard`, `DateField`)
- DB: `supabase/migrations/` — events 관련 전체, `20260602000000_add_department_to_user_profiles`
- 연관 사양: `A5_EventManagementPage.md`, `L2_EventDetail.md`, `A10_EventHubList.md`

## 공용 폼 컴포넌트 (생성=점진노출 / 편집=평면) — 2026-07-28

편집을 L2 개요 인라인으로 이관하면서 폼 이원화(EventFormDialog vs EventCreatePage) 부채를 제거했다. **EventCreatePage 버전을 정본**으로 3개 컴포넌트를 추출해 생성·편집이 같은 필드 렌더를 공유한다. 구 EventFormDialog 버전(Autocomplete freeSolo season·역할 secondary·타이핑 배송일)은 폐기.

| 컴포넌트 | props | 필드 | 생성 페이지 | L2 편집 |
|---|---|---|---|---|
| `EventAutofillFields` | `{ form, onChange, societies, onSocietyAdded, disabled }` | 연도 · 주최학회(드롭다운+`+ 새 학회 추가` 인라인) · 행사구분(드롭다운+`직접 입력`) | 1단계(점진 노출) | 평면 |
| `EventRequiredFields` | `{ form, onChange, slugState, originalSlug? }` | 행사명* · 주문URL*(하단 slug 상태) · 행사기간*(range) · 배송예정일*(`clickToOpen`) | 2단계(게이트) | 평면 |
| `EventOptionalFields` | `{ form, onChange, staff, categoryCounts }` | 판매대분류 · 할인율 · **설치 시간** · **철거 시간** · **장소(장소명·주소·홀/층 상세)** · 참가비용 · 참석자(`secondary=department`) · 비고 | 3단계(Collapse) | 평면 |

- **정본 규칙(EventCreatePage 버전):** 주최학회·행사구분 드롭다운 강제 · 참석자 secondary=부서명 · 참가비용 라벨 · 배송예정일 `DateField clickToOpen`.
- **점진 노출·manualMode·복귀 링크는 페이지(EventCreatePage)에 존치** — 컴포넌트는 필드 렌더만 담당. L2 편집은 3컴포넌트를 평면으로 나열(점진 노출 없음).
- **slug 검사 = `useSlugCheck(slug, { excludeId })`** 훅으로 이관(debounce 400ms·형식·예약·중복). 편집은 `excludeId=event.id`로 자기 slug '이미 사용중' 오탐 방지. `slugState.displayMsg{text,color}`를 `EventRequiredFields`가 하단 캡션으로 렌더.
- **`onSocietyAdded` 콜백** — 인라인 학회 추가(insert+검증)는 `EventAutofillFields`가 소유하되, `setSocieties`+`applyAutofill(fresh 목록)` 원자 처리는 **부모가 수행**(stale-closure slug 버그 방지). 추가만·삭제 없음.
- **`originalSlug`(편집만)**: 지정 + slug 변경 감지 시 비차단 경고 캡션 "주소를 바꾸면 배포된 QR·복사한 링크·즐겨찾기·자동이동(/go) 설정이 더 이상 열리지 않습니다." 생성은 미전달 → 경고 없음.

## 사용자 시나리오

인싸이트/와박팀 직원(`events:edit`)이 학회 일정이 확정되면 사무실 PC에서 새 행사를 등록한다. **연 8일 운영이라 드물게 하는 작업이고 손에 안 익는다** — "고민 없이 순서대로 따라가면 끝나는" 것이 핵심(타팀 이관 대비). 화면에 처음 보이는 건 드롭다운 3개뿐. 고르면 행사명·주문URL이 자동으로 채워지며 나타나고, 기간·배송예정일을 넣으면 선택 항목이 열린다. 지금 모르는 값은 비워두고 만든 뒤 상세에서 채운다.

## 화면 구조 — 2블록 · 3단계 점진 노출

```
[블록 1] 행사 정보
   1단계: 연도 · 주최 학회 · 행사 구분        (3열, 항상 표시)
          └ "행사명을 직접 입력할래요" 링크    ← 탈출구
   ↓ 3개를 모두 고르면(또는 탈출구 클릭) 열림
   2단계: 행사명 * · 주문 URL *               (2열)
          행사 기간 * · 배송 예정일 *          (2열)
   ↓ 필수 4개가 모두 유효하면 열림
[블록 2] 선택 항목 (8개 그룹)
   3단계: 판매 대분류 · 할인율                (2열)
          설치 시간 · 철거 시간                (2열, 자유 텍스트)
          장소 (전폭 그룹)                      ┐
            장소명                             │
            주소 (읽기전용 + 검색) → 복사·네이버 지도
            홀·층 상세                         ┘
          참가비용                             (좌 반폭)
          참석자                               (전폭)
          비고                                 (전폭)
[하단]  취소 · 행사 만들기                     (우측 정렬)
```

- [ ] **페이지 헤더** — 제목 "새 행사 만들기", 우측 보조 텍스트 "필수 4개만 채우면 완료"
- [ ] **블록 1 안내 한 줄** — "아래 3가지를 고르면 행사명이 자동으로 만들어집니다."
- [ ] **블록 이름은 「행사 정보」** — "필수 정보"로 부르지 말 것. 연도·주최학회·행사구분은 필수가 아니라(`*` 없음) 모순이 생긴다. 필수 표시는 `*`가 담당한다.
- [ ] 2열은 데스크톱 기준, 좁은 화면에서는 1열로 접힌다.

### 점진 노출 규칙 (핵심)

- [ ] **1→2단계 트리거**: 연도·주최학회·행사구분이 **모두 채워지면** 2단계가 열린다. **또는 "행사명을 직접 입력할래요" 링크**를 누르면 즉시 열린다.
- [ ] ★**탈출구 필수** — 링크가 없으면 (a) societies에 원하는 학회가 없을 때 (b) 자동조립을 안 쓰고 직접 치고 싶을 때 **화면에 갇힌다.** 목표("막힘 없이")와 정면 충돌하므로 생략 금지.
- [ ] **직접입력 경로에서 자동조립 3필드 숨김(2026-07-28 프리뷰 QA)**: "행사명을 직접 입력할래요"를 눌러 열린 경우(`manualMode`)엔 연도·주최학회·행사구분 3필드를 **숨긴다**(자동조립을 안 쓰므로 노이즈). 3필드를 모두 골라 **자동으로** 열린 경우엔 계속 보인다. 숨긴 자리에 **"자동으로 행사명 만들기"** 복귀 링크 제공(유일한 자동조립 경로 상실 방지).
- [ ] **2→3단계 트리거**: 필수 4개(행사명·주문URL·행사기간·배송예정일)가 모두 **유효**하면 선택 항목 블록이 열린다.
- [ ] **한 번 열린 단계는 다시 닫지 않는다.** 값을 지워도 접히면 안 됨(입력 중 화면이 사라지는 최악의 경험 방지).
- [ ] **접근성**: 노출되는 영역에 `aria-live="polite"` 또는 노출 직후 첫 필드로 포커스 이동. 스크린리더가 변화를 인지해야 한다.

## 입력 폼 구조 (분리/통합 절대 금지 · 입력 그룹 15개 누락 0)

> **입력 그룹 수(2026-10-12):** 자동조립 3 + 필수 4 + 선택 **8** = **15 그룹**. (2026-07-28까지는 선택 6 = 13 그룹. 설치 시간·철거 시간 2개 추가로 선택 6→8.)
> - 장소는 **1 그룹이지만 3 입력**(장소명·주소·홀/층 상세)으로 분리되어 DB 3컬럼으로 저장된다 — 통합 금지.
> - DB 저장 컬럼 수(FORM_FIELDS)는 별도: 14 → **19**(장소 3 + 설치/철거 2, 기존 `venue` 존치). 입력 그룹 수와 혼동 금지(§저장 처리 참조).

> 라벨·helperText·placeholder·검증은 `EventFormDialog.jsx` 원본에서 1:1 이관하되, 아래 개정분(순서·배치·라벨·강제)을 반영한다.

### 블록 1 · 1단계 — 자동 조립 (3필드, 순서 고정)

**순서: 연도 → 주최 학회 → 행사 구분** (2026-07-28 변경)

- [ ] **연도** (`event_year`) · `TextField select` · 옵션 = `현재년-1`부터 **5개 연도**(`2026년` 형식), 첫 항목 `연도 선택`(빈값) · 기본값 현재 연도
- [ ] **주최 학회** (`host_society`) · `TextField select` · **자유 입력 금지** · 옵션 = `societies.name` 목록 + 첫 항목 `학회 선택`(빈값)
  - **메뉴 맨 아래 `+ 새 학회 추가` 항목** → 학회명 + URL 태그 2필드 인라인 입력 → 저장 시 **societies 갱신 + 방금 만든 학회 자동 선택**. 검증은 `SocietyManagementDialog.handleAdd`와 동일(둘 다 필수, URL 태그 `/^[a-z0-9-]+$/`)
  - **삭제·목록 정리는 넣지 않는다** — 선택 위젯 안의 파괴적 액션은 오클릭 위험 + 결과(어느 행사가 쓰는지) 표시 불가. 정리는 기존 "학회 목록 관리"(L1) 소관
  - helperText "목록에 없으면 아래 '새 학회 추가'로 만들 수 있습니다."
- [ ] **행사 구분** (`event_season`) · `TextField select` · **자유 입력 금지**(2026-07-28 freeSolo 폐지) · 옵션 6종: `춘계학술대회` / `추계학술대회` / `연수강좌` / `보수교육` / `세미나` / `기타`
  - **메뉴 맨 아래 `직접 입력` 항목** → 선택 시 텍스트 필드가 나타나 임의 값 입력 가능(주최학회의 `+ 새 학회 추가`와 **같은 패턴**)
  - 직접 입력값의 `season_eng`는 `etc`(SEASON_SLUG_MAP 미매칭)
- [ ] **탈출구 링크**: "행사명을 직접 입력할래요" — 클릭 시 2단계 즉시 노출 + `manualMode` 진입(3필드 숨김). 복귀 링크 "자동으로 행사명 만들기"로 3필드 재노출

### 블록 1 · 2단계 — 필수 4필드 (2×2 배치)

**1행: 행사명 · 주문 URL / 2행: 행사 기간 · 배송 예정일** (2026-07-28 배치 확정)

- [ ] **행사명** (`name`) · text · **필수 `*`** · helperText "위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
- [ ] **주문 URL** (`order_url_slug`) · text · **필수 `*`** · helperText "주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
- [ ] **행사 기간** (`start_date` + `end_date`) · `DateField mode="range"` 2클릭 · **필수 `*`** · helperText "이 기간에만 주문 페이지가 열립니다." · `onChange({start,end})`를 두 컬럼으로 분해 저장(**DB 컬럼 구조 유지**) · range 캘린더가 `start ≤ end` 자동 정렬
- [ ] **배송 예정일** (`estimated_delivery_date`) · `DateField` single · **필수 `*`**(2026-07-28 승격) · helperText "학회 종료 후 발송 예정일입니다. 고객 주문 조회에 표시됩니다."
  - **`clickToOpen` 적용(2026-07-28 프리뷰 QA)**: 행사기간(range)과 동일하게 **필드 아무 곳 클릭**으로 캘린더가 열린다(readOnly·타이핑 미지원, range와 서식 일치). `DateField`에 opt-in prop(`clickToOpen`, 기본 `false`)로 추가해 나머지 4개 소비처(AuditLog·OrderManagement·PaymentReceipt·EventFormDialog)는 **타이핑 계속 지원**(무영향).

### 블록 2 · 3단계 — 선택 8그룹 (게이트 없음)

**배치(2026-10-12): 1행 판매 대분류 · 할인율 / 2행 설치 시간 · 철거 시간 / 3행 장소(전폭 그룹) / 4행 참가비용(좌 반폭) / 5행 참석자 / 6행 비고**

- [ ] **블록 헤더**: "선택 항목 8개"만 표시. (2026-07-28 프리뷰 QA로 **현재 값 요약 한 줄·보조 안내 문장 모두 제거** — 노이즈. 관련 계산 코드도 삭제해 죽은 코드 없음. 2026-10-12 설치/철거 추가로 6→8)
- [ ] **판매 대분류** (`visible_categories`) · **토글 칩 3종 고정**(`검사`/`도서`/`도구`) 멀티선택 · 선택 시 filled+primary, 비선택 outlined default
  - **빈 선택 = 전체 노출**(NULL과 동일 의미). helperText 분기:
    - 빈 선택: "선택하지 않으면 전체 상품이 노출됩니다."
    - 1개 이상: "선택한 대분류 상품만 이 행사의 주문서에 노출됩니다. 노출 대상: 검사 N개 · … (총 M개)"
  - 미리보기 = `fetchProductCountByCategory()` **실 집계**(가짜 통계 금지), 진입 시 1회
  - **소분류는 고르지 않는다** — 대분류가 하위를 자동 포함
- [ ] **할인율 (%)** (`discount_rate`) · number(step 1, min 0, max 100) · helperText "예: 15 = 15% 할인" · **UI 0~100 정수 ↔ DB `/100` 소수**
  - ★**운영버그 방지(2026-07-28)**: `percentToRate`에 **0~100 클램프** — 100% 초과 입력 시 `discount_rate>1`로 저장돼 주문가가 음수가 됨(실 DB에 `1.11` 행사 존재). 공용 유틸이라 생성 페이지·편집 모달 양쪽 동시 해결.
  - `rateToPercent`(표시)는 **클램프하지 않음** — 기존 이상값(1.11→111%)이 그대로 보여야 운영자가 인지·수정 가능.
- [ ] **설치 시간** (`setup_time`) · text(자유 입력, 피커 금지) · placeholder "예: 4/15(수) 21시~23시, 당일 07:30 쯤" · helperText "날짜·시간을 자유롭게 적으세요(모호한 표현도 OK)."
- [ ] **철거 시간** (`teardown_time`) · text(자유 입력, 피커 금지) · placeholder "예: 둘째 날 13시 이후, 종료 직후" · (2026-10-12 신규)

- [ ] **장소** — 단일 입력이 아니라 **3입력 그룹**(전폭). 도로명+상세 통합 금지(`CustomerInfoStep` 주소 분리 선례와 동일 원칙).
  - [ ] **장소명** (`venue_name`) · text · `PlaceIcon` 시작 어드먼트 · placeholder "예) 서울 코엑스 / 그랜드볼룸"
  - [ ] **주소** (`venue_address`) · text **읽기전용**(`readOnly`) · 클릭 또는 끝 **"검색" 버튼** → 다음 우편번호 모달(`react-daum-postcode` — `CustomerInfoStep`의 `DaumPostcode` 모달 idiom 재사용). `SearchIcon` 시작 어드먼트.
    - **onComplete(data) 매핑:** `data.roadAddress` → `venue_address`. `data.buildingName` → `venue_name`(**`venue_name`이 비어 있을 때만** 자동 채움, 수동 입력값 보존). **`data.zonecode`(우편번호)는 저장하지 않는다**(배송지 아님 — 좌표·우편번호 불필요).
    - 입력 폼 보조 액션 = **[주소 복사]**(도로명 `venue_address`만 클립보드)만 둔다. **지도 버튼은 입력 폼에 두지 않음**(읽기 화면=L2 개요에만, 터치 기기 전용 — §학회 개선 트랙 2차 "장소 보조 액션" / `L2_EventDetail.md §5-1`).
    - 주소 미입력 시 복사 비활성(또는 미노출).
  - [ ] **홀·층 상세** (`venue_detail`) · text(자유 입력) · placeholder "예) 3층 그랜드볼룸 A홀, 부스 B-12"
- [ ] **참가비용** (`marketing_cost`) · **라벨 "참가비용"**(2026-07-28 "비용"에서 변경) · text(천 단위 콤마 자동, 숫자만) · 끝 어드먼트 "원" · 값 > 0이면 하단에 한글 금액 보조 표기(`numberToKoreanCurrency`)
- [ ] **참석자** (`attendee_ids`, uuid[]) · `Autocomplete multiple` + `disableCloseOnSelect` · 후보 = `user_profiles` role IN (`master`,`onsite`)
  - **옵션 행 = 체크박스 + 이름(primary) + `department`(secondary)** — 2026-07-28 **역할(마스터/현장 마케팅) 대신 소속 부서명** 표기(실값: 마케팅운영팀 · 마케팅팀 · 와이즈박스팀)
  - ⚠ 현재 staff 쿼리(`EventManagementPage.jsx:213`)가 `id, name, role, position`만 select → **`department` 추가 필요**
  - 선택값은 outlined 칩 · helperText "현장 마케팅 · 마스터 중 선택"
- [ ] **비고** (`note`) · multiline `minRows=2` · placeholder "부스 위치, 진열 메모 등"

## 즉시 검증 (저장 시 몰아서 실패 금지)

- [ ] **주문 URL 형식**: `/^[a-z0-9-]+$/` 위반 시 필드 하단 즉시 에러 — "고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."
- [ ] **주문 URL 중복**: 입력 **debounce(~400ms) 자동 조회**(`.maybeSingle()`), `cancelled` 플래그로 경합 취소. 상태 표시: "확인 중" / "사용 가능한 주소입니다" / "이미 사용중인 고유 주소입니다" / "중복 검사 실패: {메시지}"(저장차단·재시도)
- [ ] **예약 slug `new` 차단** — `/admin/events/new`가 생성 라우트라 L2 접근 불가해짐
- [ ] **행사명·행사기간·배송예정일 미입력** → 각 필드 하단 안내
- [ ] **"행사 만들기" 버튼**: 필수 4개 유효 + slug 중복 아님 + 중복검사 진행중 아닐 때만 활성. **비활성 사유를 노출**(숨김 금지)

## 자동 채우기 규칙 (원본 로직 보존)

- [ ] `event_year` + `host_society` + `event_season`이 **모두 채워지면**:
  - `!_nameTouched`인 경우에만 → `name = "{연도} {주최학회} {행사구분}"`
  - `order_url_slug = "{society.slug_prefix}-{연도}-{season_eng}-{랜덤4자리}"`
  - `season_eng`: 춘계학술대회→`spring` / 추계학술대회→`fall` / 연수강좌→`training` / 보수교육→`edu` / 세미나→`seminar` / 기타·직접입력→`etc`
- [ ] 행사명 **직접 수정 시 `_nameTouched`** → 이후 자동완성이 덮어쓰지 않음. **UI 전용, DB upsert 제외**
- [ ] 행사명 직접 입력 + 주문 URL이 비어 있으면 → `nameToSlug(name)`

## 라우트·진입점·이탈

- [ ] **라우트 `/admin/events/new`**, `events:edit` 없으면 접근 차단(직접 URL 포함)
- [ ] **진입**: L1 "새 학회 추가" 버튼 → 이 페이지로 네비게이트
- [ ] **취소** → L1 목록 복귀
- [ ] **DB draft 행 생성 금지** — `status` 컬럼을 임시저장으로 오용 금지
- [ ] **완료 착지**: insert 성공 → `/admin/events/{order_url_slug}`(L2). 여기서 ③④⑤로 이어진다

### 저장 처리 (원본 정규화 1:1 보존)

- [ ] upsert 대상 = **`FORM_FIELDS` 19개만**(14 → 19: `setup_time`·`teardown_time`·`venue_name`·`venue_address`·`venue_detail` 추가, 기존 `venue` 존치). `created_by`·`_nameTouched` 미전송
- [ ] `attendee_ids`·`visible_categories` 배열 보장(**빈 배열 그대로 저장** = 전체 노출)
- [ ] `marketing_cost` `''`/null → null, 그 외 `Number()`
- [ ] **신규 5텍스트 컬럼은 기존 `venue`와 동일 pass-through** — 별도 null 정규화 없이 그대로 저장(빈 문자열 허용). `estimated_delivery_date`는 필수라 항상 값 존재. 날짜 빈값 → null 정규화 로직은 유지
- [ ] 저장 실패 시 토스트 + **화면 유지**(입력값 유실 금지)

### ★회귀 점검 체크리스트 (2026-06-25 사고 재발 방지 — 핵심)

> 2026-06-25: `select`에서 컬럼이 빠져 있어, 운영자가 다른 필드만 고쳐 저장해도 `form.<컬럼>===undefined`→빈값으로 덮어써져 **기존 값이 날아간 사고.** 신규 5컬럼을 **FORM_FIELDS·emptyEvent·모든 select에 전부** 넣지 않으면 동일 사고 재발. 5컬럼이 한 곳이라도 빠지면 라운드트립에서 소거된다.

- [ ] **`eventForm.js` `FORM_FIELDS`** — `setup_time`·`teardown_time`·`venue_name`·`venue_address`·`venue_detail` 추가(+ `venue` 유지).
- [ ] **`eventForm.js` `emptyEvent()`** — 5컬럼 기본값 `''` 추가(+ `venue: ''` 유지).
- [ ] **`api/events.js` `EVENT_DETAIL_COLUMNS`**(L2 단건 fetch) — 5컬럼 추가(+ `venue` 유지).
- [ ] **목록 select**(`EventManagementPage.jsx` L1 목록 fetch) — 장소 컬럼 표기에 쓰는 값 포함(아래 A10 반영 요청과 연동). 편집 라운드트립이 목록 데이터로 초기화되는 경로가 있으면 5컬럼 필수.
- [ ] **`EventOptionalFields.jsx`** — 설치/철거 입력 2칸 + 장소 3입력(장소명·주소검색·홀/층 상세) 위젯 추가. 다음 우편번호 모달 연결.
- [ ] **`PaymentReceiptModal.jsx`**(L491~495 장소 표기) — `event?.venue` 직참조를 **`[venue_name, venue_detail].filter(Boolean).join(' ') || venue`** 합성으로 교체(신규 저장분은 합성, 레거시는 `venue` 폴백).

## 권한별 차이

- `events:edit` 없음 → 접근 불가(L1 버튼도 미노출)
- `events:edit`(editor) / `master` → 생성 가능(차이 없음)

## 데이터 모델

### `events` (INSERT 컬럼)
- `name`(text) **필수** / `order_url_slug`(text, UNIQUE) **필수**
- `start_date`·`end_date`(date) **필수** — 주문 페이지 개방 기간
- `estimated_delivery_date`(date) **필수** — 학회 후 발송 예정일
- `event_year`(int) / `host_society`(text) / `event_season`(text) — 행사명 조립 소스
- `discount_rate`(numeric, 0~1) / `attendee_ids`(uuid[]) / `note`(text) / `marketing_cost`(int)
- `visible_categories`(text[]) — NULL/빈 배열 = 전체 노출
- **장소·시간 (2026-10-12 신규 5컬럼, CTO 계약 — 이름·타입 변경 금지):**
  - `setup_time`(text) · `teardown_time`(text) — 자유 텍스트
  - `venue_name`(text) · `venue_address`(text) · `venue_detail`(text) — 장소 3분리
  - **신규 5컬럼은 anon 비노출(어드민 전용)** — 고객 주문 페이지에 노출 금지(RLS/컬럼 정책, backend).
- `venue`(text) — **deprecated 존치**(지불증·라운드트립 폴백). 신규 입력 UI 없음(장소명·주소·상세가 대체). 저장 payload엔 계속 포함(기존 값 보존·오염 방지).
- `created_by` 미전송(DB default) · `status` 미전송

### 기존 `venue` → `venue_name` 백필 · 편집 표시
- [ ] **일괄 백필(backend/마이그레이션):** `UPDATE events SET venue_name = venue WHERE venue_name IS NULL AND venue IS NOT NULL` — 자동 파싱 없이 통째로 복사(점진 정규화). 주소·상세는 빈 상태로 둠.
- [ ] **편집 화면(L2 개요 편집)에서 기존 학회:** `venue_name`에 백필된 옛 `venue` 텍스트가 보이고, **주소·홀/층 상세는 비어 있다.** 운영자가 이때 주소 검색으로 정리(점진). 혼란 방지 helperText 1줄(선택): "예전 장소 정보가 장소명에 들어가 있어요. 주소 검색으로 정리할 수 있습니다."

### 참조
- `societies`(`id`,`name`,`slug_prefix`) — 주최 학회 옵션 + slug 접두어 + **인라인 추가 대상**
- `user_profiles`(role IN `master`,`onsite`, **`department` 포함**) — 참석자 후보
- `products` — 판매 대분류 실 집계

## 빈 상태·로딩·오류

- [ ] societies·staff·카테고리 카운트 로딩 중 → 해당 필드 비활성/스켈레톤. 실패해도 생성 진행 가능
- [ ] **societies 비어 있음** → 드롭다운의 `+ 새 학회 추가`로 즉시 해결 가능(별도 안내 불필요하나 helperText 유지)
- [ ] 중복 검사 실패 → 필드 하단 표시 + 저장 차단, 재시도 가능
- [ ] 저장 실패 → 토스트 + 입력값 보존

## 핵심 발견 (시안·구현 검수 시 반드시 확인)

1. **스텝·스테퍼 금지.** 건우님 명시 기각. 단일 화면 + 점진 노출이다.
2. **입력 그룹 15개 누락 0(2026-10-12).** 자동조립 3 + 필수 4 + 선택 8 = 15. (2026-07-28까지 13 = 선택 6.) 축소가 아니라 재배치 + 설치/철거 2칸 + 장소 구조화.
3. ★**직접입력 탈출구 없으면 갇힌다.** 자동조립 3필드를 안 쓰는 경로가 반드시 있어야 한다.
4. **한 번 열린 단계는 닫지 않는다.** 값 지웠다고 접히면 최악.
5. **블록 이름은 「행사 정보」.** "필수 정보"라 하면 자동조립 3필드가 필수로 오인된다.
6. **`_nameTouched` 잠금 보존.** DB에 보내지 않는다.
7. **행사 기간·배송 예정일 모두 필수.** 기간은 무기한 개방 방지(`OrderPage.jsx:127`), 배송일은 서비스 본질(학회 후 배송).
8. **주최학회·행사구분 모두 드롭다운 강제.** 자유 입력 금지. 대신 각 메뉴 맨 아래 `+ 새 학회 추가` / `직접 입력`으로 **같은 패턴** 제공.
9. **학회 인라인은 "추가"만.** 삭제·정리는 L1 "학회 목록 관리" 소관 — 선택 위젯 안 파괴적 액션 금지.
10. **참석자 secondary = 부서명**(역할 아님). staff 쿼리에 `department` 추가 필요.
11. **참가비용** 라벨(구 "비용").
12. **접힌 선택 영역 헤더는 "선택 항목 6개"만** — 현재 값 요약·보조 안내는 프리뷰 QA로 제거(2026-07-28, 관련 계산 코드 삭제).
13. **판매 대분류 빈 선택 = 전체 노출**("0개 노출" 아님). 미지정 컬럼 빈배열 덮어쓰기 회귀 주의(2026-06-25 전례).
14. **할인율 단위 변환(UI % ↔ DB 소수)** 표기 누락 금지. **`percentToRate` 0~100 클램프**(100% 초과 → 주문가 음수 운영버그), `rateToPercent`는 클램프 안 함(이상값 노출).
15. **완료 후 L2 착지가 설계의 일부.** ③④⑤로 이어진다.
16. ~~편집 모달은 1차에서 그대로 산다~~ → **2026-07-28 갱신: 편집을 L2 개요 인라인으로 이관, `EventFormDialog` 폐기.** 생성·편집이 공용 폼 컴포넌트 3종+`useSlugCheck`를 공유(정본=생성 페이지). 편집도 4필수 게이트.
17. **장소 = 3입력 분리 저장(2026-10-12).** 장소명·주소·홀/층 상세를 한 줄로 통합 금지(도로명+상세 통합 금지 프로젝트 규칙 · `CustomerInfoStep` 선례). 카카오 키 없이 `react-daum-postcode`. 우편번호·좌표 미저장. 기존 `venue`는 deprecated 존치 + `venue_name` 백필.
18. ★**신규 5컬럼 라운드트립 소거 주의(2026-10-12).** `FORM_FIELDS`·`emptyEvent`·`EVENT_DETAIL_COLUMNS`·목록 select·`EventOptionalFields`·`PaymentReceiptModal` 6지점 전부 반영(§회귀 점검 체크리스트). 한 곳이라도 빠지면 2026-06-25 사고(저장 시 값 소거) 재발.
19. **설치/철거 = 자유 텍스트(피커 금지).** "07:30 쯤" 같은 모호 표현 수용이 요구사항. 날짜/시간 피커로 받으면 입력 불가.

## 알려진 이슈 (이번 범위 밖 · 별도 트랙)

- **삭제된 학회를 쓰던 기존 행사 편집 시 주최학회가 빈칸으로 표시된다.** `events.host_society`는 text이고 societies는 별도 테이블이라, 학회를 목록에서 지우면 Select가 매칭 실패 → 값이 사라진 것처럼 보이고 저장 시 실제로 날아갈 수 있다. 현행 편집 모달의 기존 문제.

## 연관 시트 갱신

- `A5_EventManagementPage.md` — 진입점 모달→`/admin/events/new`. §Step1 컨트롤 타입 정정. **행사구분 freeSolo 폐지(드롭다운+직접입력) 반영**
- `L2_EventDetail.md` — 생성 완료 착지점 명시 · **(2026-10-12) §5 개요 읽기 요약/편집에 설치시간·철거시간·장소 3분리(장소명·주소·홀/층 상세) 반영** — 공용 `EventOptionalFields` 수정이 L2 편집에 자동 전파. 개요 읽기 요약(§5-1)의 "장소" 행은 `venue_name`(+ `venue_detail`) 표기 + 설치/철거 행 추가 필요.
- `A10_EventHubList.md` — §8 "등록/수정=모달" → "등록=전용 페이지, 수정=모달" · **(2026-10-12) §2 L1 "장소" 컬럼 출처 `venue` → `venue_name || venue`(폴백), 목록 select에 신규 5컬럼 포함**(라운드트립 소거 방지). ※ A10·L2는 병렬 작업자 소관 — 본 문서 보고서의 "L2·A10 반영 요청" 참조.

## 변경 이력

- **2026-10-12 학회 개선 트랙 2차(설치/철거 시간 · 장소 구조화)** — 선택 블록에 **설치 시간·철거 시간 2칸(자유 텍스트, 피커 금지)** 추가(6→8 그룹, 13→15). **장소 단일 `venue` → 장소명(`venue_name`)·주소(`venue_address`, `react-daum-postcode`)·홀/층 상세(`venue_detail`) 3입력 분리.** 주소 복사·네이버 지도(웹 URL) 보조 액션. 좌표·우편번호 미저장. DB 5컬럼 추가(CTO 계약), 기존 `venue` deprecated 존치 + `venue_name` 백필(점진 정규화). `FORM_FIELDS` 14→19. **공용 `EventOptionalFields` 수정이라 생성·L2 편집 동시 반영.** ★회귀 점검 체크리스트(6지점) 신설 — 2026-06-25 값 소거 사고 재발 방지. 네이버 지도 딥링크는 "실측 후 확정". 형제 문서 `A12_PrepNoteTemplates.md`. 건우님 "권장안대로" 승인(`project_booth_event_flow_track`).
- **2026-07-28 편집 이관·공용 폼 추출** — 편집을 `EventFormDialog` 모달에서 **L2 개요 인라인 편집 모드**로 이관, 다이얼로그 폐기(파일 삭제). 폼 이원화 부채 제거: `EventAutofillFields`·`EventRequiredFields`·`EventOptionalFields` 3종 추출(생성=점진노출 / 편집=평면 공유, **EventCreatePage 버전이 정본**). slug 검사 = `useSlugCheck` 훅(`excludeId` 편집 지원). 편집도 4필수 게이트(운영 DB 마찰 0). L1 ⋯메뉴 "수정"→`/admin/events/{slug}?edit=1`(항목 제거 아님, 진입 시 개요 편집 자동 진입+스크롤·param 스트립). slug 변경 비차단 경고 캡션. 삭제(주문건수 확인+확인 다이얼로그)를 L2 편집 푸터로 이식. **backend 무변경.** 생성 페이지는 순수 리팩터(동작·화면 불변).
- **2026-07-28 프리뷰 QA 5건** — ①직접입력(`manualMode`) 시 자동조립 3필드 숨김 + "자동으로 행사명 만들기" 복귀 링크 ②배송예정일 `DateField clickToOpen`(필드 클릭으로 캘린더, 다른 4개 소비처 무영향) ③선택 블록 현재값 요약 한 줄 제거(계산 코드 포함) ④선택 블록 보조 안내 문장 제거 ⑤★`percentToRate` 0~100 클램프(100% 초과 → 주문가 음수 운영버그, 공용 유틸이라 생성·편집 동시 해결). 필드 13개·정보 구조 불변.
- **2026-07-28 개정(UX 검토 8건)** — ①자동조립 순서 연도·주최학회·행사구분 ②점진 노출 3단계 + 직접입력 탈출구 ③필수 2×2 배치(행사명·주문URL / 행사기간·배송예정일) ④선택은 필수 충족 후 노출 ⑤선택 배치(판매분류·할인율 한 행)·"비용"→"참가비용"·참석자 secondary를 역할→**부서명** ⑥자동조립을 「행사 정보」 블록으로 **통합**(점진 노출과 블록 경계가 충돌하지 않게) ⑦**배송예정일 필수 승격**(서비스 본질=학회 후 배송) ⑧**주최학회·행사구분 드롭다운 강제** + 메뉴 내 `+ 새 학회 추가`/`직접 입력`. 학회 인라인은 추가만(삭제 제외 — 선택 위젯 내 파괴적 액션 회피). 필드 13개 유지.
- 2026-07-20 신설 — 모달 13필드 → 단일 페이지 전환 확정(위저드 기각). 행사기간 필수 승격, 즉시 인라인 검증, ③④⑤는 L2 유지, 편집은 범위 밖.
