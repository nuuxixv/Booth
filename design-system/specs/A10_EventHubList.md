# A10 — 학회 통합 목록 뷰 (Event Hub List) · P0 (확정)

> 비전: **"학회 운영 OS — 한 학회의 모든 것이 한 페이지에."**
> L1 연간 목록(이 문서) → L2 학회 통합 상세(`L2_EventDetail.md` — 1차 시안 완료 2026-06-08) → L3 연차 자산(비-P0)
> 상태: **1차+2차 구현 완료(2026-10-12, frontend-engineer)** — 종료 접힘·예정 전체 표시 재구성 + 2차(장소 컬럼 `venue_name||venue` 폴백·목록 select 신규 5컬럼·PageHeader "준비노트 템플릿" 버튼)를 실 페이지(`EventManagementPage.jsx`)에 반영. **2차는 DB 5컬럼 + `prep_note_templates` SQL 적용 후 라이브 확인 대기**(전제 = "SQL 적용 → 프론트 배포" 순서, 런타임 폴백 미구현).
>
> **✅ 2026-10-12 재구성 1차 구현 완료.** 시안 `EventHubFoldPreview.jsx`(`/preview/event-hub-fold`)의 레이아웃을 실 페이지(`EventManagementPage.jsx`)에 반영했다. §5·§6·§7·§12는 현재 실 페이지 구조와 일치한다. 반영: 상단(진행 중·예정, `start_date` asc, 연도·기간 무관 전부) + 하단 "종료된 학회 N건" 접힘(기본 접힘·펼치면 `end_date` desc·번호 영역별 1부터) · 기간 필터 기본값 "전체"(종료 영역에만 적용) · 공통 필터(학회명·참석자·"나")는 양 영역 · subtitle 갱신. **"준비노트 템플릿" 헤더 버튼은 2차이므로 제외.**
> - 재구성 핵심(건우님 2026-10-12 "권장안대로" 승인 · `project_booth_event_flow_track`): ① 진행 중·예정은 상단(날짜 오름차순), **예정은 연도 무관 전부 표시** ② 종료는 하단 **"종료된 학회 N건" 접힘 영역**(기본 접힘·펼치면 최근 종료순) ③ 기간 필터 기본값 "전체" + **상단은 기간 무관 항상 표시, 기간은 종료 영역에만 적용** ④ 2차: 장소 컬럼 `venue_name||venue` 폴백·목록 select 신규 5컬럼 포함 · PageHeader "준비노트 템플릿" 버튼.

> **실 구현 단일 진실 소스:** `src/components/EventManagementPage.jsx` (라우트 `/admin/events/:slug?`, export default 유지).
> - 데이터: events 15컬럼(기존 11 + 신규 venue·attendee_ids·note·marketing_cost + created_by) `start_date ASC`. societies. user_profiles(role IN master/onsite) 참석자 후보. realtime `events_channel`.
> - 참석자: attendee_ids(uuid[]) ↔ staffMap join. 누락 uuid="(삭제)". 내 포함 시 "나" 칩 우선.
> - Upcoming: getTodayKST 기준 미래 1건(master=전체 / 내 참석 0건이면 전체 폴백).
> - 비용 입력: 천단위 콤마 + 인라인 한글 reading(numberToKoreanCurrency). 저장 정수(원), 0/빈값 reading 숨김.
> - 권한: events:view 접근 · events:edit CRUD · 삭제 = master 전부 / onsite는 본인 생성(created_by)만 — §9(주문 FK count 가드).

## 1. 개요·목표
- 학회를 "운영 대상" 단위로 한 화면에 나열 + 학회관리 CRUD 겸용(dual-purpose). 행 클릭 → L2(비-P0).
- 목표: ① 연간/반기 현황 조망 ② 운영필드(장소·참석자·비고·비용) 관리 ③ 현장 모바일 ④ "내 다음 학회" 즉시 인지.
- Pain: 현장에서 "내가 갈 다음 학회" 정보가 한 곳에 없음. 데이터 80%는 이미 시스템 내 존재.

## 2. L1 목록 컬럼 (6종, 스캔 3축=언제·어디서·누가)
| # | 컬럼 | 출처 |
|---|------|------|
| 1 | 번호 | 행 순번(표시용, 영구 ID 아님) |
| 2 | 학회명 | `events.host_society` |
| 3 | 행사명 | `events.event_season` |
| 4 | 날짜 | `events.start_date~end_date` |
| 5 | 장소 | `venue` → **`venue_name \|\| venue` 폴백(2차, 2026-10-12)** |
| 6 | 참석자 | **신규 `attendee_ids uuid[]`** (어드민 멀티선택, 칩 압축) |

> **(2차, 2026-10-12) 장소 컬럼 출처 변경:** 단일 `venue` → **`venue_name || venue`**(신규 저장분은 장소명, 레거시는 `venue` 폴백). **목록 fetch select에 신규 5컬럼(`setup_time`·`teardown_time`·`venue_name`·`venue_address`·`venue_detail`) 전부 포함** — 편집 라운드트립이 목록 데이터로 초기화되는 경로의 값 소거 방지(2026-06-25 사고 유형 · `A11_EventCreatePage.md` §회귀 점검 체크리스트). DB 계약·백필은 A11 참조.

> **L2 강등(저장 O / L1 미표시):** **비고(`note`)·비용(`marketing_cost`)** — events에 저장·다이얼로그에서 입력하되 L1 목록엔 미노출, **L2 상세 "개요 카드"에서 표시**(progressive disclosure). 비용 컬럼토글·비고 메모아이콘 둘 다 두지 않음(확정).
> **진행상태(기안/신청/지결)** = 표 제외, L2 본문 템플릿으로 이관(논외, P1+).

## 3. 신규 필드 최종 스키마 (events ADD COLUMN, 멱등, 비운영일 적용)
```
venue           text
attendee_ids    uuid[]      -- user_profiles.id 참조 배열
note            text
marketing_cost  integer     -- 원
```
- RLS: events 정책 상속(읽기 events:view / 쓰기 events:edit·master).

## 4. 참석자 (어드민 멀티선택) — Q1 확정
- **저장 = `attendee_ids uuid[]`(참조).** 이름 변경에 강함. 표시 시 후보목록 join → 항상 현재 이름.
- **후보 source = `user_profiles` 클라이언트 SELECT**(RLS authenticated 허용, 별도 Edge Fn 불필요. feedback/bulletins profileMap 선례).
- **후보 범위 = 현장마케팅(onsite) + master** (확정. 출고 제외).
- **표시:** 3명까지 이름 칩 / 4명+는 `{첫1명} 외 N명`. 미입력 "—".
- **필터:** 드롭다운 source=후보목록 + **"나" 빠른필터 칩**.
- **정합 방어:** 삭제된 user의 잔존 uuid는 join 실패 시 "(삭제)" 표시·무시(FK/트리거 미도입).

## 5. 행 인터랙션 / 위계
- **행 본문 클릭 → L2 상세**(P0는 라우트 입구만). ⋯메뉴는 `stopPropagation`.
- **음영(위계 다운) = 시간상태 '종료' 행**(bg gray-50, 텍스트 secondary). 시간상태=`getEventStatusKST`(예정/진행중/종료) 자동 파생. **(2026-10-12 재구성: 종료 행은 하단 접힘 영역으로 이동 — §5b.)**
- **Upcoming 하이라이트 — Q2 확정:** **"로그인한 내가 attendee_ids에 포함된 미래 가장 가까운 1건"** 강조(좌측 brand 보더/약한 틴트). **master = 전체 미래 1건.** **내 참석 0건이면 전체 다음 1건 폴백**(빈 하이라이트 방지). 상단 영역에만 적용(종료 영역엔 없음).

## 5b. 종료 접힘 · 예정 전체 표시 (2026-10-12 재구성 · 시안 단계)
> 하반기 스크롤 불편 해소. 운영 대상(진행 중·예정)은 위, 지난 학회는 접어 아래로.
- [ ] **2영역 구조:**
  - **상단 = 진행 중 + 예정**, `start_date` 오름차순. **예정은 연도와 무관하게 전부 표시**(내년 학회도 노출 — 운영 대상 누락 방지 세이프가드).
  - **하단 = 종료**, **"종료된 학회 N건" 접힘 영역**(기본 접힘). 펼치면 **최근 종료순**(`end_date` 내림차순).
- [ ] **접힘 헤더:** 좌측 아이콘 + "종료된 학회 {N}건" + caption(접힘 "펼쳐서 지난 학회 보기" / 펼침 "최근 종료순") + 우측 chevron. **44px 터치 · role=button · Enter/Space · focus ring.** 과장 없는 중립 톤(CTA 아님).
- [ ] **번호(#) 매김:** 상단/종료 **각 영역 1부터 재시작**(표시용·영구 ID 아님). 접힘 상태에서 연속 번호가 끊겨 보이는 혼란 방지.
- [ ] **모바일:** 상단=카드 리스트, 종료=접힘 헤더 아래 카드 리스트(펼침 시). 음영·Upcoming 규칙 동일.
- [ ] **§12-6 "상태 필터 토글 미부활"(2026-06-08)과의 관계 — 상충 아님:** 이 재구성은 **예정/진행중/종료 토글을 되살리는 것이 아니라**, 종료만 하단에 접는 **단일 접힘 섹션**이다. 상태를 전환해 거르는 토글은 여전히 두지 않는다(종료=접힘, 진행·예정=항상 상단). §12-6 결정 유효.

## 6. 검색 필터 (2026-10-12 재구성 반영)
- **기간 단축: 전체(기본) / 올해(`event_year`) / 상반기(1~6월) / 하반기(7~12).** **기본값 = "전체"**(구 "올해"에서 변경 — 예정 전체 표시와 정합).
  - **기간 필터는 종료 영역에만 적용.** **상단(진행 중·예정)은 기간과 무관하게 항상 전부 표시**(연도 무관 — §5b 세이프가드와 정합). 즉 기간은 "지난 학회를 연도·반기로 좁히는" 도구다.
- 학회명 드롭다운: distinct `host_society`. 참석자 드롭다운: 후보목록 + "나". **학회명·참석자·"나"는 양 영역(상단·종료) 모두 적용.**
- **정렬: 상단 = `start_date` 오름차순 / 종료 = `end_date` 내림차순(최근 종료순).**
- 접힘 영역 카운트·목록 = 기간·학회명·참석자 필터 적용 후의 종료 학회. 빈 조건이면 접힘 영역 안 EmptyState.

## 7. 현장 모바일/태블릿
- 모바일 **카드**(OrderManagement 카드 패턴): 상단 학회명+행사명 / 중단 날짜·장소·참석자(칩). **비고·비용 줄 없음**(L2 강등 → 카드 짧고 스캔 빠름). 음영(종료)·Upcoming 보더=카드 bg/좌보더.

## 7-1. L2 상세 "개요 카드" (→ `L2_EventDetail.md` §5 로 이관·구체화)
L2 진입 직후 상단 요약 카드에 6필드 집결: **장소 · 날짜 · 참석자(전체 펼침) · 비용 · 비고.** (L1은 장소·참석자만 압축 노출, L2 개요에서 전체.) **1차 시안 완료(2026-06-08, `EventDetailPreview.jsx`).** 상세 사양·진행상태·매출·현장 보고 레이아웃은 `L2_EventDetail.md` 참조.

## 8. Dual-purpose 화면 구조 (조망 + CRUD)
| 작업 | 위치 | 위계 |
|---|---|---|
| 운영 조망(메인) | 표 6컬럼 | L1 |
| 등록(신규) | 우상단 "추가" → **전용 페이지 `/admin/events/new`**(2026-07-20 모달→페이지 전환, `A11_EventCreatePage.md`) | 라우트 |
| 수정(기존 편집) | 행 ⋯ 메뉴 "수정" → 다이얼로그(`EventFormDialog`) | 모달 |
| 부가 액션(수정·URL/QR·삭제) | 행 우측 ⋯ 메뉴 | 행 액션 |
| L2 진입 | 행 본문 클릭 | 라우트 |
> 원칙: 보기=행 / **등록=전용 페이지** / 편집=다이얼로그 / 부가=⋯ / 깊이=행클릭.

## 8-1. 기존 학회관리(EventManagementPage) 기능 보존 매핑 ⚠️ 룰 A/D 엄수
A10은 기존 학회관리 표를 **대체**하므로 아래 전부 보존(누락·통합 금지). 행선지 명시:
| 기존 항목 | A10 행선지 |
|---|---|
| 학회명(`name` 전체) | 학회명(`host_society`)+행사명(`event_season`) 2컬럼으로 분리 표시. `name`은 계속 저장·자동생성 |
| 상태 배지(예정/진행중/종료, `getEventStatusKST`) | **유지** — 종료=음영, 예정·진행중 구분 위해 작은 StatusBadge 행 내 유지(디자이너 배치 제안) |
| 주문 URL(slug) + 새창열기·복사·QR | **행 ⋯ 메뉴**로 이동(목록 폭 절약). slug 표시는 ⋯ 또는 다이얼로그 |
| 할인율(`discount_rate`) | 다이얼로그 유지 + **L1에서 >0%일 때 행사명 옆 작은 칩**(현재 노출 중이라 가시성 보존). 디자이너 배치 제안 |
| 기간 | 날짜 컬럼(정렬 ASC로 변경) |
| 주최학회 | 학회명 컬럼 |
| 배송예정일(`estimated_delivery_date`) | 다이얼로그 유지(고객 조회 페이지 의존) |
| 상태 필터(전체/예정/진행중/종료) | A10 §6 필터로 흡수(올해/상반기/하반기 + 학회명/참석자). 시간상태 토글 유지 여부=디자이너 제안 |

**폼 필드 — 전체(신규=전용 페이지 `/admin/events/new`, 수정=L2 개요 인라인):** ✦행사명형식(연도·주최학회·행사구분 드롭다운) / 행사명(자동완성+수동) / 주문URL slug / **할인율** / 행사기간(range) / **배송예정일** / 설치시간·철거시간(2차)·장소 3분리(장소명·주소·홀/층 상세, 2차)·참석자(멀티선택)·참가비용·비고 / 판매 대분류(visible_categories). 신규 생성 페이지는 필수 4(행사명·주문URL·행사기간·배송예정일) / 선택 8 분리·즉시 slug 중복검사(`A11_EventCreatePage.md`).
> **(2차, 2026-10-12) 필드 수치 갱신:** 입력 그룹 **15개**(자동조립 3 + 필수 4 + 선택 8 — 설치/철거 2칸 추가·장소 1그룹). DB 저장 컬럼(`FORM_FIELDS`) **19개**(기존 14 + `setup_time`·`teardown_time`·`venue_name`·`venue_address`·`venue_detail`, 기존 `venue` 존치). 입력 그룹 수와 저장 컬럼 수 혼동 금지(A11 §입력 폼 구조). 생성·수정 두 화면 동일(공용 `EventOptionalFields`).
**⋯ 메뉴:** 수정 · 주문URL(열기/복사/QR) · **지불증 내보내기(유지 — 입금결의서는 L2 상세에만)** · 삭제(§9 게이팅, 주문 FK 가드 — 연결 주문 있으면 차단). **학회목록관리**·**준비노트 템플릿(2차)** 버튼(우상단, §12-1). slug 자동생성=신규만, 행사명 자동완성=`_nameTouched` 보존 로직 유지.

## 9. 권한·빈상태·표시형식
- events:view=읽기, events:edit=운영필드·CRUD(편집·추가), master=전체 Upcoming.
- **삭제 게이팅(2026-06-10 건우님 확정):** 노출 = **master 전부** / **onsite(events:edit)는 본인 생성(`event.created_by === user.id`)만**. 그 외 편집만. `created_by` null/undefined(마이그레이션 전 기존 행) = master만(graceful). ⋯메뉴 삭제 항목 + 수정 다이얼로그 좌하단 삭제 버튼 동일 조건. 주문 FK count 가드 유지. 클라이언트는 `created_by`를 쓰지 않음(insert 시 DB default·update payload에서 제외).
- 빈상태 EmptyState "해당 조건의 학회가 없어요"+필터해제. 비용 표시 `#,##0원`("—").
- **비용 입력 서식(확정):** 입력 중 **천단위 자동 콤마(#,##0)** + 그 아래 **인라인 한글 reading**(`numberToKoreanCurrency` 재사용, 예 3,600,000→"삼백육십만원"). 저장은 정수(원). 0/빈값이면 한글 reading 숨김. (지불증 금액 입력에도 동일 패턴 재사용)

## 10. P0 범위 / 비-P0
- **P0:** 8컬럼 목록 + 종료 음영/Upcoming + 3필터 + 신규 4필드 입력(다이얼로그) + 행클릭→L2 라우트(빈 상세 OK).
- **비-P0:** L2 상세 조립(field_reports·orders·매출·결의서·**진행상태 본문 템플릿**), 캘린더, L3 자산.

## 11. 결정 이력 (전부 확정)
- **2026-10-12 — 1차 실 페이지 구현 완료(frontend-engineer).** 시안 `EventHubFoldPreview.jsx` 레이아웃을 `EventManagementPage.jsx`에 반영. ① 단일 표 → **2영역**(상단=진행 중·예정 `start_date` asc·기간 무관 전부 / 하단=종료 "N건" 접힘·기본 접힘·`end_date` desc·번호 영역별 1부터, `EventRow`/`EventMobileCard`/`EventTable` 공통 컴포넌트로 추출). ② 기간 필터 기본값 올해→**전체**(`dateFilter='all'`), 올해=`event_year`(폴백 start 연도)·반기=start 월, **종료 영역에만 적용**(상단은 항상 전부). 공통 필터(학회명·참석자·"나")는 양 영역. 캡션·subtitle(`진행·예정 N건 · 종료 M건 …`)·활성 필터 수(`dateFilter!=='all'`)·필터 해제(전체) 갱신. ③ Upcoming 하이라이트는 상단(post-filter)에서 산출(음영·별표·좌보더 유지). ④ 종료 학회 0건이면 접힘 섹션 숨김, 필터로 0건이면 "종료된 학회 0건"+펼침 시 빈 상태. ⑤ **주문 URL 복사·QR을 공용 `eventUrl`(execCommand 폴백)·`EventQrDialog`로 추출**(상세와 공유, 토스트 문구 동일). **시안 대비 제외:** "준비노트 템플릿" 버튼·"2차 예정" 태그(2차·DB 변경 필요), 목록 select 신규 5컬럼·장소 폴백(2차). realtime·삭제 게이팅·지불증 ⋯·PaymentReceiptModal·SocietyManagementDialog·로딩 스켈레톤·빈 상태 전부 보존.
- **2026-10-12 — 2차 구현 완료(frontend-engineer, SQL 적용 후 라이브 확인 대기).** ① 목록 fetch select에 신규 5컬럼(`setup_time`·`teardown_time`·`venue_name`·`venue_address`·`venue_detail`) 추가(라운드트립 소거 방지 — A11 §회귀 점검). ② 장소 컬럼(표·모바일 카드) 출처 `venue` → **`venue_name || venue`** 폴백. ③ PageHeader에 **"준비노트 템플릿"(outlined)** 버튼 추가("학회 목록 관리" 옆·"학회 추가" 왼쪽, `events:edit`만) → `PrepNoteTemplateDialog` 오픈(A12). Primary 채움 버튼은 "학회 추가" 1개 유지. **전제 = "SQL 적용 → 프론트 배포" 순서(런타임 폴백 미구현).**
- 연동=학회관리 표 확장(단일 화면). 정렬=날짜 오름차순, 기본필터=올해.
- Q1 참석자 후보=**현장마케팅+master**. Q2 Upcoming=**내 참석 다음 1건(master 전체·0건 폴백)**.
- Q3 진행상태=**표 제외, L2 본문 템플릿으로 이관(논외)**.
- **2026-10-12 종료 접힘·예정 전체 표시 재구성(시안 단계, product-designer).** ① 상단 = 진행 중·예정(날짜 오름차순, 예정 연도 무관 전부) / 하단 = 종료 "N건" 접힘(기본 접힘·최근 종료순·# 재시작) ② 기간 필터 기본값 올해→**전체**, 상단은 기간 무관 항상 표시·기간은 종료 영역에만 적용 ③ §12-6 "상태 토글 미부활"과 상충 아님(토글 부활이 아니라 종료만 접는 단일 섹션) ④ 2차: 장소 컬럼 `venue_name||venue` 폴백·목록 select 신규 5컬럼 포함 · PageHeader "준비노트 템플릿" 버튼 · 입력 그룹 13→15(FORM_FIELDS 14→19) · ⋯ 지불증 유지. 시안 = `EventHubFoldPreview.jsx`(`/preview/event-hub-fold`). 실 구현은 건우님 마일스톤 검수 후. 근거 = `project_booth_event_flow_track` · 형제 사양 `A11_EventCreatePage.md`·`A12_PrepNoteTemplates.md`.

## 12. 시안 (레이아웃 확정 — 2026-06-08, product-designer)
> 정적 Preview: `src/components/EventHubListPreview.jsx` · 라우트 `/preview/event-hub`. mock 데이터, 실 도메인 미연결. 기존 EventManagementPreview 톤·헬퍼·QR/다이얼로그 구조 차용.

### 12-1. 레이아웃 골격
- **PageHeader:** 타이틀 "학회" / subtitle **"진행·예정 N건 · 종료 M건 · 운영 대상 한눈에"(2026-10-12 — 구조 변경으로 문구 갱신)** / 우상단 액션 = `학회 목록 관리`(outlined) + **`준비노트 템플릿`(outlined, 2차 — A12, `학회 목록 관리` 옆·`학회 추가` 왼쪽, events:edit만, 시안에 "2차 예정" 태그 병기)** + `학회 추가`(contained, **Primary 1개 유지**). 가짜통계·그라데이션 없음(룰 E).
- **필터바(SectionCard):** Row1 기간 토글(**전체[기본]**/올해/상반기/하반기) + 보조 캡션 "기간은 종료 학회에만 적용 · 진행 중·예정은 항상 전부" · Row2 학회명 Select + 참석자 Select + "나" 빠른칩. 활성 필터 수 배지.
- **상단 표(SectionCard padding=0):** 진행 중·예정, 헤더 7열(# · 학회명 · 행사명 · 날짜 · 장소 · 참석자 · ⋯).
- **종료 접힘(§5b):** 상단 표 아래 "종료된 학회 N건" 접힘 헤더(기본 접힘) → 펼치면 같은 7열 표(최근 종료순). # 번호 재시작.
- **모바일:** `useMediaQuery(down('md'))` → 카드 리스트로 스위치(같은 데이터·같은 하이라이트 규칙, 접힘 동일).

### 12-2. 컬럼별 시각 스펙 (color=theme 토큰만)
| 컬럼 | 시안 처리 |
|---|---|
| # 번호 | `text.disabled`, tnum. 행 순번(i+1) |
| 학회명 | `host_society` body2/700 + **그 아래 StatusBadge(예정/진행중/종료)**. Upcoming 행은 앞에 ☆(StarBorder, primary) |
| 행사명 | `event_season` body2/500 + **할인율 칩(>0%) 우측 인라인** |
| 날짜 | start(body2/500, tnum) / end(caption, secondary). 단일일은 end 생략 |
| 장소 | PlaceIcon(disabled) + venue. 미입력 "—" |
| 참석자 | 칩 압축(아래 12-3) |
| ⋯ | MoreVert IconButton, `stopPropagation` |

### 12-3. 참석자 칩 / 멀티선택
- **L1 칩(`AttendeeCell`):** ≤3명 → 이름 pill 나열 / 4명+ → `{첫1명} 외 N명`. **내가 포함이면 "나" pill을 첫 칸 우선**, accent = `alpha(primary, 0.08)` 배경 + `alpha(primary, 0.24)` 보더. 일반 pill = gray-100/gray-200. 미입력 "—". 삭제 uuid는 "(삭제)".
- **멀티선택(다이얼로그):** MUI Autocomplete `multiple` + Checkbox 옵션. 옵션 secondary = 역할(현장 마케팅/마스터). 선택 = outlined Chip(deletable). 후보 = STAFF(onsite+master) mock.
- **필터 드롭다운:** 후보 전체 + "나" 빠른칩(별도). 칩 활성 시 드롭다운은 '전체'로 표시(상호 배타 mock 처리 — 구현 시 단일 상태로 통합 권장).

### 12-4. Upcoming / 음영 (확정 배치)
- **Upcoming(내 참석 다음 1건 / master=전체 / 0건 폴백):** 표 행 = `bgcolor alpha(primary,0.04)` + `boxShadow inset 3px 0 0 primary`(좌 brand 보더). 학회명 앞 ☆. 카드 = 좌 3px primary 보더 + 약한 보더 강조.
- **종료 행 음영:** `bgcolor gray-50`, `td color text.secondary`(텍스트 위계 다운). 카드도 동일 gray-50.
- 색은 모두 theme 토큰(primary, gray, status, accent.revenue)만. raw hex 없음.

### 12-5. 보존 항목 배치 최종 제안 (§8-1 충족)
| 보존 항목 | 시안 최종 배치 |
|---|---|
| 상태 배지 | **학회명 컬럼 하단** 작은 StatusBadge(size sm). 종료=음영과 중복 아님(음영=행 위계, 배지=명시 라벨) |
| 할인율(>0%) | **행사명 옆 인라인 칩**(accent.revenue soft + LocalOffer 아이콘). 0%는 미표시 |
| 주문URL 열기/복사/QR | **⋯ 메뉴**(주문 페이지 열기·URL 복사·QR 코드). slug 자체는 ⋯/다이얼로그에서만 |
| 지불증 내보내기 | **⋯ 메뉴**(2026-10-12 명시). 입금결의서는 L2 상세(사후 업무)에만 — L2 Q6 종결 |
| 삭제(§9 게이팅, FK 가드) | **⋯ 메뉴 하단**(Divider 후 error 색), master 전부/onsite 본인 생성만 노출. 다이얼로그 좌하단에도 삭제 버튼 |
| 배송 예정일 | 다이얼로그 "기본 정보" 섹션(L1 미표시 — 고객 조회 의존만) |
| 다이얼로그 전체 | Step1 행사명형식 카드(연도/행사구분 freeSolo/주최학회) · Step2 기본정보(행사명·slug·할인율·배송예정일·시작/종료일) · **Step3 운영정보(장소·참석자 멀티선택·비용·비고)** |
| 학회 목록 관리 | 우상단 버튼 유지 |

### 12-6. 확인 질문 — 전부 확정 (2026-06-08 건우님)
- **(확인1) 상태 필터 토글 = 미부활 확정.** 예정/진행중/종료 토글 두지 않음(종료=음영 + 행별 상태배지로 구분).
- **(확인2) "나" 칩 ↔ 참석자 드롭다운 = 단일 상태(`attendeeFilter`) 통합 확정.**
- **(확인3) 행사명 컬럼 = `event_season`만 노출 확정.** 전체 `name`은 QR·검색용.

## 조사 출처
AuthContext.jsx(로그인 user.id/role/permissions), feedback.js/bulletins.js(user_profiles id,name 클라SELECT), 20260607(user_profiles authenticated SELECT), events 스키마(20260313060000), getEventStatusKST(utils/date.js). 시안=EventHubListPreview.jsx, 톤 차용=EventManagementPreview.jsx, 합성=ui/{PageHeader,SectionCard,StatusBadge,EmptyState}.
