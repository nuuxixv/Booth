// 입금결의서 적요 행 구성(buildDepositRows) 순수 유닛 테스트 — A13 §⑧.
// 엑셀 렌더(exportDepositResolution)는 ExcelJS·양식 파일 의존이라 여기서는 행 구성만 검증한다.
import { describe, it, expect } from 'vitest';
import { buildDepositRows } from './depositResolution';

const PREFIX = '04.16 한국심리학회 춘계';
const SOCIETY = '한국심리학회';

// computeRevenueByCategory 반환 형태의 최소 목.
const rev = (over = {}) => ({
  test: 0, book: 0, tool: 0, unclassified: 0,
  testVoucher: 0, bookVoucher: 0, toolVoucher: 0, unclassifiedVoucher: 0, voucher: 0,
  ...over,
});

describe('buildDepositRows — 바우처 0 (현행 유지)', () => {
  it('도서·검사·도구 "매출" 3행, 0원이어도 기재', () => {
    const rows = buildDepositRows(rev({ book: 20000, test: 100000, tool: 0 }), PREFIX, SOCIETY);
    expect(rows).toEqual([
      { summary: `${PREFIX} 도서 매출`, counterparty: SOCIETY, amount: 20000 },
      { summary: `${PREFIX} 검사 매출`, counterparty: SOCIETY, amount: 100000 },
      { summary: `${PREFIX} 도구 매출`, counterparty: SOCIETY, amount: 0 },
    ]);
  });
});

describe('buildDepositRows — 바우처 > 0 (카드/바우처 분리)', () => {
  it('도구만 바우처 → 도서(카드)·검사(카드)·도구(카드)·도구(바우처)', () => {
    const rows = buildDepositRows(
      rev({ book: 20000, test: 100000, tool: 50000, toolVoucher: 10000, voucher: 10000 }),
      PREFIX, SOCIETY,
    );
    expect(rows).toEqual([
      { summary: `${PREFIX} 도서 매출(카드)`, counterparty: SOCIETY, amount: 20000 },
      { summary: `${PREFIX} 검사 매출(카드)`, counterparty: SOCIETY, amount: 100000 },
      { summary: `${PREFIX} 도구 매출(카드)`, counterparty: SOCIETY, amount: 40000 }, // 50,000 − 10,000
      { summary: `${PREFIX} 도구 매출(바우처)`, counterparty: SOCIETY, amount: 10000 },
    ]);
  });

  it('카드 행은 0원이어도 기재, 바우처 행은 0원이면 생략', () => {
    const rows = buildDepositRows(
      rev({ book: 0, test: 30000, tool: 0, testVoucher: 30000, voucher: 30000 }),
      PREFIX, SOCIETY,
    );
    expect(rows).toEqual([
      { summary: `${PREFIX} 도서 매출(카드)`, counterparty: SOCIETY, amount: 0 },
      { summary: `${PREFIX} 검사 매출(카드)`, counterparty: SOCIETY, amount: 0 }, // 전액 바우처 → 카드 0원
      { summary: `${PREFIX} 검사 매출(바우처)`, counterparty: SOCIETY, amount: 30000 },
      { summary: `${PREFIX} 도구 매출(카드)`, counterparty: SOCIETY, amount: 0 },
    ]);
  });

  it('세 카테고리 모두 바우처면 최대 6행', () => {
    const rows = buildDepositRows(
      rev({
        book: 20000, test: 100000, tool: 50000,
        bookVoucher: 5000, testVoucher: 10000, toolVoucher: 20000, voucher: 35000,
      }),
      PREFIX, SOCIETY,
    );
    expect(rows).toHaveLength(6);
  });

  it('용어를 바꾸면 바우처 행 적요에 반영', () => {
    const rows = buildDepositRows(
      rev({ tool: 50000, toolVoucher: 10000, voucher: 10000 }),
      PREFIX, SOCIETY, '쿠폰',
    );
    expect(rows.some((r) => r.summary === `${PREFIX} 도구 매출(쿠폰)`)).toBe(true);
  });
});
