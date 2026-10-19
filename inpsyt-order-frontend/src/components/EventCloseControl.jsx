import React, { useState } from 'react';
import {
  Box, Typography, Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  EventBusy as EventBusyIcon,
  ReplayOutlined as ReplayIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import { StatusBadge } from './ui';
import { closeEvent, reopenEvent, countPreparingOrders } from '../api/helperOrderAdmin';
import { closeEventConfirm } from '../utils/pinOrder';

// 학회 종료 처리 — 개요 카드 "주문서" 행 바로 아래(구분선 뒤)에 둔다(L2 §16, 디자이너 1순위).
// 주문서 링크(/go 포함) 닫기 + 준비중 주문 삭제 + PIN 무효, 2단계 확인(삭제 건수 강조). 재개 가능.
// 권한 events:edit(현장 마케팅·관리자 모두) 미보유 시 비노출. 로직 전부 이 컴포넌트에 둔다.
const EventCloseControl = ({ event, canEdit, onChanged, addNotification }) => {
  const theme = useTheme();
  const [dialog, setDialog] = useState({ open: false, step: 1 });
  const [deletedCount, setDeletedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!canEdit || !event) return null;

  const isClosed = !!event.closed_at;
  const confirm = closeEventConfirm(deletedCount);

  const openCloseDialog = async () => {
    try {
      setDeletedCount(await countPreparingOrders(event.id));
    } catch {
      setDeletedCount(0);
    }
    setDialog({ open: true, step: 1 });
  };

  const handleConfirmClose = async () => {
    setBusy(true);
    try {
      const { deleted_count: deleted } = await closeEvent(event.id);
      addNotification(`학회를 종료했어요. 준비중 주문 ${deleted ?? 0}건을 삭제했습니다.`, 'success');
      setDialog({ open: false, step: 1 });
      onChanged?.();
    } catch (err) {
      addNotification(`학회 종료 실패: ${err?.message || ''}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await reopenEvent(event.id);
      addNotification('주문서 링크를 다시 열었습니다.', 'success');
      onChanged?.();
    } catch (err) {
      addNotification(`재개 실패: ${err?.message || ''}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Divider sx={{ my: 0.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.25 }}>
        <Box sx={{ width: 88, flexShrink: 0, pt: '2px' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>종료 처리</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isClosed ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <StatusBadge value="cancelled" label="종료됨" size="sm" dot />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>주문서 링크가 닫혔고 PIN이 모두 무효가 되었어요.</Typography>
              </Box>
              <Button size="small" variant="outlined" startIcon={<ReplayIcon sx={{ fontSize: 16 }} />} onClick={handleReopen} disabled={busy} sx={{ minHeight: 36 }}>
                재개(링크 다시 열기)
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>삭제된 준비중 주문은 복구되지 않아요.</Typography>
            </Box>
          ) : (
            <Box>
              <Button size="small" variant="outlined" color="error" startIcon={<EventBusyIcon sx={{ fontSize: 16 }} />} onClick={openCloseDialog} sx={{ minHeight: 36 }}>
                학회 종료 처리
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, lineHeight: 1.6 }}>
                고객 주문서 링크(/go 포함)를 닫고, 끝내 완성되지 않은 준비중 주문과 PIN을 정리합니다. 현장 마케팅·관리자(events:edit) 모두 가능.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* 2단계 확인 */}
      <Dialog open={dialog.open} onClose={() => !busy && setDialog({ open: false, step: 1 })} maxWidth="xs" fullWidth>
        {dialog.step === 1 ? (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventBusyIcon sx={{ fontSize: 20, color: 'text.secondary' }} /> {confirm.step1Title}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                {confirm.step1Body}
              </Typography>
              <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.accent.danger, 0.06), border: `1px solid ${alpha(theme.accent.danger, 0.25)}`, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <WarningIcon sx={{ fontSize: 20, color: 'error.main' }} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  삭제될 준비중 주문 <b style={{ fontFeatureSettings: '"tnum" 1' }}>{deletedCount}건</b>
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDialog({ open: false, step: 1 })}>취소</Button>
              <Button variant="contained" color="error" onClick={() => setDialog({ open: true, step: 2 })}>다음</Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>{confirm.step2Title}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                {confirm.step2Body}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDialog({ open: false, step: 1 })} disabled={busy}>취소</Button>
              <Button variant="contained" color="error" onClick={handleConfirmClose} disabled={busy} startIcon={busy ? <CircularProgress size={14} /> : null}>
                종료 처리
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default EventCloseControl;
