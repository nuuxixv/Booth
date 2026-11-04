import { describe, it, expect } from 'vitest';
import {
  appendVoucherEntry,
  removeVoucherEntry,
  voucherTotal,
  voucherAmounts,
  isVoucherWithinLimit,
  buildVoucherPayload,
} from './voucherPayment';

const 천 = { label: '천', value: 1000 };
const 백 = { label: '백', value: 100 };

describe('바우처 입력 누적', () => {
  it('숫자 3 + 천 → 3,000원 한 건', () => {
    const entries = appendVoucherEntry([], 3, 천);
    expect(entries).toEqual([{ amount: 3000, text: '3천원' }]);
    expect(voucherTotal(entries)).toBe(3000);
  });

  it('숫자 없이 단위만(백) → 1×단위 = 100원', () => {
    const entries = appendVoucherEntry([], null, 백);
    expect(entries).toEqual([{ amount: 100, text: '1백원' }]);
  });

  it('같은 금액 반복 누적 + 개별 삭제', () => {
    let entries = appendVoucherEntry([], 3, 천);
    entries = appendVoucherEntry(entries, 3, 천);
    expect(voucherTotal(entries)).toBe(6000);
    entries = removeVoucherEntry(entries, 0);
    expect(voucherTotal(entries)).toBe(3000);
    expect(entries).toHaveLength(1);
  });
});

describe('voucherAmounts', () => {
  it('면제 켜짐 — 주문금액/면제/카드 계산', () => {
    const r = voucherAmounts({ subtotalAfterDiscount: 50000, fullDeliveryFee: 3000, shippingWaived: true, voucherSum: 10000 });
    expect(r).toEqual({ orderAmount: 53000, waived: 3000, payableBeforeVoucher: 50000, cardAmount: 40000 });
  });

  it('면제 꺼짐 — 배송비 포함 금액 기준', () => {
    const r = voucherAmounts({ subtotalAfterDiscount: 50000, fullDeliveryFee: 3000, shippingWaived: false, voucherSum: 10000 });
    expect(r).toEqual({ orderAmount: 53000, waived: 0, payableBeforeVoucher: 53000, cardAmount: 43000 });
  });
});

describe('isVoucherWithinLimit', () => {
  it('바우처 합계 > 결제할 금액이면 확정 불가', () => {
    expect(isVoucherWithinLimit({ payableBeforeVoucher: 50000, voucherSum: 50001 })).toBe(false);
  });
  it('같으면 가능(카드 0원)', () => {
    expect(isVoucherWithinLimit({ payableBeforeVoucher: 50000, voucherSum: 50000 })).toBe(true);
  });
});

describe('buildVoucherPayload', () => {
  it('면제 시 delivery_fee 0·final_payment 감소', () => {
    const p = buildVoucherPayload({ subtotalAfterDiscount: 50000, fullDeliveryFee: 3000, shippingWaived: true, voucherSum: 10000 });
    expect(p).toEqual({ voucher_amount: 10000, shipping_waived: true, delivery_fee: 0, final_payment: 50000 });
  });

  it('미면제 시 배송비·최종결제 그대로(바우처는 final_payment 불변)', () => {
    const p = buildVoucherPayload({ subtotalAfterDiscount: 50000, fullDeliveryFee: 3000, shippingWaived: false, voucherSum: 10000 });
    expect(p).toEqual({ voucher_amount: 10000, shipping_waived: false, delivery_fee: 3000, final_payment: 53000 });
  });
});
