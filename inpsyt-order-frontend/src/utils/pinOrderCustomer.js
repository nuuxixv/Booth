// 현장 도움(PIN) 주문 — 고객 트랙 순수 로직. supabase 미import(테스트 격리).
// (어드민 트랙 순수 함수는 utils/pinOrder.js 참조 — 별도 파일로 분리.)

// PIN 생성 단계에서 제외되는 명시 번호 ∪ 연도(2024~2027) — 서버 _helper_pin_forbidden과 동일.
const FORBIDDEN_PINS = new Set(['1000', '1001', '1234', '2024', '2025', '2026', '2027']);

// 서버 `_helper_pin_forbidden`(20261019000300_DRAFT_create_helper_order_rpc.sql)과 같은 규칙:
// 명시 제외·연도, 네 자리 반복, 연속 오름(+1), 연속 내림(-1). 입력은 4자리 숫자 전제.
const isForbiddenPin = (code) => {
  if (FORBIDDEN_PINS.has(code)) return true;
  const d = code.split('').map(Number);
  const allSame = d[0] === d[1] && d[1] === d[2] && d[2] === d[3];
  const ascending = d[1] === d[0] + 1 && d[2] === d[1] + 1 && d[3] === d[2] + 1;
  const descending = d[1] === d[0] - 1 && d[2] === d[1] - 1 && d[3] === d[2] - 1;
  return allSame || ascending || descending;
};

// PIN 조회를 시도할 "후보"인지 — 정확히 4자리 숫자이면서 PIN이 될 수 "있는" 번호일 때만 true.
// 상품명에 섞인 숫자·3자리·5자리·비숫자는 물론, PIN 생성 단계에서 제외되는 번호
// (2026·1234·0000·9876 등)도 false → 조회·안내 없이 일반 검색만 타게 한다(회귀 0, 사양 §72).
// 살아 있는 PIN인지(제출 여부·학회)는 서버(get_helper_order_by_code)가 최종 판정한다.
export const isPinCandidate = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  return !isForbiddenPin(trimmed);
};

// submit_helper_order RPC 인자 빌더(순수). create-order 호출부와 동일하게 배송지는
// { postcode, address, detail } 모양. customerInfo 키: name/phone/inpsytId/address/
// detailAddress/postcode/request.
export const buildHelperSubmitParams = ({ eventId, code, customerInfo }) => ({
  p_event_id: eventId,
  p_code: code,
  p_customer_name: customerInfo.name,
  p_phone: customerInfo.phone,
  p_shipping_address: {
    postcode: customerInfo.postcode,
    address: customerInfo.address,
    detail: customerInfo.detailAddress,
  },
  p_inpsyt_id: customerInfo.inpsytId,
  p_customer_request: customerInfo.request,
});
