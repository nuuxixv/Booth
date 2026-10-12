
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import OrderDetailModal from './OrderDetailModal';
import theme from '../theme';
import { NotificationContext } from '../NotificationContext';
import { supabase } from '../supabaseClient';

// supabase 클라이언트 모킹(가짜로 만들기)
// Supabase query builder는 thenable — 모든 체인 메서드가 .then()을 가져야 함
vi.mock('../supabaseClient', () => {
  const resolved = Promise.resolve({ data: null, error: null });
  const chain = Object.assign(resolved, {
    select: vi.fn(),
    single: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
  });
  // 모든 체인 메서드가 동일한 thenable chain을 반환
  chain.select.mockReturnValue(chain);
  chain.single.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue(chain),
    },
  };
});

const addNotification = vi.fn();

// 테스트를 위한 가짜(mock) 데이터
const mockOrder = {
  id: 1,
  created_at: new Date().toISOString(),
  customer_name: '홍길동',
  phone_number: '010-1234-5678',
  shipping_address: {
    address: '서울시 강남구',
    postcode: '12345',
    detail: '테스트 빌딩 101호',
  },
  status: 'paid',
  event_id: 101,
  order_items: [{ product_id: 1, quantity: 2 }],
  admin_memo: '테스트 메모',
  customer_request: '배송 전 연락주세요',
  final_payment: 45000,
};

const mockEvents = [
  { id: 101, name: '테스트 학회 A', discount_rate: 0.1 },
  { id: 102, name: '테스트 학회 B', discount_rate: 0.2 },
];

const mockProducts = [
  { id: 1, name: '테스트 상품 1', list_price: 25000, is_discountable: true },
  { id: 2, name: '테스트 상품 2', list_price: 30000, is_discountable: true },
];

const mockProductsMap = {
  1: { id: 1, name: '테스트 상품 1', list_price: 25000, is_discountable: true },
  2: { id: 2, name: '테스트 상품 2', list_price: 30000, is_discountable: true },
};

// 컴포넌트를 렌더링하는 헬퍼 함수
const renderModal = (order, overrides = {}) => {
  return render(
    <ThemeProvider theme={theme}>
    <MemoryRouter>
    <NotificationContext.Provider value={{ addNotification }}>
      <OrderDetailModal
        open={true}
        onClose={vi.fn()}
        order={order}
        statusToKorean={{ paid: '결제완료', pending: '입금대기' }}
        productsMap={mockProductsMap}
        products={mockProducts}
        events={mockEvents}
        addNotification={addNotification}
        onUpdate={vi.fn()}
        productsLoading={false}
        hasPermission={vi.fn().mockReturnValue(true)}
        {...overrides}
      />
    </NotificationContext.Provider>
    </MemoryRouter>
    </ThemeProvider>
  );
};

// 섹션별 인라인 편집(사양 A2) — 편집 버튼은 섹션마다 하나씩 있으므로 섹션 제목 기준으로 찾는다.
// 제목에서 위로 올라가 '편집' 버튼을 처음 포함하는 조상(= 그 섹션 헤더)에서 버튼을 꺼낸다.
// 섹션 카드들은 한 컨테이너의 형제라, 헤더를 지나치면 버튼이 여럿이 되어 queryByRole이 즉시 throw한다(오매칭 방지).
const getSectionEditButton = (sectionTitle) => {
  let el = screen.getByText(sectionTitle);
  while (el && !within(el).queryByRole('button', { name: '편집' })) el = el.parentElement;
  return within(el).getByRole('button', { name: '편집' });
};

describe('OrderDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[REGRESSION] 편집 모드 배송비는 정가(할인 전) 기준으로 계산되어야 한다', async () => {
    // 시나리오: 정가 32,000원 (threshold 30,000원 초과), 할인율 10%
    //   할인가: 28,800원 → threshold 미달
    //   Bug: 28,800 < 30,000 → 배송비 3,000원, 최종 31,800원 (틀림)
    //   Fix: 32,000 >= 30,000 → 배송비 0원, 최종 28,800원 (맞음)
    // (site_settings.free_shipping_basis 미설정 = 기본 정가 기준)
    const highValueOrder = {
      ...mockOrder,
      event_id: 101, // discount_rate: 0.1
      order_items: [{ product_id: 3, quantity: 1 }],
    };
    // is_discountable: true — 할인 공식(getDiscountedUnit)이 할인 대상 상품에만 행사율을 적용한다.
    const highValueProduct = { id: 3, name: '고가 상품', list_price: 32000, is_discountable: true };

    renderModal(highValueOrder, {
      productsMap: { ...mockProductsMap, 3: highValueProduct },
      products: [...mockProducts, highValueProduct],
    });

    // 금액 재계산은 '주문 상품 목록' 섹션 편집 중에만 일어난다.
    fireEvent.click(getSectionEditButton('주문 상품 목록'));

    // 정가(32,000) >= threshold(30,000) → 배송비 0원, 최종결제 28,800원
    await waitFor(() => {
      expect(screen.getByText('총 결제 금액').parentElement).toHaveTextContent('28,800원');
    });
    // 배송비가 3,000원으로 잘못 계산되면 최종금액이 31,800원이 됨 (버그 증거)
    expect(screen.queryByText('31,800원')).not.toBeInTheDocument();
  });

  it('주문 데이터가 주어졌을 때, 초기 정보를 올바르게 렌더링해야 한다', () => {
    renderModal(mockOrder);

    // 주문 기본 정보 확인
    expect(screen.getByText('상품주문정보 조회')).toBeInTheDocument();
    expect(screen.getByText(mockOrder.id)).toBeInTheDocument();
    expect(screen.getByText('테스트 학회 A')).toBeInTheDocument();

    // 주문자 정보 확인
    expect(screen.getByText(mockOrder.customer_name)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.phone_number)).toBeInTheDocument();

    // 배송지 정보 확인
    expect(screen.getByText(mockOrder.shipping_address.postcode)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.shipping_address.address)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.shipping_address.detail)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.customer_request)).toBeInTheDocument();

    // 관리자 메모 확인
    expect(screen.getByText(mockOrder.admin_memo)).toBeInTheDocument();

    // 주문 상품 목록 확인
    expect(screen.getByText('테스트 상품 1')).toBeInTheDocument();
    expect(screen.getByText('25,000원')).toBeInTheDocument(); // 정가
    expect(screen.getByText('2')).toBeInTheDocument(); // 수량
  });

  it('주문자 정보 섹션을 편집 후 저장하면, orders 부분 UPDATE가 변경값으로 호출되어야 한다', async () => {
    renderModal(mockOrder);

    // 1. '주문자 정보' 섹션의 편집 버튼으로 그 섹션만 편집 상태로 전환
    fireEvent.click(getSectionEditButton('주문자 정보'));

    // 2. '주문자명' 입력 필드의 값을 '김민준'으로 변경
    const customerNameInput = screen.getByDisplayValue('홍길동');
    fireEvent.change(customerNameInput, { target: { value: '김민준' } });

    // 3. 섹션의 '저장' 버튼 클릭
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    // 4. orders 테이블 부분 UPDATE가 변경값·주문 id로 호출되었는지 확인
    //    (모든 from() 호출은 같은 thenable chain을 반환한다 — 상단 모킹 참조)
    const chain = supabase.from.mock.results[0].value;
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ customer_name: '김민준' })
      );
      expect(chain.eq).toHaveBeenCalledWith('id', mockOrder.id);
    });
    // 섹션별 편집 재설계(2026-07-07) 이후 update_order_details RPC는 쓰지 않는다.
    expect(supabase.rpc).not.toHaveBeenCalled();

    // 5. 성공 알림이 표시되는지 확인
    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith('주문자 정보가 저장되었습니다.', 'success');
    });
  });
});
