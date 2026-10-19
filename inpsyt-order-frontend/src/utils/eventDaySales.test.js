import { describe, it, expect } from 'vitest';
import {
  getOrderPaidDateKST,
  getOrderDayNumber,
  dayDateLabel,
  totalDays,
  buildSalesBlock,
  replaceSalesBlock,
} from './eventDaySales';

const START = '2026-10-16';
const END = '2026-10-17';

const paid = (changedAt, items, delivery_fee = 0) => ({
  status: 'paid',
  delivery_fee,
  status_history: [{ status: 'pending', changed_at: '2026-10-01T00:00:00Z' }, { status: 'paid', changed_at: changedAt }],
  order_items: items,
});

describe('getOrderPaidDateKST', () => {
  it('UTC 15:00 직전은 같은 날(KST), 직후는 다음 날', () => {
    expect(getOrderPaidDateKST(paid('2026-10-16T14:59:00Z', []))).toBe('2026-10-16');
    expect(getOrderPaidDateKST(paid('2026-10-16T15:00:00Z', []))).toBe('2026-10-17');
  });
  it('status_history에 paid가 없으면 created_at 사용', () => {
    expect(getOrderPaidDateKST({ status: 'completed', created_at: '2026-10-16T20:00:00Z' })).toBe('2026-10-17');
  });
  it('시각 정보가 없으면 null', () => {
    expect(getOrderPaidDateKST({ status: 'paid' })).toBeNull();
  });
});

describe('getOrderDayNumber', () => {
  it('KST 경계로 1일차/2일차가 갈린다', () => {
    expect(getOrderDayNumber(paid('2026-10-16T14:59:00Z', []), START, END)).toBe(1);
    expect(getOrderDayNumber(paid('2026-10-16T15:00:00Z', []), START, END)).toBe(2);
  });
  it('시작 전 결제 → 1일차, 종료 후 결제 → 마지막 일차', () => {
    expect(getOrderDayNumber(paid('2026-10-01T00:00:00Z', []), START, END)).toBe(1);
    expect(getOrderDayNumber(paid('2026-10-25T00:00:00Z', []), START, END)).toBe(2);
  });
});

describe('totalDays / dayDateLabel', () => {
  it('기간 일수', () => {
    expect(totalDays(START, END)).toBe(2);
    expect(totalDays(START, START)).toBe(1);
    expect(totalDays(START, null)).toBe(1);
  });
  it('일차 날짜 라벨', () => {
    expect(dayDateLabel(START, 1)).toBe('10/16');
    expect(dayDateLabel(START, 2)).toBe('10/17');
  });
});

describe('buildSalesBlock', () => {
  const orders = [
    paid('2026-10-16T14:59:00Z', [{ category: '도서', price_at_purchase: 100000, quantity: 1 }], 3000), // 1일차 도서+배송
    paid('2026-10-16T15:00:00Z', [{ category: '검사', price_at_purchase: 50000, quantity: 1 }]), // 2일차 검사
    { status: 'completed', created_at: '2026-10-10T01:00:00Z', order_items: [{ category: '검사', price_at_purchase: 20000, quantity: 1 }] }, // 시작 전 → 1일차
    paid('2026-10-25T00:00:00Z', [{ category: '도서', price_at_purchase: 10000, quantity: 1 }]), // 종료 후 → 2일차
  ];

  it('1일차 = 누적만', () => {
    expect(buildSalesBlock({ orders, dayNumber: 1, startDate: START, endDate: END })).toBe(
      ['0. 판매', '검사 판매: 20,000원 (배송비 0원 포함)', '도서 판매: 103,000원 (배송비 3,000원 포함)', '합계: 123,000원'].join('\n'),
    );
  });

  it('2일차 = 누적 + 일차별, 배송비 0원은 일차별에서 생략', () => {
    expect(buildSalesBlock({ orders, dayNumber: 2, startDate: START, endDate: END })).toBe(
      [
        '0. 판매',
        '검사 판매: 70,000원 (배송비 0원 포함)',
        '도서 판매: 113,000원 (배송비 3,000원 포함)',
        '합계: 183,000원',
        '',
        '(1) 1일차 (10/16)',
        '검사 판매: 20,000원',
        '도서 판매: 103,000원 (배송비 3,000원 포함)',
        '합계: 123,000원',
        '',
        '(2) 2일차 (10/17)',
        '검사 판매: 50,000원',
        '도서 판매: 10,000원',
        '합계: 60,000원',
      ].join('\n'),
    );
  });

  it('도구 매출은 0원이 아닐 때만 줄 추가', () => {
    const withTool = [paid('2026-10-16T01:00:00Z', [{ category: '도구', price_at_purchase: 5000, quantity: 1 }])];
    const block = buildSalesBlock({ orders: withTool, dayNumber: 1, startDate: START, endDate: END });
    expect(block).toContain('도구 판매: 5,000원');
    expect(buildSalesBlock({ orders, dayNumber: 1, startDate: START, endDate: END })).not.toContain('도구 판매');
  });

  it('productsMap으로 빈 카테고리를 보강', () => {
    const o = [paid('2026-10-16T01:00:00Z', [{ product_id: 'p1', category: '', price_at_purchase: 30000, quantity: 1 }])];
    const block = buildSalesBlock({ orders: o, dayNumber: 1, startDate: START, endDate: END, productsMap: { p1: { category: '검사' } } });
    expect(block).toContain('검사 판매: 30,000원');
  });
});

describe('replaceSalesBlock', () => {
  const content = '머리말\n\n0. 판매\n검사 판매: 1원 (배송비 0원 포함)\n합계: 1원\n\n1. 도서 관련\n내용\n\n2. 검사 관련\n이상';

  it('"0. 판매" 블록만 교체하고 나머지 본문은 보존', () => {
    const next = replaceSalesBlock(content, '0. 판매\n합계: 9원');
    expect(next).toBe('머리말\n\n0. 판매\n합계: 9원\n\n1. 도서 관련\n내용\n\n2. 검사 관련\n이상');
  });

  it('"0. 판매" 블록이 없으면 null', () => {
    expect(replaceSalesBlock('제목\n\n1. 도서 관련\n내용', '0. 판매\n합계: 1원')).toBeNull();
  });

  it('번호 제목 없이 맺음말로 끝나는 보고서 — 맺음말 보존(2026 신경정신 추계 2일차 실사례)', () => {
    const real = '머리말\n\n0. 판매\n검사 판매: 76,500원 (배송비 0원 포함)\n도서 판매: 1,131,800원 (배송비 3,000원 포함)\n합계: 1,208,300원\n\n(1)2일차 판매\n검사 판매: 0원\n도서 판매: 240,550 (배송비 0원 포함)\n\n이상 현장 마케팅 마무리하겠습니다.';
    expect(replaceSalesBlock(real, '0. 판매\n합계: 9원')).toBe('머리말\n\n0. 판매\n합계: 9원\n\n이상 현장 마케팅 마무리하겠습니다.');
  });

  it('일차 소제목 "(2) 2일차 (10/17)"도 블록으로 보고 교체', () => {
    const c = '0. 판매\n합계: 1원\n\n(1) 1일차 (10/16)\n합계: 1원\n\n(2) 2일차 (10/17)\n합계: 0원\n\n1. 도서 관련';
    expect(replaceSalesBlock(c, '0. 판매\n합계: 2원')).toBe('0. 판매\n합계: 2원\n\n1. 도서 관련');
  });

  it('블록이 본문 끝까지면 끝까지 교체(뒤 빈 줄 보존)', () => {
    expect(replaceSalesBlock('0. 판매\n합계: 1원\n', '0. 판매\n합계: 2원')).toBe('0. 판매\n합계: 2원\n');
  });
});
