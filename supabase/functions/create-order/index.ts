import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { corsHeaders } from '../_shared/cors.ts'

// SOURCE OF TRUTH: inpsyt-order-frontend/src/utils/pricing.js (getEffectiveRate/getDiscountedUnit) — 케이스는 pricing.test.js. 수정 시 동기화 필수.
// 실효 할인율: discount_override(0 포함) 가 있으면 그 값을 무조건 사용, NULL/undefined(컬럼 부재) 면 is_discountable ? 행사율 : 0.
// ?? 는 null/undefined 만 우측으로 넘김 → override=0 은 0 유지(명시적 정가), override=0.05 는 0.05(행사율보다 낮아도 대체).
function getEffectiveRate(product: any, eventRate: number): number {
  return product.discount_override ?? (product.is_discountable ? eventRate : 0)
}
function getDiscountedUnit(product: any, eventRate: number): number {
  return Math.round((product.list_price || 0) * (1 - getEffectiveRate(product, eventRate)))
}

serve(async (req) => {

  // OPTIONS 요청 처리 (가장 먼저 실행)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 실제 요청 본문 파싱
  const parsedBody = await req.json()
  const {
    customer_name,
    phone_number,
    shipping_address,
    inpsyt_id,
    customer_request,
    cart, // Array of { product_id, quantity }
    event_id,
  } = parsedBody
  // 현장구매 여부 — 미전송(구 프론트) 대비 안전 기본값 false
  const is_on_site_sale = parsedBody.is_on_site_sale ?? false

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 1. Fetch products, event details, and site settings for server-side calculation
    // free_shipping_basis 는 신규 컬럼(무료배송 판정 기준). 미적용 환경에선 이 컬럼을
    // 포함한 select 가 통째로 실패해 threshold/shipping_cost 까지 잃는다 → products 읽기와
    // 같은 graceful fallback: 컬럼 포함 select 실패 시 컬럼 없이 재조회하고, basis 는
    // undefined 로 남겨 아래에서 'list_price'(정가) 폴백을 타게 한다(회귀 0).
    let settings: any = null

    const settingsWithBasis = await supabaseClient
      .from('site_settings')
      .select('free_shipping_threshold, shipping_cost, free_shipping_basis')
      .single()

    if (settingsWithBasis.error) {
      console.warn('free_shipping_basis select 실패 — 컬럼 없이 재조회 fallback:', settingsWithBasis.error.message)
      const { data: fallbackSettings, error: fallbackSettingsError } = await supabaseClient
        .from('site_settings')
        .select('free_shipping_threshold, shipping_cost')
        .single()
      if (fallbackSettingsError) {
        console.error('Settings fetch error:', fallbackSettingsError)
      }
      settings = fallbackSettings
    } else {
      settings = settingsWithBasis.data
    }

    const productIds = cart.map((item: any) => item.product_id)

    // is_active 를 함께 조회 (판매중지 상품 우회 주문 차단).
    // discount_override(품목별 할인율 오버라이드) 도 primary select 에만 포함.
    // is_active / discount_override 컬럼이 없는 환경(마이그레이션 미적용)에서는 select 실패 → 필터 없이 재조회하여 기존 동작 보존.
    let products: any[] | null = null
    let hasIsActive = true

    const withActive = await supabaseClient
      .from('products')
      .select('id, name, product_code, category, list_price, is_discountable, is_active, discount_override, includes_online_code')
      .in('id', productIds)

    if (withActive.error) {
      // is_active / discount_override 컬럼 부재 등으로 실패 시 graceful fallback (회귀 0).
      // 의도적으로 discount_override 를 fallback select 에 넣지 않음 → 컬럼 부재 환경에서
      // product.discount_override 는 undefined → getEffectiveRate 의 ?? 가 null 처럼 처리 → 행사율 로직 유지.
      console.warn('is_active/discount_override select 실패 — 필터 스킵 fallback:', withActive.error.message)
      hasIsActive = false
      const { data: fallbackProducts, error: fallbackError } = await supabaseClient
        .from('products')
        .select('id, name, product_code, category, list_price, is_discountable')
        .in('id', productIds)
      if (fallbackError) throw fallbackError
      products = fallbackProducts
    } else {
      products = withActive.data
    }

    // is_active=false 상품이 하나라도 있으면 전체 거부 (부분 주문 금지)
    if (hasIsActive) {
      const hasInactive = products?.some((p) => p.is_active === false)
      if (hasInactive) {
        return new Response(
          JSON.stringify({
            error: '판매중지된 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.',
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            status: 400,
          }
        )
      }
    }

    // ── 온라인코드 판정 (서버 정본, 한 곳에 모음) ──────────────────────────────
    // 클라이언트 문자열 판정을 신뢰하지 않는다(가격 서버 재계산과 동일 원칙).
    // 프론트 정본은 inpsyt-order-frontend/src/utils/onlineCode.js — 아래와 등가로 유지할 것.
    // 3상태를 존중한다. 단순 OR 합집합이면 명시적 false 를 문자열이 덮어써 버린다 —
    // 실측: 도서 5건('온라인상담개론' 등)이 상품명에 '온라인'을 포함하지만 온라인코드는 없다.
    //   true  → 포함 확정
    //   false → 미포함 확정. 문자열 폴백을 타지 않는다(오탐 차단).
    //   NULL/undefined(미확인·컬럼 부재) → 상품명으로 폴백(기존 동작 보존, 회귀 0)
    const productHasOnlineCode = (p: any): boolean => {
      if (p.includes_online_code === true) return true
      if (p.includes_online_code === false) return false
      return Boolean(p.name && p.name.includes('온라인'))
    }
    const orderHasOnlineCode = (products ?? []).some(productHasOnlineCode)

    // 정책: 소프트 필수(건우님 결정) — inpsyt_id 공란이어도 주문은 정상 생성. 여기서 400 안 함.
    //   판정 지점을 여기 한 곳으로 모아, 추후 하드블록 전환 시 아래 3줄만 주석 해제하면 됨.
    // [HARD BLOCK 전환 지점]
    // const inpsytIdMissing = !inpsyt_id || String(inpsyt_id).trim() === ''
    // if (orderHasOnlineCode && inpsytIdMissing) {
    //   return new Response(JSON.stringify({ error: '온라인코드 상품은 inpsyt 아이디가 필요합니다.' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 })
    // }

    // closed_at(학회 종료 시각)는 신규 컬럼(DRAFT 20261019000200). 미적용 환경에선 이
    // 컬럼을 포함한 select 가 통째로 실패해 주문 생성이 막힌다(학회 중 = 치명적) →
    // products/settings 와 같은 graceful fallback: 컬럼 포함 select 실패 시 컬럼 없이
    // 재조회하고, closed_at 은 undefined 로 남겨 아래 종료 판정을 자동 통과시킨다(회귀 0).
    let event: any = null
    const eventWithClosed = await supabaseClient
      .from('events')
      .select('id, name, discount_rate, closed_at')
      .eq('id', event_id)
      .single()

    if (eventWithClosed.error) {
      console.warn('events.closed_at select 실패 — 컬럼 없이 재조회 fallback:', eventWithClosed.error.message)
      const { data: fallbackEvent, error: fallbackEventError } = await supabaseClient
        .from('events')
        .select('id, name, discount_rate')
        .eq('id', event_id)
        .single()
      if (fallbackEventError) throw fallbackEventError
      event = fallbackEvent
    } else {
      event = eventWithClosed.data
    }

    // 종료된 학회면 주문 생성 거부(링크가 닫힌 뒤의 잔존 탭·북마크 진입 차단).
    // closed_at 이 undefined(컬럼 부재 환경)면 이 분기를 타지 않음 → 기존 동작 보존.
    if (event?.closed_at) {
      return new Response(
        JSON.stringify({ error: '종료된 학회입니다.' }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 400,
        }
      )
    }

    const discountRate = event ? event.discount_rate : 0

    // 2. Recalculate costs on the server-side
    let totalOriginalPrice = 0
    let totalDiscountedPrice = 0

    cart.forEach((item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      if (product) {
        const quantity = item.quantity || 0
        const originalPrice = product.list_price || 0

        totalOriginalPrice += originalPrice * quantity

        // 실효 할인율 재계산(정본 공식). override 우선, 없으면 is_discountable ? 행사율 : 0.
        const discountedPrice = getDiscountedUnit(product, discountRate)
        totalDiscountedPrice += discountedPrice * quantity
      }
    })

    const SHIPPING_FEE = settings?.shipping_cost ?? 3000
    const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 30000
    // 무료배송 판정 기준(설정값). NULL/undefined(미설정·컬럼 부재) → 'list_price'(정가) 폴백.
    // 설정을 안 만지면 정가 기준 = 현행 동작 그대로(회귀 0).
    const freeShippingBasis = settings?.free_shipping_basis ?? 'list_price'

    const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice
    // 무료배송 임계치 판정에 쓰는 합계를 설정(free_shipping_basis)으로 선택한다.
    //   list_price(기본) → 정가(할인 전) 합계 / discounted → 할인가(실결제) 합계.
    // 0원 무료 규칙은 basis 무관 유지. 현장구매는 배송이 없으므로 배송비 무조건 0.
    const basisAmount = freeShippingBasis === 'discounted' ? totalDiscountedPrice : totalOriginalPrice
    const shippingCost = is_on_site_sale
      ? 0
      : basisAmount >= FREE_SHIPPING_THRESHOLD || basisAmount === 0
        ? 0
        : SHIPPING_FEE
    const finalCost = totalDiscountedPrice + shippingCost

    // 3. Insert order and order items
    // orders.has_online_code 는 신규 컬럼이다. Supabase는 프리뷰가 없어 함수 배포가 곧 운영이고,
    // 마이그레이션보다 함수가 먼저 올라가면 이 컬럼 때문에 insert가 전부 실패한다(학회 중 = 치명적).
    // 그래서 배포 순서에 의존하지 않고, 컬럼 부재(42703 / PGRST204)면 그 필드만 빼고 재시도한다.
    // 읽기 쪽 is_active·discount_override의 graceful degrade와 같은 원칙을 쓰기 쪽에 적용한 것.
    // status 를 명시한다. 일반 주문은 항상 'pending'(결제대기)로 생성된다.
    // 과거엔 DB 기본값에 의존해 암묵적으로 pending 이 됐으나, PIN 주문이 'preparing'
    // 이라는 별도 상태를 도입하면서 "일반 주문 = 명시적 pending" 을 코드에 고정한다.
    // (값은 기존과 동일 → 회귀 0. 기본값이 무엇이든 일반 주문은 pending 으로 안전.)
    const baseOrderRow = {
      customer_name,
      phone_number,
      shipping_address,
      inpsyt_id,
      customer_request,
      status: 'pending',
      total_cost: totalOriginalPrice,
      discount_amount: totalDiscountAmount,
      delivery_fee: shippingCost,
      final_payment: finalCost,
      is_on_site_sale,
      event_id,
      status_history: [{ status: 'pending', changed_at: new Date().toISOString() }],
    }

    const insertOrder = (row: any) =>
      supabaseClient.from('orders').insert(row).select().single()

    let { data: newOrder, error: orderError } = await insertOrder({
      ...baseOrderRow,
      has_online_code: orderHasOnlineCode,
    })

    // 컬럼 미적용 환경에서만 재시도. 다른 오류는 그대로 throw 해 삼키지 않는다.
    const isMissingColumn =
      orderError &&
      (orderError.code === '42703' ||
        orderError.code === 'PGRST204' ||
        /has_online_code/i.test(orderError.message || ''))

    if (isMissingColumn) {
      console.warn('orders.has_online_code 컬럼 없음 — 해당 필드 제외하고 재시도(마이그레이션 미적용)')
      const retry = await insertOrder(baseOrderRow)
      newOrder = retry.data
      orderError = retry.error
    }

    if (orderError) throw orderError

    const orderItemsData = cart.map((item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      // 스냅샷 단가도 총액과 동일한 정본 공식으로 계산(override 반영). 상품 미발견 시 0.
      const priceAtPurchase = product ? getDiscountedUnit(product, discountRate) : 0

      return {
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase,
        product_name: product?.name || null,
        product_code: product?.product_code || null,
        category: product?.category || null,
        list_price: product?.list_price || null,
      }
    })

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) throw itemsError

    // 4. 알림톡 연동 예정 (카카오 비즈 채널 심사 통과 후 구현)

    return new Response(JSON.stringify({ success: true, order: newOrder }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    })
  }
})
