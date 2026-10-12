import React, { useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Snackbar, TextField, useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  EventNote as EventNoteIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  StickyNote2Outlined as NoteIcon,
  PaymentsOutlined as CostIcon,
  Edit as EditIcon,
  ReceiptLong as ReceiptLongIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
  Receipt as ReceiptIcon,
  Psychology as TestIcon,
  MenuBook as BookIcon,
  Build as ToolIcon,
  Assignment as ReportIcon,
  Add as AddIcon,
  Close as CloseIcon,
  LocalOffer as LocalOfferIcon,
  Inventory2Outlined as PrepIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  QrCode2 as QrCode2Icon,
  Download as DownloadIcon,
  Map as MapIcon,
  CheckCircleOutline as CheckCircleIcon,
  LocalShippingOutlined as ShippingIcon,
  ScheduleOutlined as ClockIcon,
  AutoAwesomeMotion as TemplateIcon,
  ImageOutlined as ImageIcon,
  VisibilityOutlined as ViewsIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState } from './ui';
import { computeRevenueByCategory, PAID_STATUSES } from '../utils/revenueByCategory';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { CATEGORY_COLORS } from '../constants/categoryColors';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/event-detail-flow.
 * L2 학회 통합 상세 — "진행상태 6단계 흐름" 재구성 시안(2026-10-12 확정).
 * 정적 Preview (mock 데이터, 실 도메인 미연결). 건우님 마일스톤 검수용.
 *
 * 사양: design-system/specs/L2_EventDetail.md
 *  - 상단 진행 요약 바(읽기 전용 네비 · 단계 클릭 → 앵커 스크롤) + 세로 SectionCard 6단계
 *  - 6단계: ①학회 개요 ②기안서 상신 ③학회 참석 신청 ④부스 참가비 지출결의서 상신
 *           ⑤참석준비(준비 노트) ⑥사후 업무(현장 보고·매출·출고 현황·문서 내보내기)
 *  - 완료 판정은 ②③④(기존 boolean 토글)만. ①⑤⑥은 섹션+앵커만(완료 개념 없음, 순서 강제 없음)
 *  - 헤더 액션 = "학회 정보 수정"만. 입금결의서·지불증은 ⑥ 사후 업무로 이동
 *  - 개요에 "주문서" 행(열기·복사·QR) 신설(1차). 매출은 지결 연동 해제 → 항상 표시
 *  - 출고 현황(CTO 확정): paid+completed 모집단, 합배송 묶음=1건, 현장수령 포함(처리 완료)
 *  - 2차(DB 변경 후): 설치·철거 시간 · 장소 분리(명/주소/상세)+복사+네이버 지도 · 템플릿으로 시작
 *
 * 톤·헬퍼·STAFF·AttendeePillRow·DiscountChip·QR = EventDetailPage/EventManagementPage 정합(코드 카피 X, 구조 차용).
 */

// ─── Mock: 로그인 사용자(나) — master(진행상태 토글·열람 이력 노출) ──
const ME = { id: 'u-me', name: '김현장', role: 'master' };

// ─── Mock: 참석자 후보(user_profiles, onsite + master) ──────────
const STAFF = [
  { id: 'u-me',  name: '김현장', role: 'master' },
  { id: 'u-002', name: '이부스', role: 'onsite' },
  { id: 'u-003', name: '박운영', role: 'onsite' },
  { id: 'u-004', name: '정마스터', role: 'master' },
];
const STAFF_MAP = Object.fromEntries(STAFF.map((s) => [s.id, s]));

const TODAY = '2026-10-12'; // mock 기준일

// ─── Mock 주문 (매출=자식 기준 / 출고=껍데기 묶음 기준) ───────────
// group 동일 주문 = 합배송 1묶음(껍데기 1건). group 없으면 단건.
// 매출: computeRevenueByCategory(전체 paid+completed 아이템) — 껍데기 분리, 자식 합산.
// 출고: 껍데기 묶음은 1건으로 collapse. 두 모집단이 달라 한 숫자로 섞지 않는다.
const ORDERS_ACTIVE = [
  { status: 'completed', delivery_fee: 3000, group: 'g1', order_items: [{ category: '검사', price_at_purchase: 88000, quantity: 2 }] },
  { status: 'completed', delivery_fee: 0,    group: 'g1', order_items: [{ category: '도서', price_at_purchase: 18000, quantity: 1 }] },
  { status: 'paid',      delivery_fee: 3000, group: 'g2', order_items: [{ category: '검사', price_at_purchase: 120000, quantity: 1 }] },
  { status: 'paid',      delivery_fee: 0,    group: 'g2', order_items: [{ category: '도서', price_at_purchase: 25000, quantity: 2 }] },
  { status: 'paid',      delivery_fee: 3000, order_items: [{ category: '검사', price_at_purchase: 88000, quantity: 1 }] },
  { status: 'completed', delivery_fee: 6000, order_items: [{ category: '도서', price_at_purchase: 22000, quantity: 3 }] }, // 현장수령 가정
  { status: 'paid',      delivery_fee: 3000, order_items: [{ category: '검사도구', price_at_purchase: 35000, quantity: 1 }] },
  { status: 'pending',   delivery_fee: 3000, order_items: [{ category: '검사', price_at_purchase: 88000, quantity: 1 }] }, // 제외
  { status: 'cancelled', delivery_fee: 0,    order_items: [{ category: '도서', price_at_purchase: 18000, quantity: 1 }] }, // 제외
];
const ORDERS_ENDED = [
  { status: 'completed', delivery_fee: 3000, order_items: [{ category: '검사', price_at_purchase: 120000, quantity: 3 }] },
  { status: 'completed', delivery_fee: 3000, order_items: [{ category: '검사', price_at_purchase: 88000, quantity: 2 }] },
  { status: 'completed', delivery_fee: 6000, group: 'e1', order_items: [{ category: '도서', price_at_purchase: 25000, quantity: 4 }] },
  { status: 'completed', delivery_fee: 0,    group: 'e1', order_items: [{ category: '도서', price_at_purchase: 18000, quantity: 2 }] },
  { status: 'completed', delivery_fee: 3000, order_items: [{ category: '검사도구', price_at_purchase: 45000, quantity: 2 }] },
  { status: 'refunded',  delivery_fee: 0,    order_items: [{ category: '검사', price_at_purchase: 88000, quantity: 1 }] }, // 제외
];

// 현장 보고(field_reports — plain text)
const REPORTS_ACTIVE = [
  { id: 'fr-1', day_number: 1, author_name: '김현장', content: '추계학술대회 현장마케팅 1일차 보고드립니다.\n\n0. 판매\n검사 판매: 326,000원 (배송비 6,000원 포함)\n도서 판매: 110,000원\n합계: 436,000원\n\n1. 특이사항\nMMPI-2 샘플 관심 높음. 검사도구 추가 요청 있었음.' },
];
const REPORTS_ENDED = [
  { id: 'fr-1', day_number: 1, author_name: '김현장', content: '1일차 보고드립니다. 오전 한산, 오후 집중. 부스 위치 양호.' },
  { id: 'fr-2', day_number: 2, author_name: '정마스터', content: '2일차 보고드립니다. 도서 재고 소진 임박, 검사 샘플 반응 좋음.' },
];

// 시나리오 3종 — 예정 / 진행 중(지결 미완료인데 매출 있음) / 종료
const SCENARIOS = {
  active: {
    key: 'active', tab: '진행 중',
    hostSociety: '한국상담심리학회', season: '추계학술대회',
    name: '2026 한국상담심리학회 추계학술대회',
    startDate: '2026-10-11', endDate: '2026-10-13',
    venue: '부산 BEXCO 제1전시장', discountPercent: 15, urlSlug: 'kcpa-2026-fall',
    attendeeIds: ['u-me', 'u-002', 'u-004'], cost: 1200000,
    note: '부스 위치 A-12. 도서 위주 진열. 검사 샘플 2종 배치.',
    draftDone: true, applicationDone: true, paymentResolutionDone: false, // 지결 미완료인데 매출 있음
    setupTime: '10-10 18:00 ~ 20:00 쯤', teardownTime: '10-13 17:00 이후',
    venueName: '부산 BEXCO', venueAddress: '부산광역시 해운대구 APEC로 55', venueDetail: '제1전시장 3층 3A홀',
    orders: ORDERS_ACTIVE, reports: REPORTS_ACTIVE, hasNote: true,
  },
  upcoming: {
    key: 'upcoming', tab: '예정',
    hostSociety: '한국청소년상담학회', season: '세미나',
    name: '2026 한국청소년상담학회 세미나',
    startDate: '2026-12-05', endDate: '2026-12-06',
    venue: '서울 코엑스 그랜드볼룸', discountPercent: 10, urlSlug: 'kyc-2026-winter',
    attendeeIds: ['u-me'], cost: 0, note: '',
    draftDone: false, applicationDone: false, paymentResolutionDone: false,
    setupTime: '', teardownTime: '',
    venueName: '', venueAddress: '', venueDetail: '',
    orders: [], reports: [], hasNote: false,
  },
  ended: {
    key: 'ended', tab: '종료',
    hostSociety: '한국심리학회', season: '연차학술대회',
    name: '2026 한국심리학회 연차학술대회',
    startDate: '2026-09-13', endDate: '2026-09-15',
    venue: '대전 컨벤션센터', discountPercent: 20, urlSlug: 'kpa-2026-annual',
    attendeeIds: ['u-me', 'u-003', 'u-004'], cost: 2400000,
    note: '부스 위치 B-03. 검사 위주 진열.',
    draftDone: true, applicationDone: true, paymentResolutionDone: true,
    setupTime: '09-12 17:00 쯤', teardownTime: '09-15 16:00 이후',
    venueName: '대전컨벤션센터(DCC)', venueAddress: '대전광역시 유성구 엑스포로 107', venueDetail: '제2전시장 1층',
    orders: ORDERS_ENDED, reports: REPORTS_ENDED, hasNote: true,
  },
};

// 열람 이력(master만) — 흐름 밖 맨 아래
const VIEWS = [
  { user_id: 'u-004', name: '정마스터', position: '팀장', first: '09.10 09:12', last: '10.11 14:03', count: 7 },
  { user_id: 'u-002', name: '이부스', position: '', first: '09.20 11:40', last: '10.10 18:22', count: 3 },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');
const won = (n) => (n || 0).toLocaleString();
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const weekday = (iso) => (iso ? WEEKDAY_KO[new Date(`${iso}T00:00:00+09:00`).getDay()] : '');
const dotDay = (iso) => (iso ? `${dot(iso)}(${weekday(iso)})` : '');
const formatRange = (start, end) => {
  if (!start) return '';
  if (!end || end === start) return dotDay(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const endStr = sameYear ? `${dot(end).slice(5)}(${weekday(end)})` : dotDay(end);
  return `${dotDay(start)} ~ ${endStr}`;
};
const getTimeState = (start, end) => {
  if (!start || !end) return 'upcoming';
  if (end < TODAY) return 'ended';
  if (start > TODAY) return 'upcoming';
  return 'active';
};
const STATE_TO_STATUS = { active: 'paid', upcoming: 'pending', ended: 'completed' };
const STATE_TO_LABEL = { active: '진행 중', upcoming: '예정', ended: '종료' };

// 출고 현황 — 합배송 묶음(껍데기)을 1건으로 collapse. paid+completed만.
const countFulfillment = (orders) => {
  const seen = new Set();
  const units = [];
  for (const o of orders) {
    if (!PAID_STATUSES.includes(o.status)) continue;
    if (o.group) {
      if (seen.has(o.group)) continue; // 같은 묶음의 자식 — 1건으로만
      seen.add(o.group);
    }
    units.push(o.status);
  }
  const target = units.length;
  const done = units.filter((s) => s === 'completed').length;
  return { target, done, waiting: target - done };
};

const EventStateBadge = ({ start, end }) => {
  const st = getTimeState(start, end);
  return <StatusBadge value={STATE_TO_STATUS[st]} label={STATE_TO_LABEL[st]} size="md" />;
};

const DiscountChip = ({ percent }) => {
  const theme = useTheme();
  if (!percent || percent <= 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375, px: 0.75, py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.accent.revenue, 0.1),
        border: `1px solid ${alpha(theme.accent.revenue, 0.2)}`, flexShrink: 0,
      }}
    >
      <LocalOfferIcon sx={{ fontSize: 11, color: theme.accent.revenue }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.revenue, lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>
        {percent}%
      </Typography>
    </Box>
  );
};

// 참석자 칩 — L2 전체 펼침. "나" 우선·accent. master 보조 라벨.
const AttendeePillRow = ({ ids = [] }) => {
  const theme = useTheme();
  if (!ids.length) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  const ordered = [...ids].sort((a, b) => (a === ME.id ? -1 : b === ME.id ? 1 : 0));
  return (
    <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
      {ordered.map((id, i) => {
        const accent = id === ME.id;
        const name = STAFF_MAP[id]?.name || '(삭제)';
        const isMaster = STAFF_MAP[id]?.role === 'master';
        return (
          <Box
            key={`${id}-${i}`}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.375,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: accent ? alpha(theme.palette.primary.main, 0.08) : theme.gray[100],
              border: `1px solid ${accent ? alpha(theme.palette.primary.main, 0.24) : theme.gray[200]}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary', lineHeight: 1.3 }}>
              {accent ? `나 (${name})` : name}
            </Typography>
            {isMaster && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, lineHeight: 1.3 }}>· 마스터</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

const OverviewRow = ({ icon, label, children, alignTop }) => (
  <Box sx={{ display: 'flex', alignItems: alignTop ? 'flex-start' : 'center', gap: 1.5, py: 0.25 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: 88, flexShrink: 0, mt: alignTop ? 0.25 : 0 }}>
      {icon}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{label}</Typography>
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);
const ROW_ICON_SX = { fontSize: 16, color: 'text.disabled', flexShrink: 0 };

// 2차 예정 태그 — 점선 테두리로 "아직 비활성" 표시(룰 E: 가짜 기능 아님, 명시적 표기)
const SecondPhaseTag = () => {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.125, flexShrink: 0,
        borderRadius: `${theme.radii.sm}px`,
        border: `1px dashed ${theme.gray[300]}`, bgcolor: theme.gray[50],
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, lineHeight: 1.4 }}>2차 예정</Typography>
    </Box>
  );
};

// ─── 진행 요약 바 (읽기 전용 네비 · 단계 클릭 → 앵커 스크롤) ──────
// 6단계 유지. 모든 폭에서 6칸 한 줄(가로 스크롤 없음 — 모바일도 Read로 전체 파악).
//  - 375px(xs): 번호·체크 원 위 + 짧은 라벨 아래(세로), 6칸 균등.
//  - 820px(sm)·1280px(md+): 원 + 전체 라벨(가로), 6칸 균등.
// ②③④는 어느 것을 눌러도 합친 "상신·신청" 카드(ref=presubmit)로 이동 + 해당 행 잠깐 강조.
const STEPS = [
  { id: 'overview', target: 'overview', no: 1, nav: '개요', short: '개요' },
  { id: 'draft', target: 'presubmit', no: 2, nav: '기안서', short: '기안', col: 'draft' },
  { id: 'application', target: 'presubmit', no: 3, nav: '참석 신청', short: '신청', col: 'application' },
  { id: 'payment', target: 'presubmit', no: 4, nav: '지출결의서', short: '지출', col: 'paymentResolution' },
  { id: 'prep', target: 'prep', no: 5, nav: '참석준비', short: '준비' },
  { id: 'post', target: 'post', no: 6, nav: '사후 업무', short: '사후' },
];

const StepTab = ({ step, progress, onJump }) => {
  const theme = useTheme();
  const hasDone = !!step.col;
  const done = hasDone ? progress[step.col] : false;
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onJump(step)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(step); } }}
      sx={{
        display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'center',
        gap: { xs: 0.375, sm: 1 }, px: { xs: 0.25, sm: 1.5 }, minHeight: 44, flex: 1, minWidth: 0,
        borderRadius: `${theme.radii.md}px`, cursor: 'pointer',
        border: `1px solid ${done ? alpha(theme.palette.primary.main, 0.3) : theme.gray[200]}`,
        bgcolor: done ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        transition: `all 0.15s ${theme.easing.toss}`,
        '&:hover': { bgcolor: done ? alpha(theme.palette.primary.main, 0.12) : theme.gray[50], borderColor: done ? alpha(theme.palette.primary.main, 0.4) : theme.gray[300] },
        '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
      }}
    >
      <Box
        sx={{
          width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: done ? 'primary.main' : theme.gray[100],
          border: hasDone && !done ? `1.5px solid ${theme.gray[300]}` : 'none',
        }}
      >
        {done ? (
          <CheckIcon sx={{ fontSize: 13, color: 'primary.contrastText' }} />
        ) : (
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>
            {step.no}
          </Typography>
        )}
      </Box>
      {/* 모바일 = 짧은 라벨 / 태블릿·PC = 전체 라벨 */}
      <Typography variant="caption" sx={{ display: { xs: 'block', sm: 'none' }, fontWeight: 600, color: done ? 'primary.main' : 'text.primary', lineHeight: 1.2 }}>
        {step.short}
      </Typography>
      <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 600, color: done ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap' }}>
        {step.nav}
      </Typography>
    </Box>
  );
};

const SummaryBar = ({ progress, onJump }) => {
  const theme = useTheme();
  const doneCount = ['draft', 'application', 'paymentResolution'].filter((k) => progress[k]).length;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px`, p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>진행 단계</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
          상신 3단계 중 {doneCount}단계 완료 · 단계를 누르면 해당 항목으로 이동
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'nowrap' }}>
        {STEPS.map((step) => <StepTab key={step.id} step={step} progress={progress} onJump={onJump} />)}
      </Box>
    </Box>
  );
};

// ─── 완료 토글 체크 행 (②③④ — 합친 카드 안 3행. 기존 ProgressChip 상호작용 유지) ──
const ProgressCheckRow = ({ label, done, canEdit, flash, onToggle }) => {
  const theme = useTheme();
  return (
    <Box
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={canEdit ? onToggle : undefined}
      onKeyDown={canEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, minHeight: 44,
        borderRadius: `${theme.radii.md}px`, cursor: canEdit ? 'pointer' : 'default',
        bgcolor: done ? alpha(theme.palette.primary.main, 0.08) : theme.gray[50],
        border: `1px solid ${done ? alpha(theme.palette.primary.main, 0.3) : theme.gray[200]}`,
        boxShadow: flash ? theme.customShadows.focus : 'none',
        transition: `all 0.15s ${theme.easing.toss}`,
        '&:hover': canEdit ? { bgcolor: done ? alpha(theme.palette.primary.main, 0.14) : theme.gray[100], borderColor: done ? alpha(theme.palette.primary.main, 0.4) : theme.gray[300] } : {},
        '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
      }}
    >
      <Box
        sx={{
          width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: done ? 'primary.main' : 'transparent',
          border: done ? 'none' : `1.5px solid ${theme.gray[300]}`,
        }}
      >
        {done && <CheckIcon sx={{ fontSize: 14, color: 'primary.contrastText' }} />}
      </Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: done ? 700 : 600, color: done ? 'primary.main' : 'text.primary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 600, color: done ? 'primary.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
        {done ? '완료' : (canEdit ? '완료로 표시' : '미완료')}
      </Typography>
    </Box>
  );
};

// ─── 준비 노트 정적 렌더(실 페이지는 Toast UI 에디터/뷰어 유지 — 시안은 결과물만) ──
const PrepNoteStatic = () => {
  const theme = useTheme();
  const items = [
    { label: 'MMPI-2 검사 샘플 2종', done: true },
    { label: '발달심리 신간 도서 10부', done: true },
    { label: '부스 배너·거치대', done: false },
    { label: '카드 단말기 2대', done: false },
  ];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>준비물 체크리스트</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.map((it) => (
            <Box key={it.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 18, height: 18, flexShrink: 0, borderRadius: `${theme.radii.xs}px`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: it.done ? 'primary.main' : 'transparent',
                  border: it.done ? 'none' : `1.5px solid ${theme.gray[300]}`,
                }}
              >
                {it.done && <CheckIcon sx={{ fontSize: 12, color: 'primary.contrastText' }} />}
              </Box>
              <Typography variant="body2" sx={{ color: it.done ? 'text.disabled' : 'text.primary', textDecoration: it.done ? 'line-through' : 'none' }}>
                {it.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>부스 자료</Typography>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            height: 120, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}`,
          }}
        >
          <ImageIcon sx={{ fontSize: 24, color: theme.gray[400] }} />
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>프로그램 일정표.png · 부스 배치도.png</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── 현장 보고 정적(실: FieldReportSection CRUD) ────────────────
const FieldReportStatic = ({ reports, eventName, canEdit, onToast }) => {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const handleNew = () => {
    setContent(`${eventName} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: 원\n도서 판매: 원\n합계: 원\n\n1. 특이사항\n`);
    setEditing(true);
  };
  return (
    <Box>
      {!editing && canEdit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={handleNew} sx={{ minHeight: 36 }}>
            보고서 작성
          </Button>
        </Box>
      )}
      {editing && (
        <Box sx={{ mb: 2, p: 2, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
          <TextField fullWidth multiline minRows={5} maxRows={15} value={content} onChange={(e) => setContent(e.target.value)} sx={{ mb: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setEditing(false)}>취소</Button>
            <Button size="small" variant="contained" onClick={() => { setEditing(false); onToast('보고서 저장됨 (mock)'); }}>저장</Button>
          </Box>
        </Box>
      )}
      {reports.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>생성된 보고서가 없습니다</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {reports.map((r) => (
            <Box key={r.id} sx={{ p: 2, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={`${r.day_number || 1}일차`} size="small" sx={{ fontWeight: 700 }} />
                  {r.author_name && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.author_name}</Typography>}
                </Box>
                {canEdit && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => onToast('보고서 수정 (mock)')} aria-label="편집"><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => onToast('보고서 삭제 (mock)')} aria-label="삭제"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.content}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── 사후 업무 하위 블록(카드 안 카드 금지 — 라벨+구분선으로 구획) ──
const PostSubSection = ({ label, caption, first, children }) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: first ? 0 : 3, pt: first ? 0 : 3, borderTop: first ? 'none' : `1px solid ${theme.gray[100]}` }}>
      <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: caption ? 0.25 : 1.5 }}>{label}</Typography>
      {caption && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>{caption}</Typography>}
      {children}
    </Box>
  );
};

// ─── QR 다이얼로그(목록과 동일 구성 — SVG + 학회명 + 주소 + 다운로드 + 닫기) ──
const QrDialog = ({ open, event, qrSvg, onClose, onDownload }) => {
  const url = event ? `${window.location.origin}/order?events=${event.urlSlug}` : '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>QR 코드</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, '& svg': { maxWidth: '100%', height: 'auto' } }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        {event && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{event.name}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, wordBreak: 'break-all', fontFeatureSettings: '"tnum" 1' }}>{url}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onDownload}>SVG 다운로드</Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────
const EventDetailFlowPreview = () => {
  const theme = useTheme();
  const [scenarioKey, setScenarioKey] = useState('active');
  const event = SCENARIOS[scenarioKey];
  const canEdit = true; // events:edit 보유 가정

  const [progress, setProgress] = useState({ draft: false, application: false, paymentResolution: false });
  React.useEffect(() => {
    setProgress({ draft: event.draftDone, application: event.applicationDone, paymentResolution: event.paymentResolutionDone });
  }, [event]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const toast = (message) => setSnackbar({ open: true, message });

  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState('');

  const revenue = useMemo(() => computeRevenueByCategory(event.orders), [event]);
  const hasRevenue = revenue.total > 0;
  const fulfillment = useMemo(() => countFulfillment(event.orders), [event]);

  const orderUrl = `${window.location.origin}/order?events=${event.urlSlug}`;

  // 앵커 스크롤 + ②③④ 점프 시 해당 행 잠깐 강조
  const refs = useRef({});
  const setRef = (id) => (el) => { refs.current[id] = el; };
  const [flashStep, setFlashStep] = useState(null);
  const flashTimer = useRef(null);
  const jump = (step) => {
    refs.current[step.target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (step.target === 'presubmit' && step.col) {
      setFlashStep(step.col);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashStep(null), 1600);
    }
  };

  const openQr = async () => {
    try {
      const svg = await QRCode.toString(orderUrl, { type: 'svg', color: { dark: '#252525', light: '#FFFFFF' }, margin: 1, width: 300 });
      setQrSvg(svg);
      setQrOpen(true);
    } catch { toast('QR 생성 실패 (mock)'); }
  };
  const copyUrl = () => { navigator.clipboard?.writeText(orderUrl); toast('주문 URL이 복사되었습니다'); };
  const downloadQr = () => toast('SVG 다운로드 (mock)');

  // 장소(2차) — 주소 1회 탭 = 도로명 주소만 복사 / 지도 버튼은 터치 기기에서만 노출
  const isTouch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [forceTouch, setForceTouch] = useState(false); // 시안 전용: 데스크톱에서 터치 UI 미리보기
  const showMapButton = isTouch || forceTouch;
  const copyAddress = () => { navigator.clipboard?.writeText(event.venueAddress || ''); toast('주소를 복사했어요'); };
  const openNaverMap = () => toast('네이버 지도 열기 (2차, mock)'); // 실서비스: map.naver.com/p/search/{장소명 도로명주소} 새 탭

  const headerAction = (
    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => toast('학회 정보 수정 — 개요 편집 모드 (mock)')} sx={{ minHeight: 36 }}>
      학회 정보 수정
    </Button>
  );

  const cardGap = 3;

  return (
    <PreviewShell activePath="/admin/events">
      {/* 시연 전용 시나리오 토글(실서비스 없음) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700 }}>시나리오</Typography>
        {Object.values(SCENARIOS).map((s) => (
          <Chip
            key={s.key}
            label={s.tab}
            size="small"
            variant={scenarioKey === s.key ? 'filled' : 'outlined'}
            color={scenarioKey === s.key ? 'primary' : 'default'}
            onClick={() => setScenarioKey(s.key)}
            sx={{ fontWeight: scenarioKey === s.key ? 700 : 500, cursor: 'pointer' }}
          />
        ))}
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          진행 중 = 지결 미완료인데 매출 있음 · 합배송 포함 출고 현황
        </Typography>
        <Chip
          label="터치 기기 보기"
          size="small"
          variant={forceTouch ? 'filled' : 'outlined'}
          color={forceTouch ? 'primary' : 'default'}
          onClick={() => setForceTouch((v) => !v)}
          sx={{ fontWeight: forceTouch ? 700 : 500, cursor: 'pointer' }}
        />
      </Box>

      {/* 뒤로 */}
      <Box sx={{ mb: 1 }}>
        <Button size="small" variant="text" startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />} onClick={() => toast('학회 목록(L1)으로 (mock)')} sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}>
          학회 목록
        </Button>
      </Box>

      <PageHeader
        title={event.hostSociety}
        subtitle={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{event.season}</Box>
            <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>{formatRange(event.startDate, event.endDate)}</Box>
          </Box>
        }
        icon={EventNoteIcon}
        action={headerAction}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, mt: -1 }}>
        <EventStateBadge start={event.startDate} end={event.endDate} />
        <DiscountChip percent={event.discountPercent} />
      </Box>

      {/* 진행 요약 바 */}
      <SummaryBar progress={progress} onJump={jump} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: cardGap }}>
        {/* ① 학회 개요 */}
        <Box ref={setRef('overview')}>
          <SectionCard title="학회 개요" icon={EventNoteIcon}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <OverviewRow icon={<PlaceIcon sx={ROW_ICON_SX} />} label="장소">
                <Typography variant="body2" sx={{ color: event.venue ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>{event.venue || '—'}</Typography>
              </OverviewRow>
              <OverviewRow icon={<EventNoteIcon sx={ROW_ICON_SX} />} label="날짜">
                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>{formatRange(event.startDate, event.endDate)}</Typography>
              </OverviewRow>
              <OverviewRow icon={<PersonIcon sx={ROW_ICON_SX} />} label="참석자" alignTop>
                <AttendeePillRow ids={event.attendeeIds} />
              </OverviewRow>
              <OverviewRow icon={<CostIcon sx={ROW_ICON_SX} />} label="비용" alignTop>
                <Box>
                  <Typography variant="body2" sx={{ color: event.cost ? 'text.primary' : 'text.disabled', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{event.cost ? `${won(event.cost)}원` : '—'}</Typography>
                  {event.cost > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{numberToKoreanCurrency(event.cost)}원</Typography>
                  )}
                </Box>
              </OverviewRow>
              <OverviewRow icon={<NoteIcon sx={ROW_ICON_SX} />} label="비고" alignTop>
                <Typography variant="body2" sx={{ color: event.note ? 'text.primary' : 'text.disabled', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{event.note || '—'}</Typography>
              </OverviewRow>

              {/* 주문서 행 — 신규(1차) */}
              <OverviewRow icon={<QrCode2Icon sx={ROW_ICON_SX} />} label="주문서" alignTop>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all', display: 'block', mb: 1, fontFeatureSettings: '"tnum" 1' }}>{orderUrl}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} onClick={() => toast('주문 페이지 새 창 (mock)')} sx={{ minHeight: 36 }}>열기</Button>
                    <Button size="small" variant="outlined" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={copyUrl} sx={{ minHeight: 36 }}>복사</Button>
                    <Button size="small" variant="outlined" startIcon={<QrCode2Icon sx={{ fontSize: 16 }} />} onClick={openQr} sx={{ minHeight: 36 }}>QR</Button>
                  </Box>
                </Box>
              </OverviewRow>

              {/* 2차 예정 블록 — 설치·철거 시간 · 장소 분리(명/주소/상세)+복사+네이버 지도 */}
              <Box sx={{ mt: 1, pt: 2, borderTop: `1px solid ${theme.gray[100]}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <SecondPhaseTag />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>설치·철거 시간과 장소 상세(복사·지도)는 다음 업데이트에 추가돼요</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <OverviewRow icon={<ClockIcon sx={ROW_ICON_SX} />} label="설치 시간">
                    <Typography variant="body2" sx={{ color: event.setupTime ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>{event.setupTime || '—'}</Typography>
                  </OverviewRow>
                  <OverviewRow icon={<ClockIcon sx={ROW_ICON_SX} />} label="철거 시간">
                    <Typography variant="body2" sx={{ color: event.teardownTime ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>{event.teardownTime || '—'}</Typography>
                  </OverviewRow>
                  <OverviewRow icon={<PlaceIcon sx={ROW_ICON_SX} />} label="장소 상세" alignTop>
                    {event.venueName ? (
                      <Box>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{event.venueName}</Typography>
                        {/* 주소 1회 탭 = 도로명 주소(venue_address)만 복사(제스처 없음). 지도 버튼은 터치 기기에서만. (건우님 2026-10-12) */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.25 }}>
                          <Box
                            onClick={copyAddress}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', borderRadius: `${theme.radii.sm}px`, px: 0.5, mx: -0.5, '&:hover': { bgcolor: theme.gray[50] } }}
                          >
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.venueAddress}</Typography>
                            <ContentCopyIcon sx={{ fontSize: 14, color: theme.gray[400] }} />
                          </Box>
                          {/* 작은 "지도" 버튼 — 네이버 1종, 웹 URL, 터치 기기 전용 */}
                          {showMapButton && (
                            <Button size="small" variant="text" startIcon={<MapIcon sx={{ fontSize: 16 }} />} onClick={openNaverMap} sx={{ minHeight: 36, px: 1, color: 'primary.main' }}>지도</Button>
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>{event.venueDetail}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
                    )}
                  </OverviewRow>
                </Box>
              </Box>
            </Box>
          </SectionCard>
        </Box>

        {/* ②③④ 상신·신청 — 한 카드 안 체크 행 3개(기안서 상신 / 학회 참석 신청 / 부스 참가비 지출결의서 상신) */}
        <Box ref={setRef('presubmit')}>
          <SectionCard title="상신·신청" icon={DescriptionIcon}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <ProgressCheckRow label="기안서 상신" done={progress.draft} canEdit={canEdit} flash={flashStep === 'draft'} onToggle={() => setProgress((p) => ({ ...p, draft: !p.draft }))} />
              <ProgressCheckRow label="학회 참석 신청" done={progress.application} canEdit={canEdit} flash={flashStep === 'application'} onToggle={() => setProgress((p) => ({ ...p, application: !p.application }))} />
              <ProgressCheckRow label="부스 참가비 지출결의서 상신" done={progress.paymentResolution} canEdit={canEdit} flash={flashStep === 'paymentResolution'} onToggle={() => setProgress((p) => ({ ...p, paymentResolution: !p.paymentResolution }))} />
            </Box>
          </SectionCard>
        </Box>

        {/* ⑤ 참석준비 (준비 노트 — 완료 개념 없음) */}
        <Box ref={setRef('prep')}>
          <SectionCard
            title="참석준비"
            icon={PrepIcon}
            subtitle="준비물 체크리스트 · 학회 자료 · 설치/철거 안내를 한 곳에"
            action={event.hasNote ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => toast('준비 노트 편집 (mock)')} sx={{ minHeight: 36 }}>편집</Button>
              </Box>
            ) : undefined}
          >
            {event.hasNote ? (
              <PrepNoteStatic />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 5, px: 2 }}>
                <PrepIcon sx={{ fontSize: 44, color: theme.gray[300], mb: 1.5 }} />
                <Typography variant="subtitle1" sx={{ mb: 0.5 }}>준비 노트가 비어 있어요</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360, mb: 2.5 }}>준비물 체크리스트, 프로그램·부스 배치도 이미지, 설치·철거 안내 등을 한 곳에 정리하세요</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="outlined" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => toast('작성하기 (mock)')}>작성하기</Button>
                  <Button variant="text" startIcon={<TemplateIcon sx={{ fontSize: 16 }} />} onClick={() => toast('템플릿으로 시작 (2차, mock)')} sx={{ color: 'text.secondary' }}>
                    템플릿으로 시작
                  </Button>
                  <SecondPhaseTag />
                </Box>
              </Box>
            )}
          </SectionCard>
        </Box>

        {/* ⑥ 사후 업무 */}
        <Box ref={setRef('post')}>
          <SectionCard title="사후 업무" icon={ReportIcon} subtitle="매출 · 출고 현황 · 현장 보고 · 문서 내보내기">
            {/* 매출 요약 — 항상 표시(지결 연동 해제). 결제 완료 기준. */}
            <PostSubSection label="매출 요약" caption="결제 완료 주문 기준 · 배송비 포함" first>
              {hasRevenue ? (
                <Box>
                  <Box sx={{ mb: 3, pb: 3, borderBottom: `1px solid ${theme.gray[100]}` }}>
                    <StatCard variant="hero" label="총 매출액" value={won(revenue.total)} unit="원" icon={ReceiptIcon} color={theme.accent.revenue} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                    {[
                      { key: 'test', label: '검사 판매', rv: revenue.test, sh: revenue.testShipping, icon: TestIcon, color: theme.accent.tests },
                      { key: 'book', label: '도서 판매', rv: revenue.book, sh: revenue.bookShipping, icon: BookIcon, color: theme.accent.books },
                      { key: 'tool', label: '도구 판매', rv: revenue.tool, sh: revenue.toolShipping, icon: ToolIcon, color: CATEGORY_COLORS.tool },
                    ].filter((b) => b.rv > 0).map((b) => (
                      <Box key={b.key} sx={{ flex: 1, minWidth: 0 }}>
                        <StatCard label={`${b.label} (배송비 ${won(b.sh)}원 포함)`} value={won(b.rv)} unit="원" icon={b.icon} color={b.color} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                <EmptyState icon={ReceiptIcon} title="아직 매출이 없어요" description="결제 완료된 주문이 생기면 여기에 검사·도서·도구 매출이 표시됩니다" sx={{ py: 4 }} />
              )}
            </PostSubSection>

            {/* 출고 현황 — 매출과 다른 모집단. 합배송 묶음=1건, 현장수령 포함. 2칸(처리 완료·출고 대상). */}
            <PostSubSection label="출고 현황" caption="결제 완료·처리 완료 주문 기준 · 합배송 묶음은 1건 · 현장수령 포함">
              {fulfillment.target > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <StatCard label="처리 완료" value={fulfillment.done} unit="건" icon={CheckCircleIcon} color={theme.accent.revenue} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <StatCard label="출고 대상" value={fulfillment.target} unit="건" icon={ShippingIcon} color={theme.accent.shipping} />
                  </Box>
                </Box>
              ) : (
                <EmptyState icon={ShippingIcon} title="아직 출고 대상 주문이 없어요" description="결제 완료 주문이 생기면 처리 완료 건수가 표시됩니다" sx={{ py: 4 }} />
              )}
            </PostSubSection>

            {/* 현장 보고 */}
            <PostSubSection label="현장 보고">
              <FieldReportStatic reports={event.reports} eventName={event.name} canEdit={canEdit} onToast={toast} />
            </PostSubSection>

            {/* 문서 내보내기 — 헤더에서 이동(설계 메모는 코드 주석에만) */}
            <PostSubSection label="문서 내보내기">
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />} onClick={() => toast('입금결의서 내보내기 (mock)')} sx={{ minHeight: 40 }}>입금결의서</Button>
                <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />} onClick={() => toast('지불증 모달 열기 (mock)')} sx={{ minHeight: 40 }}>지불증</Button>
              </Box>
            </PostSubSection>
          </SectionCard>
        </Box>

        {/* 열람 이력 (master만 · 흐름 밖 맨 아래) */}
        <SectionCard title="열람 이력" icon={ViewsIcon} subtitle="이 학회 상세를 연 직원 · 마스터에게만 보여요">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {VIEWS.map((v) => (
              <Box key={v.user_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px solid ${theme.gray[100]}` }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {v.name}
                  {v.position && <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>{v.position}</Typography>}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>최근 {v.last}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFeatureSettings: '"tnum" 1', ml: 1, whiteSpace: 'nowrap' }}>{v.count}회</Typography>
              </Box>
            ))}
          </Box>
        </SectionCard>
      </Box>

      <QrDialog open={qrOpen} event={event} qrSvg={qrSvg} onClose={() => setQrOpen(false)} onDownload={downloadQr} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={<IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
      />
    </PreviewShell>
  );
};

export default EventDetailFlowPreview;
