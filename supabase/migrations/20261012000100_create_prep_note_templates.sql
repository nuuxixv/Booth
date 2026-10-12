-- ============================================================================
-- Migration: prep_note_templates — 학회 준비 메모 템플릿 카탈로그 (학회 개선 트랙 2차)
-- File: 20261012000100_create_prep_note_templates.sql
-- Date: 2026-10-12
-- Author: backend-engineer (CTO 위임 지시서 / 학회 개선 트랙 2차)
--
-- [목적]
--   학회 상세의 준비 메모(prep_note) 작성 시 재사용할 "템플릿 본문" 카탈로그 테이블.
--   어드민이 이름(name) + 본문(body_html)으로 템플릿을 저장/수정/삭제하고, 화면에서
--   불러와 채워 쓰는 용도. (events.prep_note 컬럼 자체와는 별개 — 이 테이블은 재사용
--   가능한 "양식" 모음이고, 실제 적용값은 events.prep_note 에 저장됨.)
--
-- [적용 방법]  ※ CI 미사용. 본 에이전트는 적용하지 않음(작성만).
--   Supabase 대시보드 → SQL Editor → 본 파일 전문(全文) 붙여넣기 → Run.
--   supabase db push 불필요 — 대시보드 수동 실행 전용.
--
-- [적용 순서]
--   20261012000000_add_event_detail_columns.sql(1) → 본 파일(2).
--   두 파일은 서로 독립이라 순서가 바뀌어도 동작하나, 번호순 권장.
--
-- [멱등성]  두 번 이상 실행해도 안전.
--   - CREATE TABLE IF NOT EXISTS
--   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY (이미 켜져 있어도 무해)
--   - DROP POLICY IF EXISTS 후 CREATE POLICY (정책 재생성 안전)
--   - REVOKE/GRANT 는 멱등(권한 상태로 수렴)
--
-- [운영 중 적용 안전성 — 잠금 영향]
--   신규 테이블 생성 + 정책/권한 부여뿐이라 기존 테이블에 락을 걸지 않음. 영향 없음.
--
-- [created_by DEFAULT auth.uid() 적절성 판단]
--   채택. 어드민(authenticated)이 PostgREST 로 INSERT 하면 auth.uid() 가 현재 사용자 id 를
--   반환하므로 작성자가 자동 기록된다. nullable 로 둬서(NOT NULL 아님) service_role/시드
--   경로(auth.uid()=NULL)도 NULL 로 안전하게 들어간다. FK(auth.users)는 걸지 않음 —
--   프로젝트 관례(event_views 외엔 느슨) + 사용자 삭제 시 템플릿까지 깨지지 않게 하기 위함.
--
-- [updated_at 자동 갱신 트리거 — 미도입 / 사유]
--   프로젝트에 재사용 가능한 공용 updated_at 트리거 함수가 존재하지 않는다(확인 결과:
--   feedback / bulletins / role_templates 등 기존 테이블 모두 `updated_at DEFAULT now()`만
--   두고 자동 갱신 트리거는 없음 — 갱신 시각은 앱 계층/ RPC 가 명시적으로 넣는 관례).
--   본 테이블도 같은 관례를 따른다: 트리거를 새로 만들지 않고, 앱(src/api)에서 update 시
--   `updated_at: new Date().toISOString()` 를 함께 보낸다(연 수백 건 미만 저빈도 저장이라
--   전용 트리거 인프라 신설은 과함). → frontend 주의사항은 보고서 참조.
--
-- [audit 트리거 미부착 / 사유]
--   20260606000000_create_audit_log.sql 의 감사 트리거는 orders/order_items/events/
--   products/site_settings 에만 부착된다. 준비 메모 "양식"은 저빈도·비민감(개인정보/금액
--   아님) 데이터라 변경 이력 추적 가치가 낮다. 트리거 미부착으로 둔다(의도적).
--
-- [시드 — 이번엔 넣지 않음]
--   기본 템플릿 본문은 디자이너가 작성 중이며 건우님 검토 후 화면에서 직접 입력 예정.
--   따라서 INSERT 시드 없음(빈 테이블로 생성).
--
-- [RLS 요약]
--   - SELECT : authenticated 전체 허용(USING true). 어드민이면 누구나 템플릿 열람.
--   - INSERT/UPDATE/DELETE : has_permission('events:edit') — 학회 편집 권한자만.
--     (has_permission 시그니처는 20260415_009_fix_has_permission_function.sql 의
--      has_permission(required_perm text), 'events:edit' 정확 매칭으로 동작.)
--   - anon : 권한 없음(아래 REVOKE). 테이블/정책 모두 anon 비노출.
--
-- [anon REVOKE 필요 여부 판단]
--   Supabase 기본 권한 설정상 public 스키마 신규 테이블에는 anon/authenticated 에
--   기본 테이블 권한이 부여된다(선례: 20260608020000 에서 events 가 anon 에 기본 SELECT 를
--   갖고 있었음을 REVOKE 로 교정). 따라서 RLS 에 anon 정책이 없어 행 접근은 막히더라도,
--   방어심화(defense-in-depth)로 anon 의 테이블 권한 자체를 REVOKE 한다
--   (event_views 선례와 동일 패턴). authenticated 는 기본 권한 + RLS 로 통제되므로
--   별도 GRANT/REVOKE 없이 둔다(role_templates 선례와 동일).
--
-- [롤백]  파일 하단 ROLLBACK 주석 참조.
-- [적용 후 확인 쿼리]  파일 하단 [검증 쿼리] 참조.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 테이블 (frontend 계약 고정 스키마)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prep_note_templates (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,                         -- 템플릿 이름(목록 표시)
  body_html  text,                                  -- 템플릿 본문(HTML, 자유 입력)
  created_by uuid DEFAULT auth.uid(),               -- 작성자(=auth.users.id). FK 미설정. 시드/서비스 경로는 NULL.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()              -- 자동 갱신 트리거 없음 — 앱 계층이 update 시 명시
);

COMMENT ON TABLE  public.prep_note_templates           IS '학회 준비 메모(prep_note) 재사용 템플릿 카탈로그. SELECT=authenticated, 쓰기=events:edit. anon 비노출. audit 미부착(저빈도·비민감).';
COMMENT ON COLUMN public.prep_note_templates.name      IS '템플릿 이름(목록 표시용).';
COMMENT ON COLUMN public.prep_note_templates.body_html IS '템플릿 본문(HTML, 자유 텍스트).';
COMMENT ON COLUMN public.prep_note_templates.created_by IS '작성자 auth.users.id. DEFAULT auth.uid(). FK 미설정. 시드/service_role 경로는 NULL.';
COMMENT ON COLUMN public.prep_note_templates.updated_at IS '마지막 수정 시각. 자동 갱신 트리거 없음 — 앱(src/api)이 update 시 함께 기록.';

-- ----------------------------------------------------------------------------
-- 2. RLS 활성화 + 정책 (DROP IF EXISTS 로 멱등)
-- ----------------------------------------------------------------------------
ALTER TABLE public.prep_note_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view prep_note_templates"   ON public.prep_note_templates;
CREATE POLICY "Authenticated can view prep_note_templates"
  ON public.prep_note_templates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "events_edit can insert prep_note_templates"   ON public.prep_note_templates;
CREATE POLICY "events_edit can insert prep_note_templates"
  ON public.prep_note_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('events:edit'));

DROP POLICY IF EXISTS "events_edit can update prep_note_templates"   ON public.prep_note_templates;
CREATE POLICY "events_edit can update prep_note_templates"
  ON public.prep_note_templates
  FOR UPDATE
  TO authenticated
  USING (public.has_permission('events:edit'))
  WITH CHECK (public.has_permission('events:edit'));

DROP POLICY IF EXISTS "events_edit can delete prep_note_templates"   ON public.prep_note_templates;
CREATE POLICY "events_edit can delete prep_note_templates"
  ON public.prep_note_templates
  FOR DELETE
  TO authenticated
  USING (public.has_permission('events:edit'));

-- ----------------------------------------------------------------------------
-- 3. anon 방어심화 — 테이블 권한 자체를 회수(RLS 에 anon 정책 없음 + 권한 회수 이중 차단)
--    authenticated 는 기본 권한 + 위 RLS 로 통제 → 별도 GRANT/REVOKE 없음(관례).
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.prep_note_templates FROM anon;

-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 결과를 확인하세요.
-- ----------------------------------------------------------------------------
-- (a) 테이블 생성 + RLS 활성화 확인:
-- SELECT relname, relrowsecurity
-- FROM pg_class WHERE relname = 'prep_note_templates';
--   기대: relrowsecurity = true.
--
-- (b) 정책 4개(SELECT/INSERT/UPDATE/DELETE) 확인:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'prep_note_templates'
-- ORDER BY cmd;
--   기대: SELECT / INSERT / UPDATE / DELETE 각 1건(총 4건).
--
-- (c) anon 권한 회수 확인:
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_name = 'prep_note_templates' AND grantee = 'anon';
--   기대: 0건(anon 권한 없음).
--
-- (d) authenticated 권한 확인(기본 권한 존재):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_name = 'prep_note_templates' AND grantee = 'authenticated'
-- ORDER BY privilege_type;
--   기대: SELECT/INSERT/UPDATE/DELETE 존재(행 접근은 RLS 가 추가로 통제).
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Authenticated can view prep_note_templates" ON public.prep_note_templates;
-- DROP POLICY IF EXISTS "events_edit can insert prep_note_templates" ON public.prep_note_templates;
-- DROP POLICY IF EXISTS "events_edit can update prep_note_templates" ON public.prep_note_templates;
-- DROP POLICY IF EXISTS "events_edit can delete prep_note_templates" ON public.prep_note_templates;
-- DROP TABLE IF EXISTS public.prep_note_templates;
-- ============================================================================
