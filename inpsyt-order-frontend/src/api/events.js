import { supabase } from '../supabaseClient';

/**
 * 모든 학회 목록을 이름순으로 가져옵니다.
 * @returns {Promise<Array>} 학회 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    // end_date·closed_at = PIN 주문 생성의 "진행 중 학회" 자동 선택·상태 뱃지용(+NewOrderModal 상태 뱃지).
    // sortEventsForDropdown은 start_date만 쓰므로 컬럼 추가 영향 없음.
    .select('id, name, discount_rate, tags, host_society, start_date, end_date, closed_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data;
};

/**
 * 학회 목록 관리(societies)에 등록된 학회를 이름순으로 가져옵니다.
 * 상품 관리 태그 옵션·학회 드롭다운 등에서 소비.
 * @returns {Promise<Array>} societies 행 배열(id, name, slug_prefix)
 * @throws {Error} 조회 실패 시 에러
 */
export const getSocieties = async () => {
  const { data, error } = await supabase
    .from('societies')
    .select('id, name, slug_prefix')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching societies:', error);
    throw error;
  }

  return data || [];
};

// L2 학회 상세에서 쓰는 events 단건 컬럼 집합.
// 목록(EventManagementPage)이 fetch하는 운영 필드 + 신규(진행상태 3 boolean·prep_note).
// anon 비노출 컬럼이 포함되므로 authenticated 컨텍스트(어드민)에서만 호출.
// 2026-10-12 학회 개선 트랙 2차: setup_time·teardown_time·venue_name·venue_address·venue_detail 추가.
// 라운드트립 소거 방지(2026-06-25 사고) — 편집 폼이 이 응답으로 초기화되므로 신규 5컬럼 필수.
const EVENT_DETAIL_COLUMNS =
  'id, name, discount_rate, order_url_slug, start_date, end_date, estimated_delivery_date, ' +
  'event_year, host_society, event_season, status, venue, attendee_ids, note, marketing_cost, ' +
  'draft_done, application_done, payment_resolution_done, prep_note, created_by, visible_categories, ' +
  'setup_time, teardown_time, venue_name, venue_address, venue_detail, closed_at';

/**
 * order_url_slug 로 학회 1건을 가져옵니다. (L2 학회 상세)
 * @param {string} slug - events.order_url_slug
 * @returns {Promise<object|null>} 학회 1행. 없으면 null.
 * @throws {Error} 조회 실패(미존재 제외) 시 에러
 */
export const getEventBySlug = async (slug) => {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_DETAIL_COLUMNS)
    .eq('order_url_slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching event by slug:', error);
    throw error;
  }
  return data || null;
};

/**
 * 진행상태 플래그(기안/신청/지결) 한 건을 업데이트합니다. (events:edit)
 * @param {string} eventId
 * @param {{ draft_done?: boolean, application_done?: boolean, payment_resolution_done?: boolean }} patch
 * @throws {Error} 업데이트 실패 시
 */
export const updateEventProgress = async (eventId, patch) => {
  const { error } = await supabase.from('events').update(patch).eq('id', eventId);
  if (error) {
    console.error('Error updating event progress:', error);
    throw error;
  }
};

/**
 * 준비 노트(통합 에디터 HTML 본문)를 저장합니다. (events:edit)
 * @param {string} eventId
 * @param {string} prepNote - getHTML() 결과
 * @throws {Error} 저장 실패 시
 */
export const updateEventPrepNote = async (eventId, prepNote) => {
  const { error } = await supabase.from('events').update({ prep_note: prepNote }).eq('id', eventId);
  if (error) {
    console.error('Error updating event prep note:', error);
    throw error;
  }
};

/**
 * 이 학회의 매출 집계용 주문을 가져옵니다.
 * computeRevenueByCategory 입력 형태 — status·delivery_fee·order_items(category·가격·수량).
 * (DashboardPage 입금결의서 select 구조 정합 — paid 필터는 util이 수행.)
 * @param {string} eventId
 * @returns {Promise<Array>} 주문 배열
 * @throws {Error} 조회 실패 시
 */
export const getOrdersForEventRevenue = async (eventId) => {
  if (!eventId) return [];
  const { data, error } = await supabase
    .from('orders')
    // 합배송 껍데기 부모 제외(설계 §7) — 실 매출은 자식 order_items 기반.
    .select('status, delivery_fee, is_group_parent, order_items(product_id, category, price_at_purchase, quantity)')
    .eq('is_group_parent', false)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching orders for event revenue:', error);
    throw error;
  }
  return data || [];
};

/**
 * L2 진입 열람 기록 — RPC `record_event_view`(upsert: 최초/최근 시각·횟수).
 * 테이블 미적용 환경이면 throw — 호출부가 무시(페이지 차단 금지).
 * @param {number} eventId - events.id (bigint)
 */
export const recordEventView = async (eventId) => {
  if (!eventId) return;
  const { error } = await supabase.rpc('record_event_view', { p_event_id: eventId });
  if (error) throw error;
};

/**
 * 열람 이력 + 열람자 프로필(이름·직급). SELECT는 RLS로 master만 허용.
 * 미적용 환경/비-master면 throw — 호출부가 섹션 숨김.
 * @param {number} eventId
 * @returns {Promise<Array<{user_id, first_viewed_at, last_viewed_at, view_count, name, position}>>}
 */
export const getEventViewers = async (eventId) => {
  if (!eventId) return [];
  const { data, error } = await supabase
    .from('event_views')
    .select('user_id, first_viewed_at, last_viewed_at, view_count')
    .eq('event_id', eventId)
    .order('last_viewed_at', { ascending: false });
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) return rows;

  // 탈퇴/삭제 계정은 프로필 미존재 → name null ("(삭제)" 표기는 UI 몫)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name, position')
    .in('id', rows.map((r) => r.user_id));
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    name: byId[r.user_id]?.name || null,
    position: byId[r.user_id]?.position || '',
  }));
};

// ─── 준비노트 템플릿(prep_note_templates) CRUD — A12 ───────────────
// 전용 테이블(events.prep_note 와 별개). 적용 = 본문을 노트에 복사하는 "씨앗".
// RLS: SELECT authenticated / 쓰기 events:edit. updated_at 자동 트리거 없음 → 앱이 명시 전송.

/**
 * 준비노트 템플릿 목록(updated_at 내림차순). body_html 포함 로드(행 수 적음 — 적용·수정 시 추가 왕복 없음).
 * @returns {Promise<Array<{id, name, body_html, updated_at}>>}
 * @throws {Error} 조회 실패 시(테이블 미적용 포함) — 호출부가 graceful 처리
 */
export const getPrepNoteTemplates = async () => {
  const { data, error } = await supabase
    .from('prep_note_templates')
    .select('id, name, body_html, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Error fetching prep note templates:', error);
    throw error;
  }
  return data || [];
};

/**
 * 준비노트 템플릿 생성. created_by = DB default(auth.uid()).
 * @param {{ name: string, body_html: string }} patch
 * @throws {Error} 저장 실패 시
 */
export const createPrepNoteTemplate = async ({ name, body_html }) => {
  const { error } = await supabase.from('prep_note_templates').insert([{ name, body_html }]);
  if (error) {
    console.error('Error creating prep note template:', error);
    throw error;
  }
};

/**
 * 준비노트 템플릿 수정. updated_at 자동 트리거가 없어 앱이 함께 전송한다(마이그레이션 주석 참조).
 * @param {number} id
 * @param {{ name: string, body_html: string }} patch
 * @throws {Error} 저장 실패 시
 */
export const updatePrepNoteTemplate = async (id, { name, body_html }) => {
  const { error } = await supabase
    .from('prep_note_templates')
    .update({ name, body_html, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Error updating prep note template:', error);
    throw error;
  }
};

/**
 * 준비노트 템플릿 삭제. 이미 적용된 events.prep_note 에는 영향 없음(복사 씨앗 모델).
 * @param {number} id
 * @throws {Error} 삭제 실패 시
 */
export const deletePrepNoteTemplate = async (id) => {
  const { error } = await supabase.from('prep_note_templates').delete().eq('id', id);
  if (error) {
    console.error('Error deleting prep note template:', error);
    throw error;
  }
};
