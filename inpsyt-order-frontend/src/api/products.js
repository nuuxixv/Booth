import { supabase } from '../supabaseClient';

/**
 * 조건에 따라 상품 목록을 가져옵니다.
 * @param {object} options - 필터링 및 정렬 옵션
 * @param {string} [options.searchTerm] - 검색어 (상품명)
 * @param {string} [options.category] - 카테고리
 * @returns {Promise<Array>} 상품 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const fetchProducts = async ({ searchTerm, category, tags, isPopularOnly = false, isNewOnly = false, currentPage = 1, productsPerPage = 10 }) => {
  let query = supabase.from('products').select('*', { count: 'exact' }); // Request count

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  } else if (tags && tags.length > 0) {
    // 상품 검색 시에는 학회 태그 필터를 무시하여 모든 상품을 검색할 수 있도록 함
    query = query.overlaps('tags', tags);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (isPopularOnly) {
    query = query.eq('is_popular', true);
  }
  
  if (isNewOnly) {
    query = query.eq('is_new', true);
  }
  

  query = query.order('is_popular', { ascending: false }).order('name');

  // Apply pagination
  const from = (currentPage - 1) * productsPerPage;
  const to = from + productsPerPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query; // Get count

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return { data, count }; // Return both data and count
};

/**
 * 모든 상품 목록을 가져옵니다. (페이지네이션 처리)
 * @returns {Promise<Array>} 상품 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const fetchAllProducts = async () => {
  const allProducts = [];
  const limit = 1000; // Supabase 서버의 기본 제한
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching products in chunk:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allProducts.push(...data);
      offset += data.length;
    } else {
      hasMore = false;
    }
  }
  
  return allProducts;
};

/**
 * 주어진 product_id 목록의 카테고리만 조회합니다. (매출 집계 미분류 보강용)
 * order_items.category가 비어 있는 품목의 카테고리를 products에서 보강할 때 사용 —
 * 전체 상품을 불러오지 않고 필요한 id만 `in` 조회한다. 빈 목록이면 조회 생략.
 * @param {Array<string|number>} ids - product_id 목록
 * @returns {Promise<Object>} { [product_id]: { category } }
 * @throws {Error} 조회 실패 시 에러 발생
 */
export const getProductCategoriesByIds = async (ids) => {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from('products')
    .select('id, category')
    .in('id', unique);
  if (error) {
    console.error('Error fetching product categories by ids:', error);
    throw error;
  }
  return Object.fromEntries((data || []).map((p) => [p.id, { category: p.category }]));
};

/**
 * 대분류(category)별 상품 개수를 집계합니다. (행사 판매 대분류 미리보기용)
 * @returns {Promise<Object>} { [category]: count } 형태. 예) { 검사: 340, 도서: 120, 도구: 25 }
 * @throws {Error} 조회 실패 시 에러 발생
 */
export const fetchProductCountByCategory = async () => {
  const counts = {};
  const limit = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error counting products by category:', error);
      throw error;
    }

    if (data && data.length > 0) {
      data.forEach((p) => {
        if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
      });
      offset += data.length;
    } else {
      hasMore = false;
    }
  }

  return counts;
};
