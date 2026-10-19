import { describe, it, expect } from 'vitest';
import { isPreparingOrder, shouldPromoteToPending, closeEventConfirm, pinEventStatusKey, pickDefaultPinEvent } from './pinOrder';
import { selectableOrderIds } from './groupOrder';

describe('isPreparingOrder', () => {
  it('preparing 이면 true', () => {
    expect(isPreparingOrder({ status: 'preparing' })).toBe(true);
  });
  it('다른 상태·null 은 false', () => {
    expect(isPreparingOrder({ status: 'pending' })).toBe(false);
    expect(isPreparingOrder(null)).toBe(false);
    expect(isPreparingOrder(undefined)).toBe(false);
  });
});

describe('shouldPromoteToPending — 결제대기 자동 승격 판정', () => {
  it('preparing + 상품 1개+ + 고객명 있으면 승격', () => {
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 1, customerName: '홍길동' })).toBe(true);
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 3, customerName: '정' })).toBe(true);
  });
  it('상품이 0개면 승격 안 함(상품 없이 제출한 준비중 유지)', () => {
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 0, customerName: '홍길동' })).toBe(false);
  });
  it('고객명이 비었거나 공백뿐이면 승격 안 함', () => {
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 2, customerName: '' })).toBe(false);
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 2, customerName: '   ' })).toBe(false);
    expect(shouldPromoteToPending({ status: 'preparing', itemCount: 2, customerName: null })).toBe(false);
  });
  it('이미 preparing 이 아니면(이미 결제대기 등) 승격 대상 아님', () => {
    expect(shouldPromoteToPending({ status: 'pending', itemCount: 2, customerName: '홍길동' })).toBe(false);
    expect(shouldPromoteToPending({ status: 'paid', itemCount: 2, customerName: '홍길동' })).toBe(false);
  });
});

describe('일괄 선택 제외 — selectableOrderIds 가 preparing 을 뺀다', () => {
  it('준비중은 전체 선택·헤더 체크박스 대상에서 제외', () => {
    const orders = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'preparing' },
      { id: 3, status: 'paid' },
    ];
    expect(selectableOrderIds(orders)).toEqual([1, 3]);
  });
});

describe('pinEventStatusKey — 학회 상태 뱃지 키', () => {
  const T = '2026-10-19';
  it('closed_at 있으면 ended', () => {
    expect(pinEventStatusKey({ start_date: '2026-10-18', end_date: '2026-10-20', closed_at: '2026-10-19T00:00:00Z' }, T)).toBe('ended');
  });
  it('today < start → upcoming', () => {
    expect(pinEventStatusKey({ start_date: '2026-10-25', end_date: '2026-10-27' }, T)).toBe('upcoming');
  });
  it('start ≤ today ≤ end → ongoing', () => {
    expect(pinEventStatusKey({ start_date: '2026-10-18', end_date: '2026-10-20' }, T)).toBe('ongoing');
  });
  it('today > end → ended', () => {
    expect(pinEventStatusKey({ start_date: '2026-10-10', end_date: '2026-10-12' }, T)).toBe('ended');
  });
  it('날짜 미정 → unknown', () => {
    expect(pinEventStatusKey({ start_date: null, end_date: null }, T)).toBe('unknown');
  });
});

describe('pickDefaultPinEvent — 기본 선택 학회', () => {
  const T = '2026-10-19';
  it('진행 중 학회를 고른다(가나다/이름순 영향 없음)', () => {
    const events = [
      { id: 1, name: '가나다학회', start_date: '2026-01-01', end_date: '2026-01-03' }, // 종료
      { id: 2, name: '하하학회', start_date: '2026-10-18', end_date: '2026-10-20' },   // 진행 중
    ];
    expect(pickDefaultPinEvent(events, T)).toBe(2);
  });
  it('진행 중이 여러 개면 start_date 최신', () => {
    const events = [
      { id: 1, start_date: '2026-10-15', end_date: '2026-10-21' },
      { id: 2, start_date: '2026-10-18', end_date: '2026-10-20' },
    ];
    expect(pickDefaultPinEvent(events, T)).toBe(2);
  });
  it('진행 중 없으면 오늘 이전 시작 중 가장 최근', () => {
    const events = [
      { id: 1, start_date: '2026-09-01', end_date: '2026-09-03' },
      { id: 2, start_date: '2026-10-10', end_date: '2026-10-12' },
      { id: 3, start_date: '2026-12-01', end_date: '2026-12-03' }, // 미래
    ];
    expect(pickDefaultPinEvent(events, T)).toBe(2);
  });
  it('모두 미래면 가장 임박한(start 최소) 학회', () => {
    const events = [
      { id: 1, start_date: '2026-12-01', end_date: '2026-12-03' },
      { id: 2, start_date: '2026-11-05', end_date: '2026-11-07' },
    ];
    expect(pickDefaultPinEvent(events, T)).toBe(2);
  });
  it('closed_at 학회는 기본 선택에서 제외', () => {
    const events = [
      { id: 1, start_date: '2026-10-18', end_date: '2026-10-20', closed_at: '2026-10-19T00:00:00Z' }, // 진행 기간이지만 종료 처리됨
      { id: 2, start_date: '2026-10-05', end_date: '2026-10-07' }, // 종료됐지만 열려 있음
    ];
    expect(pickDefaultPinEvent(events, T)).toBe(2);
  });
  it('후보 없으면 null, 빈 배열도 null', () => {
    expect(pickDefaultPinEvent([], T)).toBe(null);
  });
});

describe('closeEventConfirm — 종료 2단계 확인 문구', () => {
  it('삭제 건수를 2단계 본문에 반영한다', () => {
    const c = closeEventConfirm(3);
    expect(c.deletedCount).toBe(3);
    expect(c.step2Body).toContain('3건');
    expect(c.step2Body).toContain('되돌릴 수 없습니다');
    expect(c.step1Title).toBe('학회를 종료할까요?');
    expect(c.step2Title).toBe('정말 종료할까요?');
  });
  it('기본값 0건', () => {
    expect(closeEventConfirm().deletedCount).toBe(0);
    expect(closeEventConfirm().step2Body).toContain('0건');
  });
});
