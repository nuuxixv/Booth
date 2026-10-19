import { createTheme, alpha } from '@mui/material/styles';

// ─────────────────────────────────────────────
// Brand
// ─────────────────────────────────────────────
const PRIMARY_MAIN = '#2B398F';
const PRIMARY_DARK = '#1A237E';

// ─────────────────────────────────────────────
// Neutral Scale (Toss-inspired cool gray)
// ─────────────────────────────────────────────
const GRAY = {
  50:  '#F9FAFB',
  100: '#F2F4F6',
  200: '#E5E8EB',
  300: '#D1D6DB',
  400: '#B0B8C1',
  500: '#8B95A1',
  600: '#6B7684',
  700: '#4E5968',
  800: '#333D4B',
  900: '#191F28',
};

// ─────────────────────────────────────────────
// Semantic Accent Palette (dashboard categories)
// Use via theme.accent.* — NOT hardcoded hex in pages
//
// books·tests 는 카테고리 색 (D17). 정식 토큰은 constants/categoryColors.js 의
// CATEGORY_COLORS.book / .test (`#3B82F6` / `#6366F1`). 여기 값은 카테고리 색
// 단일화 이전의 대시보드 시안 톤이며 DashboardDesignPreview 가 참조한다.
// 후속 사이클(M2 시안 머지 시점)에 categoryColors.js 와 정합화 예정.
// 새 코드에서는 theme.accent.books / .tests 호출을 피하고 CATEGORY_COLORS 를 쓴다.
// ─────────────────────────────────────────────
const ACCENT = {
  revenue:   '#00B894', // 매출/성장 - Toss 그린
  books:     '#3D4DB0', // @deprecated D17 — DashboardDesignPreview 시안 호환용. CATEGORY_COLORS.book 권장
  tests:     '#2B398F', // @deprecated D17 — DashboardDesignPreview 시안 호환용. CATEGORY_COLORS.test 권장
  shipping:  '#0984E3', // 배송
  attention: '#F59E0B', // 주의/대기
  danger:    '#FF6B6B',
};

// ─────────────────────────────────────────────
// Status Palette (주문 상태) - single source
// constants/orderStatus.js 와 동기화됨
// ─────────────────────────────────────────────
const STATUS = {
  preparing: '#64748B',
  pending:   '#F59E0B',
  paid:      '#10B981',
  completed: '#6366F1',
  cancelled: '#EF4444',
  refunded:  '#F43F5E',
};

// ─────────────────────────────────────────────
// Radius Scale
// ─────────────────────────────────────────────
const RADII = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// ─────────────────────────────────────────────
// Elevation — 주로 hover/focus에만 사용. 기본은 border.
// ─────────────────────────────────────────────
const CUSTOM_SHADOWS = {
  none: 'none',
  xs:   '0px 1px 2px rgba(17, 24, 39, 0.04)',
  sm:   '0px 2px 6px rgba(17, 24, 39, 0.04), 0px 1px 2px rgba(17, 24, 39, 0.03)',
  md:   '0px 6px 16px rgba(17, 24, 39, 0.06), 0px 2px 4px rgba(17, 24, 39, 0.03)',
  lg:   '0px 12px 32px rgba(17, 24, 39, 0.08)',
  focus: `0 0 0 3px ${alpha(PRIMARY_MAIN, 0.16)}`,
};

// ─────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────
const EASING_TOSS = 'cubic-bezier(0.33, 1, 0.68, 1)';

// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────
const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_MAIN,
      light: alpha(PRIMARY_MAIN, 0.8),
      dark: PRIMARY_DARK,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#3D4DB0',
      light: '#6677CC',
      dark: PRIMARY_MAIN,
      contrastText: '#ffffff',
    },
    background: {
      default: GRAY[100],
      paper: '#FFFFFF',
    },
    text: {
      primary: GRAY[900],
      secondary: GRAY[500],
      disabled: GRAY[400],
    },
    success: { main: ACCENT.revenue, light: '#55EFC4', dark: '#00A884' },
    warning: { main: ACCENT.attention, light: '#FDE68A', dark: '#D97706' },
    error:   { main: ACCENT.danger,    light: '#FAB1A0', dark: '#D63031' },
    info:    { main: ACCENT.shipping,  light: '#81ECEC', dark: '#0764C7' },
    divider: GRAY[200],
    grey: GRAY,
  },

  // Custom token groups (accessed via useTheme())
  gray: GRAY,
  accent: ACCENT,
  status: STATUS,
  radii: RADII,
  customShadows: CUSTOM_SHADOWS,
  easing: { toss: EASING_TOSS },

  typography: {
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    h1: { fontWeight: 800, fontSize: '1.5rem',  lineHeight: 1.25, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, fontSize: '1.625rem', lineHeight: 1.25, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, fontSize: '1.375rem', lineHeight: 1.3,  letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.35, letterSpacing: '-0.015em' },
    h5: { fontWeight: 700, fontSize: '1rem',     lineHeight: 1.4,  letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, fontSize: '0.9375rem',lineHeight: 1.4,  letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 700, fontSize: '1rem',     lineHeight: 1.5, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.5, letterSpacing: '-0.01em' },
    body1: { fontSize: '1rem',      lineHeight: 1.6, letterSpacing: '-0.01em' },
    body2: { fontSize: '0.875rem',  lineHeight: 1.6, letterSpacing: '-0.005em' },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: 0 },
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
    button: { fontWeight: 700, textTransform: 'none', fontSize: '0.9375rem', letterSpacing: '-0.01em' },
  },

  shape: { borderRadius: RADII.sm },

  shadows: [
    CUSTOM_SHADOWS.none,
    CUSTOM_SHADOWS.xs,
    CUSTOM_SHADOWS.sm,
    CUSTOM_SHADOWS.md,
    CUSTOM_SHADOWS.lg,
    ...Array(20).fill(CUSTOM_SHADOWS.lg),
  ],

  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      tossEaseOut: EASING_TOSS,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: GRAY[100],
          fontFeatureSettings: '"tnum" 1, "ss01" 1',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADII.lg,
          boxShadow: 'none',
          border: `1px solid ${GRAY[200]}`,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          '&:last-child': { paddingBottom: 24 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          padding: '10px 18px',
          minHeight: 44,
          boxShadow: 'none',
          transition: `all 0.2s ${EASING_TOSS}`,
          '&:hover': { boxShadow: 'none' },
          '&:active': { transform: 'scale(0.98)' },
        },
        containedPrimary: {
          background: PRIMARY_MAIN,
          '&:hover': { background: PRIMARY_DARK },
        },
        // 고대비: MUI contained 는 테두리가 없어 채움이 붕괴하면 경계가 사라진다.
        // 버튼으로 인식되게 시스템 버튼 색과 테두리를 준다. 선택 의미의 Highlight 는
        // 쓰지 않는다(칩 선택 상태와 의미가 섞임). (PRD_고대비_가시성 F2)
        contained: {
          '@media (forced-colors: active)': {
            background: 'ButtonFace',
            color: 'ButtonText',
            border: '1px solid ButtonText',
          },
        },
        outlined: {
          borderColor: GRAY[300],
          color: GRAY[800],
          '&:hover': {
            borderColor: GRAY[400],
            backgroundColor: GRAY[50],
          },
        },
        text: {
          color: GRAY[700],
          '&:hover': { backgroundColor: GRAY[100] },
        },
        sizeSmall: {
          minHeight: 44,
          padding: '8px 14px',
          fontSize: '0.8125rem',
          borderRadius: RADII.sm,
        },
        sizeLarge: {
          padding: '14px 24px',
          fontSize: '1rem',
          fontWeight: 700,
          minHeight: 52,
          borderRadius: RADII.md,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          minWidth: 44,
          minHeight: 44,
          transition: `all 0.2s ${EASING_TOSS}`,
          '&:active': { transform: 'scale(0.94)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: RADII.md,
            backgroundColor: GRAY[50],
            minHeight: 48,
            fontSize: '15px',
            transition: `all 0.15s ${EASING_TOSS}`,
            '& fieldset': { borderColor: GRAY[200] },
            '&:hover fieldset': { borderColor: GRAY[300] },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              '& fieldset': { borderColor: PRIMARY_MAIN, borderWidth: 2 },
            },
          },
          '& .MuiInputLabel-root': { color: GRAY[500] },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          backgroundColor: GRAY[50],
          '& fieldset': { borderColor: GRAY[200] },
          '&:hover fieldset': { borderColor: GRAY[300] },
          '&.Mui-focused': {
            backgroundColor: '#FFFFFF',
            '& fieldset': { borderColor: PRIMARY_MAIN, borderWidth: 2 },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '14px 20px',
          borderBottom: `1px solid ${GRAY[100]}`,
        },
        head: {
          fontWeight: 700,
          backgroundColor: GRAY[50],
          color: GRAY[600],
          fontSize: '0.8125rem',
          borderBottom: `1px solid ${GRAY[200]}`,
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          // 고대비: SVG 의 color·fill 은 forced-colors 강제 대상이 아니다(실측).
          // 그래서 sx 로 지정한 브랜드색이 그대로 남아 배경에 묻힌다
          // (장바구니 아이콘 rgb(43,57,143) on 검정 = 2.08:1).
          // 아이콘마다 예외를 두는 대신, 고대비에서는 언제나 주변 글자색을 따르게 한다.
          // 이러면 선택 칩(HighlightText)·버튼(ButtonText)·본문(CanvasText) 모두
          // 자기 배경에 맞는 색을 얻는다. !important 는 sx 를 이기기 위해 필요하며
          // 고대비 모드 안에서만 적용된다. (PRD_고대비_가시성 F5)
          '@media (forced-colors: active)': {
            color: 'inherit !important',
            fill: 'currentColor !important',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: RADII.sm,
          fontWeight: 600,
          height: 28,
          letterSpacing: '-0.01em',
        },
        sizeSmall: { height: 22, fontSize: '0.75rem' },
        filled: { border: 'none' },
        outlined: { border: `1px solid ${GRAY[200]}`, backgroundColor: 'transparent' },
        // Clickable/Deletable Chip 은 터치 hit-area 44px 강제 (size 상관없이)
        // 단순 상태 표시 Chip(onClick/onDelete 없음)은 그대로 작게 유지
        clickable: {
          minHeight: 44,
          height: 'auto',
          '& .MuiChip-label': { fontSize: '0.875rem' },
        },
        deletable: {
          minHeight: 44,
          height: 'auto',
          '& .MuiChip-label': { fontSize: '0.875rem' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: RADII.lg,
          boxShadow: CUSTOM_SHADOWS.lg,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: GRAY[800],
          color: '#FFFFFF',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: RADII.sm,
          padding: '6px 10px',
        },
        arrow: { color: GRAY[800] },
      },
    },
    MuiSwipeableDrawer: {
      styleOverrides: {
        paper: { borderRadius: `${RADII.lg}px ${RADII.lg}px 0 0` },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: GRAY[100],
          borderRadius: RADII.sm,
        },
      },
    },
  },
});

export default theme;
