import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Password as PinIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as EmptyCircleIcon,
} from '@mui/icons-material';

// 현장 도움(PIN) 주문 공용 표시 조각. 시안 PinOrderAdminPreview.jsx 에서 그대로 포팅.
// 목록·상세 뱃지 옆 PIN 칩, 생성 직후 큰 PIN, "상품 n종 / 고객 정보 ○✕" 준비 상태 줄.

// ── PIN 칩(목록·상세에서 준비중 뱃지 옆) ──────────────────────────
export const PinChip = ({ pin }) => {
  const theme = useTheme();
  if (!pin) return null;
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

// ── PIN 큰 표시 + 복사(생성 직후) — "큰 숫자 + 복사"만, 장식 없음 ──
export const PinDisplay = ({ pin, onCopy }) => {
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
export const ReadinessRow = ({ itemCount, hasCustomer }) => {
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
