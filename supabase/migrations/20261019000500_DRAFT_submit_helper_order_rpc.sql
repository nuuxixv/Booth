-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — submit_helper_order RPC (고객 제출: 단일 조건부 UPDATE)
-- File: 20261019000500_DRAFT_submit_helper_order_rpc.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §3(단계 3~4), §5, §6(고객 제출)
--
-- [하는 일]
--   고객(anon)이 PIN 흐름에서 배송지 정보만 입력해 제출한다. "학회·PIN 이 맞고 아직
--   준비중이며 학회가 안 끝났을 때만" 고객 칸을 기록하고 PIN 을 반납(match_code=NULL),
--   상품이 있으면 결제대기(pending), 없으면 준비중(preparing) 유지한다.
--   반환: { order_id, access_token, status, final_payment }
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ 이 함수는 "anon 이 실행하는 변경(mutation) 함수" 다 — 왜 이번엔 안전한가
-- ─────────────────────────────────────────────────────────────────────────────
--   선례: 20260604000000_revoke_anon_mutation_rpc_and_order_items.sql 에서 anon 의
--   변경 RPC(update_order_details / bulk_update_order_status)를 전부 회수했다. anon 이
--   "임의 주문 본문·상태를 변조" 할 수 있었기 때문이다. 그 교훈 위에서, 본 함수가
--   그 금지에 저촉되지 않는 이유(허용 범위가 좁아 안전)를 명시한다:
--
--     1) 대상 한정: WHERE 가 "해당 학회 · 그 PIN · status='preparing' · 학회 미종료"
--        1행으로 못박혀 있다. anon 은 order_id 를 지정할 수 없고, PIN 을 모르면 어떤
--        행도 건드리지 못한다(임의 주문 지정 불가 — 선례의 핵심 취약점이 닫힘).
--     2) 변경 칸 한정: 고객 칸(성함·연락처·배송지·인싸이트ID·요청) + match_code=NULL +
--        status(preparing→pending 또는 preparing 유지)만 쓴다. 금액·상품·학회·토큰은
--        건드리지 않는다. 상태도 'preparing' 에서 "앞으로"(결제대기)만 가며 임의 상태
--        지정 불가(값이 코드에 고정).
--     3) 개인정보 역노출 없음: 반환은 자기 주문의 order_id·access_token·status·
--        final_payment 뿐. 타인 정보를 읽거나 돌려주지 않는다. access_token 도 "방금
--        자기가 채운" 주문 1건의 것이다(자기 토큰 회수).
--     4) 1회성·되돌릴 수 없음: 제출 즉시 match_code=NULL 로 PIN 이 반납돼 같은 PIN 으로
--        재진입·재변조가 불가능하다. 동시 제출은 status='preparing' 가드로 1명만 성공.
--
--   결론: "임의 주문을 임의 값으로" 바꾸던 선례의 위험이 전부 닫혀 있고, 바꾸는 것은
--   "자기 PIN 1행의 고객 칸과 전진 상태" 뿐이라 anon EXECUTE 를 좁게 허용한다.
--
-- [방식 확정 — 건우님 승인 2026-10-19]
--   고객 제출은 이 SECURITY DEFINER RPC(submit_helper_order) 방식으로 확정됐다.
--   (위 "왜 안전한가" 4가지 근거로 anon 변경 함수의 좁은 허용을 승인.)
--   향후 Edge Function(service_role) 방식으로 옮길 필요가 생겨도 쉽게 이식할 수 있도록,
--   변경 본문을 아래 "핵심 UPDATE" 한 덩어리로 분리해 둔다. 그 경우 이 함수의 anon GRANT
--   를 회수하고 Edge Function 이 동일 WHERE·SET 으로 service_role 실행하면 된다.
--
-- [금액 재계산 안 함 — 사유]
--   금액(total_cost/discount_amount/delivery_fee/final_payment)은 담당자가 상품을 저장할
--   때 create-order 와 동일한 정본 공식으로 이미 기록된다(pricing.js SOURCE OF TRUTH).
--   고객 제출은 "배송지 칸"만 채우는 단계라 금액을 다시 계산할 입력도, 이유도 없다.
--   여기서 재계산하면 두 공식이 갈라질 위험만 커진다 → 저장된 금액을 그대로 둔다.
--
-- [연락처 정규화]  phone_number 는 기존 BEFORE UPDATE 트리거
--   (trg_normalize_order_phone_number, 20260720000000)가 숫자만 남기도록 강제한다.
--   본 함수는 p_phone 을 그대로 SET 하고 정규화는 트리거에 맡긴다(중복 구현 금지).
--
-- [보안 모델]  SECURITY DEFINER(orders RLS 우회 UPDATE). anon·authenticated EXECUTE.
-- [적용 방법]  ※ 본 에이전트 적용 안 함. 건우님 승인 후 수동 실행.
--   Supabase 대시보드 → SQL Editor → 이 파일 "실행 SQL 시작~끝" 붙여넣기 → Run.
--   repo 원본: supabase/migrations/20261019000500_DRAFT_submit_helper_order_rpc.sql
-- [적용 순서]  000100·000200 이후. (000300·000400 과 독립이나 번호순 권장.)
-- [멱등성]  CREATE OR REPLACE + GRANT. 재실행 안전. 스키마 변경 없음.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

CREATE OR REPLACE FUNCTION public.submit_helper_order(
  p_event_id         bigint,
  p_code             text,
  p_customer_name    text,
  p_phone            text,
  p_shipping_address jsonb,
  p_inpsyt_id        text,
  p_customer_request text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id      bigint;
  v_token         uuid;
  v_status        text;
  v_final_payment numeric;
BEGIN
  -- ── 핵심 UPDATE (Edge Function 이식 시 이 한 덩어리만 옮기면 됨) ──────────────
  --   원자적 단일 조건부 UPDATE:
  --     · WHERE = 학회·PIN·준비중·학회미종료 → 대상 1행 못박음 + 동시제출 1명만 성공
  --     · status = 상품 있으면 pending, 없으면 preparing 유지(상품 유무를 같은 행에서 판정)
  --     · match_code=NULL 로 PIN 반납
  --     · status_history 에 제출 시점 1건 append(결제대기 전환 감지/감사용)
  UPDATE orders AS o
  SET
    customer_name    = p_customer_name,
    phone_number     = p_phone,              -- BEFORE UPDATE 트리거가 숫자만 남김
    shipping_address = p_shipping_address,
    inpsyt_id        = p_inpsyt_id,
    customer_request = p_customer_request,
    match_code       = NULL,                 -- PIN 반납
    status           = CASE
                         WHEN EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
                         THEN 'pending' ELSE 'preparing'
                       END,
    status_history   = o.status_history || jsonb_build_array(
                         jsonb_build_object(
                           'status', CASE
                                       WHEN EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
                                       THEN 'pending' ELSE 'preparing'
                                     END,
                           'changed_at', now()
                         )
                       )
  WHERE o.event_id   = p_event_id
    AND o.match_code = p_code
    AND o.status     = 'preparing'
    AND EXISTS (SELECT 1 FROM events e WHERE e.id = o.event_id AND e.closed_at IS NULL)
  RETURNING o.id, o.access_token, o.status, o.final_payment
  INTO v_order_id, v_token, v_status, v_final_payment;
  -- ── 핵심 UPDATE 끝 ─────────────────────────────────────────────────────────

  -- 0행이면 조건 불일치(없는/제출된/다른 학회/종료 후 PIN) → 프론트가 "안내 번호
  -- 재확인" 으로 매핑할 수 있게 예외를 던진다(동일 제출 경합에서 진 쪽도 여기로).
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION '안내 번호를 다시 확인해 주세요.'
      USING ERRCODE = 'P0002';  -- no_data_found (프론트가 식별해 안내 문구로 매핑)
  END IF;

  RETURN json_build_object(
    'order_id',      v_order_id,
    'access_token',  v_token,
    'status',        v_status,
    'final_payment', v_final_payment
  );
END;
$$;

-- 고객 흐름(anon) + 담당자(authenticated) 모두 제출 가능(위 "왜 안전한가" 참조).
GRANT EXECUTE ON FUNCTION
  public.submit_helper_order(bigint, text, text, text, jsonb, text, text)
  TO anon, authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행(테스트 학회·PIN 으로만. 운영 금지).
-- ----------------------------------------------------------------------------
-- 준비: create_helper_order 로 테스트 학회에 준비중 주문 2건 생성(PIN 확보).
--   하나는 상품 1개 담고(→ 제출 시 pending), 하나는 상품 0개(→ 제출 시 preparing).
--
-- (a) 상품 있는 PIN 제출 → pending:
-- SELECT public.submit_helper_order(
--   <event_id>, '<상품있는PIN>', '홍길동', '010-1234-5678',
--   '{"postcode":"06236","road":"테헤란로 1","detail":"2층"}'::jsonb, 'hong01', '빠른배송');
--   기대: {"order_id":..,"access_token":"..","status":"pending","final_payment":..}
--         이후 같은 PIN 재제출 → 'P0002' 예외(이미 반납됨).
--         orders 에서 phone_number 가 '01012345678'(하이픈 제거)인지 확인(트리거).
--
-- (b) 상품 없는 PIN 제출 → preparing 유지:
-- SELECT public.submit_helper_order(
--   <event_id>, '<상품없는PIN>', '김영희', '01099998888',
--   '{"postcode":"","road":"","detail":""}'::jsonb, NULL, NULL);
--   기대: status='preparing'. 이후 담당자가 상품 저장 시 pending 으로 전환되어야 함.
--
-- (c) 없는/종료 PIN → 'P0002' 예외:
-- SELECT public.submit_helper_order(<event_id>,'9999','x','01000000000','{}'::jsonb,NULL,NULL);
--   기대: "안내 번호를 다시 확인해 주세요." (SQLSTATE P0002).
--
-- (d) 금액 불변 확인: 제출 전/후 orders 의 total_cost/discount_amount/delivery_fee/
--     final_payment 가 동일(담당자 저장값 그대로)한지 비교.
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS
--   public.submit_helper_order(bigint, text, text, text, jsonb, text, text);
-- ============================================================================
