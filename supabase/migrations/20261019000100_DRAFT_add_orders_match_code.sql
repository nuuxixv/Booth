-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — orders.match_code(PIN) 컬럼 + 부분 유니크 인덱스
-- File: 20261019000100_DRAFT_add_orders_match_code.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §6, §7
--
-- [목적]
--   담당자가 만든 "준비중(preparing)" 주문에 4자리 PIN 을 글자(text)로 저장한다.
--   · text 로 저장해 "0427" 처럼 앞자리 0 을 보존한다(정수 저장 시 427 로 뭉개짐).
--   · PIN 은 "학회별 · 준비중끼리만" 유일하면 된다(부분 유니크 인덱스).
--     고객이 제출하면 match_code = NULL 로 반납되어 인덱스에서 빠지고 같은 번호를
--     다른 준비중 주문이 다시 쓸 수 있다.
--
-- [왜 새 테이블이 아니라 컬럼 1개인가]
--   PIN 주문은 기존 orders 1행의 "서로 다른 칸"을 담당자(상품)·고객(배송지)이 나눠
--   채우는 모델이다. 상태(status='preparing')와 PIN(match_code) 외 신규 스키마가 없다.
--   연 800건 규모라 별도 테이블·큐·배치는 과설계(PRD §6 "만들지 않는 것").
--
-- [적용 방법]  ※ 본 에이전트는 적용하지 않음(작성만). 건우님 승인 후 수동 실행.
--   어디에: Supabase 대시보드 → SQL Editor → New query
--   무엇을: 이 파일의 "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 붙여넣기.
--           (상단 주석·하단 검증 쿼리는 실행에 영향 없음 — 통째로 붙여도 무방)
--   실행: Run(Ctrl+Enter) 1회. "Success. No rows returned" 이면 정상.
--   repo 원본: supabase/migrations/20261019000100_DRAFT_add_orders_match_code.sql
--
-- [적용 순서]  이 파일(1) → 20261019000200(closed_at, 2) → 000300~000600(함수).
--   함수들이 match_code / closed_at 을 참조하므로 반드시 이 파일을 먼저 적용한다.
--
-- [멱등성]  ADD COLUMN IF NOT EXISTS · CREATE UNIQUE INDEX IF NOT EXISTS. 재실행 안전.
--
-- [운영 중 적용 안전성]
--   - ADD COLUMN text(NULL 허용·DEFAULT 없음)은 PG11+ 에서 테이블 재작성 없이
--     카탈로그만 갱신 → 사실상 즉시.
--   - 부분 유니크 인덱스 생성은 기존 데이터에 match_code 가 전무(신규 컬럼)하므로
--     스캔 대상이 0행 → 즉시 완료. (연 800건이라 미래에도 무시 가능.)
--     CONCURRENTLY 불필요(인덱싱할 행이 없음).
--
-- [anon 노출 — 없음]
--   orders 는 anon 에게 테이블 SELECT 가 없고(고객 조회는 get_order_by_token /
--   get_helper_order_by_code 정의자 함수로만), match_code 역시 어떤 함수에서도
--   고객에게 반환하지 않는다(get_helper_order_by_code 는 상품·금액만 반환).
--   → PIN 자체가 네트워크로 역노출될 경로 없음.
--
-- [RLS — 무영향]  orders 행 RLS 정책을 생성/변경/삭제하지 않는다(컬럼·인덱스만).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ▣ 적용 전 반드시 확인 — 운영 DB 의 orders.status 기본값
-- ─────────────────────────────────────────────────────────────────────────────
--   아래 쿼리를 SQL Editor 에서 1회 실행해 column_default 를 확인한다.
--   create-order Edge Function 은 과거 baseOrderRow 에 status 를 명시하지 않고도
--   주문이 'pending' 으로 생성돼 왔다 → 운영 DB 에 DEFAULT 'pending' 이 걸려 있을
--   가능성이 높다(repo 마이그레이션엔 정의 없음 = 대시보드에서 직접 설정된 것).
--   이 선행 작업과 함께 create-order 는 status:'pending' 을 명시하도록 바뀌므로
--   기본값이 무엇이든 일반 주문은 'pending' 으로 안전하다. 다만 현재 기본값을
--   기록해 두면 preparing 흐름과의 상호작용을 판단할 수 있다.
--
--     SELECT column_default, is_nullable
--     FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='orders' AND column_name='status';
--
--   기대/해석:
--     · column_default 가 'pending'::text 면 → 과거 동작과 일치(명시 안 해도 pending).
--     · column_default 가 NULL 이면 → status 미지정 주문은 NULL 로 생성돼 왔다는 뜻.
--       (create-order 는 이번에 status:'pending' 을 명시하므로 이후로는 NULL 불생성.)
--   어느 경우든 이 마이그레이션은 status 기본값을 바꾸지 않는다(관찰만).
--
--   ✅ 운영 확인 결과(건우님 실행, 2026-10-19): column_default = 'pending'::text,
--      is_nullable = NO. → 기본값 'pending' + NOT NULL. 둘 다 repo 마이그레이션에 없는
--      대시보드 설정이다. create_helper_order 는 status='preparing' 을 명시하므로
--      NOT NULL 과 충돌하지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────


-- ===== 실행 SQL 시작 =========================================================

-- 1) PIN 컬럼 (text — 앞자리 0 보존)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS match_code text;

COMMENT ON COLUMN public.orders.match_code IS
  '현장 도움(PIN) 주문의 4자리 안내 번호. text 로 저장해 앞자리 0 보존(예 "0427"). '
  '준비중(preparing) 주문에만 존재하고 고객 제출 시 NULL 로 반납된다. '
  '학회별·준비중끼리만 유일(부분 유니크 인덱스 orders_match_code_event_preparing_uidx). '
  '어떤 함수도 고객에게 반환하지 않음(anon 비노출).';

-- 2) 부분 유니크 인덱스 — "학회별 · 준비중 · match_code 있음" 범위에서만 유일.
--    고객 제출로 match_code=NULL 또는 status<>'preparing' 이 되면 인덱스에서 빠져
--    같은 번호를 다른 준비중 주문이 재사용할 수 있다(PIN 반납·재발급).
CREATE UNIQUE INDEX IF NOT EXISTS orders_match_code_event_preparing_uidx
  ON public.orders (event_id, match_code)
  WHERE match_code IS NOT NULL AND status = 'preparing';

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 확인.
-- ----------------------------------------------------------------------------
-- (a) 컬럼 존재:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='orders' AND column_name='match_code';
--   기대: 1행, data_type=text, is_nullable=YES.
--
-- (b) 부분 유니크 인덱스 존재 + 조건:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname='public' AND tablename='orders'
--   AND indexname='orders_match_code_event_preparing_uidx';
--   기대: indexdef 에 "(event_id, match_code) WHERE ((match_code IS NOT NULL) AND
--         (status = 'preparing'::text))" 가 포함.
--
-- (c) 유일성 동작 수동 점검(선택 — 테스트 학회 1건에서):
--   -- 같은 학회·같은 PIN 으로 준비중 2건 INSERT 시도 → 2번째가 23505 로 거부되면 정상.
--   -- (운영 데이터로 시험하지 말 것. 스테이징/테스트 학회에서만.)
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.orders_match_code_event_preparing_uidx;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS match_code;
--   (주의: 컬럼 드롭 시 발급된 PIN 데이터가 사라짐. 준비중 주문 자체는 남음.)
-- ============================================================================
