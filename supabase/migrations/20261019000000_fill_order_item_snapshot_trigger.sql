-- ============================================================================
-- order_items 상품 스냅샷 누락 방지 트리거 (2026-10-19)
-- ----------------------------------------------------------------------------
-- 배경: 어드민 신규 주문 등록(NewOrderModal)이 order_items 에
--   order_id, product_id, quantity, price_at_purchase 4칸만 insert 하고
--   스냅샷 4칸(product_name, product_code, category, list_price)을 비워 두었다.
--   그 결과 주문 #308·#311·#312·#314 의 10행이 스냅샷 NULL 로 남아
--   입금결의서 집계가 '미분류'로 어긋났다.
--   저장 경로가 여러 곳(create-order Edge Fn / update_order_details·
--   update_order_with_items RPC / OrderSections 직접 insert / NewOrderModal
--   직접 insert)으로 흩어져 있으므로, 경로마다 고치는 대신 테이블 트리거 1개로
--   INSERT 시점에 일괄 보강한다. 이미 스냅샷을 채워 넣는 정상 경로는 값이
--   그대로 통과한다(아래 "값을 바꾸지 않는 이유" 참고).
--
-- 동작:
--   · BEFORE INSERT ON order_items FOR EACH ROW.
--   · NEW.product_id 로 products 1행을 조회해, NEW 의 스냅샷 4칸 중 NULL 인 칸만
--     COALESCE 로 채운다(product_name=name, product_code=product_code,
--     category=category, list_price=list_price).
--   · price_at_purchase 는 절대 건드리지 않는다(주문 시점 확정 단가 = 정본).
--   · product_id 가 NULL 이거나(삭제 상품) products 에 해당 상품이 없으면
--     에러 없이 그대로 통과한다 — 학회 현장 주문이 실패하면 안 되기 때문.
--
-- 값을 바꾸지 않는 이유(정상 경로 영향 없음):
--   · create-order / RPC / OrderSections 는 이미 스냅샷 4칸을 채워 insert 한다.
--     4칸이 모두 NOT NULL 이면 트리거는 products 조회조차 하지 않고 즉시 통과한다.
--   · 설령 조회하더라도 COALESCE(기존값, products값)=기존값 이므로 멱등이다.
--   · price_at_purchase 를 읽거나 쓰지 않으므로 할인·override 로 계산된 단가가
--     list_price(정가)로 덮이는 일은 없다.
--
-- 보안·RLS:
--   · SECURITY DEFINER SET search_path = public — products 를 RLS 와 무관하게
--     조회하기 위함(어드민 직접 insert 경로가 products SELECT 권한이 없어도 동작).
--   · 어떤 RLS 정책도 추가·완화·삭제하지 않는다. 트리거 함수 + 트리거만 만든다.
--
-- 멱등성: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS → 재적용 안전.
--
-- 적용: Supabase 대시보드 SQL Editor 에서 이 파일 전문을 붙여넣고 Run(건우님 승인 후).
--       CLI push 아님.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fill_order_item_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  -- product_id 가 없으면(삭제된 상품 → product_id NULL) 조회할 대상이 없다. 통과.
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 스냅샷 4칸이 모두 채워져 있으면(정상 경로) products 조회 없이 즉시 통과.
  IF NEW.product_name IS NOT NULL
     AND NEW.product_code IS NOT NULL
     AND NEW.category IS NOT NULL
     AND NEW.list_price IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name, product_code, category, list_price
    INTO p
    FROM public.products
   WHERE id = NEW.product_id;

  -- 상품을 못 찾으면(절판·삭제 등) 에러 없이 그대로 통과 — 학회 중 주문 실패 방지.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- NULL 인 칸만 채운다. price_at_purchase 는 절대 건드리지 않는다.
  NEW.product_name := COALESCE(NEW.product_name, p.name);
  NEW.product_code := COALESCE(NEW.product_code, p.product_code);
  NEW.category     := COALESCE(NEW.category, p.category);
  NEW.list_price   := COALESCE(NEW.list_price, p.list_price);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_order_item_snapshot ON public.order_items;
CREATE TRIGGER trg_fill_order_item_snapshot
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_order_item_snapshot();
