import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Divider, Tooltip, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Password as PinIcon,
  Inventory2Outlined as ProductIcon,
  PersonOutline as PersonIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as EmptyCircleIcon,
  EditNote as ManualIcon,
  QrCode2 as QrCode2Icon,
  OpenInNew as OpenInNewIcon,
  EventBusy as EventBusyIcon,
  ReplayOutlined as ReplayIcon,
  NotificationsActive as ReadyIcon,
  VolumeUp as VolumeIcon,
  ArrowForward as ArrowForwardIcon,
  WarningAmberRounded as WarningIcon,
  PlaceOutlined as PlaceIcon,
  CreditCard as CreditCardIcon,
  ShoppingCartOutlined as CartIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusBadge, InfoRow, EmptyState } from './ui';
import { STATUS_TO_KOREAN, STATUS_COLORS } from '../constants/orderStatus';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/pin-order-admin
 * 현장 도움(PIN) 주문 — 어드민·학회 흐름 시안 (트랙 B).
 * 정적 Preview (mock 데이터, 실 도메인 미연결). 건우님 마일스톤 검수용.
 *
 * 사양: DOCS/PRD_현장도움주문.md §2·§4·§5·§6·§7
 *       design-system/specs/{A1_OrderManagementPage, A2_NewOrderModal, A2_OrderDetailModal, L2_EventDetail}.md
 *
 * 개발용 단계 토글(상단 칩)로 6단계를 전환한다:
 *  ① "+신규 주문" → 분기 선택(PIN 주문 / 수기 주문)
 *  ② PIN 주문 생성 → 준비중 + PIN 크게
 *  ③ 주문 상세(준비중): PIN 재표시 · "상품 n종 / 고객 정보 ○✕" · 상품 담기
 *  ④ 고객 제출 → 결제대기 전환 + "결제 준비 완료" 토스트·알림음
 *  ⑤ 주문 목록 행: 준비중 뱃지 + PIN (일괄 변경 제외)
 *  ⑥ 학회 상세 종료 처리 → 2단계 확인(삭제 건수) → 종료 상태·재개
 *
 * 어드민은 forced-colors 분기를 넣지 않는다(고대비 영구 제외 — MEMORY decision_no_admin_forced_colors).
 */

// ── 상태 상수(두 트랙 공통) — 실 반영은 constants/orderStatus.js 확장분.
// code 'preparing' / 라벨 '준비중' / 색 #64748B. REVENUE_STATUSES 미포함.
// ALLOWED_TRANSITIONS.preparing = ['cancelled'] (결제대기 전환은 자동이라 드롭다운 대상 아님).
const PREPARING = { code: 'preparing', label: '준비중', color: '#64748B' };
const STATUS_LABEL = { ...STATUS_TO_KOREAN, [PREPARING.code]: PREPARING.label };
const STATUS_COLOR = { ...STATUS_COLORS, [PREPARING.code]: PREPARING.color };

// ── Mock: 진행 중 학회(PIN 주문 생성 시 자동 선택 대상) ───────────
const EVENT = {
  id: 7,
  hostSociety: '한국심리학회',
  season: '2026 연차학술대회',
  startDate: '2026-10-18',
  endDate: '2026-10-20',
  discountPercent: 10,
  urlSlug: 'kpa-2026',
};

// ── Mock: 담당자가 담아 둔 상품(실제 도서명) ──────────────────────
const CART_ITEMS = [
  { name: 'K-WAIS-IV 전문가 지침서', list: 48000, qty: 1 },
  { name: '발달심리학 (제11판)', list: 32000, qty: 1 },
];
const DISCOUNT_RATE = EVENT.discountPercent / 100;
const won = (n) => n.toLocaleString();
const cartCalc = (items) => {
  const subtotal = items.reduce((s, it) => s + it.list * it.qty, 0);
  const discount = Math.round(items.reduce((s, it) => s + it.list * DISCOUNT_RATE * it.qty, 0));
  const deliveryFee = subtotal >= 30000 ? 0 : 3000; // 정가 기준 무료배송 임계치
  return { subtotal, discount, deliveryFee, final: subtotal - discount + deliveryFee };
};

// ── Mock: 주문 목록(⑤) — 준비중 1건(PIN) + 일반 상태 혼합 ─────────
const LIST_ROWS = [
  { id: 1042, status: 'preparing', pin: '0427', name: null, final: 72000, date: '2026-10-19 13:42' },
  { id: 1041, status: 'pending', name: '홍길동', final: 108000, date: '2026-10-19 13:10' },
  { id: 1038, status: 'paid', name: '이수진', final: 55000, date: '2026-10-19 12:28' },
  { id: 1035, status: 'completed', name: '박민호', final: 240000, date: '2026-10-18 17:55' },
  { id: 1030, status: 'cancelled', name: '김영희', final: 0, date: '2026-10-18 11:03' },
];

const PREPARING_DELETE_COUNT = 3; // 종료 처리 시 삭제될 준비중 주문 건수(mock)

const STAGES = [
  { n: 1, key: 'branch', tab: '① 신규 주문 분기', nav: '/admin/orders' },
  { n: 2, key: 'create', tab: '② PIN 주문 생성', nav: '/admin/orders' },
  { n: 3, key: 'detail-preparing', tab: '③ 주문 상세(준비중)', nav: '/admin/orders' },
  { n: 4, key: 'detail-pending', tab: '④ 고객 제출→결제대기', nav: '/admin/orders' },
  { n: 5, key: 'list', tab: '⑤ 주문 목록', nav: '/admin/orders' },
  { n: 6, key: 'event-close', tab: '⑥ 학회 종료 처리', nav: '/admin/events' },
];

// ── 상태 칩(준비중 포함) — StatusBadge 톤과 동일, preparing 색 정확히 고정 ──
const StatusPill = ({ status, size = 'md' }) => {
  const theme = useTheme();
  if (status !== PREPARING.code) return <StatusBadge value={status} size={size} />;
  const color = STATUS_COLOR[status];
  const dim = size === 'sm' ? { px: 0.75, py: 0.25, dot: 5 } : { px: 1, py: 0.5, dot: 6 };
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.625,
        px: dim.px, py: dim.py, borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.2)}`,
      }}
    >
      <Box sx={{ width: dim.dot, height: dim.dot, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color, lineHeight: 1 }}>{PREPARING.label}</Typography>
    </Box>
  );
};

// ── PIN 칩(목록·상세에서 준비중 뱃지 옆) ─────────────────────────
const PinChip = ({ pin }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        px: 0.875, py: 0.375, borderRadius: `${theme.radii.sm}px`,
        bgcolor: theme.gray[100], border: `1px solid ${theme.gray[200]}`,
      }}
    >
      <PinIcon sx={{ fontSize: 13, color: theme.gray[500] }} />
      <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.12em', fontFeatureSettings: '"tnum" 1', color: theme.gray[700] }}>
        {pin}
      </Typography>
    </Box>
  );
};

// ── PIN 큰 표시 + 복사(생성 직후·상세) — "큰 숫자 + 복사"만, 장식 없음 ──
const PinDisplay = ({ pin, onCopy }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        textAlign: 'center', py: 3, px: 2,
        borderRadius: `${theme.radii.lg}px`,
        bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}`,
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>안내 번호 (PIN)</Typography>
      <Typography
        sx={{
          fontWeight: 800, fontSize: { xs: '2.75rem', sm: '3.25rem' }, lineHeight: 1.1, my: 1,
          letterSpacing: '0.22em', color: 'text.primary', fontFeatureSettings: '"tnum" 1',
        }}
      >
        {pin}
      </Typography>
      <Button variant="outlined" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={onCopy}>
        번호 복사
      </Button>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, maxWidth: 420, mx: 'auto', lineHeight: 1.6 }}>
        고객에게 이 번호를 불러 주세요. 고객이 주문서 상품 검색창에 입력하면 배송지 작성으로 이어집니다. 고객이 제출하면 번호는 사라집니다.
      </Typography>
    </Box>
  );
};

// ── "상품 n종 / 고객 정보 ○✕" 준비 상태 줄 ──────────────────────
const ReadinessRow = ({ itemCount, hasCustomer }) => {
  const theme = useTheme();
  const pill = (icon, label, ok) => (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: 1.25, py: 0.75, borderRadius: `${theme.radii.md}px`,
        bgcolor: ok ? alpha(theme.accent.revenue, 0.08) : theme.gray[50],
        border: `1px solid ${ok ? alpha(theme.accent.revenue, 0.25) : theme.gray[200]}`,
      }}
    >
      {icon}
      <Typography variant="body2" sx={{ fontWeight: 600, color: ok ? theme.accent.revenue : 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
  const okIcon = <CheckCircleIcon sx={{ fontSize: 18, color: theme.accent.revenue }} />;
  const noIcon = <EmptyCircleIcon sx={{ fontSize: 18, color: theme.gray[400] }} />;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {pill(itemCount > 0 ? okIcon : noIcon, `상품 ${itemCount}종`, itemCount > 0)}
        {pill(hasCustomer ? okIcon : noIcon, `고객 정보 ${hasCustomer ? '○' : '✕'}`, hasCustomer)}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, lineHeight: 1.6 }}>
        상품(1개 이상)과 고객 정보가 모두 채워지면 자동으로 <b>결제대기</b>로 바뀌고 “결제 준비 완료” 알림(토스트·알림음)이 울려요.
      </Typography>
    </Box>
  );
};

// ── 모달처럼 보이는 프레임(프리뷰에서 모달 내용을 그대로 노출) ────
const ModalFrame = ({ title, onClose, maxWidth = 760, children }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box
        sx={{
          width: '100%', maxWidth,
          bgcolor: 'background.paper', borderRadius: `${theme.radii.lg}px`,
          border: `1px solid ${theme.gray[200]}`, boxShadow: theme.customShadows.md, overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${theme.gray[100]}` }}>
          <Typography variant="h5" sx={{ flex: 1 }}>{title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
        </Box>
        <Box sx={{ p: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
};

// ── 주문 상품 목록(상세 내부) — 휴대폰 폭에선 세로 카드(가로 스크롤 없음) ──
const ItemsTable = ({ items }) => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  if (isPhone) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((it) => {
          const unit = Math.round(it.list * (1 - DISCOUNT_RATE));
          return (
            <Box key={it.name} sx={{ p: 1.5, borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{it.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                  <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>{won(it.list)}</Box>
                  {' → '}
                  <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>{won(unit)}</Box>
                  {` × ${it.qty}`}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', fontFeatureSettings: '"tnum" 1' }}>{won(unit * it.qty)}원</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }
  return (
    <TableContainer sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px` }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>상품명</TableCell>
            <TableCell align="right">정가</TableCell>
            <TableCell align="right">할인가</TableCell>
            <TableCell align="right">수량</TableCell>
            <TableCell align="right">합계</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((it) => {
            const unit = Math.round(it.list * (1 - DISCOUNT_RATE));
            return (
              <TableRow key={it.name}>
                <TableCell sx={{ fontWeight: 600 }}>{it.name}</TableCell>
                <TableCell align="right" sx={{ color: 'text.disabled', textDecoration: 'line-through', fontFeatureSettings: '"tnum" 1' }}>{won(it.list)}</TableCell>
                <TableCell align="right" sx={{ color: 'error.main', fontWeight: 700, fontFeatureSettings: '"tnum" 1' }}>{won(unit)}</TableCell>
                <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{it.qty}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main', fontFeatureSettings: '"tnum" 1' }}>{won(unit * it.qty)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ── 결제 정보 블록 ──────────────────────────────────────────────
const PaymentBlock = ({ calc }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <InfoRow label="정가의 합" value={`${won(calc.subtotal)}원`} mono labelWidth={96} />
    <InfoRow label="할인" value={`- ${won(calc.discount)}원`} mono labelWidth={96} />
    <InfoRow label="배송비" value={calc.deliveryFee > 0 ? `${won(calc.deliveryFee)}원` : '무료'} mono labelWidth={96} />
    <Divider sx={{ my: 0.5 }} />
    <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
      <Typography variant="body2" sx={{ flex: '0 0 96px', fontWeight: 700, color: 'text.secondary' }}>총 결제 금액</Typography>
      <Typography sx={{ flex: 1, fontWeight: 800, fontSize: '1.1rem', color: 'primary.main', fontFeatureSettings: '"tnum" 1' }}>{won(calc.final)}원</Typography>
    </Box>
  </Box>
);

// ───────────────────────────────────────────────────────────────
const PinOrderAdminPreview = () => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [stage, setStage] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', ready: false });
  const [closeDialog, setCloseDialog] = useState({ open: false, step: 1 });
  const [eventClosed, setEventClosed] = useState(false);

  const toast = (message, ready = false) => setSnackbar({ open: true, message, ready });
  const calc = useMemo(() => cartCalc(CART_ITEMS), []);
  const activeStage = STAGES.find((s) => s.n === stage);

  // ④ 진입 시 "결제 준비 완료" 알림(토스트·알림음) 자동 발화
  useEffect(() => {
    if (stage === 4) toast('결제 준비 완료 — 고객과 함께 확인한 뒤 카드로 결제하세요.', true);
  }, [stage]);

  const customerMock = {
    name: '정○○',
    phone: '010-2345-6789',
    postcode: '06236',
    address: '서울특별시 강남구 테헤란로 123',
    detail: '4층 인싸이트 부스',
  };

  // ── 상세(준비중/결제대기 공용) ─────────────────────────────────
  const renderDetail = (preparing) => (
    <ModalFrame title="상품주문정보 조회" onClose={() => setStage(5)}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 주문 상세 정보 */}
        <SectionCard title="주문 상세 정보" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <InfoRow label="상품주문번호" value="#1042" labelWidth={96} mono />
            <InfoRow label="주문일" value="2026. 10. 19. 오후 1:42" labelWidth={96} />
            <InfoRow label="학회명" value={`${EVENT.hostSociety} · ${EVENT.season}`} labelWidth={96} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
              <Typography variant="caption" sx={{ flex: '0 0 96px', fontWeight: 600, color: 'text.secondary' }}>상태</Typography>
              <StatusPill status={preparing ? 'preparing' : 'pending'} />
              {preparing && <PinChip pin="0427" />}
            </Box>
          </Box>
        </SectionCard>

        {/* 준비 상태 줄 */}
        <SectionCard title="준비 상태" padding={20}>
          <ReadinessRow itemCount={CART_ITEMS.length} hasCustomer={!preparing} />
        </SectionCard>

        {/* 주문자 정보 */}
        <SectionCard title="주문자 정보" padding={20}>
          {preparing ? (
            <EmptyState
              icon={PersonIcon}
              title="고객이 아직 제출하지 않았어요"
              description="고객이 PIN으로 배송지(성함·연락처·주소)를 입력·제출하면 여기에 표시됩니다."
              sx={{ py: 3 }}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <InfoRow label="주문자명" value={customerMock.name} labelWidth={96} />
              <InfoRow label="연락처" value={customerMock.phone} labelWidth={96} mono />
              <InfoRow label="인싸이트 ID" value="N/A" labelWidth={96} muted />
            </Box>
          )}
        </SectionCard>

        {/* 배송지 정보 — 3필드 분리 유지 */}
        <SectionCard title="배송지 정보" padding={20}>
          {preparing ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>고객 제출 전에는 배송지가 비어 있습니다.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <InfoRow label="우편번호" value={customerMock.postcode} labelWidth={96} mono />
              <InfoRow label="주소" value={customerMock.address} labelWidth={96} multiline />
              <InfoRow label="상세 주소" value={customerMock.detail} labelWidth={96} multiline />
              <InfoRow label="배송 메모" value="없음" labelWidth={96} muted />
            </Box>
          )}
        </SectionCard>

        {/* 주문 상품 목록 — 상품 담기(ProductPickerDialog 재사용) */}
        <SectionCard
          title="주문 상품 목록"
          padding={20}
          action={
            <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => toast('상품 담기 — ProductPickerDialog(고객 상품 선택 UX 재사용) 열기 (mock)')} sx={{ minHeight: 40 }}>
              상품 담기
            </Button>
          }
        >
          <ItemsTable items={CART_ITEMS} />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
            행사 할인율({EVENT.discountPercent}%)·배송비가 자동 계산됩니다. 미리 담아도, 고객 제출 뒤 담아도 됩니다.
          </Typography>
        </SectionCard>

        {/* 결제 정보 */}
        <SectionCard title="결제 정보" padding={20}>
          <PaymentBlock calc={calc} />
        </SectionCard>

        {/* 하단 안내·액션 */}
        {preparing ? (
          <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}` }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
              고객이 제출해 <b>고객 정보 ○</b>가 되면 자동으로 결제대기로 바뀝니다. 그때 태블릿 화면을 고객에게 보여 주며 함께 확인한 뒤 결제하세요.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.accent.revenue, 0.06), border: `1px solid ${alpha(theme.accent.revenue, 0.25)}` }}>
            <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 1.5 }}>
              <b>결제 준비 완료.</b> 태블릿 화면의 상품·금액을 고객과 함께 확인한 뒤 카드로 결제하세요.
            </Typography>
            <Button variant="contained" startIcon={<CreditCardIcon sx={{ fontSize: 18 }} />} onClick={() => toast('카드 결제 처리 — 기존 결제 흐름 (mock)')}>
              카드 결제 진행
            </Button>
          </Box>
        )}
      </Box>
    </ModalFrame>
  );

  // ── ① 신규 주문 분기 ──────────────────────────────────────────
  const renderBranch = () => {
    const option = (icon, title, desc, onClick, primary) => (
      <Box
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        sx={{
          flex: 1, minWidth: 0, p: 2.5, cursor: 'pointer',
          borderRadius: `${theme.radii.lg}px`,
          border: `1px solid ${primary ? theme.palette.primary.main : theme.gray[200]}`,
          bgcolor: primary ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
          transition: `all 0.15s ${theme.easing.toss}`,
          '&:hover': { borderColor: theme.palette.primary.main, boxShadow: theme.customShadows.sm },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: `${theme.radii.md}px`, bgcolor: primary ? alpha(theme.palette.primary.main, 0.1) : theme.gray[100], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
          <Typography variant="subtitle1">{title}</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{desc}</Typography>
      </Box>
    );
    return (
      <ModalFrame title="신규 주문 추가" onClose={() => setStage(5)} maxWidth={620}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>어떤 방식으로 주문을 만들까요?</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          {option(
            <PinIcon sx={{ fontSize: 22, color: 'primary.main' }} />,
            'PIN 주문',
            '고객이 PIN으로 배송지를 입력합니다. 진행 중인 학회를 고르면 준비중 주문과 PIN이 만들어져요.',
            () => setStage(2),
            true,
          )}
          {option(
            <ManualIcon sx={{ fontSize: 22, color: theme.gray[600] }} />,
            '수기 주문',
            '기존 방식 그대로입니다(전화·구두 주문). 담당자가 고객 정보·상품을 직접 입력합니다.',
            () => toast('수기 주문 — 기존 NewOrderModal (현행 유지, mock)'),
            false,
          )}
        </Box>
      </ModalFrame>
    );
  };

  // ── ② PIN 주문 생성 ──────────────────────────────────────────
  const renderCreate = () => (
    <ModalFrame title="PIN 주문 만들기" onClose={() => setStage(5)} maxWidth={620}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 학회 — 진행 중인 학회 자동 선택 */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>학회 / 행사</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.75, borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}`, bgcolor: theme.gray[50] }}>
            <StatusBadge value="paid" label="진행중" size="sm" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{EVENT.hostSociety} · {EVENT.season}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>2026.10.18 ~ 10.20 · 할인 {EVENT.discountPercent}%</Typography>
            </Box>
            <Chip size="small" label="자동 선택" sx={{ bgcolor: theme.gray[100], color: theme.gray[700], fontWeight: 600 }} />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>진행 중인 학회가 자동으로 선택됩니다. 필요하면 다른 학회로 바꿀 수 있어요.</Typography>
        </Box>
        <Box sx={{ p: 1.75, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}` }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            <b>상품은 지금 담지 않아도 됩니다.</b> 0개로 만든 뒤 미리 담거나, 고객이 제출한 뒤 담아도 됩니다.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PinIcon sx={{ fontSize: 18 }} />} onClick={() => { setStage(3); toast('준비중 주문 1건 생성 · PIN 발급 (mock)'); }}>
          PIN 주문 만들기
        </Button>
      </Box>
    </ModalFrame>
  );

  // 생성 직후 화면(준비중 + PIN 크게) — ③ 상단에 겸하여 노출
  const renderCreatedHero = () => (
    <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusPill status="preparing" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>준비중 주문 #1042 생성됨 · 매출·출고·합배송에서 제외됩니다.</Typography>
      </Box>
      <PinDisplay pin="0427" onCopy={() => toast('안내 번호 0427 복사됨')} />
    </Box>
  );

  // ── ⑤ 주문 목록 ──────────────────────────────────────────────
  const renderList = () => {
    const header = (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>준비중 행은 준비중 뱃지 옆에 PIN이 함께 보입니다. 일괄 변경·매출·출고·합배송 후보에서 제외됩니다.</Typography>
        <Button variant="contained" startIcon={<AddIcon sx={{ fontSize: 18 }} />} onClick={() => setStage(1)}>신규 주문</Button>
      </Box>
    );
    if (isPhone) {
      return (
        <SectionCard title="주문 관리" icon={CartIcon}>
          {header}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {LIST_ROWS.map((r) => {
              const preparing = r.status === PREPARING.code;
              return (
                <Box
                  key={r.id}
                  onClick={() => preparing ? setStage(3) : toast(`주문 #${r.id} 상세 (mock)`)}
                  sx={{ p: 2, borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}`, cursor: 'pointer', '&:hover': { borderColor: theme.gray[300] } }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>{r.date}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <StatusPill status={r.status} size="sm" />
                      {preparing && <PinChip pin={r.pin} />}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {r.name || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>작성 중 (고객 제출 전)</Box>}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: 'primary.main', fontFeatureSettings: '"tnum" 1' }}>{won(r.final)}원</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </SectionCard>
      );
    }
    return (
      <SectionCard title="주문 관리" icon={CartIcon}>
        {header}
        <TableContainer sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px` }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>주문번호</TableCell>
                <TableCell>고객명</TableCell>
                <TableCell align="right">총 금액</TableCell>
                <TableCell>주문일시</TableCell>
                <TableCell>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {LIST_ROWS.map((r) => {
                const preparing = r.status === PREPARING.code;
                return (
                  <TableRow
                    key={r.id}
                    hover
                    onClick={() => preparing ? setStage(3) : toast(`주문 #${r.id} 상세 (mock)`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      {preparing ? (
                        <Tooltip title="준비중 주문은 일괄 변경 대상이 아니에요" arrow>
                          <span><Checkbox disabled size="small" /></span>
                        </Tooltip>
                      ) : (
                        <Checkbox size="small" />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFeatureSettings: '"tnum" 1' }}>#{r.id}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {r.name || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>작성 중</Box>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{won(r.final)}원</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>{r.date}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <StatusPill status={r.status} size="sm" />
                        {preparing && (
                          <>
                            <PinChip pin={r.pin} />
                            <Button size="small" variant="text" color="error" onClick={() => toast('준비중 주문 취소 (mock)')} sx={{ minHeight: 32, px: 1 }}>취소</Button>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
          준비중 주문의 상태 전이는 <b>취소</b>만 가능합니다(결제대기 전환은 자동이라 드롭다운 대상이 아님). 체크박스·일괄 상태 변경 대상에서 제외됩니다.
        </Typography>
      </SectionCard>
    );
  };

  // ── ⑥ 학회 상세 종료 처리 ─────────────────────────────────────
  const renderEventClose = () => {
    const orderUrl = `${window.location.origin}/order?events=${EVENT.urlSlug}`;
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <PageHeader
          title={EVENT.hostSociety}
          subtitle={<Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>{EVENT.season} · 2026.10.18(일) ~ 10.20(화)</Box>}
          icon={EventNoteIcon}
        />
        <Box sx={{ mt: 2 }}>
          <SectionCard title="학회 개요" icon={EventNoteIcon}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <InfoRow label="장소" value="코엑스 그랜드볼룸" labelWidth={88} />
              <InfoRow label="할인율" value={`${EVENT.discountPercent}%`} labelWidth={88} mono />
              {/* 주문서 행 — 열기·복사·QR */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
                <Typography variant="caption" sx={{ flex: '0 0 88px', fontWeight: 600, color: 'text.secondary', pt: '2px' }}>주문서</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all', display: 'block', mb: 1, fontFeatureSettings: '"tnum" 1' }}>{orderUrl}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} onClick={() => toast('주문 페이지 새 창 (mock)')} sx={{ minHeight: 36 }} disabled={eventClosed}>열기</Button>
                    <Button size="small" variant="outlined" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={() => toast('주문 URL 복사됨')} sx={{ minHeight: 36 }} disabled={eventClosed}>복사</Button>
                    <Button size="small" variant="outlined" startIcon={<QrCode2Icon sx={{ fontSize: 16 }} />} onClick={() => toast('QR 다이얼로그 (mock)')} sx={{ minHeight: 36 }} disabled={eventClosed}>QR</Button>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* 학회 종료 처리 — 주문서 행 근처(개요 카드 안). 식별 전용 헤더 원칙과 충돌 안 함 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
                <Typography variant="caption" sx={{ flex: '0 0 88px', fontWeight: 600, color: 'text.secondary', pt: '10px' }}>종료 처리</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {eventClosed ? (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <StatusBadge value="cancelled" label="종료됨" size="sm" dot />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>주문서 링크가 닫혔고 PIN이 모두 무효가 되었어요.</Typography>
                      </Box>
                      <Button size="small" variant="outlined" startIcon={<ReplayIcon sx={{ fontSize: 16 }} />} onClick={() => { setEventClosed(false); toast('주문서 링크를 다시 열었습니다'); }} sx={{ minHeight: 36 }}>
                        재개(링크 다시 열기)
                      </Button>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>삭제된 준비중 주문은 복구되지 않아요.</Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Button size="small" variant="outlined" color="error" startIcon={<EventBusyIcon sx={{ fontSize: 16 }} />} onClick={() => setCloseDialog({ open: true, step: 1 })} sx={{ minHeight: 36 }}>
                        학회 종료 처리
                      </Button>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, lineHeight: 1.6 }}>
                        고객 주문서 링크(/go 포함)를 닫고, 끝내 완성되지 않은 준비중 주문과 PIN을 정리합니다. 현장 마케팅·관리자(events:edit) 모두 가능.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </SectionCard>
        </Box>
      </Box>
    );
  };

  const stageBody = () => {
    switch (stage) {
      case 1: return renderBranch();
      case 2: return renderCreate();
      case 3: return (<Box>{renderCreatedHero()}{renderDetail(true)}</Box>);
      case 4: return renderDetail(false);
      case 5: return renderList();
      case 6: return renderEventClose();
      default: return null;
    }
  };

  const title = stage === 6 ? '학회 상세 — 종료 처리' : '주문 관리 — PIN 주문';

  return (
    <PreviewShell activePath={activeStage.nav}>
      {/* 개발용 단계 토글(실서비스 없음) — 휴대폰 폭에서 가로 스크롤 없이 줄바꿈 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700 }}>단계</Typography>
        {STAGES.map((s) => (
          <Chip
            key={s.key}
            label={s.tab}
            size="small"
            variant={stage === s.n ? 'filled' : 'outlined'}
            color={stage === s.n ? 'primary' : 'default'}
            onClick={() => setStage(s.n)}
            sx={{ fontWeight: stage === s.n ? 700 : 500, cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ color: 'text.primary' }}>{title}</Typography>
        {stage >= 1 && stage <= 4 && (
          <Button size="small" variant="text" endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />} onClick={() => setStage(Math.min(stage + 1, 5))} sx={{ color: 'text.secondary' }}>
            다음 단계
          </Button>
        )}
      </Box>

      {stageBody()}

      {/* 종료 처리 2단계 확인 */}
      <Dialog open={closeDialog.open} onClose={() => setCloseDialog({ open: false, step: 1 })} maxWidth="xs" fullWidth>
        {closeDialog.step === 1 ? (
          <>
            <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventBusyIcon sx={{ fontSize: 20, color: 'text.secondary' }} /> 학회를 종료할까요?
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                종료하면 고객 주문서 링크(/go 포함)가 닫히고, 완성되지 않은 준비중 주문이 삭제되며 PIN이 모두 무효가 됩니다. 결제대기·결제완료 주문은 그대로 보존됩니다.
              </Typography>
              <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.accent.danger, 0.06), border: `1px solid ${alpha(theme.accent.danger, 0.25)}`, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <WarningIcon sx={{ fontSize: 20, color: 'error.main' }} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  삭제될 준비중 주문 <b style={{ fontFeatureSettings: '"tnum" 1' }}>{PREPARING_DELETE_COUNT}건</b>
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setCloseDialog({ open: false, step: 1 })}>취소</Button>
              <Button variant="contained" color="error" onClick={() => setCloseDialog({ open: true, step: 2 })}>다음</Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>정말 종료할까요?</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                준비중 주문 <b>{PREPARING_DELETE_COUNT}건</b>을 삭제하고 PIN을 무효화합니다. 이 작업은 되돌릴 수 없습니다(주문서 링크는 다시 열 수 있지만 삭제분은 복구되지 않습니다).
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setCloseDialog({ open: false, step: 1 })}>취소</Button>
              <Button variant="contained" color="error" onClick={() => { setEventClosed(true); setCloseDialog({ open: false, step: 1 }); toast(`학회 종료 완료 · 준비중 주문 ${PREPARING_DELETE_COUNT}건 삭제`); }}>
                종료 처리
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.ready ? 6000 : 4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            px: 2, py: 1.5, borderRadius: `${theme.radii.md}px`,
            bgcolor: snackbar.ready ? theme.palette.primary.main : theme.gray[900],
            color: '#fff', boxShadow: theme.customShadows.lg, maxWidth: 440,
          }}
        >
          {snackbar.ready && (
            <>
              <ReadyIcon sx={{ fontSize: 20 }} />
              <VolumeIcon sx={{ fontSize: 18, opacity: 0.85 }} />
            </>
          )}
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: snackbar.ready ? 700 : 500, flex: 1 }}>{snackbar.message}</Typography>
          <IconButton size="small" onClick={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ color: '#fff' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Snackbar>
    </PreviewShell>
  );
};

export default PinOrderAdminPreview;
