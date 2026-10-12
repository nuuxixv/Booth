// 출고 집계 공용 규칙 — 출고 관리(A3)와 학회 상세(L2 사후 업무 출고 현황)가 동일 규칙으로 센다.
// 모집단 = paid+completed. 합배송 껍데기(is_group_parent)는 1건(자식 제외, 자식은 parent_order_id 보유).
// 상태 = effectiveStatus(껍데기는 활성 자식 파생 = summarizeGroupStatus, 그 외는 자기 status).
// 현장수령 주문도 completed 이므로 "처리 완료"에 포함된다.
import { summarizeGroupStatus } from './groupOrder';

/**
 * 그룹화된 주문 목록(groupLinkedOrders 결과)의 출고 집계를 센다.
 * @param {Array} orders - 플랫 주문 목록(껍데기엔 linkedChildren 포함). 자식(parent_order_id)은 내부에서 제외.
 * @returns {{ total:number, completed:number, pending:number }}
 *   total = 출고 대상(paid+completed) · completed = 처리 완료 · pending = 출고 대기(total−completed)
 */
export const fulfillmentCounts = (orders = []) => {
  let total = 0;
  let completed = 0;
  let pending = 0;
  for (const order of orders) {
    if (order.parent_order_id) continue; // 합배송 자식 — 껍데기 1건으로만 센다
    const status = order.is_group_parent
      ? summarizeGroupStatus(order.linkedChildren || []).value
      : order.status;
    if (status === 'cancelled' || status === 'refunded') continue; // 모집단 밖
    total += 1;
    if (status === 'completed') completed += 1;
    else if (status === 'paid') pending += 1;
  }
  return { total, completed, pending };
};
