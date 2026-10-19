import React, { useState, useMemo, useEffect } from 'react';
import DaumPostcode from 'react-daum-postcode';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton,
  FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Chip, Divider, InputAdornment,
  CircularProgress, Stack, Modal, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { matchesSearch } from '../utils/search';
import { getDiscountedUnit, getEffectiveRate } from '../utils/pricing';
import { SHIPPING_DEFAULTS, calcShippingFee } from '../constants/shipping';
import { PriceBlock, ActionSlot, EmptyState } from './ui';

// 사양 시트: design-system/specs/A2_NewOrderModal.md
// (M3-13 시안 정합본. 시안 부재 — 사양 시트 단일 진실 소스 기반 토큰·합성 컴포넌트 적용.)

const getEventStatusKey = (startDate, endDate) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || !end) return null;
  if (now < start) return { key: 'upcoming', label: '예정' };
  if (now > end) return { key: 'ended', label: '종료' };
  return { key: 'live', label: '진행중' };
};

const NewOrderModal = ({ open, onClose, onSuccess, events = [], products = [], settings = {} }) => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [saving, setSaving] = useState(false);

  // Customer info
  const [isOnSite, setIsOnSite] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [postcodeOpen, setPostcodeOpen] = useState(false);

  // Event selection
  const [selectedEventId, setSelectedEventId] = useState('');

  // Product search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Cart: [{ product, quantity }]
  const [cart, setCart] = useState([]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setIsOnSite(false);
      setName('');
      setPhone('');
      setPostcode('');
      setAddress('');
      setDetailAddress('');
      setSelectedEventId('');
      setSearchTerm('');
      setSelectedCategory('all');
      setCart([]);
    }
  }, [open]);

  // Daum postcode
  const handleCompletePostcode = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }
    setPostcode(data.zonecode);
    setAddress(fullAddress);
    setPostcodeOpen(false);
  };

  // Derived: selected event
  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId],
  );
  const discountRate = selectedEvent?.discount_rate || 0;

  // Phone formatter
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let fmt = raw;
    if (raw.length > 3 && raw.length <= 7) fmt = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    else if (raw.length > 7) fmt = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    setPhone(fmt);
  };

  // Categories from products
  const categories = useMemo(() => {
    const known = ['도서', '검사'];
    const extracted = [...new Set(products.map(p => p.category).filter(Boolean))];
    return [...new Set([...known, ...extracted])];
  }, [products]);

  // Filtered products for search list
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchTerm.trim()) {
      list = list.filter(p => matchesSearch(p.name, searchTerm));
    } else {
      list = list.filter(p => p.is_popular);
    }
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }
    return list.slice(0, 50);
  }, [products, searchTerm, selectedCategory]);

  // Cart helpers
  const getCartItem = (productId) => cart.find(c => c.product.id === productId);

  // 상품별 오버라이드 반영 단가 — is_discountable·discount_override 공식 일원화.
  const calcDiscountedPrice = (product) => getDiscountedUnit(product, discountRate);

  const handleAddToCart = (product) => {
    if (getCartItem(product.id)) return;
    setCart(prev => [...prev, { product, quantity: 1 }]);
  };

  const handleIncrement = (productId) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: c.quantity + 1 } : c));
  };

  const handleDecrement = (productId) => {
    setCart(prev =>
      prev
        .map(c => c.product.id === productId ? { ...c, quantity: c.quantity - 1 } : c)
        .filter(c => c.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  // Calculations — 현장판매 시 배송비 없음
  const { totalAmount, discountAmount, deliveryFee, finalPayment } = useMemo(() => {
    const originalSubtotal = cart.reduce((sum, c) => sum + (c.product.list_price || 0) * c.quantity, 0);
    const discountedSubtotal = cart.reduce((sum, c) => sum + calcDiscountedPrice(c.product) * c.quantity, 0);
    const calcDiscount = originalSubtotal - discountedSubtotal;
    const freeThreshold = settings.free_shipping_threshold ?? SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD;
    const shipCost = settings.shipping_cost ?? SHIPPING_DEFAULTS.SHIPPING_COST;
    // 무료배송 판정 기준(정가/할인가)은 설정 기반, 기본 정가. 3경로 공유 함수 경유.
    const fee = calcShippingFee({
      basis: settings.free_shipping_basis,
      originalTotal: originalSubtotal,
      discountedTotal: discountedSubtotal,
      threshold: freeThreshold,
      shippingCost: shipCost,
      isOnsite: isOnSite,
    });
    return {
      totalAmount: originalSubtotal,
      discountAmount: calcDiscount,
      deliveryFee: fee,
      finalPayment: discountedSubtotal + fee,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, discountRate, settings, isOnSite]);

  const handleSave = async () => {
    if (!isOnSite && !name.trim()) {
      addNotification('고객명을 입력해주세요.', 'warning'); return;
    }
    if (!selectedEventId) {
      addNotification('학회(행사)를 선택해주세요.', 'warning'); return;
    }
    if (cart.length === 0) {
      addNotification('상품을 1개 이상 담아주세요.', 'warning'); return;
    }

    setSaving(true);
    try {
      const customerName = isOnSite ? `현장판매_${Date.now()}` : name.trim();
      const shippingAddress = !isOnSite && (address.trim() || postcode)
        ? { postcode, address: address.trim(), detail: detailAddress.trim() }
        : null;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          phone_number: phone || null,
          shipping_address: shippingAddress,
          event_id: selectedEventId,
          is_on_site_sale: isOnSite,
          status: 'pending',
          total_cost: totalAmount,
          discount_amount: discountAmount,
          delivery_fee: deliveryFee,
          final_payment: finalPayment,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(c => ({
        order_id: orderData.id,
        product_id: c.product.id,
        quantity: c.quantity,
        price_at_purchase: calcDiscountedPrice(c.product),
        product_name: c.product.name || null,
        product_code: c.product.product_code || null,
        category: c.product.category || null,
        list_price: c.product.list_price || null,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      addNotification('신규 주문이 추가되었습니다.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      addNotification(`주문 추가 실패: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')),
    [events],
  );

  const eventStatusColor = {
    upcoming: theme.palette.info.main,
    live: theme.status.paid,
    ended: theme.gray[400],
  };

  const postcodeModalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 400,
    bgcolor: 'background.paper',
    boxShadow: theme.customShadows.lg,
    borderRadius: `${theme.radii.lg}px`,
    overflow: 'hidden',
    zIndex: 1400,
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h5">신규 주문 추가</Typography>
          <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, height: { sm: 560 } }}>

            {/* ── LEFT PANEL ── 고객 정보·학회·요약 */}
            <Box
              sx={{
                flex: '0 0 320px',
                p: 3,
                borderRight: { sm: `1px solid ${theme.gray[200]}` },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflowY: 'auto',
              }}
            >

              <FormControlLabel
                control={
                  <Checkbox
                    checked={isOnSite}
                    onChange={(e) => {
                      setIsOnSite(e.target.checked);
                      if (e.target.checked) { setName(''); setPhone(''); setPostcode(''); setAddress(''); setDetailAddress(''); }
                    }}
                  />
                }
                label={<Typography variant="subtitle2">현장판매</Typography>}
              />

              <FormControl fullWidth size="small" required>
                <InputLabel>학회 / 행사 *</InputLabel>
                <Select
                  value={selectedEventId}
                  label="학회 / 행사 *"
                  onChange={e => setSelectedEventId(e.target.value)}
                >
                  {sortedEvents.map(ev => {
                    const status = getEventStatusKey(ev.start_date, ev.end_date);
                    const color = status ? eventStatusColor[status.key] : theme.gray[400];
                    return (
                      <MenuItem key={ev.id} value={ev.id}>
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {status && (
                              <Box
                                component="span"
                                sx={{
                                  px: 0.75,
                                  py: 0.25,
                                  borderRadius: `${theme.radii.xs}px`,
                                  bgcolor: alpha(color, 0.12),
                                  color,
                                  flexShrink: 0,
                                }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>{status.label}</Typography>
                              </Box>
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {ev.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {ev.start_date}{ev.discount_rate > 0 && ` · 할인 ${Math.round(ev.discount_rate * 100)}%`}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {!isOnSite && (
                <>
                  <TextField
                    fullWidth size="small" label="고객명 *"
                    value={name} onChange={e => setName(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth size="small" label="연락처"
                    value={phone} onChange={handlePhoneChange}
                    inputProps={{ maxLength: 13 }} placeholder="010-0000-0000"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth size="small" label="주소 검색"
                    value={address}
                    onClick={() => setPostcodeOpen(true)}
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button size="small" variant="outlined" onClick={() => setPostcodeOpen(true)} sx={{ minWidth: 'auto', px: 1.25 }}>
                            검색
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ cursor: 'pointer', '& .MuiInputBase-root': { cursor: 'pointer' } }}
                  />
                  {address && (
                    <TextField
                      fullWidth size="small" label="상세주소"
                      value={detailAddress} onChange={e => setDetailAddress(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* ── Order Summary — PriceBlock ── */}
              {cart.length > 0 && (
                <Box sx={{ mt: 'auto', pt: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>주문 요약</Typography>
                  <PriceBlock
                    rows={[
                      { label: '총 상품금액', value: totalAmount },
                      ...(discountAmount > 0
                        ? [{ label: '할인', value: `- ${discountAmount.toLocaleString()}원` }]
                        : []),
                      ...(!isOnSite
                        ? [{ label: '배송비', value: deliveryFee > 0 ? `${deliveryFee.toLocaleString()}원` : '무료', muted: deliveryFee === 0 }]
                        : []),
                    ]}
                    totalLabel="최종 결제금액"
                    totalValue={finalPayment}
                    totalColor={theme.palette.primary.main}
                  />
                </Box>
              )}
            </Box>

            {/* ── RIGHT PANEL ── 상품 검색·장바구니 */}
            <Box sx={{ flex: 1, minWidth: 0, p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>

              {/* Search */}
              <TextField
                fullWidth size="small" placeholder="상품명으로 검색"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Category chips */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
                {['all', ...categories].map(cat => (
                  <Chip
                    key={cat}
                    label={cat === 'all' ? '전체' : cat}
                    size="small"
                    variant={selectedCategory === cat ? 'filled' : 'outlined'}
                    color={selectedCategory === cat ? 'primary' : 'default'}
                    onClick={() => setSelectedCategory(cat)}
                  />
                ))}
              </Box>

              {/* Product list */}
              <Box
                sx={{
                  flex: '1 1 0',
                  overflowY: 'auto',
                  border: `1px solid ${theme.gray[200]}`,
                  borderRadius: `${theme.radii.md}px`,
                  minHeight: 0,
                }}
              >
                {filteredProducts.length === 0 ? (
                  <EmptyState
                    title={searchTerm ? '검색 결과가 없습니다' : '인기 상품이 없습니다'}
                    description={searchTerm ? '다른 검색어를 시도해 주세요.' : '상품 관리에서 인기 상품을 지정하세요.'}
                    sx={{ py: 4 }}
                  />
                ) : (
                  filteredProducts.map(product => {
                    const inCart = !!getCartItem(product.id);
                    const discounted = calcDiscountedPrice(product);
                    const isDisc = getEffectiveRate(product, discountRate) > 0;
                    return (
                      <Box
                        key={product.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          px: 2,
                          py: 1.5,
                          borderBottom: `1px solid ${theme.gray[200]}`,
                          '&:last-child': { borderBottom: 'none' },
                          bgcolor: inCart ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                          minWidth: 0,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {product.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {product.category && (
                              <Chip label={product.category} size="small" variant="outlined" />
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="span"
                              sx={{ whiteSpace: 'nowrap', fontFeatureSettings: '"tnum" 1' }}
                            >
                              {isDisc ? (
                                <>
                                  <Box component="span" sx={{ textDecoration: 'line-through', mr: 0.5 }}>
                                    {product.list_price?.toLocaleString()}원
                                  </Box>
                                  <Box component="span" sx={{ color: theme.palette.error.main, fontWeight: 700 }}>
                                    {discounted.toLocaleString()}원
                                  </Box>
                                </>
                              ) : (
                                `${product.list_price?.toLocaleString()}원`
                              )}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          {inCart ? (
                            <Chip label="담김" size="small" color="primary" variant="outlined" />
                          ) : (
                            <Button size="small" variant="contained" onClick={() => handleAddToCart(product)}>
                              담기
                            </Button>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>

              {/* Cart */}
              {cart.length > 0 && (
                <Box sx={{ flexShrink: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    장바구니 ({cart.length}종)
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 160, overflowY: 'auto' }}>
                    {cart.map(({ product, quantity }) => {
                      const discounted = calcDiscountedPrice(product);
                      return (
                        <Box
                          key={product.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: `${theme.radii.md}px`,
                            border: `1px solid ${theme.gray[200]}`,
                            bgcolor: theme.gray[50],
                            minWidth: 0,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {product.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'primary.main',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              fontFeatureSettings: '"tnum" 1',
                            }}
                          >
                            {(discounted * quantity).toLocaleString()}원
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleDecrement(product.id)}
                              aria-label="수량 감소"
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography
                              variant="body2"
                              sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontFeatureSettings: '"tnum" 1' }}
                            >
                              {quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleIncrement(product.id)}
                              aria-label="수량 증가"
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFromCart(product.id)}
                            sx={{ color: 'text.disabled', flexShrink: 0 }}
                            aria-label="장바구니에서 제거"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <ActionSlot sx={{ width: '100%' }}>
            <Button onClick={onClose} disabled={saving} variant="outlined">취소</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || cart.length === 0}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              {saving ? '저장 중...' : '주문 추가'}
            </Button>
          </ActionSlot>
        </DialogActions>
      </Dialog>

      {/* Daum Postcode Modal */}
      <Modal open={postcodeOpen} onClose={() => setPostcodeOpen(false)} sx={{ zIndex: 1400 }}>
        <Box sx={postcodeModalStyle}>
          <DaumPostcode onComplete={handleCompletePostcode} style={{ height: '60vh' }} />
        </Box>
      </Modal>
    </>
  );
};

export default NewOrderModal;
