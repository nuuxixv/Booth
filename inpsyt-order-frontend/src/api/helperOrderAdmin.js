import { supabase } from '../supabaseClient';

// 현장 도움(PIN) 주문 — 어드민 RPC 얇은 래퍼.
// 백엔드 계약: supabase/migrations/20261019000300(create_helper_order)·000600(close/reopen_event).
// 운영 DB 적용 완료(2026-10-19). 직접 Supabase 호출은 이 레이어로만.

/**
 * 진행 중 학회에 준비중(preparing) 주문 1건 + 4자리 PIN을 생성한다. 상품 0개로도 생성.
 * @param {number} eventId
 * @returns {Promise<{ order_id:number, match_code:string, access_token:string }>}
 * @throws {Error} 권한 없음·종료된 학회 등 — message는 RPC 예외 문구
 */
export const createHelperOrder = async (eventId) => {
  const { data, error } = await supabase.rpc('create_helper_order', { p_event_id: eventId });
  if (error) throw error;
  return data;
};

/**
 * 학회를 종료한다 — 준비중 주문 삭제 + closed_at 기록(주문서 링크·PIN 닫힘).
 * @param {number} eventId
 * @returns {Promise<{ deleted_count:number }>}
 * @throws {Error} 권한(events:edit) 없음 등
 */
export const closeEvent = async (eventId) => {
  const { data, error } = await supabase.rpc('close_event', { p_event_id: eventId });
  if (error) throw error;
  return data;
};

/**
 * 종료한 학회의 주문서 링크를 다시 연다(closed_at = null). 삭제된 준비중 주문은 복구되지 않는다.
 * @param {number} eventId
 * @returns {Promise<{ closed_at:null }>}
 * @throws {Error} 권한(events:edit) 없음 등
 */
export const reopenEvent = async (eventId) => {
  const { data, error } = await supabase.rpc('reopen_event', { p_event_id: eventId });
  if (error) throw error;
  return data;
};

/**
 * 해당 학회의 준비중 주문 건수(종료 시 삭제될 건수). 읽기 전용 count 쿼리.
 * @param {number} eventId
 * @returns {Promise<number>}
 */
export const countPreparingOrders = async (eventId) => {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'preparing');
  if (error) throw error;
  return count || 0;
};
