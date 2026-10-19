import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, InputLabel, Select, MenuItem, CircularProgress, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Password as PinIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { createHelperOrder } from '../api/helperOrderAdmin';
import { copyToClipboard } from '../utils/eventUrl';
import { getTodayKST } from '../utils/date';
import { pickDefaultPinEvent, pinEventStatusKey } from '../utils/pinOrder';
import { PinDisplay } from './PinOrderBits';
import { StatusBadge } from './ui';

// 상태 키 → StatusBadge(값·라벨). EventDetailPage STATUS_COLOR_TO_BADGE와 같은 결(예정=info/진행중=success/종료=default).
const EVENT_STATUS_BADGE = {
  upcoming: { value: 'pending', label: '예정' },
  ongoing: { value: 'paid', label: '진행중' },
  ended: { value: 'completed', label: '종료' },
};

// PIN 주문 생성 — 진행 중 학회 자동 선택(상태 뱃지·종료 비활성) + 상품 0개 생성 안내 + 생성 후 PIN 크게·복사.
// 생성은 createHelperOrder(eventId) RPC. 시안 PinOrderAdminPreview renderCreate 포팅.
const PinOrderCreateDialog = ({ open, onClose, events = [], onCreated, addNotification }) => {
  const theme = useTheme();
  const today = getTodayKST();
  const [eventId, setEventId] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'created'
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // { order_id, match_code, access_token }

  // 열릴 때 진행 중 학회 자동 선택 + 폼 초기화.
  useEffect(() => {
    if (open) {
      setEventId(pickDefaultPinEvent(events, today) ?? '');
      setPhase('form');
      setCreated(null);
      setCreating(false);
    }
    // today는 렌더마다 같은 날짜 문자열 — 의도적으로 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, events]);

  const discountCaption = (ev) => {
    const pct = Math.round((ev?.discount_rate ?? 0) * 100);
    return pct > 0 ? ` · 할인 ${pct}%` : '';
  };

  const renderBadge = (ev, sx) => {
    const badge = EVENT_STATUS_BADGE[pinEventStatusKey(ev, today)];
    return badge ? <StatusBadge value={badge.value} label={badge.label} size="sm" sx={sx} /> : null;
  };

  const selectedEvent = events.find((e) => e.id === eventId);
  const selectedClosed = !!selectedEvent?.closed_at;

  const handleCreate = async () => {
    if (!eventId) {
      addNotification('학회를 선택해주세요.', 'warning');
      return;
    }
    setCreating(true);
    try {
      const result = await createHelperOrder(eventId);
      setCreated(result);
      setPhase('created');
    } catch (err) {
      const raw = err?.message || '';
      const msg = raw.includes('종료된 학회')
        ? '이미 종료 처리된 학회예요. 학회 상세에서 재개한 뒤 다시 시도해주세요.'
        : `PIN 주문 생성 실패: ${raw}`;
      addNotification(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!created?.match_code) return;
    const ok = await copyToClipboard(created.match_code);
    addNotification(ok ? `안내 번호 ${created.match_code} 복사됨` : '번호 복사에 실패했어요.', ok ? 'success' : 'error');
  };

  const handleGoDetail = () => {
    if (created?.order_id) onCreated?.(created.order_id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>PIN 주문 만들기</Box>
        <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
      </DialogTitle>

      {phase === 'form' ? (
        <>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
              <Box>
                <FormControl size="small" fullWidth>
                  <InputLabel>학회 / 행사</InputLabel>
                  <Select
                    value={events.some((e) => e.id === eventId) ? eventId : ''}
                    label="학회 / 행사"
                    onChange={(e) => setEventId(e.target.value)}
                    renderValue={(val) => {
                      const ev = events.find((e) => e.id === val);
                      if (!ev) return '';
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          {renderBadge(ev)}
                          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.name}{discountCaption(ev)}
                          </Box>
                        </Box>
                      );
                    }}
                  >
                    {events.map((ev) => (
                      <MenuItem key={ev.id} value={ev.id} disabled={!!ev.closed_at}>
                        {renderBadge(ev, { mr: 1 })}
                        {ev.name}{discountCaption(ev)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  진행 중인 학회가 자동으로 선택됩니다. 필요하면 다른 학회로 바꿀 수 있어요. 종료 처리된 학회는 선택할 수 없습니다.
                </Typography>
              </Box>
              <Box sx={{ p: 1.75, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}` }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  <b>상품은 지금 담지 않아도 됩니다.</b> 0개로 만든 뒤 미리 담거나, 고객이 제출한 뒤 담아도 됩니다.
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose} disabled={creating}>취소</Button>
            <Button
              variant="contained"
              startIcon={creating ? <CircularProgress size={16} /> : <PinIcon sx={{ fontSize: 18 }} />}
              onClick={handleCreate}
              disabled={creating || !eventId || selectedClosed}
            >
              PIN 주문 만들기
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                준비중 주문 #{created?.order_id}이 생성됐어요. 매출·출고·합배송에서 제외됩니다.
              </Typography>
              <PinDisplay pin={created?.match_code} onCopy={handleCopy} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose}>닫기</Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} onClick={handleGoDetail}>
              주문 상세 열기
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default PinOrderCreateDialog;
