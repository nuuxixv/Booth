import { describe, it, expect } from 'vitest';
import { fulfillmentCounts } from './fulfillmentCounts';

describe('fulfillmentCounts', () => {
  it('단독 paid/completed — 출고 대상에 모두, 완료는 completed만', () => {
    const r = fulfillmentCounts([
      { id: 1, status: 'paid' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'paid' },
    ]);
    expect(r).toEqual({ total: 3, completed: 1, pending: 2 });
  });

  it('현장수령(completed) 포함 — 처리 완료로 집계', () => {
    const r = fulfillmentCounts([
      { id: 1, status: 'completed' }, // 현장수령도 completed
      { id: 2, status: 'completed' },
    ]);
    expect(r).toEqual({ total: 2, completed: 2, pending: 0 });
  });

  it('cancelled·refunded 단독 주문은 모집단에서 제외', () => {
    const r = fulfillmentCounts([
      { id: 1, status: 'paid' },
      { id: 2, status: 'cancelled' },
      { id: 3, status: 'refunded' },
    ]);
    expect(r).toEqual({ total: 1, completed: 0, pending: 1 });
  });

  it('합배송 껍데기는 1건 — 자식(parent_order_id)은 세지 않음', () => {
    const r = fulfillmentCounts([
      // 껍데기(활성 자식 모두 completed → 종합 completed)
      { id: 100, is_group_parent: true, linkedChildren: [
        { id: 101, status: 'completed' },
        { id: 102, status: 'completed' },
      ] },
      // 자식들(플랫 목록에 함께 들어와도 parent_order_id로 제외)
      { id: 101, parent_order_id: 100, status: 'completed' },
      { id: 102, parent_order_id: 100, status: 'completed' },
      // 단독 1건
      { id: 200, status: 'paid' },
    ]);
    expect(r).toEqual({ total: 2, completed: 1, pending: 1 });
  });

  it('합배송 껍데기 상태 = 활성 자식 종합(가장 뒤처진 단계) — 일부만 완료면 출고 대기', () => {
    const r = fulfillmentCounts([
      { id: 100, is_group_parent: true, linkedChildren: [
        { id: 101, status: 'completed' },
        { id: 102, status: 'paid' },
      ] },
    ]);
    // 종합 상태 = paid(laggard) → pending 1건
    expect(r).toEqual({ total: 1, completed: 0, pending: 1 });
  });

  it('합배송 껍데기의 활성 자식이 전부 취소면 모집단에서 제외', () => {
    const r = fulfillmentCounts([
      { id: 100, is_group_parent: true, linkedChildren: [
        { id: 101, status: 'cancelled' },
        { id: 102, status: 'refunded' },
      ] },
      { id: 200, status: 'completed' },
    ]);
    expect(r).toEqual({ total: 1, completed: 1, pending: 0 });
  });

  it('빈 목록 — 0건', () => {
    expect(fulfillmentCounts([])).toEqual({ total: 0, completed: 0, pending: 0 });
  });
});
