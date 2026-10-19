import { describe, it, expect } from 'vitest';
import { isPinCandidate, buildHelperSubmitParams } from './pinOrderCustomer';

describe('isPinCandidate — PIN 4자리 판정 + 일반 검색 회귀', () => {
  it('정확히 4자리 숫자(생성 가능 번호)는 true', () => {
    expect(isPinCandidate('0427')).toBe(true);
    expect(isPinCandidate('5083')).toBe(true);
    expect(isPinCandidate('0428')).toBe(true);
  });

  it('앞뒤 공백은 trim 후 판정', () => {
    expect(isPinCandidate(' 0427 ')).toBe(true);
  });

  it('4자리가 아니면 false(3자리·5자리)', () => {
    expect(isPinCandidate('123')).toBe(false);
    expect(isPinCandidate('12345')).toBe(false);
  });

  it('상품명에 섞인 숫자·일반 검색어는 false(회귀 0)', () => {
    expect(isPinCandidate('20')).toBe(false);
    expect(isPinCandidate('K-WISC')).toBe(false);
    expect(isPinCandidate('강박장애')).toBe(false);
    expect(isPinCandidate('012a')).toBe(false);
    expect(isPinCandidate('04 27')).toBe(false);
  });

  it('빈 값·null·undefined는 false', () => {
    expect(isPinCandidate('')).toBe(false);
    expect(isPinCandidate(null)).toBe(false);
    expect(isPinCandidate(undefined)).toBe(false);
  });
});

describe('isPinCandidate — PIN이 될 수 없는 번호는 일반 검색(서버 _helper_pin_forbidden 미러)', () => {
  it('금지 번호(연도·명시제외·반복·연속)는 false', () => {
    expect(isPinCandidate('2026')).toBe(false); // 연도(명시 제외)
    expect(isPinCandidate('2024')).toBe(false); // 연도
    expect(isPinCandidate('2027')).toBe(false); // 연도
    expect(isPinCandidate('1000')).toBe(false); // 명시 제외(상품명 숫자)
    expect(isPinCandidate('1001')).toBe(false); // 명시 제외
    expect(isPinCandidate('1234')).toBe(false); // 명시 제외 + 연속 오름
    expect(isPinCandidate('0000')).toBe(false); // 네 자리 반복
    expect(isPinCandidate('7777')).toBe(false); // 네 자리 반복
    expect(isPinCandidate('0123')).toBe(false); // 연속 오름
    expect(isPinCandidate('6789')).toBe(false); // 연속 오름
    expect(isPinCandidate('9876')).toBe(false); // 연속 내림
    expect(isPinCandidate('3210')).toBe(false); // 연속 내림
  });

  it('생성 가능한 번호는 true', () => {
    expect(isPinCandidate('0427')).toBe(true);
    expect(isPinCandidate('5083')).toBe(true);
    expect(isPinCandidate('1357')).toBe(true); // 오름 아님(+2 간격)
    expect(isPinCandidate('0124')).toBe(true); // 마지막 자리만 어긋남
  });
});

describe('buildHelperSubmitParams — 제출 payload 모양', () => {
  const customerInfo = {
    name: '이수진',
    phone: '010-2345-6789',
    inpsytId: 'sujin_lee',
    address: '서울특별시 중구 명동길 26',
    detailAddress: '인싸이트빌딩 5층',
    postcode: '04536',
    request: '빠른 배송 부탁드려요',
  };

  it('RPC 인자 키·값을 정확히 매핑', () => {
    const params = buildHelperSubmitParams({ eventId: 42, code: '0427', customerInfo });
    expect(params).toEqual({
      p_event_id: 42,
      p_code: '0427',
      p_customer_name: '이수진',
      p_phone: '010-2345-6789',
      p_shipping_address: {
        postcode: '04536',
        address: '서울특별시 중구 명동길 26',
        detail: '인싸이트빌딩 5층',
      },
      p_inpsyt_id: 'sujin_lee',
      p_customer_request: '빠른 배송 부탁드려요',
    });
  });

  it('배송지는 create-order와 동일한 { postcode, address, detail } 3필드 분리', () => {
    const { p_shipping_address } = buildHelperSubmitParams({ eventId: 1, code: '1111', customerInfo });
    expect(Object.keys(p_shipping_address).sort()).toEqual(['address', 'detail', 'postcode']);
    // detailAddress → detail 로 이름이 바뀌어 담긴다(통합 금지, 키만 매핑).
    expect(p_shipping_address.detail).toBe('인싸이트빌딩 5층');
  });
});
