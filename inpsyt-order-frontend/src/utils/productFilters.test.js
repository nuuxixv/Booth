import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FACETS,
  isFacetsActive,
  matchesCategory,
  matchesFacets,
  matchesTags,
  buildTagOptions,
} from './productFilters';

const base = {
  category: '도서',
  is_discountable: false,
  discount_override: null,
  is_popular: false,
  is_new: false,
  image_filename: null,
  includes_online_code: false,
  tags: [],
};
const make = (over) => ({ ...base, ...over });
const facets = (over) => ({ ...DEFAULT_FACETS, ...over });

describe('matchesCategory', () => {
  it('미선택(빈 배열)이면 전부 통과', () => {
    expect(matchesCategory(make({ category: '도구' }), [])).toBe(true);
  });
  it('한 개 선택 — 값 일치', () => {
    expect(matchesCategory(make({ category: '검사' }), ['검사'])).toBe(true);
    expect(matchesCategory(make({ category: '도서' }), ['검사'])).toBe(false);
  });
  it('여러 개 선택은 OR — 도서·도구', () => {
    expect(matchesCategory(make({ category: '도서' }), ['도서', '도구'])).toBe(true);
    expect(matchesCategory(make({ category: '도구' }), ['도서', '도구'])).toBe(true);
    expect(matchesCategory(make({ category: '검사' }), ['도서', '도구'])).toBe(false);
  });
});

describe('matchesFacets', () => {
  it('기본값(전체)이면 전부 통과', () => {
    expect(matchesFacets(make({}), DEFAULT_FACETS)).toBe(true);
  });
  it('속성 간 AND — 할인 여부 N + 인기 Y', () => {
    const f = facets({ isDiscountable: 'n', isPopular: 'y' });
    expect(matchesFacets(make({ is_popular: true }), f)).toBe(true);
    expect(matchesFacets(make({ is_popular: true, is_discountable: true }), f)).toBe(false);
    expect(matchesFacets(make({ is_popular: false }), f)).toBe(false);
  });
  it('개별 할인 = discount_override != null (0도 Y)', () => {
    expect(matchesFacets(make({ discount_override: 0 }), facets({ discountOverride: 'y' }))).toBe(true);
    expect(matchesFacets(make({ discount_override: null }), facets({ discountOverride: 'n' }))).toBe(true);
  });
  it('신상품 Y/N', () => {
    expect(matchesFacets(make({ is_new: true }), facets({ isNew: 'y' }))).toBe(true);
    expect(matchesFacets(make({ is_new: true }), facets({ isNew: 'n' }))).toBe(false);
  });
  it('판매상태 = 고객 주문서 노출(is_active), 미적용(undefined)은 Y', () => {
    expect(matchesFacets(make({ is_active: true }), facets({ isActive: 'y' }))).toBe(true);
    expect(matchesFacets(make({ is_active: undefined }), facets({ isActive: 'y' }))).toBe(true);
    expect(matchesFacets(make({ is_active: false }), facets({ isActive: 'y' }))).toBe(false);
    expect(matchesFacets(make({ is_active: false }), facets({ isActive: 'n' }))).toBe(true);
  });
  it('이미지 등록 — NULL·빈 문자열·공백은 N', () => {
    expect(matchesFacets(make({ image_filename: 'a.jpg' }), facets({ hasImage: 'y' }))).toBe(true);
    expect(matchesFacets(make({ image_filename: '' }), facets({ hasImage: 'n' }))).toBe(true);
    expect(matchesFacets(make({ image_filename: '  ' }), facets({ hasImage: 'n' }))).toBe(true);
    expect(matchesFacets(make({ image_filename: null }), facets({ hasImage: 'y' }))).toBe(false);
  });
  it('온라인코드 3상태 — 미확인은 검사 한정 아님, undefined도 미확인', () => {
    expect(matchesFacets(make({ includes_online_code: true }), facets({ onlineCode: 'y' }))).toBe(true);
    expect(matchesFacets(make({ includes_online_code: false }), facets({ onlineCode: 'n' }))).toBe(true);
    expect(matchesFacets(make({ category: '도서', includes_online_code: null }), facets({ onlineCode: 'unknown' }))).toBe(true);
    expect(matchesFacets(make({ includes_online_code: undefined }), facets({ onlineCode: 'unknown' }))).toBe(true);
    expect(matchesFacets(make({ includes_online_code: false }), facets({ onlineCode: 'unknown' }))).toBe(false);
  });
});

describe('matchesTags', () => {
  it('선택 없으면 통과, 선택 시 OR', () => {
    expect(matchesTags(make({ tags: [] }), [])).toBe(true);
    expect(matchesTags(make({ tags: ['임상'] }), ['오티즘', '임상'])).toBe(true);
    expect(matchesTags(make({ tags: ['신간'] }), ['오티즘', '임상'])).toBe(false);
    expect(matchesTags(make({ tags: null }), ['임상'])).toBe(false);
  });
});

describe('isFacetsActive', () => {
  it('하나라도 all이 아니면 true', () => {
    expect(isFacetsActive(DEFAULT_FACETS)).toBe(false);
    expect(isFacetsActive(facets({ onlineCode: 'unknown' }))).toBe(true);
  });
});

describe('buildTagOptions', () => {
  it('학회명 정렬 앞, 나머지 자유 태그 정렬 뒤, 중복 제거', () => {
    const products = [{ tags: ['임상', '한국심리학회'] }, { tags: ['신간', '임상'] }, { tags: null }];
    const societies = [{ name: '한국심리학회' }, { name: 'TEST' }, { name: '' }];
    const { availableTags, societyTagSet } = buildTagOptions(products, societies);
    expect(availableTags).toEqual(['TEST', '한국심리학회', '신간', '임상']);
    expect(societyTagSet.has('TEST')).toBe(true);
    expect(societyTagSet.has('임상')).toBe(false);
  });
});
