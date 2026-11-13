-- ============================================================================
-- [DRAFT] 주문 상품 저장 원자화 — save_order_items RPC
-- File: 20261113000000_DRAFT_save_order_items_rpc.sql
-- Date: 2026-11-13
-- Author: backend-engineer (CTO 위임 지시서)
--
-- [목적]
--   어드민 주문 상세의 "주문 상품 저장"은 지금 브라우저에서 네 번의 개별 요청으로
--   실행된다: order_items DELETE → INSERT → orders 금액 4필드 UPDATE →
--   (준비중 주문이면) 조건부 승격 UPDATE. 중간에 실패하면 상품이 없는 주문이나
--   금액이 어긋난 주문이 남는다. 이 네 단계를 한 함수(=한 트랜잭션)로 묶어
--   "전부 성공 아니면 전부 롤백"으로 만든다.
--   대체 대상: inpsyt-order-frontend/src/components/OrderSections.jsx handleSaveItems.
--
-- [왜 EXCEPTION 블록이 없나]
--   함수 안에 예외를 삼키는 EXCEPTION 블록을 두지 않는다. 함수 실행 중 어떤
--   단계라도 실패하면 호출 statement 전체가 자동 롤백되는 것이 원자성의 근거다.
--   예외는 그대로 호출자(프론트)에게 전파되어 메시지로 처리된다.
--
-- [보안 / RLS — 무영향]
--   SECURITY INVOKER. 호출자(로그인한 어드민, authenticated) 권한으로 실행되며
--   기존 RLS 정책이 그대로 적용된다(프론트가 지금 직접 DELETE/INSERT/UPDATE 하던
--   것과 동일한 권한 경로). RLS 정책을 추가·완화·삭제하지 않고 새 테이블도 만들지
--   않는다. anon 실행은 REVOKE 로 차단, authenticated 에만 EXECUTE 부여.
--
-- [의존 스키마 — 운영 확인 사실(2026-11-13)]
--   · order_items NOT NULL: order_id, quantity, price_at_purchase, on_site_pickup
--     → p_items 원소에 quantity/price 가 없으면 INSERT 가 NOT NULL 위반으로 실패하고
--       함수 전체가 롤백된다(의도된 동작).
--   · orders CHECK orders_voucher_amount_check, orders_customer_name_required 준수.
--   · 트리거(자동 동작, 이 함수는 직접 쓰지 않음):
--       order_items.trg_fill_order_item_snapshot — 스냅샷 4칸 중 NULL 인 칸을 products
--         에서 채움. 이 함수는 전달된 스냅샷 값을 그대로 INSERT 하고 비면 트리거가 채운다.
--       orders.trg_status_history — status 가 실제로 바뀔 때만(IS DISTINCT FROM) 이력 누적.
--         따라서 비승격(status 동일값 재기입)일 때는 이력이 오염되지 않는다.
--
-- [적용 방법]  ※ 본 에이전트는 적용하지 않음(작성만). 건우님 승인 후 수동 실행.
--   어디에: Supabase 대시보드 → SQL Editor → New query
--   무엇을: 아래 "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 붙여넣기.
--           (상단 주석은 붙여도 무방)
--   실행: Run(Ctrl+Enter) 1회. "Success. No rows returned" 이면 정상.
--   repo 원본: supabase/migrations/20261113000000_DRAFT_save_order_items_rpc.sql
--
--   ⚠ "실행 SQL"(함수 배포)과 "검증 SQL"(테스트)은 반드시 따로 실행한다.
--     검증 SQL 은 끝에서 일부러 RAISE EXCEPTION 을 던져(결과를 오류 메시지 칸에
--     표시하고 테스트 데이터를 자동 롤백하기 위함) statement 가 실패로 끝난다.
--     함수 DDL 과 한 번에 붙여 돌리면 이 의도된 예외가 함수 생성까지 되돌린다.
--     함수 배포를 먼저 Run → 성공 확인 후, 검증 SQL 블록만 따로 복사해 Run 한다.
--
-- [멱등성]  CREATE OR REPLACE FUNCTION + REVOKE/GRANT. 재실행 안전. 스키마 변경 없음.
--
-- [롤백 — 비상시에만, CTO 승인하에]
--   DROP FUNCTION IF EXISTS public.save_order_items(int, jsonb, jsonb);
--   (되돌리면 프론트는 다시 네 번의 개별 요청 경로로 저장한다. 원자성이 사라진다.)
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

CREATE OR REPLACE FUNCTION public.save_order_items(
  p_order_id int,
  p_items    jsonb,   -- [{product_id, quantity, price_at_purchase, product_name, product_code, category, list_price, on_site_pickup}]
  p_amounts  jsonb    -- {total_cost, discount_amount, delivery_fee, final_payment}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status        text;
  v_voucher       integer;
  v_is_parent     boolean;
  v_customer_name text;
  v_product_count int;
  v_promote       boolean;
  v_result        jsonb;
BEGIN
  -- 1) 대상 주문 행 잠금 + 판정에 필요한 현재 값 읽기.
  SELECT status, voucher_amount, is_group_parent, customer_name
    INTO v_status, v_voucher, v_is_parent, v_customer_name
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- 2) 껍데기 부모(합배송 그룹)의 상품은 각 개별 주문에서만 수정한다.
  --    프론트 itemsLocked 의 is_group_parent 분기와 동일. (나머지 분기는 아래 주석 참고)
  IF v_is_parent IS TRUE THEN
    RAISE EXCEPTION 'GROUP_PARENT_NOT_EDITABLE';
  END IF;

  -- 3) 페이로드 유효성: p_items 는 배열이어야 하고, 금액 4필드는 모두 존재해야 한다.
  IF p_items IS NULL
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR p_amounts IS NULL
     OR (p_amounts->>'total_cost')      IS NULL
     OR (p_amounts->>'discount_amount') IS NULL
     OR (p_amounts->>'delivery_fee')    IS NULL
     OR (p_amounts->>'final_payment')   IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  -- 4) 바우처 하한: 재계산된 결제금액이 이미 받은 바우처보다 작아지면 저장 거부.
  IF (p_amounts->>'final_payment')::numeric < COALESCE(v_voucher, 0) THEN
    RAISE EXCEPTION 'VOUCHER_EXCEEDS_PAYMENT';
  END IF;

  -- 5) 기존 상품 전량 삭제.
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  -- 6) 전달된 상품 재삽입. on_site_pickup 은 비면 false. 스냅샷 4칸은 전달값 그대로 넣고
  --    비어 있으면 trg_fill_order_item_snapshot 이 products 에서 채운다.
  INSERT INTO public.order_items (
    order_id, product_id, quantity, price_at_purchase,
    product_name, product_code, category, list_price, on_site_pickup
  )
  SELECT
    p_order_id,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric,
    item->>'product_name',
    item->>'product_code',
    item->>'category',
    (item->>'list_price')::numeric,
    COALESCE((item->>'on_site_pickup')::boolean, false)
  FROM jsonb_array_elements(p_items) AS item;

  -- 7) 준비중(PIN) → 결제대기 승격 판정.
  --    현재 상태 preparing + 고객명이 비어 있지 않음 + 방금 넣은 상품 중 product_id 가
  --    있는 행이 1개 이상.
  SELECT count(*) INTO v_product_count
    FROM public.order_items
   WHERE order_id = p_order_id
     AND product_id IS NOT NULL;

  v_promote :=
        v_status = 'preparing'
    AND v_customer_name IS NOT NULL
    AND v_customer_name <> ''
    AND v_product_count >= 1;

  -- 8) 금액 4필드 + (승격 시) 상태·PIN 반납을 한 번의 UPDATE 로 반영.
  --    status 는 승격일 때만 'pending' 으로 바뀌고, 아니면 동일값 재기입(트리거가
  --    변경 없음으로 보고 이력을 쌓지 않는다). status_history 는 트리거가 채운다.
  UPDATE public.orders
     SET total_cost      = (p_amounts->>'total_cost')::numeric,
         discount_amount = (p_amounts->>'discount_amount')::numeric,
         delivery_fee    = (p_amounts->>'delivery_fee')::numeric,
         final_payment   = (p_amounts->>'final_payment')::numeric,
         status     = CASE WHEN v_promote THEN 'pending' ELSE status END,
         match_code = CASE WHEN v_promote THEN NULL      ELSE match_code END
   WHERE id = p_order_id;

  -- 9) 갱신 후 행에서 반환값을 만든다(status·match_code 는 승격 반영 후 값).
  SELECT jsonb_build_object(
           'promoted',         v_promote,
           'status',           o.status,
           'match_code',       o.match_code,
           'customer_name',    o.customer_name,
           'phone_number',     o.phone_number,
           'inpsyt_id',        o.inpsyt_id,
           'shipping_address', o.shipping_address,
           'customer_request', o.customer_request
         )
    INTO v_result
    FROM public.orders o
   WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.save_order_items(int, jsonb, jsonb) IS
  '어드민 주문 상품 저장을 한 트랜잭션으로 원자화: order_items 교체 + orders 금액 4필드 '
  '+ 준비중 주문 승격(status=pending, match_code=NULL). SECURITY INVOKER, authenticated 전용. '
  '예외: ORDER_NOT_FOUND / GROUP_PARENT_NOT_EDITABLE / INVALID_PAYLOAD / VOUCHER_EXCEEDS_PAYMENT.';

-- anon/PUBLIC 실행 차단, 로그인 어드민(authenticated)만 허용.
REVOKE EXECUTE ON FUNCTION public.save_order_items(int, jsonb, jsonb) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.save_order_items(int, jsonb, jsonb) TO authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 SQL]  ※ 위 "실행 SQL"(함수 배포)이 성공한 뒤, 아래 DO 블록만 따로 복사해
--   SQL Editor 에서 Run 한다.
--
--   [결과 확인 방법]  이 DO 블록은 네 테스트 결과를 text 변수 하나에 줄 단위로 모은 뒤,
--     맨 끝에서 일부러 RAISE EXCEPTION 으로 그 결과를 던진다. 그래서:
--       (1) 결과(ALL PASS / FAIL 포함 + 네 줄)가 편집기 "오류 메시지" 칸에 반드시 보인다.
--           (NOTICE 는 편집기가 안 보여줄 수 있어 쓰지 않는다.)
--       (2) statement 가 실패로 끝나므로 이 블록이 만든 테스트 주문이 모두 자동 롤백된다.
--           → 운영 데이터에 흔적이 남지 않는다(BEGIN/ROLLBACK 을 따로 쓰지 않아도 됨).
--     오류 메시지 첫 줄에 "이 오류는 의도된 것"이라고 적혀 있으면 정상이다.
--
--   [세션 역할 전제]  SQL Editor 세션 역할(postgres 등)은 RLS 를 우회한다. 함수가
--     SECURITY INVOKER 라도 이 세션에선 RLS 없이 실행되므로 역할 차이로 검증이
--     실패하지 않는다. (실제 운영 호출은 authenticated 가 기존 어드민 RLS 로 수행.)
--   [테스트 데이터]  event_id·product_id 는 기존 행에서 LIMIT 1 로 가져온다. 손으로
--     채울 자리는 없다. 테스트 주문은 운영 제약을 만족하는 최소 컬럼으로 직접 만든다.
--   [PIN 충돌 회피]  승격 테스트의 match_code 는 '0000' 을 쓴다. 업무규칙상 실제로
--     발급되지 않는 번호라 같은 학회의 살아있는 PIN 과 충돌하지 않는다.
--   [각 테스트 격리]  테스트마다 BEGIN...EXCEPTION 으로 감싸 예상치 못한 예외가 나도
--     어느 테스트에서 났는지 결과 줄에 남는다.
-- ----------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   v_event_id   bigint;
--   v_pid1       bigint;
--   v_pid2       bigint;
--   o_id         bigint;
--   v_result     jsonb;
--   v_cnt        int;
--   v_tc         numeric;
--   v_fp         numeric;
--   v_cnt_before int;  v_tc_before numeric;
--   v_cnt_after  int;  v_tc_after  numeric;  v_fp_after numeric;
--   v_status_after text;  v_mc_after text;
--   v_raised     boolean;  v_errm text;
--   v_pass       boolean;
--   v_all_pass   boolean := true;
--   v_report     text := '';
-- BEGIN
--   SELECT id INTO v_event_id FROM public.events ORDER BY id LIMIT 1;
--   SELECT id INTO v_pid1     FROM public.products ORDER BY id LIMIT 1;
--   SELECT id INTO v_pid2     FROM public.products ORDER BY id OFFSET 1 LIMIT 1;
--   IF v_pid2 IS NULL THEN v_pid2 := v_pid1; END IF;
--   IF v_event_id IS NULL OR v_pid1 IS NULL THEN
--     RAISE EXCEPTION '검증 불가: events 또는 products 에 테스트로 쓸 행이 없습니다.';
--   END IF;
--
--   -- ───────── TEST 1: 정상 저장(상품 1개 있던 주문을 2개로 교체 + 금액 갱신) ─────────
--   BEGIN
--     INSERT INTO public.orders (event_id, customer_name, status, status_history,
--       total_cost, discount_amount, delivery_fee, final_payment, is_email_sent, is_group_parent, access_token)
--     VALUES (v_event_id, 'TEST 고객', 'pending',
--       jsonb_build_array(jsonb_build_object('status','pending','changed_at', now())),
--       0,0,0,0, false, false, gen_random_uuid()) RETURNING id INTO o_id;
--     INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, on_site_pickup)
--     VALUES (o_id, v_pid1, 9, 111, false);
--
--     v_result := public.save_order_items(o_id::int,
--       jsonb_build_array(
--         jsonb_build_object('product_id', v_pid1, 'quantity', 1, 'price_at_purchase', 50000, 'on_site_pickup', false),
--         jsonb_build_object('product_id', v_pid2, 'quantity', 2, 'price_at_purchase', 25000, 'on_site_pickup', false)),
--       jsonb_build_object('total_cost',100000,'discount_amount',10000,'delivery_fee',3000,'final_payment',93000));
--     SELECT count(*) INTO v_cnt FROM public.order_items WHERE order_id = o_id;
--     SELECT total_cost, final_payment INTO v_tc, v_fp FROM public.orders WHERE id = o_id;
--     v_pass := (v_cnt = 2 AND v_tc = 100000 AND v_fp = 93000);
--     v_report := v_report || '[TEST 1] 정상 저장: items=' || v_cnt || ' total_cost=' || v_tc || ' final_payment=' || v_fp
--              || ' (기대 2 / 100000 / 93000) => ' || CASE WHEN v_pass THEN 'PASS' ELSE 'FAIL' END || chr(10);
--     v_all_pass := v_all_pass AND v_pass;
--   EXCEPTION WHEN OTHERS THEN
--     v_report := v_report || '[TEST 1] 예상치 못한 예외: ' || SQLERRM || chr(10);
--     v_all_pass := false;
--   END;
--
--   -- ───────── TEST 2: 실패 시 전체 롤백(정상 저장 후 quantity NULL 원소로 재호출) ─────────
--   BEGIN
--     INSERT INTO public.orders (event_id, customer_name, status, status_history,
--       total_cost, discount_amount, delivery_fee, final_payment, is_email_sent, is_group_parent, access_token)
--     VALUES (v_event_id, 'TEST 고객', 'pending',
--       jsonb_build_array(jsonb_build_object('status','pending','changed_at', now())),
--       0,0,0,0, false, false, gen_random_uuid()) RETURNING id INTO o_id;
--     PERFORM public.save_order_items(o_id::int,
--       jsonb_build_array(
--         jsonb_build_object('product_id', v_pid1, 'quantity', 1, 'price_at_purchase', 50000, 'on_site_pickup', false),
--         jsonb_build_object('product_id', v_pid2, 'quantity', 2, 'price_at_purchase', 25000, 'on_site_pickup', false)),
--       jsonb_build_object('total_cost',100000,'discount_amount',10000,'delivery_fee',3000,'final_payment',93000));
--     SELECT count(*) INTO v_cnt_before FROM public.order_items WHERE order_id = o_id;
--     SELECT total_cost INTO v_tc_before FROM public.orders WHERE id = o_id;
--     v_errm := NULL;
--     BEGIN
--       PERFORM public.save_order_items(o_id::int,
--         jsonb_build_array(jsonb_build_object('product_id', v_pid1, 'quantity', NULL::int, 'price_at_purchase', 1000, 'on_site_pickup', false)),
--         jsonb_build_object('total_cost',999,'discount_amount',0,'delivery_fee',0,'final_payment',999));
--       v_raised := false;
--     EXCEPTION WHEN OTHERS THEN
--       v_raised := true;  v_errm := SQLERRM;
--     END;
--     SELECT count(*) INTO v_cnt_after FROM public.order_items WHERE order_id = o_id;
--     SELECT total_cost INTO v_tc_after FROM public.orders WHERE id = o_id;
--     v_pass := (v_raised AND v_cnt_after = v_cnt_before AND v_tc_after = v_tc_before);
--     v_report := v_report || '[TEST 2] 실패 롤백: raised=' || v_raised || ' (err=' || COALESCE(v_errm,'') || ') items '
--              || v_cnt_before || '->' || v_cnt_after || ' total_cost ' || v_tc_before || '->' || v_tc_after
--              || ' (기대 유지) => ' || CASE WHEN v_pass THEN 'PASS' ELSE 'FAIL' END || chr(10);
--     v_all_pass := v_all_pass AND v_pass;
--   EXCEPTION WHEN OTHERS THEN
--     v_report := v_report || '[TEST 2] 예상치 못한 예외: ' || SQLERRM || chr(10);
--     v_all_pass := false;
--   END;
--
--   -- ───────── TEST 3: 준비중 → 결제대기 승격 ─────────
--   BEGIN
--     INSERT INTO public.orders (event_id, customer_name, status, match_code, status_history,
--       total_cost, discount_amount, delivery_fee, final_payment, is_email_sent, is_group_parent, access_token)
--     VALUES (v_event_id, 'TEST 고객', 'preparing', '0000',
--       jsonb_build_array(jsonb_build_object('status','preparing','changed_at', now())),
--       0,0,0,0, false, false, gen_random_uuid()) RETURNING id INTO o_id;
--     v_result := public.save_order_items(o_id::int,
--       jsonb_build_array(jsonb_build_object('product_id', v_pid1, 'quantity', 1, 'price_at_purchase', 50000, 'on_site_pickup', false)),
--       jsonb_build_object('total_cost',50000,'discount_amount',0,'delivery_fee',3000,'final_payment',53000));
--     SELECT status, match_code INTO v_status_after, v_mc_after FROM public.orders WHERE id = o_id;
--     v_pass := ((v_result->>'promoted')::boolean AND v_status_after = 'pending' AND v_mc_after IS NULL);
--     v_report := v_report || '[TEST 3] 승격: promoted=' || (v_result->>'promoted') || ' status=' || v_status_after
--              || ' match_code=' || COALESCE(v_mc_after,'<NULL>') || ' (기대 true / pending / NULL) => '
--              || CASE WHEN v_pass THEN 'PASS' ELSE 'FAIL' END || chr(10);
--     v_all_pass := v_all_pass AND v_pass;
--   EXCEPTION WHEN OTHERS THEN
--     v_report := v_report || '[TEST 3] 예상치 못한 예외: ' || SQLERRM || chr(10);
--     v_all_pass := false;
--   END;
--
--   -- ───────── TEST 4: 바우처 하한 위반(final_payment < voucher_amount) ─────────
--   BEGIN
--     INSERT INTO public.orders (event_id, customer_name, status, status_history,
--       total_cost, discount_amount, delivery_fee, final_payment, voucher_amount, is_email_sent, is_group_parent, access_token)
--     VALUES (v_event_id, 'TEST 고객', 'pending',
--       jsonb_build_array(jsonb_build_object('status','pending','changed_at', now())),
--       50000,0,0,50000, 50000, false, false, gen_random_uuid()) RETURNING id INTO o_id;
--     INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, on_site_pickup)
--     VALUES (o_id, v_pid1, 1, 50000, false);
--     v_errm := NULL;
--     BEGIN
--       PERFORM public.save_order_items(o_id::int,
--         jsonb_build_array(jsonb_build_object('product_id', v_pid1, 'quantity', 1, 'price_at_purchase', 10000, 'on_site_pickup', false)),
--         jsonb_build_object('total_cost',10000,'discount_amount',0,'delivery_fee',0,'final_payment',10000));
--       v_raised := false;
--     EXCEPTION WHEN OTHERS THEN
--       v_raised := true;  v_errm := SQLERRM;
--     END;
--     SELECT count(*) INTO v_cnt_after FROM public.order_items WHERE order_id = o_id;
--     SELECT final_payment INTO v_fp_after FROM public.orders WHERE id = o_id;
--     v_pass := (v_raised AND v_errm LIKE '%VOUCHER_EXCEEDS_PAYMENT%' AND v_cnt_after = 1 AND v_fp_after = 50000);
--     v_report := v_report || '[TEST 4] 바우처: raised=' || v_raised || ' (err=' || COALESCE(v_errm,'') || ') items=' || v_cnt_after
--              || ' final_payment=' || v_fp_after || ' (기대 1 / 50000) => ' || CASE WHEN v_pass THEN 'PASS' ELSE 'FAIL' END || chr(10);
--     v_all_pass := v_all_pass AND v_pass;
--   EXCEPTION WHEN OTHERS THEN
--     v_report := v_report || '[TEST 4] 예상치 못한 예외: ' || SQLERRM || chr(10);
--     v_all_pass := false;
--   END;
--
--   -- 결과를 오류 메시지 칸에 강제로 표시 + 모든 테스트 데이터 자동 롤백(의도된 예외).
--   v_report := chr(10)
--     || '===== save_order_items 검증 결과 =====' || chr(10)
--     || '이 오류는 의도된 것입니다. 테스트 데이터는 모두 자동으로 되돌려졌습니다(저장되지 않음).' || chr(10)
--     || '전체 판정: ' || CASE WHEN v_all_pass THEN 'ALL PASS' ELSE 'FAIL 포함' END || chr(10)
--     || '-------------------------------------' || chr(10)
--     || v_report;
--   RAISE EXCEPTION '%', v_report;
-- END;
-- $$;
-- ============================================================================
