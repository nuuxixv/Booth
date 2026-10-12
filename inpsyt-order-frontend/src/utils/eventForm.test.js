import { describe, it, expect } from 'vitest';
import {
  assembleEventName,
  seasonToEng,
  buildOrderSlug,
  nameToSlug,
  isValidSlug,
  rateToPercent,
  percentToRate,
  normalizeEventPayload,
  isRequiredComplete,
  applyAutofill,
  emptyEvent,
  FORM_FIELDS,
} from './eventForm';

describe('seasonToEng', () => {
  it('6종 매핑', () => {
    expect(seasonToEng('춘계학술대회')).toBe('spring');
    expect(seasonToEng('추계학술대회')).toBe('fall');
    expect(seasonToEng('연수강좌')).toBe('training');
    expect(seasonToEng('보수교육')).toBe('edu');
    expect(seasonToEng('세미나')).toBe('seminar');
    expect(seasonToEng('기타')).toBe('etc');
  });
  it('목록 외 직접 입력 → etc', () => {
    expect(seasonToEng('워크숍')).toBe('etc');
    expect(seasonToEng('')).toBe('etc');
    expect(seasonToEng(undefined)).toBe('etc');
  });
});

describe('assembleEventName', () => {
  it('"{연도} {주최학회} {행사구분}" 조립', () => {
    expect(assembleEventName(2026, '한국심리학회', '춘계학술대회')).toBe('2026 한국심리학회 춘계학술대회');
  });
});

describe('buildOrderSlug', () => {
  it('접두어-연도-season_eng-token', () => {
    expect(buildOrderSlug({ slugPrefix: 'kpa', year: 2026, season: '춘계학술대회', token: 'ab12' }))
      .toBe('kpa-2026-spring-ab12');
  });
  it('접두어 없으면 event 폴백', () => {
    expect(buildOrderSlug({ slugPrefix: '', year: 2026, season: '세미나', token: 'zz99' }))
      .toBe('event-2026-seminar-zz99');
    expect(buildOrderSlug({ slugPrefix: undefined, year: 2027, season: '기타', token: 'q1w2' }))
      .toBe('event-2027-etc-q1w2');
  });
});

describe('nameToSlug', () => {
  it('공백→하이픈, 대문자→소문자', () => {
    expect(nameToSlug('Spring Event')).toBe('spring-event');
  });
  it('허용 외 문자(한글·특수문자) 제거', () => {
    // 공백 3개→하이픈 3개, 한글·특수문자 제거 (원본 87행 로직 그대로)
    expect(nameToSlug('2026 한국심리 春 fest!!')).toBe('2026---fest');
  });
  it('빈 입력 방어', () => {
    expect(nameToSlug('')).toBe('');
    expect(nameToSlug(undefined)).toBe('');
  });
});

describe('isValidSlug', () => {
  it('영문 소문자·숫자·하이픈만 통과', () => {
    expect(isValidSlug('kpa-2026-spring-ab12')).toBe(true);
    expect(isValidSlug('abc123')).toBe(true);
  });
  it('위반 케이스 거부', () => {
    expect(isValidSlug('KPA-2026')).toBe(false); // 대문자
    expect(isValidSlug('kpa_2026')).toBe(false); // 언더스코어
    expect(isValidSlug('kpa 2026')).toBe(false); // 공백
    expect(isValidSlug('한국')).toBe(false); // 한글
    expect(isValidSlug('')).toBe(false); // 빈값
  });
});

describe('rateToPercent / percentToRate 왕복', () => {
  it('소수 → 정수 %', () => {
    expect(rateToPercent(0.15)).toBe(15);
    expect(rateToPercent(0)).toBe(0);
    expect(rateToPercent(null)).toBe(0);
    expect(rateToPercent(undefined)).toBe(0);
  });
  it('정수 % → 소수', () => {
    expect(percentToRate('15')).toBeCloseTo(0.15);
    expect(percentToRate('')).toBe(0);
    expect(percentToRate('abc')).toBe(0);
  });
  it('0~100 클램프 (100% 초과 → 1, 음수 → 0)', () => {
    expect(percentToRate('200')).toBe(1);
    expect(percentToRate('150')).toBe(1);
    expect(percentToRate('100')).toBe(1);
    expect(percentToRate('-10')).toBe(0);
    expect(percentToRate('15')).toBeCloseTo(0.15);
    expect(percentToRate('')).toBe(0);
    expect(percentToRate('abc')).toBe(0);
  });
  it('rateToPercent는 이상값을 그대로 노출(클램프 안 함)', () => {
    expect(rateToPercent(1.11)).toBe(111);
    expect(rateToPercent(2)).toBe(200);
  });
  it('왕복 보존', () => {
    expect(rateToPercent(percentToRate('30'))).toBe(30);
    expect(rateToPercent(percentToRate('200'))).toBe(100); // 초과 입력은 100%로 착지
  });
});

describe('normalizeEventPayload', () => {
  it('attendee_ids 빈/비배열 → []', () => {
    expect(normalizeEventPayload({ ...emptyEvent(), attendee_ids: undefined }).attendee_ids).toEqual([]);
    expect(normalizeEventPayload({ ...emptyEvent(), attendee_ids: null }).attendee_ids).toEqual([]);
  });
  it('visible_categories 빈 배열 유지(전체 노출 의미 보존)', () => {
    const out = normalizeEventPayload({ ...emptyEvent(), visible_categories: [] });
    expect(out.visible_categories).toEqual([]);
  });
  it('visible_categories 선택값 유지', () => {
    const out = normalizeEventPayload({ ...emptyEvent(), visible_categories: ['검사', '도구'] });
    expect(out.visible_categories).toEqual(['검사', '도구']);
  });
  it('marketing_cost "" → null', () => {
    expect(normalizeEventPayload({ ...emptyEvent(), marketing_cost: '' }).marketing_cost).toBeNull();
  });
  it('marketing_cost null → null', () => {
    expect(normalizeEventPayload({ ...emptyEvent(), marketing_cost: null }).marketing_cost).toBeNull();
  });
  it('marketing_cost 값 → Number', () => {
    expect(normalizeEventPayload({ ...emptyEvent(), marketing_cost: '500000' }).marketing_cost).toBe(500000);
  });
  it('estimated_delivery_date "" → null', () => {
    expect(normalizeEventPayload({ ...emptyEvent(), estimated_delivery_date: '' }).estimated_delivery_date).toBeNull();
  });
  it('_nameTouched·created_by 미포함', () => {
    const out = normalizeEventPayload({ ...emptyEvent(), _nameTouched: true, created_by: 'u1', name: '행사' });
    expect(out).not.toHaveProperty('_nameTouched');
    expect(out).not.toHaveProperty('created_by');
  });
});

// 학회 개선 트랙 2차(2026-10-12) — 신규 5컬럼 + venue 라운드트립 소거 방지(2026-06-25 사고 재발 방지).
describe('2차 신규 컬럼(설치/철거·장소 3분리) 라운드트립', () => {
  const NEW_COLS = ['setup_time', 'teardown_time', 'venue_name', 'venue_address', 'venue_detail'];

  it('FORM_FIELDS에 신규 5컬럼 + 기존 venue 모두 포함', () => {
    NEW_COLS.forEach((k) => expect(FORM_FIELDS).toContain(k));
    expect(FORM_FIELDS).toContain('venue');
    expect(FORM_FIELDS).toHaveLength(19);
  });

  it('emptyEvent 기본값 — 신규 5컬럼 "" · venue "" 존치', () => {
    const e = emptyEvent();
    NEW_COLS.forEach((k) => expect(e[k]).toBe(''));
    expect(e.venue).toBe('');
  });

  it('normalizeEventPayload가 신규 5컬럼과 venue 값을 payload에 보존', () => {
    const form = {
      ...emptyEvent(),
      setup_time: '당일 07:30 쯤',
      teardown_time: '둘째 날 13시 이후',
      venue_name: '부산 BEXCO',
      venue_address: '부산광역시 해운대구 APEC로 55',
      venue_detail: '제1전시장 3층 3A홀',
      venue: '부산 BEXCO 제1전시장',
    };
    const out = normalizeEventPayload(form);
    expect(out.setup_time).toBe('당일 07:30 쯤');
    expect(out.teardown_time).toBe('둘째 날 13시 이후');
    expect(out.venue_name).toBe('부산 BEXCO');
    expect(out.venue_address).toBe('부산광역시 해운대구 APEC로 55');
    expect(out.venue_detail).toBe('제1전시장 3층 3A홀');
    expect(out.venue).toBe('부산 BEXCO 제1전시장'); // deprecated 존치 — 저장 payload에 계속 포함
  });

  it('빈 문자열 신규 컬럼은 그대로 "" 저장(별도 null 정규화 없음)', () => {
    const out = normalizeEventPayload(emptyEvent());
    NEW_COLS.forEach((k) => expect(out[k]).toBe(''));
  });
});

describe('isRequiredComplete', () => {
  const full = {
    name: '2026 한국심리학회 춘계학술대회',
    order_url_slug: 'kpa-2026-spring-ab12',
    start_date: '2026-05-01',
    end_date: '2026-05-03',
    estimated_delivery_date: '2026-05-10',
  };
  it('필수 4 모두 충족 → true', () => {
    expect(isRequiredComplete(full)).toBe(true);
  });
  it('name 누락 → false', () => {
    expect(isRequiredComplete({ ...full, name: '' })).toBe(false);
  });
  it('order_url_slug 누락 → false', () => {
    expect(isRequiredComplete({ ...full, order_url_slug: '' })).toBe(false);
  });
  it('slug 형식 위반 → false', () => {
    expect(isRequiredComplete({ ...full, order_url_slug: 'KPA_2026' })).toBe(false);
  });
  it('start_date 누락 → false', () => {
    expect(isRequiredComplete({ ...full, start_date: '' })).toBe(false);
  });
  it('end_date 누락 → false', () => {
    expect(isRequiredComplete({ ...full, end_date: '' })).toBe(false);
  });
  it('estimated_delivery_date 누락 → false', () => {
    expect(isRequiredComplete({ ...full, estimated_delivery_date: '' })).toBe(false);
  });
  it('null form 방어', () => {
    expect(isRequiredComplete(null)).toBe(false);
  });
});

describe('applyAutofill', () => {
  const societies = [{ id: 1, name: '한국심리학회', slug_prefix: 'kpa' }];

  it('연도+학회+구분 모두 채우면 name·slug 자동 생성', () => {
    let form = emptyEvent();
    form = applyAutofill(form, 'event_year', 2026, { societies });
    form = applyAutofill(form, 'host_society', '한국심리학회', { societies });
    form = applyAutofill(form, 'event_season', '춘계학술대회', { societies });
    expect(form.name).toBe('2026 한국심리학회 춘계학술대회');
    expect(form.order_url_slug).toMatch(/^kpa-2026-spring-[a-z0-9]{4}$/);
  });

  it('_nameTouched 서면 이후 name을 덮어쓰지 않음', () => {
    let form = { ...emptyEvent(), event_year: 2026, host_society: '한국심리학회' };
    form = applyAutofill(form, 'name', '내가 직접 쓴 행사명', { societies });
    expect(form._nameTouched).toBe(true);
    form = applyAutofill(form, 'event_season', '춘계학술대회', { societies });
    expect(form.name).toBe('내가 직접 쓴 행사명'); // 자동조립이 덮어쓰지 않음
    expect(form.order_url_slug).toMatch(/^kpa-2026-spring-[a-z0-9]{4}$/); // slug는 조립됨
  });

  it('name 직접 입력 + slug 빈값이면 nameToSlug 폴백', () => {
    let form = emptyEvent();
    form = applyAutofill(form, 'name', 'Fall Meeting', { societies });
    expect(form.order_url_slug).toBe('fall-meeting');
  });

  it('slug가 이미 있으면 name 입력이 slug를 덮지 않음', () => {
    let form = { ...emptyEvent(), order_url_slug: 'kept-slug' };
    form = applyAutofill(form, 'name', 'New Name', { societies });
    expect(form.order_url_slug).toBe('kept-slug');
  });

  it('학회가 societies에 없으면 slug 미조립(name만)', () => {
    let form = emptyEvent();
    form = applyAutofill(form, 'event_year', 2026, { societies });
    form = applyAutofill(form, 'host_society', '미등록학회', { societies });
    form = applyAutofill(form, 'event_season', '세미나', { societies });
    expect(form.name).toBe('2026 미등록학회 세미나');
    expect(form.order_url_slug).toBe('');
  });
});
