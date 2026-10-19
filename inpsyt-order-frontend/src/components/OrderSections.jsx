import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Select,
  FormControl,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Collapse,
  Autocomplete,
  Checkbox,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DaumPostcode from 'react-daum-postcode';
import { supabase } from '../supabaseClient';
import { sendAlimtalk } from '../api/alimtalk';
import { SHIPPING_DEFAULTS, calcShippingFee } from '../constants/shipping';
import { SectionCard, StatusBadge, InfoRow, PriceBlock, EmptyState } from './ui';
import ProductPickerDialog from './ProductPickerDialog';
import { PinChip, ReadinessRow } from './PinOrderBits';
import { formatPhone } from '../utils/formatPhone';
import { getDiscountedUnit } from '../utils/pricing';
import { shouldPromoteToPending } from '../utils/pinOrder';
import { playBeep } from '../utils/playBeep';

// 사양 시트: design-system/specs/A2_OrderDetailModal.md
// OrderDetailModal(단일 주문)과 GroupOrderModal(껍데기 자식 토글)이 공유하는 섹션 본문.
// 주문자/배송지/메모/상품/결제/상태/알림톡 + 섹션별 인라인 편집 로직 전부.
// (연계 표시 섹션·연계 연결 버튼·삭제 등 컨테이너 관심사는 상위 모달이 담당)

const OrderSections = ({
  order: orderProp,
  statusToKorean,
  productsMap,
  products,
  events,
  addNotification,
  onUpdate,
  productsLoading,
  hasPermission,
  onStatusChangeIntercept,
  onLocalPromote,
}) => {
  const theme = useTheme();
  const audioCtxRef = useRef(null);

  // order 로컬 미러 — 섹션 저장 후 onUpdate(부모 재조회)를 기다리지 않고 즉시 갱신.
  const [order, setOrder] = useState(orderProp);

  // editingSection: null | 'customer' | 'shipping' | 'memo' | 'items'
  const [editingSection, setEditingSection] = useState(null);
  // 실시간 핸들러가 "현재 편집 중 섹션"을 읽기 위한 ref(재구독 없이 최신값 참조).
  const editingSectionRef = useRef(editingSection);
  useEffect(() => { editingSectionRef.current = editingSection; }, [editingSection]);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [editedCustomerName, setEditedCustomerName] = useState('');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [editedShippingAddress, setEditedShippingAddress] = useState('');
  const [editedShippingPostcode, setEditedShippingPostcode] = useState('');
  const [editedShippingDetail, setEditedShippingDetail] = useState('');
  const [editedCustomerRequest, setEditedCustomerRequest] = useState('');
  const [editedOrderItems, setEditedOrderItems] = useState([]);
  const [editedAdminMemo, setEditedAdminMemo] = useState('');
  const [editedInpsytId, setEditedInpsytId] = useState('');
  const [showPostcode, setShowPostcode] = useState(false);

  const [subtotal, setSubtotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);

  // 상품 추가 피커 — 고객 프론트 ProductSelectionStep 재사용 다이얼로그.
  const [pickerOpen, setPickerOpen] = useState(false);

  // B — 주문 성격(일반배송/현장수령) 전환. pending 전용.
  const [isOnSiteSale, setIsOnSiteSale] = useState(false);
  const [onSiteSaving, setOnSiteSaving] = useState(false);

  const [alimtalk, setAlimtalk] = useState({ status: null, sentAt: null, attemptedAt: null, error: null });

  const [settings, setSettings] = useState({
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
  });

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) setSettings(data);
      });
  }, []);

  // 단일 진실 소스 — prop이 바뀔 때만 로컬 order + 편집 버퍼 재초기화.
  useEffect(() => {
    if (orderProp) {
      setOrder(orderProp);
      setEditedOrderItems(JSON.parse(JSON.stringify(orderProp.mergedItems || orderProp.order_items || [])));
      setCurrentStatus(orderProp.status || '');
      setEditedCustomerName(orderProp.customer_name || '');
      setEditedPhoneNumber(orderProp.phone_number || '');
      setEditedShippingAddress(orderProp.shipping_address?.address || '');
      setEditedShippingPostcode(orderProp.shipping_address?.postcode || '');
      setEditedShippingDetail(orderProp.shipping_address?.detail || '');
      setEditedCustomerRequest(orderProp.customer_request || '');
      setEditedAdminMemo(orderProp.admin_memo || '');
      setEditedInpsytId(orderProp.inpsyt_id || '');
      setIsOnSiteSale(orderProp.is_on_site_sale ?? false);
      setAlimtalk({
        status: orderProp.alimtalk_status || null,
        sentAt: orderProp.alimtalk_sent_at || null,
        attemptedAt: orderProp.alimtalk_attempted_at || null,
        error: orderProp.alimtalk_error || null,
      });
      setEditingSection(null);
      setSubtotal(orderProp.total_cost || 0);
      setTotalDiscount(orderProp.discount_amount || 0);
      setShippingFee(orderProp.delivery_fee || 0);
      setFinalTotal(orderProp.final_payment || 0);
    }
  }, [orderProp]);

  // 준비중 주문을 상세로 보여 주는 동안 그 주문 id의 UPDATE 구독 — 고객이 (상세 창 밖에서) 원격 제출하면
  // 고객 필드·상태·PIN을 즉시 반영해 "준비 상태" 줄과 주문자/배송지 표시가 바로 갱신된다.
  // 편집 중인 상품 버퍼(editedOrderItems)·편집 중 섹션 입력값은 덮어쓰지 않는다. 채널명은 주문 id로 고유.
  useEffect(() => {
    if (!orderProp?.id || orderProp.status !== 'preparing') return undefined;
    const channel = supabase
      .channel(`order-detail-${orderProp.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderProp.id}` },
        (payload) => {
          const row = payload.new || {};
          setOrder(prev => ({
            ...prev,
            status: 'status' in row ? row.status : prev.status,
            match_code: 'match_code' in row ? row.match_code : prev.match_code,
            customer_name: 'customer_name' in row ? row.customer_name : prev.customer_name,
            phone_number: 'phone_number' in row ? row.phone_number : prev.phone_number,
            inpsyt_id: 'inpsyt_id' in row ? row.inpsyt_id : prev.inpsyt_id,
            shipping_address: 'shipping_address' in row ? row.shipping_address : prev.shipping_address,
            customer_request: 'customer_request' in row ? row.customer_request : prev.customer_request,
          }));
          if ('status' in row && row.status) setCurrentStatus(row.status);
          // 편집 중이 아닌 섹션만 입력 버퍼 동기화(편집 중 입력값 보호).
          if (editingSectionRef.current !== 'customer') {
            if ('customer_name' in row) setEditedCustomerName(row.customer_name || '');
            if ('phone_number' in row) setEditedPhoneNumber(row.phone_number || '');
            if ('inpsyt_id' in row) setEditedInpsytId(row.inpsyt_id || '');
          }
          if (editingSectionRef.current !== 'shipping') {
            if ('shipping_address' in row) {
              setEditedShippingAddress(row.shipping_address?.address || '');
              setEditedShippingPostcode(row.shipping_address?.postcode || '');
              setEditedShippingDetail(row.shipping_address?.detail || '');
            }
            if ('customer_request' in row) setEditedCustomerRequest(row.customer_request || '');
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderProp?.id, orderProp?.status]);

  // 상품 편집 중에만 총액 재계산
  useEffect(() => {
    if (editingSection !== 'items' || !events || !productsMap || !order) return;

    const currentEvent = events.find(e => e.id === order.event_id);
    const discountRate = currentEvent?.discount_rate || 0;

    let currentSubtotal = 0;
    let discountedSubtotal = 0;
    (editedOrderItems || []).forEach(item => {
      const product = productsMap[item.product_id];
      const originalPrice = product?.list_price || 0;
      currentSubtotal += originalPrice * item.quantity;
      // 상품별 오버라이드·is_discountable·반올림 반영 단가로 소계 재계산.
      discountedSubtotal += getDiscountedUnit(product, discountRate) * item.quantity;
    });

    const currentTotalDiscount = currentSubtotal - discountedSubtotal;
    // 배송비 판정은 설정 기반(정가/할인가), 기본 정가. 3경로 공유 함수 경유.
    const currentShippingFee = calcShippingFee({
      basis: settings.free_shipping_basis,
      originalTotal: currentSubtotal,
      discountedTotal: discountedSubtotal,
      threshold: settings.free_shipping_threshold,
      shippingCost: settings.shipping_cost,
    });
    const currentFinalTotal = discountedSubtotal + currentShippingFee;

    setSubtotal(currentSubtotal);
    setTotalDiscount(currentTotalDiscount);
    setShippingFee(currentShippingFee);
    setFinalTotal(currentFinalTotal);
  }, [editingSection, editedOrderItems, order, productsMap, events, settings]);

  const handleAddOrderItem = () => {
    setPickerOpen(true);
  };

  // 피커 확정 — 임시 카트를 편집 버퍼에 병합. 이미 있는 상품이면 수량 합산(중복 행 생성 금지).
  // 신규 행은 현행과 동일하게 { product_id, quantity }만 — 가격·스냅샷은 저장 파이프라인이 채운다.
  const handlePickerConfirm = (pickedCart) => {
    setEditedOrderItems(prev => {
      const next = [...prev];
      (pickedCart || []).forEach(picked => {
        const idx = next.findIndex(it => it.product_id === picked.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + picked.quantity };
        } else {
          next.push({ product_id: picked.id, quantity: picked.quantity });
        }
      });
      return next;
    });
    setPickerOpen(false);
  };

  const handleRemoveOrderItem = (index) => {
    setEditedOrderItems(editedOrderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editedOrderItems];
    updatedItems[index][field] = value;
    setEditedOrderItems(updatedItems);
  };

  // 상품별 현장수령 즉시 저장 (낙관적 반영 + 실패 원복)
  const handleToggleOnSitePickup = async (index) => {
    const item = editedOrderItems[index];
    if (!item?.id) {
      addNotification('저장 후 현장수령을 지정할 수 있습니다.', 'warning');
      return;
    }
    const next = !item.on_site_pickup;
    const targetOrderId = item.order_id ?? order.id;

    setEditedOrderItems(prev => prev.map((it, i) => (i === index ? { ...it, on_site_pickup: next } : it)));

    const { error } = await supabase
      .from('order_items')
      .update({ on_site_pickup: next })
      .eq('id', item.id)
      .eq('order_id', targetOrderId);

    if (error) {
      setEditedOrderItems(prev => prev.map((it, i) => (i === index ? { ...it, on_site_pickup: !next } : it)));
      addNotification(`현장수령 저장 실패: ${error.message}`, 'error');
      return;
    }
    onUpdate();
  };

  const handleCancelSection = (section) => {
    if (section === 'customer') {
      setEditedCustomerName(order.customer_name || '');
      setEditedPhoneNumber(order.phone_number || '');
      setEditedInpsytId(order.inpsyt_id || '');
    } else if (section === 'shipping') {
      setEditedShippingAddress(order.shipping_address?.address || '');
      setEditedShippingPostcode(order.shipping_address?.postcode || '');
      setEditedShippingDetail(order.shipping_address?.detail || '');
      setEditedCustomerRequest(order.customer_request || '');
    } else if (section === 'memo') {
      setEditedAdminMemo(order.admin_memo || '');
    } else if (section === 'items') {
      setEditedOrderItems(JSON.parse(JSON.stringify(order.mergedItems || order.order_items || [])));
      setSubtotal(order.total_cost || 0);
      setTotalDiscount(order.discount_amount || 0);
      setShippingFee(order.delivery_fee || 0);
      setFinalTotal(order.final_payment || 0);
    }
    setEditingSection(null);
  };

  // 결제대기 자동 승격 알림 — "결제 준비 완료" 토스트 + 알림음 + 상위(목록) 중복 알림 억제.
  const handlePreparingPromoted = () => {
    setCurrentStatus('pending');
    addNotification('결제 준비 완료 — 고객과 함께 확인한 뒤 카드로 결제하세요.', 'success');
    playBeep(audioCtxRef);
    onLocalPromote?.(order.id);
  };

  const handleSaveCustomer = async () => {
    setSectionSaving(true);
    try {
      // 담당자가 준비중 주문의 고객 정보를 직접 입력하는 경우에도 승격되어야 한다(상품이 이미 있을 때).
      const itemCount = (order.mergedItems || order.order_items || []).filter(it => it.product_id).length;
      const promote = shouldPromoteToPending({ status: order.status, itemCount, customerName: editedCustomerName });
      const patch = { customer_name: editedCustomerName, phone_number: editedPhoneNumber, inpsyt_id: editedInpsytId };
      // 승격 시 PIN 반납(match_code=null) — 사양 "결제대기 전환 시 PIN 미표시".
      if (promote) { patch.status = 'pending'; patch.match_code = null; }
      const { error } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', order.id);
      if (error) throw error;
      setOrder(prev => ({ ...prev, customer_name: editedCustomerName, phone_number: editedPhoneNumber, inpsyt_id: editedInpsytId, ...(promote ? { status: 'pending', match_code: null } : {}) }));
      addNotification('주문자 정보가 저장되었습니다.', 'success');
      if (promote) handlePreparingPromoted();
      setEditingSection(null);
      onUpdate();
    } catch (error) {
      addNotification(`주문자 정보 저장 실패: ${error.message}`, 'error');
    } finally {
      setSectionSaving(false);
    }
  };

  const handleSaveShipping = async () => {
    setSectionSaving(true);
    try {
      const shipping_address = { postcode: editedShippingPostcode, address: editedShippingAddress, detail: editedShippingDetail };
      const { error } = await supabase
        .from('orders')
        .update({ shipping_address, customer_request: editedCustomerRequest })
        .eq('id', order.id);
      if (error) throw error;
      setOrder(prev => ({ ...prev, shipping_address, customer_request: editedCustomerRequest }));
      addNotification('배송지 정보가 저장되었습니다.', 'success');
      setEditingSection(null);
      onUpdate();
    } catch (error) {
      addNotification(`배송지 정보 저장 실패: ${error.message}`, 'error');
    } finally {
      setSectionSaving(false);
    }
  };

  const handleSaveMemo = async () => {
    setSectionSaving(true);
    try {
      const { error } = await supabase.from('orders').update({ admin_memo: editedAdminMemo }).eq('id', order.id);
      if (error) throw error;
      setOrder(prev => ({ ...prev, admin_memo: editedAdminMemo }));
      addNotification('관리자 메모가 저장되었습니다.', 'success');
      setEditingSection(null);
      onUpdate();
    } catch (error) {
      addNotification(`관리자 메모 저장 실패: ${error.message}`, 'error');
    } finally {
      setSectionSaving(false);
    }
  };

  const handleSaveItems = async () => {
    // 병합 아이템에 외부(다른 주문) 아이템이 섞여 있으면 저장 차단 — 흡수 붕괴 방지.
    if (itemsLocked) {
      addNotification('연계 주문의 상품은 각 개별 주문에서 수정하세요.', 'warning');
      return;
    }
    setSectionSaving(true);
    try {
      const currentEvent = events.find(e => e.id === order.event_id);
      const discountRate = currentEvent?.discount_rate || 0;

      const itemsPayload = editedOrderItems.map(item => {
        const product = productsMap[item.product_id];
        // 서버(create-order)를 우회하는 직접 DB write — 이 공식이 정본.
        // 상품별 오버라이드·is_discountable·반올림 반영(과거 누락 동시 해소).
        const discountedPrice = getDiscountedUnit(product, discountRate);
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: discountedPrice,
          product_name: product?.name || null,
          product_code: product?.product_code || null,
          category: product?.category || null,
          list_price: product?.list_price || null,
          on_site_pickup: item.on_site_pickup ?? false,
        };
      });

      const { error: delError } = await supabase.from('order_items').delete().eq('order_id', order.id);
      if (delError) throw delError;
      const { error: insError } = await supabase.from('order_items').insert(itemsPayload);
      if (insError) throw insError;

      // 금액 4필드 UPDATE.
      const { error: ordError } = await supabase
        .from('orders')
        .update({ total_cost: subtotal, discount_amount: totalDiscount, delivery_fee: shippingFee, final_payment: finalTotal })
        .eq('id', order.id);
      if (ordError) throw ordError;

      // 준비중(PIN) 주문: 상품 1개+ 이고 (DB에) 고객 정보가 있으면 결제대기로 승격.
      // 로컬 order.customer_name 이 stale일 수 있어(고객이 상세 창 밖에서 먼저 제출) DB 기준으로 판정 —
      // .eq('status','preparing')·고객명 존재 조건을 건 UPDATE가 행을 돌려주면 전환된 것.
      // status_history 는 트리거(trg_status_history)가 채우므로 프론트에서 쓰지 않는다. PIN은 반납(match_code=null).
      let promoted = false;
      let promotedCustomer = null;
      if (order.status === 'preparing' && itemsPayload.filter(it => it.product_id).length >= 1) {
        const { data: promoteRows, error: promoteErr } = await supabase
          .from('orders')
          .update({ status: 'pending', match_code: null })
          .eq('id', order.id)
          .eq('status', 'preparing')
          .not('customer_name', 'is', null)
          .neq('customer_name', '')
          .select('id, status, customer_name, phone_number, inpsyt_id, shipping_address, customer_request');
        if (promoteErr) throw promoteErr;
        if (promoteRows && promoteRows.length > 0) { promoted = true; promotedCustomer = promoteRows[0]; }
      }

      const localItems = itemsPayload.map(it => ({ ...it, order_id: order.id }));
      setOrder(prev => ({
        ...prev,
        order_items: localItems,
        mergedItems: localItems,
        total_cost: subtotal,
        discount_amount: totalDiscount,
        delivery_fee: shippingFee,
        final_payment: finalTotal,
        ...(promoted ? {
          status: 'pending',
          match_code: null,
          customer_name: promotedCustomer.customer_name,
          phone_number: promotedCustomer.phone_number,
          inpsyt_id: promotedCustomer.inpsyt_id,
          shipping_address: promotedCustomer.shipping_address,
          customer_request: promotedCustomer.customer_request,
        } : {}),
      }));
      addNotification('주문 상품이 저장되었습니다.', 'success');
      if (promoted) handlePreparingPromoted();
      setEditingSection(null);
      onUpdate();
    } catch (error) {
      addNotification(`주문 상품 저장 실패: ${error.message}`, 'error');
    } finally {
      setSectionSaving(false);
    }
  };

  // B — 주문 성격 전환 (pending 전용). 무료배송 판정은 설정 기반(정가/할인가), 기본 정가. 공유 함수 경유.
  const computeShipping = (onSite) => {
    const originalTotal = order.total_cost || 0;
    return calcShippingFee({
      basis: settings.free_shipping_basis,
      originalTotal,
      discountedTotal: originalTotal - (order.discount_amount || 0),
      threshold: settings.free_shipping_threshold,
      shippingCost: settings.shipping_cost,
      isOnsite: onSite,
    });
  };

  const nextShippingFee = computeShipping(isOnSiteSale);
  const subtotalAfterDiscount = (order.total_cost || 0) - (order.discount_amount || 0);
  const nextFinalPayment = subtotalAfterDiscount + nextShippingFee;
  const onSiteChanged = isOnSiteSale !== (order.is_on_site_sale ?? false);

  const handleOnSiteSaleChange = (_, value) => {
    if (value === null) return;
    setIsOnSiteSale(value === 'onsite');
  };

  const handleSaveOnSiteSale = async () => {
    setOnSiteSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_on_site_sale: isOnSiteSale, delivery_fee: nextShippingFee, final_payment: nextFinalPayment })
        .eq('id', order.id);
      if (error) throw error;
      setOrder(prev => ({ ...prev, is_on_site_sale: isOnSiteSale, delivery_fee: nextShippingFee, final_payment: nextFinalPayment }));
      addNotification(isOnSiteSale ? '현장수령으로 전환되었습니다.' : '일반배송으로 전환되었습니다.', 'success');
      onUpdate();
    } catch (err) {
      addNotification(`주문 성격 전환 실패: ${err.message}`, 'error');
    } finally {
      setOnSiteSaving(false);
    }
  };

  const applyStatusUpdate = async (newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      addNotification(`주문 ${order.id}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      onUpdate();
      setCurrentStatus(newStatus);
      setOrder(prev => ({ ...prev, status: newStatus }));

      if (newStatus === 'paid' && !order.is_on_site_sale) {
        sendAlimtalk(order.id).then(({ success, error: alimtalkError, skipped }) => {
          if (skipped) return;
          const now = new Date().toISOString();
          if (!success) {
            addNotification(`알림톡 발송 실패 — ${alimtalkError}`, 'warning');
            setAlimtalk(prev => ({ ...prev, status: 'failed', attemptedAt: now, error: alimtalkError }));
          } else {
            addNotification('알림톡 발송 완료', 'info');
            setAlimtalk({ status: 'sent', sentAt: now, attemptedAt: now, error: null });
          }
          onUpdate();
        });
      }
    } catch (error) {
      addNotification(`주문 상태 업데이트 실패: ${error.message}`, 'error');
    }
  };

  const handleStatusSelect = async (newStatus) => {
    setCurrentStatus(newStatus);
    // 그룹 대표 취소 위임 인터셉트 — 상위(GroupOrderModal)가 처리하면 자체 업데이트 스킵.
    if (onStatusChangeIntercept) {
      const handled = await onStatusChangeIntercept(order, newStatus);
      if (handled) return;
    }
    applyStatusUpdate(newStatus);
  };

  const handleResendAlimtalk = async () => {
    const { success, error: alimtalkError } = await sendAlimtalk(order.id);
    const now = new Date().toISOString();
    if (success) {
      addNotification('알림톡 재발송 완료', 'success');
      setAlimtalk({ status: 'sent', sentAt: now, attemptedAt: now, error: null });
    } else {
      addNotification(`알림톡 재발송 실패 — ${alimtalkError}`, 'error');
      setAlimtalk(prev => ({ ...prev, status: 'failed', attemptedAt: now, error: alimtalkError }));
    }
    onUpdate();
  };

  const handlePhoneInput = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 7) formatted = digits.slice(0, 3) + '-' + digits.slice(3);
    else if (digits.length > 7) formatted = digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
    setEditedPhoneNumber(formatted);
  };

  const handleDaumComplete = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      if (extraAddress !== '') fullAddress += ` (${extraAddress})`;
    }
    setEditedShippingAddress(fullAddress);
    setEditedShippingPostcode(data.zonecode);
    setShowPostcode(false);
  };

  if (!order) return null;

  const renderEvent = events?.find(e => e.id === order.event_id);
  const discountRate = renderEvent?.discount_rate || 0;
  // 태그 우선 정렬용 — OrderPage.jsx와 동일 식(tags ∪ host_society). getEvents가 host_society를 포함해 고객 주문서와 완전 동치.
  const eventTags = [...new Set([...(renderEvent?.tags || []), renderEvent?.host_society].filter(Boolean))];

  // 상품 편집 잠금 — 병합 아이템에 다른 주문(order_id 불일치) 아이템이 섞였거나 껍데기 부모면 잠금.
  // (자식 단건·비연계 단건은 자기 아이템만 → 편집 가능)
  const itemsLocked =
    order.is_group_parent === true ||
    (editedOrderItems || []).some(i => i.order_id != null && i.order_id !== order.id);

  const canEdit = hasPermission('orders:edit');

  // 준비중(현장 도움 PIN) 주문 — 상태 행 PIN 재표시·준비 상태 줄·주문자/배송지 빈 상태.
  const isPreparing = currentStatus === 'preparing';
  const savedItemCount = (order.mergedItems || order.order_items || []).filter(it => it.product_id).length;
  const hasCustomerInfo = Boolean((order.customer_name || '').trim());
  // PIN 주문에서 온 주문(상태 이력에 preparing)만 결제대기 단계에서 "함께 확인 + 카드 결제" 안내를 띄운다.
  const cameFromPin = Array.isArray(order.status_history) && order.status_history.some(h => h.status === 'preparing');

  const renderEditableField = (value, onChange, placeholder, extra) => (
    <TextField value={value} onChange={onChange} size="small" fullWidth disabled={!canEdit} placeholder={placeholder} {...extra} />
  );

  const renderSectionAction = (section, onSave) => {
    if (!canEdit) return null;
    if (editingSection === section) {
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" onClick={() => handleCancelSection(section)} disabled={sectionSaving}>취소</Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSave}
            disabled={sectionSaving}
            startIcon={sectionSaving ? <CircularProgress size={14} /> : null}
          >
            저장
          </Button>
        </Box>
      );
    }
    const guarded = editingSection !== null;
    return (
      <IconButton
        size="small"
        onClick={() => setEditingSection(section)}
        disabled={guarded}
        title={guarded ? '편집 중인 섹션을 먼저 저장하거나 취소하세요' : '편집'}
        sx={{ color: theme.gray[500] }}
      >
        <EditIcon sx={{ fontSize: 18 }} />
      </IconButton>
    );
  };

  const editingCardSx = { borderColor: 'primary.main' };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 주문 상세 정보 — 주문번호/주문일/학회명/상태/알림톡/주문성격 */}
      <SectionCard title="주문 상세 정보" padding={20}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <InfoRow label="상품주문번호" value={order.id} mono labelWidth={96} />
          <InfoRow label="주문일" value={new Date(order.created_at).toLocaleString('ko-KR')} labelWidth={96} />
          <InfoRow
            label="학회명"
            labelWidth={96}
            value={(events && events.find(e => e.id === order.event_id)?.name) || 'N/A'}
          />
          <InfoRow
            label="상태"
            labelWidth={96}
            multiline={isPreparing}
            value={isPreparing ? (
              // 준비중: 뱃지 + PIN(match_code) 재표시. 전이는 취소만(결제대기 전환은 자동이라 드롭다운 대상 아님).
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <StatusBadge value="preparing" size="sm" />
                <PinChip pin={order.match_code} />
                {canEdit && (
                  <Button size="small" variant="text" color="error" onClick={() => handleStatusSelect('cancelled')} sx={{ minHeight: 32, px: 1 }}>
                    취소
                  </Button>
                )}
              </Box>
            ) : (
              <FormControl size="small" fullWidth>
                <Select value={currentStatus} onChange={(e) => handleStatusSelect(e.target.value)} disabled={!canEdit}>
                  {/* preparing(준비중)은 PIN 주문에서만 생기는 상태라 수동 선택지에서 뺀다. */}
                  {statusToKorean && Object.entries(statusToKorean)
                    .filter(([key]) => key !== 'preparing')
                    .map(([key, value]) => (
                      <MenuItem key={key} value={key}>{value}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
          />
          {!order.is_on_site_sale && (
            <InfoRow
              label="알림톡"
              labelWidth={96}
              multiline
              muted={alimtalk.status !== 'failed' && alimtalk.status !== 'sent' && !alimtalk.sentAt}
              value={
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {alimtalk.status === 'failed' ? (
                      <Typography variant="body2" component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
                        실패 {alimtalk.attemptedAt ? new Date(alimtalk.attemptedAt).toLocaleString('ko-KR') : ''}{alimtalk.error ? `: ${alimtalk.error}` : ''}
                      </Typography>
                    ) : (alimtalk.status === 'sent' || alimtalk.sentAt) ? (
                      `발송됨 ${alimtalk.sentAt ? new Date(alimtalk.sentAt).toLocaleString('ko-KR') : ''}`
                    ) : '미발송'}
                  </Box>
                  {canEdit && currentStatus === 'paid' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color={alimtalk.status === 'failed' ? 'error' : 'primary'}
                      onClick={handleResendAlimtalk}
                      sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      재발송
                    </Button>
                  )}
                </Box>
              }
            />
          )}
          {currentStatus === 'pending' && canEdit && (
            <InfoRow
              label="주문 성격"
              labelWidth={96}
              multiline
              value={(
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <ToggleButtonGroup value={isOnSiteSale ? 'onsite' : 'delivery'} exclusive size="small" onChange={handleOnSiteSaleChange}>
                      <ToggleButton value="delivery" sx={{ px: 2 }}>일반배송</ToggleButton>
                      <ToggleButton value="onsite" sx={{ px: 2 }}>현장수령</ToggleButton>
                    </ToggleButtonGroup>
                    {onSiteChanged && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleSaveOnSiteSale}
                        disabled={onSiteSaving}
                        startIcon={onSiteSaving ? <CircularProgress size={14} /> : null}
                      >
                        변경 저장
                      </Button>
                    )}
                  </Box>
                  {onSiteChanged && (
                    <Typography variant="caption" color="text.secondary">
                      배송비 {(order.delivery_fee || 0).toLocaleString()}원 → {nextShippingFee.toLocaleString()}원 · 최종결제 {(order.final_payment || 0).toLocaleString()}원 → {nextFinalPayment.toLocaleString()}원
                    </Typography>
                  )}
                </Box>
              )}
            />
          )}
        </Box>
      </SectionCard>

      {/* 상태 이력 */}
      {Array.isArray(order.status_history) && order.status_history.length > 0 && (
        <StatusHistoryAccordion history={order.status_history} statusToKorean={statusToKorean} />
      )}

      {/* 준비 상태 — 준비중(PIN)일 때만. "상품 n종 / 고객 정보 ○✕" */}
      {isPreparing && (
        <SectionCard title="준비 상태" padding={20}>
          <ReadinessRow itemCount={savedItemCount} hasCustomer={hasCustomerInfo} />
        </SectionCard>
      )}

      {/* 주문자 정보 */}
      <SectionCard
        title="주문자 정보"
        padding={20}
        action={renderSectionAction('customer', handleSaveCustomer)}
        sx={editingSection === 'customer' ? editingCardSx : undefined}
      >
        {isPreparing && !hasCustomerInfo && editingSection !== 'customer' ? (
          <EmptyState
            icon={PersonOutlineIcon}
            title="고객이 아직 제출하지 않았어요"
            description="고객이 PIN으로 배송지(성함·연락처·주소)를 입력·제출하면 표시됩니다. 담당자가 직접 입력할 수도 있어요."
            sx={{ py: 3 }}
          />
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <InfoRow
            label="주문자명"
            labelWidth={96}
            value={editingSection === 'customer'
              ? renderEditableField(editedCustomerName, (e) => setEditedCustomerName(e.target.value))
              : order.customer_name}
          />
          <InfoRow
            label="연락처"
            labelWidth={96}
            mono={editingSection !== 'customer'}
            value={editingSection === 'customer'
              ? renderEditableField(editedPhoneNumber, handlePhoneInput, '010-0000-0000')
              : (formatPhone(order.phone_number) || 'N/A')}
          />
          <InfoRow
            label="인싸이트 ID"
            labelWidth={96}
            value={editingSection === 'customer'
              ? renderEditableField(editedInpsytId, (e) => setEditedInpsytId(e.target.value))
              : (order.inpsyt_id || 'N/A')}
            muted={editingSection !== 'customer' && !order.inpsyt_id}
          />
        </Box>
        )}
      </SectionCard>

      {/* 배송지 정보 — 3필드 분리 유지 */}
      <SectionCard
        title="배송지 정보"
        padding={20}
        action={renderSectionAction('shipping', handleSaveShipping)}
        sx={editingSection === 'shipping' ? editingCardSx : undefined}
      >
        {isPreparing && !order.shipping_address?.address && editingSection !== 'shipping' ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>고객 제출 전에는 배송지가 비어 있습니다.</Typography>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <InfoRow
            label="우편번호"
            labelWidth={96}
            mono
            value={editingSection === 'shipping' ? (editedShippingPostcode || '-') : (order.shipping_address?.postcode || 'N/A')}
            muted={editingSection === 'shipping' ? !editedShippingPostcode : !order.shipping_address?.postcode}
          />
          <InfoRow
            label="주소"
            labelWidth={96}
            multiline
            value={editingSection === 'shipping' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1, color: editedShippingAddress ? 'text.primary' : 'text.secondary' }}>
                  {editedShippingAddress || '-'}
                </Typography>
                <Button variant="outlined" size="small" onClick={() => setShowPostcode(true)} disabled={!canEdit} sx={{ whiteSpace: 'nowrap' }}>
                  검색
                </Button>
              </Box>
            ) : (order.shipping_address?.address || 'N/A')}
          />
          <InfoRow
            label="상세 주소"
            labelWidth={96}
            multiline
            value={editingSection === 'shipping'
              ? renderEditableField(editedShippingDetail, (e) => setEditedShippingDetail(e.target.value))
              : (order.shipping_address?.detail || 'N/A')}
          />
          <InfoRow
            label="배송 메모"
            labelWidth={96}
            multiline
            value={editingSection === 'shipping'
              ? renderEditableField(editedCustomerRequest, (e) => setEditedCustomerRequest(e.target.value))
              : (order.customer_request || '없음')}
            muted={editingSection !== 'shipping' && !order.customer_request}
          />
        </Box>
        )}
      </SectionCard>

      {/* 관리자 메모 */}
      <SectionCard
        title="관리자 메모"
        padding={20}
        action={renderSectionAction('memo', handleSaveMemo)}
        sx={editingSection === 'memo' ? editingCardSx : undefined}
      >
        {editingSection === 'memo' ? (
          <TextField
            value={editedAdminMemo}
            onChange={(e) => setEditedAdminMemo(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
            placeholder="관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요."
            disabled={!canEdit}
          />
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: order.admin_memo ? 'text.primary' : 'text.secondary' }}>
            {order.admin_memo || '작성된 메모가 없습니다.'}
          </Typography>
        )}
      </SectionCard>

      {/* 주문 상품 목록 */}
      <SectionCard
        title="주문 상품 목록"
        padding={20}
        action={!itemsLocked ? renderSectionAction('items', handleSaveItems) : null}
        sx={editingSection === 'items' ? editingCardSx : undefined}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>상품명</TableCell>
                <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>정가</TableCell>
                <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>할인가</TableCell>
                <TableCell align="right" sx={{ minWidth: 60, whiteSpace: 'nowrap' }}>수량</TableCell>
                <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>합계</TableCell>
                {canEdit && <TableCell align="center" sx={{ minWidth: 64, whiteSpace: 'nowrap' }}>{order.is_on_site_sale ? '전체 현장수령' : '현장수령'}</TableCell>}
                {canEdit && editingSection === 'items' && <TableCell sx={{ minWidth: 50, whiteSpace: 'nowrap' }}>작업</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={5 + (canEdit ? 1 : 0) + (canEdit && editingSection === 'items' ? 1 : 0)} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : (
                (editedOrderItems || []).map((item, index) => {
                  const isItemsEditing = editingSection === 'items';
                  const product = productsMap[item.product_id];
                  const originalPrice = isItemsEditing
                    ? (product?.list_price || 0)
                    : (item.list_price || product?.list_price || 0);
                  // 편집 중: 유틸로 재계산. 비편집(기존 아이템): 스냅샷(price_at_purchase) 우선, 없으면 유틸 폴백.
                  const discountedPrice = isItemsEditing
                    ? getDiscountedUnit(product, discountRate)
                    : (item.price_at_purchase != null ? item.price_at_purchase : getDiscountedUnit(product, discountRate));
                  const itemTotal = discountedPrice * item.quantity;
                  // 할인율·할인액은 위에서 확정된 정가·할인가에서 역산 — 비편집(스냅샷) 주문은 당시 실제 할인율을,
                  // 편집 중이면 재계산된 할인가 기준을 그대로 반영(현재 행사율을 과거 주문에 재적용하지 않음).
                  const isRowDiscounted = discountedPrice < originalPrice;
                  const rowRatePct = originalPrice > 0 ? Math.round((1 - discountedPrice / originalPrice) * 100) : 0;
                  const rowDiscountAmount = (originalPrice - discountedPrice) * item.quantity;
                  return (
                    <TableRow key={index}>
                      <TableCell sx={{ p: 1 }}>
                        {isItemsEditing ? (
                          <Autocomplete
                            size="small"
                            fullWidth
                            options={products || []}
                            getOptionLabel={(option) => option.name || ''}
                            value={products?.find(p => p.id === item.product_id) || null}
                            onChange={(_, newValue) => { if (newValue) handleItemChange(index, 'product_id', newValue.id); }}
                            disabled={!canEdit}
                            renderInput={(params) => <TextField {...params} placeholder="상품 검색" />}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                          />
                        ) : (item.product_name || product?.name || '알 수 없는 상품')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{originalPrice.toLocaleString()}원</TableCell>
                      <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                        {discountedPrice.toLocaleString()}원
                        {isRowDiscounted ? (
                          <Typography variant="caption" sx={{ display: 'block', color: 'error.main', fontWeight: 700 }}>
                            {rowRatePct}% 할인
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ p: 1 }}>
                        {isItemsEditing ? (
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            size="small"
                            sx={{ width: 80 }}
                            inputProps={{ min: 0 }}
                            disabled={!canEdit}
                          />
                        ) : (item.quantity)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                        {itemTotal.toLocaleString()}원
                        {isRowDiscounted && (
                          <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                            -{rowDiscountAmount.toLocaleString()}원
                          </Typography>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={order.is_on_site_sale ? true : !!item.on_site_pickup}
                            onChange={() => handleToggleOnSitePickup(index)}
                            disabled={order.is_on_site_sale || !item.id || currentStatus !== 'pending' || isItemsEditing}
                            title={order.is_on_site_sale ? '전체 현장수령 주문 — 개별 지정 불가' : (isItemsEditing ? '상품 편집 중에는 지정할 수 없습니다' : (currentStatus !== 'pending' ? '결제완료 후에는 현장수령을 수정할 수 없습니다' : (item.id ? '현장수령 (출고 제외)' : '저장 후 지정 가능')))}
                            sx={{ p: 0.5 }}
                          />
                        </TableCell>
                      )}
                      {canEdit && isItemsEditing && (
                        <TableCell sx={{ p: 1 }}>
                          <IconButton onClick={() => handleRemoveOrderItem(index)} color="error" size="small" title="삭제">
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {canEdit && editingSection === 'items' && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleAddOrderItem} variant="outlined" size="small">상품 추가</Button>
          </Box>
        )}
        {itemsLocked && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            이 상품은 각 개별 주문에서 수정하세요.
          </Typography>
        )}
      </SectionCard>

      {/* 결제 정보 */}
      <SectionCard title="결제 정보" padding={20}>
        <PriceBlock
          rows={[
            { label: '정가의 합', value: subtotal },
            { label: '할인된 금액', value: totalDiscount, muted: totalDiscount === 0 },
            { label: '배송비', value: shippingFee, muted: shippingFee === 0 },
          ]}
          totalLabel="총 결제 금액"
          totalValue={finalTotal}
          totalColor={theme.palette.primary.main}
        />
      </SectionCard>

      {/* 준비중 안내 — 고객 제출 대기(시안 ④ preparing). 상품·고객정보 둘 다 차면 자동 결제대기. */}
      {isPreparing && (
        <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}` }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            고객이 제출해 <b>고객 정보 ○</b>가 되면 자동으로 결제대기로 바뀝니다. 그때 태블릿 화면을 고객에게 보여 주며 함께 확인한 뒤 결제하세요.
          </Typography>
        </Box>
      )}

      {/* 결제 준비 완료 — PIN 주문이 결제대기로 전환된 뒤 함께 확인 + 카드 결제(기존 paid 경로 재사용) */}
      {cameFromPin && currentStatus === 'pending' && (
        <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.accent.revenue, 0.06), border: `1px solid ${alpha(theme.accent.revenue, 0.25)}` }}>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: canEdit ? 1.5 : 0 }}>
            <b>결제 준비 완료.</b> 태블릿 화면의 상품·금액을 고객과 함께 확인한 뒤 카드로 결제하세요.
          </Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<CreditCardIcon sx={{ fontSize: 18 }} />} onClick={() => handleStatusSelect('paid')}>
              카드 결제 진행
            </Button>
          )}
        </Box>
      )}

      {/* 상품 추가 피커 — 고객 프론트 상품 선택 UX 재사용 */}
      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        discountRate={discountRate}
        eventTags={eventTags}
        eventName={renderEvent?.name || ''}
      />

      {/* Daum 우편번호 */}
      <Dialog open={showPostcode} onClose={() => setShowPostcode(false)} maxWidth="sm" fullWidth sx={{ zIndex: 1400 }}>
        <DialogTitle>주소 검색</DialogTitle>
        <DialogContent>
          <DaumPostcode onComplete={handleDaumComplete} style={{ height: '60vh' }} />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// ─── 상태 이력 아코디언 ────────────────────────────
const StatusHistoryAccordion = ({ history, statusToKorean }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const reversed = [...history].reverse();
  const current = reversed[0];
  const rest = reversed.slice(1);

  return (
    <SectionCard padding={20}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography variant="subtitle1">상태 이력</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!open && rest.length > 0 && (
            <Typography variant="caption" color="text.secondary">{rest.length}개 이전 이력</Typography>
          )}
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: `${theme.radii.md}px`, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25,
            bgcolor: theme.gray[50],
            borderBottom: open && rest.length > 0 ? `1px solid ${theme.gray[200]}` : 'none',
          }}
        >
          <StatusBadge value={current.status} size="sm" label={statusToKorean?.[current.status]} />
          <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1' }}>
            {new Date(current.changed_at).toLocaleString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </Typography>
          <Box
            sx={{
              ml: 'auto', px: 1, py: 0.25, borderRadius: `${theme.radii.sm}px`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`, color: theme.palette.primary.main,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>현재</Typography>
          </Box>
        </Box>
        <Collapse in={open}>
          {rest.map((entry, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25,
                borderBottom: idx < rest.length - 1 ? `1px solid ${theme.gray[200]}` : 'none',
              }}
            >
              <StatusBadge value={entry.status} size="sm" label={statusToKorean?.[entry.status]} />
              <Typography variant="body2" color="text.secondary" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                {new Date(entry.changed_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </Typography>
            </Box>
          ))}
        </Collapse>
      </Paper>
    </SectionCard>
  );
};

export default OrderSections;
