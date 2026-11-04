// 이벤트 적용 결제완료 처리의 순수 로직 — 금액 계산·입력 누적·검증·payload 생성.
// 사양: design-system/specs/A13_VoucherEvent.md §④·§테스트 기준.
//  - 바우처는 결제수단(할인 아님): final_payment는 바우처로 줄지 않는다.
//  - 배송비 면제는 실제 할인: delivery_fee를 0으로, final_payment를 그만큼 줄인다.
//  - base* 입력값은 "배송비 면제 적용 전"(주문 원래 금액) 기준이다.

import { formatVoucherEntry } from './voucherConfig';

// 숫자+단위 한 건 추가. 숫자 미선택(null/0)이면 1×단위(사양 §④).
export function appendVoucherEntry(entries, digit, unit) {
  const d = digit && digit > 0 ? digit : 1;
  return [...entries, formatVoucherEntry(d, unit)];
}

export function removeVoucherEntry(entries, index) {
  return entries.filter((_, i) => i !== index);
}

export function voucherTotal(entries) {
  return (entries || []).reduce((sum, e) => sum + (e.amount || 0), 0);
}

/**
 * 금액 요약. subtotalAfterDiscount = total_cost - discount_amount(배송비 제외),
 * fullDeliveryFee = 면제하지 않았을 때의 배송비.
 * @returns {{ orderAmount, waived, payableBeforeVoucher, cardAmount }}
 */
export function voucherAmounts({ subtotalAfterDiscount, fullDeliveryFee, shippingWaived, voucherSum }) {
  const orderAmount = subtotalAfterDiscount + fullDeliveryFee;
  const waived = shippingWaived ? fullDeliveryFee : 0;
  const payableBeforeVoucher = orderAmount - waived;
  const cardAmount = payableBeforeVoucher - voucherSum;
  return { orderAmount, waived, payableBeforeVoucher, cardAmount };
}

// 바우처 합계가 결제할 금액(배송비 면제 반영 후)을 넘지 않아야 확정 가능. 같으면 허용(카드 0원).
export function isVoucherWithinLimit({ payableBeforeVoucher, voucherSum }) {
  return voucherSum <= payableBeforeVoucher;
}

/**
 * 확정 update의 금액 4필드(status는 호출부에서 동봉). 면제 시 delivery_fee 0·final_payment 감소.
 * @returns {{ voucher_amount, shipping_waived, delivery_fee, final_payment }}
 */
export function buildVoucherPayload({ subtotalAfterDiscount, fullDeliveryFee, shippingWaived, voucherSum }) {
  const deliveryFee = shippingWaived ? 0 : fullDeliveryFee;
  return {
    voucher_amount: voucherSum,
    shipping_waived: Boolean(shippingWaived),
    delivery_fee: deliveryFee,
    final_payment: subtotalAfterDiscount + deliveryFee,
  };
}
