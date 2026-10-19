// 현장 도움(PIN) 주문 — 순수 판정 함수. 어드민 UI가 공유한다.
// 근거: DOCS/PRD_현장도움주문.md §4·§5·§6, design-system/specs/A1·A2·L2.

/**
 * 준비중(preparing) 주문인지.
 * @param {{status?:string}} order
 * @returns {boolean}
 */
export const isPreparingOrder = (order) => order?.status === 'preparing';

/**
 * 준비중 → 결제대기(pending) 자동 승격 조건.
 * 현재 상태가 preparing 이고, 저장 후 상품이 1개 이상이고, 고객명이 공백이 아닐 때만 true.
 * (PRD §2·§6 — 상품 칸=담당자, 배송지 칸=고객. 둘 다 채워지면 자동 전환.)
 * @param {{status:string, itemCount:number, customerName:string}}
 * @returns {boolean}
 */
export const shouldPromoteToPending = ({ status, itemCount, customerName } = {}) =>
  status === 'preparing' &&
  (itemCount || 0) >= 1 &&
  typeof customerName === 'string' &&
  customerName.trim().length > 0;

/**
 * PIN 주문 생성용 학회 상태 키(뱃지). `today`·학회 날짜는 'YYYY-MM-DD' 문자열(KST).
 * closed_at(종료 처리)이 있으면 종료, 날짜 미정이면 unknown.
 * (규칙은 NewOrderModal getEventStatusKey / utils/date getEventStatusKST와 동일 — 문자열 비교.)
 * @param {{start_date?:string, end_date?:string, closed_at?:string|null}} event
 * @param {string} today 'YYYY-MM-DD'
 * @returns {'upcoming'|'ongoing'|'ended'|'unknown'}
 */
export const pinEventStatusKey = (event, today) => {
  if (!event || event.closed_at) return 'ended';
  const start = event.start_date;
  const end = event.end_date;
  if (!start || !end) return 'unknown';
  if (today < start) return 'upcoming';
  if (today > end) return 'ended';
  return 'ongoing';
};

/**
 * PIN 주문 생성 시 기본으로 선택할 학회 id.
 * 1) 진행 중(start ≤ today ≤ end, 종료 안 됨) — 여러 개면 start_date 최신
 * 2) 없으면 오늘 이전에 시작한 학회(종료 안 됨) 중 start_date 최신
 * 3) 없으면 가장 임박한 예정 학회(start 최소)
 * 4) 그래도 없으면 첫 학회
 * closed_at 학회는 기본 선택에서 제외(생성 불가·뱃지 종료·선택지 비활성).
 * @param {Array} events getEvents 결과(end_date·closed_at 포함)
 * @param {string} today 'YYYY-MM-DD'
 * @returns {(number|null)}
 */
export const pickDefaultPinEvent = (events = [], today) => {
  const open = events.filter((e) => e && e.start_date && !e.closed_at);
  const latestStart = (arr) => arr.reduce((best, e) => (!best || e.start_date > best.start_date ? e : best), null);
  const earliestStart = (arr) => arr.reduce((best, e) => (!best || e.start_date < best.start_date ? e : best), null);

  const ongoing = open.filter((e) => e.start_date <= today && (!e.end_date || today <= e.end_date));
  if (ongoing.length) return latestStart(ongoing).id;

  const started = open.filter((e) => e.start_date <= today);
  if (started.length) return latestStart(started).id;

  if (open.length) return earliestStart(open).id;

  return events[0]?.id ?? null;
};

/**
 * 학회 종료 2단계 확인 문구 — 삭제될 준비중 건수를 반영한다.
 * @param {number} [deletedCount=0]
 */
export const closeEventConfirm = (deletedCount = 0) => ({
  deletedCount,
  step1Title: '학회를 종료할까요?',
  step1Body:
    '종료하면 고객 주문서 링크(/go 포함)가 닫히고, 완성되지 않은 준비중 주문이 삭제되며 PIN이 모두 무효가 됩니다. 결제대기·결제완료 주문은 그대로 보존됩니다.',
  step2Title: '정말 종료할까요?',
  step2Body: `준비중 주문 ${deletedCount}건을 삭제하고 PIN을 무효화합니다. 이 작업은 되돌릴 수 없습니다(주문서 링크는 다시 열 수 있지만 삭제분은 복구되지 않습니다).`,
});
