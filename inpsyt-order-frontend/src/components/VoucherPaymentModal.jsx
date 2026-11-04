import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  Divider,
  Typography,
  CircularProgress,
  Switch,
  useTheme,
} from '@mui/material';
import { calcShippingFee } from '../constants/shipping';
import { MAX_VOUCHER_DIGITS } from '../utils/voucherConfig';
import {
  appendVoucherEntry,
  removeVoucherEntry,
  voucherTotal,
  voucherAmounts,
  isVoucherWithinLimit,
  buildVoucherPayload,
} from '../utils/voucherPayment';

// 이벤트 적용 모달 (결제완료 처리 / 이벤트 적용 수정) — 사양 A13 §④·§⑤.
//  - 바우처(결제수단) 숫자+단위 조합 입력 + 배송비 면제 스위치.
//  - 확정은 한 번의 update payload를 상위(onConfirm)에 넘긴다. status 동봉·.eq 조건은 상위가 담당.
//  - onConfirm은 성공 시 true를 반환하면 모달을 닫고, 실패 시 false로 입력값을 보존한다.

// 소제목 줄 — 왼쪽 소제목, 오른쪽 금액(또는 컨트롤). 세 소제목이 같은 위계를 갖도록 한 곳에서 그린다.
const SectionHeader = ({ title, amount, sx }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 32, ...sx }}>
    {typeof title === 'string' ? <Typography variant="subtitle2">{title}</Typography> : title}
    {typeof amount === 'string' ? (
      <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>{amount}</Typography>
    ) : amount}
  </Box>
);

const VoucherPaymentModal = ({ open, onClose, order, config, settings, mode = 'create', onConfirm }) => {
  const theme = useTheme();
  const [entries, setEntries] = useState([]);
  const [selectedDigit, setSelectedDigit] = useState(null);
  const [shippingWaived, setShippingWaived] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 면제 적용 전(원래) 금액 기준값.
  const subtotalAfterDiscount = (order?.final_payment || 0) - (order?.delivery_fee || 0);
  const fullDeliveryFee = order
    ? (order.shipping_waived
        ? calcShippingFee({
            basis: settings?.free_shipping_basis,
            originalTotal: order.total_cost || 0,
            discountedTotal: (order.total_cost || 0) - (order.discount_amount || 0),
            threshold: settings?.free_shipping_threshold,
            shippingCost: settings?.shipping_cost,
            isOnsite: order.is_on_site_sale,
          })
        : (order.delivery_fee || 0))
    : 0;

  useEffect(() => {
    if (!open || !order) return;
    setSelectedDigit(null);
    setSubmitting(false);
    if (mode === 'edit') {
      const amt = order.voucher_amount || 0;
      setEntries(amt > 0 ? [{ amount: amt, text: `${amt.toLocaleString()}원` }] : []);
      setShippingWaived(Boolean(order.shipping_waived));
    } else {
      setEntries([]);
      setShippingWaived(false);
    }
  }, [open, order, mode]);

  if (!order) return null;

  const voucherSum = voucherTotal(entries);
  const { orderAmount, waived, payableBeforeVoucher, cardAmount } = voucherAmounts({
    subtotalAfterDiscount,
    fullDeliveryFee,
    shippingWaived,
    voucherSum,
  });
  const valid = isVoucherWithinLimit({ payableBeforeVoucher, voucherSum });
  const waiveDisabled = fullDeliveryFee === 0;
  const showWaiver = Boolean(config.shippingWaiverEnabled) || (mode === 'edit' && Boolean(order.shipping_waived));

  const handleAddUnit = (unit) => {
    setEntries((prev) => appendVoucherEntry(prev, selectedDigit, unit));
    setSelectedDigit(null);
  };

  const handleConfirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const payload = buildVoucherPayload({ subtotalAfterDiscount, fullDeliveryFee, shippingWaived, voucherSum });
    const ok = await onConfirm(payload);
    setSubmitting(false);
    if (ok) onClose();
  };

  // 숫자 버튼 칸 수 고정(최대 5개, normalizeVoucherConfig) — 개수가 적어도 버튼 너비가 같다.
  // 단위 버튼은 같은 줄 너비를 단위 개수로 나눠 숫자보다 넓게 쓴다(2026-11-04 건우님 피드백).
  const DIGIT_COLUMNS = MAX_VOUCHER_DIGITS;
  const amountSx = { fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {mode === 'edit' ? '이벤트 적용 수정' : '결제완료 처리'}
        <Typography variant="body2" color="text.secondary">주문 #{order.id} · {order.customer_name || '-'}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {/* 위계(2026-11-04 건우님 피드백): 소제목 3개(주문 금액·{용어}·배송비 면제)를 같은 급으로,
            최종 금액만 한 단계 크게. 금액은 각 소제목 줄 오른쪽. */}
        <SectionHeader title="주문 금액" amount={`${orderAmount.toLocaleString()}원`} />

        {/* {용어} 입력 — 숫자 버튼 + 단위 버튼 조합. 합계(차감액)는 소제목 줄 오른쪽. */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader
            title={config.label}
            amount={voucherSum > 0 ? `−${voucherSum.toLocaleString()}원` : null}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${DIGIT_COLUMNS}, 1fr)`, gap: 1, mb: 1 }}>
            {config.digits.map((d) => (
              <Button
                key={d}
                variant={selectedDigit === d ? 'contained' : 'outlined'}
                onClick={() => setSelectedDigit((prev) => (prev === d ? null : d))}
                sx={{ minWidth: 0, minHeight: 44 }}
              >
                {d}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${config.units.length}, 1fr)`, gap: 1 }}>
            {config.units.map((u) => (
              <Button
                key={u.label}
                variant="outlined"
                color="primary"
                onClick={() => handleAddUnit(u)}
                sx={{ minWidth: 0, minHeight: 44 }}
              >
                {u.label}
              </Button>
            ))}
          </Box>

          {entries.length > 0 && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              {entries.map((e, i) => (
                <Chip key={i} label={e.text} onDelete={() => setEntries((prev) => removeVoucherEntry(prev, i))} />
              ))}
              <Button size="small" onClick={() => setEntries([])} sx={{ ml: 'auto' }}>초기화</Button>
            </Box>
          )}

          {!valid && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {config.label} 금액이 결제할 금액보다 많아요.
            </Typography>
          )}
        </Box>

        {/* 배송비 면제 — 스위치는 줄 왼쪽, 금액은 다른 소제목처럼 오른쪽 끝(2026-11-04 건우님 피드백).
            설정(shippingWaiverEnabled)이 꺼져 있으면 숨김. 이미 면제된 주문의 수정 창은 풀 수 있게 항상 보인다. */}
        {showWaiver && (
          <SectionHeader
            sx={{ mt: 2.5 }}
            title={
              <Box component="label" sx={{ display: 'flex', alignItems: 'center', ml: -1.5, cursor: waiveDisabled ? 'default' : 'pointer' }}>
                <Switch
                  checked={shippingWaived}
                  onChange={(e) => setShippingWaived(e.target.checked)}
                  disabled={waiveDisabled}
                  inputProps={{ 'aria-label': '배송비 면제' }}
                />
                <Typography variant="subtitle2" color={waiveDisabled ? 'text.disabled' : 'text.primary'}>배송비 면제</Typography>
              </Box>
            }
            amount={
              waiveDisabled ? (
                <Typography variant="caption" color="text.secondary">배송비 없음</Typography>
              ) : shippingWaived ? `−${waived.toLocaleString()}원` : null
            }
          />
        )}

        {/* 최종 — 단말기에 찍을 금액. 소제목보다 한 단계 큰 위계. */}
        <Divider sx={{ mt: 2, mb: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
          <Typography variant="h5">카드 결제 금액</Typography>
          <Typography variant="h4" sx={{ ...amountSx, color: theme.status.paid }}>
            {cardAmount.toLocaleString()}원
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ minHeight: 44 }}>취소</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!valid || submitting}
          startIcon={submitting ? <CircularProgress size={14} /> : null}
          sx={{ minHeight: 44 }}
        >
          {mode === 'edit' ? '수정 저장' : '결제완료 처리'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoucherPaymentModal;
