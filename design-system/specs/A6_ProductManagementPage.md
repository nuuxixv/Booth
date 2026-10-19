# 사양 시트 — A6 상품 관리 (ProductManagementPage)

> 이 시트는 상품 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-10-19 **필터 바 개정**(메인 Claude, 건우님 지시). 카테고리 단일 선택 → 다중 선택(OR), 순서 [전체|검사|도서|도구], 카테고리 '미확인' 폐지(등록 필수값), 검사군 그룹 뷰는 '검사' 단독 선택 시만. 판매상태(고객 주문서 노출 `is_active`) Y/N 신설. `utils/productFilters.js`(`matchesCategory` 배열화·`isActive` 패싯)·테스트 갱신.
> 이전 갱신: 2026-10-19 **필터 바 재설계(실 구현)**(메인 Claude, 시안 `ProductFilterBarPreview` 1:1 이식). `ProductManagementPage.jsx`의 빠른 필터 카드 8장(`renderQuickFilterCard`·`productQuickFilter`·카드 집계 memo 5종)과 구 검색·태그 SectionCard를 폐지하고 필터 바 SectionCard 1장으로 교체. state: `productQuickFilter` → `facets`(`DEFAULT_FACETS` = isDiscountable·discountOverride·isPopular·isNew·hasImage·onlineCode, 각 `'all'|'y'|'n'`, 온라인코드만 `'unknown'` 추가) + 카테고리는 기존 `selectedCategory`(값에 `'미확인'` 추가, 그룹 뷰 분기 공유). 판정 로직은 순수 함수 `utils/productFilters.js`(`DEFAULT_FACETS`·`isFacetsActive`·`matchesCategory`·`matchesFacets`·`matchesTags`·`buildTagOptions`)로 분리. 필터: 카테고리 미확인=`!PRODUCT_CATEGORIES.includes(category)`, Y/N 속성 AND, 이미지=`image_filename` trim 유무, 온라인코드 3상태 그대로(**검사 한정 조건 제거**, undefined=NULL 취급), 태그 OR. 태그 옵션: `societies.name` 정렬 앞 + 나머지 자유 태그 정렬 뒤(`societyTagSet` — 학회 실선·자유 점선 테두리). UI: 모듈 스코프 `FacetToggle`(ToggleButtonGroup exclusive, 카테고리만 clearable) + 우측 상단 "N개 표시 중"(필터 있을 때) + 상시 "필터 초기화"(필터 없으면 disabled) → 카테고리(+검사 선택 시 "검사군 추가", `canEdit`) → Y/N 2열 그리드 → 태그(체크박스 칩) → 상품명 검색 맨 아래(`ProductSearchBar` 로컬 state+debounce 60ms 유지). `hasFilters`에 `isFacetsActive(facets)` 반영, `handleResetFilters`에 `setFacets(DEFAULT_FACETS)`, 1페이지 리셋 useEffect deps에 `facets`. 미사용 import(TrendingUp·HelpOutline·MenuBook·Science·Build 아이콘, `CATEGORY_COLORS`·`CATEGORY_KEY_BY_LABEL`) 정리. 상품 표·그룹 뷰·액션바 무변경. theme.js 무수정·MUI만·존재 토큰(`theme.gray[50/300]`·palette.primary)만.
> 이전 갱신: 2026-10-19 **필터 바 재설계(사양)**(메인 Claude, product-cpo 권고·건우님 확정). 단일 선택 빠른 필터 카드 8장(`productQuickFilter`)을 폐지하고 속성별 패싯 필터로 교체: 카테고리(도서/검사/도구/미확인)·할인 여부·개별 할인·인기 상품·신상품·온라인코드(미확인/Y/N) 이미지 등록 Y/N·검색 맨 아래·미확인 끝 배치 포함, 각 단일 선택(전체/Y/N), 속성 간 AND, 태그(학회 ∪ 기존 자유 태그) 체크박스 OR, 옵션별 건수 미표시(합계만), "전체 상품" 카드 → 상시 "필터 초기화" 버튼. 온라인코드 미확인의 검사 한정 조건 제거. 실 코드 미변경(사양만 — 시안 후 구현). §필터 바 절 신설(구 §통계 카드·§검색·필터 카드 대체).
> 이전 갱신: 2026-08-25 **QA P0-3 — 그룹 뷰 전체 선택 오삭제 결함 픽스**(frontend-engineer, tech-cto 위임). 헤더 전체 선택 체크박스(`handleToggleAll`·`allPageSelected`·`somePageSelected`)는 평면 슬라이스 `displayedProducts`를 참조하는데, 검사 그룹 뷰는 `displayedGroups`(검사군 헤더)를 렌더하므로 그룹 뷰에서 전체 선택을 누르면 **화면에 안 보이는(접힌 검사군의) 평면 상위 50개 상품**이 선택돼 "선택 삭제"까지 이어질 수 있었다. **수정(최소 안전)**: ① 그룹 뷰(`groupViewActive`)에선 헤더 전체 선택 `Checkbox`를 렌더하지 않는다 — `TableCell`(padding="checkbox")은 유지하고 내부를 `{!groupViewActive && <Checkbox .../>}`로 조건부(빈 셀로 컬럼 정렬 보존). 평면 뷰(도서·도구·검색 결과·전체)의 전체 선택은 무변경. ② 그룹 뷰에서 잔여 선택(평면 뷰에서 선택 후 검사 탭 전환)이 남아 일괄 액션 바가 뜰 때, `selectedCount`(ActionSlot leading) 아래 캡션 1줄 **"선택된 상품이 현재 화면에 보이지 않을 수 있습니다."**(`groupViewActive && selectedCount>0`, `caption`/`text.secondary`)를 노출 — 조용한 오삭제 방지. 옵션 하위 행의 개별 체크박스(`ProductRow`)는 기존대로 유지. **그룹-aware 전체 선택 모델은 승인 대기 중인 검사군 팬아웃 편집 트랙 선결 과제로 이관(여기서 선점 안 함)**. 검증: vitest 294 passed(신규 실패 0)·기존 OrderDetailModal 2 실패 무관(diff 0)·ProductManagementPage lint 0·build. §검사군 그룹 뷰·§액션·§선택 시 액션바 절 갱신.
> 이전 갱신: 2026-08-25 **개별 상품 폼에 이미지 첨부**(frontend-engineer, tech-cto 위임). 상품 추가/수정 다이얼로그 '비고' 아래에 **"상품 이미지" 섹션** 신설: 72px 미리보기(`ProductImagePreview` — 로드 실패·미등록 시 "이미지 없음" 문구, `key={image_filename}`로 파일명 변경 시 remount) + **[이미지 첨부]**(`PhotoLibraryIcon`, 단일 파일 `<input accept="image/*" hidden>`) + **[제거]**(`image_filename=''`) + 안내 "JPG·PNG·WEBP·GIF, 1MB 이하(200KB 이하 권장). 파일명은 자동으로 정리됩니다." **권한 `products:edit`**. **파일명 처리(일괄과 다르게)**: 개별 첨부는 엑셀 '이미지' 열과 맞출 필요가 없어 원본 파일명을 강제하지 않고 **안전하게 새로 짓는다** — `utils/productImageName.js`의 순수함수 `buildProductImageFilename({originalName, productCode, productId})` = `p{안전화한 코드/ID}-{timestamp}.{원본 확장자소문자}`(SAFE_IMAGE_FILENAME 통과 보장). **→ 한글 파일명 사진도 그대로 첨부 가능**(거부 안 함, 운영자 친화). 확장자 화이트리스트 `jpg/jpeg/png/webp/gif`(그 외 null 거부), 크기 하드상한 `MAX_IMAGE_BYTES`=1MB(200KB는 권장 안내만). **동작**: 첨부 즉시 `uploadProductImage`로 버킷 업로드(`new File([file], safeName)`로 리네임)하되 `image_filename` 반영은 폼 상태로만 — 저장 취소 시 DB 미반영(업로드 파일은 버킷 잔류, 다른 상품 참조 가능성 있어 롤백 안 함·무해). **`handleSave` image_filename 정규화 수정**: `''`(제거) → 편집이면 NULL 명시 저장(기존 이미지 지움)·추가면 키 제외 / null·undefined → 키 제외(컬럼 미적용 graceful, PGRST204 재시도 유지). 신규 추가 다이얼로그도 동일 컴포넌트라 자동 반영. 검증: vitest 280 passed(신규 `productImageName.test.js` 11 — 한글 원본→안전명·확장자 보존/거부·폴백)·기존 OrderDetailModal 2 실패 무관(diff 0)·lint 0·build. §상품 추가/수정 폼·데이터 모델 image_filename 절 갱신.
> 이전 갱신: 2026-08-25 **목록 다운로드=양식 v2 서식으로**(frontend-engineer, tech-cto 위임). `handleDownloadExcel`이 SheetJS `json_to_sheet`(맨 시트·서식 없음)로 만들던 것을, **양식 v2 정적 템플릿을 ExcelJS로 열어 예시 9행을 지우고 전체 상품을 채워** 내보내도록 변경(안내문 1행·색상 헤더·검사 전용 열 색·틀고정 A3·자동필터 서식 그대로). 선례 `utils/depositResolution`·`paymentReceipt` 정적 양식 패턴. 로직은 `utils/productExcelExport.js` 신설로 분리: `buildProductRows`(순수 — 상품→20열 AOA)·`fillProductListWorksheet`(ExcelJS 채움)·`exportProductList`(fetch→채움→다운로드). 예시 행 제거는 ExcelJS 4.4.0 `spliceRows` 말단 대량삭제 버그(splice(3,9)→무동작) 회피 위해 **아래에서부터 1행씩 삭제**. 데이터 행 서식은 예시 3행 셀에서 캡처해 상속(맑은 고딕 10·E열 `#,##0`·N~T열 옅은 채움 theme3/tint 0.85). 자동필터 `A2:T{2+행수}` 갱신·틀고정 A3 유지·파일명 `상품_목록.xlsx`. 값 포맷·열 순서는 파서 규약 그대로(라운드트립: 안내문 1행→`detectHeaderRow` 2행 탐지→20열·검사·평면 값 복원 단위 테스트). 컴포넌트에서 `XLSX`는 업로드 파싱(`XLSX.read`)에만 잔존. 검증: vitest 269 passed(신규 11 `productExcelExport.test.js`)·기존 OrderDetailModal 2 실패 무관(diff 0)·lint 0·build. §액션·§엑셀 컬럼 매핑 갱신.
> 이전 갱신: 2026-08-25 **상품 엑셀 양식 v2 픽스**(frontend-engineer, tech-cto 위임). 파서를 `utils/productExcel.js`로 분리(단위 테스트 23). **① 헤더 행 탐지**: 1~10행 중 '상품명'(괄호·공백 무시) 있는 첫 행을 헤더로(`sheet_to_json({range})`) — v2(1행 안내문·2행 헤더)·구양식(1행 헤더)·목록 다운로드 모두 흡수(회귀 0). **② 괄호 헤더 정규화**: `normalizeHeaderKey`로 `(` 이하 제거+trim, row 키를 원본·정규화 양쪽 보유해 `카테고리(검사/도서/도구)`→`카테고리` 매칭. `hasOnlineCodeColumn`·`hasIsActiveColumn` 게이트도 정규화 키로. **③ 별칭 추가**: `배지_인기`→is_popular·`배지_신규`→is_new·`판매여부`→is_active(기존 인기상품·신상품여부·노출 유지). **④ is_active 최상위화**: 판매여부가 v2 H열(공통 구역) — 검사 전용 `_hier`에서 최상위로 이동, 도서·도구에도 적용. 열 없음/셀 공란은 미변경(키 미포함 — N으로 뭉개 숨김 방지). **⑤ 검사 외 온라인코드 false 강제**(건우님 확정): `category!=='검사'`면 입력 무시하고 includes_online_code=false, 검사는 3상태 유지. 열 자체 없으면 미변경(게이트 우선). **⑥ 양식 다운로드=정적 파일**: `/templates/product-upload-template.xlsx` fetch→blob→다운로드(건우님 다듬은 안내문·색상·틀고정·예시 9행 1:1 보존, json_to_sheet 하드코딩 폐기). **⑦ 목록 다운로드=v2 20열 라운드트립**(A~T 풀네임 헤더, 값 포맷 파서 규약 일치). Edge Fn·graceful 폴백 무변경. 검증: vitest 258 passed(신규 23)·기존 OrderDetailModal 2 실패 무관(diff 0)·lint 0·build. §엑셀 컬럼 매핑·§액션 갱신.
> 이전 갱신: 2026-08-18 **상품별 할인율 오버라이드**(frontend-engineer, tech-cto 위임). 공용 유틸 `utils/pricing.js`(`getEffectiveRate`/`getDiscountedUnit`/`percentToRateNullable`/`rateToPercentNullable`, backend create-order와 등가 정본, 단위 테스트 14) 신설. 실효율 = `discount_override ?? (is_discountable ? eventRate : 0)`, 단가 = `round(list_price*(1-실효율))`. **① 입력 필드**: 상품 폼 '할인 가능' 체크박스 옆 **'개별 할인율 (%)'** 숫자 필드(`value=rateToPercentNullable(discount_override)`, `onChange→percentToRateNullable` — 공란=NULL(해제)/0=명시적 정가/값=clamp(0..100)/100 3분기). **auto-T 배선**: 개별 할인율>0 입력 시 `is_discountable` 자동 ON + 안내 토스트(공식상 override가 이겨 가격은 이미 맞지만 데이터 정합·UI 명료성 목적). 비우거나 0으로 되돌리면 강제 유지 안 함. `createEmptyProduct`에 `discount_override:null`, 편집 다이얼로그는 DB 상품 spread로 값 반영, 저장 payload는 `...currentProduct`로 자동 포함(PGRST204 graceful 재시도 목록에 `discount_override` 추가). **② 배지**: override 지정 상품(≠null)에 `개별 N%` 소프트 틴트 칩(`info` 0.1) + 상태 '-' 빈 조건에 `discount_override==null` 추가. **③ 빠른 필터·카운트**: '개별 할인' 카드(`info`, `totalOverrideCount`) 추가 + `productQuickFilter==='override'` 필터(개별 할인 상품만 즉시). **④ 엑셀 3곳**: 업로드 파싱에 `개별할인율`→`percentToRateNullable`(공란=NULL 해제, 현행 `할인여부` 공란=FALSE와 정합) + auto-T 보정(파싱 후 override>0이면 is_discountable=true), 템플릿 `개별할인율:''` 열, 다운로드 `개별할인율:rateToPercentNullable`. Edge Fn `upload-products-excel` 무변경(blind upsert), 신규 컬럼 미적용 graceful 폴백(`buildPayload(false)`·`newColsSent`)에 `discount_override` 포함. **DB**: `products.discount_override`(numeric nullable, 마이그레이션 `20260817000000_DRAFT`, backend 병렬 커밋 44e612a). 검증: pricing.test 14 passed·lint 신규 0·build. §상품 폼·상태 태그·빠른 필터·엑셀 열 절 반영 대상.
> 이전 갱신: 2026-07-03 **검사군 상세 편집 모달 실 구현 + ⋮ 메뉴 재편**(frontend-engineer, tech-cto 위임). 검사군(상위)과 하위 옵션(products)의 생성·수정·삭제·순서·이동을 **하나의 큰 모달**(`TestGroupEditorModal.jsx`)로 통합. 흩어져 있던 검사명·약어 편집 다이얼로그 + 옵션 편집 다이얼로그(`tgDetail`) + 분리 다이얼로그(`tgSplit`)를 **폐지하고 모달로 흡수**. **A6 ⋮ 메뉴 재편**: [검사군 상세 편집] + [병합] + [삭제] 3항목(옵션 편집/분리 항목 제거 — 모달로 흡수, 병합은 모달 밖 유지=`mergeTestGroups`). **모달 구조**: 상단(검사명·약어·정렬·노출 Switch) + 옵션 인라인 테이블(순서 ▲▼ / 옵션명(형태) / 말머리 / 상품코드 / 가격 / 공용 / 노출 / ⋮ 이동·삭제) + 하단("+ 옵션 추가" + 저장/취소). **신규 옵션 name 자동조합** = `"{검사명} {옵션명}"`(공백 1칸, 하이픈 금지, 편집 가능·nameTouched 시 자동조합 중단). **기존 옵션 name 자동 덮어쓰기 안 함**. **옵션 옮기기(분리·이동)** = 모달 내부 액션(라디오 A=새 검사군 `splitTestGroup` / B=기존 검사군 `moveOptionsToGroup`, 확인 문구 3블록). **상품코드 중복 검증**(모달 내부 + 로드된 전체 products 대비) 저장 차단. **삭제 vs 판매중지 구분**: 옵션 ⋮ "삭제"(`deleteProductOption`, 확인 문구 "판매중지는 노출 토글·삭제는 되돌릴 수 없음·과거 주문 보존") vs 노출 Switch. **삭제 권한 master 전용**(products DELETE RLS `has_permission('master')`) — edit 운영자는 삭제 메뉴 disable + "삭제는 관리자(master) 권한이 필요합니다" 안내. **드래그앤드롭·undo 제외**(Non-Goal). **state 완전 격리** — 214검사군 헤더 렌더에 영향 없음(모달 자체 로컬 state, Autocomplete 내장 필터라 controlled 최상단 state 렉 없음). API `testGroups.js`에 `createProductOption`·`deleteProductOption`·`moveOptionsToGroup`·`saveTestGroupWithOptions` 신설(backend 병렬, 순차+graceful, order_items 불변). theme.js 무수정·MUI만(Dialog/Table/Switch/Checkbox/RadioGroup/Autocomplete)·AI 시그니처 없음. lint 신규 0·build·vitest 113 passed. **§옵션 옮기기 "항목 수 불변" 제약 재정의**(아래 참조): ⋮ 메뉴가 모달 흡수로 3항목이 됨 — "옵션 편집·옵션 옮기기·병합·삭제" 4항목 제약은 폐기.
> 이전 갱신: 2026-07-03 **옵션 옮기기(분리·이동) 사양 — 분리 다이얼로그 일반화**(product-designer, 건우님 확정). 기존 "분리" 다이얼로그(옵션 체크박스 다중 선택 + 새 검사군 검사명·약어 입력)를 **"옵션 옮기기 (분리·이동)"** 로 일반화. 상단 **목적지 라디오 2택**: (A) 새 검사군으로 = 기존 분리 UI 그대로(`splitTestGroup`) / (B) 기존 검사군으로 = MUI `Autocomplete`(214개, 약어+검사명 검색·자기 자신 제외)로 선택 → 선택 옵션 `test_group_id`를 **기존** 검사군 id로 UPDATE(동종 연산, 새 검사군 생성 없음). ⋮ 메뉴 라벨 "분리"→"옵션 옮기기 (분리·이동)", **항목 수 불변(6번째 신설 금지)**. 자동 초벌 오분류 교정을 UI에서 직접(엑셀 재업로드 불필요). **안 함: 실행취소(undo) 전면 제외 / 빈 검사군 자동삭제 제외(유지+경고만) / 드래그앤드롭 제외.** 확인 문구 3블록(이동/빈검사군 경고/되돌리는 법) 정직·자체완결. theme.js 무수정·MUI만(Dialog/Checkbox/Autocomplete/Chip/RadioGroup 재사용)·AI 시그니처 금지·`products:edit` 가드 보존. **frontend 결정 필요(tech-cto 소관): 신규 `moveOptionsToGroup(targetGroupId, productIds)` vs `splitTestGroup` 확장(제품 요구는 "기존 id로 test_group_id UPDATE" 동종 연산일 뿐).** 실 코드 미변경(사양만).
> 이전 갱신: 2026-07-02 **검사 위계 통합 개편 3건 실 구현**(frontend-engineer, 건우님 최종 지시). **[지시 1] "검사군 묶어보기" 토글(`groupView` state·`Switch`) 제거 — `selectedCategory==='검사'`이면 무조건 그룹 뷰(디폴트이자 유일 뷰).** 도서·도구·전체는 평면. '전체'에서 검사 상품이 평면에 섞이는 현행 유지(전체 조망). 검사 그룹 뷰는 기본 접힘·페이지네이션 숨김. **[지시 2] 별도 "검사군 관리" 토글 패널(`tgPanelOpen`)·헤더 버튼 폐지 — 기능을 '검사' 그룹 뷰에 인라인 흡수.** 그룹 헤더 행에 검사군 단위 관리(노출 Switch·검사명/약어 편집·⋮ 메뉴[옵션 편집·분리·병합·삭제]), 옵션 하위 행의 편집 버튼으로 상품 필드 편집(말머리·옵션명·순서는 옵션 편집 다이얼로그 재사용). 병합은 헤더에서 이 검사군을 대표로 지정→흡수할 다른 검사군 선택. 위험 액션(분리/병합/삭제)은 기존 확인 다이얼로그 재사용. **검사 = '검사' 카테고리 화면 하나에서 조회·수정 전부.** "검사군 추가"는 검사 뷰 필터 바에 노출. **[지시 3] 엑셀 다운로드/업로드에 검사 위계 열 추가**: `검사군약어`·`검사군명`·`옵션명`·`말머리`·`공용(Y/공란)`·`옵션정렬`·`노출(Y/N)`. 다운로드=현 DB값(test_groups 조인) 채워 내보냄. 업로드=열 채워진 것만 반영(빈 열=미변경, 기존 값 보존→구양식 회귀 0). 검사군 매칭=(약어,검사명) 조합으로 조회, 없으면 신규 생성(`makeTestGroupResolver`, seed_hierarchy.py dedup 동일). Edge Fn 무변경(컬럼 있으면 통과, 없으면 프론트에서 위계 열 빼고 1회 재시도 graceful). 기존 열·`product_code` upsert 무변경. theme.js 무수정·MUI만·AI 시그니처 금지·권한 가드 보존. lint 신규 0·build·vitest 113 passed.
> 이전 갱신: 2026-07-02 **검사 위계 실 구현 — is_active 토글 + 검사군 관리 화면**(frontend-engineer). (1) is_active: 상품 표 행 dim(`is_active===false`, `opacity 0.55`) + 상태 태그 컬럼 맨 앞 "숨김" 칩(`gray[200]` 소프트 틴트, 노출 중은 무표시) + 상품 폼 별도 행 "고객 주문서 노출" `Switch`(기본 노출, off 시 "숨김" 칩·보조문구) + `handleSave` PGRST204 재시도에 `is_active` 포함(컬럼 미적용 graceful). 숨김 상품이 표에서 잔류. (2) 검사군 관리: 헤더 "검사군 관리" 토글 → Collapse `SectionCard`(`products:edit`). 목록(체크박스·약어·검사명·옵션N·is_active Switch·편집·삭제) + 검사명·약어·정렬 편집 다이얼로그(미리보기 카드) + 옵션 상세(말머리·형태명 TextField·공용 Checkbox·개별 is_active Switch·▲▼ 순서) + 분리(1→N)·병합(N→1)·삭제 위험 액션 확인 다이얼로그. API `src/api/testGroups.js` 신설. 편집=즉시, 위험 액션=확인 스텝. graceful(테이블 미적용 시 빈 목록). ⚠️ 검사군 단위 is_active = 검사군 카드 노출만 토글(옵션 일괄 전파 미구현, TODO 주석 + "확인 필요" 유지 — backend·건우님 검수). 노출 필터(P1) 미구현. theme.js 무수정·MUI 유지·AI 시그니처 없음. lint·build 통과.
> 이전 갱신: 2026-07-02 **검사 위계 시안 — is_active 토글 + 검사군 관리 화면**(product-designer, PRD_검사위계.md). (1) **is_active(노출여부) = 상품 전역 필드**(검사 위계 전용 아님): 상품 표에 "노출" 상태칩(노출 중/숨김) + 상품 폼에 Switch. **숨김 상품도 표에서 사라지지 않고** 회색 dim + "숨김" 칩으로 구분. 단어 = **"노출 중" / "숨김"**(권고안, "판매중지"보다 중립·데이터 보존 뉘앙스 정합). (2) **검사군 관리 화면**(A6 내 신규 탭/토글 패널): 검사군 목록 + 분리/병합/검사명·약어 편집/옵션 순서/삭제. 진열 깨는 위험 액션(병합·삭제)은 확인 스텝. §검사군 관리·상태 태그·상품 폼 절 신설. theme.js 무수정·MUI 유지.
> 이전 갱신: 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품·소분류는 유지**(건우님 결정). 배지 마스터 CRUD 패널·다이얼로그, 상품 폼 배지 칩 토글, 표 동적 배지 칩, 엑셀 "배지" 열, `products.badges` 코드 참조를 전부 제거. `is_popular`/`is_new` boolean(카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열)·소분류 마스터·상품 이미지·태그는 그대로 유지. `fetchBadges`·배지 CRUD API 삭제, `fetchMasterUsageCounts`는 `subCounts`만 반환. 헤더 토글 "소분류·배지 관리"→"소분류 관리". §관련 절·핵심 발견 갱신.
> 이전 갱신: 2026-06-29 **상품 표 썸네일 플레이스홀더 폐기 — 이미지 없으면 셀 비움**(건우님 결정). `ProductThumb`가 `getProductImageUrl(filename)` null이거나 onError면 `return null`(썸네일·플레이스홀더 미표시, 셀 빈 칸). "이미지" 컬럼 자체는 유지(있는 상품만 썸네일). 기존 회색 박스+ImageIcon 플레이스홀더 제거, `ImageIcon` import 삭제. C1 카드와 동일 정책(혼재 처리 로직 없음 — 오버엔지니어링 방어). §표 썸네일·핵심 발견 14 갱신.
> 이전 갱신: 2026-06-29 **상품 이미지 기능 추가**(PRD `DOCS/PRD_상품이미지.md`, P1) — 헤더 액션부 **이미지 일괄 업로드 버튼**(`PhotoLibraryIcon`, `products:edit`, 다중 파일→`product-images` 공개 버킷, 파일명 그대로 upsert, 진행/결과 다이얼로그), **상품 표 "이미지" 썸네일 컬럼**(상품명 앞, 1:1 40px), **엑셀 "이미지" 열**(양식·목록·업로드 파싱 3곳, `image_filename` 매핑). graceful(버킷·컬럼 미적용 환경 회귀 0). API `src/api/productImages.js`. (※ 플레이스홀더는 위 결정으로 폐기.)
> 이전 갱신: 2026-06-29 **소분류·배지 마스터 CRUD를 SettingsPage→ProductManagementPage로 이동**(헤더 액션부 "소분류·배지 관리" 토글 → 펼침/접이 패널), **상품 폼 배지 입력을 칩 체크박스 토글 그룹으로 교체**(무제한 선택·3개째부터 회색 안내·직접추가 보존), **엑셀 배지 2개 초과는 경고 로그만**(행 오류 아님). 핵심 원칙: "최대 2개"는 입력 제약이 아니라 **표출 정책**(고객 카드 한정, C1). 건우님 결정.
> 이전 갱신: 2026-06-29 태그 검색 옵션 = **상품태그(products.tags) ∪ 학회목록(societies.name)** 합집합으로 확장(건우님 피드백 #3).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/ProductManagementPage.jsx`
- **검사군 API: `inpsyt-order-frontend/src/api/testGroups.js`**(`fetchTestGroups`·`createTestGroup`·`updateTestGroup`·`deleteTestGroup`·`fetchTestGroupOptionCounts`·`fetchTestGroupOptions`·`updateProductOption`·`splitTestGroup`·`mergeTestGroups` — 2026-07-02 신규). 마이그레이션 미적용 시 빈 목록/무동작 graceful. 분리=새 검사군 INSERT+옵션 test_group_id UPDATE, 병합=흡수 검사군 옵션 이관+빈 검사군 DELETE, 삭제=검사군만 제거(FK ON DELETE SET NULL로 상품 보존). **(2026-07-03 사양 추가·미구현) 이동=선택 옵션 test_group_id를 기존 검사군 id로 UPDATE(동종 연산, 새 검사군 생성 없음) — 신규 `moveOptionsToGroup(targetGroupId, productIds)` 또는 `splitTestGroup` 확장(tech-cto 결정). §옵션 옮기기 절 참조.**
- DRAFT 마이그레이션(검사 위계): `supabase/migrations/20260630000000_DRAFT_create_test_groups_master.sql`(`test_groups`), `20260630010000_DRAFT_add_products_test_group_columns.sql`(`test_group_id`·`option_name`·`option_label`·`is_common`·`sort_order`), `20260630020000_DRAFT_add_products_is_active.sql`(`is_active`) — 건우님 적용 후 실동작. 미적용 시 UI graceful(빈 목록·노출 취급).
- 관련 API: `inpsyt-order-frontend/src/api/products.js` 의 `fetchAllProducts`, **`inpsyt-order-frontend/src/api/productImages.js`**(`getProductImageUrl`·`uploadProductImage`·`PRODUCT_IMAGE_BUCKET` — 2026-06-29 신규)
- **이미지 파일명 유틸: `inpsyt-order-frontend/src/utils/productImageName.js`**(`buildProductImageFilename`·`getSafeImageExtension`·`IMAGE_EXT_WHITELIST`·`MAX_IMAGE_BYTES` — 2026-08-25 신규, 개별 폼 첨부용 안전 파일명 순수 생성. 단위 테스트 `productImageName.test.js` 11)
- DRAFT 마이그레이션(상품 이미지): `supabase/migrations/20260619020000_DRAFT_create_product_images_bucket.sql`(공개 버킷), `20260619030000_DRAFT_add_products_image_filename.sql`(`image_filename` 컬럼) — 건우님 적용 후 실동작.
- DB 스키마: `supabase/migrations/20251022045614_create_products_table.sql` + `20251022045615_add_is_popular_to_products.sql` + `20260313044014_add_product_flags.sql`
- **(계획) 카테고리 동적화**: `DOCS/PRD_오티즘_카테고리배지_동적화.md` (P1 트랙). 마스터 테이블 `subcategories`. **(2026-06-29) 소분류 마스터 CRUD UI는 본 화면(ProductManagementPage)으로 이동 완료** — 헤더 액션부 "소분류 관리" 토글 패널. 본 화면이 마스터의 단일 진실 소스 UI이자 소비처. API `src/api/masters.js`. **(2026-06-29) 동적 배지 기능 폐기** — `badges` 마스터·`products.badges`는 DB drop 예정, 코드 참조 0.
- Edge Function: `upload-products-excel` (엑셀 업로드 처리 — 컬럼만 있으면 upsert 통과, 무변경)

## 사용자 시나리오
인싸이트 직원(master 또는 editor)이 사무실에서 PC로 연다. 학회 전에 행사용 상품 카탈로그를 정리하거나, 새 상품을 등록하거나, 엑셀로 일괄 업로드한다. 인기·신상품 플래그를 켜서 고객 주문서의 노출 순서를 조정하고, 태그로 검색 편의를 만든다. 학회 중에는 거의 손대지 않는다(freeze 규칙).

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (PageHeader 합성 컴포넌트)
- [ ] 페이지 제목 아이콘: `Inventory2Icon` (PageHeader.icon prop. M3-2에서 CategoryIcon→Inventory2Icon으로 변경, 시안 정합)
- [ ] 페이지 제목 텍스트: "상품 관리" (PageHeader.title)
- [ ] 액션 버튼 그룹 (우측):
  - 엑셀 양식 다운로드 아이콘 (`DescriptionIcon`, info 톤 배경) — line 566-570
  - 상품 목록 다운로드 아이콘 (`DownloadIcon`, success 톤 배경) — line 571-575
  - **이하 `products:edit` 권한 있을 때만 표시**:
    - 엑셀 업로드 아이콘 (`UploadIcon`, warning 톤 배경, "엑셀 업로드 (product_code 기준 upsert)" 툴팁)
    - **이미지 일괄 업로드 아이콘** (`PhotoLibraryIcon`, secondary 톤 배경, "상품 이미지 일괄 업로드 (파일명 그대로 — 엑셀 '이미지' 열과 일치)" 툴팁) — **(2026-06-29 신규)** `<input type=file multiple accept="image/*">`. 선택 파일을 각각 `product-images` 공개 버킷에 **파일명 그대로**(`upsert:true`) 업로드. 진행률·실패 목록 다이얼로그(§아래). 권한 `products:edit`.
    - **"소분류 관리" 토글 버튼** (`CategoryIcon` outlined, `ExpandMore`/`ExpandLess` 끝아이콘) 클릭 시 헤더 아래 마스터 관리 패널 펼침/접이(`masterPanelOpen` Collapse). A8 SettingsPage에서 이동. 권한 가드 `products:edit`.
    - 전체 삭제 아이콘 (`DeleteForeverIcon`, error 톤 배경/색)
    - "상품 추가" 버튼 (contained, `AddIcon`)

### 소분류 마스터 관리 패널 (헤더 아래 Collapse, `products:edit` 한정 — 2026-06-29, A8에서 이동)
> **배치:** 엑셀 다운/업로드 액션부 옆 "소분류 관리" 토글로 펼침/접이. 통계 카드 위, 헤더 직하. SectionCard가 가로 flexWrap(`flex 1 1 360px`). **즉시 저장** — 다이얼로그 저장/삭제/Switch 모두 즉시 DB 반영(상품 폼 저장과 무관, 별도 흐름). 마이그레이션 미적용 시 빈 목록 graceful.
- [ ] **소분류 관리 카드** (`AccountTreeIcon`): 부제 "대분류(검사/도서/도구) 하위의 분류입니다. 고객 주문서에서 칩으로 노출되며 탐색에 쓰입니다. (매출 집계에는 영향 없음 · 추가·수정·삭제 즉시 적용)". action="소분류 추가"(contained `AddIcon`). 행: 소프트 틴트 칩(이름·색, `ColorChip`) + 소속 대분류 칩 + "순서 N" + "· 상품 N개" + is_active Switch + 편집/삭제 아이콘. 빈 상태 "등록된 소분류가 없습니다 · 추가해 시작하세요". 삭제 가드: 사용 상품>0이면 disabled + 경고.
- [ ] **소분류 추가/수정 다이얼로그**: 이름·소속 대분류 Select·색 프리셋(`MASTER_COLOR_PRESETS` 9색, 자유 hex 금지)·정렬 순서 + 미리보기. 같은 대분류 내 이름 중복 검증.
- ~~배지 관리 카드 / 배지 다이얼로그~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. 인기/신상품은 상품 폼 체크박스로 별도 관리(유지).

### 검사군 관리 = '검사' 그룹 뷰 인라인 (2026-07-02 개편 — 별도 패널 폐지)
> **배치(현행):** 별도 "검사군 관리" 토글 패널(`tgPanelOpen`)은 **폐지**. 검사군 CRUD·명명·분리·병합·옵션 편집을 전부 **'검사' 카테고리 그룹 뷰 안에 인라인 흡수**했다(건우님 최종 지시 2). `selectedCategory==='검사'`이면 무조건 그룹 뷰가 뜨고, 각 검사군 그룹 헤더 행에서 관리한다. "검사군 추가"는 그룹 뷰 진입 시 필터 바에 노출. 아래 목록/편집/분리/병합/삭제 다이얼로그는 **기존 컴포넌트를 그대로 재사용**하고 진입점만 그룹 헤더로 옮겼다. 검사군은 **검사 대분류 상품에만 해당**. 편집(검사명·약어·노출)=즉시, 위험 액션(분리/병합/삭제)=확인 스텝.

#### 검사군 목록 = 그룹 뷰 헤더 행 (2026-07-02 개편 — 별도 목록 폐지, 그룹 뷰 헤더에 인라인)
- [ ] "검사군 추가"(outlined `AccountTreeIcon`)는 '검사' 뷰 필터 바에 노출(`products:edit`). 검색은 기존 상품명 검색이 대체(별도 검사군 검색 폐지).
- [ ] 각 검사군 = **그룹 뷰의 헤더 `TableRow`**. 좌측 셀에 ▸/▾ + 약어(`abbr` `caption`/600) + 검사명(`name` `body1`/600 주인공) + "옵션 N개"(`tgOptionCounts`). `is_active=false` 검사군은 행 dim(`opacity 0.55`) + "숨김" 칩.
- [ ] 헤더 행 우측 관리 셀(`products:edit`, `colSpan={2}`, 클릭 stopPropagation):
  - **is_active Switch**(검사군 카드 노출 토글 — R4 확정: 카드 노출만 제어, 옵션 일괄 전파 안 함)
  - 편집 아이콘(`EditIcon`) → 검사명·약어 편집 다이얼로그
  - **⋮ 메뉴(`MoreVertIcon`)** → **[검사군 상세 편집] / [병합] / [삭제] 3항목**(2026-07-03 상세 편집 모달 흡수 개편). 옵션 편집·옵션 옮기기(분리·이동)·옵션 순서·개별 삭제는 전부 **상세 편집 모달**로 흡수(§검사군 상세 편집 모달 절). 병합은 모달 밖 유지(`mergeTestGroups`), 삭제는 검사군 마스터 삭제 확인 다이얼로그. 위험 액션은 확인 스텝. ~~"항목 수 불변(6번째 신설 금지)"~~ 제약은 폐기(모달 흡수로 메뉴가 3항목으로 축소됨).
- [ ] 미분류(`test_group_id` NULL 검사 상품) 그룹은 뷰 하단에 "미분류" 헤더로 묶이되 **관리 액션 없음**(마스터가 없으므로).
- [ ] 검사군 미적재(테이블 없음/시드 전) 시 그룹 뷰가 사실상 "미분류" 한 덩어리로 graceful 폴백(회귀 0).

#### 검사군 상세 편집 모달 (2026-07-03 신규 — 검사군+옵션 통합 편집)
> **컴포넌트: `TestGroupEditorModal.jsx`.** 진입 = ①그룹 헤더 편집 아이콘, ②헤더 ⋮ "검사군 상세 편집", ③필터 바 "검사군 추가"(빈 모달=신규). 검사명·약어 편집 다이얼로그 + 옵션 편집 다이얼로그(`tgDetail`) + 분리 다이얼로그(`tgSplit`)를 **폐지·흡수**한 단일 모달. **저장 시 일괄 반영**(즉시저장 아님, 검사군+옵션 변경분을 `saveTestGroupWithOptions`로 순차 반영).
- [ ] **상단**: 검사명(`name`, required) + 약어(`abbr`, nullable) + 정렬 순서(`sort_order`) `TextField` + 노출(`is_active`) `Switch`("고객 주문서 노출", off 시 "숨김" 칩). ~~미리보기 카드~~ 는 모달로 통합되며 생략(옵션 테이블이 그 자리를 대체 — 검사명·옵션이 한 화면에서 보임).
- [ ] **본문 옵션 인라인 테이블**(누락 금지): `[순서 ▲▼][옵션명 option_name][말머리 option_label][상품코드 product_code][가격 list_price][공용 is_common][노출 is_active][⋮ 이동/삭제]`.
  - 순서 = ▲▼ 버튼(로컬 재배열, 저장 시 `sort_order`=index 재기입). **드래그앤드롭 금지**(Non-Goal).
  - **기존 옵션**: 상품코드·가격은 읽기 표시(개별 상품 편집은 옵션 하위 행 편집 버튼=상품 폼). 옵션명·말머리·공용·노출·순서는 모달에서 편집.
  - **신규 옵션**(하단 "옵션 추가" 행): 옵션명·말머리·상품코드(required 수기)·가격 입력. **상품명 name = `"{검사명} {옵션명}"` 자동조합(공백 1칸, 하이픈 금지, 편집 가능)** — 사용자가 name을 직접 만지면(`nameTouched`) 자동조합 중단. 기존 옵션 name은 자동 덮어쓰기 안 함.
- [ ] **"옵션 옮기기 (분리·이동)"**: 모달 내부 버튼(저장된 옵션 1개 이상 시). 라디오 2택 (A)새 검사군 `splitTestGroup` / (B)기존 검사군 `moveOptionsToGroup`(Autocomplete, 자기 자신 제외). 옵션 체크박스 다중 선택 + 확인 문구 3블록(§옵션 옮기기 절 확인 문구 최종본 그대로). 실행 후 리로드 + 모달 로컬에서 옮긴 옵션 제거.
- [ ] **상품코드 중복 검증**: 저장 시 모달 내부 옵션끼리 + 로드된 전체 `allProducts` 대비 `product_code` 중복 감지 → 경고 메시지·저장 차단(신규 옵션 대상, 기존 옵션 id는 자기 자신 제외).
- [ ] **삭제 vs 판매중지 구분**: 옵션 ⋮ "삭제"(`deleteProductOption`, 확인 다이얼로그: "판매중지는 노출 토글로, 삭제는 되돌릴 수 없음, 과거 주문 기록은 보존됨") / 노출 `Switch`(is_active). 신규(미저장) 옵션 ⋮ 자리는 행 제거 버튼.
  - **삭제 권한 = master 전용**(products DELETE RLS `has_permission('master')`). edit 운영자는 삭제 메뉴 **disable + "삭제는 관리자(master) 권한이 필요합니다" 안내**. 권한 판별 = `hasPermission('master')`(master role이면 permissions=['master']).
- [ ] **하단**: "옵션 추가" 버튼 + 저장/취소. 저장 = `saveTestGroupWithOptions({ group, newOptions, updatedOptions, deletedIds })`(검사군 신규 INSERT/기존 UPDATE → 옵션 생성 → 옵션 수정 순차). 성공 후 `loadTestGroups`+`fetchProducts` 리로드.
- [ ] **state 격리**: 모달은 자체 로컬 state(214검사군 헤더 렌더에 영향 0). Autocomplete는 MUI 내장 필터(controlled 최상단 state 렉 방지 — A6 렉 재발 이력). graceful: 가법 컬럼 미적용 시 `createProductOption` PGRST204 재시도로 기본 상품만 생성.

#### ~~검사명·약어 편집 다이얼로그~~ (2026-07-03 폐지 — 상세 편집 모달로 흡수)
> 별도 `tgDialog` 다이얼로그·미리보기 카드 폐지. 검사명·약어·정렬·노출 편집은 상세 편집 모달 상단에서 수행.

#### ~~옵션 순서·말머리 편집~~ (2026-07-03 폐지 — 상세 편집 모달로 흡수)
> 별도 `tgDetail` 옵션 편집 다이얼로그 폐지. 말머리·형태명·공용·개별 노출·순서(▲▼)는 상세 편집 모달 본문 인라인 테이블에서 편집(저장 = 각 `products` UPDATE).

#### 옵션 옮기기 (분리·이동 — 위험 액션, 확인 스텝) [2026-07-03 일반화]
> **배경:** 자동 초벌(93% 정확)이 잘못 묶은 옵션을 교정하는 단일 진입점. 기존 "분리" 다이얼로그(체크박스 다중 선택 + 새 검사군 입력 UI)를 **일반화**해, "새 검사군으로 분리(신규)"와 "기존 검사군으로 이동(동종 연산)"을 **목적지 라디오 1개**로 흡수했다. "A검사군의 이 옵션이 사실 B(기존)검사군 소속" 케이스가 지금은 엑셀 재업로드로만 가능했는데, UI에서 직접 이동한다. **신규 독립 기능이 아니라 기존 분리 다이얼로그의 흡수·확장.**
- [ ] 트리거(2026-07-03 개편): **검사군 상세 편집 모달 내부** "옵션 옮기기 (분리·이동)" 버튼 + 옵션 행 ⋮ "다른 검사군으로 옮기기"(해당 옵션 자동 선택). ~~헤더 ⋮ 메뉴 직접 항목~~은 모달 흡수로 제거. 모달 진입 시 소속 옵션이 이미 로드됨(`fetchTestGroupOptions`, 모달이 재사용).
- [ ] **상단 목적지 라디오 2택**(MUI `RadioGroup`, 기본값 = A 새 검사군 — 기존 동작 유지):
  - **(A) 새 검사군으로** — 선택 시 **기존 분리 UI 그대로**: 새 검사군 **검사명**(`name`, required) + **약어**(`abbr`, nullable) `TextField` 2칸(현행 `tgSplitForm`). 실행 = `splitTestGroup`(새 `test_groups` INSERT + 선택 옵션 `test_group_id` UPDATE).
  - **(B) 기존 검사군으로** — 선택 시 검사명·약어 입력칸 대신 **MUI `Autocomplete` 1개**(214개 검사군, 옵션 라벨 = "약어 · 검사명", **약어·검사명 둘 다로 검색**, **자기 자신(현재 검사군) 제외**). 실행 = 선택 옵션 `test_group_id`를 **선택한 기존 검사군 id로 UPDATE**(새 검사군 생성 없음 — 동종 연산). 목적지 미선택 시 확정 버튼 disabled.
- [ ] **옵션 체크박스 다중 선택**(기존 `tgSplitSelected` 재사용) — 목적지 라디오 아래에 소속 옵션 리스트(체크박스 + 말머리 caption + 형태명/원본명). "옮길 옵션 N개 선택" 카운트.
- [ ] **확인 문구**(다이얼로그 본문·정직·자체완결, §확인 문구 최종본 참조): 목적지에 따라 이동/분리 문구 분기 + 원래 검사군 0개 되는 경우 경고 + 되돌리는 법 안내.
- [ ] 확정 버튼: (A) "N개를 새 검사군으로 분리" / (B) "N개를 '{대상검사군}'(으)로 옮기기". `color="error"`(진열 즉영향 위험 액션 — 원칙 3).
- [ ] 실행 후: `loadTestGroups` + `fetchProducts` 리로드. 분리 예: K-CDI 3분리, Holland 2분리, SCT 3분리. 이동 예: 오분류 옵션을 기존 형제 검사군으로 귀속.

##### 안 함 (엄수 — 이번 범위 밖·오버엔지니어링 방어)
- [ ] **실행취소(undo) 전면 제외.** 이동/분리 후 undo 버튼·스낵바 undo·이력 스택 없음. 되돌림은 "반대로 다시 옮기기"(수동)로만(건우님 확정). 확인 문구에 안내 1줄로 대체.
- [ ] **빈 검사군 자동삭제 제외 — 유지 + 경고만.** 옵션을 전부 옮겨 원래 검사군이 0개가 되어도 **검사군 마스터를 자동 삭제하지 않는다**(유지). 확인 문구로 "빈 검사군은 고객 진열에 미표시(PRD §엣지 옵션0 카드 미표시) · 필요 없으면 ⋮ 메뉴에서 직접 삭제" 안내만. 자동 정리 로직 금지.
- [ ] **드래그앤드롭 제외.** 옵션 이동은 체크박스 다중 선택 + 목적지 라디오만. DnD·트리 위젯 도입 금지(MUI 기존 컴포넌트만).

##### 확인 문구 최종본 (정직·자체완결·아첨 없음 — 2026-07-03)
> 다이얼로그 본문 `Typography`(`text.secondary`)로 표시. 아래 3블록을 조건부로 이어 붙인다. 과장·격려·감탄사 금지("좋습니다" 등). 대상·개수·결과만 사실대로.
- [ ] **이동 시(공통, 항상 표시)**: `"옵션 N개를 '{대상검사군}'(으)로 옮깁니다. 진열이 즉시 바뀝니다."`
  - (A) 새 검사군일 때 `{대상검사군}` = 입력한 새 검사명. (B) 기존 검사군일 때 = 선택한 검사군명.
- [ ] **원래 검사군이 0개가 되는 경우(추가)**: `"'{원래검사군}'에 남는 옵션이 없어집니다. 빈 검사군은 고객 진열에 표시되지 않으며, 필요 없으면 ⋮ 메뉴에서 직접 삭제하세요."`
  - 판정 = (선택 옵션 수 === 현재 검사군 소속 옵션 수). 빈 검사군 자동삭제는 안 함(위 §안 함) — 경고만.
- [ ] **되돌리는 법(항상 표시, 마지막 줄)**: `"잘못 옮겼다면 반대로 다시 옮기면 됩니다."`
  - undo 없음(§안 함)을 이 한 줄이 대체. 조작이 가역적임을 알려 심리 부담 완화.

#### 병합 (N 검사군 → 1 — 위험 액션, 확인 스텝)
- [ ] 트리거(2026-07-02 개편): 그룹 헤더 ⋮ 메뉴 → "병합". 그 검사군이 **대표(keep)** 로 지정되고, 다이얼로그에서 **흡수할 다른 검사군을 체크박스로 다중 선택**한다(기존 "목록에서 2개 이상 체크" 방식 대체).
- [ ] 다이얼로그: 대표 검사군 표기 + 흡수 대상 목록(체크박스·검사명·약어·옵션 N) + "되돌리려면 다시 분리해야 합니다" 경고. 확정 버튼 "N개를 대표로 병합".
- [ ] 실행 = 흡수되는 검사군들의 옵션 `test_group_id`를 대표로 UPDATE + 빈 검사군 삭제(`mergeTestGroups`). 예: SCT 성인·청소년·아동을 지침서 공용 판단으로 병합.

#### 검사군 삭제 (위험 액션, 확인 스텝)
- [ ] "삭제"는 검사군 마스터만 제거. **소속 상품은 삭제하지 않고** `test_group_id`를 NULL로(평면 진열로 복귀) — 상품 데이터 보존.
- [ ] 확인: **"검사군 '{이름}'을 삭제합니다. 소속 옵션 N개는 검사군에서 풀려 낱개로 진열됩니다(상품 자체는 삭제되지 않음). 계속할까요?"**. 절판 상품은 삭제가 아니라 `is_active=false`(숨김)로 처리하도록 다이얼로그에 안내 1줄.
- [ ] ⚠️ 상품 자체 삭제는 기존 상품 표의 선택 삭제·전체 삭제(받아쓰기)로. 검사군 관리에서 상품을 지우지 않는다(혼동 방지).

> **AI 시그니처 금지 재확인:** 검사군 관리 화면에 컬러 인디케이터바·그라데이션·가짜 통계 배치 금지. 리스트+칩+다이얼로그(기존 소분류 관리·상품 표 패턴 재사용)만. theme.js 무수정·MUI 컴포넌트(Table/List·Switch·Dialog·Chip)만.

### 필터 바 (2026-10-19 재설계 — 구 "통계 카드 6장" + "검색·필터 카드" 통합, 건우님 확정)
> **변경 배경:** 단일 값 `productQuickFilter` 카드(전체 상품/할인 가능/개별 할인/인기 상품/온라인코드 미확인/도서/검사/도구)는 한 번에 한 조건만 걸려 "도서 중 할인 안 되는 것" 같은 교차 점검이 불가능했다. 2026 대한신경정신의학회 추계 입금결의서 불일치(주문 품목 카테고리 누락)를 계기로, 상품 속성을 조합해 이상을 찾을 수 있는 **속성별 패싯 필터**로 재설계한다.
> **상태 모델(확정):** 각 속성은 단일 선택(미선택=전체 / Y / N), **속성 간 AND**, **태그만 OR**. 필터 변경 시 1페이지 리셋. 단일 `productQuickFilter` state는 속성별 state(`'all'|'y'|'n'` 등)로 교체.
> **건수 표시(확정):** 옵션별 건수는 **표시하지 않는다**(조합마다 수치가 달라져 혼란). 상단 "{totalFiltered}개 표시 중" 합계만 노출.
> **제약:** MUI 컴포넌트만(ToggleButtonGroup/Chip/Checkbox/Button), theme.js 무수정, AI 시그니처(그라데이션·컬러 인디케이터바·가짜 통계) 금지. PC 전용 화면.

- [x] (삭제) **"전체 상품" 카드 → "필터 초기화" 버튼**으로 대체(outlined, `RestartAltIcon`). 상시 노출, 걸린 필터가 없으면 disabled. `handleResetFilters` 재사용 — 검색어·카테고리·모든 Y/N 속성·태그를 전부 초기화.
- [x] **배치 순서(2026-10-19 건우님):** ① 우측 상단 "N개 표시 중" + 필터 초기화 → ② 카테고리 → ③ Y/N 속성 → ④ 태그 → ⑤ **상품명 검색(맨 아래)**. 조건으로 거른 뒤 마지막에 이름으로 좁히는 흐름.
- [x] **'미확인' 선택지는 언제나 맨 오른쪽(끝)** — 온라인코드에 적용. (카테고리 '미확인'은 2026-10-19 폐지 — 아래)
- [x] 표시 건수: "{totalFiltered}개 표시 중" — 필터가 걸렸을 때 노출(현행 유지). 숫자만 `text.primary` 굵게.
- [ ] **카테고리**(2026-10-19 개정, 건우님): **다중 선택(OR)** [전체] [검사] [도서] [도구] — 이 순서. '전체' = 선택 없음(기본). 카테고리를 누르면 '전체'가 풀리고, '전체'를 누르거나 모두 해제·셋 다 선택하면 '전체'로 돌아간다. **'미확인' 폐지** — 카테고리는 상품 등록 시 필수값이라 빈 값이 생기지 않는다.
  - ~~'미확인' = 세 값 어느 것도 아닌 상품~~ (폐지).
  - **'검사' 선택 시 동작 보존**: 검사군 그룹 뷰(`groupViewActive`)가 유일 뷰, 필터 바에 "검사군 추가" 버튼 노출. **(2026-10-19 개정) 그룹 뷰는 '검사'만 단독 선택했을 때.** 다른 카테고리와 함께 고르면 평면 표.
- [x] **할인 여부**(`is_discountable`): 전체 / Y / N
- [x] **개별 할인**(`discount_override != null`): 전체 / Y / N
- [x] **인기 상품**(`is_popular`): 전체 / Y / N
- [x] **신상품**(`is_new`): 전체 / Y / N — (신규: 현행엔 신상품 필터가 없었음)
- [x] **이미지 등록**(`image_filename`): 전체 / Y(값 있음) / N(NULL·빈 문자열) — (2026-10-19 신규, 건우님)
- [ ] **판매상태**(`is_active`, 고객 주문서 노출): 전체 / Y(노출) / N(숨김) — (2026-10-19 신규, 건우님). 컬럼 미적용 환경(undefined)은 Y 취급(상품 표 '숨김' 칩 규칙과 동일).
- [x] **온라인코드**(`includes_online_code`): 전체 / Y(true) / N(false) / 미확인(NULL) — 미확인 끝.
  - 필드값 3상태 그대로 거른다(구 '미확인' 카드의 `category='검사'` 한정 조건은 **제거**). 비검사 상품은 엑셀 파서가 false로 강제하므로 미확인은 실데이터상 사실상 검사에만 존재.
- [x] **태그**: 체크박스 다중 선택, 매칭 **OR**(선택한 태그 중 하나라도 가진 상품).
  - 옵션 소스 = **학회 관리의 학회 목록(`societies.name`, 예 TEST … 한국심리학회) ∪ 기존 상품 자유 태그(`products.tags`)**. 학회명을 앞쪽에, 나머지 자유 태그를 뒤쪽에 정렬. societies는 `getSocieties()`(`api/events.js`) — SocietyManagementDialog·EventManagementPage와 동일 소스.
- [x] 상품명 검색(맨 아래): `ProductSearchBar`(로컬 state + debounce) 그대로 유지 — 메모리 규칙(검색 input 격리, controlled 최상단 state 금지). 검색 대상(상품명 + 검사군 name·abbr) 무변경.
- [x] `hasFilters` = 검색어 ∨ 카테고리 ∨ Y/N 속성 중 하나라도 'all' 아님 ∨ 태그 선택 1개 이상.

> 구현 위치(2026-10-19 구현 후): 판정 로직 `utils/productFilters.js`(+ `productFilters.test.js` 12건), 페이지 상수 `CATEGORY_FILTER_OPTIONS`·`YN_OPTIONS`·`ONLINE_CODE_OPTIONS`(파일 상단), `FacetToggle`(모듈 스코프 컴포넌트), `facets` state, `availableTags`·`societyTagSet`(useMemo → `buildTagOptions`), 필터 로직 `filteredProducts`, `hasFilters`, `handleResetFilters`·`setFacet`, 필터 바 SectionCard(주석 `필터 바(A6 §필터 바 2026-10-19)`), `groupViewActive`(`selectedCategory==='검사'`). 구 빠른 필터 카드(`renderQuickFilterCard`)·카드 집계 memo(`totalProducts`·`totalDiscountableCount`·`totalOverrideCount`·`totalPopularCount`·`totalOnlineCodeUnknownCount`·`categoryCounts`) 삭제.
> **범위 밖(별도 트랙, tech-cto 소관):** 이번 입금결의서 불일치의 실제 원인은 상품이 아니라 `order_items` 스냅샷(category·product_name) 누락 — 어드민 신규 주문 등록(NewOrderModal)이 저장하지 않음. 이 필터로는 탐지되지 않는다. NewOrderModal 스냅샷 저장·입금결의서 미분류 경고·과거 주문 백필은 별도로 진행.

### 선택 시 액션바 (line 738-768, `selectedCount > 0` 이고 `products:edit` 권한 있을 때)
- [ ] 선택 표시: `CheckBoxIcon` + "{selectedCount}개 선택됨" (primary 색, 굵게)
  - **(2026-08-25 QA P0-3)** 그룹 뷰(`groupViewActive`)이고 선택이 있으면 선택 표시 아래 캡션 1줄 **"선택된 상품이 현재 화면에 보이지 않을 수 있습니다."**(`caption`/`text.secondary`). 그룹 뷰엔 전체 선택 체크박스가 없어 선택은 평면 뷰에서 넘어온 잔여분일 수 있고, 접힌 검사군의 안 보이는 항목이 선택돼 있을 수 있으므로 조용한 오삭제 방지 안내.
- [ ] "선택 항목 편집" 버튼: outlined, `TuneIcon`
- [ ] "선택 삭제" 버튼: outlined error, `DeleteIcon`
- [ ] "선택 해제" 버튼: text 버튼

### 상품 표 (line 770-898)
- [ ] 표 컬럼(권한별): 체크박스(`products:edit` 시) / **이미지(중앙)** / 상품명 / 카테고리 / 하위 카테고리 / 가격(오른쪽 정렬) / 비고 / 상태 태그(중앙) / 태그 / 작업(`products:edit` 시)
- [ ] 행 표시 — 누락 금지:
  - 체크박스(개별)
  - **이미지 썸네일 — (2026-06-29 신규; 2026-06-29 플레이스홀더 폐기)**: 상품명 앞 컬럼. 1:1 40px(`borderRadius 1`, `objectFit cover`, `loading lazy`). `image_filename` 있으면 `getProductImageUrl`로 썸네일. **없으면/onError면 `ProductThumb`이 `return null` — 셀 비움(썸네일·플레이스홀더 미표시).** 기존 회색 박스+ImageIcon 플레이스홀더 폐기(건우님 2026-06-29). "이미지" 컬럼 자체는 유지(있는 상품만 썸네일). **대부분 미등록(NULL)이 정상.** C1 카드와 동일 정책.
  - 상품명 (`name`, fontWeight 500)
  - 카테고리 칩 (primary outlined, 라벨=`category`) — **대분류(검사/도서/도구 고정 3)**
  - 하위 카테고리 (`sub_category`, 없으면 "-") — **소분류. 동적 마스터(`subcategories`)와 이름 자연키로 연결.** **(2026-06-29 구현)** 마스터에 등록된 이름이면 마스터 색 소프트 틴트 칩(`ColorChip`), 미등록이면 회색 "· 미등록" 칩 표시(FK 안 검·운영 마찰 방지 — PRD §엣지).
  - 가격 (`list_price`, 천 단위 콤마 + "원", 굵게)
  - 비고 (`notes`, maxWidth 220, 한 줄 잘림)
  - **상태 태그 컬럼 — 누락 금지** (line 844-858):
    - "인기" 칩 (warning, `is_popular=true`일 때)
    - "신상품" 칩 (primary, `is_new=true`일 때)
    - "할인" 칩 (success 톤, `is_discountable=true`일 때)
    - **"온라인코드" 칩 (secondary 소프트 틴트, `includes_online_code === true`일 때)** — (2026-08-18 신규). 미확인(null)/미포함(false)은 무표시(노이즈 방지, 미확인은 퀵필터로 추적)
    - ~~동적 배지~~ — **(2026-06-29 폐기)** 동적 배지 칩 제거.
    - 넷 다 비활성(인기·신상품·할인 false + 온라인코드 true 아님)이면 "-" (caption)
  - **노출 상태 표시 — (2026-07-02 신규, is_active)**: `is_active=false`(숨김) 상품은 **행 전체를 회색 dim**(`opacity 0.55` 또는 `text.disabled` 톤)하고 상품명 옆(또는 상태 태그 컬럼 맨 앞)에 "숨김" 칩(`gray[200]` 배경 + `text.secondary`, 소프트 틴트). **`is_active=true`(노출 중)는 칩 없음**(기본 상태라 무표시 — 노이즈 방지). **숨김 상품이 표에서 사라지지 않는다**(재판매·이관 대비, PRD §절판 처리). 필터로 숨김만/노출만 보기는 별도 빠른 필터(아래 §필터 참조, 1차 선택). is_active는 검사·도서·도구 공통 전역 필드 — 검사 위계 UI에 종속되지 않는다.
  - 태그 (앞 2개 칩 + "+N" 칩으로 나머지)
  - 작업: 편집 아이콘 (`EditIcon`)
- [ ] 페이지네이션: 페이지당 항목 수 셀렉트 (10/25/50/100) + Pagination 컴포넌트

### 검사군 그룹 뷰 (검사 카테고리 = 디폴트이자 유일 뷰 · 조회+수정 — 2026-07-02 개편, 건우님 지시 1·2)
> **목적:** 인싸이트 직원이 사무실 PC에서 검사 상품 1,134행을 볼 때, C1 고객 화면과 동일한 검사군(약 214개)→옵션 2뎁스로 접어서 확인·수정. 평면 1,134행을 검사군 단위로 요약해 "이 검사에 옵션이 몇 개인지·어떻게 묶였는지"를 고객이 보는 그대로 검수하고, 같은 화면에서 검사군·옵션을 편집한다.
> **탭 분리 금지(CPO 기각).** 카드 클릭 필터(`selectedCategory`)가 카테고리 전환을 담당한다.

#### 뷰 전환 (토글 폐지 — 2026-07-02 개편)
- [ ] **`selectedCategory === '검사'`이면 무조건 그룹 뷰**(`groupViewActive = selectedCategory === '검사'`). 별도 "검사군 묶어보기" `Switch`(`groupView` state)는 **폐지**(건우님 지시 1). 검사 = 그룹 뷰, 다른 값은 평면.
- [ ] **도서·도구·전체(빈 카테고리)는 평면 표.** '전체'에서 검사 상품이 평면에 섞여 나오는 현행 유지(전체 조망용). '검사' 선택 시에만 그룹 뷰.
- [ ] **기본 접힘.** 검사군 헤더만 214행 진열, 옵션은 헤더 클릭 시 펼침. 페이지네이션은 그룹 뷰에서 숨김(헤더 전량 렌더).
- [ ] **(2026-08-25 QA P0-3) 그룹 뷰에는 헤더 전체 선택 체크박스가 없다.** 표 헤더의 체크박스 셀은 유지하되 그룹 뷰에선 `Checkbox`를 렌더하지 않고 빈 셀로 컬럼 정렬만 보존(`{!groupViewActive && <Checkbox .../>}`). 전체 선택 로직이 평면 슬라이스(`displayedProducts`)를 참조해 안 보이는 상품을 선택·삭제하는 결함 방지. 옵션 하위 행의 개별 체크박스는 그대로 유지. 그룹-aware 전체 선택 모델은 검사군 팬아웃 편집 트랙(승인 대기)에서 다룬다.
- [ ] 시각: 그라데이션·컬러 인디케이터 금지(MUI `Table`/`Chip`/`Switch`만).

#### Before / After 구조 요약
- **평면 뷰(도서·도구·전체):** 상품이 평면 `Table` 행으로 나열. 검사 상품 상품명 = 원본 풀네임.
- **검사 그룹 뷰:** **검사군 그룹 헤더 행**(약 214행) + 펼침 시 그 아래 **옵션 하위 행**. C1 `TestGroupCard`와 동일한 2뎁스 위계(검사명 주인공·약어 보조·옵션 N). 평면 대비 스캔 대상 1,134→214 축소. **컬럼·표 골격 그대로**. 헤더 행 우측에 검사군 관리 액션 인라인(노출/편집/⋮).

#### 검사군 그룹 헤더 행 표기 (C1 카드와 정합)
- [ ] 헤더 행은 상품 표의 **한 `TableRow`** 로, 소속 옵션을 접었다 폈다 하는 아코디언 트리거.
  - **좌측 셀(상품명 컬럼 위치)**: ▸/▾ 펼침 아이콘 + **약어**(`test_groups.abbr`, `caption`/600/`text.secondary` — 좌측 보조 위계, 없으면 생략) + **검사명**(`test_groups.name`, `body1`/600 — 주인공, wrap) → **C1 카드 접힘 상태의 약어·검사명 위계와 동일**.
  - **"옵션 N개"**: `tgOptionCounts[group.id]` 재사용(`body2`/`text.secondary`). C1 카드의 "옵션 N개"와 동일 문구. **가격은 헤더에 미표기**(C1 검사군 카드 가격 은닉 규칙과 정합 — 헤더는 묶음 요약, 가격은 옵션 행에서만).
  - **`test_groups.is_active === false` 검사군**: 행 dim(`opacity 0.55`) + "숨김" 칩(상품 표 기존 숨김 칩과 동일 패턴 재사용).
  - 그룹 헤더 행의 좌측 요약 셀은 `colSpan`으로 중간 컬럼을 병합하고, **우측 관리 셀(`colSpan={2}`)에 검사군 단위 인라인 액션**(노출 Switch·편집·⋮ 메뉴)을 둔다(2026-07-02 개편 — 읽기 전용에서 "조회+수정"으로). 미분류(`group===null`)는 관리 셀 없음.
- [ ] 정렬: `test_groups.sort_order` → 검사명(마스터 조회 정렬 그대로). `test_group_id`가 없는(미분류) 검사 상품은 **뷰 하단에 "미분류" 그룹**으로 묶어 노출(누락 금지 — graceful).

#### 옵션 하위 행 (기존 표 컬럼 재사용)
- [ ] 그룹 헤더를 펼치면 소속 옵션(`fetchTestGroupOptions(group.id)` — **기존 API 재사용, 신규 API 금지**)이 **상품 표의 기존 컬럼 구조 그대로** 하위 행으로 나열. 즉 옵션 하위 행 = **평면 표 행과 동일한 셀 구성**(이미지·상품명·카테고리·하위카테고리·가격·비고·상태태그·태그·작업). 들여쓰기(상품명 셀 좌측 pad)로 하위 위계 표현.
  - 상품명 셀은 원본 `name` 대신 **말머리(`option_label`) + 형태명(`option_name`)** 조합 표시 권장(C1 옵션 행 정합) — 단 마스터 미정제 상품은 원본 `name` 폴백. 나머지 셀은 평면 표와 100% 동일 렌더(가격·상태칩·태그·`is_active` dim 그대로 재사용 — 별도 렌더 로직 안 만듦).
  - **작업(편집) 아이콘은 옵션 하위 행에 유지** — 개별 상품 수정(상품명·가격·태그·노출 등)은 기존 상품 편집 다이얼로그로. **말머리(`option_label`)·옵션명(`option_name`)·순서(`sort_order`)는 검사군 헤더 ⋮ 메뉴 → "옵션 편집" 다이얼로그**(기존 `tgDetail` 재사용)에서 편집.
- [ ] 페이지네이션: 그룹 뷰에서는 숨김(헤더 214개 전량 렌더). 옵션 펼침은 현재 페이지 내 아코디언.

#### 역할 분담 (2026-07-02 개편 — 별도 패널 폐지)
- [ ] **검사군 단위 편집(검사명·약어·노출·분리·병합·삭제) = 그룹 헤더 행 인라인 액션(노출 Switch·편집·⋮ 메뉴).** **옵션(상품) 단위 편집** = 헤더 ⋮ "옵션 편집"(말머리·옵션명·순서·공용·개별 노출) + 옵션 하위 행의 상품 편집 버튼(그 외 상품 필드). 검사군 조회·수정이 **'검사' 화면 하나**에 통합됨("검사군 관리"라는 별도 개념 소멸).

#### 제약 (엄수 — frontend 구현 시)
- [ ] **엑셀 흐름 = 지시 3으로 위계 열 추가**(§엑셀 컬럼 매핑 참조). 단, 단일 양식·`product_code` upsert·기존 열은 무변경.
- [ ] **신규 API 최소화.** 기존 `testGroups` 함수 재사용, 엑셀 왕복 검사군 매칭용 `makeTestGroupResolver`만 추가(내부에서 기존 `createTestGroup` 재사용). graceful: `test_group_id`/`test_groups` 미적용이면 검사군 0개 → "미분류" 한 덩어리 폴백(회귀 0).
- [ ] **theme.js 무수정 · MUI만 · AI 시그니처(그라데이션·컬러바·가짜 통계) 금지.** 기존 `Table`·`Chip`·`Switch`·`Menu` 패턴 재사용.
- [ ] 상품 표 기존 컬럼·상태칩·`is_active` dim·권한 가드(`products:view`/`products:edit`) 전부 보존.

### 정렬 규칙
- [ ] 정렬: 인기 상품 우선 → 이름 가나다순 (line 175-179)

## 액션·기능 (누락 금지)

- [x] 검색어 입력 → 페이지 1 리셋 + 클라이언트 필터링
- [x] 카테고리 토글 [도서|검사|도구|미확인] → `selectedCategory` 단일 선택(활성 재클릭 시 전체로 해제) (2026-10-19)
- [x] 속성 토글(할인 여부·개별 할인·인기 상품·신상품·이미지 등록 [전체|Y|N], 온라인코드 [전체|Y|N|미확인]) → `facets` 속성별 단일 선택, 속성 간 AND (2026-10-19, 구 `productQuickFilter` 카드 대체)
- [x] 태그 체크박스 칩 클릭 → 다중 선택 토글(OR)
- [x] 필터 초기화(상시, 필터 없으면 disabled) → 검색·카테고리·속성·태그 모두 리셋 + 1페이지
- [ ] 체크박스 전체 선택/해제 (평면 뷰 현재 페이지 기준). **(2026-08-25 QA P0-3) 검사 그룹 뷰에선 헤더 전체 선택 체크박스를 렌더하지 않음** — 그룹 뷰는 검사군 헤더를 렌더하는데 `handleToggleAll`이 평면 슬라이스(`displayedProducts`)를 참조해 안 보이는 상품을 선택하는 오삭제 위험. 빈 셀로 정렬만 유지. 그룹-aware 전체 선택은 팬아웃 편집 트랙 선결 과제.
- [ ] 체크박스 개별 토글 (평면 행·펼친 옵션 하위 행 공통)
- [ ] 상품 추가 다이얼로그 (line 912-947): 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인가능·인기·신상품·**온라인코드 포함(3상태)**·태그
- [ ] 상품 수정 다이얼로그 (편집 아이콘 클릭, 같은 폼)
- [ ] 선택 삭제 다이얼로그 (line 937-949): "선택한 {N}개 상품을 삭제합니다" + "이 작업은 되돌릴 수 없습니다."
- [ ] 전체 삭제 다이얼로그 (line 951-975): **`"삭제합니다"` 텍스트 입력 받아쓰기 확인** (DELETE_ALL_CONFIRM_TEXT). Enter로 확정.
- [ ] 선택 항목 일괄 편집 다이얼로그 (line 977-1014):
  - 인기 상품: TriState 토글(변경 없음/ON/OFF)
  - 신상품: TriState 토글
  - **온라인코드 포함: TriState 토글(변경 없음/ON=포함/OFF=미포함)** — (2026-08-18 신규). "변경 없음"이면 기존 값 보존(미확인 NULL 유지). 일괄로는 포함/미포함만 확정, NULL(미확인)로 되돌리기는 개별 폼·엑셀로. 컬럼 미적용 시 PGRST204 감지→해당 키 빼고 1회 재시도(graceful)
  - 태그: 추가/덮어쓰기 모드 토글 + Autocomplete 입력
- [ ] 엑셀 양식 다운로드 (`handleDownloadTemplate`): **(2026-08-25 정적화)** `/templates/product-upload-template.xlsx` 정적 파일을 그대로 다운로드(안내문·색상·틀고정·상품 예시 9행 1:1 보존). 하드코딩 샘플 생성 폐기. 양식 v2 = 1행 안내문·2행 헤더(A~T 20열).
- [ ] 상품 목록 다운로드 (`handleDownloadExcel`): **(2026-08-25 서식화)** 양식 v2 정적 템플릿을 ExcelJS로 열어 예시 9행을 지우고 전체 상품을 채워 내보냄 — 안내문 1행·색상 헤더·검사 전용 열 색·틀고정 A3·자동필터 서식 그대로. json_to_sheet(맨 시트) 폐기. **동일 열 이름·순서(A~T 20열)**, 다운로드→수정→업로드 라운드트립(§엑셀 컬럼 매핑 참조).
- [ ] 엑셀 업로드 (line 352-496): 청크 100건 단위, 진행률·로그·오류 표 + "오류 내역 복사" 액션

## 입력 폼 구조

### 상품 추가/수정 폼 (line 912-947)
- [ ] 상품명 (`name`, autoFocus, `products:edit` 없으면 disabled)
- [ ] 상품 코드 (`product_code`)
- [ ] 카테고리 (`category`) + 하위 카테고리 (`sub_category`) — **두 필드 별도, 가로 배치, 분리 입력 필수**
  - **현재(2026-06-24 구현)**: 카테고리 = **필수 `Select`**(검사/도서/도구 고정 3, `categories` 상수). 자유 입력·빈값 불가. 미선택 저장 시 `handleSave`에서 차단 + `FormControl error`(붉은 보더) + 경고 토스트("카테고리를 검사/도서/도구 중에서 선택해 주세요."). 하위 카테고리 = 자유 텍스트 `TextField` 유지(소분류는 동적).
  - **(P1 동적화 — 2026-06-29 구현) 하위 카테고리** = 소분류 마스터(`subcategories`, 선택된 대분류에 소속·`is_active` 것만 필터) **Autocomplete freeSolo**. 마스터 선택 우선·엑셀 호환 위해 직접 입력 허용(미등록은 회색 helperText 경고). 두 필드 **별도 유지**.
- [ ] 가격 (`list_price`, type="number")
- [ ] 비고 (`notes`, multiline rows=3)
- [ ] **상품 이미지 섹션 — (2026-08-25 신규, `image_filename`)**: '비고' 아래. "상품 이미지" 제목 + 72px 정방형 미리보기(`ProductImagePreview`, `getProductImageUrl`, 로드 실패·미등록 시 "이미지 없음" 문구·`key={image_filename}` remount) + **[이미지 첨부]** 버튼(`PhotoLibraryIcon`, 단일 파일 `<input type=file accept="image/*" hidden>`, 첨부 중 `CircularProgress`·disabled) + **[제거]** 버튼(`image_filename` 있을 때만, `image_filename=''` 세팅) + 안내 `caption` "JPG·PNG·WEBP·GIF, 1MB 이하(200KB 이하 권장). 파일명은 자동으로 정리됩니다." **권한 `products:edit`**(없으면 버튼 미표시, 미리보기만). **일괄 업로드와 파일명 정책 다름**: 개별 첨부는 파일명을 `buildProductImageFilename`으로 안전하게 새로 지어(`p{코드/ID}-{ts}.{ext}`) **한글 파일명 사진도 그대로 받는다**(거부 안 함). 확장자 화이트리스트 jpg/jpeg/png/webp/gif·크기 하드상한 1MB. 첨부 즉시 버킷 업로드(리네임)·`image_filename` 반영은 저장 시(폼 상태). 저장 취소 시 DB 미반영·버킷 파일은 잔류(롤백 안 함, 무해).
- [ ] 플래그 체크박스 — 세 개 별도(절대 통합 금지):
  - "할인 가능" (`is_discountable`)
  - "인기 상품" (`is_popular`)
  - "신상품" (`is_new`)
- [ ] **온라인코드 포함 — (2026-08-18 신규, `includes_online_code`) 3상태 `Select`**(체크박스 아님): 미확인(null)/포함(true)/미포함(false). 같은 행(할인율·인기·신상품 옆) `minWidth 180`. **체크박스 2상태로 뭉개지 않는다** — NULL(미확인)을 명시 보존해야 미확인 상품을 퀵필터로 추적·확정할 수 있다. 신규 상품 기본 = 미확인(null). 고객 주문서의 인싸이트 ID 소프트 필수 판정(C1)과 출고 안전망(A3)의 상위 소스
- [ ] **노출 여부 Switch — (2026-07-02 신규, `is_active`)**: 플래그 체크박스 3종과 **별도 행**에 `Switch` 컴포넌트로 배치(체크박스 아님 — on/off 상태가 진열에 즉시 영향인 "전역 스위치"라 체크박스와 시각 구분). 라벨 "고객 주문서 노출" + 보조문구 `caption`/`text.secondary` "끄면 주문서에서 숨겨집니다 (데이터는 보존 — 삭제 아님)". 기본값 `true`(신규 상품은 노출). off 시 Switch 회색·라벨 옆 "숨김" 칩. **검사 위계 전용 아님** — 모든 상품(검사/도서/도구) 폼에 공통 노출.
- [ ] 태그 (`tags`, Autocomplete multiple freeSolo, `availableTags` 옵션)
- ~~배지 (`badges`)~~ — **(2026-06-29 폐기)** 동적 배지 입력 필드 제거. 고객 노출 강조는 인기/신상품 boolean 체크박스(위)로만.

## 권한별 차이

- `products:view` 없음 → "상품 관리 페이지 접근 권한이 없습니다." 출력 (line 553-555)
- `products:view` 있음 (viewer): 표·카드·필터·검색·다운로드 가능. 체크박스 컬럼 안 보임, 추가/편집 버튼 안 보임, 액션바 안 뜸, 폼 모든 필드 disabled, 저장 버튼 안 보임.
- `products:edit` 있음 (master, editor): 모든 액션 가능
- 다이얼로그 폼은 권한 없으면 disabled로 열림(보기 전용)

## 데이터 모델

### `products` 테이블
- `id` (bigint, PK)
- `created_at` (timestamptz)
- `product_code` (text) — upsert 키
- `category` (text) — **대분류**, `'도서'` / `'검사'` / `'도구'` 중 하나 (코드 상수 `categories`, 고정 3). 매출·정산·대시보드 집계 키.
- `sub_category` (text, nullable) — **소분류**(동적). 마스터 `subcategories`와 **이름 자연키** 연결(FK 미설정 — 엑셀 호환). **노출·탐색 전용**(매출 집계 미참여 — 회계 안전). 기존 컬럼 활용(추가 0).
- ~~`badges` (text[])~~ — **(2026-06-29 폐기)** 동적 배지 컬럼은 DB drop 예정. 코드 참조 0(읽기·쓰기 모두 제거).
- `image_filename` (text, nullable — **P1 신규**, DRAFT `20260619030000_DRAFT_add_products_image_filename.sql`) — `product-images` 공개 버킷 내 객체 경로(예: `abc.webp`). NULL=이미지 없음. 채우는 경로 3가지: **① 엑셀 "이미지" 열 / ② 헤더 이미지 일괄 업로드**(둘 다 파일명 = 영문/숫자·`.`·`-`·`_`만 허용, 한글·공백·특수문자 거부 — 엑셀 열과 매칭해야 하므로 원본 파일명 강제) / **③ (2026-08-25 신규) 개별 상품 폼 첨부**(파일명을 `utils/productImageName.js`의 `buildProductImageFilename`으로 `p{안전화한 코드/ID}-{timestamp}.{ext}`로 새로 지음 → 한글 파일명 사진도 그대로 받음, SAFE_IMAGE_FILENAME 통과 보장). Storage 키 안전성이 공통 목적이나 개별 첨부는 우리가 값을 직접 채우므로 원본 파일명을 강제하지 않는다. graceful(컬럼 미적용 환경 회귀 0 — 빈값 payload 제외 + `PGRST204` 시 `image_filename` 빼고 재시도. 개별 폼 '제거'는 편집 시 NULL 명시 저장으로 기존 값 삭제).
- `name` (text)
- `list_price` (numeric)
- `notes` (text, nullable)
- `is_discountable` (boolean, default false)
- `is_popular` (boolean, default false)
- `is_new` (boolean, default false)
- `is_recommend` (boolean, default false) — **마이그레이션에는 있으나 ProductManagementPage UI에 노출 안 됨, 확인 필요**
- `includes_online_code` (boolean, **nullable — 3상태: NULL(미확인)/true(포함)/false(미포함)**) — **(2026-08-18 신규, backend-engineer 병렬 씨딩)**. 온라인코드를 포함한 상품 여부. NULL=아직 확인 안 함(신규 상품 기본·백필 전). 고객 주문서(C1) 인싸이트 ID 소프트 필수 판정과 출고 안전망(A3)의 상위 소스. 폼 3상태 Select·일괄 TriState·엑셀 "온라인코드포함" 열로 관리, 퀵필터 "온라인코드 미확인"으로 미확인 추적. graceful: 컬럼 미적용(`undefined`) 환경은 NULL 취급 + 저장 시 PGRST204 재시도로 키 제외(회귀 0)
- `is_active` (boolean, default true) — **노출여부(전역 필드). (2026-07-02 UI+API 구현)** false=고객 주문서에서 숨김(절판·판매중지). **삭제 아님** — 재판매·이관 대비 데이터 보존(PRD_검사위계.md §절판 처리, K-BASC-2·K-Bayley-Ⅲ·K-WAIS-IV 등). 검사 위계 전용이 아닌 **검사/도서/도구 공통**. 상품 표 상태칩·폼 Switch로 관리. graceful: 컬럼 미적용 환경(`is_active===undefined`)은 노출로 취급 + `handleSave` PGRST204 재시도로 키 제외(회귀 0). **DRAFT 마이그레이션 `20260630020000_DRAFT_add_products_is_active.sql` 존재**(가법 컬럼, `ADD COLUMN IF NOT EXISTS`) — 건우님 적용 전이면 코드가 graceful 처리.
- `test_group_id`·`option_name`·`option_label`·`is_common`·`sort_order` (검사 위계 신규 가법 컬럼, PRD_검사위계.md) — **'검사' 그룹 뷰의 인라인 액션·옵션 편집 다이얼로그·엑셀 위계 열이 편집**. 도서·도구는 대부분 NULL. 엑셀 왕복 시 검사군 매칭(약어,검사명)→`test_group_id` 연결(`makeTestGroupResolver`).
- `tags` (text[] — 코드에서 배열 사용. 마이그레이션 SQL에는 명시 없음, 확인 필요)

### 엑셀 컬럼 매핑 (양식 v2 — 파서: `utils/productExcel.js`, 2026-08-25 컴포넌트에서 분리)
> **양식 v2 구조**(`public/templates/product-upload-template.xlsx`): 1행=안내문(주황 톤), 2행=헤더(A~M 공통 파랑 / N~T 검사 전용 색), 3행~=상품 예시 9행(도서2·도구2·검사5). 틀고정 A3·자동필터 A2:T11. **판매여부가 H열(할인 옆, 공통 구역)** 로 온 것이 v2 핵심 변경.
> **열 순서(A~T, 20열)**: A 상품명 · B 상품코드 · C 카테고리(검사/도서/도구) · D 하위카테고리 · E 가격 · F 비고 · G 할인여부(Y/N) · H 판매여부(Y/N) · I 개별할인율(%/공란) · J 배지_인기(Y/N) · K 배지_신규(Y/N) · L 태그 · M 이미지 · N 검사군약어 · O 검사군명 · P 옵션명 · Q 공용(Y/공란) · R 말머리 · S 온라인코드포함(포함/미포함/공란) · T 옵션정렬.
> **헤더 행 탐지**: 1~10행 중 '상품명'(괄호·공백 무시) 있는 첫 행을 헤더로 `sheet_to_json({range})` — v2(2행)·구양식(1행)·목록 다운로드(1행) 자동 흡수(회귀 0). **헤더 정규화**: `normalizeHeaderKey`가 `(` 이하 제거+trim(`카테고리(검사/도서/도구)`→`카테고리`), row 키를 원본·정규화 양쪽 보유. `hasOnlineCodeColumn`·`hasIsActiveColumn` 게이트도 정규화 키로 비교(구 별칭 `공용(Y/공란)`→`공용`·`노출(Y/N)`→`노출` 충돌 없음).
- 상품명 → name / 상품코드 → product_code
- 카테고리 → category (대분류) — **`String().trim()` 후 검사/도서/도구만 허용. 빈값·오타·공백은 행 오류 처리(§빈 상태 참조).**
- 하위카테고리 → sub_category / **이미지 → image_filename**(빈값 payload 제외, 버킷 실존 미검증) / 가격·정가 → list_price / 비고 → notes
- 할인여부 → is_discountable (Y/TRUE/YES/1 → true). **개별할인율>0이면 auto-T**.
- 개별할인율 → discount_override (공란=NULL 해제, 0~100 clamp/100)
- **배지_인기 → is_popular** / **배지_신규 → is_new** (2026-08-25 별칭 추가, 기존 `인기상품`·`신상품여부` 유지)
- **판매여부 → is_active** (2026-08-25, v2 H열 공통 구역). 기존 `노출(Y/N)`·`노출` 별칭 유지. **검사 전용 아님** — 도서·도구 평면 상품에도 적용(구현상 `_hier`에서 최상위 필드로 이동). **열 없음/셀 공란은 미변경**(키 미포함 → upsert가 기존 값 보존, N으로 뭉개 숨김 방지).
- **온라인코드포함 → includes_online_code** (3상태). `포함`/TRUE/Y/1→true, `미포함`/FALSE/N/0→false, **공란→NULL(미확인) 유지**. **검사 외 자동 false 강제**(2026-08-25, 건우님 확정): `category!=='검사'`면 입력 무시하고 false로 조용히 교정(온라인코드는 검사 전용·DB도 도서·도구 전량 false 씨딩·양식 1행 안내문에도 "*도서 및 도구는 자동으로 미포함" 명시). 검사는 3상태 유지. **열 자체 없으면 미변경**(게이트 우선). `discount_override`(공란=해제)와 의도가 다름(공란=미확인 NULL 보존). 다운로드는 `포함`/`미포함`/`''`로 라운드트립.
- 태그 → tags (콤마 split)
- **검사 위계 열** (검사 상품만 채움, 도서·도구는 공란):
  - `검사군약어` → `test_groups.abbr`(nullable), `검사군명` → `test_groups.name`. **매칭 키=(약어,검사명)**(`makeTestGroupResolver`, seed_hierarchy.py dedup 동일). 기존 조회 후 `test_group_id` 연결, 없으면 신규 생성. **검사군명 채워진 행만** 연결.
  - `옵션명` → `option_name`, `말머리` → `option_label`, `공용(Y/공란)` → `is_common`(Y=true), `옵션정렬` → `sort_order`(정수). **빈 열 = 미변경**(채워진 열만 payload 포함 → 기존 값 보존, 구양식 회귀 0).
  - **is_active(노출)는 위계 열에서 제외 — v2 H열 판매여부로 이동**(위 참조).
- **양식 다운로드**(`handleDownloadTemplate`, 2026-08-25 정적화): json_to_sheet 하드코딩 폐기 → `/templates/product-upload-template.xlsx` fetch→blob→anchor 다운로드(파일명 `상품_업로드_양식.xlsx`). 건우님이 다듬은 안내문·색상·틀고정·예시 9행 1:1 보존. 선례 `utils/depositResolution`·`paymentReceipt` 정적 양식 로딩 패턴.
- **목록 다운로드**(`handleDownloadExcel`, 2026-08-25 서식화): json_to_sheet(맨 시트·서식 없음) 폐기 → **양식 v2 정적 템플릿(`/templates/product-upload-template.xlsx`)을 ExcelJS로 열어 서식 그대로 채운다**(선례 `utils/depositResolution`·`paymentReceipt` 정적 양식 패턴). 로직은 `utils/productExcelExport.js`로 분리(단위 테스트 11): `buildProductRows`(순수 — 상품 배열→20열 AOA)와 `fillProductListWorksheet`(ExcelJS 채움)를 분리. **채움 절차**: ① 예시 행(3행~) 전부 제거 — 예시가 실데이터에 섞이면 안 됨(BLCT 예시는 DB와 값도 다름). ExcelJS 4.4.0 `spliceRows` 말단 대량삭제 버그(splice(3,9)→무동작 확인)로 **아래에서부터 1행씩 삭제**로 우회. ② 3행부터 전체 상품 기입, 정렬은 `fetchAllProducts` 반환 순서 그대로(현행과 동일). ③ 데이터 행 서식은 **예시 3행 셀 서식을 캡처해 상속**(맑은 고딕 10·E열 `#,##0`·검사 전용 N~T열 옅은 채움 theme3/tint 0.85) — 캡처 방식이 견고. ④ 자동필터 `A2:T{2+행수}`로 갱신, 틀고정 A3는 템플릿 그대로. 파일명 `상품_목록.xlsx`. 값 포맷=파서 규약(온라인코드=포함/미포함/공란, 공용=Y/공란, 판매여부·할인여부·배지=Y/N, 개별할인율=`rateToPercentNullable`). `test_groups` 조인으로 위계 열(N·O) 채움. 안내문 1행이 있어도 파서 헤더 탐지(`detectHeaderRow`)가 2행을 헤더로 잡아 라운드트립.
- **graceful**: 신규 컬럼(위계·개별할인율·온라인코드·is_active) 미적용 환경이면 Edge Fn upsert 컬럼 오류 → 프론트가 해당 열 빼고 1회 재시도(회귀 0). 컬럼 적용 시 Fn 그대로 통과(Fn 무변경).

## 필터·뷰 모드

- 검색어 (상품명 부분 일치)
- 카테고리 단일 선택 (도서/검사/도구/미확인) — 필터 바 토글(2026-10-19). 미확인 = 도서·검사·도구 외 값
- **검사군 그룹 뷰 (2026-07-02 개편)**: `selectedCategory==='검사'`이면 **무조건 그룹 뷰**(토글 폐지, `groupViewActive = selectedCategory==='검사'`). 도서·도구·전체는 평면. 그룹 뷰 = 조회+수정(검사군·옵션 인라인 관리), 페이지네이션 숨김. §검사군 그룹 뷰 절 참조.
- ~~빠른 필터: discountable | popular | onlineUnknown | null~~ — **(2026-10-19 폐지)** 속성별 `facets`로 교체: isDiscountable·discountOverride·isPopular·isNew·hasImage(`'all'|'y'|'n'`) + onlineCode(`'all'|'y'|'n'|'unknown'`), 속성 간 AND. §필터 바 참조
  - 온라인코드 미확인 = `includes_online_code IS NULL`(undefined 포함). **구 `category='검사'` 한정 조건 제거**(2026-10-19) — 비검사는 엑셀 파서가 false 강제라 실데이터상 사실상 검사에만 존재
- **노출 필터 — (2026-07-02 신규, 1차 선택)**: (2026-10-19 이후라면 `facets`에 노출 여부 Y/N 추가로 검토) `productQuickFilter`에 `hidden`(숨김만) 추가 검토, 또는 검색·필터 카드에 "숨김 포함 N개" 표시 + 별도 토글. **기본은 전체 노출**(숨김 상품도 표에 보임 — dim+칩으로 구분). 운영자가 "숨김 상품만 모아보기"를 원할 때만 필터. **구현 우선순위 낮음** — is_active 상태칩·폼 Switch가 P0, 필터는 P1.
- 태그 다중 선택 (OR 매칭)
- 정렬: 인기 우선 → 이름 가나다순(고정, 사용자 선택 없음)
- 페이지당 항목 수: 10/25/50/100 (기본 50)

## 빈 상태·로딩·오류 처리

- 로딩: `TableSkeleton rows=10 columns={products:edit ? 10 : 9}` (이미지 컬럼 추가로 +1)
- 빈 상태(필터 결과 없음): `EmptyState` — "검색 결과가 없습니다" + "다른 검색어나 필터를 시도해 보세요" + "필터 초기화" 액션
- 빈 상태(상품 미등록): "등록된 상품이 없습니다" + "새 상품을 추가해 시작하세요" + "상품 추가" 액션 (`products:edit` 권한 있을 때만)
- 오류: 토스트(`addNotification`) 처리, 화면 안에 잔류 알림 없음
- 엑셀 업로드 오류: 진행 다이얼로그 내 오류 표(행/상품코드/상품명/사유) + "오류 내역 복사" 액션
- **이미지 일괄 업로드 진행/결과 다이얼로그(2026-06-29 신규):** `LinearProgress`(현재/전체) + 실패 파일 목록(파일명: 사유, error 색) + 하단 안내 1줄("권장: 파일명을 상품코드로(영문/숫자). 한글·공백·특수문자 파일명은 업로드되지 않습니다."). 업로드 중 닫기 차단(`disableEscapeKeyDown`). 완료 후 "닫기". 토스트로 성공/실패 건수 요약. **파일명 형식 위반(한글·공백·특수문자)은 업로드 시도 없이 실패목록에 사유 기록** — 운영자 즉시 인지(2026-06-29 보강).
  - 사전 검증 사유: "상품코드 필수" / "상품명 필수" / **"카테고리는 검사/도서/도구만 허용"**(2026-06-24 신설 게이트 — 빈값·오타·공백 행을 오류 처리, 정상 행만 upsert) / "엑셀 내 중복" + 서버 측 오류

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **대분류 3종은 도서/검사/도구(고정).** "도구"가 빠지거나 통합되면 안 됨. **대분류는 필수**(2026-06-24): 폼은 Select로 미선택 저장 차단, 엑셀은 검사/도서/도구 외 행을 오류 처리. 미분류 매출(회계 누락)을 입력단에서 원천 차단. (서버 측 2중 방어: DRAFT `20260624010000_DRAFT_products_category_constraint.sql`의 NOT NULL+CHECK — backend 소관, 건우님 승인 후 적용.) **도구-검사 매출 합산 정책은 PRD에서 영구 폐지(3버킷)** — 단, 그 변경은 DashboardPage·revenueByCategory 소관이고 본 화면 통계 카드는 이미 도구를 독립 카운트로 표시 중. (FulfillmentPage의 "도구→검사" 정규화는 출고 화면 한정 규칙이며 본 PRD와 별개 — 혼동 주의.)
9. **(P1) 소분류는 노출 전용·매출 미참여.** `sub_category`를 마스터로 동적화해도 **매출 집계(revenueByCategory)는 `category`만 참조** — 소분류 변경이 합계에 영향 0이어야 함. 소분류를 카운트/집계 축으로 끌어들이지 말 것.
10. **(P1) 소분류는 이름 자연키 연결(FK 없음).** 엑셀 호환을 위해 무결성을 DB FK가 아닌 UI 경고("미등록" 회색)로 처리. 시안/구현이 미등록 값을 막거나 업로드를 reject하면 안 됨(운영 마찰 방지 — PRD §엣지).
11. ~~배지는 boolean 플래그와 공존~~ — **(2026-06-29 폐기)** 동적 배지 제거. 인기/신상품 boolean은 그대로 유지.
12. ~~어드민 표는 배지 전량 노출~~ — **(2026-06-29 폐기)** 동적 배지 제거.
15. **(2026-06-29) 동적 배지 기능 폐기 — 인기/신상품·소분류는 유지.** 배지 마스터 CRUD·폼 칩 토글·표 동적 배지·엑셀 "배지" 열·`products.badges` 코드 참조 전부 제거(grep 0). `is_popular`/`is_new` boolean(카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열)·소분류 마스터·상품 이미지·태그는 그대로. `products.badges` 컬럼은 DB drop 예정이며 drop 후에도 코드 에러 0.
14. **(2026-06-29) 상품 이미지는 파일명 자연 매칭·버킷 실존 검증 없음.** `image_filename`(엑셀 "이미지" 열)과 `product-images` 버킷 파일명이 일치해야 카드에 뜸. 업로드 시 버킷 실존 검증 안 함 — 불일치/누락은 카드·표에서 **슬롯/썸네일 미렌더**로 graceful 처리(1차 onError-only). 와박팀이 엑셀과 파일명을 맞추는 운영 약속이 전제. 시안·구현이 미일치 값을 reject하면 안 됨(운영 마찰 방지). **대부분 미등록(NULL)이 정상** — 이미지 없으면 슬롯/썸네일 자체를 미표시(플레이스홀더 폐기, 2026-06-29 건우님). **단, 일괄 업로드 시 파일명 형식만은 검증함**(2026-06-29 보강): 영문/숫자·`.`·`-`·`_` 외(한글·공백·특수문자) 파일은 Storage 키가 깨지므로 업로드 시도 없이 실패목록에 기록("파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장"). 정상 파일만 업로드. 버킷 실존 검증과는 별개(전자는 형식, 후자는 매칭).
13. ~~"최대 2개"는 표출 정책~~ — **(2026-06-29 폐기)** 동적 배지 제거. ProductCard는 인기/신상품 boolean 칩만 표시.
2. **상태 태그 3종(인기·신상품·할인)은 표 안에서 한 컬럼에 모인다.** 시안이 한 종만 보여주면 운영자는 다른 두 플래그를 못 본다.
3. **폼의 플래그 3종은 별도 체크박스.** 하나의 토글이나 셀렉트로 통합 금지.
4. **카테고리·하위 카테고리는 별도 필드.** 가로 배치이지만 입력은 두 칸으로 분리됨.
5. **태그·하위카테고리·notes는 nullable.** 시안에서 항상 값이 있는 것처럼 그리면 빈 상태 처리가 빠진다.
6. **전체 삭제는 받아쓰기 확인 ("삭제합니다") + 위험한 액션 색 처리.** 자주 하는 일과 다른 모양·색·위치 원칙(01 원칙 3).
7. ~~**통계 카드 6장이 일렬로 배치.**~~ — **(2026-10-19 폐지)** 필터 바로 교체. 대신 카테고리 4종(도서/검사/도구/미확인)·속성 6종·태그·검색이 모두 필터 바에 있어야 한다(누락 금지).
8. **그라데이션 배경은 현재 코드에 있지만 신 디자인 시스템에서는 제거 대상(CLAUDE.md E항).** 시안에서 그라데이션을 유지하지 말 것.

## 변경 이력

- 2026-10-19 **필터 바 재설계(실 구현)**(메인 Claude, 시안 `ProductFilterBarPreview` 1:1 이식). `ProductManagementPage.jsx`의 빠른 필터 카드 8장(`renderQuickFilterCard`·`productQuickFilter`·카드 집계 memo 5종)과 구 검색·태그 SectionCard를 폐지하고 필터 바 SectionCard 1장으로 교체. state: `productQuickFilter` → `facets`(`DEFAULT_FACETS` = isDiscountable·discountOverride·isPopular·isNew·hasImage·onlineCode, 각 `'all'|'y'|'n'`, 온라인코드만 `'unknown'` 추가) + 카테고리는 기존 `selectedCategory`(값에 `'미확인'` 추가, 그룹 뷰 분기 공유). 판정 로직은 순수 함수 `utils/productFilters.js`(`DEFAULT_FACETS`·`isFacetsActive`·`matchesCategory`·`matchesFacets`·`matchesTags`·`buildTagOptions`)로 분리. 필터: 카테고리 미확인=`!PRODUCT_CATEGORIES.includes(category)`, Y/N 속성 AND, 이미지=`image_filename` trim 유무, 온라인코드 3상태 그대로(**검사 한정 조건 제거**, undefined=NULL 취급), 태그 OR. 태그 옵션: `societies.name` 정렬 앞 + 나머지 자유 태그 정렬 뒤(`societyTagSet` — 학회 실선·자유 점선 테두리). UI: 모듈 스코프 `FacetToggle`(ToggleButtonGroup exclusive, 카테고리만 clearable) + 우측 상단 "N개 표시 중"(필터 있을 때) + 상시 "필터 초기화"(필터 없으면 disabled) → 카테고리(+검사 선택 시 "검사군 추가", `canEdit`) → Y/N 2열 그리드 → 태그(체크박스 칩) → 상품명 검색 맨 아래(`ProductSearchBar` 로컬 state+debounce 60ms 유지). `hasFilters`에 `isFacetsActive(facets)` 반영, `handleResetFilters`에 `setFacets(DEFAULT_FACETS)`, 1페이지 리셋 useEffect deps에 `facets`. 미사용 import(TrendingUp·HelpOutline·MenuBook·Science·Build 아이콘, `CATEGORY_COLORS`·`CATEGORY_KEY_BY_LABEL`) 정리. 상품 표·그룹 뷰·액션바 무변경. theme.js 무수정·MUI만·존재 토큰(`theme.gray[50/300]`·palette.primary)만. 검증: eslint(변경 파일 0 error)·vitest 369 passed(신규 `productFilters.test.js` 12 + 실 페이지 렌더 `ProductManagementPage.filterBar.test.jsx` 7 — AND 조합·카테고리 미확인·온라인코드 미확인 비검사 포함·태그 OR·학회 앞 정렬·초기화·검사 그룹 뷰/검사군 추가/재클릭 해제)·vite build 통과.
- 2026-07-03 **검사군 상세 편집 모달 실 구현 + ⋮ 메뉴 재편 (실 코드 변경 — frontend-engineer, tech-cto 위임)**. 신규 `TestGroupEditorModal.jsx`로 검사군(상위)+옵션(products) CRUD·순서·이동·삭제를 하나의 큰 모달에 통합. **폐지**: 검사명·약어 편집 다이얼로그(`tgDialog`)·미리보기 카드, 옵션 편집 다이얼로그(`tgDetail`·`handleOpenTgDetail`·`handleTgDetailOptionChange`·`handleMoveOption`·`handleSaveOptions`), 분리 다이얼로그(`tgSplit*`·`handleOpenSplit`·`handleToggleSplitOption`·`handleSplit`), `handleSaveTestGroup`. 관련 state(`tgDialog`·`tgSaving`·`tgDetail`·`tgSplitOpen`·`tgSplitSelected`·`tgSplitForm`) 제거, `tgEditor`(모달 open/group) 신설. **⋮ 메뉴 재편**: [옵션 편집·분리·병합·삭제] 4항목 → **[검사군 상세 편집·병합·삭제] 3항목**(옵션 편집·분리는 모달 흡수, 병합은 모달 밖 유지=`mergeTestGroups`). 헤더 편집 아이콘·"검사군 추가" 버튼 모두 모달 진입으로. **모달**: 상단(검사명·약어·정렬·노출 Switch) + 옵션 인라인 테이블(순서 ▲▼·옵션명·말머리·상품코드·가격·공용·노출·⋮ 이동/삭제) + 하단(옵션 추가·저장/취소). 신규 옵션 name 자동조합 `"{검사명} {옵션명}"`(공백 1칸, 편집 가능·nameTouched 중단, 기존 name 미덮어씀). 옵션 옮기기(라디오 A=`splitTestGroup`/B=`moveOptionsToGroup`, 확인 문구 3블록). 상품코드 중복 검증(모달 내부+전체 products) 저장 차단. 옵션 삭제=`deleteProductOption`(master 전용, edit는 disable+안내, 확인 문구 "판매중지는 노출 토글·삭제 불가역·과거 주문 보존"). 드래그앤드롭·undo 제외. state 완전 격리(214행 렌더 무영향)·Autocomplete 내장 필터(controlled 렉 방지). **API**: `testGroups.js`에 `createProductOption`·`deleteProductOption`(42501→권한 안내)·`moveOptionsToGroup`·`saveTestGroupWithOptions`(backend 병렬 신설, 순차+PGRST204 graceful, order_items 불변). ⋮ "항목 수 불변" 제약 폐기. theme.js 무수정·MUI만(Dialog/Table/Switch/Checkbox/RadioGroup/Autocomplete)·AI 시그니처 없음·권한 가드 보존. **검증**: `npx eslint`(변경 파일 신규 위반 0)·`vite build`·`vitest` 113 passed. §검사군 상세 편집 모달 절 신설, §검사명·약어/옵션 순서·말머리 절 폐지 표시, §옵션 옮기기·⋮ 메뉴 절 갱신.
- 2026-07-03 **옵션 옮기기(분리·이동) 사양 — 분리 다이얼로그 일반화 (사양만 갱신, 실 코드 미변경 — product-designer, 건우님 확정)**. 기존 §분리 절을 §옵션 옮기기(분리·이동) 절로 일반화. (1) **⋮ 메뉴 라벨** "분리 (옵션을 새 검사군으로)" → **"옵션 옮기기 (분리·이동)"** — 라벨만 변경, 항목 수 불변(옵션 편집·옵션 옮기기·병합·삭제, 6번째 신설 금지). (2) **다이얼로그 상단 목적지 라디오 2택**(`RadioGroup`, 기본 A=기존 동작): (A) 새 검사군으로 = 기존 검사명·약어 `TextField` UI 그대로(`splitTestGroup`) / (B) 기존 검사군으로 = `Autocomplete` 1개(`fetchTestGroups` 214개, 옵션 라벨 "약어 · 검사명", 약어+검사명 검색, **현재 검사군 제외**)로 선택 → 선택 옵션 `test_group_id`를 기존 id로 UPDATE(동종 연산, 새 검사군 생성 없음). (3) **옵션 체크박스 다중 선택**(`tgSplitSelected`) 기존 재사용. (4) **확인 문구 3블록**(정직·자체완결): 이동("옵션 N개를 '{대상}'(으)로 옮깁니다. 진열이 즉시 바뀝니다.") + 원래 검사군 0개 경고("남는 옵션이 없어집니다. 빈 검사군은 진열 미표시·⋮에서 직접 삭제") + 되돌리는 법("반대로 다시 옮기면 됩니다."). (5) **안 함(엄수)**: undo 전면 제외 / 빈 검사군 자동삭제 제외(유지+경고만) / 드래그앤드롭 제외. 근거: 자동 초벌 오분류 교정을 단일 진입점으로 흡수 — "분리 vs 이동 vs 병합" 구분 부담을 라디오 1개로 줄임(연 8일·초기 시드 정비 집중, 학회 중 freeze). **제약**: theme.js 무수정·MUI만(Dialog/Checkbox/Autocomplete/Chip/RadioGroup 재사용)·AI 시그니처 금지·`products:edit` 가드 보존·order_items 불변. **frontend 결정 필요(tech-cto 소관)**: 신규 API `moveOptionsToGroup(targetGroupId, productIds)`(기존 검사군 id로 `test_group_id` UPDATE·최소) vs `splitTestGroup` 확장 — 제품 요구는 "기존 검사군 id로 UPDATE하는 동종 연산" 자체일 뿐, 함수 형태는 엔지니어링 판단. 상단 요약·§검사군 관리 ⋮ 메뉴·§옵션 옮기기 절 신설, §분리 대체.
- 2026-07-03 **페이지 렌더 성능 최적화 (실 코드 변경 — frontend-engineer, 건우님 실동작 피드백 2건 동일 근본원인)**. 증상: (1) 검색 debounce 250ms 딜레이 답답(오타 수정 시 결과 지연), (2) 모든 탭(전체/할인/인기/검사/도서/도구) 전환마다 렉. 원인: 2,300줄 단일 컴포넌트라 state 변경마다 상품 표 전량 재렌더 + 상품 행이 memo 안 돼 안 바뀐 행까지 다시 그림. **수정(정보 구조·기능·필드 전부 불변, memo/useCallback 외과 도입):** (1) 상품 행을 `ProductRow` `React.memo` 컴포넌트로 추출(컴포넌트 밖 top-level) — 평면 행과 검사군 옵션 하위 행이 공유(props `isOption`으로 상품명 셀만 분기: 평면=`product.name`, 옵션=말머리+형태명+`pl:4` 들여쓰기). `renderProductCells`도 top-level 순수 함수로 이동해 `ProductRow` 내부 흡수 — memo 대상이 셀 전체(카테고리·소분류칩·가격·비고·상태칩·태그·편집버튼) 포함해야 skip이 온전. props(`product`·`selected`·`canEdit`·`isOption`·`subColorByName`·`theme`·`onToggle`·`onEdit`) 동일 시 재렌더 skip. (2) `ProductThumb`를 `React.memo`로 — `filename`·`name` 같으면 이미지 셀 재렌더 skip. (3) 핸들러 `useCallback` 안정화(`handleOpen`·`handleToggleOne`·`handleToggleGroupExpand`) — 참조 고정으로 memo 효과 유지. `subColorByName`(useMemo)·`theme`(useTheme)는 이미 안정. **skip 근거:** `filteredProducts`가 `[...list].sort()`로 새 배열을 만들어도 개별 상품 객체는 `allProducts` 원본 참조 유지 → 탭 전환·검색 시 표시되는 행 중 동일 객체는 얕은 비교 통과로 재렌더 skip. (4) A6 `ProductSearchBar delay={60}`(250→60ms) — 렌더가 가벼워져 오타 수정 타이핑 매끄럽고 결과 즉시 반영. **C1(`ProductSelectionStep.jsx`)의 `ProductSearchBar`는 무변경(`delay` 미지정=기본 250ms 유지) — C1은 렉 없어 현행 유지.** 통계 카드·필터바는 이미 useMemo(`totalDiscountableCount`·`totalPopularCount`·`categoryCounts`·`availableTags`)라 추가 조치 불요(과잉 최적화 방어). **기능 전부 불변(개별 수정·엑셀 다운로드/업로드·검사군 인라인 관리·is_active·페이지네이션·권한 가드·검사군 묶어보기 뷰)·order_items 불변·theme.js 무수정·MUI만·AI 시그니처 없음.** 검증: `npm run lint`(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·`npm run build` 통과·`vitest` 113 passed 유지.
- 2026-07-02 **검사 위계 통합 개편 3건 (실 코드 변경 — frontend-engineer, 건우님 최종 지시)**. **[지시 1]** "검사군 묶어보기" 토글(`groupView` state·`Switch`·조건부 렌더) 제거 — `groupViewActive = selectedCategory==='검사'`로 단순화(검사=무조건 그룹 뷰, 디폴트이자 유일 뷰). 도서·도구·전체 평면 유지, 전체에서 검사 평면 혼재 유지, 그룹 뷰 페이지네이션 숨김. **[지시 2]** 헤더 "검사군 관리" 토글 버튼·`tgPanelOpen` state·Collapse 패널(목록 Table·툴바·검색) 전량 제거. 기능을 그룹 헤더 행에 인라인 흡수 — 헤더 우측 관리 셀(`colSpan={2}`, `products:edit`, stopPropagation): is_active `Switch`(`handleToggleTgActive`)·편집 `IconButton`(→ 기존 `tgDialog`)·⋮ `Menu`(`MoreVertIcon`) 4항목[옵션 편집(→`handleOpenTgDetail`)·분리(→detail 후 `handleOpenSplit`)·병합·삭제]. 병합 재설계: 헤더에서 대표(keep) 지정→다이얼로그에서 흡수 대상 다중 선택(`tgMergeKeep`·`tgMergeAbsorb`, 기존 `mergeTestGroups(keepId,[keep,...absorb])`). "검사군 추가"는 검사 뷰 필터 바에 outlined 버튼으로 이동. 삭제·분리·옵션 편집 다이얼로그는 **기존 컴포넌트 그대로 재사용**(진입점만 이동, 대규모 재작성 없음). 미분류 그룹은 관리 액션 없음. **[지시 3]** 엑셀 다운로드/양식/파싱 3곳에 위계 7열(`검사군약어`·`검사군명`·`옵션명`·`말머리`·`공용(Y/공란)`·`옵션정렬`·`노출(Y/N)`) 추가. 다운로드=`fetchTestGroups` 조인으로 현 DB값 채움. 업로드=Phase 2.5에서 `makeTestGroupResolver`(신규, `api/testGroups.js` — 기존 `createTestGroup` 재사용·세션 캐시·(약어,검사명) dedup, seed_hierarchy.py 규칙 동일)로 `test_group_id` 해결(없으면 생성), 채워진 열만 `option_name`·`option_label`·`is_common`·`sort_order`·`is_active`에 반영(빈 열=미변경→구양식 회귀 0). Edge Fn 무변경(컬럼 있으면 통과) + 컬럼 미적용 환경 graceful(위계 열 빼고 1회 재시도, `data.errors`의 컬럼 오류도 감지). 기존 열·`product_code` upsert·category 게이트 무변경. **theme.js 무수정·MUI만·AI 시그니처 없음·권한 가드 보존·order_items 불변.** 검증: `npm run lint`(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·`npm run build`·`vitest` 113 passed 유지. 상단 요약·§검사군 관리=그룹 뷰 인라인·§검사군 그룹 뷰·§엑셀 컬럼 매핑·§필터·뷰 모드·데이터 모델 갱신.
- 2026-07-02 **검사군 묶어보기 뷰 사양 추가 (사양만 갱신, 실 코드 미변경 — product-designer)**. A6 §상품 표에 "검사군 묶어보기 뷰(검사 카테고리 한정·토글·읽기 진열)" 절 신설 + §필터·뷰 모드에 뷰 항목 추가. (1) **토글**: `selectedCategory==='검사'`일 때만 뜨는 MUI `Switch` "검사군 묶어보기"(신규 state `groupView` bool, 기본 off). 도서·도구 선택 시 숨김. off=현행 평면 표(회귀 0). (2) **그룹 헤더 행**: 약어(`test_groups.abbr` 보조)+검사명(`name` 주인공)+"옵션 N개"(`tgOptionCounts` 재사용)로 C1 `TestGroupCard` 접힘 상태와 정합, 가격 은닉, `is_active=false` 검사군 dim+숨김 칩. (3) **옵션 하위 행**: 펼치면 `fetchTestGroupOptions`(기존 API) 소속 옵션을 상품 표 기존 컬럼 구조 그대로 하위 행 진열(말머리+형태명 상품명 셀, 나머지 셀·가격·상태칩·is_active dim 재사용). 개별 상품 편집 버튼 유지(검사군 구조 편집 아님). (4) **역할 분담**: 뷰=읽기 진열, 검사군 관리 패널(`tgPanelOpen`)=편집(분리·병합·명명·옵션순서·삭제) 유일 소스. (5) **제약**: 탭 분리 금지(CPO 기각), 엑셀 흐름 무변경(단일 양식·product_code upsert), 신규 API 금지, theme.js 무수정·MUI만·AI 시그니처 금지, 기존 컬럼/상태칩/페이지네이션/권한 가드 보존, graceful(검사군 미적용 시 평면 폴백). 미반영(frontend 결정 필요): 그룹 헤더 행 colSpan 병합 방식·미분류 검사 상품 배치·페이지네이션 단위(헤더 214 기준)·펼침 아코디언 구현(Collapse vs 행 삽입).
- 2026-07-02 **검사 위계 실 구현 — is_active 토글 + 검사군 관리 화면 (실 코드 변경 — frontend-engineer)**. (1) **is_active(노출여부)**: 상품 표 `TableRow` `opacity: is_active===false ? 0.55 : 1`(dim), 상태 태그 컬럼 맨 앞 "숨김" 칩(`theme.gray[200]` 배경 + `text.secondary`, `is_active===false`만 표시 — 노출 중은 무표시, `-` 폴백 조건도 `is_active!==false` 게이트). 상품 폼 플래그 체크박스 3종 뒤 별도 행에 "고객 주문서 노출" `Switch`(`checked={is_active!==false}`, 기본 노출, off 시 "숨김" 칩·보조문구 "끄면 주문서에서 숨겨집니다 (데이터는 보존 — 삭제 아님)"). `createEmptyProduct`에 `is_active: true`. `handleSave` mutate의 PGRST204 재시도 게이트에 `is_active` 포함(image_filename과 함께 delete 후 재시도) — 컬럼 미적용 환경 graceful. 숨김 상품 표 잔류. 검사/도서/도구 공통(검사 위계 UI 비종속). (2) **검사군 관리**: 헤더 액션부 "검사군 관리" 토글(`AccountTreeIcon`, `products:edit`) → Collapse `SectionCard`(padding 0). 툴바(검사군 추가 contained·병합 outlined error·검색 TextField) + 목록 `Table`(체크박스·약어 caption·검사명 body1/600·옵션N·is_active Switch·편집·삭제, `is_active=false` 행 dim+"· 숨김"). 빈 상태 메시지. 검사명·약어 편집 다이얼로그(검사명·약어·정렬 + 미리보기 고객 카드 접힘). 옵션 상세 다이얼로그(말머리·형태명 TextField·공용 Checkbox·개별 is_active Switch·▲▼ 순서 이동, 상단 분리 버튼, 저장 시 각 상품 `updateProductOption`으로 sort_order=index 재기입). 분리 다이얼로그(새 검사군 검사명·약어 + 옵션 다중선택, 확인 문구). 병합 다이얼로그(대표 검사군 선택 Checkbox·옵션 합계·되돌림 경고). 삭제 확인(소속 옵션 낱개 복귀·절판은 숨김 권고 안내). 편집=즉시, 분리/병합/삭제=확인 스텝. `loadTestGroups`로 마운트·CRUD 후 로드. API `src/api/testGroups.js` 신설(모두 api 계층 경유, 직접 supabase 호출은 api 파일 내부만). (3) **graceful**: 테이블·컬럼 미적용(42P01·PGRST204·PGRST205) 시 빈 목록/무동작 → 화면 회귀 0. (4) **미확정 처리**: 검사군 단위 is_active 토글은 **검사군 카드 노출(test_groups.is_active)만** 토글하고 소속 옵션 일괄 전파는 안 함 — `handleToggleTgActive`에 TODO 주석 + 사양 §검사군 목록 "확인 필요" 유지(backend·건우님 검수). 노출 필터(P1)는 미구현(사양 P1 우선순위 낮음 그대로). **theme.js 무수정·MUI만·AI 시그니처 없음.** 검증: `npx eslint`(변경 파일 위반 0)·`vite build` 통과.
- 2026-07-02 **검사 위계 시안 — is_active 토글 + 검사군 관리 화면 (사양만 갱신, 실 코드 미변경 — product-designer)**. PRD_검사위계.md 흐름 B(보정 UI 전체 구현) + is_active(노출여부) 전역 필드 UI. (1) **상품 표**: 상태 태그 컬럼에 "숨김" 칩(`is_active=false`, `gray[200]` 소프트 틴트) + 행 dim, 노출 중은 무표시. 숨김 상품이 표에서 사라지지 않음(재판매·이관 대비). (2) **상품 폼**: 플래그 체크박스 3종과 별도 행에 "고객 주문서 노출" `Switch`(체크박스 아님 — 진열 즉영향 전역 스위치) + 보조문구. 기본 true. (3) **검사군 관리 화면**(헤더 "검사군 관리" 토글 패널 or 서브탭, `products:edit`): 검사군 목록(약어·검사명·옵션N·is_active Switch·편집·삭제) + 검사명/약어 편집 다이얼로그(미리보기로 잘림 확인) + 옵션 순서·말머리·is_common·개별 is_active 편집 + 분리(1→N)·병합(N→1)·삭제 위험 액션 확인 스텝. 즉시저장 아님(위험도 높아 저장+확인). 삭제는 검사군 마스터만 제거(상품은 test_group_id NULL로 보존). (4) 데이터 모델에 `is_active`·검사 위계 5컬럼 명시(⚠️ 실 마이그레이션 존재 여부 backend 확인 필요). (5) 노출 필터는 P1(1차 선택). **단어 권고**: "노출 중"/"숨김"(중립·데이터 보존 뉘앙스, "판매중지"보다 정합). **AI 시그니처 금지·theme.js 무수정·MUI 유지.** 미반영: is_active 실 마이그레이션·검사군 단위 is_active 토글 범위·노출 필터 구현 우선순위(전부 backend·건우님 검수 대상으로 명시). C1 시트 동시 갱신.
- 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품·소분류는 유지 (실 코드 변경, 건우님 결정)**. (제거) 배지 마스터 CRUD 패널(SectionCard)·다이얼로그·`handleSaveBadge`/`handleDeleteBadge`/`handleToggleBadgeActive`·`badgeDialog`/`badgeMaster`/`customBadgeInput` state·`badgeOptions`/`badgeColorByName`/`badgePriorityByName` memo·`handleToggleBadge`/`handleAddCustomBadge`, 상품 폼 배지 칩 토글 블록, 표 동적 배지 칩 map, 엑셀 "배지" 열(양식·목록·파싱 3곳)·`badgeWarnings`·`CARD_BADGE_LIMIT`, `createEmptyProduct.badges`, `handleSave`/엑셀 payload의 `badges` 처리, `api/masters.js`의 `fetchBadges`/`createBadge`/`updateBadge`/`deleteBadge`·`fetchMasterUsageCounts`의 badgeCounts. `BadgeChip`→`ColorChip` 리네임(소분류 표시 재사용처만 잔존). 헤더 토글 "소분류·배지 관리"→"소분류 관리". 미사용 import(`SellIcon`·`Alert`) 정리. (유지) `is_popular`/`is_new` boolean — 카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열 전부 그대로. 소분류 마스터·상품 이미지·태그·카테고리 그대로. `products.badges` 코드 참조 0(grep 확인, drop 후 에러 0). C1/A8 시트 동시 갱신. **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. theme.js 무수정.
- 2026-06-29 **상품 표 썸네일 플레이스홀더 폐기 (실 코드 변경, 건우님 결정)**. `ProductManagementPage.jsx` `ProductThumb` — `getProductImageUrl(filename)`이 null이거나 `onError`면 `return null`(셀 비움). 기존 회색 박스(`grey.100`) + `ImageIcon`(18px) 플레이스홀더 코드·`show` 분기 제거, `ImageIcon` import 삭제. "이미지" 컬럼 헤더·colSpan/columns 카운트는 유지(있는 상품만 썸네일). C1 `ProductCard` 슬롯과 동형 정책(이미지 없으면 미렌더). **혼재 처리 로직 추가 안 함(오버엔지니어링 방어), theme.js 무수정, AI 시그니처 없음.** **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. §표 썸네일·마지막 갱신·핵심 발견 14 갱신.
- 2026-06-29 **상품 이미지 블로커 보강 (실 코드 변경, CTO 검수 후속)**. (A graceful) `handleSave`가 `badges`만 `PGRST204` 재시도하고 `image_filename`은 미대응이던 결함 보강 — payload에서 빈 `image_filename`(''·null·undefined) delete + `PGRST204` 재시도 대상에 `image_filename` 포함(`'badges' in data || 'image_filename' in data` 게이트, 두 키 동시 delete 후 재시도). 컬럼 미적용 환경에서 image_filename 키가 섞여도 전건 실패 안 하고 해당 키만 빠진 채 통과. (B 파일명 검증) `handleImageUpload`가 `upload(file.name)` 그대로라 한글·공백·특수문자 파일명이면 Storage 키가 깨지던 결함 보강 — 모듈 상수 `SAFE_IMAGE_FILENAME = /^[A-Za-z0-9._-]+$/`로 업로드 전 검증, 위반 파일은 업로드 시도 없이 실패목록에 `{ ok:false, error:'파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장' }` 기록(운영자 즉시 인지), 정상 파일만 `uploadProductImage` 호출. (C 안내) 업로드 버튼 툴팁 + 결과 다이얼로그 하단에 "권장: 파일명을 상품코드로(영문/숫자)" 1줄. `productImages.js` api 경유 유지, 기존 graceful 패턴(빈값 delete + PGRST204 재시도) 답습, MUI 토큰, 다른 로직 무변경. 데이터 모델 image_filename·핵심 발견 14·일괄 업로드 다이얼로그 절 갱신.
- 2026-06-29 **상품 이미지 기능 구현 (실 코드 변경, PRD `DOCS/PRD_상품이미지.md`)**. (1) **이미지 일괄 업로드 UI**: 헤더 액션부 `PhotoLibraryIcon` 버튼(`products:edit`) → `<input multiple accept=image/*>` → 각 파일 `uploadProductImage`(`product-images` 공개 버킷, 파일명 그대로·`upsert:true`). 순차 업로드·`LinearProgress`·실패목록 다이얼로그·토스트 요약. (2) **상품 표 "이미지" 썸네일 컬럼**: 상품명 앞, `ProductThumb`(40px 1:1, 미등록/onError `ImageIcon` 플레이스홀더). colSpan/columns 9→10(edit)·8→9(view). (3) **엑셀 "이미지" 열**: `handleDownloadTemplate`·`handleDownloadExcel`·`handleFileUpload` 파싱 3곳 `image_filename` 매핑(tags/badges 패턴 복제), 빈값 payload 제외(미적용 회귀 방지). category 게이트·기존 검증 무변경. (4) **API**: `src/api/productImages.js` 신설(`getProductImageUrl`=`getPublicUrl`·`uploadProductImage`·`PRODUCT_IMAGE_BUCKET`). (5) **graceful**: 버킷·`image_filename` 컬럼 미적용 환경 회귀 0(URL null→플레이스홀더, payload에서 빈 image_filename 제외). theme.js 무수정·AI 시그니처 없음. C1 카드 이미지 슬롯과 동일 정책. 핵심 발견 14 신설.
- 2026-06-29 **마스터 CRUD를 SettingsPage→상품관리로 이동 + 배지 입력 칩 체크박스 + 엑셀 배지 경고 (실 코드 변경, 건우님 확정 #1·#2)**. (A 이동) SettingsPage의 소분류·배지 마스터 블록 2개·다이얼로그 2개·관련 state/핸들러(`handleSaveSub`/`handleDeleteSub`/`handleToggleSubActive`/배지 동형)·import(masters API·`ColorPresetPicker`·`MASTER_COLOR_PRESETS`)를 ProductManagementPage로 이동. 헤더 액션부 "소분류·배지 관리" 토글 버튼 → 헤더 아래 Collapse 패널(SectionCard 2개 가로 flexWrap). 즉시저장·삭제가드(사용중 disabled+경고)·is_active Switch 보존. 마스터 fetch는 `loadMasters`로 통합(subcategories·badges·usage 동시, CRUD 후 재호출). 권한 가드 `products:edit`. SettingsPage엔 "소분류·배지는 상품 관리 화면에서 관리합니다" 안내 Alert 1줄 + 마스터 관련 코드 전량 제거. (B 칩 체크박스) 상품 폼 배지 = `Autocomplete multiple freeSolo` → 마스터 활성 배지 Chip 토글 그룹(flexWrap, 선택=소프트틴트 채움/미선택=outlined). **무제한 선택**, 3개째부터 회색 helperText "고객 카드엔 우선순위 상위 2개만 노출됩니다". 미등록 기존 배지도 토글 노출(손실 방지), "직접 추가" TextField+버튼(Enter)으로 freeSolo 보존. (C 엑셀) `handleFileUpload` 검증 루프에 배지>2 경고(`badgeWarnings` → `uploadLog` push), **행 오류 아님·upsert 통과**. category 게이트 유지. (원칙) "최대 2개"=표출 정책(고객 카드 한정), 입력단 무제한. ProductCard 상한2 미변경. theme.js 무수정. §발견 13 신설.
- 2026-06-29 **태그 검색 옵션에 학회 목록(societies) 학회명 포함 (실 코드 변경, 건우님 피드백 #3)**. (1) `availableTags`를 기존 `products.tags` 추출분 + `societies.name` **합집합**(중복 제거·정렬)으로 확장 — 학회 관리 탭 "학회 목록 관리" 모달에 등록된 학회명이 태그 옵션에 전부 노출. 기존엔 상품 태그에 실제로 붙은 값만 떠서 신규 등록 학회명이 안 보이던 문제 해결. (2) societies fetch는 **신규 API 안 만들고** `api/events.js`에 `getSocieties()` 추가(SocietyManagementDialog·EventManagementPage가 직접 `supabase.from('societies')` 호출하던 패턴을 api 계층으로 정리 — CLAUDE.md "api 계층 경유" 준수). `ProductManagementPage`에 `societies` state + 마운트 시 fetch(graceful `.catch(() => {})`). (3) 태그 칩 필터·검색 동작·다른 로직 무변경(옵션 소스만 확장). 검색·필터 카드 절에 옵션 소스 명시.
- 2026-06-29 **소분류·배지 마스터 소비 실 코드 구현 (P1)**. (1) **상품 폼**: 하위 카테고리 자유 텍스트 → `Autocomplete freeSolo`(옵션=소분류 마스터 중 현재 폼 대분류에 소속·`is_active=true`인 이름만 필터). 미등록 입력 시 회색 helperText 경고. 배지 = `Autocomplete multiple freeSolo`(옵션=배지 마스터 활성 이름) 신규 필드(태그와 별도). 미등록 배지 입력 시 회색 칩 "· 미등록". boolean 플래그(인기/신상품/할인)와 공존. `createEmptyProduct`에 `badges: []` 추가. (2) **상품 표**: 하위 카테고리 = 소분류 마스터 색 소프트 틴트 칩(미등록 회색 "· 미등록"). 상태 태그 컬럼에 동적 배지 추가 — 우선순위(`badges.priority`) 정렬, 어드민 **전량 노출**(C1 최대 2개 가드 미적용, §발견 12), 미등록 회색. boolean 칩과 공존, 셋 다 false+배지 0이면 "-". (3) **엑셀**: 양식·목록 다운로드에 "배지" 열(`badges.join(',')`) 추가, 업로드 파싱에 배지 열(콤마 split, tags 패턴 복제). 소분류는 기존 "하위카테고리" 열 그대로. (4) **회귀 방어(graceful)**: products.badges 컬럼 미존재(마이그레이션 미적용) 시 — 폼 저장은 빈 badges 제외 + `PGRST204` 감지 시 badges 빼고 재시도, 엑셀 업로드는 빈 badges 제외, 마스터 fetch는 테이블 없으면 빈 배열 → 기존 자유입력 동작 보존. (5) 색·칩 토큰은 `MASTER_COLOR_FALLBACK`(A8 신설). 핵심 발견 9~12 충족. 마스터 CRUD UI 자체는 A8 소관(본 화면은 소비). **C1 고객 카드 배지 칩은 별도 트랙(미구현).**
- 2026-06-24 **대분류(category) 필수화 구현 (실 코드 변경)**. (1) **상품 폼**: 카테고리 자유 텍스트 `TextField` → 필수 `Select`(검사/도서/도구). `categoryInvalid` 상태 + `FormControl error`, `handleSave`에서 `categories.includes` 미충족 시 차단·경고 토스트. createEmptyProduct의 빈 category도 저장 차단. (2) **엑셀 업로드**: 매핑부 `category`를 `String().trim()` 정규화, 사전 검증 루프에 게이트 추가 — `categories.includes` false면 사유 "카테고리는 검사/도서/도구만 허용"으로 오류 표에 push·continue, 정상 행만 upsert. 기존 오류 표 구조 `{행,상품코드,상품명,사유}` 그대로. (3) `revenueByCategory.js` unclassified 콘솔 경고 유지(잔여 방어). (4) 동일 파일 사전 부채(`_rowNum` no-unused-vars) 정리. **하위카테고리·배지 동적화(P1)·다른 폼 필드 무변경.** 핵심 발견 1 갱신, 데이터 모델/엑셀 매핑/빈 상태 절에 게이트 명시.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1 트랙·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **대분류 고정 3(검사/도서/도구) + 소분류(`sub_category`) 동적 마스터(`subcategories`) 연동** 명시. 도구-검사 합산 폐지 정책 주석(매출 소관은 Dashboard). (2) **상태 태그 컬럼에 동적 배지(`products.badges` text[], 마스터 `badges`) 공존** — boolean 인기/신상품/할인과 병존, 미등록 회색, 어드민은 전량 노출. (3) **상품 폼**: 카테고리=대분류 Select·하위카테고리=소분류 마스터 Autocomplete 전환 검토, 배지 멀티선택 필드 신규(별도). (4) **엑셀**: "배지" 열 1개 추가(10→11컬럼), 소분류는 기존 "하위카테고리" 열 그대로(신규 열 불필요). 매핑·양식·목록 3곳 동일 추가. (5) 데이터 모델에 `products.badges`·소분류 자연키 추가. 핵심 발견 9~12(노출 전용·자연키·boolean 공존·전량 노출) 신설. 라인 번호 1137→1149 갱신. **소분류·배지 마스터 CRUD UI 자체는 A8 시트 소관.**
- 2026-05-13 신설.
- 2026-05-28 (M3-2): 실 페이지 시안 디자인 시스템 정합. 그라데이션 카드 6장 → border 기반 QuickFilterCard로 교체. PageHeader · SectionCard · ActionSlot · ui/EmptyState 합성 컴포넌트 적용. 모달 영역(line 903~1135) · 비즈니스 로직 · 권한 가드 · 받아쓰기 모달 · 엑셀 업·다운로드 전부 보존. 자동 검출 5종 본문 신규 위반 0.
