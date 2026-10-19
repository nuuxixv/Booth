// 주문 상태 정의
// preparing → 준비중    : 현장 도움(PIN) 주문이 아직 완성되지 않음(상품 또는 고객정보 미충족).
//                         매출/출고/합배송 어디에도 포함되지 않는 미완료 상태. 자동으로
//                         결제대기(pending)로 전환되며, 수동 전이는 취소만 허용.
// pending   → 결제대기  : 고객이 주문서 제출 완료
// paid      → 결제완료  : 현장 담당자가 결제 처리
// completed → 처리완료  : 출고 담당자가 출고처리 (최종)
// cancelled → 주문취소  : 결제대기 상태에서 취소 (매출 없음)
// refunded  → 결제취소  : 결제완료 후 취소 (카드단말기 취소)

export const STATUS_TO_KOREAN = {
  preparing: '준비중',
  pending:   '결제대기',
  paid:      '결제완료',
  completed: '처리완료',
  cancelled: '주문취소',
  refunded:  '결제취소',
};

export const STATUS_COLORS = {
  preparing: '#64748B',
  pending:   '#F59E0B',
  paid:      '#10B981',
  completed: '#6366F1',
  cancelled: '#EF4444',
  refunded:  '#F43F5E',
};

// 매출에 포함되는 상태 (취소/환불 제외). preparing(준비중)은 미완료라 포함하지 않는다.
export const REVENUE_STATUSES = ['pending', 'paid', 'completed'];

// 목록·모달에서 허용하는 상태 전이 (단일 소스).
// completed(처리완료)는 출고관리 전용 — 목록에서 노출 금지. pending 회귀도 금지.
// preparing(준비중) → pending 전환은 "고객 제출 + 상품 저장"으로 자동 발생하므로 수동
//   전이 대상이 아니다. 담당자가 수동으로 할 수 있는 건 잘못 만든 준비중 주문의 취소뿐.
export const ALLOWED_TRANSITIONS = {
  preparing: ['cancelled'],
  pending:   ['paid', 'cancelled'],
  paid:      ['refunded'],
  completed: [],
  cancelled: [],
  refunded:  [],
};
