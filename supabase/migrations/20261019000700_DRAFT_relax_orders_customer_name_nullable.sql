-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — orders.customer_name NOT NULL → 범위축소 CHECK 교체
-- File: 20261019000700_DRAFT_relax_orders_customer_name_nullable.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §4, §6 + CTO 결정(선택지 A: 제약 해제 → CHECK 로 방어 복원)
--
-- [하는 일]
--   운영 orders 테이블의 customer_name 에서 NOT NULL 제약을 제거해 NULL 을 허용하되,
--   "실주문에는 고객명이 비지 않도록" 범위를 좁힌 CHECK 제약
--   (orders_customer_name_required)으로 방어선을 복원한다.
--     · NULL 은 status 가 'preparing' 또는 'cancelled' 인 PIN 주문에만 허용된다.
--     · 그 외 status(pending/paid 등 실주문)는 여전히 customer_name 이 필수.
--   DEFAULT·트리거는 추가하지 않는다(빈 문자열 같은 대체값 금지).
--
-- [왜]
--   create_helper_order(000300, 운영 적용 완료)는 고객 정보 없이 "준비중" 주문을
--   INSERT 한다 → customer_name 을 넣지 않는다. 그런데 운영 DB 에는 repo 에 기록되지
--   않은 customer_name NOT NULL 제약(DEFAULT 없음)이 대시보드에서 걸려 있어, 리허설에서
--   `null value in column "customer_name" ... violates not-null constraint` 로 INSERT 가
--   실패했다. (repo 원본 20250722070000_create_orders_table.sql 에는 `customer_name text`
--   로 nullable 이 정상 — NOT NULL 은 대시보드에서만 추가된 미기록 제약이다.)
--
--   왜 "단순 해제" 가 아니라 "해제 + CHECK" 인가(CTO 재판단):
--     · create-order Edge Function 은 customer_name 을 서버에서 검증하지 않고
--       status:'pending' 으로 그대로 INSERT 한다. 따라서 NOT NULL 을 아무 방어 없이
--       해제하면, 공개(RPC/PostgREST) 경로로 고객명 없는 "실주문" 을 만들 수 있게 된다.
--     · 그래서 NOT NULL 을 범위를 좁힌 CHECK 로 교체한다. NULL 허용 대상을 PIN 주문
--       (status preparing/cancelled)으로 한정해, 실주문의 고객명 강제는 DB 레벨에서
--       그대로 유지하면서 PIN 준비중 INSERT 만 통과시킨다.
--     · "값 없음" 의 표준은 NULL 이다(빈 문자열 대체값 금지). phone_number·
--       shipping_address·inpsyt_id·customer_request 는 이미 NULL 허용이고 CHECK 도 없다.
--       연락처 정규화 트리거도 빈 문자열을 NULL 로 바꾼다.
--     · 운영 읽기 경로(get_order_by_token 등)는 이미 customer_name NULL 을 안전히 처리.
--   → DEFAULT(빈 문자열 등 대체값)는 추가하지 않는다. create_helper_order·
--     submit_helper_order 도 수정하지 않는다(스키마 제약만 조정).
--
-- [적용 방법]  ※ 본 에이전트는 적용하지 않음(작성만). 건우님 승인 후 수동 실행.
--   어디에: Supabase 대시보드 → SQL Editor → New query
--   무엇을: 이 파일의 "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 붙여넣기.
--           (상단 주석·하단 검증 쿼리는 실행에 영향 없음 — 통째로 붙여도 무방)
--   실행: Run(Ctrl+Enter) 1회. "Success. No rows returned" 이면 정상.
--   repo 원본: supabase/migrations/20261019000700_DRAFT_relax_orders_customer_name_nullable.sql
--
-- [적용 순서]  000100(match_code)·000200(closed_at)·000300~000600(함수) 적용 후
--   이 파일(7)을 적용하면 된다. 다른 PIN 선행 파일과의 선후 의존은 없다(독립 ALTER).
--   단, create_helper_order 가 실제로 INSERT 에 성공하려면 이 파일이 적용돼 있어야 한다.
--
-- [멱등성]
--   · DROP NOT NULL 은 이미 nullable 인 컬럼에 다시 실행해도 무변화·무에러.
--   · CHECK 추가는 pg_constraint 존재검사(conname=orders_customer_name_required)로
--     감싼 DO 블록이라, 이미 있으면 건너뛴다. 재실행 안전.
--
-- [운영 중 적용 안전성]
--   · NOT NULL 제거는 카탈로그(pg_attribute.attnotnull)만 갱신 → 테이블 재작성 없이 즉시.
--   · CHECK 추가는 기존 행을 1회 스캔해 검증한다. 지금까지 NOT NULL 이 걸려 있었으므로
--     기존 실주문은 모두 customer_name 이 있어 CHECK 를 만족한다(리허설 실패로 NULL 행도
--     없다) → 검증 통과. orders 는 연 800건 규모라 스캔·짧은 잠금 모두 체감 영향 없음.
--   · 같은 실행 안에서 DROP NOT NULL → ADD CHECK 사이에 INSERT 가 끼지 않으므로
--     그 틈에 무명 실주문이 생길 여지도 없다.
--
-- [RLS — 무영향]  orders 행 RLS 정책을 생성/변경/삭제하지 않는다. 컬럼 제약을
--   NOT NULL → 범위축소 CHECK 로 교체할 뿐이다. GRANT·정책·함수 권한에 변화 없음.
--
-- [부채 기록]  운영 DB 에는 repo 에 없던 customer_name NOT NULL 이 대시보드로 걸려 있었다.
--   이 파일로 그 상태를 repo 에 명시적으로 수렴시킨다(NOT NULL → 범위축소 CHECK).
--   create-order 는 고객명을 서버에서 검증하지 않으므로, 실주문의 고객명 필수성은 앱
--   레이어가 아니라 CHECK orders_customer_name_required 가 DB 레벨에서 보장한다.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

-- 1) customer_name 의 NOT NULL 제약 해제. 이미 nullable 이면 무변화(재실행 안전).
ALTER TABLE public.orders
  ALTER COLUMN customer_name DROP NOT NULL;

-- 2) 범위를 좁힌 CHECK 로 방어선 복원 — 실주문은 고객명 필수, NULL 은 PIN 주문만 허용.
--    pg_constraint 존재검사로 감싸 멱등하게 추가(이미 있으면 건너뜀).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_customer_name_required'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_customer_name_required
      CHECK (customer_name IS NOT NULL OR status IN ('preparing', 'cancelled'));
  END IF;
END $$;

-- 3) 의도 기록(repo 에 기존 컬럼 코멘트 없음 — 신규 추가).
COMMENT ON COLUMN public.orders.customer_name IS
  '고객명. NULL 허용(값 없음의 표준은 NULL, 빈 문자열 대체값 금지). create-order 는 '
  '고객명을 서버에서 검증하지 않으므로, 실주문의 고객명 강제는 CHECK '
  'orders_customer_name_required 가 담당한다. NULL 은 status 가 preparing 또는 '
  'cancelled 인 PIN 주문에만 허용된다(준비중 생성 시 비었다가 submit_helper_order 로 채움).';

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 확인. (읽기 전용 — INSERT 로 시험하지 말 것:
--   제약이 없으면 실제 행이 생겨 운영 데이터를 오염시킨다.)
-- ----------------------------------------------------------------------------
-- 한 번 실행으로 결과 1줄에 세 값이 함께 나온다(SQL Editor 는 마지막 문장 결과만 표시):
--
-- SELECT
--   (SELECT is_nullable
--      FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='orders'
--        AND column_name='customer_name')                       AS customer_name_is_nullable,
--   (SELECT pg_get_constraintdef(oid)
--      FROM pg_constraint
--      WHERE conname='orders_customer_name_required'
--        AND conrelid='public.orders'::regclass)                AS check_constraint_def,
--   (SELECT count(*) FROM public.orders WHERE customer_name IS NULL)
--                                                               AS null_customer_name_rows;
--
--   기대(적용 후):
--     · customer_name_is_nullable = YES
--     · check_constraint_def =
--         CHECK (((customer_name IS NOT NULL) OR (status = ANY (ARRAY['preparing'::text, 'cancelled'::text]))))
--       (NULL 이면 제약이 아직 없는 것 = 미적용)
--     · null_customer_name_rows = 0 (적용 직후. 이후 PIN 준비중 주문이 생기면 늘 수 있음)
--
-- 실제 동작(준비중 주문 생성)은 SQL Editor 가 아니라 "어드민 화면의 PIN 주문 생성"으로 확인.
--   이유: create_helper_order 는 첫 줄에서 has_permission('orders:edit') 를 검사한다.
--         SQL Editor 는 로그인(authenticated) 세션이 아니라 권한 검사에서 막혀
--         SELECT public.create_helper_order(<event_id>); 가 "권한이 없습니다"(42501)로
--         거부된다. 즉 SQL Editor 에서의 실패는 이 마이그레이션과 무관하다.
--   방법: 어드민 로그인(orders:edit) → 진행 중 학회에서 PIN 주문 생성 →
--         준비중 주문 1건과 4자리 PIN 이 나오면 정상 반영된 것이다.
--         (해제 전이면 이 INSERT 가 not-null 로 실패했었다.)
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- -- 1) 먼저 CHECK 제약을 제거한다(없어도 에러 없음).
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_name_required;
--
-- -- 2) 그 다음 NOT NULL 복원.
-- ALTER TABLE public.orders ALTER COLUMN customer_name SET NOT NULL;
--   ⚠ 경고: customer_name 이 NULL 인 행(= 아직 고객이 제출하지 않은 "준비중" PIN 주문)이
--      한 건이라도 있으면 이 SET NOT NULL 은 실패한다(기존 NULL 행이 NOT NULL 을 위배).
--      롤백하려면 먼저 그런 행을 정리해야 한다. 아래로 NULL 행을 먼저 확인할 것:
--        SELECT id, status, match_code, created_at
--        FROM public.orders WHERE customer_name IS NULL ORDER BY created_at;
--      준비중 주문을 되돌릴 수 없으므로, 롤백 전 해당 주문의 처리(취소/완료/고객제출)를
--      끝낸 뒤에만 SET NOT NULL 을 실행한다.
--   (코멘트 되돌리기는 선택: COMMENT ON COLUMN public.orders.customer_name IS NULL;)
-- ============================================================================
