// 입금결의서(deposit resolution) 엑셀 내보내기.
// 회사 공통 양식(public/templates/deposit-resolution-template.xlsx)을 ExcelJS로 열어
// 셀만 채워 다운로드한다. SheetJS(xlsx)는 병합·서식·로고 보존이 약해 ExcelJS를 쓴다.
//
// 채우는 시트: "02.입금결의서 (템플릿)". "샘플" 시트는 참고용으로 건드리지 않는다.
// 셀 매핑은 design-system specs / 위임 지시서(2026-06-02) 기준.

import ExcelJS from 'exceljs';
import { numberToKoreanCurrency } from './koreanCurrency';
import { computeRevenueByCategory } from './revenueByCategory';

const TEMPLATE_URL = '/templates/deposit-resolution-template.xlsx';
const TARGET_SHEET = '02.입금결의서 (템플릿)';
const SAMPLE_SHEET = '02.입금결의서 (샘플)'; // 내보낼 때 제거할 참고용 시트
const OUTPUT_SHEET_NAME = '02.입금결의서'; // 최종 파일의 시트명('(템플릿)' 표기 제거)
const DEFAULT_DEPARTMENT = '마케팅운영팀';

// 행사명은 event_season(예: "춘계학술대회")을 우선 사용한다(적요 샘플 정합).
// event_season 이 없을 때만 name 에서 학회명·연도를 제거해 시즌/세부만 남긴다.
// (event.name 은 "{연도} {host_society} {시즌}" 형식 — EventManagementPage 자동완성)
function cleanEventName(name, society, year) {
  let s = (name || '').trim();
  if (society) s = s.split(society).join(' ');
  if (year) s = s.split(String(year)).join(' ');
  s = s.replace(/\b(19|20)\d{2}\b/g, ' '); // 잔여 4자리 연도 제거
  return s.replace(/\s+/g, ' ').trim();
}

// start_date(필수)·end_date 로 "MM.DD" 또는 "MM.DD-DD" 생성. (KST 환산 없이 date 문자열 그대로)
function formatEventDateRange(startDate, endDate) {
  if (!startDate) return '';
  const s = new Date(startDate);
  const mm = String(s.getMonth() + 1).padStart(2, '0');
  const dd = String(s.getDate()).padStart(2, '0');
  let label = `${mm}.${dd}`;
  if (endDate) {
    const e = new Date(endDate);
    const sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
    if (!sameDay) {
      const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
      const edd = String(e.getDate()).padStart(2, '0');
      // 같은 달: 'MM.DD-DD' (예 04.16-17) / 달을 넘기면: 'MM.DD~MM.DD'
      label += sameMonth ? `-${edd}` : `~${String(e.getMonth() + 1).padStart(2, '0')}.${edd}`;
    }
  }
  return label;
}

// 적요 행 구성(순수 함수 — 바우처 분기 테스트용). A13 §⑧.
//  - 실제로 팔린 대분류(버킷 > 0)만 적는다. 학회 개요의 판매 대분류 선택이 아니라 판매 실적 기준
//    (어드민 수기 주문으로 다른 대분류를 팔 수 있음, 2026-11-04 건우님 결정). 매출 0건이면 3행 0원.
//  - 바우처 0: 팔린 대분류마다 "매출" 1행.
//  - 바우처 > 0: 팔린 대분류마다 "(카드)" 행 + 그 대분류 바우처 > 0이면 바로 아래 "({용어})" 행.
//    순서 도서·검사·도구. 카드 행은 0원이어도 기재(전액 바우처), 바우처 행은 0원이면 생략. 카드 행 = 버킷 − 버킷 바우처.
// 반환: [{ summary, counterparty, amount }] (행 9부터 순서대로). 최대 6행(도서·검사·도구 × 카드+바우처).
export function buildDepositRows(revenue, prefix, society, voucherLabel = '바우처') {
  const cats = [
    { name: '도서', bucket: revenue.book || 0, voucher: revenue.bookVoucher || 0 },
    { name: '검사', bucket: revenue.test || 0, voucher: revenue.testVoucher || 0 },
    { name: '도구', bucket: revenue.tool || 0, voucher: revenue.toolVoucher || 0 },
  ];
  const row = (summary, amount) => ({ summary, counterparty: society, amount });

  const sold = cats.filter((c) => c.bucket > 0);
  // 매출 0건 — 양식이 비지 않도록 기존처럼 3행 0원.
  if (sold.length === 0) return cats.map((c) => row(`${prefix} ${c.name} 매출`, 0));

  if (!((revenue.voucher || 0) > 0)) {
    return sold.map((c) => row(`${prefix} ${c.name} 매출`, c.bucket));
  }

  const rows = [];
  for (const c of sold) {
    rows.push(row(`${prefix} ${c.name} 매출(카드)`, c.bucket - c.voucher));
    if (c.voucher > 0) rows.push(row(`${prefix} ${c.name} 매출(${voucherLabel})`, c.voucher));
  }
  return rows;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 입금결의서 엑셀을 생성·다운로드한다.
 * @param {object} args
 * @param {object} args.event - { name, host_society, event_season, event_year, start_date, end_date }
 * @param {Array}  args.orders - 그 행사의 주문 배열(결제완료만 util이 필터)
 * @param {object} [args.productsMap] - 카테고리 보강용
 * @param {string} [args.authorName] - 작성자(성명)
 * @param {string} [args.department] - 부서(미지정 시 기본 "마케팅운영팀")
 * @param {string} [args.voucherLabel] - 바우처 용어(설정값, 미지정 시 "바우처"). A13 §⑧.
 */
export async function exportDepositResolution({ event, orders, productsMap, authorName, department, voucherLabel }) {
  const revenue = computeRevenueByCategory(orders, { productsMap });
  const { unclassified, total } = revenue;

  const society = (event?.host_society || '').trim();
  const eventTitle = (event?.event_season || '').trim()
    || cleanEventName(event?.name, society, event?.event_year);
  const dateRange = formatEventDateRange(event?.start_date, event?.end_date);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('입금결의서 양식 파일을 불러오지 못했습니다.');
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(TARGET_SHEET);
  if (!ws) throw new Error(`양식에 "${TARGET_SHEET}" 시트가 없습니다.`);

  // 작성일 = 오늘
  ws.getCell('N4').value = year;   // 연(YYYY)
  ws.getCell('Q4').value = month;  // 월(M)
  ws.getCell('S4').value = day;    // 일(D)

  // 금액 (한글) + 숫자
  ws.getCell('C5').value = numberToKoreanCurrency(total); // 'M5=원정.'은 양식 보유
  ws.getCell('D6').value = total;

  // 부서 / 성명
  ws.getCell('Q5').value = department || DEFAULT_DEPARTMENT;
  ws.getCell('Q6').value = authorName || '';

  // 적요 행 — 바우처 0이면 도서/검사/도구 "매출" 3행(0원이어도 기재), 바우처 > 0이면
  // 카테고리별 (카드)[+(용어)] 행(A13 §⑧). 행 9부터 채우고 남는 행(~15)은 비운다.
  const prefix = `${dateRange} ${society} ${eventTitle}`.replace(/\s+/g, ' ').trim();
  const rows = buildDepositRows(revenue, prefix, society, voucherLabel || '바우처');
  const FIRST_ROW = 9, LAST_ROW = 15;
  rows.forEach((r, i) => {
    const n = FIRST_ROW + i;
    ws.getCell(`E${n}`).value = r.summary;
    ws.getCell(`N${n}`).value = r.counterparty;
    ws.getCell(`R${n}`).value = r.amount;
  });
  // 양식 데모 행 잔여 placeholder 제거(템플릿엔 "{학회명}..."·"10000000" 예시가 들어있음).
  for (let n = FIRST_ROW + rows.length; n <= LAST_ROW; n++) {
    ws.getCell(`E${n}`).value = null;
    ws.getCell(`N${n}`).value = null;
    ws.getCell(`R${n}`).value = null;
  }

  // 계
  ws.getCell('R16').value = total;

  // 헤더 정렬 정리 — '거래처'/'금액'이 균등분할(distributed)이라 글자가 테두리까지 벌어지던 것을
  // 가운데 정렬 + 적당한 자간(계정과목 '계 정 과 목'과 동일 톤)으로.
  ws.getCell('N8').value = '거 래 처';
  ws.getCell('N8').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('R8').value = '금 액';
  ws.getCell('R8').alignment = { horizontal: 'center', vertical: 'middle' };
  // 거래처 값(N9~N15) 가운데 정렬
  for (let r = 9; r <= 15; r++) {
    ws.getCell(`N${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // 내보낼 파일에서 (샘플) 참고 시트 제거 + 남는 시트명의 '(템플릿)' 표기 제거
  const sampleWs = wb.getWorksheet(SAMPLE_SHEET);
  if (sampleWs) wb.removeWorksheet(sampleWs.id);
  ws.name = OUTPUT_SHEET_NAME;

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const ymd = `${year}-${String(month).padStart(2, '0')}`;
  triggerDownload(blob, `입금결의서_${society || eventTitle || '행사'}_${ymd}.xlsx`);

  const { test, book, tool } = revenue;
  return { test, book, tool, unclassified, total };
}
