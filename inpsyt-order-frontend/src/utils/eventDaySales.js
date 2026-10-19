// 현장 보고서 "0. 판매" 블록 생성·교체 — 일차별 매출 집계(결제 완료 KST 기준).
// 집계 규칙(PAID_STATUSES·배송비 할당·면세·미분류 보강)은 computeRevenueByCategory에 위임.
//
// 일차 기준 = 결제 완료 시각(KST): status_history의 첫 'paid' changed_at(없으면 created_at)을
// 한국 시간 날짜로 바꿔 start_date 기준 일차를 정한다. 시작 전 → 1일차, 종료 후 → 마지막 일차.

import { computeRevenueByCategory } from './revenueByCategory';

const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const dateToUtcMidnight = (ymd) => new Date(`${ymd}T00:00:00Z`).getTime();
const fmtWon = (n) => (n || 0).toLocaleString();

// 주문의 결제 완료 시각(KST) → 'YYYY-MM-DD'. 없으면 null.
export function getOrderPaidDateKST(order) {
  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  const paidEntry = history.find((h) => h?.status === 'paid');
  const iso = paidEntry?.changed_at || order?.created_at;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const kst = new Date(t + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 행사 전체 일수(최소 1).
export function totalDays(startDate, endDate) {
  if (!startDate) return 1;
  const s = dateToUtcMidnight(startDate);
  const e = endDate ? dateToUtcMidnight(endDate) : s;
  return Math.max(1, Math.round((e - s) / DAY_MS) + 1);
}

// 결제 완료 시각 → 일차(1-based). 시작 전 → 1, 종료 후 → 마지막 일차.
export function getOrderDayNumber(order, startDate, endDate) {
  const paidDate = getOrderPaidDateKST(order);
  if (!paidDate || !startDate) return 1;
  const last = totalDays(startDate, endDate);
  const day = Math.round((dateToUtcMidnight(paidDate) - dateToUtcMidnight(startDate)) / DAY_MS) + 1;
  if (day < 1) return 1;
  if (day > last) return last;
  return day;
}

// start_date + (dayNumber-1)일 → 'MM/DD'.
export function dayDateLabel(startDate, dayNumber) {
  if (!startDate) return '';
  const d = new Date(dateToUtcMidnight(startDate) + (dayNumber - 1) * DAY_MS);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}

// 매출 1벌 → 본문 줄들. perDay=true면 배송비 0원일 때 "(배송비 …)" 생략, 누적은 항상 표기.
function salesLines(rev, perDay) {
  const ship = (s) => (perDay && !(s > 0) ? '' : ` (배송비 ${fmtWon(s)}원 포함)`);
  const lines = [
    `검사 판매: ${fmtWon(rev.test)}원${ship(rev.testShipping)}`,
    `도서 판매: ${fmtWon(rev.book)}원${ship(rev.bookShipping)}`,
  ];
  if (rev.tool > 0) lines.push(`도구 판매: ${fmtWon(rev.tool)}원${ship(rev.toolShipping)}`);
  lines.push(`합계: ${fmtWon(rev.total)}원`);
  return lines;
}

/**
 * "0. 판매" 블록 본문 생성.
 * 1일차 = 누적만, 2일차 이후 = 누적 + "(1) 1일차 (MM/DD)" … "(N) N일차 (MM/DD)".
 * 누적 = 1~N일차 합.
 * @param {object} args
 * @param {Array}  args.orders - 이 학회 주문(status·delivery_fee·status_history·created_at·order_items)
 * @param {number} args.dayNumber - 보고서 일차(N)
 * @param {string} args.startDate - events.start_date
 * @param {string} [args.endDate] - events.end_date
 * @param {object} [args.productsMap] - 카테고리 보강용
 * @returns {string}
 */
export function buildSalesBlock({ orders, dayNumber, startDate, endDate, productsMap }) {
  const n = dayNumber || 1;
  const list = orders || [];
  const dayOf = (o) => getOrderDayNumber(o, startDate, endDate);
  const opts = { productsMap };

  const cumRev = computeRevenueByCategory(list.filter((o) => dayOf(o) <= n), opts);
  const out = ['0. 판매', ...salesLines(cumRev, false)];

  if (n >= 2) {
    for (let d = 1; d <= n; d++) {
      const rev = computeRevenueByCategory(list.filter((o) => dayOf(o) === d), opts);
      out.push('', `(${d}) ${d}일차 (${dayDateLabel(startDate, d)})`, ...salesLines(rev, true));
    }
  }
  return out.join('\n');
}

const SALES_HEADER = /^0\.\s*판매\s*$/;
// "0. 판매" 블록을 이루는 줄 — 금액 줄·합계 줄·일차 소제목("(1) 1일차 (10/16)", "(1)2일차 판매")·빈 줄.
// 이 형식이 아닌 줄(다음 번호 제목, "이상 … 마무리하겠습니다." 같은 맺음말 등)을 만나면 블록이 끝난다.
// (번호 제목만 끝으로 보면, 번호 제목 없이 맺음말로 끝나는 보고서에서 맺음말까지 지워진다.)
const SALES_LINE = [
  /^\s*$/,
  /^\s*(검사|도서|도구)\s*판매\s*:/,
  /^\s*합계\s*:/,
  /^\s*\(\d+\)\s*\d+\s*일차/,
];
const isSalesLine = (l) => SALES_LINE.some((re) => re.test(l));

/**
 * content의 "0. 판매" 블록만 newBlock으로 교체. 그 밖의 본문은 한 글자도 바꾸지 않는다.
 * 블록 범위 = "0. 판매" 줄부터, 판매 형식 줄(SALES_LINE)이 이어지는 데까지(뒤쪽 빈 줄은 보존).
 * 블록을 찾지 못하면 null.
 * @returns {string|null}
 */
export function replaceSalesBlock(content, newBlock) {
  const lines = (content || '').split('\n');
  const startIdx = lines.findIndex((l) => SALES_HEADER.test(l));
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (!isSalesLine(lines[i])) { endIdx = i; break; }
  }
  // 블록 뒤의 빈 줄은 구분선(본문)이므로 교체 범위에서 제외해 보존.
  let contentEnd = endIdx;
  while (contentEnd > startIdx + 1 && lines[contentEnd - 1].trim() === '') contentEnd--;

  return [...lines.slice(0, startIdx), ...newBlock.split('\n'), ...lines.slice(contentEnd)].join('\n');
}
