-- ============================================================================
-- Migration: events 상세 운영필드 추가 (학회 개선 트랙 2차 — 셋업/철수 시간 + 장소 분리)
-- File: 20261012000000_add_event_detail_columns.sql
-- Date: 2026-10-12
-- Author: backend-engineer (CTO 위임 지시서 / 학회 개선 트랙 2차)
--
-- [목적]
--   학회 상세(L2) 운영 입력을 위해 events 에 자유 텍스트 필드 5개를 추가한다.
--     - setup_time     : 셋업(설치) 시간 안내 (자유 텍스트)
--     - teardown_time  : 철수 시간 안내 (자유 텍스트)
--     - venue_name     : 장소명 (기존 단일 venue 를 구조화해 분리)
--     - venue_address  : 장소 주소 (도로명/지번 등, 자유 텍스트)
--     - venue_detail   : 장소 상세(층/홀/부스 위치 등, 자유 텍스트)
--   기존 단일 venue 컬럼은 삭제하지 않고 deprecated 로 존치한다(아래 [venue 관계] 참조).
--   진행상태용 boolean(기안/신청/지결 등)은 본 마이그레이션에서 추가하지 않는다.
--
-- [적용 방법]  ※ CI 미사용. 본 에이전트는 적용하지 않음(작성만).
--   Supabase 대시보드 → SQL Editor → 본 파일 전문(全文) 붙여넣기 → Run.
--   supabase db push 불필요 — 대시보드 수동 실행 전용.
--
-- [적용 순서]
--   본 파일(1) → 20261012000100_create_prep_note_templates.sql(2).
--   두 파일은 서로 독립이라 순서가 바뀌어도 동작하나, 번호순 권장.
--
-- [멱등성]  두 번 이상 실행해도 안전.
--   - ADD COLUMN IF NOT EXISTS : 이미 있으면 건너뜀.
--   - 백필 UPDATE : WHERE venue_name IS NULL 가드로 1회성 — 재실행 시 이미 채워진 행은
--     조건에 걸리지 않아 덮어쓰지 않음. 공백만 있는 venue 는 애초에 복사하지 않으므로
--     (btrim(venue) <> '') 재실행해도 계속 NULL 로 안정(변동 없음).
--   - COMMENT ON COLUMN : 멱등(덮어쓰기).
--
-- [운영 중 적용 안전성 — 잠금 영향]
--   - ADD COLUMN ... text (NULL 허용 · DEFAULT 없음)은 PostgreSQL 11+ 에서 테이블
--     재작성(rewrite) 없이 카탈로그 메타데이터만 갱신 → 사실상 즉시 완료.
--     (짧은 ACCESS EXCLUSIVE 락만 순간 점유, 데이터 전수 스캔 없음.)
--   - 백필 UPDATE 는 events 행만 건드리며 events 는 연 수십 건 규모(주문 아님)라
--     락/부하 모두 무시 가능. 운영 중 적용해도 영향 미미.
--
-- [anon 비노출 — 자동 보장 / 근거]
--   events 의 anon 권한은 "컬럼 단위(column-level) GRANT 화이트리스트" 방식이다.
--   최신 기준: 20260616010000_fix_events_authenticated_grant.sql 에서
--     REVOKE SELECT ON public.events FROM anon;
--     GRANT  SELECT (id, name, discount_rate, tags, start_date, end_date,
--                    estimated_delivery_date, order_url_slug, venue, created_at)
--            ON public.events TO anon;
--   즉 anon 은 "명시된 10개 컬럼"에만 SELECT 권한이 있다. 컬럼 단위 GRANT라서
--   본 마이그레이션의 신규 5컬럼은 화이트리스트에 없으므로 anon 에게 자동 비노출된다
--   (anon 이 PostgREST 로 setup_time 등을 select 하면 42501 permission denied).
--   선례: 20260608030000(진행상태 boolean), 20260608010000(attendee_ids/note 등)도
--   동일하게 화이트리스트를 건드리지 않아 자동 비노출 처리됨.
--   → 본 파일은 anon GRANT 를 일절 변경하지 않는다(의도적). 누출 없음.
--
-- [authenticated(어드민) 접근 — 자동 보장 / 근거]
--   20260616010000 에서 `GRANT SELECT ON public.events TO authenticated;` (테이블 레벨,
--   컬럼 한정 아님)을 부여했으므로 신규 컬럼을 포함한 전 컬럼을 어드민이 읽을 수 있다.
--   쓰기(INSERT/UPDATE)는 20251121_apply_rbac_rls.sql 의 행 단위 정책
--   has_permission('events:edit') 로 통제되며 컬럼 단위가 아니므로 신규 5컬럼도 자동 상속.
--   → 어드민 읽기/쓰기 모두 추가 GRANT 없이 동작.
--
-- [RLS — 무영향]
--   events 행(row) 단위 정책(SELECT anon/authenticated USING(true), INSERT/UPDATE edit,
--   DELETE master)은 그대로. 본 파일은 RLS 정책을 생성/변경/삭제하지 않는다(완화 없음).
--
-- [venue 관계 / deprecated 존치]
--   - 기존 venue(단일 텍스트)는 삭제하지 않는다. anon 주문 페이지가 아직 venue 를 읽을 수
--     있고(화이트리스트 포함), 과거 데이터 보존을 위해서다.
--   - 신규 venue_name/venue_address/venue_detail 은 어드민 전용(anon 비노출)이며
--     venue 를 구조화해 대체할 목적이다. 전환 완료 전까지 venue 는 하위호환으로 유지.
--
-- [백필 — 공백만 있는 venue 처리 판단]
--   UPDATE ... SET venue_name = venue WHERE venue_name IS NULL AND venue IS NOT NULL
--   에 추가로 `AND btrim(venue) <> ''` 조건을 둔다.
--   사유: 공백("   ")만 든 venue 를 venue_name 에 그대로 복사하면 "값이 있는 것처럼"
--   보이지만 실제로는 빈 값이라 혼란을 준다. 공백만 있는 행은 복사하지 않고 venue_name 을
--   NULL 로 남겨 어드민이 새로 입력하도록 한다. (의미있는 값은 원본 그대로 복사 — 어드민
--   입력을 임의로 trim/변형하지 않음.)
--
-- [롤백]  파일 하단 ROLLBACK 주석 참조.
--
-- [적용 후 확인 쿼리]  파일 하단 [검증 쿼리] 참조.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 컬럼 추가 (NULL 허용 · DEFAULT 없음 → 메타데이터 변경, 재작성 없음)
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS setup_time    text,
  ADD COLUMN IF NOT EXISTS teardown_time text,
  ADD COLUMN IF NOT EXISTS venue_name    text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS venue_detail  text;

-- ----------------------------------------------------------------------------
-- 2. 백필: 기존 단일 venue → venue_name (1회성, 재실행 안전)
--    공백만 있는 venue 는 복사하지 않음(venue_name NULL 유지). 의미있는 값만 원본 복사.
-- ----------------------------------------------------------------------------
UPDATE public.events
SET venue_name = venue
WHERE venue_name IS NULL
  AND venue IS NOT NULL
  AND btrim(venue) <> '';

-- ----------------------------------------------------------------------------
-- 3. 컬럼 주석 (용도 · 자유 텍스트 · venue 와의 관계)
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN public.events.setup_time    IS '셋업(설치) 시간 안내. 자유 텍스트. 어드민 전용(anon 비노출).';
COMMENT ON COLUMN public.events.teardown_time IS '철수 시간 안내. 자유 텍스트. 어드민 전용(anon 비노출).';
COMMENT ON COLUMN public.events.venue_name    IS '장소명. 자유 텍스트. 기존 단일 venue(deprecated)의 구조화 대체. venue 에서 1회 백필됨. 어드민 전용(anon 비노출).';
COMMENT ON COLUMN public.events.venue_address IS '장소 주소(도로명/지번 등). 자유 텍스트. venue 구조화 분리. 어드민 전용(anon 비노출).';
COMMENT ON COLUMN public.events.venue_detail  IS '장소 상세(층/홀/부스 위치 등). 자유 텍스트. venue 구조화 분리. 어드민 전용(anon 비노출).';

-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 결과를 확인하세요.
-- ----------------------------------------------------------------------------
-- (a) 신규 5컬럼이 events 에 존재하는지:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'events'
--   AND column_name IN ('setup_time','teardown_time','venue_name','venue_address','venue_detail')
-- ORDER BY column_name;
--   기대: 5행, data_type = text, is_nullable = YES.
--
-- (b) anon 에 신규 컬럼이 "없어야" 함 / authenticated 에는 "있어야" 함:
-- SELECT grantee, column_name
-- FROM information_schema.role_column_grants
-- WHERE table_name = 'events'
--   AND grantee IN ('anon','authenticated')
--   AND column_name IN ('setup_time','teardown_time','venue_name','venue_address','venue_detail')
-- ORDER BY grantee, column_name;
--   기대: grantee='anon' 행은 0건(비노출 확인).
--         grantee='authenticated' 는 5컬럼 모두 표시(테이블 레벨 GRANT 상속).
--
-- (c) 백필 결과(venue → venue_name) 확인:
-- SELECT id, venue, venue_name FROM public.events
-- WHERE venue IS NOT NULL ORDER BY id;
--   기대: venue 가 의미있는 값인 행은 venue_name 이 동일 값, 공백만 있던 행은 venue_name=NULL.
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.events DROP COLUMN IF EXISTS setup_time;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS teardown_time;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS venue_name;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS venue_address;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS venue_detail;
-- (주의: 컬럼을 드롭하면 백필된 venue_name 데이터도 사라짐. venue 원본은 보존됨.)
-- ============================================================================
