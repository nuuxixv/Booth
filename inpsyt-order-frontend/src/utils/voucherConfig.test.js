import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VOUCHER_CONFIG,
  normalizeVoucherConfig,
  formatVoucherEntry,
  withObjectParticle,
  cardAmountOf,
} from './voucherConfig';

describe('normalizeVoucherConfig', () => {
  it('NULL·비객체 → 기본값', () => {
    expect(normalizeVoucherConfig(null)).toEqual(DEFAULT_VOUCHER_CONFIG);
    expect(normalizeVoucherConfig(undefined)).toEqual(DEFAULT_VOUCHER_CONFIG);
    expect(normalizeVoucherConfig('x')).toEqual(DEFAULT_VOUCHER_CONFIG);
  });

  it('label 공백·빈값 → "바우처"', () => {
    expect(normalizeVoucherConfig({ label: '   ' }).label).toBe('바우처');
    expect(normalizeVoucherConfig({ label: '' }).label).toBe('바우처');
    expect(normalizeVoucherConfig({ label: '쿠폰' }).label).toBe('쿠폰');
    expect(normalizeVoucherConfig({ label: '  상품권 ' }).label).toBe('상품권');
  });

  it('digits — 1~99 정수만·중복 제거·오름차순, 비면 기본값', () => {
    expect(normalizeVoucherConfig({ digits: [3, 1, 1, 2] }).digits).toEqual([1, 2, 3]);
    // 0·100·음수·소수·비숫자 제거
    expect(normalizeVoucherConfig({ digits: [0, 100, -1, 2.5, 'a', 5] }).digits).toEqual([5]);
    // 전부 걸러지면 기본값
    expect(normalizeVoucherConfig({ digits: [0, 100] }).digits).toEqual(DEFAULT_VOUCHER_CONFIG.digits);
    expect(normalizeVoucherConfig({ digits: [] }).digits).toEqual(DEFAULT_VOUCHER_CONFIG.digits);
    expect(normalizeVoucherConfig({ digits: 'nope' }).digits).toEqual(DEFAULT_VOUCHER_CONFIG.digits);
  });

  it('units — label 비지 않고 value 양의 정수만, 비면 기본값', () => {
    expect(normalizeVoucherConfig({ units: [{ label: '만', value: 10000 }] }).units)
      .toEqual([{ label: '만', value: 10000 }]);
    // 잘못된 항목 제거(빈 label·0·음수·소수)
    expect(normalizeVoucherConfig({
      units: [{ label: '', value: 100 }, { label: '천', value: 0 }, { label: '백', value: 100 }, { label: '엑스', value: 1.5 }],
    }).units).toEqual([{ label: '백', value: 100 }]);
    // 문자열 숫자도 Number로 수용
    expect(normalizeVoucherConfig({ units: [{ label: '천', value: '1000' }] }).units)
      .toEqual([{ label: '천', value: 1000 }]);
    // 전부 걸러지면 기본값
    expect(normalizeVoucherConfig({ units: [] }).units).toEqual(DEFAULT_VOUCHER_CONFIG.units);
  });

  it('shippingWaiverEnabled — true일 때만 켜짐, 기본 꺼짐', () => {
    expect(normalizeVoucherConfig(null).shippingWaiverEnabled).toBe(false);
    expect(normalizeVoucherConfig({ shippingWaiverEnabled: true }).shippingWaiverEnabled).toBe(true);
    expect(normalizeVoucherConfig({ shippingWaiverEnabled: 'true' }).shippingWaiverEnabled).toBe(false);
  });

  it('숫자 버튼은 최대 5개(오름차순 앞 5개)', () => {
    expect(normalizeVoucherConfig({ digits: [7, 1, 2, 3, 4, 5, 6] }).digits).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('formatVoucherEntry', () => {
  it('숫자 × 단위 → 금액·표시', () => {
    expect(formatVoucherEntry(3, { label: '천', value: 1000 })).toEqual({ amount: 3000, text: '3천원' });
    expect(formatVoucherEntry(1, { label: '만', value: 10000 })).toEqual({ amount: 10000, text: '1만원' });
    expect(formatVoucherEntry(5, { label: '백', value: 100 })).toEqual({ amount: 500, text: '5백원' });
  });
});

describe('withObjectParticle', () => {
  it('받침 있으면 "을", 없으면 "를"', () => {
    expect(withObjectParticle('바우처')).toBe('바우처를');
    expect(withObjectParticle('쿠폰')).toBe('쿠폰을');
    expect(withObjectParticle('상품권')).toBe('상품권을');
  });
  it('한글 외 문자로 끝나면 "를"', () => {
    expect(withObjectParticle('ABC')).toBe('ABC를');
    expect(withObjectParticle('voucher')).toBe('voucher를');
  });
});

describe('cardAmountOf', () => {
  it('카드 결제액 = final_payment - voucher_amount', () => {
    expect(cardAmountOf({ final_payment: 90000, voucher_amount: 10000 })).toBe(80000);
  });
  it('voucher_amount 없으면 final_payment 그대로', () => {
    expect(cardAmountOf({ final_payment: 50000 })).toBe(50000);
  });
  it('null·빈 주문 방어(0)', () => {
    expect(cardAmountOf(null)).toBe(0);
    expect(cardAmountOf({})).toBe(0);
  });
});
