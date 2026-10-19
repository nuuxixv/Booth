// usePinLookup — PIN 진입 opt-in·4자리 조회·늦은 응답 무시·일반 검색 회귀.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { getHelperOrderByCodeMock } = vi.hoisted(() => ({ getHelperOrderByCodeMock: vi.fn() }));
vi.mock('../api/helperOrder', () => ({ getHelperOrderByCode: getHelperOrderByCodeMock }));

import { usePinLookup } from './usePinLookup';

beforeEach(() => {
  getHelperOrderByCodeMock.mockReset();
});

describe('opt-in 게이트 (회귀 0)', () => {
  it('enablePinEntry=false면 조회하지 않고 null', () => {
    const { result } = renderHook(() => usePinLookup(false, 1, '0427'));
    expect(getHelperOrderByCodeMock).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('eventId 없으면 조회하지 않음', () => {
    renderHook(() => usePinLookup(true, null, '0427'));
    expect(getHelperOrderByCodeMock).not.toHaveBeenCalled();
  });

  it('4자리 숫자가 아니면 조회하지 않음(일반 검색어)', () => {
    renderHook(() => usePinLookup(true, 1, '20'));
    renderHook(() => usePinLookup(true, 1, 'K-WISC'));
    renderHook(() => usePinLookup(true, 1, '202'));
    expect(getHelperOrderByCodeMock).not.toHaveBeenCalled();
  });
});

describe('PIN 조회 결과', () => {
  it('살아 있는 PIN → confirmed + data', async () => {
    const data = { has_items: true, order_items: [{ product_name: '강박장애', quantity: 1, price_at_purchase: 22950 }], final_payment: 22950, delivery_fee: 0 };
    getHelperOrderByCodeMock.mockResolvedValue(data);
    const { result } = renderHook(() => usePinLookup(true, 7, '0427'));
    await waitFor(() => expect(result.current?.status).toBe('confirmed'));
    expect(getHelperOrderByCodeMock).toHaveBeenCalledWith(7, '0427');
    expect(result.current.code).toBe('0427');
    expect(result.current.data).toEqual(data);
  });

  it('없는 PIN(null) → invalid + data null', async () => {
    getHelperOrderByCodeMock.mockResolvedValue(null);
    const { result } = renderHook(() => usePinLookup(true, 7, '0428'));
    await waitFor(() => expect(result.current?.status).toBe('invalid'));
    expect(result.current.data).toBeNull();
  });

  it('조회 실패(throw)도 중립 invalid로 매핑', async () => {
    getHelperOrderByCodeMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePinLookup(true, 7, '5083'));
    await waitFor(() => expect(result.current?.status).toBe('invalid'));
  });
});

describe('늦은 응답 무시', () => {
  it('이전(0001) 응답이 새(0002) 응답보다 늦게 와도 새 결과가 유지된다', async () => {
    const deferreds = {};
    getHelperOrderByCodeMock.mockImplementation((_eventId, code) =>
      new Promise((resolve) => { deferreds[code] = resolve; }));

    const { result, rerender } = renderHook(
      ({ code }) => usePinLookup(true, 1, code),
      { initialProps: { code: '0001' } },
    );
    // 0001 조회 진행 중 — 사용자가 빠르게 0002로 바꿈
    rerender({ code: '0002' });
    expect(getHelperOrderByCodeMock).toHaveBeenCalledWith(1, '0001');
    expect(getHelperOrderByCodeMock).toHaveBeenCalledWith(1, '0002');

    // 새(0002) 응답 먼저 도착 → invalid
    await act(async () => { deferreds['0002'](null); });
    await waitFor(() => expect(result.current?.code).toBe('0002'));
    expect(result.current.status).toBe('invalid');

    // 이전(0001) 응답이 뒤늦게 confirmed로 도착 → 무시되어야 함(화면이 뒤집히지 않음)
    await act(async () => { deferreds['0001']({ has_items: true }); });
    expect(result.current.code).toBe('0002');
    expect(result.current.status).toBe('invalid');
  });
});
