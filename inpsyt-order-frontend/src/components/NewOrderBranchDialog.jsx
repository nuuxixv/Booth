import React from 'react';
import { Box, Typography, Dialog, DialogTitle, DialogContent, IconButton, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Password as PinIcon,
  EditNote as ManualIcon,
} from '@mui/icons-material';

// "+신규 주문" 분기 — PIN 주문 / 수기 주문 2택(건우님 확정 2026-10-19).
// 수기 주문은 기존 NewOrderModal 경로를 그대로 연다(내부 무변경). 시안 PinOrderAdminPreview renderBranch 포팅.
const NewOrderBranchDialog = ({ open, onClose, onPickPin, onPickManual }) => {
  const theme = useTheme();

  const option = (icon, title, desc, onClick, primary) => (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      sx={{
        flex: 1, minWidth: 0, p: 2.5, cursor: 'pointer',
        borderRadius: `${theme.radii.lg}px`,
        border: `1px solid ${primary ? theme.palette.primary.main : theme.gray[200]}`,
        bgcolor: primary ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
        transition: `all 0.15s ${theme.easing.toss}`,
        '&:hover': { borderColor: theme.palette.primary.main, boxShadow: theme.customShadows.sm },
        '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>신규 주문 추가</Box>
        <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>어떤 방식으로 주문을 만들까요?</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          {option(
            <PinIcon sx={{ fontSize: 22, color: 'primary.main' }} />,
            'PIN 주문',
            '고객이 PIN으로 배송지를 입력합니다. 진행 중인 학회를 고르면 준비중 주문과 PIN이 만들어져요.',
            onPickPin,
            true,
          )}
          {option(
            <ManualIcon sx={{ fontSize: 22, color: theme.gray[600] }} />,
            '수기 주문',
            '기존 방식 그대로입니다(전화·구두 주문). 담당자가 고객 정보·상품을 직접 입력합니다.',
            onPickManual,
            false,
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderBranchDialog;
