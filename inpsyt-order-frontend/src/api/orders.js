import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * 필터 및 페이지네이션 옵션에 따라 주문 목록을 가져옵니다.
 * @param {object} options - 필터 및 페이지네이션 옵션
 * @param {number} options.currentPage - 현재 페이지
 * @param {number} options.ordersPerPage - 페이지 당 주문 수
 * @param {string} [options.searchTerm] - 고객명/이메일 검색어
 * @param {string} [options.selectedStatus] - 선택된 주문 상태
 * @param {string|number} [options.selectedEvent] - 선택된 학회 ID
 * @param {Date} [options.startDate] - 조회 시작일
 * @param {Date} [options.endDate] - 조회 종료일
 * @returns {Promise<{data: Array, count: number}>} 주문 목록과 전체 개수
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
const ALL_ITEMS_SELECT = 'order_items(id, product_id, quantity, price_at_purchase, product_name, product_code, category, list_price, on_site_pickup)';

const applyBaseFilters = (query, { searchTerm, selectedStatuses, selectedEvents, startDate, endDate }) => {
  if (searchTerm) {
    // 콤마·괄호는 PostgREST .or() 파서와 충돌 → 공백으로 치환
    const term = searchTerm.replace(/[,()]/g, ' ').trim();
    if (term) {
      const clauses = [
        `customer_name.ilike.%${term}%`,
        `phone_number.ilike.%${term}%`,
        `inpsyt_id.ilike.%${term}%`,
      ];
      // 연락처는 숫자 정본 저장 → 검색어의 숫자만 추출해 부분 일치
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 2) clauses.push(`phone_number.ilike.%${digits}%`);
      // 주문번호(#123 또는 123)만 id 정확 일치 절 추가 (비숫자면 미추가 — PostgREST 에러 방지)
      if (/^#?\d+$/.test(term)) {
        clauses.push(`id.eq.${term.replace(/^#/, '')}`);
      }
      query = query.or(clauses.join(','));
    }
  }
  if (selectedStatuses?.length > 0) query = query.in('status', selectedStatuses);
  if (selectedEvents?.length > 0) query = query.in('event_id', selectedEvents);
  if (startDate && endDate) {
    const start = format(startOfDay(startDate), 'yyyy-MM-dd HH:mm:ss');
    const end = format(endOfDay(endDate), 'yyyy-MM-dd HH:mm:ss');
    query = query.gte('created_at', start).lte('created_at', end);
  }
  return query;
};

export const getOrders = async (options) => {
  const {
    currentPage,
    ordersPerPage,
    searchTerm,
    selectedStatuses,
    selectedEvents,
    startDate,
    endDate,
    productCategory,
    productSearchTerm,
  } = options;

  const from = (currentPage - 1) * ordersPerPage;
  const to = from + ordersPerPage - 1;
  const baseFilters = { searchTerm, selectedStatuses, selectedEvents, startDate, endDate };

  const needsProductFilter = Boolean(productCategory || productSearchTerm?.trim());

  if (needsProductFilter) {
    // Step 1: 해당 상품 조건이 있는 주문 ID만 추출 (!inner로 필터링)
    let idQuery = supabase
      .from('orders')
      .select('id, order_items!inner(category, product_name)')
      .limit(5000);
    idQuery = applyBaseFilters(idQuery, baseFilters);
    if (productCategory) idQuery = idQuery.eq('order_items.category', productCategory);
    if (productSearchTerm?.trim()) idQuery = idQuery.ilike('order_items.product_name', `%${productSearchTerm.trim()}%`);

    const { data: matched, error: idError } = await idQuery;
    if (idError) throw idError;
    if (!matched || matched.length === 0) return { data: [], count: 0 };

    const matchedIds = [...new Set(matched.map(o => o.id))];

    // Step 2: 해당 주문들을 전체 아이템 포함해서 재조회 (카테고리 필터 없음)
    const { data, error, count } = await supabase
      .from('orders')
      .select(`*, ${ALL_ITEMS_SELECT}`, { count: 'exact' })
      .in('id', matchedIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count };
  }

  // 상품 필터 없음: 단일 쿼리
  let query = supabase
    .from('orders')
    .select(`*, ${ALL_ITEMS_SELECT}`, { count: 'exact' })
    .order('created_at', { ascending: false });

  query = applyBaseFilters(query, baseFilters);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
  return { data, count };
};

/**
 * 출고 관리용 주문 목록을 가져옵니다 (order_items → products 중첩 join 포함).
 */
export const getFulfillmentOrders = async ({ eventId, statuses, dateFrom, dateTo } = {}) => {
  let query = supabase
    .from('orders')
    .select(`
      id, parent_order_id, is_group_parent, representative_child_id, customer_name, phone_number, shipping_address,
      final_payment, delivery_fee, status, created_at, is_on_site_sale,
      customer_request, admin_memo, event_id, inpsyt_id, has_online_code,
      events(name),
      order_items(id, product_id, quantity, price_at_purchase, product_name, product_code, category, list_price, on_site_pickup,
        products(name, category, includes_online_code)
      )
    `)
    .in('status', statuses || ['paid', 'completed'])
    .order('created_at', { ascending: false });

  if (eventId) query = query.eq('event_id', eventId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

/**
 * N개 주문을 합배송 그룹으로 연계합니다 (껍데기 부모 모델).
 * 서버 RPC(link_orders_into_group)가 단일 트랜잭션으로:
 *   껍데기 부모 INSERT + 자식 parent_order_id 연결 + 배송비 조정을 수행합니다.
 * @param {Array<number>} childOrderIds 연계할 자식 주문 ID 배열 (2건 이상)
 * @param {number} repChildId 대표(묶음 배송지·배송비 담당) 자식 주문 ID
 * @returns {Promise<number>} 생성된 껍데기 부모 주문 ID
 * @throws {Error} 권한 부족 / 이미 그룹 / 학회 불일치 / 취소·환불 포함 시
 */
export const linkOrders = async (childOrderIds, repChildId) => {
  const { data, error } = await supabase.rpc('link_orders_into_group', {
    p_child_ids: childOrderIds,
    p_rep_child_id: repChildId,
  });
  if (error) throw error;
  return data; // 껍데기 부모 id
};

/**
 * 대표 주문 취소 시 새 대표에게 배송지·배송비를 위임합니다 (§4).
 * 옛 대표의 status=cancelled 전환은 별도 status 변경 경로가 담당합니다.
 * @param {number} groupParentId 껍데기 부모 주문 ID
 * @param {number} oldRepChildId 취소되는 옛 대표 자식 ID
 * @param {number} newRepChildId 새 대표 자식 ID (프론트에서 선택/자동 결정)
 * @returns {Promise<{group_parent_id:number, new_rep_child_id:number, delivery_fee:number,
 *   needs_onsite_fee:boolean, onsite_fee_amount:number, shell_total:number, group_status:string}>}
 */
export const reassignGroupRepresentative = async (groupParentId, oldRepChildId, newRepChildId) => {
  const { data, error } = await supabase.rpc('reassign_group_representative', {
    p_group_parent_id: groupParentId,
    p_old_rep_child_id: oldRepChildId,
    p_new_rep_child_id: newRepChildId,
  });
  if (error) throw error;
  return data;
};

/**
 * @deprecated 합배송 껍데기 부모 모델에서는 연계 해제를 지원하지 않습니다 (설계 §3).
 *   붙이면 확정 — 정 필요하면 자식 개별 취소 + 재주문. 호출 시 예외를 던집니다.
 */
export const unlinkOrders = async () => {
  throw new Error('연계 해제는 지원하지 않습니다 (합배송은 확정). 개별 취소 후 재주문하세요.');
};

/**
 * 주어진 주문 목록에서 합배송(껍데기 부모 + 자식)을 그룹화하여 병합된 주문 객체를 반환합니다.
 * - 껍데기 부모(is_group_parent): { ...order, linkedChildren:[...], mergedItems: 자식 아이템, mergedTotal: 자식 합 }
 *   (껍데기는 order_items 없음·final_payment=자식합이므로 자식 금액만 집계 — 중복 합산 금지)
 *   대표(배송지·배송비 담당) 자식은 껍데기 order.representative_child_id 로 명시 노출된다
 *   (getOrders 는 select('*') 로 자동 포함). 프론트는 이 값을 직접 신뢰한다(추정 로직 없음).
 * - 자식 주문: 그대로 반환 (parent_order_id 유지)
 * - 비연계 단독: 자기 상품·금액
 */
export const groupLinkedOrders = (orders) => {
  // Build a map of children by parent_order_id
  const childrenMap = {};
  orders.forEach(order => {
    if (order.parent_order_id) {
      if (!childrenMap[order.parent_order_id]) childrenMap[order.parent_order_id] = [];
      childrenMap[order.parent_order_id].push(order);
    }
  });

  return orders.map(order => {
    const children = childrenMap[order.id] || [];

    if (order.is_group_parent) {
      // 껍데기 부모 — 자식 아이템만 병합(껍데기 자체는 상품 없음), 금액은 자식 합
      const mergedItems = children.flatMap(c => (c.order_items || []).map(i => ({ ...i, order_id: c.id })));
      const mergedTotal = children.reduce((s, c) => s + (c.final_payment || 0), 0);
      return { ...order, linkedChildren: children, mergedItems, mergedTotal };
    }

    if (!order.parent_order_id) {
      // 비연계 단독 (레거시 실 부모 방어 포함 — 자식 있으면 함께 병합)
      const mergedItems = [
        ...(order.order_items || []).map(i => ({ ...i, order_id: order.id })),
        ...children.flatMap(c => (c.order_items || []).map(i => ({ ...i, order_id: c.id }))),
      ];
      const mergedTotal = (order.final_payment || 0) + children.reduce((s, c) => s + (c.final_payment || 0), 0);
      return { ...order, linkedChildren: children, mergedItems, mergedTotal };
    }

    // Child order - return as-is
    const mergedItems = (order.order_items || []).map(i => ({ ...i, order_id: order.id }));
    return { ...order, linkedChildren: [], mergedItems, mergedTotal: order.final_payment || 0 };
  });
};

/**
 * 합배송 그룹(껍데기 부모)을 삭제합니다. master 전용 교정 경로 — "잘못 연계한 그룹 취소"(설계 §3).
 * 서버 RPC(delete_order_group)가 단일 트랜잭션으로 자식 독립 복원·배송비 원복·껍데기 삭제를 처리합니다.
 *   · pending 자식: 자기 정가 기준 배송비 재계산 후 금액 자동 반영
 *   · paid/completed 자식: 금액 불변 + 부족 배송비는 현장 별도결제 안내(needs_onsite_fee)
 * @param {number} groupParentId 껍데기 부모 주문 ID
 * @returns {Promise<{group_parent_id:number, restored_children:Array<{id:number,
 *   customer_name:string, phone_number:string, status:string, delivery_fee:number,
 *   final_payment:number}>, needs_onsite_fee:boolean, total_onsite_fee_amount:number}>}
 * @throws {Error} 권한 부족(master 아님) / 합배송 컨테이너 아님
 */
export const deleteOrderGroup = async (groupParentId) => {
  const { data, error } = await supabase.rpc('delete_order_group', {
    p_group_parent_id: groupParentId,
  });
  if (error) throw error;
  return data;
};

/**
 * 연계 주문 연결 시 parent 후보를 검색합니다.
 * parent_order_id가 없는 주문만 반환 (이미 child인 주문은 parent가 될 수 없음).
 */
export const searchOrdersForLinking = async (term, excludeOrderId) => {
  const cleaned = term.replace(/[,()]/g, ' ').trim();
  const clauses = [
    `customer_name.ilike.%${cleaned}%`,
    `phone_number.ilike.%${cleaned}%`,
  ];
  // 연락처는 숫자 정본 저장 → 검색어의 숫자만 추출해 부분 일치
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 2) clauses.push(`phone_number.ilike.%${digits}%`);

  let query = supabase
    .from('orders')
    .select('id, customer_name, phone_number, total_cost, discount_amount, final_payment, delivery_fee, status, created_at, parent_order_id, is_group_parent, event_id, shipping_address')
    .or(clauses.join(','))
    .is('parent_order_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (excludeOrderId) query = query.neq('id', excludeOrderId);

  const { data, error } = await query;
  if (error) throw error;
  // 껍데기 부모는 연계 후보가 될 수 없음(실 주문만 자식이 된다).
  // preparing(현장 도움·준비중)은 아직 미완료 주문이라 합배송 후보에서 제외한다.
  //   — 쿼리 단계에 cancelled/refunded 제외를 새로 넣으면 기존 동작이 바뀌므로(현재는
  //     상태 필터가 없음) 여기선 preparing 만 클라이언트에서 뺀다(회귀 0, 상세는 보고 참조).
  return (data || []).filter(o => !o.is_group_parent && o.status !== 'preparing');
};

/**
 * 같은 학회의 연계 가능한 주문 목록을 검색어 없이 가져옵니다. (합배송 만들기 기본 목록)
 * parent_order_id가 없고 취소/환불/준비중이 아닌 실 주문만 반환.
 * @param {number} eventId - 기준 주문의 event_id
 * @param {number} [excludeOrderId] - 목록에서 제외할 기준 주문 id
 */
export const getLinkableOrdersByEvent = async (eventId, excludeOrderId) => {
  let query = supabase
    .from('orders')
    .select('id, customer_name, phone_number, total_cost, discount_amount, final_payment, delivery_fee, status, created_at, parent_order_id, is_group_parent, event_id, shipping_address')
    .eq('event_id', eventId)
    .is('parent_order_id', null)
    // preparing(현장 도움·준비중)은 미완료라 합배송 후보에서 제외. 기존 cancelled/refunded
    //   제외 목록에 덧붙인다(preparing 은 신규 상태라 기존 데이터에 없음 → 회귀 0).
    .not('status', 'in', '("cancelled","refunded","preparing")')
    .order('created_at', { ascending: false })
    .limit(200);

  if (excludeOrderId) query = query.neq('id', excludeOrderId);

  const { data, error } = await query;
  if (error) throw error;
  // 껍데기 부모는 연계 후보가 될 수 없음(실 주문만 자식이 된다)
  return (data || []).filter(o => !o.is_group_parent);
};
