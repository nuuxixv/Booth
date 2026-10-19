import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Chip, Divider,
  CircularProgress, ToggleButton, ToggleButtonGroup, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Badge as BadgeIcon,
  Home as HomeIcon,
  EditNote as NoteIcon,
  ArrowForward as ArrowForwardIcon,
  InfoOutlined as InfoOutlinedIcon,
  Inventory2Outlined as InventoryIcon,
  Autorenew as AutorenewIcon,
  Star as StarIcon,
  FiberNew as NewIcon,
} from '@mui/icons-material';
import { STATUS_COLORS, STATUS_TO_KOREAN } from '../constants/orderStatus';
import { InfoRow, PriceBlock } from './ui';
import ProductCard from './ProductCard';

/**
 * DEV-ONLY: /preview/pin-order-customer
 * 고객 PIN 주문(현장 도움 주문) 시안 — 휴대폰 폭(480) 기준, 어드민 셸 없이 직접 렌더.
 * 기획: DOCS/PRD_현장도움주문.md §2·§3 / 사양: design-system/specs/C1_OrderPage.md · C3_OrderStatusPage.md
 *
 * 인라인 mock 데이터, API 0 / Supabase 0. 개인정보는 전부 가짜.
 * 상단 DEV 토글로 8개 단계를 전환한다(① 상품선택 ~ ⑧ 예외).
 *
 * 핵심 설계(기획 충실):
 * - 별도 입구 UI 없음. 상품 검색창에 PIN 4자리를 넣으면 "살아 있는 PIN일 때만"
 *   검색 결과 위에 확인 카드가 뜬다(눌러야 전환, 자동 전환 금지). 그 외엔 일반 검색 그대로.
 * - PIN 판정은 검색창 컴포넌트가 아니라 상위(ProductSelectionStep)가 디바운스된 검색어로
 *   한다(검색 input 격리 규칙). 이 프리뷰에선 정적 mock이라 검색 필드를 readOnly로 둔다.
 * - 고객은 상품을 수정하지 않는다. 담긴 상품은 읽기 전용.
 */

// 준비중(preparing) 상태 상수 — 두 트랙 공통. 실 구현 시 STATUS_COLORS / STATUS_TO_KOREAN /
// theme.js STATUS 에 추가될 값(여기선 프리뷰 전용 로컬 상수로만 둔다. 실 상수 파일은 미수정).
const PREPARING_COLOR = '#64748B';
const PREPARING_LABEL = '준비중';

// 고대비(forced-colors) 칩 — C1 §forced-colors 패턴(ProductSelectionStep.forcedColorsChipSx) 재사용.
const forcedColorsChipSx = (selected) => ({
  '@media (forced-colors: active)': {
    border: '1px solid CanvasText',
    ...(selected
      ? { background: 'Highlight', color: 'HighlightText' }
      : { background: 'Canvas', color: 'CanvasText' }),
  },
});

// 소프트 틴트 / 색 보더 박스가 고대비에서 붕괴하지 않도록 테두리를 지킨다(C1 §forced-colors).
const forcedBorder = { '@media (forced-colors: active)': { border: '1px solid CanvasText' } };

const EVENT_NAME = '대한신경정신의학회 2026 추계학술대회';
const MOCK_PIN = '0427';

// 담당자가 미리 담아 둔 상품(읽기 전용 예시). 상품명 실제, 금액 가짜 아님(예시 정가 톤).
const PREPARED_ITEMS = [
  // 행사 할인 15% 적용 단가(price_at_purchase) — 단계 ① 상품 카드의 할인가와 일치시킨다.
  { product_name: '강박장애(김찬형)', category: '도서', quantity: 1, price_at_purchase: 22950 },
  { product_name: '공황장애(박현순)', category: '도서', quantity: 1, price_at_purchase: 21250 },
  { product_name: 'K-WAIS-IV 지능검사 검사지·온라인코드 20개', category: '검사', quantity: 1, price_at_purchase: 38250 },
];
const PREPARED_TOTAL = PREPARED_ITEMS.reduce((s, it) => s + it.price_at_purchase * it.quantity, 0);

// 일반 상품 선택 화면용 mock(① 단계 — 평면 그리드).
const BROWSE_PRODUCTS = [
  { id: 1, name: '강박장애(김찬형)', category: '도서', list_price: 27000, is_discountable: true, is_popular: true },
  { id: 2, name: '공황장애(박현순)', category: '도서', list_price: 25000, is_discountable: true },
  { id: 3, name: 'K-WAIS-IV 지능검사 검사지·온라인코드 20개', category: '검사', list_price: 45000, is_discountable: true, is_new: true },
];

const NOOP = () => {};

const STAGES = [
  { key: 'select', label: '① 상품선택' },
  { key: 'pin-card', label: '② PIN카드' },
  { key: 'items-filled', label: '③ 담긴상품' },
  { key: 'items-empty', label: '④ 상품대기' },
  { key: 'shipping', label: '⑤ 배송지' },
  { key: 'status-preparing', label: '⑥ 준비중' },
  { key: 'status-pending', label: '⑦ 결제대기' },
  { key: 'exceptions', label: '⑧ 예외' },
];

// ── DEV 전용 단계 토글 바 ──────────────────────────────────
const DevStageBar = ({ stage, setStage }) => {
  const theme = useTheme();
  return (
    <Box sx={{ width: '100%', maxWidth: 760, px: 2, py: 1.5, mb: 1 }}>
      <Typography variant="caption" sx={{ color: theme.gray[500], fontWeight: 700, display: 'block', mb: 0.75 }}>
        DEV · 고객 PIN 주문 — 단계 전환 (프리뷰 전용)
      </Typography>
      <ToggleButtonGroup
        value={stage}
        exclusive
        onChange={(e, v) => v && setStage(v)}
        sx={{
          flexWrap: 'wrap',
          gap: 0.5,
          '& .MuiToggleButton-root': {
            color: theme.gray[700],
            border: `1px solid ${theme.gray[300]}`,
            borderRadius: '8px !important',
            minHeight: 36,
            px: 1.25,
            fontSize: '0.8125rem',
            fontWeight: 600,
          },
          '& .MuiToggleButton-root.Mui-selected': {
            bgcolor: theme.palette.primary.main,
            color: theme.palette.common.white,
            border: '1px solid transparent',
            '&:hover': { bgcolor: theme.palette.primary.dark },
          },
        }}
      >
        {STAGES.map((s) => (
          <ToggleButton key={s.key} value={s.key}>{s.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

// ── 상품 선택 화면 조각들 ──────────────────────────────────
const SelectionHeader = () => (
  <Box sx={{ mb: 2.5, pt: 2, textAlign: 'center' }}>
    <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>상품을 선택해주세요</Typography>
    <Typography variant="body2" color="text.secondary">{EVENT_NAME}</Typography>
  </Box>
);

// 실 화면은 ProductSearchBar(로컬 state + 내부 debounce)로 입력을 격리한다.
// 프리뷰는 정적 mock이라 readOnly TextField로 외형만 재현한다(값을 단계별로 고정 표시).
const PinSearchField = ({ value }) => (
  <TextField
    fullWidth
    value={value}
    onChange={NOOP}
    placeholder="상품명으로 검색 (띄어쓰기로 여러 키워드)"
    InputProps={{
      readOnly: true,
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon sx={{ color: 'text.disabled' }} />
        </InputAdornment>
      ),
    }}
    sx={{ mb: 2 }}
  />
);

const FilterChips = () => {
  const theme = useTheme();
  const viewModes = [
    { key: 'all', label: '전체' },
    { key: 'popular', label: '인기', icon: <StarIcon sx={{ fontSize: 14 }} /> },
    { key: 'new', label: '신규출시', icon: <NewIcon sx={{ fontSize: 14 }} /> },
  ];
  const categories = ['전체', '검사', '도서'];
  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {viewModes.map((m) => {
          const selected = m.key === 'popular'; // 기본 선택 = 인기
          return (
            <Chip
              key={m.key}
              label={m.label}
              icon={m.icon || undefined}
              variant={selected ? 'filled' : 'outlined'}
              color={selected ? 'primary' : 'default'}
              sx={{ flexShrink: 0, fontWeight: selected ? 700 : 500, borderRadius: `${theme.radii.sm}px`, ...forcedColorsChipSx(selected) }}
            />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {categories.map((c, i) => {
          const selected = i === 0; // 기본 선택 = 전체
          return (
            <Chip
              key={c}
              label={c}
              variant={selected ? 'filled' : 'outlined'}
              color={selected ? 'secondary' : 'default'}
              sx={{ flexShrink: 0, fontWeight: selected ? 700 : 500, borderRadius: `${theme.radii.sm}px`, ...forcedColorsChipSx(selected) }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

const ProductGrid = () => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
    {BROWSE_PRODUCTS.map((p) => (
      <ProductCard key={p.id} product={p} discountRate={0.15} cartQuantity={0} onAdd={NOOP} onIncrement={NOOP} onDecrement={NOOP} />
    ))}
  </Box>
);

const EmptyResults = () => (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>검색 결과가 없습니다</Typography>
    <Typography variant="caption" color="text.secondary">다른 검색어를 시도해보세요</Typography>
  </Box>
);

// ── PIN 확인 카드 — 살아 있는 PIN일 때만 결과 목록 위에 뜬다. 눌러야 전환(자동 전환 금지). ──
const PinConfirmCard = ({ onContinue }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        border: `1.5px solid ${theme.palette.primary.main}`,
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: `${theme.radii.md}px`,
        p: 2,
        mb: 2.5,
        ...forcedBorder,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.25 }}>
        담당자 안내 번호
      </Typography>
      <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.12em', fontFeatureSettings: '"tnum" 1', mb: 0.75 }}>
        {MOCK_PIN}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        담당자가 준비한 주문으로 이어집니다.
      </Typography>
      <Button
        variant="contained"
        fullWidth
        size="large"
        endIcon={<ArrowForwardIcon />}
        onClick={onContinue}
      >
        이어서 작성하기
      </Button>
    </Box>
  );
};

// ── 읽기 전용 상품 카드 — 고객은 상품을 수정하지 않는다. 담기/스테퍼 없음(C3 ItemsCard 패턴). ──
const ReadOnlyItemsCard = ({ items }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.radii.md}px`,
        p: 2,
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {items.map((it, i) => (
        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{it.product_name}</Typography>
            {/* 카테고리는 텍스트 캡션만 — 색 칩 금지(C3 §발견 #4) */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {it.category} · {it.quantity}개
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontFeatureSettings: '"tnum" 1' }}>
            {(it.price_at_purchase * it.quantity).toLocaleString()}원
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const SectionTitle = ({ children }) => (
  <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
    {children}
  </Typography>
);

// ── 상태 배너 — C3 패턴(STATUS_COLORS / 흰 글씨 토큰). 준비중은 PREPARING_COLOR. ──
const StatusBanner = ({ icon, label, color, subMessage, receivedAt }) => {
  const theme = useTheme();
  const white = theme.palette.common.white;
  return (
    <Box sx={{ bgcolor: color, px: 3, pt: 4, pb: 3.5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '2.5rem', mb: 1, lineHeight: 1 }} aria-hidden="true">{icon}</Typography>
      <Typography variant="h6" sx={{ color: white, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ mb: 1.5 }}>
        {(Array.isArray(subMessage) ? subMessage : [subMessage]).map((line, i) => (
          <Typography key={i} variant="body2" sx={{ color: alpha(white, 0.9) }}>{line}</Typography>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: alpha(white, 0.65) }}>
        {receivedAt} · {EVENT_NAME}
      </Typography>
    </Box>
  );
};

// ── 배송지 입력(=기존 주문자 정보 화면). 주소 3필드 분리 유지(통합 금지). ──
const fieldSx = { mb: 1.5 };
const ShippingForm = () => (
  <Box sx={{ px: 2, pb: 4, pt: 2 }}>
    <Box sx={{ mb: 2.5, textAlign: 'center' }}>
      <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>배송 받으실 주소를 입력해주세요</Typography>
      <Typography variant="body2" color="text.secondary">{EVENT_NAME}</Typography>
    </Box>

    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1 }}>필수 정보</Typography>
    <TextField
      fullWidth
      defaultValue="이수진"
      placeholder="성함"
      sx={fieldSx}
      InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
    />
    <TextField
      fullWidth
      defaultValue="010-2345-6789"
      placeholder="010-1234-5678"
      sx={fieldSx}
      InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
    />
    {/* 인싸이트 ID — 카트에 온라인코드 상품이 있을 때만 노출(데모 카트에 검사 포함) */}
    <TextField
      fullWidth
      defaultValue=""
      label="인싸이트 ID (온라인코드 전달용)"
      placeholder="인싸이트 홈페이지 ID를 입력해주세요"
      helperText="구매하신 온라인코드를 이 계정으로 보내드려요. 인싸이트(inpsyt.co.kr) 로그인 아이디를 입력해주세요."
      sx={fieldSx}
      InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
    />

    <Divider sx={{ my: 3 }} />
    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1 }}>배송지 정보</Typography>
    {/* 주소 검색(도로명·우편번호) — readOnly, 모달로만 채움. 우편번호 필드는 폼에서 히든. */}
    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
      <TextField
        fullWidth
        defaultValue="서울특별시 중구 명동길 26"
        placeholder="주소 검색"
        InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} /></InputAdornment> }}
      />
      <Button variant="outlined" sx={{ flexShrink: 0, px: 2 }}>검색</Button>
    </Box>
    <TextField
      fullWidth
      defaultValue="인싸이트빌딩 5층"
      placeholder="상세주소"
      sx={fieldSx}
      InputProps={{ startAdornment: <InputAdornment position="start"><HomeIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
    />

    <Divider sx={{ my: 3 }} />
    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1 }}>선택사항</Typography>
    <TextField
      fullWidth
      multiline
      rows={3}
      placeholder="요청하실 내용"
      InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}><NoteIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
    />
  </Box>
);

// 하단 CTA(실 화면은 FloatingBottomBar). 프리뷰는 콘텐츠 끝 고정 버튼으로 대체.
const BottomCta = ({ label, onClick }) => (
  <Box sx={{ px: 2, pb: 4, pt: 1 }}>
    <Button variant="contained" fullWidth size="large" onClick={onClick}>{label}</Button>
  </Box>
);

const InquiryFooter = () => (
  <Box sx={{ textAlign: 'center', pb: 5 }}>
    <Typography variant="caption" color="text.disabled">
      문의사항이 있으신가요?{' '}
      <a href="mailto:inpsytorder@inpsyt.co.kr" style={{ color: 'inherit' }}>inpsytorder@inpsyt.co.kr</a>
    </Typography>
  </Box>
);

const MOCK_SHIPPING_INFO = (
  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3 }}>
    <InfoRow label="이름" value="이수진" labelWidth={80} />
    <InfoRow label="연락처" value="010-2345-6789" labelWidth={80} />
    <InfoRow label="인싸이트 ID" value="sujin_lee" labelWidth={80} />
    <InfoRow label="배송지" value="서울특별시 중구 명동길 26 인싸이트빌딩 5층" labelWidth={80} multiline />
  </Box>
);

// ── 예외 ── 없는 번호: 소프트 안내(빨강 아님). 4자리인데 살아 있는 PIN이 아닐 때만.
const RecheckBox = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.gray[50],
        borderRadius: `${theme.radii.md}px`,
        p: 2,
        mb: 2.5,
        ...forcedBorder,
      }}
    >
      <InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20, mt: '1px', flexShrink: 0 }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>안내 번호를 다시 확인해 주세요.</Typography>
        <Typography variant="body2" color="text.secondary">담당자에게 받은 번호가 맞나요?</Typography>
      </Box>
    </Box>
  );
};

// ── 예외 ── 장바구니 보유: PIN 전환 전 안내. 담아 둔 상품은 넘기지 않는다(뒤로 가면 유지).
const CartHoldGuidance = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        border: `1.5px solid ${theme.palette.primary.main}`,
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: `${theme.radii.md}px`,
        p: 2,
        ...forcedBorder,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>담당자가 준비한 주문으로 이어집니다</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        담아 두신 상품 3개는 함께 넘어가지 않아요. 필요하시면 담당자에게 말씀해 주세요.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" fullWidth>뒤로 가기</Button>
        <Button variant="contained" fullWidth>담당자 주문으로 이어가기</Button>
      </Box>
    </Box>
  );
};

// ── 준비중 전용 — 자동 갱신 안내 스트립(결제대기 되면 멈춤) ──
const AutoRefreshStrip = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.gray[50],
        borderRadius: `${theme.radii.md}px`,
        py: 1.25,
        mb: 3,
        ...forcedBorder,
      }}
    >
      <CircularProgress size={14} thickness={5} sx={{ color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        몇 초마다 자동으로 새로고침되고 있어요
      </Typography>
    </Box>
  );
};

// ── 단계별 렌더 ──────────────────────────────────────────────
const PinOrderCustomerPreview = () => {
  const theme = useTheme();
  const [stage, setStage] = useState('select');

  let body;
  switch (stage) {
    // ① 일반 상품 선택 화면(PIN 미입력) — 진입점. 일반 고객 흐름과 완전히 동일(회귀 0).
    case 'select':
      body = (
        <Box sx={{ px: 2, pb: 4 }}>
          <SelectionHeader />
          <PinSearchField value="" />
          <FilterChips />
          <ProductGrid />
        </Box>
      );
      break;

    // ② 검색창에 "0427" 입력 → 확인 카드(결과 목록 위). 일반 검색 결과는 그대로(여기선 상품명 매칭 0 → 빈 상태).
    case 'pin-card':
      body = (
        <Box sx={{ px: 2, pb: 4 }}>
          <SelectionHeader />
          <PinSearchField value={MOCK_PIN} />
          <FilterChips />
          <PinConfirmCard onContinue={() => setStage('items-filled')} />
          <EmptyResults />
        </Box>
      );
      break;

    // ③ 카드 누름 → 담긴 상품 있음(읽기 전용) + 금액.
    case 'items-filled':
      body = (
        <>
          <Box sx={{ px: 2, pt: 2 }}>
            <Box sx={{ mb: 2.5, textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>담당자가 준비한 주문</Typography>
              <Typography variant="body2" color="text.secondary">안내 번호 {MOCK_PIN} · {EVENT_NAME}</Typography>
            </Box>
            <SectionTitle>주문 상품</SectionTitle>
            <ReadOnlyItemsCard items={PREPARED_ITEMS} />
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 2 }}>
              <PriceBlock
                rows={[{ label: '배송비', value: '무료' }]}
                totalLabel="예상 결제금액"
                totalValue={PREPARED_TOTAL}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              상품은 담당자가 준비했어요. 수정이 필요하면 담당자에게 말씀해 주세요.
            </Typography>
          </Box>
          <BottomCta label="배송지 입력하기" onClick={() => setStage('shipping')} />
        </>
      );
      break;

    // ④ 담긴 상품 없음 — "담당자가 상품을 담고 있어요". 상품 0개여도 배송지 입력·제출 가능.
    case 'items-empty':
      body = (
        <>
          <Box sx={{ px: 2, pt: 2 }}>
            <Box sx={{ mb: 2.5, textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>담당자가 준비한 주문</Typography>
              <Typography variant="body2" color="text.secondary">안내 번호 {MOCK_PIN} · {EVENT_NAME}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', py: 6, px: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
              <InventoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>담당자가 상품을 담고 있어요</Typography>
              <Typography variant="body2" color="text.secondary">
                상품이 준비되면 여기에 보여요.<br />먼저 배송지를 입력해 주세요.
              </Typography>
            </Box>
          </Box>
          <BottomCta label="배송지 입력하기" onClick={() => setStage('shipping')} />
        </>
      );
      break;

    // ⑤ 배송지 입력(성함·연락처·인싸이트ID·주소 3필드·요청). 주소 통합 금지.
    case 'shipping':
      body = (
        <>
          <ShippingForm />
          <BottomCta label="주문 제출하기" onClick={() => setStage('status-pending')} />
        </>
      );
      break;

    // ⑥ 제출 → 준비중 상태 페이지(상품 0개로 제출). 준비중 동안만 자동 갱신.
    case 'status-preparing':
      body = (
        <>
          <StatusBanner
            icon="📝"
            label={PREPARING_LABEL}
            color={PREPARING_COLOR}
            subMessage={['담당자가 상품을 담고 있어요.', '상품과 금액이 표시되면 담당자와 함께 확인해 주세요.']}
            receivedAt="2026년 10월 19일 14:32 접수"
          />
          <Box sx={{ px: 3, pt: 3 }}>
            <AutoRefreshStrip />
            <SectionTitle>주문 상품</SectionTitle>
            <Box sx={{ textAlign: 'center', py: 5, border: '1px solid', borderColor: 'divider', borderRadius: '12px', mb: 3 }}>
              <Typography variant="body2" color="text.secondary">담당자가 담는 상품이 이곳에 표시돼요</Typography>
            </Box>
            <SectionTitle>주문자 정보</SectionTitle>
            {MOCK_SHIPPING_INFO}
            <InquiryFooter />
          </Box>
        </>
      );
      break;

    // ⑦ 제출 → 결제대기 상태 페이지(상품 있는 상태). 준비중에서 결제대기로 합류한 모습.
    case 'status-pending':
      body = (
        <>
          <StatusBanner
            icon="⏳"
            label={STATUS_TO_KOREAN.pending}
            color={STATUS_COLORS.pending}
            subMessage={['지금 결제 시 10.22(수) 도착', '담당자를 통해 결제해 주세요.']}
            receivedAt="2026년 10월 19일 14:32 접수"
          />
          <Box sx={{ px: 3, pt: 3 }}>
            <SectionTitle>주문 상품</SectionTitle>
            <ReadOnlyItemsCard items={PREPARED_ITEMS} />
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3 }}>
              <PriceBlock
                rows={[{ label: '배송비', value: '무료' }]}
                totalLabel="최종 결제금액"
                totalValue={PREPARED_TOTAL}
                totalColor={STATUS_COLORS.pending}
              />
            </Box>
            <SectionTitle>주문자 정보</SectionTitle>
            {MOCK_SHIPPING_INFO}
            <InquiryFooter />
          </Box>
        </>
      );
      break;

    // ⑧ 예외 — 없는 번호 / 장바구니 보유 안내(두 패널을 한 화면에 나란히).
    case 'exceptions':
      body = (
        <Box sx={{ px: 2, pb: 4 }}>
          <Typography variant="overline" sx={{ color: theme.gray[500], display: 'block', mt: 2, mb: 1 }}>
            예외 A — 없는 번호 · 이미 제출된 번호 · 다른 학회 번호
          </Typography>
          <PinSearchField value="0000" />
          <FilterChips />
          <RecheckBox />
          <EmptyResults />

          <Divider sx={{ my: 3 }} />

          <Typography variant="overline" sx={{ color: theme.gray[500], display: 'block', mb: 1 }}>
            예외 B — 장바구니 보유 상태에서 PIN 입력
          </Typography>
          <CartHoldGuidance />
        </Box>
      );
      break;

    default:
      body = null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: theme.gray[100],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
      }}
    >
      <DevStageBar stage={stage} setStage={setStage} />
      <Box
        sx={{
          maxWidth: 480,
          width: '100%',
          bgcolor: 'background.paper',
          minHeight: '100dvh',
          border: `1px solid ${theme.gray[200]}`,
        }}
      >
        {body}
      </Box>
    </Box>
  );
};

export default PinOrderCustomerPreview;
