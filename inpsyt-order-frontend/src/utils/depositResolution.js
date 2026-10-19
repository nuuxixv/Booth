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
 */
export async function exportDepositResolution({ event, orders, productsMap, authorName, department }) {
  const { test, book, tool, unclassified, total } = computeRevenueByCategory(orders, { productsMap });

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

  // 적요 행 — 도서/검사/도구 모두 0원이어도 기재(생략 금지).
  const prefix = `${dateRange} ${society} ${eventTitle}`.replace(/\s+/g, ' ').trim();
  ws.getCell('E9').value = `${prefix} 도서 매출`;
  ws.getCell('N9').value = society;
  ws.getCell('R9').value = book;
  ws.getCell('E10').value = `${prefix} 검사 매출`;
  ws.getCell('N10').value = society;
  ws.getCell('R10').value = test;
  ws.getCell('E11').value = `${prefix} 도구 매출`;
  ws.getCell('N11').value = society;
  ws.getCell('R11').value = tool;

  // 양식 데모 행(12~15) 잔여 placeholder 제거 — 1학회=3행(도서/검사/도구)만 사용.
  // (템플릿엔 패턴 예시로 E11/E12 "{학회명}..." + R11/R12 "10000000" 등이 들어있음)
  for (let r = 12; r <= 15; r++) {
    ws.getCell(`E${r}`).value = null;
    ws.getCell(`N${r}`).value = null;
    ws.getCell(`R${r}`).value = null;
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

  return { test, book, tool, unclassified, total };
}
