import { describe, it, expect } from 'vitest';
import { buildSaveOrderItemsPayload } from './orderItemsSave';

const productsMap = {
  1: { id: 1, name: '상품 1', product_code: 'A001', category: '도서', list_price: 25000, is_discountable: true },
  2: { id: 2, name: '상품 2', product_code: 'B002', category: '검사', list_price: 30000, is_discountable: false },
};

describe('buildSaveOrderItemsPayload — save_order_items RPC 인자 조립', () => {
  it('order_id를 넣지 않는다(서버가 p_order_id로 채우는 계약)', () => {
    const payload = buildSaveOrderItemsPayload([{ product_id: 1, quantity: 1 }], productsMap, 0);
    expect(payload[0]).not.toHaveProperty('order_id');
  });

  it('상품 스냅샷과 수량을 담는다', () => {
    const [row] = buildSaveOrderItemsPayload([{ product_id: 1, quantity: 2 }], productsMap, 0);
    expect(row).toMatchObject({
      product_id: 1,
      quantity: 2,
      product_name: '상품 1',
      product_code: 'A001',
      category: '도서',
      list_price: 25000,
    });
  });

  it('price_at_purchase는 pricing(getDiscountedUnit) 공식을 따른다 — 할인 대상만 행사율 적용', () => {
    const [discountable, nonDiscountable] = buildSaveOrderItemsPayload(
      [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 1 }],
      productsMap,
      0.1,
    );
    expect(discountable.price_at_purchase).toBe(22500); // round(25000 * 0.9)
    expect(nonDiscountable.price_at_purchase).toBe(30000); // is_discountable=false → 정가
  });

  it('on_site_pickup은 기본 false, 지정 시 보존', () => {
    const payload = buildSaveOrderItemsPayload(
      [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 1, on_site_pickup: true }],
      productsMap,
      0,
    );
    expect(payload[0].on_site_pickup).toBe(false);
    expect(payload[1].on_site_pickup).toBe(true);
  });

  it('빈·null 입력은 빈 배열', () => {
    expect(buildSaveOrderItemsPayload([], productsMap, 0)).toEqual([]);
    expect(buildSaveOrderItemsPayload(null, productsMap, 0)).toEqual([]);
  });
});
