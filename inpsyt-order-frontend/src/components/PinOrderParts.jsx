import { Box, Typography, Button, CircularProgress, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowForward as ArrowForwardIcon,
  InfoOutlined as InfoOutlinedIcon,
  Inventory2Outlined as InventoryIcon,
} from '@mui/icons-material';

// 고객 PIN 주문 — 시안(PinOrderCustomerPreview) 포팅 프레젠테이션 조각.
// 고객 화면이라 forced-colors(고대비) 처리를 유지한다.

// 고대비에서 소프트 틴트/색 보더가 붕괴하지 않도록 테두리로 형태를 지킨다(C1 §forced-colors).
const forcedBorder = { '@media (forced-colors: active)': { border: '1px solid CanvasText' } };

// ── PIN 확인 카드 — 살아 있는 PIN일 때만 결과 목록 위에 뜬다. 눌러야 전환(자동 전환 금지). ──
export const PinConfirmCard = ({ code, onContinue }) => {
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
        {code}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        담당자가 준비한 주문으로 이어집니다.
      </Typography>
      <Button variant="contained" fullWidth size="large" endIcon={<ArrowForwardIcon />} onClick={onContinue}>
        이어서 작성하기
      </Button>
    </Box>
  );
};

// ── 예외 — 없는/제출된/다른 학회 번호: 중립 톤 안내(빨강 아님). 4자리인데 살아 있는 PIN이 아닐 때. ──
export const PinRecheckBox = () => {
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

// ── 장바구니 보유 상태에서 PIN 전환 — 담아 둔 상품은 넘기지 않는다(뒤로 가면 유지). ──
export const CartHoldGuidance = ({ cartCount, onBack, onContinue }) => {
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
        담아 두신 상품 {cartCount}개는 함께 넘어가지 않아요. 필요하시면 담당자에게 말씀해 주세요.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" fullWidth onClick={onBack}>뒤로 가기</Button>
        <Button variant="contained" fullWidth onClick={onContinue}>담당자 주문으로 이어가기</Button>
      </Box>
    </Box>
  );
};

// ── 담당자가 담은 상품(읽기 전용). 담기/스테퍼 없음 — 고객은 상품을 수정하지 않는다. ──
// 행 구조는 C3 ItemsCard와 동일(상품명 + "{카테고리} · {수량}개" + 라인 합계). 카테고리 색 칩 금지.
export const ReadOnlyItemsCard = ({ items = [] }) => {
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {it.category} · {it.quantity}개
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontFeatureSettings: '"tnum" 1' }}>
            {((it.price_at_purchase || 0) * it.quantity).toLocaleString()}원
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ── 담긴 상품 없음 — "담당자가 상품을 담고 있어요". 상품 0개여도 배송지 입력·제출 가능. ──
export const PreparedEmptyState = () => (
  <Box sx={{ textAlign: 'center', py: 6, px: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
    <InventoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>담당자가 상품을 담고 있어요</Typography>
    <Typography variant="body2" color="text.secondary">
      상품이 준비되면 여기에 보여요.<br />먼저 배송지를 입력해 주세요.
    </Typography>
  </Box>
);

// ── 준비중 전용 — 자동 갱신 안내 스트립(결제대기 되면 호출부가 제거). 표준 로딩 인디케이터만. ──
export const AutoRefreshStrip = () => {
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
