import { describe, it, expect } from 'vitest';
import { normalizeCategory, buildGroupMetaMap, groupTestProducts, productMatchesEventTags, productMatchesSubCategory, shouldShowCategoryChips, resolvePopularFilter } from './testGroupDisplay';

const master = [
  { id: 1, abbr: 'K·BASC-3', name: '한국판 정서-행동 평가시스템', sort_order: 1, is_active: true },
  { id: 2, abbr: 'CIBT', name: '인지행동치료 프로그램', sort_order: 2, is_active: true },
  { id: 9, abbr: 'K-WAIS-IV', name: '한국판 웩슬러 성인 지능검사', sort_order: 3, is_active: false }, // 숨김
];

const products = [
  // 검사군 1 — 옵션 3개(정렬 검증: sort_order 2,1,null)
  { id: 101, category: '검사', test_group_id: 1, option_name: 'B', sort_order: 2, is_popular: true },
  { id: 102, category: '검사', test_group_id: 1, option_name: 'A', sort_order: 1 },
  { id: 103, category: '검사', test_group_id: 1, option_name: 'C', sort_order: null },
  // 검사군 2 — 옵션 1개(도구 카테고리, 검사로 정규화)
  { id: 201, category: '도구', test_group_id: 2, option_name: '단일', sort_order: 1 },
  // 검사군 9 — 숨김(마스터 is_active=false) → 제외
  { id: 901, category: '검사', test_group_id: 9, option_name: 'X', sort_order: 1 },
  // 미분류 검사(test_group_id 없음) → 그룹 제외(평면)
  { id: 301, category: '검사', test_group_id: null, name: '미분류 검사' },
  // 도서(평면)
  { id: 401, category: '도서', name: '도서A' },
];

describe('normalizeCategory', () => {
  it('도구를 검사로 정규화', () => {
    expect(normalizeCategory('도구')).toBe('검사');
    expect(normalizeCategory('검사')).toBe('검사');
    expect(normalizeCategory('도서')).toBe('도서');
  });
});

describe('buildGroupMetaMap', () => {
  it('is_active=false 검사군은 제외', () => {
    const m = buildGroupMetaMap(master);
    expect(m.has(1)).toBe(true);
    expect(m.has(2)).toBe(true);
    expect(m.has(9)).toBe(false);
  });
  it('빈/undefined 마스터는 빈 맵', () => {
    expect(buildGroupMetaMap([]).size).toBe(0);
    expect(buildGroupMetaMap(undefined).size).toBe(0);
  });
});

describe('groupTestProducts', () => {
  const meta = buildGroupMetaMap(master);

  it('검사군으로 그룹핑하고 마스터 메타(약어·검사명) 병합', () => {
    const groups = groupTestProducts(products, meta, true);
    const ids = groups.map(g => g.id);
    expect(ids).toEqual([1, 2]); // 9=숨김 제외, sort_order 순
    expect(groups[0].abbr).toBe('K·BASC-3');
    expect(groups[0].name).toBe('한국판 정서-행동 평가시스템');
  });

  it('숨김 검사군(마스터 is_active=false) 제외', () => {
    const groups = groupTestProducts(products, meta, true);
    expect(groups.find(g => g.id === 9)).toBeUndefined();
  });

  it('미분류(test_group_id null)·도서는 그룹에 안 들어감(평면 대상)', () => {
    const groups = groupTestProducts(products, meta, true);
    const grouped = groups.flatMap(g => g.options.map(o => o.id));
    expect(grouped).not.toContain(301);
    expect(grouped).not.toContain(401);
  });

  it('옵션 정렬: sort_order ASC, NULL은 뒤로(원본순 안정)', () => {
    const groups = groupTestProducts(products, meta, true);
    const g1 = groups.find(g => g.id === 1);
    expect(g1.options.map(o => o.id)).toEqual([102, 101, 103]); // sort 1,2,null
  });

  it('옵션 1개 검사군도 정상 그룹핑(도구→검사 정규화)', () => {
    const groups = groupTestProducts(products, meta, true);
    const g2 = groups.find(g => g.id === 2);
    expect(g2.options).toHaveLength(1);
    expect(g2.options[0].id).toBe(201);
  });

  it('graceful: 마스터 없으면 메타 폴백(상품명·정렬 0)으로 그룹 유지', () => {
    const groups = groupTestProducts(products, new Map(), false);
    // 마스터 없음(hasMaster=false) → 숨김 판정 불가, test_group_id 있는 검사 전부 그룹(9 포함)
    const ids = groups.map(g => g.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 9]);
    const g1 = groups.find(g => g.id === 1);
    expect(g1.abbr).toBeNull();
    expect(g1.sort_order).toBe(0); // 마스터 없으면 정렬 폴백 0
  });

  it('빈 상품 배열은 빈 그룹', () => {
    expect(groupTestProducts([], meta, true)).toEqual([]);
  });

  it('eventTags 미지정 시 기존 정렬(sort_order) 유지 — graceful', () => {
    const groups = groupTestProducts(products, meta, true);
    expect(groups.map(g => g.id)).toEqual([1, 2]);
  });

  it('행사 태그 매칭 검사군을 최상단으로(옵션 중 하나라도 매칭) — sort_order보다 우선', () => {
    // 검사군 2(sort_order 2)의 옵션에만 학회 태그. 태그 없으면 [1,2]지만, 매칭 시 [2,1].
    const tagged = products.map(p =>
      p.id === 201 ? { ...p, tags: ['대한신경정신의학회'] } : p
    );
    const groups = groupTestProducts(tagged, meta, true, ['대한신경정신의학회']);
    expect(groups.map(g => g.id)).toEqual([2, 1]);
  });
});

describe('productMatchesSubCategory', () => {
  it('sub_category가 일치하면 true', () => {
    expect(productMatchesSubCategory({ sub_category: '성인' }, '성인')).toBe(true);
  });
  it('sub_category가 다르면 false', () => {
    expect(productMatchesSubCategory({ sub_category: '성인' }, '아동·청소년')).toBe(false);
  });
  it('sub_category 미지정은 "기타"로 폴백', () => {
    expect(productMatchesSubCategory({}, '기타')).toBe(true);
    expect(productMatchesSubCategory({ sub_category: null }, '기타')).toBe(true);
    expect(productMatchesSubCategory({ sub_category: '' }, '기타')).toBe(true);
    expect(productMatchesSubCategory({ sub_category: '성인' }, '기타')).toBe(false);
  });
});

// 단일 대분류 행사에서 소분류 칩이 검사군에 적용되는 규칙(컴포넌트 categoryFilteredGroups의
// 핵심 로직)을 그룹 데이터로 검증 — 옵션 중 하나라도 매칭이면 그 검사군 노출.
describe('소분류 필터 — 검사군 옵션 단위 매칭', () => {
  const meta = buildGroupMetaMap(master);
  const subProducts = [
    // 검사군 1 — 옵션 소분류가 섞임(성인 + 아동·청소년) → 성인/아동·청소년 둘 다에서 노출
    { id: 101, category: '검사', test_group_id: 1, option_name: 'B', sub_category: '성인' },
    { id: 102, category: '검사', test_group_id: 1, option_name: 'A', sub_category: '아동·청소년' },
    // 검사군 2 — 옵션 전부 소분류 미지정 → '기타'에서만 노출
    { id: 201, category: '도구', test_group_id: 2, option_name: '단일' },
  ];
  const groups = groupTestProducts(subProducts, meta, true);

  const filterBySub = (sub) => groups.filter(g => g.options.some(p => productMatchesSubCategory(p, sub)));

  it('옵션 중 하나라도 매칭이면 검사군 노출', () => {
    expect(filterBySub('성인').map(g => g.id)).toEqual([1]);
    expect(filterBySub('아동·청소년').map(g => g.id)).toEqual([1]);
  });
  it('옵션 전부 불일치면 검사군 제외', () => {
    expect(filterBySub('임상')).toEqual([]);
  });
  it('sub_category 없는 옵션 검사군은 "기타"에 매칭', () => {
    expect(filterBySub('기타').map(g => g.id)).toEqual([2]);
  });
});

describe('shouldShowCategoryChips — 대분류별 소분류 칩 노출', () => {
  it('단일 대분류 도구는 소분류 칩 노출', () => {
    expect(shouldShowCategoryChips(['도구'])).toBe(true);
  });
  it('단일 대분류 검사·도서는 소분류 칩 숨김', () => {
    expect(shouldShowCategoryChips(['검사'])).toBe(false);
    expect(shouldShowCategoryChips(['도서'])).toBe(false);
  });
  it('다중 대분류(일반 학회)는 대분류 칩 노출', () => {
    expect(shouldShowCategoryChips(['검사', '도서'])).toBe(true);
    expect(shouldShowCategoryChips(['검사', '도서', '도구'])).toBe(true);
  });
  it('visible_categories 미지정(NULL/빈 배열)은 대분류 칩 노출(기존 행사 보존)', () => {
    expect(shouldShowCategoryChips(null)).toBe(true);
    expect(shouldShowCategoryChips(undefined)).toBe(true);
    expect(shouldShowCategoryChips([])).toBe(true);
  });
});

describe('productMatchesEventTags', () => {
  it('상품 태그가 행사 태그 중 하나라도 겹치면 true', () => {
    expect(productMatchesEventTags({ tags: ['대한치매학회'] }, ['대한치매학회'])).toBe(true);
    expect(productMatchesEventTags({ tags: ['A', '대한치매학회'] }, ['대한치매학회', 'B'])).toBe(true);
  });
  it('겹치지 않으면 false', () => {
    expect(productMatchesEventTags({ tags: ['A'] }, ['B'])).toBe(false);
  });
  it('eventTags 비었으면 항상 false(정렬 tiebreak 0으로 수렴)', () => {
    expect(productMatchesEventTags({ tags: ['A'] }, [])).toBe(false);
    expect(productMatchesEventTags({ tags: ['A'] })).toBe(false);
  });
  it('상품 tags 부재/비배열도 안전하게 false', () => {
    expect(productMatchesEventTags({}, ['A'])).toBe(false);
    expect(productMatchesEventTags({ tags: null }, ['A'])).toBe(false);
  });
});

// 인기 탭 술어 — 행사 단위 3단 폴백(tier1 태그∧인기 / tier2 태그 / tier3 인기).
describe('resolvePopularFilter', () => {
  const TAG = ['대한신경정신의학회'];
  const tagPopular = { id: 1, tags: ['대한신경정신의학회'], is_popular: true };
  const tagOnly = { id: 2, tags: ['대한신경정신의학회'], is_popular: false };
  const popularOnly = { id: 3, tags: ['무관학회'], is_popular: true };
  const neither = { id: 4, tags: ['무관학회'], is_popular: false };

  it('tier1: 태그∧인기가 있으면 태그∧인기만 통과(태그만·인기만은 제외)', () => {
    const f = resolvePopularFilter([tagPopular, tagOnly, popularOnly, neither], TAG);
    expect(f(tagPopular)).toBe(true);
    expect(f(tagOnly)).toBe(false);
    expect(f(popularOnly)).toBe(false);
    expect(f(neither)).toBe(false);
  });

  it('tier2: 태그∧인기=0이지만 태그 상품이 있으면 태그 매칭 전부 통과(소아청소년과학회 케이스)', () => {
    const f = resolvePopularFilter([tagOnly, popularOnly, neither], TAG);
    expect(f(tagOnly)).toBe(true);
    expect(f(popularOnly)).toBe(false); // 태그 불일치
    expect(f(neither)).toBe(false);
  });

  it('tier3: 태그 매칭 상품이 0이면 is_popular만 통과(현행)', () => {
    const f = resolvePopularFilter([popularOnly, neither], TAG);
    expect(f(popularOnly)).toBe(true);
    expect(f(neither)).toBe(false);
  });

  it('eventTags=[]이면 tier3(어드민 피커·태그 없는 행사)', () => {
    const f = resolvePopularFilter([tagPopular, tagOnly, popularOnly, neither], []);
    expect(f(tagPopular)).toBe(true); // is_popular
    expect(f(tagOnly)).toBe(false);
    expect(f(popularOnly)).toBe(true); // is_popular
    expect(f(neither)).toBe(false);
  });

  it('products=[]·null·undefined여도 throw하지 않고 tier3 술어 반환', () => {
    expect(() => resolvePopularFilter([], TAG)).not.toThrow();
    expect(() => resolvePopularFilter(null, TAG)).not.toThrow();
    expect(() => resolvePopularFilter(undefined)).not.toThrow();
    const f = resolvePopularFilter(null, TAG);
    expect(f(tagPopular)).toBe(true); // is_popular
    expect(f(neither)).toBe(false);
  });

  it('검사군 단위: options.some(filter)에서 옵션 하나만 태그∧인기여도 검사군 노출', () => {
    const base = [tagPopular, tagOnly, popularOnly, neither];
    const f = resolvePopularFilter(base, TAG); // tier1
    const group = { options: [tagOnly, tagPopular] }; // 옵션 중 하나(tagPopular)만 태그∧인기
    const groupNoMatch = { options: [tagOnly, popularOnly] };
    expect(group.options.some(f)).toBe(true);
    expect(groupNoMatch.options.some(f)).toBe(false);
  });
});
