// 이벤트 결제수단(바우처) 설정 — site_settings.voucher_config 정규화·표시 유틸.
// 사양: design-system/specs/A13_VoucherEvent.md §공용 유틸.
//  - 바우처는 결제수단(할인 아님). 주문 매출(final_payment)은 그대로, 카드 결제액 = final_payment - voucher_amount.
//  - 설정이 NULL·깨진 값이어도 기본값으로 동작(graceful) — 컬럼 미적용 환경 포함.

export const DEFAULT_VOUCHER_CONFIG = Object.freeze({
  label: '바우처',
  digits: [1, 2, 3, 4, 5],
  units: [
    { label: '만', value: 10000 },
    { label: '천', value: 1000 },
    { label: '백', value: 100 },
  ],
});

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

/**
 * 저장값 → 화면에서 쓰는 설정. 잘못된 항목은 걸러내고, 비면 기본값.
 * @param {object|null} raw site_settings.voucher_config
 * @returns {{ label: string, digits: number[], units: Array<{label: string, value: number}> }}
 */
export function normalizeVoucherConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};

  const label = typeof src.label === 'string' && src.label.trim()
    ? src.label.trim()
    : DEFAULT_VOUCHER_CONFIG.label;

  const digits = Array.isArray(src.digits)
    ? [...new Set(src.digits.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 99))]
      .sort((a, b) => a - b)
    : [];

  const units = Array.isArray(src.units)
    ? src.units
      .map((u) => ({ label: typeof u?.label === 'string' ? u.label.trim() : '', value: Number(u?.value) }))
      .filter((u) => u.label && isPositiveInt(u.value))
    : [];

  return {
    label,
    digits: digits.length ? digits : [...DEFAULT_VOUCHER_CONFIG.digits],
    units: units.length ? units : DEFAULT_VOUCHER_CONFIG.units.map((u) => ({ ...u })),
  };
}

// 숫자 × 단위 한 건의 금액·표시. 예: (3, {label:'천', value:1000}) → { amount: 3000, text: '3천원' }
export function formatVoucherEntry(digit, unit) {
  return { amount: digit * unit.value, text: `${digit}${unit.label}원` };
}

// 목적격 조사 "을/를" — 마지막 글자 받침 유무. 한글이 아니면 "를".
export function withObjectParticle(word) {
  const w = (word || '').trim();
  const code = w.charCodeAt(w.length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return `${w}를`;
  return (code - 0xac00) % 28 === 0 ? `${w}를` : `${w}을`;
}

// 카드 결제액(파생) — 저장하지 않는다.
export const cardAmountOf = (order) => (order?.final_payment || 0) - (order?.voucher_amount || 0);
