-- ============================================================================
-- [DRAFT] 현장 도움(PIN) 주문 — events.closed_at(학회 종료 시각) + anon 노출
-- File: 20261019000200_DRAFT_add_events_closed_at.sql
-- Date: 2026-10-19
-- Author: backend-engineer (CTO 위임 지시서 / PIN 주문 백엔드 선행)
-- 근거: DOCS/PRD_현장도움주문.md §4(학회 종료 처리), §6
--
-- [목적]
--   "학회 종료" 를 timestamptz 1개(closed_at)로 표현한다.
--     · NULL        = 진행 중(주문서 링크 열림, PIN 흐름 허용)
--     · 값 있음      = 종료(고객 주문서·PIN 흐름 거부, "종료된 학회" 안내)
--   종료/재개는 close_event / reopen_event 함수(000600)가 담당한다. 여기선 컬럼과
--   anon SELECT 노출만 추가한다.
--
-- [anon 노출이 필요한 이유]
--   고객 주문서(anon)는 PostgREST 로 events 를 직접 읽어 종료 여부를 표시하고,
--   PIN 흐름 진입 전 "종료된 학회" 를 안내해야 한다. events 의 anon 권한은
--   "컬럼 단위 GRANT 화이트리스트" 방식이라(20260616010000 가 최신, 10컬럼),
--   closed_at 을 명시적으로 GRANT 하지 않으면 anon 이 못 읽는다.
--
-- [⚠ 기존 GRANT 를 건드리지 않는 설계 — 중요]
--   CTO 지시: 기존 10컬럼 GRANT 문을 통째로 다시 쓰지 말고 closed_at 만 "추가"
--   GRANT 한다. 이유: visible_categories 같은 DRAFT 컬럼은 운영 DB 에 아직 없을 수
--   있는데, 존재하지 않는 컬럼을 GRANT 목록에 넣으면 그 GRANT 문 전체가 실패해
--   closed_at 노출까지 통째로 날아간다. `GRANT SELECT (closed_at)` 한 줄로 기존
--   화이트리스트에 "덧붙이기" 하면 다른 컬럼 상태와 무관하게 안전하다.
--   (컬럼 단위 GRANT 는 누적된다 — 기존 10컬럼은 그대로 유지되고 closed_at 만 추가됨.)
--
-- [admin(authenticated) — 자동]
--   20260616010000 에서 `GRANT SELECT ON public.events TO authenticated`(테이블 레벨)
--   이 부여돼 있어 신규 closed_at 도 자동으로 읽힌다. 추가 GRANT 불필요.
--   쓰기(UPDATE closed_at)는 close_event/reopen_event 정의자 함수로만 수행(000600).
--
-- [RLS — 무영향]  events 행 정책을 생성/변경/삭제하지 않는다. 컬럼 + 컬럼 GRANT 만.
--
-- [적용 방법]  ※ 본 에이전트는 적용하지 않음. 건우님 승인 후 수동 실행.
--   Supabase 대시보드 → SQL Editor → 이 파일 "실행 SQL 시작~끝" 붙여넣기 → Run.
--   repo 원본: supabase/migrations/20261019000200_DRAFT_add_events_closed_at.sql
--
-- [적용 순서]  000100(match_code) → 이 파일(2) → 000300~000600(함수).
--   함수들이 closed_at 을 참조하므로 함수보다 먼저 적용한다.
--
-- [멱등성]  ADD COLUMN IF NOT EXISTS + GRANT(반복 안전). 재실행 무에러.
--
-- [운영 중 적용 안전성]
--   ADD COLUMN timestamptz(NULL 허용·DEFAULT 없음)은 테이블 재작성 없이 즉시.
--   events 는 연 수십 건 규모라 잠금/부하 무시 가능.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

-- 1) 종료 시각 컬럼
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

COMMENT ON COLUMN public.events.closed_at IS
  '학회 종료 시각. NULL=진행 중(주문서 링크 열림), 값 있음=종료(고객 주문서·PIN 흐름 거부). '
  'close_event / reopen_event 함수로만 설정/해제. anon 노출(고객 주문서 종료 안내용).';

-- 2) anon 화이트리스트에 closed_at "추가"(기존 10컬럼 GRANT 는 건드리지 않음).
--    컬럼 단위 GRANT 는 누적되므로 이 한 줄로 closed_at 만 덧붙는다.
GRANT SELECT (closed_at) ON public.events TO anon;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 확인.
-- ----------------------------------------------------------------------------
-- (a) 컬럼 존재:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='events' AND column_name='closed_at';
--   기대: 1행, data_type=timestamp with time zone, is_nullable=YES.
--
-- (b) anon 이 closed_at 을 읽을 수 있고 기존 화이트리스트가 보존됐는지:
-- SELECT grantee, column_name
-- FROM information_schema.role_column_grants
-- WHERE table_name='events' AND grantee='anon'
-- ORDER BY column_name;
--   기대: 기존 10컬럼(id,name,discount_rate,tags,start_date,end_date,
--         estimated_delivery_date,order_url_slug,venue,created_at) + closed_at = 11컬럼.
--         attendee_ids/note/marketing_cost/venue_name 등은 여전히 부재(비노출 유지).
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- REVOKE SELECT (closed_at) ON public.events FROM anon;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS closed_at;
--   (주의: 컬럼 드롭 시 종료 표시가 사라져 종료된 학회가 다시 열린 것처럼 보임.
--    close_event 로 삭제된 준비중 주문은 복구되지 않음.)
-- ============================================================================
