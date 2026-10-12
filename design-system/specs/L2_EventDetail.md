# L2 — 학회 통합 상세 (Event Detail) · P0

> 비전: **"학회 운영 OS — 한 학회의 모든 것이 한 페이지에."**
> L1 연간 목록(`A10_EventHubList.md`) → **L2 학회 통합 상세(이 문서)** → L3 연차 자산(비-P0)
> 상태: **1차+2차 구현 완료(2026-10-12, frontend-engineer)** — 진행상태 6단계 흐름 재구성 + 2차(개요 설치·철거 시간·장소 3분리 읽기 표시·주소 1탭 복사·지도 버튼·준비노트 "템플릿으로 시작")를 실 페이지(`EventDetailPage.jsx`)에 반영. **2차는 DB 5컬럼 + `prep_note_templates` SQL 적용 후 라이브 확인 대기**(전제 = "SQL 적용 → 프론트 배포" 순서, 런타임 폴백 미구현 — select에 신규 컬럼이 있어 DB 미적용이면 PostgREST 42703으로 상세·목록이 깨짐).
>
> **✅ 2026-10-12 재구성 1차 구현 완료.** 시안 `EventDetailFlowPreview.jsx`(`/preview/event-detail-flow`)의 레이아웃을 실 페이지(`EventDetailPage.jsx`)에 반영했다. §3·§4·§5·§6·§9·§9b는 현재 실 페이지 구조와 일치한다. 반영: 상단 진행 요약 바(6단계·앵커 스크롤·②③④ 행 ~1.6초 강조) · 카드 4개(학회 개요 / 상신·신청 체크 행 3개 / 참석준비 / 사후 업무) · 헤더 액션 "학회 정보 수정" 1개 · 개요 "주문서" 행(열기·복사·QR) · 매출 지결 게이트 제거(항상 표시) · 출고 현황(§9b) 신설 · 입금결의서·지불증은 사후 업무 "문서 내보내기"로 이동 · 열람 이력 모바일 행 레이아웃. **2차 블록(§5 설치/철거·장소 상세)과 시안의 "2차 예정" 블록·태그·"템플릿으로 시작"·"터치 기기 보기" 토글·시나리오 칩은 실 페이지에서 제외**(DB 미적용·시안 전용).
> - 재구성 핵심(건우님 2026-10-12 "권장안대로" 승인 · `project_booth_event_flow_track`): ① 페이지 뼈대 = 진행상태 6단계 흐름 + 상단 진행 요약 바 ② 매출 요약은 지결 연동 해제·항상 표시 ③ 헤더 액션은 "학회 정보 수정"만(입금결의서·지불증은 사후 업무로 이동) ④ 개요에 "주문서" 행 신설 ⑤ 출고 현황(처리 완료 건수) 신설 ⑥ 2차(DB 변경): 설치·철거 시간·장소 분리·준비노트 템플릿.
>
> (구) 실구현 기준: 시안 v2 + 건우님 결정(준비물 위젯 + 학회자료 섹션 → **통합 Toast UI 에디터 1칸**으로 대체). 백엔드(prep_note·event-images 버킷) 적용 완료. 이미지 업로드는 Storage 버킷 적용 후 라이브 QA.

> **실구현 단일 진실 소스:** `src/components/EventDetailPage.jsx` · 라우트 `/admin/events/:slug`(AdminLayout `EventsRoute` 분기 — slug 있으면 L2, 없으면 L1 목록). export default.
> - 톤·헬퍼·할인율 칩·시간상태 배지·참석자 칩 = `EventManagementPage.jsx`(실 L1) 정합.
> - 매출 = `src/utils/revenueByCategory.js`(`computeRevenueByCategory`, paid만) — 대시보드 hero 축약.
> - 현장 보고 = `src/components/FieldReportSection.jsx`(DashboardPage에서 추출 — 양쪽 공용, 1차 plain text).
> - 단건 fetch·진행상태·노트 저장·매출 주문 = `src/api/events.js`(`getEventBySlug`/`updateEventProgress`/`updateEventPrepNote`/`getOrdersForEventRevenue`).
> - **출고 현황 집계 = `src/utils/fulfillmentCounts.js`(2026-10-12 신설, 공용)** — `getFulfillmentOrders({eventId, statuses:['paid','completed']})` + `groupLinkedOrders` 결과를 받아 `{total, completed, pending}` 반환. 출고 관리(`FulfillmentPage.jsx`)도 동일 util로 교체(동치). 단위테스트 `fulfillmentCounts.test.js`(7건).
> - **주문서 URL·QR = `src/utils/eventUrl.js`(buildOrderUrl/copyToClipboard(execCommand 폴백)/generateOrderQrSvg/downloadQrSvg) + `src/components/EventQrDialog.jsx`(2026-10-12 신설, 공용)** — 목록(A10)·상세(L2) 공유.
> - 통합 에디터 = `src/components/PrepNoteEditor.jsx`(Toast UI Editor) / 읽기 = `PrepNoteViewer.jsx`(Toast UI Viewer). **React.lazy 지연 로드**(초기/공개 번들 0 영향).
>
> **시안(폐기 예정):** `src/components/EventDetailPreview.jsx`(`/preview/event-detail`) — 준비물 위젯·학회자료 자리는 실구현에서 통합 에디터로 대체됨. 시안의 §7·§8 영역은 실구현과 불일치(참고용으로만).

## 1. 개요·목표
- A10 L1 표의 행 본문 클릭 → 이 화면 진입(현재 A10은 toast 스텁). 잘못된 slug → EmptyState "학회를 찾을 수 없어요".
- 목표: ① 한 학회의 운영 정보(개요)·진행상태·매출·현장 보고를 한 페이지에 집결 ② 5곳에 분산되어 있던 정보의 통합 진입점 제공.
- 데이터 단위: `events` 1행 + 해당 event의 `orders`(매출) + `field_reports`(현장 보고).

## 2. 라우트·진입
- 라우트: `/admin/events/:slug` (slug = `events.url_slug`).
- 진입: A10 L1 표 행 본문 클릭(⋯ 메뉴는 stopPropagation). 권한 `events:view`.
- **생성 완료 착지점(2026-07-20):** 전용 생성 페이지 `/admin/events/new`(`A11_EventCreatePage.md`)에서 insert 성공 시 `navigate('/admin/events/{새 slug}')`로 이 화면에 착지한다. **여기서부터 ③진행 상태·④준비 노트·⑤열람 이력으로 이어진다**(생성 화면은 필수 3+선택 7만 받고, 진행상태·노트·열람이력은 이 상세에서 채우는 설계). 예약 slug `new`는 생성 페이지가 차단하므로 L2 slug와 충돌하지 않는다.
- 잘못된/없는 slug: EmptyState "학회를 찾을 수 없어요" + "학회 목록으로" 액션.

## 3. 레이아웃 골격 — 진행상태 6단계 흐름 (2026-10-12 재구성 · 시안 단계)

> **뼈대 = 학회가 진행되는 순서 그대로.** 상단에 **진행 요약 바**(읽기 전용 네비, 6단계 유지) + 아래에 세로 `SectionCard` **4섹션**. ②③④(상신·신청 3단계)는 **한 카드로 합침**(건우님 2026-10-12). 요약 바의 ②③④ 어느 것을 눌러도 그 "상신·신청" 카드로 **앵커 스크롤** + 해당 체크 행 잠깐 강조(순서 강제·잠금 아님).

| 구역 | 섹션(카드) | 컴포넌트 | 완료 개념 |
|---|------|----------|---|
| — | 뒤로(학회 목록) | text Button + ArrowBack → `/admin/events` | — |
| — | PageHeader | title=학회명 / subtitle=행사명·날짜(요일) + 직하 상태배지·할인율 칩 / **우상단 액션 없음**(개요 편집은 개요 카드 "편집", 2026-10-12) | — |
| — | **진행 요약 바** | **6단계** 한 줄 네비(`SummaryBar`, 섹션 축약과 무관하게 흐름 6단계 유지) + "상신 3단계 중 N단계 완료" 캡션. 클릭 → 앵커 스크롤 | 읽기 전용 |
| 개요 | **학회 개요** | `SectionCard` "학회 개요" + 개요 행(`OverviewRow`) + **주문서 행(신규)** + 2차 블록(설치/철거·장소 분리) | 없음 |
| 상신·신청(②③④) | **상신·신청** | `SectionCard` "상신·신청" + **완료 체크 행 3개**(`ProgressCheckRow`): 기안서 상신(`draft_done`) · 학회 참석 신청(`application_done`) · 부스 참가비 지출결의서 상신(`payment_resolution_done`) | 있음(행별 토글) |
| 참석준비(⑤) | **참석준비** | `SectionCard` "참석준비" + 준비 노트(통합 Toast UI 에디터/뷰어) · "편집" · **"템플릿으로 시작"(2차)** | 없음 |
| 사후 업무(⑥) | **사후 업무** | `SectionCard` "사후 업무" — 하위 4블록: **매출 요약 · 출고 현황 · 현장 보고 · 문서 내보내기(입금결의서·지불증)** | 없음 |
| — | 열람 이력 | `SectionCard` "열람 이력"(master만, **흐름 밖 맨 아래**) | — |

> **섹션 번호 정리(2026-10-12):** ②③④를 한 카드로 합치면서 **카드 제목에서 번호를 뺐다**(개요/상신·신청/참석준비/사후 업무 = 이름만). 흐름 순번(1~6)은 **진행 요약 바가 단독으로** 가진다 — 카드 번호(4개)와 요약 바 번호(6개)가 어긋나 혼란 주는 것 방지. 요약 바 번호와 섹션 이름이 1:다로 연결(②③④ → "상신·신청" 카드).

### 6단계 ↔ 데이터 매핑
| 요약 바 단계 | 표시 라벨(신규) | 완료 컬럼(불변) | 카드 |
|---|---|---|---|
| ① | 개요 | — | 학회 개요 |
| ② | 기안서 상신(바 축약 "기안서") | `draft_done` | 상신·신청(1행) |
| ③ | 학회 참석 신청(바 축약 "참석 신청") | `application_done` | 상신·신청(2행) |
| ④ | 부스 참가비 지출결의서 상신(바 축약 "지출결의서") | `payment_resolution_done` | 상신·신청(3행) |
| ⑤ | 참석준비 | — | 참석준비 |
| ⑥ | 사후 업무 | — | 사후 업무 |

> **완료 판정:** 완료 상태를 가지는 단계는 **②③④뿐**(기존 boolean 토글, "상신·신청" 카드의 3행). ①⑤⑥은 완료 개념 없이 섹션 + 앵커만. **순서 강제(잠금) 없음** — 어떤 행이든 독립적으로 완료 표시. 완료자·완료 시각은 **화면에 표시하지 않는다.**
> **단일 컬럼.** 어드민 데이터 밀도 원칙(01)이되 한 학회 = 한 스토리이므로 세로 누적. **장식형 스테퍼·그라데이션·의미 없는 컬러바·좌우 인디케이터·가짜 통계 없음(룰 E).** 진행 요약 바는 "네비게이션"이지 진행률 바가 아니다(연결선·채움 게이지 금지).
> **⑥ 사후 업무 = 1개 카드 안의 4블록.** "카드 안 카드 금지"(03) 유지 — 하위 블록은 중첩 `SectionCard`가 아니라 **라벨 + 구분선(borderTop gray-100)**으로 구획한다.
> 날짜는 헤더·개요 모두 `YYYY.MM.DD(요일)` 표기.

### 진행 요약 바 반응형 (디자이너 확정 — 2026-10-12: 모바일 가로 스크롤 금지)
> **건우님 모바일 원칙: "모바일은 작성·편집보다 확인(Read)에 가깝다. 스크롤·넘기기 같은 액션 없이 현황을 파악할 수 있어야 한다."** 따라서 요약 바는 **모든 폭에서 6단계를 한 화면 안에** 보인다(가로 스크롤·추가 제스처 금지).
- **PC(≥900) / 태블릿 세로 820(sm 600~899):** 6단계 한 줄, 각 탭 `flex:1` 균등 분할. 탭 = 원(번호/체크) + **전체 라벨**(가로 배치).
- **모바일 375(xs):** **6칸 균등 한 줄 유지(가로 스크롤 없음).** 탭을 세로 배치(원 위 + **짧은 라벨** 아래: 개요/기안/신청/지출/준비/사후)로 폭을 줄이고 높이 44px 터치는 보존. `flexWrap:nowrap`, `overflowX` 없음.
- 탭 지시자: ②③④ = 체크 원(완료=brand 채움+체크 / 미완=빈 테두리+번호), ①⑤⑥ = 중립 번호 원.

> **변경 이력(섹션 구조):**
> - 2026-10-12(검수 반영) — **②③④를 "상신·신청" 한 카드(체크 행 3개)로 합침** · 카드 제목에서 번호 제거(요약 바가 순번 단독 보유) · **진행 요약 바 모바일 가로 스크롤 폐지(6칸 균등 한 줄, 짧은 라벨)** · 출고 현황 3칸→2칸.
> - 2026-10-12 — **진행상태 6단계 흐름으로 재구성(시안 단계).** 기존 6섹션(개요→진행→준비→현장보고→매출) → 흐름. 진행상태 3칩을 체크 행으로, 매출·현장보고·문서를 ⑥ 사후 업무로 통합. 상단 진행 요약 바 신설.
> - 2026-06-08 — 시안의 "준비물 체크리스트"+"학회 자료" 2섹션 → **통합 Toast UI 에디터 1칸**으로 대체(준비물=task 체크박스, 이미지=본문 삽입).

## 4. PageHeader (블록 1)
- [ ] title = `events.host_society` (학회명).
- [ ] subtitle = `events.event_season`(행사명) · `start_date ~ end_date` **+요일** (tnum). 단일일 = `2026.06.07(토)`, 기간 = `2026.06.07(토) ~ 06.09(월)`(같은 연도면 종료부 YYYY 생략). 요일=`getDay()`(KST 자정 파싱).
- [ ] 헤더 직하 한 줄: 시간상태 배지(`getEventStatusKST` → 예정/진행 중/종료, `StatusBadge`) + 할인율 칩(>0%, accent.revenue soft).
- [ ] 뒤로: 헤더 위 text Button "학회 목록" → L1.
- [x] **헤더 우상단 액션 없음(2026-10-12 건우님).** 입금결의서·지불증은 **⑥ 사후 업무 "문서 내보내기"로 이동**(§9b), "학회 정보 수정"은 **개요 카드 액션 "편집"으로 이동**(아래). 헤더는 학회 식별(제목·행사명·기간·배지)만 담당.
  - [x] **편집(개요 카드 액션, 구 "학회 정보 수정")** — 개요 SectionCard 우상단 `action`, outlined small + `EditOutlined` 아이콘 + 라벨 "편집". **참석준비 카드의 "편집" 버튼과 같은 형태**(카드별 편집은 그 카드 안에서). 개요 SectionCard "읽기 요약 ↔ 편집 폼" 모드 스왑(2026-07-28 — EventFormDialog 모달 폐기, 준비노트 편집 idiom과 동일).** 클릭 → `editingOverview=true` → 개요 본문이 공용 폼 컴포넌트 3종(`EventAutofillFields`·`EventRequiredFields`·`EventOptionalFields`, **평면·점진노출 없음**)으로 스왑. 편집 중엔 이 버튼 숨김. 상세는 §5 참조. `visible_categories`는 `EVENT_DETAIL_COLUMNS`에 포함(2026-06-25 핫픽스 유지 — 편집 저장 시 빈 배열 덮어쓰기 회귀 방지).
  - [ ] ~~**입금결의서**(헤더)~~ → **⑥ 사후 업무 "문서 내보내기"로 이동(2026-10-12).** `exportDepositResolution`(ExcelJS 동적 import) + 작성자/부서 자동 채움. **L2 유일 진입점 유지**(대시보드·목록에 없음).
  - [ ] ~~**지불증**(헤더)~~ → **⑥ 사후 업무 "문서 내보내기"로 이동(2026-10-12).** `PaymentReceiptModal` 오픈. 목록(A10) ⋯ 메뉴의 지불증은 **유지**(L1 빠른 접근) — Q6 종결 참조.

> (해소) 입금결의서/지불증 노출 조건: 매출과 달리 사후 업무로 이동했고, 항상 노출(결제완료 0건이어도 생성 시 빈/0 처리). 1차 시안 = 항상 노출.

## 5. 개요 카드 (블록 2 — 읽기 요약 ↔ 편집 폼 모드 스왑)

### 5-1. 읽기 요약(기본) — events 1행 직출력
라벨 단위 행. `OverviewRow`(라벨 88px 고정폭 + 값).
- [x] **장소** = **`[venue_name, venue_detail].filter(Boolean).join(' ') || venue`(2026-10-12 — 2차 구현).** 신규 저장분은 `venue_name`(+`venue_detail`) 합성, 레거시는 `venue` 폴백. 미입력 "—". 주소가 있으면 아래에 주소 줄(복사·지도) 노출(§5 2차).
- [ ] **날짜** = `start_date ~ end_date` **+요일**(tnum). 헤더와 동일 `YYYY.MM.DD(요일)` 포맷(`formatRange`).
- [ ] **참석자** = `events.attendee_ids` → `STAFF_MAP` join. **L2는 전체 펼침**(A10 L1의 "외 N명" 압축 아님). "나"(로그인 user) 칩 첫 칸 우선·accent(primary soft). master는 "· 마스터" 보조 라벨. 삭제 uuid="(삭제)". 미입력 "—".
- [ ] **비용** = `events.marketing_cost`. `#,##0원` + 한글 금액 caption(`numberToKoreanCurrency`). 0/미입력 "—".
- [ ] **비고** = `events.note`. whitespace-pre-wrap(여러 줄). 미입력 "—".
- [ ] **주문서(신규 1차, 2026-10-12)** = 주문 주소 `{window.location.origin}/order?events={order_url_slug}` 표시(caption·tnum·`break-all`) + **액션 3: 열기(새 탭, OpenInNew) · 복사(ContentCopy → 클립보드 + 토스트) · QR(QrCode2)**. QR 다이얼로그 = **목록(A10)의 기존 QR 다이얼로그와 동일 구성**(실 SVG(`qrcode.toString`) + `event.name` + 주소 + "SVG 다운로드" + "닫기"). 각 버튼 44px 터치.

- [x] **설치 시간**(2차) = `setup_time`(자유 텍스트, 예 "당일 07:30 쯤"). 미입력 "—". ✅ 2026-10-12 — 장소 행 바로 아래 배치(venue 관련 묶음).
- [x] **철거 시간**(2차) = `teardown_time`(자유 텍스트). 미입력 "—". ✅ 2026-10-12.
- [x] **장소 상세**(2차) — 구현은 §5-1 "장소" 행(= `venue_name`+`venue_detail` 합성)과 그 아래 **주소 줄**로 표현(건우님 배치 수정 반영 — 시안에서 지도 버튼이 주소와 홀·층 사이에 끼던 문제를 고쳐, 주소 줄 오른쪽에 지도 버튼 인라인). 좌표·우편번호 미저장. **인터랙션 확정(건우님 2026-10-12):**
  - [x] **주소 1회 탭 = 도로명 주소(`venue_address`)만 클립보드 복사** + 토스트 "주소를 복사했어요". **홀·층 상세(`venue_detail`)는 붙이지 않음.** 두 번 탭·길게 누르기 등 제스처는 쓰지 않음. 복사 = `copyToClipboard`(execCommand 폴백, 크로스플랫폼). ✅ 2026-10-12.
  - [x] **작은 "지도" 버튼**(아이콘 + 짧은 라벨 "지도", text 버튼 수준) — **주소 줄 오른쪽에 인라인.** 누르면 **네이버 지도 1종만** 웹 URL 새 탭(`https://map.naver.com/p/search/{venue_name + ' ' + venue_address}`, trim). 카카오맵·티맵 없음. 375px 가로 스크롤 없음(flexWrap). ✅ 2026-10-12.
  - [x] **지도 버튼은 터치 기기에서만 노출.** 판정 = `useMediaQuery('(hover: none) and (pointer: coarse)')`. 현장 태블릿·휴대폰 노출, 사무실 PC 숨김. 주소가 없으면 복사·지도 모두 숨김. ✅ 2026-10-12.
  - [ ] **제스처 미사용 사유:** 발견성(숨은 제스처는 이관받은 운영자가 모름)·이관 친화성·iOS 두 번 탭 = 확대와 충돌·롱프레스 = 시스템 컨텍스트 메뉴와 충돌. 그래서 "1탭 복사 + 보이는 작은 버튼" 조합.
  - [ ] 앱 스킴(`nmap://`)은 범위 밖 — 실측 후 추가 검토. 공용 폼(생성·편집)에는 지도 버튼을 두지 않고 **읽기 화면(개요)에만** 둔다(입력 폼은 복사 버튼만) — A11 참조.

> 2차 블록(설치/철거·장소 상세)은 **시안에서만** "2차 예정" 점선 태그로 구분했고, **실 페이지(2026-10-12 구현)는 태그 없이 일반 개요 행으로 라이브**(SQL 적용 후 값 표시). 공용 `EventOptionalFields` 수정이 생성 페이지·L2 편집에 **동시 반영**(A11 §공용 폼). 근거·DB 계약·회귀 점검(6지점)은 `A11_EventCreatePage.md` §학회 개선 트랙 2차 / §회귀 점검 체크리스트.
> A10에서 L2 강등된 비고·비용이 여기서 처음 전체 노출(progressive disclosure). 날짜는 헤더와 개요 양쪽 표기 — 헤더=식별 컨텍스트, 개요=정보 행 일관성(의도된 중복, 변경 아님).

### 5-2. 편집 폼(모드 스왑, 2026-07-28) — `events:edit`자만
- [ ] 개요 카드 "편집"(§4) → `editingOverview=true` → 개요 본문이 공용 폼 컴포넌트 3종으로 **평면 스왑**(준비노트 편집 idiom과 동일, 점진 노출 없음):
  - `EventAutofillFields` — 연도·주최학회(드롭다운+`+ 새 학회 추가`)·행사구분(드롭다운+`직접 입력`)
  - `EventRequiredFields` — 행사명*·주문URL*·행사기간*·배송예정일*. `originalSlug={event.order_url_slug}` 전달 → slug 변경 시 **비차단 경고 캡션**("주소를 바꾸면 배포된 QR·복사한 링크·즐겨찾기·자동이동(/go) 설정이 더 이상 열리지 않습니다.")
  - `EventOptionalFields` — 판매대분류·할인율·**설치 시간·철거 시간(2차, 자유 텍스트·피커 금지)**·**장소 3분리(장소명 `venue_name` / 주소 `venue_address`(다음 우편번호 `react-daum-postcode`·읽기전용+검색) / 홀·층 상세 `venue_detail`)(2차)**·참가비용·참석자(secondary=부서명)·비고. 공용 컴포넌트 변경이 자동 전파(생성 페이지=점진 노출 / L2 편집=평면). 상세 = `A11_EventCreatePage.md` §블록2·3단계.
- [ ] 로컬 편집 상태 = `{ ...event }`. `handleChange = applyAutofill(…{ isEditing:true })` — **slug 자동 재생성 차단**(수동 편집 보존).
- [ ] slug 검사 = `useSlugCheck(form.order_url_slug, { excludeId: event.id })` — 자기 slug '이미 사용중' 오탐 방지.
- [ ] **저장 게이트 = `isRequiredComplete`(4필수: 행사명·주문URL·행사기간·배송예정일)** + slug 중복 아님 + 검사 중 아님. 비활성 사유 노출.
- [ ] 저장 = `normalizeEventPayload(form)` → `supabase.from('events').update().eq('id')` → 성공 시 slug 변경이면 `navigate('/admin/events/{새 slug}', { replace: true })`, 아니면 `loadEvent()` 재조회. (구 EventFormDialog `onSaved` 로직 보존.)
- [ ] **편집 푸터** = `[삭제(canDelete일 때 error색 mr:auto)] [취소] [저장]`. 삭제 = 연결 주문 건수 확인(>0건 차단 토스트) → 확인 다이얼로그 → `events` 삭제 → 목록 이동. `canDelete = master 전부 / onsite 본인 생성(created_by === myId)`.
- [ ] **L1 ⋯메뉴 "수정" 경유(`?edit=1`)**: 진입 시 `editingOverview=true` 자동 진입 + 개요로 스크롤, 이후 `edit` param을 `replace`로 제거(새로고침 재진입 방지, `editParamHandledRef` 1회 가드).
- [ ] 판매 대분류 실 집계 미리보기(`fetchProductCountByCategory`)는 편집 모드 진입 시 1회.

## 6. 진행 상태 — "상신·신청" 1개 카드 안 완료 체크 행 3개 (2026-10-12 재구성 · 검수 반영)
- [ ] events 3 boolean(컬럼 불변) — `draft_done`(기안서 상신) / `application_done`(학회 참석 신청) / `payment_resolution_done`(부스 참가비 지출결의서 상신). 마이그레이션 `20260608030000_add_event_progress_flags.sql` 적용 완료(DEFAULT false).
- [ ] **한 카드로 합침(건우님 2026-10-12 검수).** 카드 제목 = **"상신·신청"**(3단계를 아우르는 짧은 이름, 번호 없음). 카드 본문 = 완료 체크 행 **3개**(`ProgressCheckRow`), 각 행 라벨 = 전체 단계명.
- [ ] **표시 라벨만 변경, 컬럼명 불변.** 구 "기안/신청/지결" → 신 "기안서 상신 / 학회 참석 신청 / 부스 참가비 지출결의서 상신". (진행 요약 바에서는 폭 때문에 축약: 기안서/참석 신청/지출결의서, 모바일 2자: 기안/신청/지출.)
- [ ] **단계(순차) 아님 — 행별 독립 토글. 순서 강제(잠금) 없음.** 완료자·완료 시각 **미표시**(update만, 변경자 미기록).
- [ ] 완료 체크 행 = `[체크 원] [단계명(flex)] [상태 캡션(우)]`. 완료 = brand soft 배경+보더+채운 원+라벨 primary/"완료". 미완 = gray-50+gray-200 보더+빈 원+"완료로 표시". 미편집자 = "미완료".
- [ ] 토글 권한 = `events:edit`. 미보유자는 읽기 전용(클릭 불가, hover 없음).
- [ ] **기존 ProgressChip 상호작용 유지:** hit-area 44px(minHeight) · `role=button`·tabIndex·Enter/Space 토글·focus ring(`customShadows.focus`)·낙관적 반영(실패 시 롤백).
- [ ] **진행 요약 바 → 이 카드 점프 + 행 강조:** 요약 바의 ②③④ 어느 것을 눌러도 "상신·신청" 카드로 앵커 스크롤하고, 해당 행에 **focus ring을 ~1.6초 잠깐** 비춰 어느 단계인지 알려 준다(장식 아님 — 네비 피드백).
- [ ] **매출 표시와 연동되지 않음**(설계 근거 — 화면 문구 아님): ④ 지출결의서는 행사 전 업무라 정산 게이트로 쓰면 의미가 어긋남(§9 참조). 토글해도 매출은 항상 표시.

## 7. 준비 노트 (블록 4 — 통합 Toast UI 에디터 · events.prep_note text)
> **2026-06-08 건우님 결정:** 시안의 준비물 위젯+학회자료 2개 섹션을 폐기하고 **통합 리치 에디터 한 칸**으로 대체.
- [x] 목적: 학회 준비물·자료·정보를 한 칸에 자유롭게 정리. 운영자 자체 관리(고객 비노출).
- [x] 저장 = `events.prep_note text` — 에디터 HTML 본문. 마이그레이션 `20260608050000_add_event_prep_note_drop_prep_items.sql` 적용 완료(NULL 허용, anon 비노출).
- [x] **에디터 = Toast UI Editor**(`@toast-ui/editor` + `@toast-ui/react-editor`). **React.lazy 지연 로드**(`PrepNoteEditor.jsx`/`PrepNoteViewer.jsx`) — 초기/공개 번들 0 영향. CSS import는 lazy 청크 내부.
- [x] **준비물 = task-list 체크박스**(에디터 task 툴바). **이미지(프로그램·부스배치도) = addImageBlobHook** → `supabase.storage.from('event-images').upload()` → 표시용 서명 URL(6시간) 본문 삽입. **학회정보(설치/철거 등) = 자유 텍스트.**
- [x] **이미지 저장 = 경로, 렌더 = 재서명(2026-06-10 — 서명 URL 만료 리팩터):** DB 저장본의 img src는 **`storage://event-images/<path>` 경로 플레이스홀더**(토큰 없음 — 만료 무관). 저장 직전 `encodeForStorage(html)`가 본문 내 서명 URL을 경로로 치환(EventDetailPage handleSaveNote). 에디터/뷰어 진입 시 `resolveForDisplay(html)`가 경로(+레거시 서명 URL 직저장본)에서 path를 추출해 `createSignedUrls` **단일 배치 호출(TTL 6시간)** 후 실제 URL로 치환해 주입. 공용 유틸 = `src/utils/prepNoteImages.js`(단위테스트 `prepNoteImages.test.js`). **레거시(1년 서명 URL 직저장) 노트는 렌더 전처리에서 자연 치유, 재저장 시 경로형으로 갱신 — 마이그레이션 불필요.** 재서명 실패 시 해당 이미지만 깨진 채 표시 + 콘솔 경고(본문 차단 금지).
- [x] 이미지 검증: jpg/png/webp, ≤5MB. 위반 시 토스트 안내(업로드 거부).
- [x] **모드 전환(2026-06-10):** 하단 Markdown/WYSIWYG 탭 노출(`hideModeSwitch: false`). **신규(빈) 노트 = markdown 기본**(`## 제목`·`- [ ] 체크리스트` 등 마크다운 직접 입력 — WYSIWYG에는 마크다운 입력 룰이 없어 자동변환 불가). **기존 노트 = wysiwyg 기본**(HTML 저장본이라 markdown으로 열면 raw HTML 노출 — 탭 전환 시 convertor가 마크다운 변환). `previewStyle: 'tab'`. 이미지 paste/drop 업로드(addImageBlobHook)는 양 모드 동작(dist 검증). 에디터 하단 안내 1줄("Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요").
- [x] 저장 흐름: "편집" → 에디터 → "저장"(`getHTML()` → `encodeForStorage`(서명 URL→경로) → `updateEventPrepNote` — **마크다운 모드에서도 변환 HTML 반환**, 기존 데이터·Viewer 호환). 에디터 준비 전(lazy 로드·이미지 재서명 중) 저장 클릭 = no-op(getHTML 접근자 null 반환 가드 — 본문 유실 방지). 읽기 = Toast UI **Viewer**(기본 sanitize · XSS 방어).
- [x] 편집 권한 = `events:edit`. 미보유자 = 읽기 전용(편집 버튼 비노출, Viewer만).
- [x] **이미지 클릭 확대:** Viewer 본문 img 클릭 → MUI Dialog 라이트박스(maxWidth 90vw/90vh, contain, 클릭/× 닫기). 신규 라이브러리 0(MUI Dialog).
- [x] **빈 상태**(prep_note 없음): EmptyState "준비 노트가 비어 있어요" + 안내 + "작성하기"(edit자).
- [x] **"템플릿으로 시작"(2차 — A12, 2026-10-12 구현):** 빈 노트 상태에 **보조 액션 "템플릿으로 시작"**(`events:edit`). **빈 노트 + 편집 중 아님 + 등록 템플릿 ≥1**일 때만 노출(이미 내용 있으면 미노출 — 덮어쓰기 사고 방지, 01 원칙 3). 클릭 → 이름 선택 Menu(이름+수정일) → **기존 편집 진입 경로 재사용**(`setNoteSeed(template.body_html)`·`setEditorKey+1`·`setEditingNote(true)`). 저장 = 기존 `handleSaveNote`(`updateEventPrepNote`) 그대로. **임시저장(`useFormDraft('prepNote', eventId)`) 경로 재사용** — 템플릿 전용 저장/draft 경로 없음, 템플릿 주입이 draft보다 우선(`noteDraft.dismiss()`). 조회 실패 시 숨김(페이지 정상). **빈 상태가 2액션이라 공용 `EmptyState` 대신 동일 톤 로컬 센터 블록으로 렌더**(EmptyState는 action 1개만 지원). 상세 = `A12_PrepNoteTemplates.md` §2. ✅ 2026-10-12.
- [x] **임시저장(2026-06-15)**: 편집 중 에디터 `onChange` → localStorage 자동저장(`useFormDraft('prepNote', eventId)`, debounce 2초·24h 보존·userId 격리). 재진입(편집 열기) 시 유효 draft 있으면 에디터 위 인라인 `DraftBanner`(이어쓰기=draft seed로 에디터 재마운트 / 새로쓰기=draft 삭제 후 저장본). 액션 줄에 "임시저장됨 HH:MM"(`DraftSavedHint`). 저장 성공 시 draft 즉시 삭제. type `prepNote`로 게시판(`bulletin`)과 키 격리.
- [ ] **이미지 업로드 라이브 검증**: event-images 버킷 적용 완료 → 메인 Claude 라이브 QA 예정. 버킷 미적용 시 업로드 토스트로 graceful 실패(페이지 정상).

## 8. 현장 보고 (블록 5 — FieldReportSection 공용 컴포넌트, plain text)
- [x] 데이터 = `field_reports`(event_id로 필터, day_number ASC). 카드: 일차 칩 + 작성자 + content(pre-wrap) + 수정/삭제 IconButton.
- [x] "보고서 작성" 버튼 → 인라인 편집 영역(plain `TextField` multiline). 대시보드 `handleNew` 템플릿(0.판매/1.도서/2.검사) — 이 학회 매출(검사/도서/합계·배송비)로 자동 채움.
- [x] CRUD 전체 보존(작성·수정·삭제·누적) — Supabase 실 저장. **컴포넌트는 `FieldReportSection.jsx`(DashboardPage에서 추출 → 대시보드·L2 공용).** `canEdit` prop으로 events:edit 미보유자 읽기 전용.
- [x] **임시저장(2026-06-15)**: 신규 작성(`!editingId`)만 localStorage 자동저장(`useFormDraft('fieldReport', eventId)`, content+dayNumber+author 묶음, debounce 2초·24h 보존·userId 격리). 편집영역 닫힌 상태에서 유효 draft 있으면 "보고서 작성" 위 인라인 `DraftBanner`(이어쓰기/새로쓰기). 편집영역 액션 줄에 "임시저장됨 HH:MM"(`DraftSavedHint`). 작성 성공 시 draft 즉시 삭제. **기존 보고서 수정은 제외**(DB 원본 존재). FieldReportSection은 대시보드·L2 공용이라 동일 동작.
- [x] **빈 상태**: "생성된 보고서가 없습니다".

## 9. 매출 요약 (⑥ 사후 업무 하위 블록 — 대시보드 hero 축약판, paid·completed · **항상 표시**)
> **2026-10-12 변경(시안 단계): 지결 연동 게이트 제거.** ~~`payment_resolution_done` = true 일 때만 노출~~ → **항상 표시.** 지결(④ 지출결의서)은 **행사 전 업무**라 정산 게이트로 쓰면 의미가 어긋난다(건우님 확정). 행사 전에는 0원 → 기존 EmptyState로 안내. **지결 잠금 박스("지결 완료 후 매출이 표시됩니다")는 제거.**
- [ ] 입력 = 이 event의 `orders`(status·delivery_fee·order_items[{category, price_at_purchase, quantity}]).
- [ ] `computeRevenueByCategory(orders)` — **PAID_STATUSES(paid·completed)만** 합산. 취소/환불/미결제 제외.
- [ ] hero `StatCard` = **총 매출액**(`revenue.total`, accent.revenue, 원).
- [ ] sub **1~3장 동적 분할**(0원 버킷 숨김, flex:1 균등): **검사 판매**(배송비 `testShipping` 포함, accent.tests) / **도서 판매**(배송비 `bookShipping` 포함, accent.books) / **도구 판매**(배송비 `toolShipping` 포함, `CATEGORY_COLORS.tool` #6B7684, `ToolIcon`) — **도구 독립 버킷(2026-06-24 건우님 확정)**.
- [ ] 배송비 할당 규칙 = util 정합(우선순위 **검사>도구>도서**, 한 주문 배송비는 1곳만). 면세. total = test+book+tool+unclassified.
- [ ] subtitle(**화면 문구**) = "결제 완료 주문 기준 · 배송비 포함". (지결 비연동은 설계 근거 — 화면 문구에 넣지 않음.)
- [ ] **빈 상태**(total=0, 행사 전 정상 케이스): EmptyState "아직 매출이 없어요" + "결제 완료된 주문이 생기면 …".

> 대시보드 hero의 YoY trend·오늘 접수 박스·상태바·판매 순위·최근 주문은 L2에 가져오지 않음(대시보드 고유 — L2는 이 학회 매출 합산만 축약).
> **매출의 모집단 = 자식(실주문) 기준**(합배송 껍데기는 금액 집계에서 제외, 자식 아이템 합산). 출고 현황(§9b)의 모집단과 다르므로 **두 지표를 한 숫자로 섞지 않는다**(CTO 확정).

## 9b. 출고 현황 (⑥ 사후 업무 하위 블록 — 신규 2026-10-12 · CTO 확정)
> 출고 관리(A3)와 **같은 규칙**으로 센다. 매출(금액)과 **모집단이 달라** 별도 블록으로 둔다(한 숫자로 섞지 않음).
- [ ] **모집단 = 이 학회의 paid+completed 주문.** **합배송 묶음(껍데기)은 1건**(자식 주문은 따로 세지 않음). 매출(자식 기준)과 구분.
- [ ] **N = 출고 대상 건수**(paid+completed 껍데기/단건) · **M = 처리 완료 건수**(completed). **현장수령 주문도 completed이므로 M에 포함.**
- [ ] 표기 = **"처리 완료"**(현장수령 포함이라 "출고"보다 정확). **StatCard 2장(건우님 2026-10-12 검수 — 3칸→2칸): 처리 완료 M건**(accent.revenue, CheckCircle) / **출고 대상 N건**(accent.shipping, LocalShipping). **출고 대기(N−M)는 별도 칸을 두지 않음**(M·N으로 자명). 한 줄 표기("처리 완료 M / 출고 대상 N건")도 허용.
- [ ] caption(화면 문구·범례) = "결제 완료·처리 완료 주문 기준 · 합배송 묶음은 1건 · 현장수령 포함".
- [ ] **빈 상태**(N=0): EmptyState "아직 출고 대상 주문이 없어요".

## 9c. 현장 보고 · 문서 내보내기 (⑥ 사후 업무 하위 블록)
- [ ] **현장 보고** = §8 `FieldReportSection` 공용 컴포넌트를 ⑥ 안으로 배치(섹션 이동, 기능 불변).
- [ ] **문서 내보내기** = **입금결의서**(`exportDepositResolution`) · **지불증**(`PaymentReceiptModal`). 헤더에서 ⑥으로 이동(§4). 입금결의서는 **L2 유일 진입점**, 지불증은 목록(A10) ⋯에도 유지(Q6).

## 10. 열람 이력 (블록 7 — master만 · 2026-06-10 신설)
- [x] 테이블 `event_views(event_id, user_id, first_viewed_at, last_viewed_at, view_count)` PK(event_id, user_id) — backend 계약. SELECT는 RLS로 **master만**.
- [x] 기록: L2 진입 시(event 로드 성공 후, slug당 1회 — `recordedIdRef` 가드) `record_event_view(p_event_id)` RPC 호출(`api/events.recordEventView`). **실패해도 무시(페이지 차단 금지).**
- [x] 표시: **master만** 보이는 "열람 이력" SectionCard(맨 아래) — A7 게시판 "읽음 현황" 표 패턴. 컬럼 = 이름(+직급 caption) / 최초 열람 / 최근 열람(`MM.dd HH:mm`, tnum) / 횟수. 정렬 = 최근 열람 desc.
- [ ] **모바일 가로 스크롤 금지(2026-10-12, 건우님 모바일 원칙):** 좁은 폭(xs)에서 `TableContainer`가 **가로 스크롤**로 넘어가면 안 된다(확인 동작에 제스처 강제 금지). 모바일은 4열 표 대신 **행 단위 레이아웃**(이름 + 최근 열람·횟수)으로 접어 한 화면에서 읽히게 한다(최초 열람은 모바일에서 생략 가능 — 데스크톱 표에선 유지). 시안 `EventDetailFlowPreview.jsx`는 이미 행 레이아웃으로 렌더.
- [x] 이름·직급 = `api/events.getEventViewers`가 `user_profiles(id,name,position)` 추가 조회로 병합(role 무관 — staffMap은 master/onsite만이라 미사용). 프로필 미존재 = "(삭제)".
- [x] **graceful:** 테이블/RPC 미적용 환경·비-master = select 에러 무시 → 섹션 자체 숨김. 빈 목록도 숨김.

## 11. 재사용 매핑 (실구현)
| 요소 | 출처 | 신규 여부 |
|---|---|---|
| PageHeader | `ui/PageHeader` | 재사용 |
| SectionCard | `ui/SectionCard` | 재사용 |
| StatCard(hero/sub) | `ui/StatCard` | 재사용 |
| StatusBadge(시간상태) | `ui/StatusBadge` | 재사용 |
| EmptyState(매출 0·준비노트 0·학회 미발견) | `ui/EmptyState` | 재사용 |
| 할인율 칩 | `EventManagementPage` DiscountChip 톤 | L2 로컬 복제(discount_rate→%) |
| 참석자 칩 | `EventManagementPage` AttendeeCell 톤 | L2 전체펼침 변형(`AttendeePillRow`) |
| 매출 합산 | `utils/revenueByCategory` | 재사용 |
| 현장 보고 | `FieldReportSection.jsx` | **추출(공용)** — DashboardPage·L2 import |
| 진행상태 칩 | 페이지 로컬 프리미티브 `ProgressChip` | 토큰만 |
| OverviewRow | 페이지 로컬 레이아웃 헬퍼 | 토큰만 |
| 통합 에디터 | `PrepNoteEditor.jsx`(Toast UI Editor, lazy) | **신규 라이브러리 `@toast-ui/editor`+`@toast-ui/react-editor`** |
| 통합 에디터 읽기 | `PrepNoteViewer.jsx`(Toast UI Viewer, lazy) | 동상 |
| 이미지 라이트박스 | MUI `Dialog` | 재사용(신규 라이브러리 0) |
| 날짜 요일 포맷 | 헬퍼 `weekday`/`dotDay`/`formatRange` | `getDay()` KST 자정 파싱 |
| 단건 fetch·진행상태·노트·매출주문 | `api/events.js` | **신규 함수 4종** |
| 학회 정보 수정 폼 | `EventAutofillFields`·`EventRequiredFields`·`EventOptionalFields` + `useSlugCheck` | **공용 추출(2026-07-28)** — 생성 페이지·L2 편집 공유. ~~`EventFormDialog.jsx`~~ 폐기(삭제) |
| 열람 기록·열람자 조회 | `api/events.js` `recordEventView`/`getEventViewers` | **신규 함수 2종** (2026-06-10) |
| 열람 이력 표 | A7 게시판 "읽음 현황" Table 패턴 | MUI Table(신규 0) |

> ProgressChip·OverviewRow·AttendeePillRow는 페이지 로컬 소형 프리미티브(토큰만). 새 디자인 시스템 컴포넌트 추가 아님.
> **신규 라이브러리:** Toast UI 에디터/뷰어 2종(CTO 승인). React.lazy 지연 로드로 초기/공개(고객 주문) 번들 0 영향. 그 외 라이트박스 등은 MUI로 처리(신규 0).

## 12. 5곳 분산 → L2 통합 (Before/After)
| 정보 | Before (현재 위치) | After (L2) |
|---|---|---|
| 매출(검사/도서/전체) | 대시보드(전체·계층 필터로 학회 선택) | L2 매출 요약(이 학회 자동) |
| 현장 보고(작성·수정) | 대시보드 Row4(상세 행사 선택 시) | L2 현장 보고 섹션 |
| 입금결의서 | ~~대시보드 헤더(단일 행사 선택 시)~~ → 2026-06-10 대시보드 진입점 제거 | L2 헤더 액션(**유일 진입점**) |
| 지불증 | A10 행 ⋯ 메뉴 | L2 헤더 액션(⋯에도 유지 — L1 빠른 접근) |
| 개요 필드(장소·참석자·비용·비고) | A10 L1 표(압축)·다이얼로그 | L2 개요 카드(전체) |

> 효과: "이 학회 어떻게 됐지?"를 답하려고 대시보드 필터 → 결의서 → A10 ⋯ 를 오가던 동선이 한 페이지로 수렴. A10 비전 "한 학회의 모든 것이 한 페이지에"의 첫 실체.

## 13. 권한·빈상태·표시형식
- [x] `events:view` 접근. `events:edit` = 진행상태 토글 · 준비 노트 편집 · 보고 작성/수정 · 학회 정보 수정(인라인 다이얼로그) · 결의서/지불증. `master` = 열람 이력 열람 + 다이얼로그 삭제(onsite는 본인 생성만).
- [x] 잘못된/없는 slug → EmptyState "학회를 찾을 수 없어요" + "학회 목록으로".
- [x] 매출 0 / 출고 대상 0 / 보고 0 / 준비 노트 0 → 각 블록 EmptyState(행사 전 정상 케이스). 매출은 지결과 무관하게 항상 표시(2026-10-12).
- [x] 비용 `#,##0원`("—") + 한글금액. 날짜 `YYYY.MM.DD(요일)` 점 표기 + 요일. 숫자 tnum.

## 14. 확인 필요 (후속 결정 사항)
- [x] (Q1) 입금결의서·지불증 버튼: **항상 노출**(실구현). 입금결의서는 클릭 시 주문 조회→ExcelJS.
- [ ] (Q2) 진행상태 토글 변경 시 audit log 기록 여부 / 변경자·시각 표기 여부. (실구현=update만, 변경자 미기록)
- [x] (Q3) 통합 에디터 저장 포맷 = **HTML**(Toast UI getHTML). 이미지 = **event-images 버킷**(비공개+서명 URL). 적용 완료.
- [ ] (Q4) 매출 요약에 판매 순위(검사/도서 top)를 L2에도 둘지 — 실구현은 hero+2장만(대시보드와 중복 회피). 건우님 판단.
- [x] (Q5) 헤더 날짜 ↔ 개요 날짜 중복 = **유지**(의도된 중복).
- [x] (Q6) **종결(2026-10-12).** 지불증 = 목록(A10) ⋯ 메뉴 **유지** + L2는 헤더에서 **⑥ 사후 업무 "문서 내보내기"로 이동**(헤더 중복 해소). 입금결의서는 **L2(사후 업무)에만**. 즉 지불증만 L1·L2 양쪽, 입금결의서는 L2 단독.
- [x] (Q7) ~~매출 노출 조건 = 지결 단독~~ → **폐기(2026-10-12). 지결 연동 게이트 제거, 매출 항상 표시**(지결은 행사 전 업무라 정산 게이트로 부적합, 건우님 확정). §9 참조.
- [x] (Q8/Q9/Q10) 준비물 prep_items 폐기 → 통합 에디터 prep_note(text) 단일 컬럼. 체크 주체·시각 미기록(에디터 task). 이미지 = event-images 버킷 단일.
- [x] (Q11) **학회 정보 수정** = ~~L1 목록 이동~~ → **해결(2026-06-10 건우님 "버그네, 수정하자").** 다이얼로그를 `EventFormDialog.jsx`로 추출해 L1·L2 공용. L2는 인라인 오픈 + 저장 시 재조회(slug 변경 시 새 주소 이동).

## 15. 결정 이력
- **2026-10-12 — 개요 편집 버튼 위치·라벨 변경(건우님).** 헤더 우상단 "학회 정보 수정" → **개요 카드 액션 "편집"**(outlined small, `EditOutlined`). 참석준비 카드 "편집"과 같은 형태로 맞춰 "카드별 편집은 그 카드 안에서" 규칙을 통일. 헤더 액션은 없음. 동작(모드 스왑·`?edit=1` 진입·편집 중 숨김)은 불변.
- **2026-10-12 — 2차 구현 완료(frontend-engineer, SQL 적용 후 라이브 확인 대기).** ① 개요 읽기(§5-1) 장소 행 = `[venue_name, venue_detail].join(' ') || venue`, 그 아래 **주소 줄**(1탭=도로명 주소만 복사·토스트 "주소를 복사했어요", 오른쪽에 작은 "지도" 버튼 인라인=네이버 웹 URL·`(hover:none) and (pointer:coarse)` 터치 기기만, 주소 없으면 복사·지도 숨김, 375px 가로 스크롤 없음). 설치 시간·철거 시간 행 추가(장소 묶음 아래, 미입력 "—"). **시안에서 지도 버튼이 주소·홀/층 사이에 끼던 배치 문제를 주소 줄 인라인으로 수정(건우님).** ② 준비노트 빈 상태에 "템플릿으로 시작"(§7) — 2액션이라 로컬 센터 블록으로 렌더. ③ 공용 `EventOptionalFields`(생성·L2 편집 공유)에 설치/철거 2칸 + 장소 3입력(주소=`react-daum-postcode` 모달·읽기전용+검색·복사 버튼만) 반영. **전제 = "SQL 적용 → 프론트 배포" 순서(런타임 폴백 미구현).** 근거 = `A11_EventCreatePage.md` §회귀 점검(6지점 전부) · `A12_PrepNoteTemplates.md`.
- **2026-10-12 — 1차 실 페이지 구현 완료(frontend-engineer).** 시안 `EventDetailFlowPreview.jsx` 레이아웃을 `EventDetailPage.jsx`에 반영. ① 진행 요약 바(6단계 StepTab·`flexWrap:nowrap`·모바일 짧은 라벨·44px) + 앵커 스크롤(섹션 ref) + ②③④ 점프 시 `ProgressCheckRow` focus ring ~1.6초 강조. ② 카드 4개(학회 개요/상신·신청/참석준비/사후 업무) + 열람 이력. 기존 `ProgressChip`(기안/신청/지결) → `ProgressCheckRow` 3행(기안서 상신/학회 참석 신청/부스 참가비 지출결의서 상신, 컬럼 불변·낙관적 토글·롤백·키보드 유지). ③ 매출 지결 게이트(`LockIcon` 잠금 박스) **제거** → `hasRevenue ? 카드 : 빈 상태`, subtitle 상시. ④ 헤더 액션 "학회 정보 수정" 1개만 — 입금결의서(`handleExportDeposit`)·지불증(`PaymentReceiptModal`)은 사후 업무 "문서 내보내기"로 이동. ⑤ 개요 "주문서" 행(열기·복사·QR, 공용 `eventUrl`/`EventQrDialog`). ⑥ 출고 현황(§9b) 신설 — `getFulfillmentOrders`+`groupLinkedOrders`+`fulfillmentCounts`(공용 util), 2칸(처리 완료·출고 대상), 조회 실패 graceful 빈 상태. ⑦ 열람 이력 모바일(xs<600) 행 레이아웃(이름+최근 열람·횟수, 최초 열람 생략)·데스크톱 표 유지. **시안 대비 제외:** 2차 블록(설치/철거·장소 상세, DB 미적용)·"2차 예정" 블록·태그·"템플릿으로 시작"·"터치 기기 보기" 토글·시나리오 칩·시안 정적 PrepNote 렌더(실 페이지는 Toast UI 에디터/뷰어 유지). 개요 편집 모드 스왑·`?edit=1`·삭제·준비노트 임시저장·이미지 라이트박스·열람 기록 RPC 전부 보존.
- **2026-10-12 — 시안 검수 반영(건우님, product-designer).** ① **②③④를 "상신·신청" 한 카드(완료 체크 행 3개)로 합침** — 카드 제목에서 번호 제거(흐름 순번은 진행 요약 바 단독 보유), 요약 바 ②③④ 클릭 시 이 카드로 점프 + 해당 행 ~1.6초 강조. ② **출고 현황 3칸→2칸**(처리 완료·출고 대상; 출고 대기는 별도 칸 제거, 범례 유지). ③ **진행 요약 바 모바일 가로 스크롤 폐지** — 375px에서도 6칸 균등 한 줄(세로 배치·짧은 라벨, 44px 유지). 건우님 모바일 원칙 "모바일은 확인(Read) 중심, 제스처 없이 현황 파악" → 열람 이력도 모바일 행 레이아웃(가로 스크롤 금지)으로 정리. ④ **장소(2차) 인터랙션 확정** — 주소 **1회 탭 = 도로명 `venue_address`만 복사**(홀·층 상세 결합 안 함, 제스처 미사용) + 토스트 "주소를 복사했어요"; **작은 "지도" 버튼(네이버 1종·웹 URL·터치 기기에서만 노출**, 판정=`(hover:none) and (pointer:coarse)`, 시안은 "터치 기기 보기" 토글로 데스크톱 확인). 기존 "네이버 지도에서 열기" outlined 버튼 → 작은 지도 버튼으로 교체. 입력 폼엔 지도 버튼 안 둠(개요 읽기 화면만). 제스처 미사용 사유 = 발견성·이관 친화·iOS 두 번 탭 확대 충돌·롱프레스 시스템 메뉴 충돌. `nmap://`는 범위 밖. 목록 시안(`EventHubFoldPreview.jsx`)은 변경 없이 승인.
- **2026-10-12 — 진행상태 6단계 흐름 재구성(시안 단계, product-designer).** 페이지 뼈대 = 학회 진행 순서 6단계(개요→기안서 상신→학회 참석 신청→부스 참가비 지출결의서 상신→참석준비→사후 업무) + 상단 진행 요약 바(읽기 전용 네비·앵커 스크롤). ① 진행상태 3칩 → ②③④ 단계 체크 행으로 분산(라벨 변경·컬럼 불변·완료자/시각 미표시) ② **매출 지결 게이트 제거·항상 표시**(지결=행사 전 업무) ③ 헤더 액션 "학회 정보 수정" 1개만(입금결의서·지불증 → ⑥ 사후 업무) ④ 개요 "주문서" 행 신설(열기·복사·QR) ⑤ **출고 현황(처리 완료 건수·합배송 껍데기=1·현장수령 포함, CTO 확정) §9b 신설** ⑥ 2차(DB 변경): 개요 설치·철거 시간·장소 3분리(장소명/주소/상세)+복사+네이버 지도 · 준비노트 "템플릿으로 시작". 시안 = `EventDetailFlowPreview.jsx`(`/preview/event-detail-flow`). 실 페이지 구현은 건우님 마일스톤 검수 후. 근거 = `project_booth_event_flow_track` · 형제 사양 `A11_EventCreatePage.md`·`A12_PrepNoteTemplates.md`.
- 2026-07-28 — **편집을 L2 개요 인라인으로 이관(frontend-engineer).** `EventFormDialog` 모달 폐기(파일 삭제). 개요 SectionCard "읽기 요약 ↔ 편집 폼" 모드 스왑(§5-2). 공용 폼 컴포넌트 3종(`EventAutofillFields`·`EventRequiredFields`·`EventOptionalFields`) + `useSlugCheck` 훅 추출(생성 페이지와 공유, 폼 이원화 부채 제거). 편집도 4필수 게이트(`isRequiredComplete`). slug 변경 비차단 경고 캡션. 삭제(주문건수 확인+확인 다이얼로그)를 편집 푸터로 이식. L1 ⋯메뉴 "수정"→`?edit=1`로 L2 편집 자동 진입. `useSlugCheck` `excludeId`로 자기 slug 오탐 방지. staff 쿼리에 `department` 추가(참석자 secondary=부서명). **backend 무변경.**
- 2026-06-08 — L2 1차 시안 신설(EventDetailPreview). 에디터·이미지 2차로 분리. 진행상태=3 독립 boolean(마이그레이션 적용). 매출=paid만 hero 축약. (product-designer)
- 2026-06-08 — **1차 시안 v2(건우님 피드백 4건).** ①날짜 요일 ②매출=지결 완료 시에만 ③준비물 체크리스트 ④학회 자료 섹션. (product-designer)
- 2026-06-08 — **실구현 완료(frontend-engineer).** 건우님 결정으로 **준비물 위젯+학회자료 → 통합 Toast UI 에디터 1칸**(prep_note·event-images 버킷)으로 대체. 진행상태 실 토글, 매출 실 집계, FieldReportSection 추출(공용), slug 라우팅 분기, 이미지 라이트박스(MUI). 섹션 순서 = 개요→진행→준비 노트→현장보고→매출.
- 2026-06-10 — **준비노트 이미지 서명 URL 만료 리팩터(건우님 확정, frontend-engineer).** 본문 저장 = 1년 서명 URL 직저장 → **경로 플레이스홀더 저장 + 렌더 시 배치 재서명(TTL 6시간)**. 공용 유틸 `utils/prepNoteImages.js`(encodeForStorage/resolveForDisplay) + 단위테스트 17건. 레거시 노트 자연 치유(마이그레이션 불필요).
- 2026-06-25 — **회귀 핫픽스(B1, frontend-engineer).** 공용 `EventFormDialog`가 `event`로 초기화하는데 event 공급 select(L2 `EVENT_DETAIL_COLUMNS` / L1 `EventManagementPage` 목록)에 `visible_categories`가 없어, 운영자가 다른 필드만 고쳐 저장해도 `form.visible_categories===undefined`→`[]` 저장으로 기존 노출 대분류가 소거되던 데이터 손실 수정. 두 select에 `visible_categories` 추가(authenticated 어드민 컨텍스트). FORM_FIELDS·handleSave·emptyEvent는 이미 정상이라 미변경. 빈 배열/NULL=전체노출 의미 규칙 유지.
- 2026-06-10 — **events 클러스터 4건(건우님 확정, frontend-engineer).** ① 학회 정보 수정 = `EventFormDialog.jsx` 공용 추출 → L2 인라인 수정(Q11 해결, 목록 이동 버그 폐기) ② 입금결의서 진입점 L2 일원화(대시보드 버튼 소거) ③ 다이얼로그 날짜 3필드(시작/종료/배송예정) = 공용 `ui/DateField`(single 캘린더, `YYYY.MM.DD(요일)` 표시·클리어 가능 — 빈 날짜는 null 저장) ④ 열람 이력 §10 신설(`event_views` + `record_event_view` RPC, master만, graceful).
