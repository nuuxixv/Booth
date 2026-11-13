import { getDiscountedUnit } from './pricing';

/**
 * save_order_items RPC에 넘길 p_items 배열을 조립한다.
 * 금액·스냅샷 공식은 pricing.js(getDiscountedUnit)가 정본이며 서버는 다시 계산하지 않는다.
 * order_id는 넣지 않는다 — 서버가 p_order_id로 채운다(RPC 계약).
 * @param {Array<{product_id:number, quantity:number, on_site_pickup?:boolean}>} editedItems
 * @param {Object<number, object>} productsMap
 * @param {number} discountRate
 * @returns {Array<object>}
 */
export const buildSaveOrderItemsPayload = (editedItems, productsMap, discountRate) =>
  (editedItems || []).map((item) => {
    const product = productsMap[item.product_id];
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: getDiscountedUnit(product, discountRate),
      product_name: product?.name || null,
      product_code: product?.product_code || null,
      category: product?.category || null,
      list_price: product?.list_price || null,
      on_site_pickup: item.on_site_pickup ?? false,
    };
  });
