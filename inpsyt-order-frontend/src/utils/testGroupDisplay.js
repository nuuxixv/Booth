// =====================================================================
// 검사 위계(검사군 2뎁스) 진열용 순수 로직 — DOCS/PRD_검사위계.md, C1_OrderPage.md §검사군 카드.
// - test_group_id 로 클라 그룹핑. 서버 조인·집계 RPC 불필요.
// - 메타(약어·검사명·정렬)는 test_groups 마스터에서 병합.
// - graceful: test_group_id 없으면 그룹에 안 들어가고 평면으로 떨어짐(호출부가 평면 처리).
//             마스터가 비어도(테이블 미존재) 메타 폴백으로 진열 유지.
// - is_active 필터·검사군 is_active=false 제외는 호출부에서 수행(입력 상품은 이미 노출 대상).
// =====================================================================

// 도구는 검사 하위로 본다(진열·필터 정규화).
export const normalizeCategory = (category) => (category === '도구' ? '검사' : category);

// 상품이 행사 태그(주최 학회명 등) 중 하나라도 매칭되는지 — 진열 정렬 우선순위 판정용.
// eventTags 가 비면 항상 false → 태그 tiebreak가 0으로 수렴해 기존 정렬과 동일(graceful).
// 평면 상품·검사군 양쪽에서 재사용(단일 소스, 복붙 금지).
export function productMatchesEventTags(product, eventTags = []) {
  if (!eventTags.length) return false;
  return Array.isArray(product.tags) && product.tags.some((t) => eventTags.includes(t));
}

// 인기 탭 술어 — 행사 단위 3단 폴백. 인기 탭에서만 태그∧인기로 거른다(전체·신규 탭은 정렬만).
// 교집합이 비면 단계적으로 느슨하게: tier1 태그∧인기 / tier2 태그 상품 전부 / tier3 인기 전체(현행).
// 판정은 행사 전체(baseProducts) 기준 1회 — 카테고리 칩 선택과 무관(특정 칩에서 비면 빈 상태 안내가 맞다).
// eventTags 비면(어드민 피커·태그 없는 행사) 항상 tier3로 떨어져 현행과 동일. products null도 throw 안 함.
export function resolvePopularFilter(products, eventTags = []) {
  const list = products || [];
  const matchTag = (p) => productMatchesEventTags(p, eventTags);
  if (list.some((p) => matchTag(p) && p.is_popular)) return (p) => matchTag(p) && !!p.is_popular;
  if (list.some((p) => matchTag(p))) return (p) => matchTag(p);
  return (p) => !!p.is_popular;
}

// 상품이 특정 소분류(sub_category)에 속하는지 — 미지정은 '기타' 폴백.
// 단일 대분류 행사의 소분류 칩 필터에 사용. 평면 상품·검사군 옵션 양쪽에서 재사용
// (폴백 규칙 복붙 금지, 단일 소스).
export function productMatchesSubCategory(product, subCategory) {
  return (product.sub_category || '기타') === subCategory;
}

// 소분류 칩을 노출하는 대분류. 도구는 소분류가 3종(인지·언어·사회성)뿐이라 칩이 잘 좁혀지지만,
// 검사(17종)·도서(13종, 심리학 하나가 1,543개)는 칩이 과하고 좁혀지지도 않아 숨긴다.
// 두 대분류는 검사명·도서명 검색이 주 탐색 경로라는 판단(건우님, 2026-08-18).
export const SUBCATEGORY_CHIP_CATEGORIES = ['도구'];

// 카테고리 칩 줄 노출 여부.
// - 다중 대분류(일반 학회): 대분류 칩(전체/검사/도서/도구)을 쓰므로 항상 노출.
// - 단일 대분류: 대분류 칩은 무의미(전부 같은 대분류)라 소분류 칩으로 탐색하되,
//   위 화이트리스트(도구)만 노출·검사/도서는 숨긴다.
export function shouldShowCategoryChips(visibleCategories) {
  if (visibleCategories?.length !== 1) return true;
  return SUBCATEGORY_CHIP_CATEGORIES.includes(visibleCategories[0]);
}

/**
 * 검사군 마스터 배열 → 노출 검사군 메타 맵(is_active=false 제외).
 * @param {Array} master test_groups 행 배열
 * @returns {Map<number, object>} id → { abbr, name, sort_order, ... }
 */
export function buildGroupMetaMap(master) {
  const m = new Map();
  for (const g of master || []) {
    if (g.is_active === false) continue;
    m.set(g.id, g);
  }
  return m;
}

/**
 * 노출 대상 상품(이미 is_active·행사필터 통과)을 검사군으로 그룹핑.
 * @param {Array} products 노출 상품
 * @param {Map} groupMetaById buildGroupMetaMap 결과
 * @param {boolean} hasMaster 마스터 로드 여부(있는데 메타 없으면 제외)
 * @param {Array} eventTags 행사 태그(주최 학회명 등) — 매칭 검사군을 최상단으로. 기본 []=기존 정렬.
 * @returns {Array} [{ id, abbr, name, sort_order, options: [product...] }] — 정렬 완료
 */
export function groupTestProducts(products, groupMetaById, hasMaster, eventTags = []) {
  const map = new Map();
  for (const p of products || []) {
    if (normalizeCategory(p.category) !== '검사') continue;
    if (p.test_group_id == null) continue;
    const meta = groupMetaById.get(p.test_group_id);
    if (hasMaster && !meta) continue; // 마스터 있는데 검사군 없음/숨김 → 제외
    let g = map.get(p.test_group_id);
    if (!g) {
      g = {
        id: p.test_group_id,
        abbr: meta?.abbr ?? null,
        name: meta?.name ?? p.name,
        sort_order: meta?.sort_order ?? 0,
        options: [],
      };
      map.set(p.test_group_id, g);
    }
    g.options.push(p);
  }

  const groups = [...map.values()];
  const cmp = (a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return 0;
  };
  // 옵션 정렬: sort_order ASC(NULL 폴백 원본순 — 안정정렬) → 형태명
  for (const g of groups) {
    g.options.sort((a, b) => {
      const c = cmp(a, b);
      if (c !== 0) return c;
      return (a.option_name || a.name || '').localeCompare(b.option_name || b.name || '');
    });
  }
  // 검사군 태그매칭: 옵션 중 하나라도 행사 태그에 걸리면 매칭(검사군 단위 판정).
  const groupTagMatch = new Map();
  for (const g of groups) {
    groupTagMatch.set(g, g.options.some((p) => productMatchesEventTags(p, eventTags)));
  }
  // 검사군 정렬: 태그매칭 desc → sort_order ASC → 검사명
  groups.sort((a, b) => {
    const ta = groupTagMatch.get(a) ? 1 : 0;
    const tb = groupTagMatch.get(b) ? 1 : 0;
    if (ta !== tb) return tb - ta;
    const c = cmp(a, b);
    if (c !== 0) return c;
    return (a.name || '').localeCompare(b.name || '');
  });
  return groups;
}
