import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import theme from '../theme';
import ProductManagementPage from './ProductManagementPage';

// A6 §필터 바(2026-10-19) — 실 페이지를 API만 목으로 바꿔 렌더해 AND/OR·초기화·검사 그룹 뷰를 확인한다.

const PRODUCTS = [
  { id: 1, name: '도서A 할인인기', category: '도서', is_discountable: true, is_popular: true, is_new: false, includes_online_code: false, tags: ['임상'], image_filename: 'a.jpg', list_price: 1000 },
  { id: 2, name: '도서B 비할인', category: '도서', is_discountable: false, is_popular: false, is_new: true, includes_online_code: false, tags: ['한국심리학회'], list_price: 1000 },
  { id: 3, name: '검사C 코드', category: '검사', is_discountable: false, is_popular: false, is_new: false, includes_online_code: true, tags: ['오티즘'], test_group_id: 10, list_price: 1000 },
  { id: 4, name: '검사D 미확인', category: '검사', is_discountable: false, is_popular: true, is_new: false, includes_online_code: null, tags: [], list_price: 1000 },
  { id: 5, name: '도구E 비할인', category: '도구', is_discountable: false, is_popular: false, is_new: false, includes_online_code: false, tags: ['신간'], list_price: 1000 },
  { id: 6, name: '도구F 숨김', category: '도구', is_discountable: false, is_popular: false, is_new: false, is_active: false, includes_online_code: false, tags: [], list_price: 1000 },
];

vi.mock('../supabaseClient', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../api/products', () => ({ fetchAllProducts: vi.fn(async () => PRODUCTS) }));
vi.mock('../api/productImages', () => ({ getProductImageUrl: () => null, uploadProductImage: vi.fn() }));
vi.mock('../api/masters', () => ({
  fetchSubcategories: vi.fn(async () => []),
  createSubcategory: vi.fn(), updateSubcategory: vi.fn(), deleteSubcategory: vi.fn(),
  fetchMasterUsageCounts: vi.fn(async () => ({ subCounts: {} })),
}));
vi.mock('../api/testGroups', () => ({
  fetchTestGroups: vi.fn(async () => [{ id: 10, abbr: 'TG', name: '테스트검사군', is_active: true }]),
  fetchTestGroupOptionCounts: vi.fn(async () => ({ 10: 1 })),
  updateTestGroup: vi.fn(), deleteTestGroup: vi.fn(), mergeTestGroups: vi.fn(), makeTestGroupResolver: vi.fn(),
}));
vi.mock('../api/events', () => ({ getSocieties: vi.fn(async () => [{ name: '한국심리학회' }, { name: 'TEST' }]) }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' }, hasPermission: () => true }) }));
vi.mock('../hooks/useNotification', () => ({ useNotification: () => ({ addNotification: vi.fn() }) }));
vi.mock('./TestGroupEditorModal', () => ({ default: () => null }));
// 아이콘 배럴 스텁(muiIconsStub.cjs Proxy)은 명명 import를 열거하지 못해 undefined가 된다
// → 어떤 이름이든 더미 아이콘을 돌려주는 ESM 목으로 대체.
vi.mock('@mui/icons-material', async () => {
  const React = await import('react');
  const Icon = () => React.createElement('span');
  // 'then'·심볼은 제외(모듈이 thenable로 오인되면 import가 멈춘다).
  const isIconName = (k) => typeof k === 'string' && /^[A-Z]/.test(k);
  return new Proxy({ default: Icon }, {
    has: (t, k) => k in t || isIconName(k),
    get: (t, k) => (k in t ? t[k] : (isIconName(k) ? Icon : undefined)),
  });
});

const renderPage = async () => {
  render(<ThemeProvider theme={theme}><ProductManagementPage /></ThemeProvider>);
  await screen.findByText('도서A 할인인기');
};

const visibleNames = () => PRODUCTS.map((p) => p.name).filter((n) => screen.queryByText(n));
// 패싯 라벨 = 바로 뒤에 ToggleButtonGroup(role=group)이 붙은 캡션(표의 "온라인코드" 상태 칩과 구분).
const facetGroup = (label) => screen.getAllByText(label, { selector: 'span' })
  .find((el) => el.nextElementSibling?.getAttribute('role') === 'group').parentElement;
const clickFacet = (label, option) => fireEvent.click(within(facetGroup(label)).getByRole('button', { name: option }));

describe('ProductManagementPage 필터 바', () => {
  it('초기: 필터 초기화 disabled, 카테고리는 전체-검사-도서-도구(미확인 없음), 온라인코드 미확인은 끝', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: '필터 초기화' })).toBeDisabled();
    const catButtons = within(facetGroup('카테고리')).getAllByRole('button').map((b) => b.textContent);
    expect(catButtons).toEqual(['전체', '검사', '도서', '도구']);
    expect(within(facetGroup('카테고리')).getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    const onlineButtons = within(facetGroup('온라인코드')).getAllByRole('button').map((b) => b.textContent);
    expect(onlineButtons).toEqual(['전체', 'Y', 'N', '미확인']);
    expect(visibleNames()).toHaveLength(6);
  });

  it('속성 간 AND: 도서 + 할인 여부 N', async () => {
    await renderPage();
    clickFacet('카테고리', '도서');
    clickFacet('할인 여부', 'N');
    await waitFor(() => expect(visibleNames()).toEqual(['도서B 비할인']));
    expect(screen.getByText('개 표시 중', { exact: false })).toHaveTextContent('1개 표시 중');
    expect(screen.getByRole('button', { name: '필터 초기화' })).toBeEnabled();
  });

  it('카테고리 다중 선택(OR): 도서 + 도구, 전체를 누르면 해제', async () => {
    await renderPage();
    clickFacet('카테고리', '도서');
    clickFacet('카테고리', '도구');
    await waitFor(() => expect(visibleNames().sort()).toEqual(['도구E 비할인', '도구F 숨김', '도서A 할인인기', '도서B 비할인'].sort()));
    expect(within(facetGroup('카테고리')).getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false');
    clickFacet('카테고리', '전체');
    await waitFor(() => expect(visibleNames()).toHaveLength(6));
    expect(within(facetGroup('카테고리')).getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('판매상태(고객 주문서 노출) N = 숨김 상품만', async () => {
    await renderPage();
    clickFacet('판매상태', 'N');
    await waitFor(() => expect(visibleNames()).toEqual(['도구F 숨김']));
    clickFacet('판매상태', 'Y');
    await waitFor(() => expect(visibleNames()).toHaveLength(5));
  });

  it('온라인코드 미확인은 검사 한정이 아님', async () => {
    await renderPage();
    clickFacet('온라인코드', '미확인');
    await waitFor(() => expect(visibleNames()).toEqual(['검사D 미확인']));
  });

  it('태그 OR + 학회명이 앞쪽', async () => {
    await renderPage();
    const tagChips = ['TEST', '한국심리학회', '신간', '오티즘', '임상'];
    const order = tagChips.map((t) => screen.getByRole('button', { name: t }));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: '임상' }));
    fireEvent.click(screen.getByRole('button', { name: '신간' }));
    await waitFor(() => expect(visibleNames().sort()).toEqual(['도구E 비할인', '도서A 할인인기'].sort()));
  });

  it('필터 초기화: 모든 조건 해제', async () => {
    await renderPage();
    clickFacet('인기 상품', 'Y');
    clickFacet('이미지 등록', 'Y');
    await waitFor(() => expect(visibleNames()).toEqual(['도서A 할인인기']));
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }));
    await waitFor(() => expect(visibleNames()).toHaveLength(6));
    expect(screen.getByRole('button', { name: '필터 초기화' })).toBeDisabled();
    expect(within(facetGroup('인기 상품')).getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('검사 단독 선택 시에만 검사군 그룹 뷰 + 검사군 추가 버튼, 재클릭 시 전체로 해제', async () => {
    await renderPage();
    expect(screen.queryByRole('button', { name: '검사군 추가' })).toBeNull();
    clickFacet('카테고리', '검사');
    await screen.findByText('테스트검사군');
    expect(screen.getByText('미분류')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검사군 추가' })).toBeInTheDocument();
    // 다른 카테고리와 함께 고르면 평면 표
    clickFacet('카테고리', '도서');
    await waitFor(() => expect(screen.queryByText('테스트검사군')).toBeNull());
    expect(screen.queryByRole('button', { name: '검사군 추가' })).toBeNull();
    clickFacet('카테고리', '도서');
    await screen.findByText('테스트검사군');
    clickFacet('카테고리', '검사');
    await waitFor(() => expect(screen.queryByText('테스트검사군')).toBeNull());
    expect(visibleNames()).toHaveLength(6);
  });
});
