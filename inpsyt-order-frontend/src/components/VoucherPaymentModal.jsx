import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  Typography,
  CircularProgress,
  useTheme,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { PriceBlock } from './ui';
import { calcShippingFee } from '../constants/shipping';
import {
  appendVoucherEntry,
  removeVoucherEntry,
  voucherTotal,
  voucherAmounts,
  isVoucherWithinLimit,
  buildVoucherPayload,
} from '../utils/voucherPayment';

// 이벤트 적용 모달 (결제완료 처리 / 이벤트 적용 수정) — 사양 A13 §④·§⑤.
//  - 바우처(결제수단) 숫자+단위 조합 입력 + 배송비 면제 토글.
//  - 확정은 한 번의 update payload를 상위(onConfirm)에 넘긴다. status 동봉·.eq 조건은 상위가 담당.
//  - onConfirm은 성공 시 true를 반환하면 모달을 닫고, 실패 시 false로 입력값을 보존한다.

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

  const summaryRows = [{ label: '주문 금액', value: orderAmount }];
  if (shippingWaived) summaryRows.push({ label: '배송비 면제', value: -waived });
  if (voucherSum > 0) summaryRows.push({ label: config.label, value: -voucherSum });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {mode === 'edit' ? '이벤트 적용 수정' : '결제완료 처리'}
        <Typography variant="body2" color="text.secondary">주문 #{order.id} · {order.customer_name || '-'}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {/* 금액 요약 — 카드 결제 금액이 단말기에 찍을 금액 */}
        <PriceBlock
          rows={summaryRows}
          totalLabel="카드 결제 금액"
          totalValue={cardAmount}
          totalColor={theme.status.paid}
        />

        {/* 배송비 면제 토글 — 바우처 버튼과 다른 색(secondary) */}
        <Box sx={{ mt: 2 }}>
          <Button
            variant={shippingWaived ? 'contained' : 'outlined'}
            color="secondary"
            onClick={() => setShippingWaived((v) => !v)}
            disabled={waiveDisabled}
            startIcon={<LocalShippingIcon />}
            sx={{ minHeight: 44 }}
          >
            배송비 면제 {shippingWaived ? '켜짐' : '꺼짐'}
          </Button>
          {waiveDisabled && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>배송비 없음</Typography>
          )}
        </Box>

        {/* 바우처 입력 — 숫자 버튼 + 단위 버튼 조합 */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{config.label} 입력</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {config.digits.map((d) => (
              <Button
                key={d}
                variant={selectedDigit === d ? 'contained' : 'outlined'}
                onClick={() => setSelectedDigit((prev) => (prev === d ? null : d))}
                sx={{ minWidth: 48, minHeight: 44 }}
              >
                {d}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {config.units.map((u) => (
              <Button
                key={u.label}
                variant="outlined"
                color="primary"
                onClick={() => handleAddUnit(u)}
                sx={{ minWidth: 48, minHeight: 44 }}
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

          <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
            {config.label} 합계 {voucherSum.toLocaleString()}원
          </Typography>
          {!valid && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {config.label} 금액이 결제할 금액보다 많아요.
            </Typography>
          )}
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
