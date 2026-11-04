import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
} from '@mui/material';
import { StatusBadge } from './ui';
import { STATUS_TO_KOREAN, ALLOWED_TRANSITIONS } from '../constants/orderStatus';
import { withObjectParticle } from '../utils/voucherConfig';

// 주문 목록 상태 칸 클릭 → 상태 변경 모달 (사양 A13 §③).
// 전이 버튼만 보여 주고, 실제 처리는 상위(onSelect)가 라우팅한다.
//  - 이벤트 OFF·합배송 자식: 즉시 적용(기존 경로)
//  - 이벤트 ON 단독 주문의 결제완료: 상위가 이벤트 적용 모달로 넘김

const DESTRUCTIVE = new Set(['cancelled', 'refunded']);

const StatusChangeModal = ({ open, onClose, order, voucherEnabled, isGroupChild, voucherLabel = '바우처', onSelect }) => {
  if (!order) return null;

  const transitions = ALLOWED_TRANSITIONS[order.status] || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>상태 변경</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">#{order.id}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.customer_name || '-'}</Typography>
          <Box sx={{ ml: 'auto' }}>
            <StatusBadge value={order.status} size="sm" label={STATUS_TO_KOREAN[order.status]} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {transitions.map((key) => (
            <React.Fragment key={key}>
              <Button
                variant={DESTRUCTIVE.has(key) ? 'outlined' : 'contained'}
                color={DESTRUCTIVE.has(key) ? 'error' : 'primary'}
                onClick={() => onSelect(key)}
                fullWidth
                sx={{ minHeight: 44, justifyContent: 'flex-start' }}
              >
                {STATUS_TO_KOREAN[key]}
              </Button>
              {key === 'paid' && isGroupChild && voucherEnabled && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                  합배송 주문은 {withObjectParticle(voucherLabel)} 적용할 수 없어요. 결제완료만 처리됩니다.
                </Typography>
              )}
            </React.Fragment>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ minHeight: 40 }}>취소</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusChangeModal;
