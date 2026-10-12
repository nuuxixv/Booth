import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Select,
  MenuItem,
  Divider,
  FormControl,
  InputLabel,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getFulfillmentOrders, groupLinkedOrders } from '../api/orders';
import { getEvents } from '../api/events';
import { sortEventsForDropdown, groupEventsForDropdown, formatEventStartDate } from '../utils/eventSort';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { summarizeGroupStatus } from '../utils/groupOrder';
import { fulfillmentCounts } from '../utils/fulfillmentCounts';
import { formatPhone, normalizePhone } from '../utils/formatPhone';
import { orderHasOnlineCode } from '../utils/onlineCode';
import { PageHeader, SectionCard, StatusBadge, InfoRow, ActionSlot, EmptyState } from './ui';
import { CATEGORY_COLORS, CATEGORY_KEY_BY_LABEL } from '../constants/categoryColors';

const CANCELLED = ['cancelled', 'refunded'];

// 출고 안전망 — 온라인코드 상품인데 인싸이트 ID가 공란인 주문. 이게 비어 있으면 코드를 못 넣어준다.
// orderHasOnlineCode: orders.has_online_code 컬럼 우선, 없으면 order_items 스냅샷(product_name)으로 폴백.
const isMissingInpsytId = (order) =>
  orderHasOnlineCode(order) && !(order.inpsyt_id || '').trim();

// 합배송 껍데기는 종합 상태(활성 자식 파생), 그 외는 자기 상태
const effectiveStatus = (order) =>
  order.is_group_parent ? summarizeGroupStatus(order.linkedChildren || []).value : order.status;

// 상태 변경 대상 id — 껍데기면 활성 자식 전부, 아니면 자기
const shipTargetIds = (order) =>
  order.is_group_parent
    ? (order.linkedChildren || []).filter((c) => !CANCELLED.includes(c.status)).map((c) => c.id)
    : [order.id];

// '도구' 카테고리를 '검사'로 정규화 (운영 모델: 도구는 검사와 함께 출고)
const normalizeCategory = (cat) => {
  if (!cat) return cat;
  if (cat === '도구') return '검사';
  return cat;
};

// 한글 라벨 → 영문 키. '도구'는 normalize 단계에서 '검사'로 흡수되므로 test로 매핑.
const categoryKey = (rawCategory) => {
  const norm = normalizeCategory(rawCategory);
  if (norm === '도서') return 'book';
  if (norm === '검사') return 'test';
  return CATEGORY_KEY_BY_LABEL[norm] || 'tool';
};

// 주문 유형 판별
const classifyOrder = (orderItems) => {
  const cats = new Set((orderItems || []).map(i => normalizeCategory(i.category || i.products?.category)));
  if (cats.has('도서') && cats.has('검사')) return 'mixed';
  if (cats.has('도서')) return 'book';
  if (cats.has('검사')) return 'test';
  return 'other';
};

// 뷰 모드별 주문 표시 여부
const isOrderVisible = (orderType, viewMode) => {
  if (viewMode === 'all') return true;
  if (viewMode === 'book') return orderType === 'book' || orderType === 'mixed';
  if (viewMode === 'test') return orderType === 'test' || orderType === 'mixed';
  return true;
};

// ─── 그룹 카드 (시안 FulfillmentGroupCard 정합) ──────────────────────────────
const FulfillmentGroupCard = ({
  order,
  eventName,
  viewMode,
  selected,
  onSelectToggle,
  onCopy,
  onShip,
  onUnship,
  canShip,
}) => {
  const theme = useTheme();

  const displayItems = order.mergedItems || order.order_items || [];
  const itemCount = displayItems.length;
  const isLinked = order.linkedChildren && order.linkedChildren.length > 0;
  const linkedCount = isLinked ? order.linkedChildren.length : 0;
  const effStatus = effectiveStatus(order);
  const isCompleted = effStatus === 'completed';
  const mergedTotal = order.mergedTotal ?? order.final_payment ?? 0;

  const address = order.shipping_address;
  const roadAddress = address
    ? address.address || address.roadAddress || address.jibunAddress || ''
    : '';
  const detailAddress = address
    ? address.detailAddress || address.detail || ''
    : '';
  const postcode = address?.postcode || '';

  const requestNote = order.customer_request?.trim();
  const adminMemo = order.admin_memo?.trim();
  const hasActions = canShip && (effStatus === 'paid' || isCompleted);
  const needsInpsytId = isMissingInpsytId(order);

  // 현장수령 판정 (OR 규칙): 주문 자체가 현장수령이거나 모든 상품이 현장수령이면 주문 전체 현장수령
  const isWholeOnSite =
    order.is_on_site_sale === true ||
    (displayItems.length > 0 && displayItems.every(i => i.on_site_pickup === true));

  return (
    <SectionCard
      padding={0}
      sx={{
        mb: 2,
        position: 'relative',
        opacity: isCompleted ? 0.7 : 1,
      }}
    >
      {/* 그룹 헤더 */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${theme.gray[100]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {canShip && (
          <Box
            onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              ml: -1,
              cursor: 'pointer',
            }}
          >
            <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* 고객명 인라인 복사 — 값+아이콘 단일 클릭 타깃 (체크박스와 오터치 간격 유지) */}
            <Box
              onClick={() => onCopy('이름', order.customer_name)}
              role="button"
              aria-label="이름 복사"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 0.75,
                py: 0.25,
                mr: -0.75,
                borderRadius: `${theme.radii.sm}px`,
                cursor: 'copy',
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  '& .FulfillmentCard-copyIcon': { color: theme.palette.primary.main },
                },
              }}
            >
              <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
                {order.customer_name}
              </Typography>
              <ContentCopyIcon
                className="FulfillmentCard-copyIcon"
                sx={{
                  fontSize: 16,
                  flexShrink: 0,
                  color: theme.gray[400],
                  transition: `color 0.15s ${theme.easing.toss}`,
                }}
              />
            </Box>
            <StatusBadge value={effStatus} size="sm" />
            {isLinked && (
              <Chip
                label={`연계 ${linkedCount}건`}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.dark,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                }}
              />
            )}
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.primary',
                fontFeatureSettings: '"tnum" 1',
                ml: 'auto',
              }}
            >
              {mergedTotal.toLocaleString()}원
            </Typography>
          </Box>
          {eventName && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                letterSpacing: '-0.005em',
              }}
            >
              {eventName} · {itemCount}개 상품
            </Typography>
          )}
        </Box>
      </Box>

      {/* 출고 안전망 — 온라인코드 상품인데 인싸이트 ID 공란. 코드를 못 넣어주므로 눈에 띄게 경고. */}
      {needsInpsytId && (
        <Box sx={{ px: 3, py: 1, borderBottom: `1px solid ${theme.gray[100]}`, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
          <Chip
            label="ID 미입력"
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.15),
              color: theme.palette.warning.dark,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
              fontWeight: 700,
            }}
          />
          <Typography variant="caption" sx={{ color: theme.palette.warning.dark, fontWeight: 600 }}>
            온라인코드 상품 · 인싸이트 ID가 없어요 — 고객에게 확인 필요
          </Typography>
        </Box>
      )}

      {/* 데이터 라인 — 사양 line 36-50 정합 */}
      {/* 주소 도로명·상세·우편번호 3줄 분리 표시 (사양 핵심 발견 #1) */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${theme.gray[100]}` }}>
        <InfoRow
          label="연락처"
          value={formatPhone(order.phone_number) || '-'}
          onCopy={order.phone_number ? () => onCopy('연락처', formatPhone(order.phone_number)) : undefined}
          muted={!order.phone_number}
          mono
        />
        {order.inpsyt_id && (
          <InfoRow
            label="ID"
            value={order.inpsyt_id}
            onCopy={() => onCopy('인싸이트 ID', order.inpsyt_id)}
            mono
          />
        )}
        <InfoRow
          label="도로명"
          value={
            roadAddress ? (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                {postcode && (
                  <Box
                    component="span"
                    sx={(t) => ({
                      ...t.typography.caption,
                      color: t.palette.text.secondary,
                      fontFeatureSettings: '"tnum" 1',
                    })}
                  >
                    [{postcode}]
                  </Box>
                )}
                <Box component="span">{roadAddress}</Box>
              </Box>
            ) : '-'
          }
          onCopy={roadAddress ? () => onCopy('도로명주소', roadAddress) : undefined}
          muted={!roadAddress}
          multiline
        />
        <InfoRow
          label="상세"
          value={detailAddress || '-'}
          onCopy={detailAddress ? () => onCopy('상세주소', detailAddress) : undefined}
          muted={!detailAddress}
          multiline
        />
        <InfoRow
          label="요청"
          value={requestNote || '-'}
          onCopy={requestNote ? () => onCopy('요청사항', requestNote) : undefined}
          muted={!requestNote}
          multiline
        />
        <InfoRow
          label="메모"
          value={adminMemo || '-'}
          onCopy={adminMemo ? () => onCopy('관리자 메모', adminMemo) : undefined}
          muted={!adminMemo}
          multiline
        />
      </Box>

      {/* 현장수령 주문 전체 안내 — 택배 출고 불필요 (status는 completed로 처리, 라벨만 치환) */}
      {isWholeOnSite && (
        <Box sx={{ px: 3, py: 1, borderBottom: `1px solid ${theme.gray[100]}`, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <StatusBadge kind="category" value="onsite" label="현장수령" size="sm" sx={{ borderColor: alpha(theme.palette.warning.main, 0.35), color: theme.palette.warning.dark }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            현장 수령 주문건 · 택배 출고 불필요
          </Typography>
        </Box>
      )}

      {/* 액션 행 (출고 처리 / 출고 취소) — 버튼 없으면 미렌더 */}
      {hasActions && (
        <ActionSlot
          sx={{
            px: 3,
            py: 1.25,
            bgcolor: theme.gray[50],
            borderBottom: `1px solid ${theme.gray[100]}`,
          }}
        >
          {effStatus === 'paid' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              onClick={() => onShip(order)}
            >
              {isWholeOnSite ? '확인 완료' : '출고 처리'}
            </Button>
          )}
          {isCompleted && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onUnship(order)}
            >
              {isWholeOnSite ? '확인완료 취소' : '출고 취소'}
            </Button>
          )}
        </ActionSlot>
      )}

      {/* 상품 목록 — 사양 핵심 발견 #2: 분류 칩 필수 */}
      <Box>
        {displayItems.map((item, idx) => {
          const rawCategory = item.category || item.products?.category;
          const catKey = categoryKey(rawCategory);
          const catColor = CATEGORY_COLORS[catKey] || theme.gray[500];
          const productName = item.product_name || item.products?.name || '-';
          // 뷰 모드별 그레이드 (사양 line 61) + 상품별 현장수령 (출고 제외)
          const normalized = normalizeCategory(rawCategory);
          const isOnSitePickup = isWholeOnSite || item.on_site_pickup === true;
          const isGreyed =
            isOnSitePickup ? true :
            viewMode === 'book' ? normalized === '검사' :
            viewMode === 'test' ? normalized === '도서' :
            false;
          const subtotal = (item.price_at_purchase || 0) * (item.quantity || 0);
          const isLast = idx === displayItems.length - 1;

          return (
            <Box
              key={`${order.id}-${item.product_id || idx}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 2.5fr) 64px minmax(80px, 1fr) 48px minmax(80px, 1fr)',
                alignItems: 'center',
                gap: 2,
                px: 3,
                py: 1.5,
                minHeight: 56,
                borderBottom: isLast ? 'none' : `1px solid ${theme.gray[50]}`,
                opacity: isGreyed ? 0.35 : 1,
                bgcolor: isGreyed ? theme.gray[50] : 'inherit',
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:hover': isGreyed ? {} : { bgcolor: theme.gray[50] },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {productName}
                </Typography>
                {isOnSitePickup && (
                  <StatusBadge
                    kind="category"
                    value="onsite"
                    label="현장수령"
                    size="sm"
                    sx={{ flexShrink: 0, borderColor: alpha(theme.palette.warning.main, 0.35), color: theme.palette.warning.dark }}
                  />
                )}
              </Box>
              <Box>
                {rawCategory && (
                  <StatusBadge
                    kind="category"
                    value={catKey}
                    label={rawCategory}
                    size="sm"
                    sx={{ borderColor: alpha(catColor, 0.35), color: catColor }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'right',
                  color: 'text.secondary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {(item.price_at_purchase || 0).toLocaleString()}원
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'right',
                  color: 'text.secondary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                ×{item.quantity || 0}
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  textAlign: 'right',
                  color: 'text.primary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {subtotal.toLocaleString()}원
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* 합계 영역 (배송비 + 합계) — 사양 line 62 */}
      {order.delivery_fee > 0 && (
        <Box
          sx={{
            px: 3,
            py: 1.25,
            borderTop: `1px solid ${theme.gray[100]}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            배송비 {order.delivery_fee.toLocaleString()}원 포함
          </Typography>
        </Box>
      )}
    </SectionCard>
  );
};

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
const FulfillmentPage = () => {
  const { hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('all');
  const [filterEvent, setFilterEvent] = useState('');
  const [statusFilter, setStatusFilter] = useState('paid');
  const [onlyMissingId, setOnlyMissingId] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const canShip = hasPermission('orders:edit');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIds([]);
    try {
      const data = await getFulfillmentOrders({
        eventId: filterEvent || undefined,
        statuses: ['paid', 'completed'],
      });
      const grouped = groupLinkedOrders(data || []);
      setOrders(grouped);
    } catch (err) {
      setError(err.message || '주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterEvent]);

  const handleCopy = useCallback(async (label, value) => {
    if (!value || value === '-') return;
    try {
      await navigator.clipboard.writeText(value);
      addNotification(`${label}을(를) 복사했습니다.`, 'info');
    } catch {
      addNotification('복사에 실패했습니다.', 'error');
    }
  }, [addNotification]);

  // 출고 처리 — 껍데기 그룹이면 모든 활성 자식을 함께 completed 로 (대표 1건만 바뀌던 결함 수정)
  const handleShip = useCallback(async (order) => {
    const name = order?.customer_name || `#${order?.id}`;
    const ids = shipTargetIds(order);
    if (ids.length === 0) return;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .in('id', ids);
      if (updateError) throw updateError;
      addNotification(`${name}님의 주문이 출고 처리되었습니다.`, 'success');
      loadOrders();
    } catch (err) {
      addNotification(`출고 처리 실패: ${err.message}`, 'error');
    }
  }, [addNotification, loadOrders]);

  const handleUnship = useCallback(async (order) => {
    const name = order?.customer_name || `#${order?.id}`;
    const ids = order.is_group_parent
      ? (order.linkedChildren || []).filter(c => c.status === 'completed').map(c => c.id)
      : [order.id];
    if (ids.length === 0) return;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .in('id', ids);
      if (updateError) throw updateError;
      addNotification(`${name}님의 주문을 출고 대기로 되돌렸습니다.`, 'success');
      loadOrders();
    } catch (err) {
      addNotification(`출고 취소 실패: ${err.message}`, 'error');
    }
  }, [addNotification, loadOrders]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    getEvents().then((data) => setEvents(sortEventsForDropdown(data))).catch(() => {});
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 행사(서버) + 뷰모드 적용 후, 상태·검색 적용 전 — 상태 세그먼트 카운트의 기준
  const baseOrders = useMemo(() => orders.filter(order => {
    if (order.parent_order_id) return false;
    const orderType = classifyOrder(order.mergedItems || order.order_items);
    return isOrderVisible(orderType, viewMode);
  }), [orders, viewMode]);

  // 집계는 공용 규칙(utils/fulfillmentCounts)으로 — 학회 상세 출고 현황과 동일 규칙.
  // viewMode·자식 제외는 baseOrders에서 이미 적용(합배송 껍데기=1건, 상태=effectiveStatus).
  const { total: totalCount, completed: completedCount, pending: pendingCount } =
    useMemo(() => fulfillmentCounts(baseOrders), [baseOrders]);
  // 온라인코드 ID 누락 건수 — 출고 대기(paid)만 집계. 완료건은 이미 처리됐으니 조치 대상 아님.
  const missingIdCount = useMemo(
    () => baseOrders.filter(o => effectiveStatus(o) === 'paid' && isMissingInpsytId(o)).length,
    [baseOrders],
  );

  const searchQuery = searchTerm.trim().toLowerCase();
  const filteredOrders = useMemo(() => baseOrders.filter(order => {
    if (statusFilter !== 'all' && effectiveStatus(order) !== statusFilter) return false;
    if (onlyMissingId && !isMissingInpsytId(order)) return false;
    if (searchQuery) {
      const phoneDigits = normalizePhone(searchQuery);
      return (
        (order.customer_name || '').toLowerCase().includes(searchQuery) ||
        (order.inpsyt_id || '').toLowerCase().includes(searchQuery) ||
        (phoneDigits.length >= 2 && normalizePhone(order.phone_number).includes(phoneDigits))
      );
    }
    return true;
  }), [baseOrders, statusFilter, onlyMissingId, searchQuery]);

  // 선택된 카드 중 출고 대기(paid) 상태인 건만 일괄 대상. 껍데기는 활성 자식으로 확장.
  const eligibleSelected = useMemo(
    () => filteredOrders.filter(o => selectedIds.includes(o.id) && effectiveStatus(o) === 'paid'),
    [filteredOrders, selectedIds]
  );
  const eligibleSelectedIds = eligibleSelected.map(o => o.id);
  const bulkTargetIds = useMemo(
    () => [...new Set(eligibleSelected.flatMap(shipTargetIds))],
    [eligibleSelected]
  );

  const handleBulkShip = useCallback(async () => {
    if (bulkTargetIds.length === 0) return;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .in('id', bulkTargetIds);
      if (updateError) throw updateError;
      addNotification(`${eligibleSelected.length}개 주문이 일괄 출고 처리되었습니다.`, 'success');
      loadOrders();
    } catch (err) {
      addNotification(`일괄 출고 처리 실패: ${err.message}`, 'error');
    } finally {
      setBulkConfirmOpen(false);
    }
  }, [bulkTargetIds, eligibleSelected, addNotification, loadOrders]);

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {canShip && (
        <Button
          size="small"
          variant="contained"
          startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
          disabled={eligibleSelectedIds.length === 0}
          onClick={() => setBulkConfirmOpen(true)}
        >
          출고 완료 처리
          {eligibleSelectedIds.length > 0 && ` (${eligibleSelectedIds.length})`}
        </Button>
      )}
    </Box>
  );

  const isSearching = searchQuery.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="출고 관리"
        subtitle={loading ? '' : `총 ${totalCount}건 · 대기 ${pendingCount}건 · 완료 ${completedCount}건`}
        icon={LocalShippingIcon}
        action={headerAction}
      />

      {/* 필터 영역 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
            필터
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '0 1 240px' }}>
            <InputLabel>행사</InputLabel>
            <Select
              value={filterEvent}
              label="행사"
              onChange={e => setFilterEvent(e.target.value)}
            >
              <MenuItem value="">전체 행사</MenuItem>
              {(() => {
                const { pinned, rest } = groupEventsForDropdown(events);
                const renderItem = (ev) => (
                  <MenuItem key={ev.id} value={ev.id}>
                    {ev.name}
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                      {formatEventStartDate(ev.start_date) || '시작일 미정'}
                    </Typography>
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

          <TextField
            size="small"
            placeholder="이름·연락처·ID 검색"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ flex: '1 1 200px', minWidth: 180 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              상태
            </Typography>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, val) => {
                if (val) {
                  setStatusFilter(val);
                  setSelectedIds([]);
                }
              }}
              size="small"
            >
              <ToggleButton value="paid" sx={{ px: 2 }}>
                출고 대기 ({pendingCount})
              </ToggleButton>
              <ToggleButton value="completed" sx={{ px: 2 }}>
                출고 완료 ({completedCount})
              </ToggleButton>
              <ToggleButton value="all" sx={{ px: 2 }}>전체</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              뷰 모드
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, val) => {
                if (val) {
                  setViewMode(val);
                  setSelectedIds([]);
                }
              }}
              size="small"
            >
              <ToggleButton value="all" sx={{ px: 2 }}>전체</ToggleButton>
              <ToggleButton
                value="book"
                sx={{
                  px: 2,
                  color: CATEGORY_COLORS.book,
                  '&.Mui-selected': { color: CATEGORY_COLORS.book },
                }}
              >
                도서 뷰
              </ToggleButton>
              <ToggleButton
                value="test"
                sx={{
                  px: 2,
                  color: CATEGORY_COLORS.test,
                  '&.Mui-selected': { color: CATEGORY_COLORS.test },
                }}
              >
                검사 뷰
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* 출고 안전망 필터 — 온라인코드 상품인데 ID 공란인 출고 대기건만 추림 */}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                color="warning"
                checked={onlyMissingId}
                onChange={(e) => { setOnlyMissingId(e.target.checked); setSelectedIds([]); }}
              />
            }
            label={
              <Typography
                variant="caption"
                sx={{ color: missingIdCount > 0 ? 'warning.dark' : 'text.secondary', fontWeight: missingIdCount > 0 ? 700 : 400 }}
              >
                온라인코드 ID 누락 ({missingIdCount})
              </Typography>
            }
          />
        </Box>
      </SectionCard>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 그룹 카드 리스트 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredOrders.length === 0 ? (
        <SectionCard padding={0}>
          {onlyMissingId ? (
            <EmptyState
              icon={CheckCircleIcon}
              title="ID 누락 주문이 없습니다"
              description="온라인코드 상품에 인싸이트 ID가 모두 입력됐어요"
            />
          ) : isSearching ? (
            <EmptyState
              icon={SearchOffIcon}
              title="검색 결과가 없습니다"
              description="이름·연락처·ID를 다시 확인해 보세요"
            />
          ) : statusFilter === 'paid' ? (
            <EmptyState
              icon={CheckCircleIcon}
              title="출고 대기 주문이 없습니다"
              description="모두 처리됐어요"
            />
          ) : (
            <EmptyState
              icon={LocalShippingIcon}
              title="해당 조건의 주문이 없습니다"
              description="행사 필터 또는 뷰 모드를 변경해 보세요"
            />
          )}
        </SectionCard>
      ) : (
        <Box>
          {filteredOrders.map(order => (
            <FulfillmentGroupCard
              key={order.id}
              order={order}
              eventName={order.events?.name}
              viewMode={viewMode}
              selected={selectedIds.includes(order.id)}
              onSelectToggle={() => toggleSelect(order.id)}
              onCopy={handleCopy}
              onShip={handleShip}
              onUnship={handleUnship}
              canShip={canShip}
            />
          ))}
        </Box>
      )}

      {/* 일괄 출고 확인 다이얼로그 */}
      <Dialog open={bulkConfirmOpen} onClose={() => setBulkConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>일괄 출고 처리</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{eligibleSelectedIds.length}건</strong>을 출고 완료 처리할까요?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkConfirmOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleBulkShip}>처리</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FulfillmentPage;
