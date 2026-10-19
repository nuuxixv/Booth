-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — close_event / reopen_event RPC (학회 종료·재개)
-- File: 20261019000600_DRAFT_close_reopen_event_rpc.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §4(학회 종료 처리), §6, §7
--
-- [하는 일]
--   close_event(p_event_id):
--     · 완성되지 못한 "준비중(preparing)" 주문의 order_items 를 먼저 지우고 orders 삭제
--     · events.closed_at = now()  (고객 주문서 링크·PIN 흐름이 닫힘)
--     · 결제대기(pending)·결제완료(paid)·처리완료(completed)·취소·환불은 보존
--     · 반환: { deleted_count } (삭제된 준비중 주문 수 — 확인창에 표시)
--   reopen_event(p_event_id):
--     · events.closed_at = NULL (링크 재개). 삭제된 주문은 복구하지 않음.
--     · 반환: { closed_at }  (재개 후 값 = null)
--
-- [권한 — 현장 마케팅·관리자 모두]
--   has_permission('events:edit')  (onsite 역할도 20260610000000 에서 보유).
--   "학회를 만든 사람(created_by)" 조건은 두지 않는다 — 누가 만든 학회든 현장에서
--   종료할 수 있어야 한다(PRD §4·§7 확정). DELETE RLS 의 created_by 게이트와 달리
--   이 정의자 함수는 events:edit 만 본다.
--
-- [왜 삭제를 함수로 — order_items FK]
--   준비중 주문은 담당자가 담은 order_items 를 가질 수 있다. 자식 먼저(order_items)
--   지우고 부모(orders)를 지워야 FK 위반이 없다. 두 DELETE + events UPDATE 를
--   한 함수(암묵 트랜잭션)로 묶어 원자화한다.
--
-- [보안 모델]  SECURITY DEFINER + has_permission('events:edit') 강제.
--   anon 불가(REVOKE ALL FROM PUBLIC, GRANT authenticated).
--
-- [적용 방법]  ※ 본 에이전트 적용 안 함. 건우님 승인 후 수동 실행.
--   Supabase 대시보드 → SQL Editor → 이 파일 "실행 SQL 시작~끝" 붙여넣기 → Run.
--   repo 원본: supabase/migrations/20261019000600_DRAFT_close_reopen_event_rpc.sql
-- [적용 순서]  000200(closed_at) 이후. (match_code 에도 느슨히 의존 — status 참조뿐.)
-- [멱등성]  CREATE OR REPLACE + REVOKE/GRANT. 재실행 안전. 스키마 변경 없음.
--   close_event 재호출: 이미 preparing 이 없으면 deleted_count=0, closed_at 만 갱신.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

-- ── 종료: 준비중 주문 삭제 + closed_at 기록 ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_event(p_event_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.has_permission('events:edit') THEN
    RAISE EXCEPTION '권한이 없습니다 (events:edit 필요).' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION '존재하지 않는 학회입니다.';
  END IF;

  -- 1) 준비중 주문의 품목 먼저 삭제(FK)
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT id FROM orders WHERE event_id = p_event_id AND status = 'preparing'
  );

  -- 2) 준비중 주문 삭제 — 삭제 건수 집계
  WITH del AS (
    DELETE FROM orders
    WHERE event_id = p_event_id AND status = 'preparing'
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM del;

  -- 3) 학회 종료 시각 기록(링크·PIN 흐름 닫힘)
  UPDATE events SET closed_at = now() WHERE id = p_event_id;

  RETURN json_build_object('deleted_count', v_deleted);
END;
$$;

-- ── 재개: closed_at 해제 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reopen_event(p_event_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission('events:edit') THEN
    RAISE EXCEPTION '권한이 없습니다 (events:edit 필요).' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION '존재하지 않는 학회입니다.';
  END IF;

  -- 링크 재개. close_event 로 삭제된 준비중 주문은 복구하지 않는다(PRD §4).
  UPDATE events SET closed_at = NULL WHERE id = p_event_id;

  RETURN json_build_object('closed_at', NULL);
END;
$$;

-- events:edit 보유자(관리자·현장 마케팅)만. anon 불가.
REVOKE ALL ON FUNCTION public.close_event(bigint)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_event(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_event(bigint)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_event(bigint) TO authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행(테스트 학회로만. 운영 금지).
-- ----------------------------------------------------------------------------
-- 준비: 테스트 학회에 준비중 주문 2건(상품 포함 1건) + 결제대기 1건을 만들어 둔다.
--
-- (a) 종료 → 준비중만 삭제, 나머지 보존, closed_at 기록:
-- SELECT public.close_event(<event_id>);
--   기대: {"deleted_count": 2}  (준비중 2건 삭제; 품목도 함께 사라짐).
-- SELECT status, count(*) FROM orders WHERE event_id=<event_id> GROUP BY status;
--   기대: 'preparing' 0건, 'pending'(결제대기) 등은 그대로.
-- SELECT closed_at FROM events WHERE id=<event_id>;   -- 기대: now() 근처 타임스탬프.
--
-- (b) 종료 후 PIN 흐름 차단 확인:
-- SELECT public.get_helper_order_by_code(<event_id>, '<삭제전PIN>');  -- 기대: NULL.
--
-- (c) 재개:
-- SELECT public.reopen_event(<event_id>);             -- 기대: {"closed_at": null}.
-- SELECT closed_at FROM events WHERE id=<event_id>;    -- 기대: NULL.
--   (삭제된 준비중 주문은 복구되지 않음 — 의도된 동작.)
--
-- (d) 권한: 비로그인(anon) 또는 events:edit 없는 세션 호출 → "권한이 없습니다".
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.close_event(bigint);
-- DROP FUNCTION IF EXISTS public.reopen_event(bigint);
--   (주의: 함수를 지워도 이미 삭제된 준비중 주문/기록된 closed_at 은 되돌아오지 않음.)
-- ============================================================================
