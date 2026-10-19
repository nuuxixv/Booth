import React, { useEffect, useCallback, useReducer } from 'react';
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
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Divider,
  Card,
  CardContent,
  Stack,
  Chip,
  SwipeableDrawer,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format, subDays } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { ShoppingCart as ShoppingCartIcon, RestartAlt as RestartAltIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import OrderDetailModal from './OrderDetailModal';
import GroupOrderModal from './GroupOrderModal';
import NewOrderModal from './NewOrderModal';
import ShippingPickModal from './ShippingPickModal';
import TableSkeleton from './TableSkeleton';
import { SearchOff as SearchOffIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import { getEvents } from '../api/events';
import { sortEventsForDropdown, groupEventsForDropdown, formatEventStartDate } from '../utils/eventSort';
import { fetchAllProducts } from '../api/products';
import { getOrders, groupLinkedOrders, reassignGroupRepresentative } from '../api/orders';
import { sendAlimtalk } from '../api/alimtalk';
import { buildOrderTree, summarizeGroupStatus, formatGroupCustomerNames, classifyGroupStatusChange, selectableOrderIds, partitionBulkSelectable } from '../utils/groupOrder';
import { PageHeader, SectionCard, StatusBadge, EmptyState, DateField } from './ui';
import { STATUS_TO_KOREAN, ALLOWED_TRANSITIONS } from '../constants/orderStatus';

const statusToKorean = STATUS_TO_KOREAN;

const DATE_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '최근 2일', days: 2 },
  { label: '최근 3일', days: 3 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '전체', days: null },
];

// 알림톡 발송 실패 칩 — failed만 표시 (미발송 null·sent는 표시 안 함)
const AlimtalkFailBadge = ({ sx }) => {
  const theme = useTheme();
  const color = theme.palette.error.main;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.2)}`,
        ...sx,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, color, lineHeight: 1, whiteSpace: 'nowrap' }}>
        알림톡 실패
      </Typography>
    </Box>
  );
};

const initialState = {
  orders: [],
  loading: true,
  productsLoading: true,
  currentPage: 1,
  totalOrders: 0,
  searchTerm: '',
  selectedStatuses: [],
  events: [],
  selectedEvents: [],
  startDate: subDays(new Date(), 7),
  endDate: new Date(),
  products: [],
  productsMap: {},
  openOrderDetailModal: false,
  selectedOrder: null,
  openNewOrderModal: false,
  newOrder: {
    isOnSiteSale: false,
    customerName: '',
    contact: '',
    address: '',
    selectedEvent: '',
    items: [{ product_id: '', quantity: 1, price_at_purchase: 0 }],
  },

  newOrderCalculations: {
    totalAmount: 0,
    discountAmount: 0,
    shippingCost: 0,
    finalPayment: 0,
  },
  settings: {
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  },
  selectedOrders: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'SET_SELECTED_ORDERS':
        return { ...state, selectedOrders: action.payload };
    case 'TOGGLE_SELECT_ALL':
        if (action.payload.length === state.orders.length) {
            return { ...state, selectedOrders: [] };
        }
        return { ...state, selectedOrders: action.payload };
    case 'SET_FILTER':
      return { ...state, currentPage: 1, selectedOrders: [], [action.payload.key]: action.payload.value };
    case 'SET_FILTERS':
      return { ...state, currentPage: 1, selectedOrders: [], ...action.payload };
    case 'CLEAR_FILTERS':
      return {
        ...state,
        searchTerm: '',
        selectedStatuses: [],
        selectedEvents: [],
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        selectedOrders: [],
      };
    case 'OPEN_ORDER_DETAIL':
      return { ...state, selectedOrder: action.payload, openOrderDetailModal: true };
    case 'CLOSE_ORDER_DETAIL':
      return { ...state, selectedOrder: null, openOrderDetailModal: false };
    case 'OPEN_NEW_ORDER':
      return { ...state, openNewOrderModal: true, newOrder: initialState.newOrder };
    case 'CLOSE_NEW_ORDER':
      return { ...state, openNewOrderModal: false };
    case 'UPDATE_NEW_ORDER_FIELD':
      return { ...state, newOrder: { ...state.newOrder, [action.payload.key]: action.payload.value } };
    case 'TOGGLE_ONSITE_SALE': {
        const isOnSite = action.payload;
        return {
            ...state,
            newOrder: {
                ...state.newOrder,
                isOnSiteSale: isOnSite,
                customerName: isOnSite ? `현장판매_${Date.now()}` : '',
                contact: '',
                address: '',
            }
        };
    }
    case 'UPDATE_NEW_ORDER_ITEM': {
        const newItems = [...state.newOrder.items];
        newItems[action.payload.index][action.payload.field] = action.payload.value;
        return { ...state, newOrder: { ...state.newOrder, items: newItems } };
    }
    case 'ADD_NEW_ORDER_ITEM':
        return { ...state, newOrder: { ...state.newOrder, items: [...state.newOrder.items, { product_id: '', quantity: 1, price_at_purchase: 0 }] } };
    case 'REMOVE_NEW_ORDER_ITEM':
        return { ...state, newOrder: { ...state.newOrder, items: state.newOrder.items.filter((_, i) => i !== action.payload) } };
    case 'SET_NEW_ORDER_CALCULATIONS':
        return { ...state, newOrderCalculations: action.payload };
    default:
      throw new Error();
  }
}

const OrderManagementPage = () => {
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [productSearchTerm, setProductSearchTerm] = React.useState('');
  const [selectedProductCategory, setSelectedProductCategory] = React.useState('');
  const [searchParams] = useSearchParams();
  // lazy init: 모듈 로드 시점에 한 번 고정되는 것이 아니라, 컴포넌트 마운트 시점에 재평가.
  // 장기 세션(탭을 며칠간 열어둠)에서 startDate/endDate가 옛날 날짜로 굳는 버그 방지.
  const [state, dispatch] = useReducer(reducer, null, () => ({
    ...initialState,
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    selectedStatuses: searchParams.get('status') ? [searchParams.get('status')] : [],
  }));
  const [bulkStatus, setBulkStatus] = React.useState('');
  const [pick, setPick] = React.useState({ open: false, oldRep: null, candidates: [], newStatus: null, groupParentId: null });

  const handleSelectAllClick = () => {
    // 합배송 그룹 소속(껍데기·자식 전부)은 전체 선택 대상에서 제외 — 위임 경로 우회 방지.
    const selectable = selectableOrderIds(state.orders);
    if (state.selectedOrders.length === selectable.length && selectable.length > 0) {
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
    } else {
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: selectable });
    }
  };

  const handleSelectOneClick = (event, id) => {
    event.stopPropagation();
    const selectedIndex = state.selectedOrders.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(state.selectedOrders, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(state.selectedOrders.slice(1));
    } else if (selectedIndex === state.selectedOrders.length - 1) {
      newSelected = newSelected.concat(state.selectedOrders.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        state.selectedOrders.slice(0, selectedIndex),
        state.selectedOrders.slice(selectedIndex + 1),
      );
    }
    dispatch({ type: 'SET_SELECTED_ORDERS', payload: newSelected });
  };


  const ordersPerPage = 10;

  const fetchProducts = useCallback(async () => {
    dispatch({ type: 'SET_STATE', payload: { productsLoading: true } });
    try {
      const productsData = await fetchAllProducts();
      const newProductsMap = {};
      productsData.forEach(p => { newProductsMap[p.id] = { id: p.id, name: p.name, list_price: p.list_price, is_popular: p.is_popular, category: p.category, is_discountable: p.is_discountable, discount_override: p.discount_override }; });
      dispatch({ type: 'SET_STATE', payload: { products: productsData, productsMap: newProductsMap } });
    } catch {
      addNotification('상품 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      dispatch({ type: 'SET_STATE', payload: { productsLoading: false } });
    }
  }, [addNotification]);

  const fetchEvents = useCallback(async () => {
    try {
      const eventsData = await getEvents();
      dispatch({ type: 'SET_STATE', payload: { events: sortEventsForDropdown(eventsData) } });
    } catch {
      addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
    }
  }, [addNotification]);

  const fetchOrders = useCallback(async () => {
    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      const { data, count } = await getOrders({
        currentPage: state.currentPage,
        ordersPerPage,
        searchTerm: state.searchTerm,
        selectedStatuses: state.selectedStatuses,
        selectedEvents: state.selectedEvents,
        startDate: state.startDate,
        endDate: state.endDate,
        productCategory: selectedProductCategory,
        productSearchTerm,
      });
      dispatch({ type: 'SET_STATE', payload: { orders: groupLinkedOrders(data || []), totalOrders: count || 0 } });
    } catch {
      addNotification('주문 정보를 불러오는 데 실패했습니다.', 'error');
      dispatch({ type: 'SET_STATE', payload: { orders: [], totalOrders: 0 } });
    }
    dispatch({ type: 'SET_STATE', payload: { loading: false } });
  }, [state.currentPage, state.searchTerm, state.selectedStatuses, state.selectedEvents, state.startDate, state.endDate, selectedProductCategory, productSearchTerm, addNotification]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').single();
    if (data) {
      dispatch({ type: 'SET_STATE', payload: { settings: data } });
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchEvents();
    fetchSettings();
  }, [fetchProducts, fetchEvents, fetchSettings]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    dispatch({ type: 'SET_FILTER', payload: { key: 'currentPage', value: 1 } });
  }, [selectedProductCategory, productSearchTerm]);

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || state.selectedOrders.length === 0) {
      addNotification('변경할 상태를 선택하고, 하나 이상의 주문을 선택해주세요.', 'warning');
      return;
    }

    // 최종 가드 — 선택 목록에 합배송 그룹 소속이 섞여 있으면 제외(대표 배송지 스테일 방지).
    // 위임은 개별 행·상세 경로가 담당하므로 여기선 걸러내기만 한다.
    const { allowedIds, excludedIds } = partitionBulkSelectable(state.orders, state.selectedOrders);
    if (excludedIds.length > 0) {
      addNotification(`합배송 묶음 ${excludedIds.length}건은 제외했습니다 — 개별 변경을 이용하세요.`, 'warning');
    }
    if (allowedIds.length === 0) {
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
      setBulkStatus('');
      return;
    }

    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      const { error } = await supabase.rpc('bulk_update_order_status', {
        order_ids: allowedIds,
        new_status: bulkStatus
      });

      if (error) throw error;

      addNotification(`${allowedIds.length}개 주문의 상태가 '${statusToKorean[bulkStatus]}'으로 업데이트되었습니다.`, 'success');

      // paid 일괄 전환 시 알림톡 순차 발송
      if (bulkStatus === 'paid') {
        let successCount = 0;
        let failCount = 0;
        let firstFailReason = null;

        for (const orderId of allowedIds) {
          const { success, skipped, error: alimtalkError } = await sendAlimtalk(orderId);
          if (skipped) continue;
          if (success) successCount++;
          else {
            failCount++;
            if (!firstFailReason) firstFailReason = alimtalkError;
          }
        }

        if (successCount + failCount > 0) {
          if (failCount === 0) {
            addNotification(`알림톡 ${successCount}건 발송 완료`, 'info');
          } else {
            const reason = firstFailReason ? ` — ${firstFailReason}` : '';
            addNotification(`알림톡 ${successCount}건 성공, ${failCount}건 실패${reason} — 실패 건은 모달에서 재발송하세요.`, 'warning');
          }
        }
      }

      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
      setBulkStatus('');
      fetchOrders();
    } catch (err) {
      addNotification(`일괄 상태 업데이트 실패: ${err.message}`, 'error');
    } finally {
      dispatch({ type: 'SET_STATE', payload: { loading: false } });
    }
  };

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      addNotification(`주문 ${orderId}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      fetchOrders();

      // paid 전환 시 알림톡 자동 발송 (현장 수령 제외)
      if (newStatus === 'paid') {
        sendAlimtalk(orderId).then(({ success, error: alimtalkError, skipped }) => {
          if (skipped) return;
          if (!success) addNotification(`알림톡 발송 실패 — ${alimtalkError}`, 'warning');
          else addNotification('알림톡 발송 완료', 'info');
          fetchOrders();
        });
      }
    } catch (err) {
      addNotification(`주문 상태 업데이트 실패: ${err.message}`, 'error');
    }
  }, [fetchOrders, addNotification, state.orders]);

  // 합배송 자식 행 상태 변경 — 대표 취소·환불 시 배송지 위임 경로를 태운다 (GroupOrderModal과 동일 규칙).
  const handleGroupChildStatusChange = async (node, child, newStatus) => {
    const { mode, siblings } = classifyGroupStatusChange({
      children: node.children,
      repChildId: node.shell.representative_child_id,
      child,
      newStatus,
    });

    if (mode === 'passthrough') {
      handleStatusChange(child.id, newStatus);
      return;
    }

    if (mode === 'auto') {
      try {
        await reassignGroupRepresentative(node.shell.id, child.id, siblings[0].id);
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', child.id);
        if (error) throw error;
        addNotification('묶음 배송지를 자동으로 옮기고 주문을 취소했습니다.', 'success');
        fetchOrders();
      } catch (e) {
        addNotification('배송지 위임 실패: ' + e.message, 'error');
      }
      return;
    }

    setPick({ open: true, oldRep: child, candidates: siblings, newStatus, groupParentId: node.shell.id });
  };

  const formatOrderId = (order) => {
    if (order.parent_order_id) {
      return `#${order.id}(${order.parent_order_id})`;
    }
    if (order.linkedChildren && order.linkedChildren.length > 0) {
      return `#${order.id}-${order.linkedChildren.length + 1}`;
    }
    return `#${order.id}`;
  };

  const handleDatePreset = (days) => {
    if (days === null) {
      dispatch({ type: 'SET_FILTERS', payload: { startDate: null, endDate: null } });
      return;
    }
    const now = new Date();
    const start = days === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : subDays(now, days);
    dispatch({ type: 'SET_FILTERS', payload: { startDate: start, endDate: now } });
  };

  // 행사를 처음 선택하는 순간(없음→있음)에만 기간을 전체로 전환 — 그 학회 주문이 기간에 안 잘리게.
  // 이후 재선택·해제는 기간을 건드리지 않는다(사용자가 다시 좁힐 자유 보존).
  const handleEventsChange = (value) => {
    if (state.selectedEvents.length === 0 && value.length > 0) {
      dispatch({ type: 'SET_FILTERS', payload: { selectedEvents: value, startDate: null, endDate: null } });
    } else {
      dispatch({ type: 'SET_FILTER', payload: { key: 'selectedEvents', value } });
    }
  };

  const activeFilterCount = [
    state.selectedEvents.length > 0,
    state.selectedStatuses.length > 0,
    Boolean(state.searchTerm),
    Boolean(productSearchTerm),
    Boolean(selectedProductCategory),
  ].filter(Boolean).length;

  // 현재 startDate·endDate가 어느 프리셋과 일치하는지 판정(시분초 무시, yyyy-MM-dd 비교).
  // 'all'=전체 기간, 숫자=해당 일수 프리셋, null=사용자 임의 기간(활성 칩 없음).
  const activePresetDays = React.useMemo(() => {
    if (!state.startDate && !state.endDate) return 'all';
    if (!state.startDate || !state.endDate) return null;
    const now = new Date();
    if (format(state.endDate, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) return null;
    const startStr = format(state.startDate, 'yyyy-MM-dd');
    for (const { days } of DATE_PRESETS) {
      if (days === null) continue;
      const presetStart = days === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : subDays(now, days);
      if (format(presetStart, 'yyyy-MM-dd') === startStr) return days;
    }
    return null;
  }, [state.startDate, state.endDate]);

  const productCategories = ['검사', '도서', '도구'];

  // 합배송 트리 — 껍데기 그룹 노드 + 단독 노드
  const orderTree = React.useMemo(() => buildOrderTree(state.orders), [state.orders]);
  // 체크박스·일괄 상태 변경 대상 = 합배송 그룹 소속(껍데기·자식)이 아닌 단독 실 주문만
  const selectableIds = React.useMemo(
    () => selectableOrderIds(state.orders),
    [state.orders]
  );
  const isEmpty = orderTree.length === 0;

  const openOrder = (order) => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order });

  // ─── 데스크톱 행 렌더 ───────────────────────────────
  const renderSingleRow = (order) => {
    const isSelected = state.selectedOrders.indexOf(order.id) !== -1;
    return (
      <TableRow key={order.id} hover selected={isSelected} sx={{ cursor: 'pointer' }}>
        {hasPermission('orders:edit') && (
          order.parent_order_id ? (
            <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
              <Tooltip title="합배송 주문은 개별 행 또는 상세에서 변경하세요">
                <span><Checkbox disabled /></span>
              </Tooltip>
            </TableCell>
          ) : (
            <TableCell padding="checkbox" onClick={(e) => handleSelectOneClick(e, order.id)}>
              <Checkbox checked={isSelected} />
            </TableCell>
          )
        )}
        <TableCell onClick={() => openOrder(order)}>{formatOrderId(order)}</TableCell>
        <TableCell onClick={() => openOrder(order)}>{order.customer_name}</TableCell>
        <TableCell onClick={() => openOrder(order)}>{state.events.find(e => e.id === order.event_id)?.name || 'N/A'}</TableCell>
        <TableCell onClick={() => openOrder(order)}>{(order.final_payment || 0).toLocaleString()}원</TableCell>
        <TableCell onClick={() => openOrder(order)}>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
        <TableCell>
          {(() => {
            const transitions = ALLOWED_TRANSITIONS[order.status] || [];
            return transitions.length === 0 ? (
              <StatusBadge value={order.status} size="sm" label={statusToKorean[order.status]} />
            ) : (
              <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }} onClick={(e) => e.stopPropagation()}>
                <Select
                  value=""
                  displayEmpty
                  renderValue={() => statusToKorean[order.status]}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  disabled={!hasPermission('orders:edit')}
                >
                  {transitions.map((key) => <MenuItem key={key} value={key}>{statusToKorean[key]}</MenuItem>)}
                </Select>
              </FormControl>
            );
          })()}
          {order.alimtalk_status === 'failed' && (<Box sx={{ mt: 0.5 }}><AlimtalkFailBadge /></Box>)}
        </TableCell>
      </TableRow>
    );
  };

  const renderGroupRows = (node) => {
    const { shell, children } = node;
    const repId = shell.representative_child_id ?? children[0]?.id ?? shell.id;
    const summary = summarizeGroupStatus(children);
    const eventName = state.events.find(e => e.id === shell.event_id)?.name || 'N/A';
    const colSpanForEdit = hasPermission('orders:edit') ? 1 : 0;
    const rows = [
      <TableRow key={`shell-${shell.id}`} hover onClick={() => openOrder(shell)} sx={{ cursor: 'pointer', bgcolor: theme.gray[50] }}>
        {colSpanForEdit === 1 && <TableCell padding="checkbox" />}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>#{repId} 외 {Math.max(0, children.length - 1)}건</Typography>
            <StatusBadge
              kind="category"
              value="onsite"
              label="연계"
              size="sm"
              sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), borderColor: alpha(theme.palette.warning.main, 0.3), color: theme.palette.warning.dark }}
            />
          </Box>
        </TableCell>
        <TableCell>{formatGroupCustomerNames(children)}</TableCell>
        <TableCell>{eventName}</TableCell>
        <TableCell>{(shell.mergedTotal ?? shell.final_payment ?? 0).toLocaleString()}원</TableCell>
        <TableCell>{format(new Date(shell.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
            <StatusBadge value={summary.value} size="sm" label={statusToKorean[summary.value]} />
            {summary.caption && <Typography variant="caption" color="text.secondary">{summary.caption}</Typography>}
          </Box>
        </TableCell>
      </TableRow>,
    ];
    children.forEach((child) => {
      const childTransitions = ALLOWED_TRANSITIONS[child.status] || [];
      rows.push(
        <TableRow key={`child-${child.id}`} hover onClick={() => openOrder(shell)} sx={{ cursor: 'pointer' }}>
          {colSpanForEdit === 1 && <TableCell padding="checkbox" />}
          <TableCell sx={{ borderLeft: `1px solid ${theme.gray[300]}`, pl: 3 }}>
            <Typography variant="body2" color="text.secondary">#{child.id}</Typography>
          </TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>{child.customer_name}</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>{eventName}</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>{(child.final_payment || 0).toLocaleString()}원</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>{format(new Date(child.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
          <TableCell>
            {childTransitions.length === 0 ? (
              <StatusBadge value={child.status} size="sm" label={statusToKorean[child.status]} />
            ) : (
              <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }} onClick={(e) => e.stopPropagation()}>
                <Select
                  value=""
                  displayEmpty
                  renderValue={() => statusToKorean[child.status]}
                  onChange={(e) => handleGroupChildStatusChange(node, child, e.target.value)}
                  disabled={!hasPermission('orders:edit')}
                >
                  {childTransitions.map((key) => <MenuItem key={key} value={key}>{statusToKorean[key]}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </TableCell>
        </TableRow>
      );
    });
    return rows;
  };

  // ─── 모바일 카드 렌더 ───────────────────────────────
  const renderMobileSingle = (order) => {
    const isSelected = state.selectedOrders.indexOf(order.id) !== -1;
    return (
      <Card
        key={order.id}
        variant="outlined"
        onClick={() => openOrder(order)}
        sx={{ borderColor: isSelected ? 'primary.main' : 'divider', borderWidth: isSelected ? 2 : 1 }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              {hasPermission('orders:edit') && (
                order.parent_order_id ? (
                  <Tooltip title="합배송 주문은 개별 행 또는 상세에서 변경하세요">
                    <span onClick={(e) => e.stopPropagation()}><Checkbox disabled sx={{ p: 0 }} /></span>
                  </Tooltip>
                ) : (
                  <Checkbox checked={isSelected} onClick={(e) => handleSelectOneClick(e, order.id)} sx={{ p: 0 }} />
                )
              )}
              <Typography variant="body2" color="text.secondary">{format(new Date(order.created_at), 'yyyy-MM-dd')}</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.75}>
              {order.alimtalk_status === 'failed' && <AlimtalkFailBadge />}
              <StatusBadge value={order.status} size="sm" />
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="flex-end">
            <Box>
              <Typography variant="subtitle1">{order.customer_name}</Typography>
              <Typography variant="body2" color="text.secondary">{state.events.find(e => e.id === order.event_id)?.name || 'N/A'}</Typography>
            </Box>
            <Typography variant="subtitle1" color="primary.main">{(order.final_payment || 0).toLocaleString()}원</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderMobileGroup = ({ shell, children }) => {
    const repId = shell.representative_child_id ?? children[0]?.id ?? shell.id;
    const summary = summarizeGroupStatus(children);
    return (
      <Card key={`shell-${shell.id}`} variant="outlined" onClick={() => openOrder(shell)} sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={1}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>#{repId} 외 {Math.max(0, children.length - 1)}건</Typography>
              <StatusBadge
                kind="category"
                value="onsite"
                label="연계"
                size="sm"
                sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), borderColor: alpha(theme.palette.warning.main, 0.3), color: theme.palette.warning.dark }}
              />
            </Box>
            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.25}>
              <StatusBadge value={summary.value} size="sm" label={statusToKorean[summary.value]} />
              {summary.caption && <Typography variant="caption" color="text.secondary">{summary.caption}</Typography>}
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="flex-end">
            <Box>
              <Typography variant="subtitle1">{formatGroupCustomerNames(children)}</Typography>
              <Typography variant="body2" color="text.secondary">{state.events.find(e => e.id === shell.event_id)?.name || 'N/A'}</Typography>
            </Box>
            <Typography variant="subtitle1" color="primary.main">{(shell.mergedTotal ?? shell.final_payment ?? 0).toLocaleString()}원</Typography>
          </Box>
          <Box sx={{ mt: 1, pl: 1.5, borderLeft: `1px solid ${theme.gray[300]}`, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {children.map((child) => (
              <Box key={child.id} display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">#{child.id} · {child.customer_name}</Typography>
                <StatusBadge value={child.status} size="sm" label={statusToKorean[child.status]} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const filterControls = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* 날짜 프리셋 */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {DATE_PRESETS.map(({ label, days }) => {
          const active = days === null ? activePresetDays === 'all' : activePresetDays === days;
          return (
            <Chip
              key={label}
              label={label}
              size="small"
              variant={active ? 'filled' : 'outlined'}
              color={active ? 'primary' : 'default'}
              onClick={() => handleDatePreset(days)}
              sx={{ fontWeight: active ? 700 : 500, cursor: 'pointer' }}
            />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* 학회 멀티 선택 */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>행사 선택</InputLabel>
        <Select
          multiple
          value={state.selectedEvents}
          label="행사 선택"
          input={<OutlinedInput label="행사 선택" />}
          onChange={(e) => handleEventsChange(e.target.value)}
          renderValue={(selected) =>
            selected.length === 0
              ? '전체'
              : selected.length === 1
              ? state.events.find(e => e.id === selected[0])?.name || ''
              : `${selected.length}개 선택`
          }
        >
          {(() => {
            const { pinned, rest } = groupEventsForDropdown(state.events);
            const renderItem = (event) => (
              <MenuItem key={event.id} value={event.id}>
                <Checkbox checked={state.selectedEvents.includes(event.id)} size="small" />
                <ListItemText
                  primary={event.name}
                  secondary={formatEventStartDate(event.start_date) || '시작일 미정'}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </MenuItem>
            );
            return [
              ...pinned.map(renderItem),
              pinned.length > 0 && rest.length > 0 && <Divider key="event-group-divider" />,
              ...rest.map(renderItem),
            ];
          })()}
        </Select>
      </FormControl>

      {/* 주문상태 멀티 선택 */}
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>주문 상태</InputLabel>
        <Select
          multiple
          value={state.selectedStatuses}
          label="주문 상태"
          input={<OutlinedInput label="주문 상태" />}
          onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'selectedStatuses', value: e.target.value } })}
          renderValue={(selected) =>
            selected.length === 0
              ? '전체'
              : selected.map(s => statusToKorean[s]).join(', ')
          }
        >
          {Object.entries(statusToKorean).map(([key, value]) => (
            <MenuItem key={key} value={key}>
              <Checkbox checked={state.selectedStatuses.includes(key)} size="small" />
              <ListItemText primary={value} primaryTypographyProps={{ variant: 'body2' }} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="이름·연락처·ID·주문번호 검색"
        variant="outlined"
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
        value={state.searchTerm}
        onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'searchTerm', value: e.target.value } })}
      />
      <DateField
        mode="range"
        label="기간"
        size="small"
        fullWidth={false}
        sx={{ minWidth: 260 }}
        value={{
          start: state.startDate ? format(state.startDate, 'yyyy-MM-dd') : '',
          end: state.endDate ? format(state.endDate, 'yyyy-MM-dd') : '',
        }}
        onChange={({ start, end }) => dispatch({
          type: 'SET_FILTERS',
          payload: { startDate: start ? new Date(start) : null, endDate: end ? new Date(end) : null },
        })}
      />
      <Button
        variant="outlined"
        startIcon={<RestartAltIcon />}
        onClick={() => { dispatch({ type: 'CLEAR_FILTERS' }); setProductSearchTerm(''); setSelectedProductCategory(''); if (isMobile) setFilterDrawerOpen(false); }}
      >
        초기화
      </Button>
    </Box>
    {/* 상품 검색 + 카테고리 필터 */}
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <TextField
        label="상품명 검색"
        variant="outlined"
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
        value={productSearchTerm}
        onChange={(e) => setProductSearchTerm(e.target.value)}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip
          label="전체"
          size="small"
          variant={selectedProductCategory === '' ? 'filled' : 'outlined'}
          color={selectedProductCategory === '' ? 'secondary' : 'default'}
          onClick={() => setSelectedProductCategory('')}
          sx={{ fontWeight: selectedProductCategory === '' ? 700 : 500 }}
        />
        {productCategories.map(cat => (
          <Chip
            key={cat}
            label={`${cat} 구매`}
            size="small"
            variant={selectedProductCategory === cat ? 'filled' : 'outlined'}
            color={selectedProductCategory === cat ? 'secondary' : 'default'}
            onClick={() => setSelectedProductCategory(prev => prev === cat ? '' : cat)}
            sx={{ fontWeight: selectedProductCategory === cat ? 700 : 500 }}
          />
        ))}
      </Box>
    </Box>
    </Box>
  );

  if (!user || (!hasPermission('orders:view') && !hasPermission('master'))) {
    return <Box sx={{ p: 3 }}><Typography>주문 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {hasPermission('orders:edit') && (
        <Button variant="contained" color="primary" onClick={() => dispatch({ type: 'OPEN_NEW_ORDER' })}>
          + 신규 주문
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="주문 관리"
        icon={ShoppingCartIcon}
        action={headerAction}
      />

      {isMobile ? (
        <Box sx={{ px: 1, mb: 2, display: 'flex', justifyContent: 'flex-start', gap: 1, alignItems: 'center' }}>
          <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setFilterDrawerOpen(true)}>
            필터{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
          <SwipeableDrawer
            anchor="bottom"
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            onOpen={() => setFilterDrawerOpen(true)}
            PaperProps={{ sx: { p: 3, pb: 6, maxHeight: '80vh' } }}
          >
            <Typography variant="h6" fontWeight="bold" mb={2}>주문 필터</Typography>
            {filterControls}
            <Button variant="contained" fullWidth sx={{ mt: 3, minHeight: 48 }} onClick={() => setFilterDrawerOpen(false)}>
              확인
            </Button>
          </SwipeableDrawer>
        </Box>
      ) : (
        <SectionCard sx={{ mb: 2 }} padding={16}>
          {filterControls}
        </SectionCard>
      )}

      <SectionCard padding={0} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {hasPermission('orders:edit') && state.selectedOrders.length > 0 && (
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'grey.50', borderBottom: `1px solid ${theme.gray[200]}` }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {state.selectedOrders.length}개 선택됨
            </Typography>
            <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'background.paper' }}>
              <InputLabel>상태 일괄 변경</InputLabel>
              <Select
                value={bulkStatus}
                label="상태 일괄 변경"
                onChange={(e) => setBulkStatus(e.target.value)}
              >
                {/* preparing(준비중)은 PIN 주문에서만 생기는 상태라 일괄 변경 대상에서 뺀다. */}
                {Object.entries(statusToKorean).filter(([key]) => key !== 'preparing').map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>
              적용
            </Button>
          </Box>
        )}
        {isMobile ? (
          <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', px: 1, py: 2 }}>
            {state.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : isEmpty ? (
              activeFilterCount > 0 ? (
                <EmptyState
                  icon={SearchOffIcon}
                  title="조건에 맞는 주문이 없습니다."
                  description="검색 조건이나 필터를 변경해보세요."
                  action={{
                    label: '필터 초기화',
                    startIcon: <RestartAltIcon />,
                    onClick: () => { dispatch({ type: 'CLEAR_FILTERS' }); setProductSearchTerm(''); setSelectedProductCategory(''); },
                  }}
                />
              ) : (
                <EmptyState
                  title="아직 접수된 주문이 없습니다."
                  description="새로운 주문이 들어오면 여기에 표시됩니다."
                />
              )
            ) : (
              <Stack spacing={2} sx={{ pb: 2 }}>
                {orderTree.map((node) =>
                  node.type === 'group' ? renderMobileGroup(node) : renderMobileSingle(node.order)
                )}
              </Stack>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ flexGrow: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {hasPermission('orders:edit') && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={state.selectedOrders.length > 0 && state.selectedOrders.length < selectableIds.length}
                        checked={selectableIds.length > 0 && state.selectedOrders.length === selectableIds.length}
                        onChange={handleSelectAllClick}
                        inputProps={{ 'aria-label': 'select all orders' }}
                      />
                    </TableCell>
                  )}
                  <TableCell>주문번호</TableCell>
                  <TableCell>고객명</TableCell>
                  <TableCell>학회명</TableCell>
                  <TableCell>총 금액</TableCell>
                  <TableCell>주문일시</TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.loading ? (
                  <TableSkeleton rows={ordersPerPage} columns={hasPermission('orders:edit') ? 8 : 7} />
                ) : isEmpty ? (
                  <TableRow>
                    <TableCell colSpan={hasPermission('orders:edit') ? 8 : 7}>
                      {activeFilterCount > 0 ? (
                        <EmptyState
                          icon={SearchOffIcon}
                          title="조건에 맞는 주문이 없습니다."
                          description="검색 조건이나 필터를 변경해보세요."
                          action={{
                            label: '필터 초기화',
                            startIcon: <RestartAltIcon />,
                            onClick: () => { dispatch({ type: 'CLEAR_FILTERS' }); setProductSearchTerm(''); setSelectedProductCategory(''); },
                          }}
                        />
                      ) : (
                        <EmptyState
                          title="아직 접수된 주문이 없습니다."
                          description="새로운 주문이 들어오면 여기에 표시됩니다."
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  orderTree.map((node) =>
                    node.type === 'group' ? renderGroupRows(node) : renderSingleRow(node.order)
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: `1px solid ${theme.gray[100]}` }}>
          <Pagination count={Math.ceil(state.totalOrders / ordersPerPage)} page={state.currentPage} onChange={(_, value) => dispatch({ type: 'SET_FILTER', payload: { key: 'currentPage', value } })} color="primary" />
        </Box>
      </SectionCard>

      {state.selectedOrder && !state.productsLoading && (
        state.selectedOrder.is_group_parent ? (
          <GroupOrderModal
            open={state.openOrderDetailModal}
            onClose={() => dispatch({ type: 'CLOSE_ORDER_DETAIL' })}
            shell={state.selectedOrder}
            statusToKorean={statusToKorean}
            productsMap={state.productsMap}
            products={state.products}
            events={state.events}
            addNotification={addNotification}
            onUpdate={fetchOrders}
            productsLoading={state.productsLoading}
            hasPermission={hasPermission}
          />
        ) : (
          <OrderDetailModal
            open={state.openOrderDetailModal}
            onClose={() => dispatch({ type: 'CLOSE_ORDER_DETAIL' })}
            order={state.selectedOrder}
            statusToKorean={statusToKorean}
            productsMap={state.productsMap}
            products={state.products}
            events={state.events}
            addNotification={addNotification}
            onUpdate={fetchOrders}
            productsLoading={state.productsLoading}
            hasPermission={hasPermission}
          />
        )
      )}

      <NewOrderModal
        open={state.openNewOrderModal}
        onClose={() => dispatch({ type: 'CLOSE_NEW_ORDER' })}
        onSuccess={() => { fetchOrders(); }}
        events={state.events}
        products={state.products}
        settings={state.settings}
      />

      {/* 합배송 대표 취소 위임 — 남은 활성 주문 2건+일 때 묶음 배송지 선택 */}
      <ShippingPickModal
        open={pick.open}
        onClose={() => setPick({ open: false, oldRep: null, candidates: [], newStatus: null, groupParentId: null })}
        groupParentId={pick.groupParentId}
        oldRep={pick.oldRep}
        candidates={pick.candidates}
        newStatus={pick.newStatus}
        settings={state.settings}
        addNotification={addNotification}
        onDone={() => { setPick({ open: false, oldRep: null, candidates: [], newStatus: null, groupParentId: null }); fetchOrders(); }}
      />
    </Box>
  );
};

export default OrderManagementPage;