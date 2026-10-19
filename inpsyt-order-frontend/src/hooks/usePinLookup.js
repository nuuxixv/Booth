import { useEffect, useRef, useState } from 'react';
import { getHelperOrderByCode } from '../api/helperOrder';
import { isPinCandidate } from '../utils/pinOrderCustomer';

// 상품 검색창 PIN 조회 — 디바운스된 검색어가 PIN 후보(정확히 4자리 숫자)이고 PIN 진입이
// 켜졌을 때만 get_helper_order_by_code를 호출한다. 판정은 상위(ProductSelectionStep)에서만
// 돌고 ProductSearchBar 내부는 손대지 않는다(검색 input 격리 규칙).
//
// 늦게 도착한 이전 응답은 reqId 가드로 버린다 — 빠르게 타이핑할 때 "0001" 응답이 "0002"
// 응답보다 늦게 와도 화면이 뒤집히지 않는다.
//
// 반환: null | { code, status: 'confirmed' | 'invalid', data }
export const usePinLookup = (enabled, eventId, code) => {
  const [result, setResult] = useState(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = String(code ?? '').trim();
    if (!enabled || !eventId || !isPinCandidate(trimmed)) {
      reqIdRef.current += 1; // 진행 중 응답 무효화
      setResult(null);
      return;
    }
    const reqId = ++reqIdRef.current;
    let active = true;
    // 새 코드 조회 시작 시 이전 결과를 지운다 — 바뀐 코드에 옛 확인 카드/안내가 남아
    // 사용자가 지난 PIN으로 이어가기를 누르는 일을 막는다(디바운스 후라 깜빡임은 거의 없음).
    setResult(null);
    getHelperOrderByCode(eventId, trimmed)
      .then((data) => {
        if (!active || reqId !== reqIdRef.current) return;
        setResult({ code: trimmed, status: data ? 'confirmed' : 'invalid', data: data || null });
      })
      .catch(() => {
        if (!active || reqId !== reqIdRef.current) return;
        // 조회 실패도 중립 안내로(오타일 수 있으니 빨강 아님). 일반 검색 결과는 아래에 그대로.
        setResult({ code: trimmed, status: 'invalid', data: null });
      });
    return () => { active = false; };
  }, [enabled, eventId, code]);

  return result;
};
