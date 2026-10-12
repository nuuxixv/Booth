/**
 * 행사(events) 폼 순수 로직 — EventFormDialog / EventCreatePage 공용.
 * 상수·자동조립·slug·저장 정규화를 UI에서 분리해 테스트 가능하게 추출(2026-07-20).
 * 값은 EventFormDialog.jsx 원본과 1:1 등가.
 */

// 판매 대분류 — 고정 3종(products.category 도메인과 동일). 소분류는 여기서 선택하지 않음.
export const VISIBLE_CATEGORY_OPTIONS = ['검사', '도서', '도구'];

export const SEASON_OPTIONS = ['춘계학술대회', '추계학술대회', '연수강좌', '보수교육', '세미나', '기타'];
export const SEASON_SLUG_MAP = {
  '춘계학술대회': 'spring', '추계학술대회': 'fall', '연수강좌': 'training',
  '보수교육': 'edu', '세미나': 'seminar', '기타': 'etc',
};

// 폼이 관리하는 컬럼만 upsert (L2의 prep_note·진행상태 등 동시 편집 컬럼 오염 방지).
// 2026-10-12 학회 개선 트랙 2차: setup_time·teardown_time·venue_name·venue_address·venue_detail 추가.
// 기존 venue는 deprecated 존치(지불증·라운드트립 폴백) — payload에 계속 포함해 기존 값 보존.
// ★5컬럼은 FORM_FIELDS·emptyEvent·EVENT_DETAIL_COLUMNS·목록 select에 전부 반영해야 함(2026-06-25 값 소거 사고 방지).
export const FORM_FIELDS = [
  'name', 'discount_rate', 'order_url_slug', 'start_date', 'end_date', 'estimated_delivery_date',
  'event_year', 'host_society', 'event_season', 'venue', 'attendee_ids', 'note', 'marketing_cost',
  'visible_categories',
  'setup_time', 'teardown_time', 'venue_name', 'venue_address', 'venue_detail',
];
export const DATE_FIELDS = ['start_date', 'end_date', 'estimated_delivery_date'];

export const emptyEvent = () => ({
  name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '',
  estimated_delivery_date: '', event_year: new Date().getFullYear(), host_society: '',
  event_season: '', venue: '', attendee_ids: [], note: '', marketing_cost: null,
  visible_categories: [],
  setup_time: '', teardown_time: '', venue_name: '', venue_address: '', venue_detail: '',
});

// 행사 구분 → 영문 slug 조각. 목록 외 직접 입력은 'etc'.
export const seasonToEng = (season) => SEASON_SLUG_MAP[season] || 'etc';

// 행사명 조립: "{연도} {주최학회} {행사구분}".
export const assembleEventName = (year, society, season) => `${year} ${society} ${season}`;

// 주문 URL 조립: "{접두어}-{연도}-{season_eng}-{token}". token은 주소 추측 방지용 랜덤 4자리.
export const buildOrderSlug = ({ slugPrefix, year, season, token }) =>
  `${slugPrefix || 'event'}-${year}-${seasonToEng(season)}-${token}`;

// 랜덤 slug 토큰(4자리) — 랜덤성을 여기 격리해 조립 로직은 순수하게 테스트.
export const genSlugToken = () => Math.random().toString(36).slice(2, 6);

// 행사명 → slug 폴백: 소문자·공백→하이픈·허용문자 외 제거.
export const nameToSlug = (name) =>
  (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const isValidSlug = (slug) => SLUG_REGEX.test(slug || '');

// 할인율 단위 변환 — UI는 0~100 정수, DB는 /100한 소수.
// rateToPercent는 클램프하지 않는다 — 기존 이상값(예 1.11→111%)을 그대로 보여줘야 운영자가 인지·수정한다.
export const rateToPercent = (rate) => Math.round((rate || 0) * 100);
// percentToRate는 0~100 클램프 — 100% 초과 입력이 discount_rate>1로 저장돼 주문가가 음수가 되는 운영버그 방지.
export const percentToRate = (percent) => {
  const n = parseFloat(percent);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n)) / 100;
};

/**
 * 저장 payload 정규화 — FORM_FIELDS만 pick, 배열·비용·날짜 컬럼 정합.
 * created_by·_nameTouched는 FORM_FIELDS에 없으므로 자연히 제외된다.
 */
export const normalizeEventPayload = (form) => {
  const payload = Object.fromEntries(FORM_FIELDS.map((k) => [k, form[k]]));
  payload.attendee_ids = Array.isArray(payload.attendee_ids) ? payload.attendee_ids : [];
  // 빈 배열 = 전체 노출(NULL과 동일 의미). 빈 배열 그대로 저장.
  payload.visible_categories = Array.isArray(payload.visible_categories) ? payload.visible_categories : [];
  payload.marketing_cost =
    payload.marketing_cost === '' || payload.marketing_cost == null ? null : Number(payload.marketing_cost);
  DATE_FIELDS.forEach((k) => { if (!payload[k]) payload[k] = null; });
  return payload;
};

// 필수 4필드 게이트: 행사명·주문 URL(형식 유효)·행사 기간(시작·종료)·배송 예정일.
// 생성 페이지(EventCreatePage) 전용. 편집 모달(EventFormDialog)은 이 함수를 쓰지 않는다(name·slug만 검증).
export const isRequiredComplete = (form) => {
  if (!form) return false;
  return Boolean(
    form.name && form.order_url_slug && isValidSlug(form.order_url_slug)
    && form.start_date && form.end_date && form.estimated_delivery_date,
  );
};

/**
 * 자동 채우기 — handleChange의 순수부.
 * name 직접 입력 시 _nameTouched 잠금·slug 폴백, 연도+학회+구분이 모두 채워지면 행사명·slug 조립.
 * @param {object} prev - 이전 form 상태
 * @param {string} name - 변경 필드명
 * @param {*} value - 새 값
 * @param {{ societies?: Array, isEditing?: boolean }} ctx
 * @returns {object} 새 form 상태
 */
export const applyAutofill = (prev, name, value, { societies = [], isEditing = false } = {}) => {
  const newState = { ...prev, [name]: value };

  if (name === 'name' && !isEditing && !newState.order_url_slug) {
    newState.order_url_slug = nameToSlug(value);
  }
  if (name === 'name') newState._nameTouched = true;

  if (['event_year', 'host_society', 'event_season'].includes(name)) {
    const newYear = name === 'event_year' ? value : prev.event_year;
    const newSociety = name === 'host_society' ? value : prev.host_society;
    const newSeason = name === 'event_season' ? value : prev.event_season;

    if (newYear && newSociety && newSeason) {
      if (!prev._nameTouched) newState.name = assembleEventName(newYear, newSociety, newSeason);

      if (!isEditing) {
        const societyObj = societies.find((s) => s.name === newSociety);
        if (societyObj) {
          newState.order_url_slug = buildOrderSlug({
            slugPrefix: societyObj.slug_prefix,
            year: newYear,
            season: newSeason,
            token: genSlugToken(),
          });
        }
      }
    }
  }
  return newState;
};
