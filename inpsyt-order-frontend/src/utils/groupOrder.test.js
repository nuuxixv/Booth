import { describe, it, expect } from 'vitest';
import { classifyGroupStatusChange, selectableOrderIds, partitionBulkSelectable } from './groupOrder';

// 자식 3건 그룹: rep=1(대표), 2·3은 활성
const children = [
  { id: 1, status: 'paid' },
  { id: 2, status: 'paid' },
  { id: 3, status: 'pending' },
];
const repChildId = 1;

describe('classifyGroupStatusChange', () => {
  it('(a) 대표가 아니면 passthrough (취소여도)', () => {
    const child = children[1]; // id=2, 대표 아님
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'refunded' });
    expect(r.mode).toBe('passthrough');
  });

  it('(b) 취소/환불이 아니면 passthrough (대표여도)', () => {
    const child = children[0]; // id=1, 대표
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'paid' });
    expect(r.mode).toBe('passthrough');
  });

  it('(c) 대표 취소지만 남은 활성 형제 0건이면 passthrough', () => {
    const solo = [
      { id: 1, status: 'paid' },
      { id: 2, status: 'cancelled' },
      { id: 3, status: 'refunded' },
    ];
    const r = classifyGroupStatusChange({ children: solo, repChildId: 1, child: solo[0], newStatus: 'refunded' });
    expect(r.mode).toBe('passthrough');
  });

  it('(d) 대표 취소 + 남은 활성 형제 정확히 1건이면 auto (siblings=그 1건)', () => {
    const two = [
      { id: 1, status: 'paid' },
      { id: 2, status: 'paid' },
      { id: 3, status: 'cancelled' },
    ];
    const r = classifyGroupStatusChange({ children: two, repChildId: 1, child: two[0], newStatus: 'refunded' });
    expect(r.mode).toBe('auto');
    expect(r.siblings.map((s) => s.id)).toEqual([2]);
  });

  it('(e) 대표 취소 + 남은 활성 형제 2건+이면 pick (siblings=활성 형제 배열)', () => {
    const child = children[0]; // id=1, 대표, 남은 활성 2·3
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'cancelled' });
    expect(r.mode).toBe('pick');
    expect(r.siblings.map((s) => s.id)).toEqual([2, 3]);
  });

  it('활성 판정에서 자기 자신은 형제에서 제외', () => {
    const child = children[0];
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'cancelled' });
    expect(r.siblings.some((s) => s.id === child.id)).toBe(false);
  });
});

// 껍데기 부모(100) + 자식 101(대표)·102, 단독 200·201
const mixedOrders = [
  { id: 200 },
  { id: 100, is_group_parent: true, representative_child_id: 101 },
  { id: 101, parent_order_id: 100 },
  { id: 102, parent_order_id: 100 },
  { id: 201 },
];

describe('selectableOrderIds', () => {
  it('껍데기·자식(대표 포함)을 빼고 단독 주문만 반환', () => {
    expect(selectableOrderIds(mixedOrders)).toEqual([200, 201]);
  });

  it('전부 단독이면 전원 선택 가능', () => {
    expect(selectableOrderIds([{ id: 1 }, { id: 2 }])).toEqual([1, 2]);
  });

  it('빈 입력 방어', () => {
    expect(selectableOrderIds()).toEqual([]);
  });

  it('preparing(준비중) 주문은 일괄 선택에서 제외', () => {
    const orders = [
      { id: 300, status: 'pending' },
      { id: 301, status: 'preparing' }, // 현장 도움·미완료 → 제외
      { id: 302, status: 'paid' },
    ];
    expect(selectableOrderIds(orders)).toEqual([300, 302]);
  });
});

describe('partitionBulkSelectable (일괄 변경 최종 가드)', () => {
  it('독립 주문만 선택 → 전부 실행, 제외 없음', () => {
    const r = partitionBulkSelectable(mixedOrders, [200, 201]);
    expect(r.allowedIds).toEqual([200, 201]);
    expect(r.excludedIds).toEqual([]);
  });

  it('자식이 섞이면 그 자식만 제외', () => {
    const r = partitionBulkSelectable(mixedOrders, [200, 102]);
    expect(r.allowedIds).toEqual([200]);
    expect(r.excludedIds).toEqual([102]);
  });

  it('대표 자식이 섞여도 제외 (배송지 스테일 방지)', () => {
    const r = partitionBulkSelectable(mixedOrders, [201, 101]);
    expect(r.allowedIds).toEqual([201]);
    expect(r.excludedIds).toEqual([101]);
  });

  it('전부 그룹 소속(껍데기+대표+자식)이면 전부 제외 → 실행 대상 0', () => {
    const r = partitionBulkSelectable(mixedOrders, [100, 101, 102]);
    expect(r.allowedIds).toEqual([]);
    expect(r.excludedIds).toEqual([100, 101, 102]);
  });
});
