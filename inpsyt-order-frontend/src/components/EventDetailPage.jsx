import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, useMediaQuery,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Menu, MenuItem, ListItemText,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  EventNote as EventNoteIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  StickyNote2Outlined as NoteIcon,
  PaymentsOutlined as CostIcon,
  Delete as DeleteIcon,
  ReceiptLong as ReceiptLongIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
  Receipt as ReceiptIcon,
  Psychology as TestIcon,
  MenuBook as BookIcon,
  Build as ToolIcon,
  Assignment as ReportIcon,
  LocalOffer as LocalOfferIcon,
  EditOutlined as PrepEditIcon,
  Close as CloseIcon,
  Inventory2Outlined as PrepIcon,
  VisibilityOutlined as ViewsIcon,
  QrCode2 as QrCode2Icon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircleOutline as CheckCircleIcon,
  LocalShippingOutlined as ShippingIcon,
  ScheduleOutlined as ClockIcon,
  Map as MapIcon,
  AutoAwesomeMotion as TemplateIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { getEventStatusKST } from '../utils/date';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { computeRevenueByCategory } from '../utils/revenueByCategory';
import { CATEGORY_COLORS } from '../constants/categoryColors';
import {
  getEventBySlug, updateEventProgress, updateEventPrepNote, getOrdersForEventRevenue,
  recordEventView, getEventViewers, getPrepNoteTemplates,
} from '../api/events';
import { getFulfillmentOrders, groupLinkedOrders } from '../api/orders';
import { fulfillmentCounts } from '../utils/fulfillmentCounts';
import { fetchProductCountByCategory, getProductCategoriesByIds } from '../api/products';
import { applyAutofill, normalizeEventPayload, isRequiredComplete } from '../utils/eventForm';
import { useSlugCheck } from '../hooks/useSlugCheck';
import { encodeForStorage } from '../utils/prepNoteImages';
import { buildOrderUrl, copyToClipboard, generateOrderQrSvg, downloadQrSvg } from '../utils/eventUrl';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, DraftBanner, DraftSavedHint } from './ui';
import { useFormDraft } from '../hooks/useFormDraft';
import FieldReportSection from './FieldReportSection';
import PaymentReceiptModal from './PaymentReceiptModal';
import EventQrDialog from './EventQrDialog';
import EventAutofillFields from './EventAutofillFields';
import EventRequiredFields from './EventRequiredFields';
import EventOptionalFields from './EventOptionalFields';
import EventCloseControl from './EventCloseControl';

// Toast UI 에디터/뷰어 = 무거운 의존성 → 지연 로드(초기/공개 번들 0 영향)
const PrepNoteEditor = lazy(() => import('./PrepNoteEditor'));
const PrepNoteViewer = lazy(() => import('./PrepNoteViewer'));

// ─── 헬퍼 ──────────────────────────────────────────────────────
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');
const won = (n) => (n || 0).toLocaleString();

// 요일 — KST 고정 자정 파싱(off-by-one 방지)
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const weekday = (iso) => (iso ? WEEKDAY_KO[new Date(`${iso}T00:00:00+09:00`).getDay()] : '');
const dotDay = (iso) => (iso ? `${dot(iso)}(${weekday(iso)})` : '');
// 단일일: 2026.06.07(토) / 기간: 2026.06.07(토) ~ 06.09(월) (같은 연도면 종료부 YYYY 생략)
const formatRange = (start, end) => {
  if (!start) return '';
  if (!end || end === start) return dotDay(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const endStr = sameYear ? `${dot(end).slice(5)}(${weekday(end)})` : dotDay(end);
  return `${dotDay(start)} ~ ${endStr}`;
};

// 시간상태 배지 — EventManagementPage 정합(getEventStatusKST → StatusBadge 토큰)
const STATUS_COLOR_TO_BADGE = { info: 'pending', success: 'paid', default: 'completed' };
const EventStateBadge = ({ start, end }) => {
  const st = getEventStatusKST(start, end);
  return <StatusBadge value={STATUS_COLOR_TO_BADGE[st.color] || 'pending'} label={st.label} size="md" />;
};

// 할인율 칩(>0%) — discount_rate(0~1) → %. EventManagementPage DiscountChip 정합.
const DiscountChip = ({ rate }) => {
  const theme = useTheme();
  const percent = Math.round((rate ?? 0) * 100);
  if (!percent || percent <= 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375,
        px: 0.75, py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.accent.revenue, 0.1),
        border: `1px solid ${alpha(theme.accent.revenue, 0.2)}`,
        flexShrink: 0,
      }}
    >
      <LocalOfferIcon sx={{ fontSize: 11, color: theme.accent.revenue }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: theme.accent.revenue, lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}
      >
        {percent}%
      </Typography>
    </Box>
  );
};

// 참석자 칩 — L2 전체 펼침. "나" 우선·accent. master 보조 라벨. 삭제 uuid = "(삭제)".
const AttendeePillRow = ({ ids = [], staffMap, myId }) => {
  const theme = useTheme();
  if (!ids.length) {
    return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  }
  const ordered = [...ids].sort((a, b) => (a === myId ? -1 : b === myId ? 1 : 0));
  return (
    <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
      {ordered.map((id, i) => {
        const accent = id === myId;
        const name = staffMap[id]?.name || '(삭제)';
        const isMaster = staffMap[id]?.role === 'master';
        return (
          <Box
            key={`${id}-${i}`}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.375,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: accent ? alpha(theme.palette.primary.main, 0.08) : theme.gray[100],
              border: `1px solid ${accent ? alpha(theme.palette.primary.main, 0.24) : theme.gray[200]}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary', lineHeight: 1.3 }}
            >
              {accent ? `나 (${name})` : name}
            </Typography>
            {isMaster && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, lineHeight: 1.3 }}>
                · 마스터
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// 개요 카드 한 줄(라벨 + 값)
const OverviewRow = ({ icon, label, children, alignTop }) => (
  <Box sx={{ display: 'flex', alignItems: alignTop ? 'flex-start' : 'center', gap: 1.5, py: 0.25 }}>
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        width: 88, flexShrink: 0,
        mt: alignTop ? 0.25 : 0,
      }}
    >
      {icon}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);

const ROW_ICON_SX = { fontSize: 16, color: 'text.disabled', flexShrink: 0 };

// ─── 진행 요약 바 (읽기 전용 네비 · 단계 클릭 → 앵커 스크롤) ──────
// 6단계 유지. 모든 폭에서 6칸 한 줄(가로 스크롤 없음 — 모바일도 Read로 전체 파악).
//  - 375px(xs): 번호·체크 원 위 + 짧은 라벨 아래(세로), 6칸 균등.
//  - 600px+(sm·md): 원 + 전체 라벨(가로), 6칸 균등.
// ②③④는 어느 것을 눌러도 합친 "상신·신청" 카드(target=presubmit)로 이동 + 해당 행 잠깐 강조.
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

// ─── 완료 토글 체크 행 (②③④ — 합친 카드 안 3행. 독립 토글·순서 강제 없음) ──
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

// ─── 사후 업무 하위 블록(카드 안 카드 금지 — 라벨+구분선으로 구획) ──
const PostSubSection = ({ label, caption, first, action, children }) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: first ? 0 : 3, pt: first ? 0 : 3, borderTop: first ? 'none' : `1px solid ${theme.gray[100]}` }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: caption ? 0.25 : 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{label}</Typography>
        {action}
      </Box>
      {caption && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>{caption}</Typography>}
      {children}
    </Box>
  );
};

// 에디터/뷰어 로딩 폴백
const EditorFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} /></Box>
);

// ─── 메인 ──────────────────────────────────────────────────────
const EventDetailPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // 지도 버튼은 터치 기기에서만 노출(현장 태블릿·폰). 너비가 아니라 터치 입력으로 판정(건우님 2026-10-12).
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');

  const canEdit = hasPermission('events:edit');
  const isMaster = hasPermission('master');
  const myId = user?.id || null;

  const [event, setEvent] = useState(null);
  const [staff, setStaff] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 진행상태(낙관적 로컬 + DB 반영)
  const [progress, setProgress] = useState({ draft: false, application: false, paymentResolution: false });

  // 매출
  const [orders, setOrders] = useState([]);
  // 미분류 보강 — order_items.category가 빈 품목의 product_id → products.category 조회본.
  const [productsMap, setProductsMap] = useState({});

  // 출고 현황 — { total, completed, pending } | null(미조회/실패 → 빈 상태 graceful)
  const [fulfillment, setFulfillment] = useState(null);

  // 준비 노트
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const getNoteHtmlRef = React.useRef(() => null); // 에디터 lazy 로드 전 = null(저장 가드)
  // 준비 노트 임시저장 — 키 = prepNote:{userId}:{eventId} (게시판 bulletin draft와 type 구분).
  // 에디터 진입 시점 주입값(prep_note 또는 이어쓰기한 draft). 에디터는 마운트 1회 생성 →
  // seed 교체 시 editorKey 증가로 강제 재마운트(빈↔빈 등 동일 내용 재마운트도 보장).
  const [noteSeed, setNoteSeed] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const noteDraft = useFormDraft('prepNote', event?.id, { enabled: canEdit && !!event?.id });

  // 준비노트 템플릿(A12) — "템플릿으로 시작" 선택지. 조회 실패/0개면 숨김(페이지는 정상 동작).
  const [templates, setTemplates] = useState([]);
  const [templateAnchor, setTemplateAnchor] = useState(null);

  // 라이트박스
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // 학회 정보 수정 — 개요 SectionCard "읽기 요약 ↔ 편집 폼" 모드 스왑(2026-07-28, 모달 폐기)
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState(null);
  const [savingOverview, setSavingOverview] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState(null); // 판매 대분류 실 집계 미리보기
  const overviewRef = useRef(null);
  const editParamHandledRef = useRef(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 주문서 QR 다이얼로그(목록·상세 공용)
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState('');

  // 진행 요약 바 앵커 스크롤 + ②③④ 점프 시 해당 행 잠깐 강조
  const sectionRefs = useRef({});
  const setSectionRef = (id) => (el) => { sectionRefs.current[id] = el; };
  const [flashStep, setFlashStep] = useState(null);
  const flashTimer = useRef(null);

  // 개요 편집 폼 slug 검사 — 자기 자신(event.id) 제외.
  const slugState = useSlugCheck(overviewForm?.order_url_slug || '', { excludeId: event?.id });

  // 열람 이력 — master만. null = 미조회/미적용 환경(섹션 숨김)
  const [views, setViews] = useState(null);
  const recordedIdRef = React.useRef(null);

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [ev, staffRes, societiesRes] = await Promise.all([
        getEventBySlug(slug),
        supabase
          .from('user_profiles')
          .select('id, name, role, position, department')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
        supabase.from('societies').select('id, name, slug_prefix').order('name', { ascending: true }),
      ]);
      if (!ev) { setNotFound(true); setEvent(null); return; }
      setEvent(ev);
      setProgress({
        draft: !!ev.draft_done,
        application: !!ev.application_done,
        paymentResolution: !!ev.payment_resolution_done,
      });
      if (!staffRes.error && staffRes.data) setStaff(staffRes.data);
      if (!societiesRes.error && societiesRes.data) setSocieties(societiesRes.data);

      // 매출 주문 — paid 필터는 util이 수행(모집단 = 자식 실주문)
      try {
        const ords = await getOrdersForEventRevenue(ev.id);
        setOrders(ords);
        // 미분류 보강 — category 빈 품목의 product_id만 조회(없으면 조회 생략).
        const missingIds = [];
        for (const o of ords) {
          for (const it of o.order_items || []) {
            if (!it.category && it.product_id) missingIds.push(it.product_id);
          }
        }
        try { setProductsMap(missingIds.length ? await getProductCategoriesByIds(missingIds) : {}); }
        catch { setProductsMap({}); }
      } catch { setOrders([]); setProductsMap({}); }

      // 출고 현황 — 출고 관리와 동일 규칙(paid+completed · 합배송 껍데기=1건). 매출과 모집단 다름.
      try {
        const fData = await getFulfillmentOrders({ eventId: ev.id, statuses: ['paid', 'completed'] });
        setFulfillment(fulfillmentCounts(groupLinkedOrders(fData || [])));
      } catch { setFulfillment(null); }
    } catch (e) {
      console.error(e);
      addNotification('학회 정보를 불러오지 못했습니다.', 'error');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, addNotification]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  // 준비노트 템플릿 목록 — edit자만 필요. 실패 시 빈 배열(="템플릿으로 시작" 숨김, 페이지 정상).
  useEffect(() => {
    if (!canEdit) return undefined;
    let cancelled = false;
    getPrepNoteTemplates()
      .then((t) => { if (!cancelled) setTemplates(t); })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [canEdit]);

  // 열람 기록(진입 1회) + master 열람 이력 조회 — 테이블/RPC 미적용 환경이면 조용히 스킵
  const eventId = event?.id || null;
  useEffect(() => {
    if (!eventId || recordedIdRef.current === eventId) return;
    recordedIdRef.current = eventId;
    (async () => {
      try { await recordEventView(eventId); } catch { /* 미적용 환경 — 페이지 차단 금지 */ }
      if (!isMaster) return;
      try { setViews(await getEventViewers(eventId)); } catch { setViews(null); }
    })();
  }, [eventId, isMaster]);

  // L1 ⋯메뉴 "수정" 경유(?edit=1) — 진입 시 개요 편집 모드 자동 진입 + 스크롤, 이후 param 제거(새로고침 재진입 방지)
  useEffect(() => {
    if (editParamHandledRef.current || !event || !canEdit) return;
    if (searchParams.get('edit') !== '1') return;
    editParamHandledRef.current = true;
    setOverviewForm({ ...event });
    setEditingOverview(true);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
    setTimeout(() => overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [event, canEdit, searchParams, setSearchParams]);

  // 판매 대분류 미리보기 카운트 — 편집 모드 진입 시 1회(실 집계만).
  useEffect(() => {
    if (!editingOverview || categoryCounts) return undefined;
    let cancelled = false;
    fetchProductCountByCategory()
      .then((c) => { if (!cancelled) setCategoryCounts(c); })
      .catch(() => { if (!cancelled) setCategoryCounts({}); });
    return () => { cancelled = true; };
  }, [editingOverview, categoryCounts]);

  // 권한 가드
  if (user && !hasPermission('events:view')) {
    return <Box sx={{ p: 3 }}><Typography>학회 상세 접근 권한이 없습니다.</Typography></Box>;
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  if (notFound || !event) {
    return (
      <Box>
        <Box sx={{ mb: 1 }}>
          <Button
            size="small" variant="text"
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/admin/events')}
            sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}
          >
            학회 목록
          </Button>
        </Box>
        <SectionCard padding={20}>
          <EmptyState
            icon={EventNoteIcon}
            title="학회를 찾을 수 없어요"
            description="주소가 바뀌었거나 삭제된 학회일 수 있어요"
            action={{ label: '학회 목록으로', onClick: () => navigate('/admin/events') }}
          />
        </SectionCard>
      </Box>
    );
  }

  const handleToggleProgress = async (key, column) => {
    if (!canEdit) return;
    const next = !progress[key];
    setProgress((p) => ({ ...p, [key]: next })); // 낙관적
    try {
      await updateEventProgress(event.id, { [column]: next });
    } catch {
      setProgress((p) => ({ ...p, [key]: !next })); // 롤백
      addNotification('진행 상태 저장에 실패했습니다.', 'error');
    }
  };

  // 진행 요약 바 → 섹션 앵커 스크롤 + (②③④면) 해당 행 ~1.6초 강조
  const jumpToStep = (step) => {
    sectionRefs.current[step.target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (step.target === 'presubmit' && step.col) {
      setFlashStep(step.col);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashStep(null), 1600);
    }
  };

  // ─── 개요 인라인 편집 ───────────────────────────────────
  const startEditOverview = () => {
    setOverviewForm({ ...event });
    setEditingOverview(true);
  };
  const cancelEditOverview = () => {
    setEditingOverview(false);
    setOverviewForm(null);
  };
  // 편집은 isEditing:true — slug 자동 재생성 차단(수동 편집 보존).
  const handleOverviewChange = (name, value) => {
    setOverviewForm((prev) => applyAutofill(prev, name, value, { societies, isEditing: true }));
  };
  const handleSocietyAdded = (newSociety) => {
    const nextSocieties = [...societies, newSociety].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    setSocieties(nextSocieties);
    setOverviewForm((prev) => applyAutofill(prev, 'host_society', newSociety.name, { societies: nextSocieties, isEditing: true }));
  };

  const canSaveOverview = isRequiredComplete(overviewForm) && slugState.isAvailable && !savingOverview;
  let saveDisableReason = '';
  if (editingOverview && !canSaveOverview && !savingOverview) {
    if (!overviewForm?.name) saveDisableReason = '행사명을 입력하세요.';
    else if (!overviewForm?.order_url_slug) saveDisableReason = '주문 URL을 입력하세요.';
    else if (slugState.formatBad) saveDisableReason = '주문 URL 형식을 확인하세요.';
    else if (slugState.reserved) saveDisableReason = "'new'는 사용할 수 없는 주소입니다.";
    else if (!overviewForm?.start_date || !overviewForm?.end_date) saveDisableReason = '행사 기간을 선택하세요.';
    else if (!overviewForm?.estimated_delivery_date) saveDisableReason = '배송 예정일을 선택하세요.';
    else if (slugState.isBusy) saveDisableReason = '주문 URL 중복 확인 중입니다.';
    else if (slugState.taken) saveDisableReason = '이미 사용중인 주문 URL입니다.';
    else if (slugState.error) saveDisableReason = '주문 URL 중복 검사에 실패했습니다. 다시 시도하세요.';
  }

  const handleSaveOverview = async () => {
    if (!canSaveOverview) return;
    setSavingOverview(true);
    const payload = normalizeEventPayload(overviewForm);
    const { error } = await supabase.from('events').update(payload).eq('id', event.id);
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
      setSavingOverview(false);
      return;
    }
    addNotification('학회 정보를 저장했습니다.', 'success');
    const newSlug = overviewForm.order_url_slug;
    setEditingOverview(false);
    setOverviewForm(null);
    setSavingOverview(false);
    // slug 변경 시 새 주소로 이동(구 slug 재조회 시 미발견 방지), 아니면 재조회
    if (newSlug && newSlug !== slug) {
      navigate(`/admin/events/${newSlug}`, { replace: true });
    } else {
      loadEvent();
    }
  };

  // 삭제 — master 전부 / onsite 본인 생성만. 연결 주문 0건일 때만.
  const canDelete = isMaster || (canEdit && !!event.created_by && event.created_by === myId);
  const handleDeleteClick = async () => {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id);
    if (error) {
      addNotification(`확인 실패: ${error.message}`, 'error');
      return;
    }
    if (count > 0) {
      addNotification(`이 행사에 연결된 주문 ${count}건이 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    setDeleteConfirmOpen(true);
  };
  const handleDeleteConfirm = async () => {
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
      return;
    }
    addNotification('행사가 삭제되었습니다.', 'success');
    setDeleteConfirmOpen(false);
    navigate('/admin/events', { replace: true });
  };

  // 준비 노트 편집 진입 — draft 유무는 배너로 분기. 에디터는 현재 저장본(prep_note)으로 시작.
  const handleEditNote = () => {
    setNoteSeed(event.prep_note || '');
    setEditorKey((k) => k + 1);
    setEditingNote(true);
  };
  // 이어쓰기: draft 본문을 에디터 seed로 주입(에디터 재마운트). 배너만 닫음(draft는 보존).
  const handleResumeNote = () => {
    setNoteSeed(noteDraft.draft || '');
    setEditorKey((k) => k + 1);
    noteDraft.dismiss();
  };
  // 새로쓰기: draft 삭제 후 현재 저장본으로 에디터 재마운트.
  const handleDiscardNote = () => {
    noteDraft.clearDraft();
    setNoteSeed(event.prep_note || '');
    setEditorKey((k) => k + 1);
  };

  const handleSaveNote = async () => {
    if (!canEdit) return;
    const raw = getNoteHtmlRef.current();
    if (raw === null) return; // 에디터 준비 전(lazy 로드·이미지 재서명 중) — 본문 유실 방지
    setSavingNote(true);
    try {
      const html = encodeForStorage(raw); // 서명 URL → 경로 플레이스홀더(만료 무관 저장형)
      await updateEventPrepNote(event.id, html);
      setEvent((e) => ({ ...e, prep_note: html }));
      setEditingNote(false);
      noteDraft.clearDraft(); // 저장 성공 → 임시저장 즉시 소거(유령 복구 방지)
      addNotification('준비 노트를 저장했습니다.', 'success');
    } catch {
      addNotification('준비 노트 저장에 실패했습니다.', 'error');
    }
    setSavingNote(false);
  };

  const handleExportDeposit = async () => {
    setExporting(true);
    try {
      const data = await getOrdersForEventRevenue(event.id);
      const { exportDepositResolution } = await import('../utils/depositResolution');
      const result = await exportDepositResolution({
        event,
        orders: data,
        productsMap,
        authorName: profile?.name || '',
        department: profile?.department || '',
      });
      // exportDepositResolution이 unclassified를 반환하면(집계 외 매출) 경고. 미반환이면 0으로 방어.
      const unclassified = result?.unclassified ?? 0;
      if (unclassified > 0) {
        addNotification(
          `미분류 매출 ${won(unclassified)}원이 있어 적요 합계와 계가 다를 수 있습니다. 상품 카테고리를 확인하세요.`,
          'warning',
        );
      } else {
        addNotification('입금결의서를 내보냈습니다.', 'success');
      }
    } catch (e) {
      console.error(e);
      addNotification(`입금결의서 내보내기 실패: ${e.message}`, 'error');
    }
    setExporting(false);
  };

  // ─── 주문서(열기·복사·QR) — 목록과 동일 동작 ───────────────
  const orderUrl = buildOrderUrl(event.order_url_slug);
  const handleOpenOrder = () => window.open(orderUrl, '_blank');
  const handleCopyOrderUrl = async () => {
    const ok = await copyToClipboard(orderUrl);
    addNotification(
      ok ? '주문 URL이 클립보드에 복사되었습니다.' : '주문 URL 복사에 실패했습니다.',
      ok ? 'success' : 'error',
    );
  };
  const handleOpenQr = async () => {
    try {
      setQrSvg(await generateOrderQrSvg(orderUrl));
      setQrOpen(true);
    } catch {
      addNotification('QR 코드 생성에 실패했습니다.', 'error');
    }
  };
  const handleDownloadQr = () => {
    if (!qrSvg) return;
    downloadQrSvg(qrSvg, event.order_url_slug);
    addNotification('QR 코드가 다운로드되었습니다.', 'success');
  };

  // ─── 장소(2차) — 주소 1회 탭 = 도로명 주소만 복사 / 작은 "지도" 버튼(네이버·터치 기기 전용) ──
  // 장소 행 = 장소명 + 홀·층 상세. 없으면 레거시 venue 폴백.
  const venueMain = [event.venue_name, event.venue_detail].filter(Boolean).join(' ') || event.venue || '';
  const handleCopyVenueAddress = async () => {
    if (!event.venue_address) return;
    const ok = await copyToClipboard(event.venue_address);
    addNotification(ok ? '주소를 복사했어요' : '주소 복사에 실패했어요', ok ? 'success' : 'error');
  };
  const handleOpenNaverMap = () => {
    const query = `${event.venue_name || ''} ${event.venue_address || ''}`.trim();
    window.open(`https://map.naver.com/p/search/${encodeURIComponent(query)}`, '_blank');
  };

  // ─── "템플릿으로 시작"(A12) — 기존 편집 진입 경로 재사용. 템플릿 주입이 draft보다 우선. ──
  const handleStartFromTemplate = (template) => {
    setTemplateAnchor(null);
    noteDraft.dismiss(); // draft 배너 숨김(템플릿 우선 — §2-4)
    setNoteSeed(template.body_html || '');
    setEditorKey((k) => k + 1);
    setEditingNote(true);
  };

  const revenue = computeRevenueByCategory(orders, { productsMap });
  const hasRevenue = revenue.total > 0;
  const hasFulfillment = !!fulfillment && fulfillment.total > 0;
  const titleName = event.host_society || event.name;

  // 개요 카드 액션 = "편집"(참석준비 카드와 같은 형태). 헤더 액션은 두지 않는다(2026-10-12 건우님).
  const overviewAction = canEdit && !editingOverview ? (
    <Button
      size="small" variant="outlined"
      startIcon={<PrepEditIcon sx={{ fontSize: 16 }} />}
      onClick={startEditOverview}
      sx={{ minHeight: 36 }}
    >
      편집
    </Button>
  ) : undefined;

  return (
    <Box>
      {/* 뒤로(학회 목록) */}
      <Box sx={{ mb: 1 }}>
        <Button
          size="small" variant="text"
          startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
          onClick={() => navigate('/admin/events')}
          sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}
        >
          학회 목록
        </Button>
      </Box>

      <PageHeader
        title={titleName}
        subtitle={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{event.event_season}</Box>
            {event.event_season && <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>}
            <Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>
              {formatRange(event.start_date, event.end_date)}
            </Box>
          </Box>
        }
        icon={EventNoteIcon}
      />
      {/* 상태배지 + 할인율 — 헤더 직하 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, mt: -1 }}>
        <EventStateBadge start={event.start_date} end={event.end_date} />
        <DiscountChip rate={event.discount_rate} />
      </Box>

      {/* 진행 요약 바 */}
      <SummaryBar progress={progress} onJump={jumpToStep} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ─── ① 학회 개요 (읽기 요약 ↔ 편집 폼 모드 스왑) ─── */}
        <Box ref={(el) => { overviewRef.current = el; sectionRefs.current.overview = el; }}>
          <SectionCard title="학회 개요" icon={EventNoteIcon} action={overviewAction}>
            {editingOverview && overviewForm ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <EventAutofillFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  societies={societies}
                  onSocietyAdded={handleSocietyAdded}
                />
                <EventRequiredFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  slugState={slugState}
                  originalSlug={event.order_url_slug}
                />
                <EventOptionalFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  staff={staff}
                  categoryCounts={categoryCounts}
                />

                {/* 편집 푸터 — [삭제(mr:auto)] [취소] [저장] */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {saveDisableReason && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'right' }}>
                      {saveDisableReason}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ mr: 'auto' }}>
                      {canDelete && (
                        <Button onClick={handleDeleteClick} color="error" startIcon={<DeleteIcon />} disabled={savingOverview}>
                          삭제
                        </Button>
                      )}
                    </Box>
                    <Button onClick={cancelEditOverview} disabled={savingOverview}>취소</Button>
                    <Button variant="contained" onClick={handleSaveOverview} disabled={!canSaveOverview}>
                      {savingOverview ? '저장중...' : '저장'}
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <OverviewRow icon={<PlaceIcon sx={ROW_ICON_SX} />} label="장소" alignTop>
                  <Box>
                    <Typography variant="body2" sx={{ color: venueMain ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                      {venueMain || '—'}
                    </Typography>
                    {/* 주소 줄 — 1회 탭 = 도로명 주소(venue_address)만 복사. 지도 버튼은 터치 기기에서만 인라인. */}
                    {event.venue_address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={handleCopyVenueAddress}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyVenueAddress(); } }}
                          sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                            borderRadius: `${theme.radii.sm}px`, px: 0.5, mx: -0.5, minHeight: 32,
                            '&:hover': { bgcolor: theme.gray[50] },
                            '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
                          }}
                        >
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.venue_address}</Typography>
                          <ContentCopyIcon sx={{ fontSize: 14, color: theme.gray[400] }} />
                        </Box>
                        {isTouchDevice && (
                          <Button size="small" variant="text" startIcon={<MapIcon sx={{ fontSize: 16 }} />} onClick={handleOpenNaverMap} sx={{ minHeight: 36, px: 1, color: 'primary.main' }}>
                            지도
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                </OverviewRow>
                <OverviewRow icon={<ClockIcon sx={ROW_ICON_SX} />} label="설치 시간">
                  <Typography variant="body2" sx={{ color: event.setup_time ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                    {event.setup_time || '—'}
                  </Typography>
                </OverviewRow>
                <OverviewRow icon={<ClockIcon sx={ROW_ICON_SX} />} label="철거 시간">
                  <Typography variant="body2" sx={{ color: event.teardown_time ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                    {event.teardown_time || '—'}
                  </Typography>
                </OverviewRow>
                <OverviewRow icon={<EventNoteIcon sx={ROW_ICON_SX} />} label="날짜">
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
                    {formatRange(event.start_date, event.end_date) || '—'}
                  </Typography>
                </OverviewRow>
                <OverviewRow icon={<PersonIcon sx={ROW_ICON_SX} />} label="참석자" alignTop>
                  <AttendeePillRow ids={event.attendee_ids || []} staffMap={staffMap} myId={myId} />
                </OverviewRow>
                <OverviewRow icon={<CostIcon sx={ROW_ICON_SX} />} label="비용" alignTop>
                  <Box>
                    <Typography variant="body2" sx={{ color: event.marketing_cost ? 'text.primary' : 'text.disabled', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                      {event.marketing_cost ? `${won(event.marketing_cost)}원` : '—'}
                    </Typography>
                    {event.marketing_cost > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {numberToKoreanCurrency(event.marketing_cost)}원
                      </Typography>
                    )}
                  </Box>
                </OverviewRow>
                <OverviewRow icon={<NoteIcon sx={ROW_ICON_SX} />} label="비고" alignTop>
                  <Typography variant="body2" sx={{ color: event.note ? 'text.primary' : 'text.disabled', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {event.note || '—'}
                  </Typography>
                </OverviewRow>

                {/* 주문서 행 — 신규(1차). 주소 + 열기·복사·QR */}
                <OverviewRow icon={<QrCode2Icon sx={ROW_ICON_SX} />} label="주문서" alignTop>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all', display: 'block', mb: 1, fontFeatureSettings: '"tnum" 1' }}>
                      {orderUrl}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} onClick={handleOpenOrder} sx={{ minHeight: 36 }} disabled={!!event.closed_at}>열기</Button>
                      <Button size="small" variant="outlined" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={handleCopyOrderUrl} sx={{ minHeight: 36 }} disabled={!!event.closed_at}>복사</Button>
                      <Button size="small" variant="outlined" startIcon={<QrCode2Icon sx={{ fontSize: 16 }} />} onClick={handleOpenQr} sx={{ minHeight: 36 }} disabled={!!event.closed_at}>QR</Button>
                    </Box>
                  </Box>
                </OverviewRow>

                {/* 학회 종료 처리(현장 도움 PIN 주문) — 주문서 행 바로 아래 구분선 뒤(L2 §16). events:edit 전용, 자체 가드. */}
                <EventCloseControl event={event} canEdit={canEdit} onChanged={loadEvent} addNotification={addNotification} />
              </Box>
            )}
          </SectionCard>
        </Box>

        {/* ─── ②③④ 상신·신청 (완료 체크 행 3개) ─── */}
        <Box ref={setSectionRef('presubmit')}>
          <SectionCard title="상신·신청" icon={DescriptionIcon} subtitle={canEdit ? '각 항목을 눌러 완료 여부를 표시하세요 (독립 항목)' : undefined}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <ProgressCheckRow label="기안서 상신" done={progress.draft} canEdit={canEdit} flash={flashStep === 'draft'} onToggle={() => handleToggleProgress('draft', 'draft_done')} />
              <ProgressCheckRow label="학회 참석 신청" done={progress.application} canEdit={canEdit} flash={flashStep === 'application'} onToggle={() => handleToggleProgress('application', 'application_done')} />
              <ProgressCheckRow label="부스 참가비 지출결의서 상신" done={progress.paymentResolution} canEdit={canEdit} flash={flashStep === 'paymentResolution'} onToggle={() => handleToggleProgress('paymentResolution', 'payment_resolution_done')} />
            </Box>
          </SectionCard>
        </Box>

        {/* ─── ⑤ 참석준비 (통합 에디터) ─── */}
        <Box ref={setSectionRef('prep')}>
          <SectionCard
            title="참석준비"
            icon={PrepIcon}
            subtitle="준비물 체크리스트 · 학회 자료(이미지) · 설치/철거 안내를 한 곳에"
            action={
              canEdit && !editingNote ? (
                <Button
                  size="small" variant="outlined"
                  startIcon={<PrepEditIcon sx={{ fontSize: 16 }} />}
                  onClick={handleEditNote}
                  sx={{ minHeight: 36 }}
                >
                  편집
                </Button>
              ) : undefined
            }
          >
            {editingNote ? (
              <Box>
                {noteDraft.hasDraft && (
                  <DraftBanner
                    savedLabel={noteDraft.savedLabel}
                    onResume={handleResumeNote}
                    onDiscard={handleDiscardNote}
                  />
                )}
                <Suspense fallback={<EditorFallback />}>
                  <PrepNoteEditor
                    key={editorKey}
                    eventId={event.id}
                    initialValue={noteSeed}
                    onReady={(getHtml) => { getNoteHtmlRef.current = getHtml; }}
                    onChange={(html) => noteDraft.saveDraft(html)}
                    onImageError={(msg) => addNotification(msg, 'warning')}
                  />
                </Suspense>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요
                  </Typography>
                  <DraftSavedHint savedLabel={noteDraft.savedLabel} sx={{ ml: { sm: 'auto' } }} />
                  <Button size="small" onClick={() => setEditingNote(false)} disabled={savingNote}>취소</Button>
                  <Button size="small" variant="contained" onClick={handleSaveNote} disabled={savingNote}>
                    {savingNote ? '저장중...' : '저장'}
                  </Button>
                </Box>
              </Box>
            ) : event.prep_note ? (
              <Suspense fallback={<EditorFallback />}>
                <PrepNoteViewer content={event.prep_note} onImageClick={(src) => setLightboxSrc(src)} />
              </Suspense>
            ) : (
              // 빈 상태 — 작성하기 + (템플릿 1개 이상·edit자) "템플릿으로 시작". EmptyState 톤 정합.
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 6, px: 2 }}>
                <Box sx={{ mb: 2, color: 'grey.300', lineHeight: 0 }}><PrepIcon sx={{ fontSize: 48 }} /></Box>
                <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 0.5 }}>준비 노트가 비어 있어요</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360, mb: canEdit ? 2.5 : 0 }}>
                  준비물 체크리스트, 프로그램·부스 배치도 이미지, 설치·철거 안내 등을 한 곳에 정리하세요
                </Typography>
                {canEdit && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button variant="outlined" startIcon={<PrepEditIcon sx={{ fontSize: 16 }} />} onClick={handleEditNote}>작성하기</Button>
                    {templates.length > 0 && (
                      <Button variant="text" startIcon={<TemplateIcon sx={{ fontSize: 16 }} />} onClick={(e) => setTemplateAnchor(e.currentTarget)} sx={{ color: 'text.secondary' }}>
                        템플릿으로 시작
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </SectionCard>
        </Box>

        {/* ─── ⑥ 사후 업무 (01 보고 → 02 매출 요약, 2026-10-19 개편) ─── */}
        <Box ref={setSectionRef('post')}>
          <SectionCard title="사후 업무" icon={ReportIcon} subtitle="보고 · 매출 요약">
            {/* 01 보고 — 현장 보고(일차별 접이식·제자리 편집·복사·금액 업데이트) */}
            <PostSubSection label="01 보고" first>
              <FieldReportSection
                eventId={event.id}
                eventName={event.name}
                revenueData={{
                  testRevenue: revenue.test,
                  bookRevenue: revenue.book,
                  toolRevenue: revenue.tool,
                  totalRevenue: revenue.total,
                  testShipping: revenue.testShipping,
                  bookShipping: revenue.bookShipping,
                  toolShipping: revenue.toolShipping,
                }}
                canEdit={canEdit}
                orders={orders}
                eventStartDate={event.start_date}
                eventEndDate={event.end_date}
                productsMap={productsMap}
              />
            </PostSubSection>

            {/* 02 매출 요약 — 항상 표시(지결 연동 해제). 입금결의서·지불증 블록 액션. 출고 현황 흡수. */}
            <PostSubSection
              label="02 매출 요약"
              caption="결제 완료 주문 기준 · 배송비 포함"
              action={(
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small" variant="outlined"
                    startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />}
                    onClick={handleExportDeposit}
                    disabled={exporting}
                    sx={{ minHeight: 36 }}
                  >
                    {exporting ? '생성중...' : '입금결의서'}
                  </Button>
                  <Button
                    size="small" variant="outlined"
                    startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setReceiptOpen(true)}
                    sx={{ minHeight: 36 }}
                  >
                    지불증
                  </Button>
                </Box>
              )}
            >
              {/* 미분류 경고 — 합계가 버킷 합과 어긋남(입금결의서 경고와 같은 조건·금액). */}
              {revenue.unclassified > 0 && (
                <Box
                  sx={{
                    mb: 2, p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start',
                    bgcolor: alpha(theme.accent.attention, 0.08),
                    border: `1px solid ${alpha(theme.accent.attention, 0.3)}`,
                    borderRadius: `${theme.radii.sm}px`,
                  }}
                >
                  <WarningIcon sx={{ fontSize: 18, color: theme.accent.attention, mt: '1px' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    카테고리를 알 수 없는 매출 {won(revenue.unclassified)}원이 있어 검사·도서·도구 합계가 총 매출액과 다릅니다.
                  </Typography>
                </Box>
              )}
              {hasRevenue ? (
                <Box>
                  <Box sx={{ mb: 3, pb: 3, borderBottom: `1px solid ${theme.gray[100]}` }}>
                    <StatCard
                      variant="hero"
                      label="총 매출액"
                      value={won(revenue.total)}
                      unit="원"
                      icon={ReceiptIcon}
                      color={theme.accent.revenue}
                    />
                  </Box>
                  {/* 검사/도서/도구 3버킷(도구 독립, 2026-06-24). 0원 버킷 숨김 → 1~3열 동적 분할. */}
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                    {[
                      { key: 'test', label: '검사 판매', revenue: revenue.test, shipping: revenue.testShipping, icon: TestIcon, color: theme.accent.tests },
                      { key: 'book', label: '도서 판매', revenue: revenue.book, shipping: revenue.bookShipping, icon: BookIcon, color: theme.accent.books },
                      { key: 'tool', label: '도구 판매', revenue: revenue.tool, shipping: revenue.toolShipping, icon: ToolIcon, color: CATEGORY_COLORS.tool },
                    ]
                      .filter(b => b.revenue > 0)
                      .map(b => (
                        <Box key={b.key} sx={{ flex: 1, minWidth: 0 }}>
                          <StatCard
                            label={`${b.label} (배송비 ${won(b.shipping)}원 포함)`}
                            value={won(b.revenue)}
                            unit="원"
                            icon={b.icon}
                            color={b.color}
                          />
                        </Box>
                      ))}
                  </Box>
                </Box>
              ) : (
                <EmptyState
                  icon={ReceiptIcon}
                  title="아직 매출이 없어요"
                  description="결제 완료된 주문이 생기면 여기에 검사·도서·도구 매출이 표시됩니다"
                  sx={{ py: 4 }}
                />
              )}

              {/* 출고 현황 — 매출과 다른 모집단(합배송 묶음=1건·현장수령 포함). 블록 안 아래쪽. */}
              <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${theme.gray[100]}` }}>
                <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: 0.25 }}>출고 현황</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                  결제 완료·처리 완료 주문 기준 · 합배송 묶음은 1건 · 현장수령 포함
                </Typography>
                {hasFulfillment ? (
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <StatCard label="처리 완료" value={fulfillment.completed} unit="건" icon={CheckCircleIcon} color={theme.accent.revenue} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <StatCard label="출고 대상" value={fulfillment.total} unit="건" icon={ShippingIcon} color={theme.accent.shipping} />
                    </Box>
                  </Box>
                ) : (
                  <EmptyState
                    icon={ShippingIcon}
                    title="아직 출고 대상 주문이 없어요"
                    description="결제 완료 주문이 생기면 처리 완료 건수가 표시됩니다"
                    sx={{ py: 4 }}
                  />
                )}
              </Box>
            </PostSubSection>
          </SectionCard>
        </Box>

        {/* ─── 열람 이력 (master만 · 흐름 밖 맨 아래) ─── */}
        {isMaster && Array.isArray(views) && views.length > 0 && (
          <SectionCard title="열람 이력" icon={ViewsIcon} subtitle="이 학회 상세를 연 직원 · 마스터에게만 보여요">
            {isMobile ? (
              // 모바일 — 가로 스크롤 금지(건우님 모바일 원칙). 행 단위(이름 + 최근 열람·횟수). 최초 열람 생략.
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {views.map((v) => (
                  <Box key={v.user_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: `1px solid ${theme.gray[100]}` }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {v.name || '(삭제)'}
                      {v.position && (
                        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>
                          {v.position}
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>
                      최근 {v.last_viewed_at ? format(new Date(v.last_viewed_at), 'MM.dd HH:mm') : '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFeatureSettings: '"tnum" 1', ml: 1, whiteSpace: 'nowrap' }}>
                      {v.view_count || 0}회
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>이름</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>최초 열람</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>최근 열람</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>횟수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {views.map((v) => (
                      <TableRow key={v.user_id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {v.name || '(삭제)'}
                            {v.position && (
                              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>
                                {v.position}
                              </Typography>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                            {v.first_viewed_at ? format(new Date(v.first_viewed_at), 'MM.dd HH:mm') : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                            {v.last_viewed_at ? format(new Date(v.last_viewed_at), 'MM.dd HH:mm') : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                            {v.view_count || 0}회
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        )}
      </Box>

      {/* 삭제 확인 다이얼로그 — 개요 편집 푸터 삭제 버튼 경유(주문 0건 확인 후) */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>행사 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{event.name}</strong> 행사를 삭제합니다.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 지불증 모달 */}
      <PaymentReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        event={event}
        staff={staff}
      />

      {/* 주문서 QR 다이얼로그 (목록·상세 공용) */}
      <EventQrDialog
        open={qrOpen}
        name={event.name}
        url={orderUrl}
        qrSvg={qrSvg}
        onClose={() => setQrOpen(false)}
        onDownload={handleDownloadQr}
      />

      {/* "템플릿으로 시작" — 템플릿 이름 선택 메뉴. 선택 → 기존 편집 진입 경로 재사용(A12 §2-1). */}
      <Menu anchorEl={templateAnchor} open={Boolean(templateAnchor)} onClose={() => setTemplateAnchor(null)}>
        {templates.map((t) => (
          <MenuItem key={t.id} onClick={() => handleStartFromTemplate(t)} sx={{ minHeight: 44 }}>
            <ListItemText
              primary={t.name}
              secondary={`수정 ${dot((t.updated_at || '').slice(0, 10))}`}
              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
              secondaryTypographyProps={{ variant: 'caption', sx: { fontFeatureSettings: '"tnum" 1' } }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* 이미지 라이트박스 */}
      <Dialog
        open={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
        maxWidth={false}
        slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', m: 2 } } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <IconButton
            onClick={() => setLightboxSrc(null)}
            aria-label="닫기"
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: alpha('#000', 0.4), '&:hover': { bgcolor: alpha('#000', 0.6) } }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxSrc && (
            <Box
              component="img"
              src={lightboxSrc}
              alt="학회 자료 확대"
              onClick={() => setLightboxSrc(null)}
              sx={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 1, cursor: 'zoom-out', display: 'block' }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
};

export default EventDetailPage;
