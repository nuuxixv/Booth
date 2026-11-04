-- ============================================================================
-- [DRAFT] 이벤트(바우처·배송비 면제) 결제 처리 — 스키마 + RPC
-- File: 20261104000000_DRAFT_voucher_event.sql
-- Date: 2026-11-04
-- Author: backend-engineer (CTO 위임 지시서 / 이벤트 결제수단 트랙)
-- 근거: design-system/specs/A13_VoucherEvent.md §데이터 모델, §배포 순서
--
-- [목적]
--   "이벤트 ON 학회의 결제완료 처리"에 필요한 컬럼 4개 + 고객 조회 RPC 확장.
--     · events.voucher_enabled   — 학회별 이벤트 적용 토글(기존 학회 전부 false = 현행)
--     · orders.voucher_amount    — 그 주문에서 받은 바우처 합계(원). 결제수단(할인 아님).
--     · orders.shipping_waived   — 이벤트로 배송비를 면제했는지(임계 무료배송과 구분)
--     · site_settings.voucher_config — 용어·숫자 버튼·단위 버튼 설정(NULL=코드 기본값)
--   그리고 get_order_by_token 에 위 3개 노출 필드만 추가한다(고객 주문 상태 화면용).
--
-- [바우처 = 결제수단 모델 (A13 §확정)]
--   주문 매출(final_payment)은 그대로 두고 그 안을 "카드 + 바우처"로 나눈다.
--   카드 결제액(파생, 저장 안 함) = final_payment - voucher_amount.
--   배송비 면제는 별개의 "실제 할인"이라 delivery_fee=0 / final_payment 감소로 반영된다
--   (shipping_waived 는 그 사실을 표시하는 boolean 표지일 뿐, 금액은 delivery_fee 경로로 자연 반영).
--
-- [⚠ orders 에 NOT NULL 을 걸지 않는 이유 — 중요]
--   운영 Supabase 의 orders 에는 repo 마이그레이션에 없는 제약이 존재하며
--   (reference_prod_schema_drift: customer_name NOT NULL 사고 전례), create-order Edge
--   Function 등 기존 INSERT 경로는 이 신규 컬럼들을 전혀 모른다. 여기에 NOT NULL 을 걸면
--   그 쓰기 경로들이 전부 깨진다. 따라서 voucher_amount / shipping_waived 는 NULL 허용 +
--   DEFAULT 로만 둔다. 코드는 voucher_amount 를 `|| 0`, shipping_waived 를 falsy 로 읽는다.
--   상한 불변식(0 <= voucher_amount <= final_payment)의 상한은 화면에서 막고, DB CHECK 는
--   하한만 건다(기존 행 데이터와 무관하게 안전히 적용하기 위함).
--
-- [events.voucher_enabled 는 NOT NULL 허용 — orders 와 다른 이유]
--   events 는 학회 폼(EVENT_DETAIL_COLUMNS 라운드트립)이 유일한 쓰기 경로이고 곧 이 컬럼을
--   항상 포함하도록 갱신된다. 또 "이벤트 적용 여부"는 true/false 2상태만 의미가 있고 NULL=미정이
--   불필요하다. DEFAULT false + NOT NULL 이면 기존 학회는 전부 false(= 현행과 동일)로 채워진다.
--   ADD COLUMN ... NOT NULL DEFAULT false 는 상수 DEFAULT 라 테이블 재작성 없이 즉시 적용(PG11+).
--
-- [anon 노출]
--   events 의 anon 권한은 "컬럼 단위 GRANT 화이트리스트" 방식이라(20260616010000 가 최신,
--   20261019000200 가 closed_at 덧붙임), voucher_enabled 를 명시적으로 GRANT 하지 않으면
--   anon(고객 주문서)이 못 읽는다. 기존 화이트리스트 GRANT 문을 통째로 다시 쓰지 말고
--   `GRANT SELECT (voucher_enabled)` 한 줄로 "덧붙이기"만 한다(누적되므로 기존 컬럼은 유지).
--   존재하지 않는 DRAFT 컬럼을 목록에 넣어 GRANT 문 전체가 실패하는 사고를 피한다.
--   admin(authenticated)은 테이블 레벨 SELECT(20260616010000)라 신규 컬럼도 자동으로 읽힌다.
--
--   orders.voucher_amount / shipping_waived 는 anon 이 orders 를 PostgREST 로 직접 읽지 않고
--   get_order_by_token(SECURITY DEFINER)로만 읽으므로 컬럼 GRANT 불필요. authenticated 는
--   테이블 레벨 SELECT 로 자동 노출.
--
--   site_settings 는 컬럼 레벨 GRANT/REVOKE 가 전혀 없어(테이블 전체 SELECT) voucher_config 가
--   별도 GRANT 없이 anon/authenticated 에게 자동 노출된다. 민감정보 아님(용어·버튼 설정).
--   UPDATE 는 기존 "Admins can update site_settings"(master 권한) 정책을 신규 컬럼이 상속.
--
-- [RLS — 무영향]  어떤 테이블의 행 정책도 생성/변경/삭제하지 않는다. 컬럼 + 컬럼 GRANT + RPC 재정의만.
--
-- [RPC get_order_by_token]
--   직전 최신 정의 20260708000800 본문을 한 글자도 바꾸지 않고(확인: 이후 재정의 없음)
--   아래 3개만 추가한다 — 본인 주문 필드에 voucher_amount·shipping_waived, events 객체에
--   voucher_enabled. 함수 속성(LANGUAGE sql, SECURITY DEFINER, STABLE, SET search_path=public)과
--   GRANT EXECUTE TO anon, authenticated 유지. 응답 top-level 키는 17 → 19개로 늘어난다
--   (voucher_enabled 는 events 객체 내부라 top-level 아님).
--
-- ----------------------------------------------------------------------------
-- ▣ 적용 가이드 (자체 완결 — 이 블록만 보고 적용 가능)
-- ----------------------------------------------------------------------------
--   어디에: Supabase Dashboard → 좌측 메뉴 SQL Editor → New query
--   무엇을: 이 파일의 "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 복사해 붙여넣기.
--           (상단 주석·하단 검증 쿼리/롤백 주석은 실행에 영향 없음 — 통째로 붙여도 무방)
--   몇 개: SQL 세트 1개. 컬럼 4개 추가 + GRANT 1개 + CHECK 1개 + RPC 재정의 1개 + GRANT 1개.
--          위에서 아래로 한 번에 실행하면 되고 실행 순서 고민 불필요.
--   실행: 우측 하단 Run(또는 Ctrl+Enter) 1회. "Success. No rows returned" 나오면 정상.
--   repo 원본 경로: supabase/migrations/20261104000000_DRAFT_voucher_event.sql
--
--   ※ 본 에이전트는 적용하지 않음. 건우님이 SQL Editor 에서 수동 실행.
--
-- [적용 순서 — 필수]
--   1) 이 파일을 먼저 적용하고 아래 [검증 쿼리] 로 컬럼 4개·GRANT·RPC 키 19개를 확인한다.
--   2) 그 다음 프론트 PR 을 머지한다(Vercel 자동 배포).
--      프론트가 voucher_amount 를 select 하므로, 마이그레이션 전에 머지하면 컬럼 미존재로
--      대시보드·학회 상세 매출 조회가 실패한다.
--   3) Edge Function 변경 없음(create-order·send-alimtalk 무변경, 배포 불필요).
--
-- [멱등성]  ADD COLUMN IF NOT EXISTS + CHECK drop-then-add + GRANT + CREATE OR REPLACE.
--           전부 반복 안전. 재실행 무에러.
--
-- [운영 중 적용 안전성]
--   ADD COLUMN(상수 DEFAULT 또는 DEFAULT 없음)은 PG11+ 에서 테이블 재작성 없이 즉시(메타데이터만).
--   CHECK 추가 시 기존 orders 행을 한 번 스캔하지만(ACCESS EXCLUSIVE 짧게), 하한 조건이라
--   기존 데이터(대부분 NULL/양수)가 걸릴 일은 사실상 없다. 서비스 규모(연 800건)라 잠금/부하 무시 가능.
-- ============================================================================


-- ===== 실행 SQL 시작 =========================================================

-- 1) events.voucher_enabled — 학회별 이벤트 적용 토글
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS voucher_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.voucher_enabled IS
  '이벤트(바우처·배송비 면제) 적용 여부. false=현행(일반 결제완료), true=결제완료 처리 시 바우처/배송비 면제 창. '
  '기존 학회는 DEFAULT false 로 채워져 회귀 0. anon 노출(고객 안내 문구 판정용, 무해한 boolean).';

-- anon 화이트리스트에 voucher_enabled "추가"(기존 컬럼 GRANT 는 건드리지 않음 — 누적됨).
GRANT SELECT (voucher_enabled) ON public.events TO anon;

-- 2) orders.voucher_amount — 바우처 합계(원). 결제수단(할인 아님). NULL 허용 + DEFAULT 0.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS voucher_amount integer DEFAULT 0;

-- CHECK 는 "CHECK IF NOT EXISTS" 미지원 → drop-then-add 로 멱등 보장.
-- 하한(>=0)만 건다. 상한(<= final_payment)은 화면에서 막는다(기존 행과 무관하게 안전 적용).
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_voucher_amount_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_voucher_amount_check
  CHECK (voucher_amount IS NULL OR voucher_amount >= 0);

COMMENT ON COLUMN public.orders.voucher_amount IS
  '이벤트 바우처로 받은 금액 합계(원). 결제수단 — final_payment(매출)에 포함, 카드 결제액 = final_payment - voucher_amount. '
  'NULL 허용(기존 INSERT 경로 보호), 코드는 || 0 으로 읽음. 상한(<= final_payment)은 화면에서 막음.';

-- 3) orders.shipping_waived — 이벤트 배송비 면제 표지. NULL 허용 + DEFAULT false.
--    orders 에 NOT NULL 을 걸지 않는 이유: 운영 스키마 드리프트(repo 미기록 제약 존재) +
--    create-order 등 기존 INSERT 경로가 이 컬럼을 모른다 → NOT NULL 이면 그 경로가 깨진다.
--    DEFAULT false 로 기존 행은 false 로 채워지고, 코드는 falsy 로 읽는다.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_waived boolean DEFAULT false;

COMMENT ON COLUMN public.orders.shipping_waived IS
  '이벤트로 배송비를 면제했는지. 임계 무료배송(delivery_fee=0 자연 발생)과 구분하는 표지. '
  '면제 시 delivery_fee=0·final_payment 감소로 금액 반영(이 컬럼은 boolean 표지일 뿐). NULL 허용(기존 INSERT 경로 보호).';

-- 4) site_settings.voucher_config — 용어·숫자·단위 설정. NULL 허용, DEFAULT 없음(NULL=코드 기본값).
--    DEFAULT 를 주면 단일 행(id=1)이 그 값으로 즉시 바뀌어 "미설정=코드 기본값" 불변이 깨진다.
--    site_settings 는 컬럼 GRANT 가 없어(테이블 전체 SELECT) anon/authenticated 자동 노출,
--    UPDATE 는 기존 master 정책("Admins can update site_settings") 상속 → 추가 GRANT/정책 불필요.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS voucher_config jsonb;

COMMENT ON COLUMN public.site_settings.voucher_config IS
  '이벤트 결제수단 설정 { label, digits:[int], units:[{label,value}] }. NULL=코드 기본값(바우처·1~5·만천백). '
  '설정 탭(id=1 단일 행)에서 편집. anon/authenticated 자동 노출(테이블 전체 SELECT), UPDATE 는 master 정책 상속.';

-- 5) get_order_by_token 재정의
--    직전 최신 정의 20260708000800 본문을 한 글자도 바꾸지 않고(이후 재정의 없음 확인) 3개만 추가:
--      · 본인 주문 필드: d.voucher_amount, d.shipping_waived
--      · events json_build_object: 'voucher_enabled', e.voucher_enabled
--    함수 속성·GRANT 유지. 합배송 파생(is_grouped/representative_name/co_recipient_names)·PII 차단 로직은 불변.
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- 1) 토큰 주인 order 식별 (껍데기도 유효 access_token 을 보유 — 엣지 C 실재)
  WITH tok AS (
    SELECT o.id, o.parent_order_id, o.is_group_parent, o.representative_child_id
    FROM orders o
    WHERE o.access_token = p_token
  ),
  -- 2) "표시 대상 order" 결정:
  --      껍데기(is_group_parent) → 대표 자식(representative_child_id)  [엣지 C]
  --                                (NULL 이면 표시 대상 없음 → 최종 결과 없음)
  --      자식/단일               → 본인
  target AS (
    SELECT
      CASE
        WHEN t.is_group_parent THEN t.representative_child_id
        ELSE t.id
      END AS display_id
    FROM tok t
  )
  SELECT row_to_json(result)
  FROM (
    SELECT
      -- ── 본인(표시 대상) 주문 필드 ── (000800 과 동일 + voucher_amount·shipping_waived 추가)
      d.id,
      d.customer_name,
      d.phone_number,
      d.shipping_address,
      d.final_payment,
      d.delivery_fee,
      d.status,
      d.created_at,
      d.customer_request,
      d.is_on_site_sale,
      d.status_history,
      d.voucher_amount,
      d.shipping_waived,
      -- ── events (공개 8컬럼 + voucher_enabled) ──
      (
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue,
          'voucher_enabled', e.voucher_enabled
        )
        FROM events e
        WHERE e.id = d.event_id
      ) AS events,
      -- ── order_items — 000700 과 동일 구조(본인 주문 품목만) ──
      (
        SELECT json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'price_at_purchase', oi.price_at_purchase,
            'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
          )
        )
        FROM order_items oi
        WHERE oi.order_id = d.id
      ) AS order_items,
      -- ── 합배송 파생 필드 ──
      --      g = 표시 대상의 껍데기(부모, is_group_parent). 단일 주문은 g 없음 → is_grouped=false.
      --      r = 대표 자식(r.id = g.representative_child_id). 대표명·연락처의 "실값" 소스.
      --          (스냅샷 g.customer_name 이 아니라 r 을 써야 대표 재위임에 정합)
      (g.id IS NOT NULL)                                        AS is_grouped,
      (g.id IS NOT NULL AND d.id = g.representative_child_id)   AS is_representative,
      -- representative_name: 비대표 & "대표가 본인과 다른 연락처" 일 때만 대표명, 아니면 NULL.
      --   · 분기 2(비대표·대표 타인)      → 대표명(string)
      --   · 분기 4(비대표·대표 본인연락처) → NULL   (본인 이름 노출 방지 → "묶음배송 예정입니다.")
      --   · 대표 본인 화면 / 단일 주문     → NULL
      --   연락처 비교는 함수 내부에서만; 응답엔 이름(text)만.
      CASE
        WHEN NOT (g.id IS NOT NULL AND d.id = g.representative_child_id)
         AND r.phone_number IS DISTINCT FROM d.phone_number
        THEN r.customer_name
        ELSE NULL
      END                                                       AS representative_name,
      -- co_recipient_names: 대표(is_representative) 화면일 때만, 본인 연락처와 "다른" 참여자
      --   이름을 distinct·정렬로 나열(분기 3). 취소/환불 제외. 동일인(본인 재주문분) 제외.
      --   비대표 화면이면 빈 배열(text[]) — 비대표에 타인 명단을 내리지 않는다(PII 차단).
      CASE
        WHEN (g.id IS NOT NULL AND d.id = g.representative_child_id) THEN (
          SELECT coalesce(array_agg(DISTINCT c.customer_name ORDER BY c.customer_name), '{}'::text[])
          FROM orders c
          WHERE c.parent_order_id = g.id
            AND c.status NOT IN ('cancelled', 'refunded')
            AND c.phone_number IS DISTINCT FROM d.phone_number
        )
        ELSE '{}'::text[]
      END                                                       AS co_recipient_names
    FROM target tg
    JOIN orders d ON d.id = tg.display_id
    LEFT JOIN orders g
      ON g.id = d.parent_order_id
     AND g.is_group_parent = true
    LEFT JOIN orders r
      ON r.id = g.representative_child_id
  ) result;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ============================================================================
-- [검증 쿼리] 적용 후 SQL Editor 에서 실행해 확인.
-- ----------------------------------------------------------------------------
-- (a) 컬럼 4개 존재·속성:
-- SELECT table_name, column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND ( (table_name='events'        AND column_name='voucher_enabled')
--      OR (table_name='orders'        AND column_name IN ('voucher_amount','shipping_waived'))
--      OR (table_name='site_settings' AND column_name='voucher_config') )
-- ORDER BY table_name, column_name;
--   기대: events.voucher_enabled    = boolean, is_nullable=NO,  default=false
--         orders.shipping_waived    = boolean, is_nullable=YES, default=false
--         orders.voucher_amount     = integer, is_nullable=YES, default=0
--         site_settings.voucher_config = jsonb, is_nullable=YES, default=NULL
--
-- (b) orders CHECK(하한) 존재:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid='public.orders'::regclass AND conname='orders_voucher_amount_check';
--   기대: CHECK ((voucher_amount IS NULL) OR (voucher_amount >= 0))
--
-- (c) anon 이 voucher_enabled 를 읽을 수 있고 기존 화이트리스트가 보존됐는지:
-- SELECT grantee, column_name
-- FROM information_schema.role_column_grants
-- WHERE table_name='events' AND grantee='anon'
-- ORDER BY column_name;
--   기대: 기존 컬럼(id,name,discount_rate,tags,start_date,end_date,
--         estimated_delivery_date,order_url_slug,venue,created_at,closed_at) + voucher_enabled.
--         attendee_ids/note/marketing_cost 등은 여전히 부재(비노출 유지).
--
-- (d) site_settings.voucher_config 는 anon/authenticated 에 테이블 레벨로 노출(컬럼 GRANT 없음):
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name='site_settings' AND privilege_type='SELECT' AND grantee IN ('anon','authenticated')
-- ORDER BY grantee;
--   기대: anon, authenticated 각각 SELECT 보유(테이블 레벨 → 신규 컬럼 자동 노출).
--
-- (e) get_order_by_token shape 회귀 — 키 집합 점검(정확히 19키):
-- SELECT jsonb_object_keys(public.get_order_by_token('<토큰>'::uuid)::jsonb) ORDER BY 1;
--   기대 키(정확히 이 집합, 19개):
--     co_recipient_names, created_at, customer_name, customer_request, delivery_fee,
--     events, final_payment, id, is_grouped, is_on_site_sale, is_representative,
--     order_items, phone_number, representative_name, shipping_address, shipping_waived,
--     status, status_history, voucher_amount
--   (voucher_enabled 는 events 객체 내부 키 — top-level 아님. events 값 안에서 확인.)
--
-- (f) 이벤트 ON 학회의 주문 토큰 → events 객체에 voucher_enabled=true, 본인 필드에 바우처 2종:
-- SELECT public.get_order_by_token('<이벤트 ON 학회 주문 access_token>'::uuid);
--   기대: events.voucher_enabled=true, voucher_amount(숫자 또는 0), shipping_waived(boolean).
-- ============================================================================

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- -- RPC 는 20260708000800 함수 본문을 CREATE OR REPLACE 로 재실행하면 이전 동작으로 복귀.
-- REVOKE SELECT (voucher_enabled) ON public.events FROM anon;
-- ALTER TABLE public.events        DROP COLUMN IF EXISTS voucher_enabled;
-- ALTER TABLE public.orders        DROP CONSTRAINT IF EXISTS orders_voucher_amount_check;
-- ALTER TABLE public.orders        DROP COLUMN IF EXISTS voucher_amount;
-- ALTER TABLE public.orders        DROP COLUMN IF EXISTS shipping_waived;
-- ALTER TABLE public.site_settings DROP COLUMN IF EXISTS voucher_config;
--   (주의: 결제완료된 이벤트 주문의 바우처 금액·면제 표지가 영구 소실된다. 데이터 백업 후 진행.)
-- ============================================================================
