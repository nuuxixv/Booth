import { supabase } from '../supabaseClient';
import { buildHelperSubmitParams } from '../utils/pinOrderCustomer';

// 고객 PIN 주문(현장 도움) — RPC 얇은 래퍼. 직접 Supabase 호출은 이 계층에만 둔다.

// 상품 검색창 PIN 조회. 그 학회의 살아 있는 준비중 주문의 상품·금액만 반환(개인정보·토큰 없음).
// 반환: { has_items, order_items[], total_cost, discount_amount, delivery_fee, final_payment } | null
export const getHelperOrderByCode = async (eventId, code) => {
  const { data, error } = await supabase.rpc('get_helper_order_by_code', {
    p_event_id: eventId,
    p_code: code,
  });
  if (error) throw error;
  return data;
};

// 고객 제출(배송지만). 성공 시 { order_id, access_token, status, final_payment }.
// 학회·PIN 불일치/종료/이미 제출 시 SQLSTATE P0002.
export const submitHelperOrder = async (payload) => {
  const { data, error } = await supabase.rpc('submit_helper_order', buildHelperSubmitParams(payload));
  if (error) throw error;
  return data;
};
