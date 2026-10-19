-- ============================================================================
-- order_items 과거 상품 스냅샷 백필 (2026-10-19)
-- ============================================================================
-- 무엇: order_items 의 비어 있는 스냅샷 4칸(product_name, product_code,
--       category, list_price)을 현재 products 값으로 채운다.
--       NULL 인 칸만 COALESCE 로 채우고, price_at_purchase 는 절대 건드리지 않는다.
--
-- 왜: 어드민 신규 주문 등록이 스냅샷 4칸을 비워 insert 해, 입금결의서 집계가
--     '미분류'로 어긋났다. 앞으로의 insert 는 트리거
--     (20261019000000_fill_order_item_snapshot_trigger.sql)가 막고,
--     이미 쌓인 과거 행은 이 백필로 보강한다.
--
-- 어디서·어떻게: Supabase 대시보드 → SQL Editor.
--   SQL Editor 는 "한 번에 Run" 하면 맨 마지막 결과만 보여 준다. 따라서
--   아래 STEP 블록을 "하나씩 블록을 드래그 선택해서" 순서대로 Run 한다.
--     ① STEP 1 (실행 전 확인) 블록만 선택 → Run → 결과를 눈으로 확인
--     ② STEP 2 (백필 UPDATE) 블록만 선택 → Run → "UPDATE n" 확인
--     ③ STEP 3 (실행 후 확인) 블록만 선택 → Run → 남은 행(있으면 사유)을 확인
--
-- 멱등: NULL 인 칸만 채우므로 재실행하면 STEP 2 는 0행(UPDATE 0)이 된다.
--
-- 예상 결과(2026-10-19 실측 기준):
--   STEP 1 — 스냅샷이 하나라도 빈 행 = 47행.
--     · all4_null = 10 (이번 학회 주문 4건 #308·#311·#312·#314: 4칸 모두 빔)
--     · only_code_null = 37 (#123·#155·#268 등 9건: 상품코드만 빔, products엔 코드 있음)
--     · unfillable(채울 수 없음) = 0 이면 전부 복구 가능.
--   STEP 2 — UPDATE 47 (채울 수 있는 행 수만큼). 재실행 시 UPDATE 0.
--   STEP 3 — 0행이면 완전 복구. 행이 남으면 reason 컬럼으로 원인 확인
--            (product_id 없음=상품 삭제됨 / products에 상품 없음).
-- ============================================================================


-- ── STEP 1. 실행 전 확인 ──────────────────────────────────────────────────
-- (A) 빈 칸 종류별 건수. 이 블록만 선택해 Run.
SELECT
  count(*)                                                          AS empty_rows_total,
  count(*) FILTER (WHERE product_name IS NULL)                      AS name_null,
  count(*) FILTER (WHERE product_code IS NULL)                      AS code_null,
  count(*) FILTER (WHERE category     IS NULL)                      AS category_null,
  count(*) FILTER (WHERE list_price   IS NULL)                      AS list_price_null,
  count(*) FILTER (WHERE product_name IS NULL AND product_code IS NULL
                     AND category IS NULL AND list_price IS NULL)   AS all4_null,
  count(*) FILTER (WHERE product_code IS NULL AND product_name IS NOT NULL) AS only_code_null
FROM public.order_items
WHERE product_name IS NULL OR product_code IS NULL
   OR category IS NULL OR list_price IS NULL;

-- (B) 그중 지금 채울 수 없는 행(상품 삭제 등)이 있는지. 이 블록만 선택해 Run.
--     unfillable 가 0 이면 STEP 2 로 전부 복구된다.
SELECT
  count(*)                                                       AS empty_rows,
  count(*) FILTER (WHERE oi.product_id IS NULL)                  AS product_id_null,
  count(*) FILTER (WHERE oi.product_id IS NOT NULL AND p.id IS NULL) AS product_missing,
  count(*) FILTER (WHERE oi.product_id IS NULL
                     OR  p.id IS NULL)                           AS unfillable
FROM public.order_items oi
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE oi.product_name IS NULL OR oi.product_code IS NULL
   OR oi.category IS NULL OR oi.list_price IS NULL;


-- ── STEP 2. 백필 UPDATE (NULL 인 칸만 COALESCE, 멱등) ────────────────────────
-- 이 블록만 선택해 Run. 결과 표시줄에 "UPDATE n" 이 뜬다(예상: 47).
-- price_at_purchase 는 SET 에 없다 → 절대 바뀌지 않는다.
UPDATE public.order_items oi
SET
  product_name = COALESCE(oi.product_name, p.name),
  product_code = COALESCE(oi.product_code, p.product_code),
  category     = COALESCE(oi.category,     p.category),
  list_price   = COALESCE(oi.list_price,   p.list_price)
FROM public.products p
WHERE oi.product_id = p.id
  AND (oi.product_name IS NULL OR oi.product_code IS NULL
    OR oi.category IS NULL OR oi.list_price IS NULL);


-- ── STEP 3. 실행 후 확인 ──────────────────────────────────────────────────
-- 이 블록만 선택해 Run. 0행이면 완전 복구.
-- 행이 남으면 reason 으로 원인을 본다(대상 상품이 삭제돼 채울 수 없는 경우).
SELECT
  oi.order_id,
  oi.product_id,
  (oi.product_name IS NULL) AS name_null,
  (oi.product_code IS NULL) AS code_null,
  (oi.category     IS NULL) AS category_null,
  (oi.list_price   IS NULL) AS list_price_null,
  CASE
    WHEN oi.product_id IS NULL THEN 'product_id 없음(상품 삭제됨 — 수동 보정 필요)'
    WHEN p.id IS NULL          THEN 'products 에 상품 없음(수동 보정 필요)'
    ELSE '채울 수 있었는데 남음(이상 — 재확인)'
  END AS reason
FROM public.order_items oi
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE oi.product_name IS NULL OR oi.product_code IS NULL
   OR oi.category IS NULL OR oi.list_price IS NULL
ORDER BY oi.order_id, oi.product_id;
