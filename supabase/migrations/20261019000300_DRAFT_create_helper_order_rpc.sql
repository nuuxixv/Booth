-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — create_helper_order RPC + PIN 금지규칙 헬퍼
-- File: 20261019000300_DRAFT_create_helper_order_rpc.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §4, §6(PIN 생성 규칙), §7
--
-- [하는 일]
--   담당자(authenticated, orders:edit)가 진행 중 학회에 "준비중" 주문 1건을 만들고
--   4자리 PIN(match_code)을 발급받는다. 상품 0개로도 생성된다.
--   반환: { order_id, match_code, access_token }
--
-- [PIN 금지규칙] (헬퍼 _helper_pin_forbidden 에 구현 — PRD §6)
--   · 명시 제외 {1000,1001,1234,2025,2026} ∪ 연도 2024~2027  → '1000'..'2027' IN 목록
--   · 반복(네 자리 동일): 0000,1111,...,9999
--   · 연속 오름(각 자리 +1): 0123,1234,...,6789
--   · 연속 내림(각 자리 -1): 9876,8765,...,3210
--   · 같은 학회의 "살아 있는 PIN"(준비중·match_code 보유)은 부분 유니크 인덱스 +
--     생성 루프의 존재검사로 배제. 시도 횟수 제한은 두지 않는다(노출 정보가 상품·금액뿐).
--
-- [동시성]  부분 유니크 인덱스(orders_match_code_event_preparing_uidx)가 최종 방어.
--   두 담당자가 같은 번호를 동시에 뽑아도 INSERT 중 하나만 성공하고, 진 쪽은
--   23505(unique_violation)를 잡아 다른 번호로 재시도한다.
--
-- [보안]
--   SECURITY DEFINER + 함수 첫 줄에서 has_permission('orders:edit') 강제.
--   anon 실행 불가(REVOKE ALL FROM PUBLIC, GRANT 는 authenticated 에만).
--   종료 학회(closed_at 있음)면 거부.
--
-- [적용 방법]  ※ 본 에이전트 적용 안 함. 건우님 승인 후 수동 실행.
--   Supabase 대시보드 → SQL Editor → 이 파일 "실행 SQL 시작~끝" 붙여넣기 → Run.
--   repo 원본: supabase/migrations/20261019000300_DRAFT_create_helper_order_rpc.sql
--
-- [적용 순서]  000100(match_code)·000200(closed_at) 적용 후 이 파일(3).
--   match_code 컬럼·인덱스와 events.closed_at 에 의존한다.
--
-- [멱등성]  CREATE OR REPLACE FUNCTION + REVOKE/GRANT. 재실행 안전. 스키마 변경 없음.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

-- ── 헬퍼: 4자리 PIN 금지 여부(반복·연속·명시제외·연도) ──────────────────────
--    "같은 학회 살아있는 PIN" 은 여기서 보지 않는다(DB 상태 의존 → create 루프에서 처리).
--    IMMUTABLE: 입력 문자열만으로 결정. 내부 전용(PUBLIC 실행 회수).
-- CASE 로 분기해 "형식 가드(4자리 숫자)" 가 반드시 먼저 평가되게 한다.
--   OR 체인은 Postgres 에서 단락 평가가 보장되지 않아, 'abc' 같은 비숫자 입력에
--   ::int 캐스트가 함께 평가돼 에러가 날 수 있다. CASE 는 조건을 위에서부터 평가하고
--   한번 매칭되면 이후 WHEN(::int 포함)을 평가하지 않음이 문서로 보장된다.
--   운영 호출은 항상 생성된 4자리 숫자뿐이지만, 검증 쿼리·방어를 위해 안전하게 둔다.
CREATE OR REPLACE FUNCTION public._helper_pin_forbidden(p_code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- 형식 방어: 정확히 4자리 숫자가 아니면 금지로 취급(이후 WHEN 미평가)
    WHEN p_code IS NULL OR p_code !~ '^[0-9]{4}$' THEN true
    -- 명시 제외(상품명 숫자) ∪ 연도 2024~2027
    WHEN p_code IN ('1000','1001','1234','2024','2025','2026','2027') THEN true
    -- 반복: 네 자리 모두 동일
    WHEN substr(p_code,1,1) = substr(p_code,2,1)
     AND substr(p_code,2,1) = substr(p_code,3,1)
     AND substr(p_code,3,1) = substr(p_code,4,1) THEN true
    -- 연속 오름: 각 자리 +1 (0123..6789)
    WHEN substr(p_code,2,1)::int = substr(p_code,1,1)::int + 1
     AND substr(p_code,3,1)::int = substr(p_code,2,1)::int + 1
     AND substr(p_code,4,1)::int = substr(p_code,3,1)::int + 1 THEN true
    -- 연속 내림: 각 자리 -1 (9876..3210)
    WHEN substr(p_code,2,1)::int = substr(p_code,1,1)::int - 1
     AND substr(p_code,3,1)::int = substr(p_code,2,1)::int - 1
     AND substr(p_code,4,1)::int = substr(p_code,3,1)::int - 1 THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public._helper_pin_forbidden(text) FROM PUBLIC;

-- ── RPC: 도움(PIN) 주문 생성 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_helper_order(p_event_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed_at timestamptz;
  v_exists    boolean;
  v_code      text;
  v_order_id  bigint;
  v_token     uuid;
  v_guard     int := 0;   -- 무한루프 방어(연 800건 규모라 실제 도달 불가)
BEGIN
  -- 1) 권한
  IF NOT public.has_permission('orders:edit') THEN
    RAISE EXCEPTION '권한이 없습니다 (orders:edit 필요).' USING ERRCODE = '42501';
  END IF;

  -- 2) 학회 존재 + 미종료 확인
  SELECT closed_at INTO v_closed_at
  FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 학회입니다.';
  END IF;
  IF v_closed_at IS NOT NULL THEN
    RAISE EXCEPTION '종료된 학회입니다.';
  END IF;

  -- 3) 생성 루프: 금지되지 않고 같은 학회에 살아있지 않은 PIN 을 뽑아 INSERT.
  --    경합으로 23505 가 나면 다른 번호로 재시도.
  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 1000 THEN
      RAISE EXCEPTION 'PIN 생성에 반복 실패했습니다. 잠시 후 다시 시도해 주세요.';
    END IF;

    -- 후보 1개 생성(0000~9999, 앞자리 0 보존)
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

    -- 금지규칙
    CONTINUE WHEN public._helper_pin_forbidden(v_code);

    -- 같은 학회의 살아있는 PIN 과 충돌하면 재생성
    SELECT EXISTS (
      SELECT 1 FROM orders
      WHERE event_id = p_event_id
        AND status = 'preparing'
        AND match_code = v_code
    ) INTO v_exists;
    CONTINUE WHEN v_exists;

    -- INSERT 시도 (부분 유니크 인덱스가 최종 경합 방어)
    BEGIN
      INSERT INTO orders (
        event_id, status, match_code,
        total_cost, discount_amount, delivery_fee, final_payment,
        status_history
      ) VALUES (
        p_event_id, 'preparing', v_code,
        0, 0, 0, 0,
        jsonb_build_array(jsonb_build_object('status', 'preparing', 'changed_at', now()))
      )
      RETURNING id, access_token INTO v_order_id, v_token;
      EXIT;  -- 성공
    EXCEPTION WHEN unique_violation THEN
      -- 동시 생성 경합 → 다른 번호로 재시도
      CONTINUE;
    END;
  END LOOP;

  RETURN json_build_object(
    'order_id',     v_order_id,
    'match_code',   v_code,
    'access_token', v_token
  );
END;
$$;

-- authenticated(로그인·orders:edit)만. anon 불가.
REVOKE ALL ON FUNCTION public.create_helper_order(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_helper_order(bigint) TO authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행.
-- ----------------------------------------------------------------------------
-- (a) PIN 금지규칙 — 전부 true 여야 정상(금지로 판정):
-- SELECT
--   public._helper_pin_forbidden('1234') AS ex_1234,   -- 명시+오름
--   public._helper_pin_forbidden('2024') AS yr_2024,   -- 연도
--   public._helper_pin_forbidden('2027') AS yr_2027,   -- 연도
--   public._helper_pin_forbidden('0000') AS rep_0000,  -- 반복
--   public._helper_pin_forbidden('1111') AS rep_1111,  -- 반복
--   public._helper_pin_forbidden('0123') AS asc_0123,  -- 오름
--   public._helper_pin_forbidden('6789') AS asc_6789,  -- 오름
--   public._helper_pin_forbidden('9876') AS desc_9876, -- 내림
--   public._helper_pin_forbidden('3210') AS desc_3210, -- 내림
--   public._helper_pin_forbidden('abc')  AS bad_fmt;   -- 형식오류
--   기대: 전부 true.
-- (b) 허용돼야 하는 예시 — 전부 false:
-- SELECT
--   public._helper_pin_forbidden('0427') AS ok1,
--   public._helper_pin_forbidden('5083') AS ok2,
--   public._helper_pin_forbidden('1357') AS ok3,   -- 오름 아님(+2 간격)
--   public._helper_pin_forbidden('0124') AS ok4;   -- 마지막 자리만 어긋남
--   기대: 전부 false.
-- (c) 실제 생성(스테이징/테스트 학회 id 로만) — 반드시 로그인 세션(authenticated)에서:
-- SELECT public.create_helper_order(<테스트_event_id>);
--   기대: {"order_id":..,"match_code":"NNNN","access_token":".."}.
--   재실행 시 금지규칙·중복을 피한 "다른" 번호가 나와야 한다.
--   종료 학회(closed_at 있음)로 호출하면 "종료된 학회입니다" 예외.
--   anon(비로그인) 호출 시 "권한이 없습니다" 또는 권한 거부.
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.create_helper_order(bigint);
-- DROP FUNCTION IF EXISTS public._helper_pin_forbidden(text);
-- ============================================================================
