-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — get_helper_order_by_code RPC (상품·금액만 반환)
-- File: 20261019000400_DRAFT_get_helper_order_by_code_rpc.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §3(단계 1~2), §6(PIN 조회)
--
-- [하는 일]
--   고객(anon)이 상품 검색창에 입력한 4자리 PIN 으로, "그 학회의 살아있는 준비중
--   주문"의 담긴 상품·금액만 읽기 전용으로 돌려준다(확인 카드 + 담긴 상품 미리보기).
--   반환 JSON:
--     { has_items,
--       order_items:[{product_name, quantity, price_at_purchase, category, list_price}],
--       total_cost, discount_amount, delivery_fee, final_payment }
--
-- [⚠ 개인정보·식별자 미반환 — 보안 핵심]
--   customer_name / phone_number / shipping_address / inpsyt_id / customer_request /
--   access_token / order_id / match_code 를 절대 반환하지 않는다. 제출 전 단계라
--   주문엔 개인정보가 없지만, 설령 담당자가 먼저 담아도 "상품·금액"만 보이게 한다.
--   남이 PIN 을 잘못 입력해도 상품 목록만 보고 "내 주문 아님"을 알아챌 뿐,
--   타인 개인정보·주문 토큰은 역노출되지 않는다.
--
-- [조건]  event_id = p_event_id AND match_code = p_code AND status='preparing'
--         AND 학회 미종료(events.closed_at IS NULL). 하나라도 어긋나면 결과 없음(NULL).
--         → 없는/제출된/다른 학회의/종료 후 PIN 은 모두 NULL → 프론트가 "안내 번호
--           재확인" 으로 동일 처리.
--
-- [보안 모델]  STABLE + SECURITY DEFINER(orders/events RLS 우회해 anon 읽기 가능).
--   anon·authenticated 모두 EXECUTE. 변경 없음(순수 조회).
--   get_order_by_token 과 동일한 "정의자 함수 게이트" 패턴.
--
-- [적용 방법]  ※ 본 에이전트 적용 안 함. 건우님 승인 후 수동 실행.
--   Supabase 대시보드 → SQL Editor → 이 파일 "실행 SQL 시작~끝" 붙여넣기 → Run.
--   repo 원본: supabase/migrations/20261019000400_DRAFT_get_helper_order_by_code_rpc.sql
--
-- [적용 순서]  000100(match_code)·000200(closed_at) 이후. (000300 과는 독립.)
-- [멱등성]  CREATE OR REPLACE + GRANT. 재실행 안전. 스키마 변경 없음.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

CREATE OR REPLACE FUNCTION public.get_helper_order_by_code(
  p_event_id bigint,
  p_code     text
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT row_to_json(result)
  FROM (
    SELECT
      EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id) AS has_items,
      (
        SELECT coalesce(
          json_agg(
            json_build_object(
              'product_name',      oi.product_name,
              'quantity',          oi.quantity,
              'price_at_purchase', oi.price_at_purchase,
              'category',          oi.category,
              'list_price',        oi.list_price
            )
            ORDER BY oi.id
          ),
          '[]'::json
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS order_items,
      o.total_cost,
      o.discount_amount,
      o.delivery_fee,
      o.final_payment
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.event_id   = p_event_id
      AND o.match_code = p_code
      AND o.status     = 'preparing'
      AND e.closed_at IS NULL
  ) result;
$$;

-- 고객 흐름(anon) + 담당자(authenticated) 모두 조회 가능. 개인정보 미반환이라 anon 안전.
GRANT EXECUTE ON FUNCTION public.get_helper_order_by_code(bigint, text) TO anon, authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행(테스트 학회·PIN 으로).
-- ----------------------------------------------------------------------------
-- (a) 살아있는 PIN 조회 → 상품·금액만:
-- SELECT public.get_helper_order_by_code(<event_id>, '<살아있는PIN>');
--   기대: has_items/order_items/total_cost/discount_amount/delivery_fee/final_payment
--         키만 존재. customer_name·phone_number·access_token·order_id·match_code
--         키가 "없어야" 한다.
-- (b) 반환 키 집합 점검(정확히 6키):
-- SELECT jsonb_object_keys(public.get_helper_order_by_code(<event_id>,'<PIN>')::jsonb)
-- ORDER BY 1;
--   기대: delivery_fee, discount_amount, final_payment, has_items, order_items, total_cost.
-- (c) 없는/제출된/다른 학회/종료 후 PIN → NULL:
-- SELECT public.get_helper_order_by_code(<event_id>, '9999');            -- 없는 번호
-- SELECT public.get_helper_order_by_code(<다른_event_id>, '<타학회PIN>');-- 다른 학회
--   기대: NULL (결과 없음).
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.get_helper_order_by_code(bigint, text);
-- ============================================================================
