import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  REVENUE_STATUSES,
  STATUS_TO_KOREAN,
  STATUS_COLORS,
} from './orderStatus';

describe('ALLOWED_TRANSITIONS', () => {
  it('preparing(준비중)에서 주문취소만 허용 (결제대기 전환은 자동이라 수동 전이 아님)', () => {
    expect(ALLOWED_TRANSITIONS.preparing).toEqual(['cancelled']);
  });

  it('pending에서 결제완료·주문취소만 허용 (처리완료 회귀 금지)', () => {
    expect(ALLOWED_TRANSITIONS.pending).toEqual(['paid', 'cancelled']);
  });

  it('paid에서 결제취소만 허용 (목록에서 completed 전이 금지)', () => {
    expect(ALLOWED_TRANSITIONS.paid).toEqual(['refunded']);
  });

  it('종결 3종(completed·cancelled·refunded)은 전이 없음', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
    expect(ALLOWED_TRANSITIONS.refunded).toEqual([]);
  });
});

describe('preparing(준비중) 상태 매핑', () => {
  it('REVENUE_STATUSES에는 preparing이 포함되지 않는다 (미완료 = 매출 제외)', () => {
    expect(REVENUE_STATUSES).toEqual(['pending', 'paid', 'completed']);
    expect(REVENUE_STATUSES).not.toContain('preparing');
  });

  it('라벨은 준비중, 색은 #64748B', () => {
    expect(STATUS_TO_KOREAN.preparing).toBe('준비중');
    expect(STATUS_COLORS.preparing).toBe('#64748B');
  });
});
