// 상품 관리 필터 바(A6 §필터 바, 2026-10-19) 판정 로직 — 순수 함수(단위 테스트 대상).
// 속성 간 AND, 태그는 OR. 검색어 매칭은 검사군 메타가 필요해 컴포넌트에 남긴다.

export const PRODUCT_CATEGORIES = ['도서', '검사', '도구'];
// 카테고리 '미확인' = 도서·검사·도구 어느 값도 아님(NULL·빈 문자열·그 외).
export const UNKNOWN_CATEGORY = '미확인';

// 속성별 단일 선택. Y/N 속성은 'all'|'y'|'n', 온라인코드만 'unknown'(NULL) 추가.
export const DEFAULT_FACETS = Object.freeze({
  isDiscountable: 'all',
  discountOverride: 'all',
  isPopular: 'all',
  isNew: 'all',
  hasImage: 'all',
  onlineCode: 'all',
});

export const isFacetsActive = (facets) =>
  Object.keys(DEFAULT_FACETS).some((k) => facets[k] !== DEFAULT_FACETS[k]);

const matchesYN = (state, truthy) => state === 'all' || (state === 'y' ? truthy : !truthy);

export const matchesCategory = (product, category) => {
  if (!category) return true;
  if (category === UNKNOWN_CATEGORY) return !PRODUCT_CATEGORIES.includes(product.category);
  return product.category === category;
};

export const matchesFacets = (product, facets) => {
  if (!matchesYN(facets.isDiscountable, !!product.is_discountable)) return false;
  if (!matchesYN(facets.discountOverride, product.discount_override != null)) return false;
  if (!matchesYN(facets.isPopular, !!product.is_popular)) return false;
  if (!matchesYN(facets.isNew, !!product.is_new)) return false;
  // 이미지 등록 = image_filename 값 있음(NULL·빈 문자열 = N)
  if (!matchesYN(facets.hasImage, !!(product.image_filename || '').trim())) return false;
  // 온라인코드 3상태 그대로(검사 한정 조건 없음). 컬럼 미적용 환경의 undefined는 미확인(NULL) 취급.
  if (facets.onlineCode === 'y') return product.includes_online_code === true;
  if (facets.onlineCode === 'n') return product.includes_online_code === false;
  if (facets.onlineCode === 'unknown') return product.includes_online_code == null;
  return true;
};

export const matchesTags = (product, selectedTags) =>
  selectedTags.length === 0 || selectedTags.some((tag) => (product.tags || []).includes(tag));

// 태그 옵션 = 학회 목록(societies.name) 정렬 앞 + 나머지 자유 태그(products.tags) 정렬 뒤.
export const buildTagOptions = (products, societies) => {
  const societyNames = Array.from(new Set(societies.map((s) => s.name).filter(Boolean))).sort();
  const societyTagSet = new Set(societyNames);
  const freeTags = Array.from(new Set(products.flatMap((p) => p.tags || [])))
    .filter((tag) => !societyTagSet.has(tag))
    .sort();
  return { availableTags: [...societyNames, ...freeTags], societyTagSet };
};
