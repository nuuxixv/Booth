import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Checkbox,
  ListItemText,
  OutlinedInput,
  IconButton,
  Chip,
  alpha,
  useTheme,
  Button,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  MenuBook as BookIcon,
  Psychology as TestIcon,
  Build as ToolIcon,
  ShoppingCart as CartIcon,
  Receipt as ReceiptIcon,
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Assignment as ReportIcon,
  History as HistoryIcon,
  EmojiEvents as TrophyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { formatISO, startOfToday, format } from 'date-fns';
import OrderDetailModal from './OrderDetailModal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { STATUS_TO_KOREAN as statusToKorean, STATUS_COLORS as statusColors } from '../constants/orderStatus';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState } from './ui';
import { computeRevenueByCategory, PAID_STATUSES } from '../utils/revenueByCategory';
import { CATEGORY_COLORS } from '../constants/categoryColors';
import FieldReportSection from './FieldReportSection';
import { groupEventsForDropdown, formatEventStartDate } from '../utils/eventSort';
// 입금결의서 내보내기는 L2 학회 상세(EventDetailPage) 헤더로 일원화 (2026-06-10 건우님)

// 사양 시트: design-system/specs/A4_DashboardPage.md
// (M3-12 시안 정합본. PR #10~#20 패턴.)

// ─── Status Bar (사양 §Row 3 — 우측 카드. height 10 시안 정합) ───
const StatusBar = ({ statusCounts, totalOrders, onStatusClick }) => {
  const theme = useTheme();
  if (totalOrders === 0) return null;
  // preparing(준비중)은 표시용으로만 분포에 포함한다(맨 앞). 매출 집계에는 넣지 않는다(REVENUE_STATUSES 미포함).
  const orderedStatuses = ['preparing', 'pending', 'paid', 'completed', 'cancelled', 'refunded'];
  const segments = orderedStatuses
    .filter(s => (statusCounts[s] || 0) > 0)
    .map(s => ({ key: s, count: statusCounts[s], pct: (statusCounts[s] / totalOrders) * 100 }));

  return (
    <Box>
      {/* 시안 정합: height 10 + tooltip만. segment 내부 라벨은 외부 칩으로 이전 (정보 동일). */}
      <Box sx={{ display: 'flex', width: '100%', borderRadius: `${theme.radii.sm}px`, overflow: 'hidden', height: 10, bgcolor: theme.gray[100] }}>
        {segments.map(seg => (
          <Tooltip key={seg.key} title={`${statusToKorean[seg.key]} · ${seg.count}건 · ${seg.pct.toFixed(1)}%`} arrow>
            <Box
              onClick={() => onStatusClick?.(seg.key)}
              sx={{
                flex: seg.count, bgcolor: theme.status[seg.key] || statusColors[seg.key], minWidth: 6,
                cursor: onStatusClick ? 'pointer' : 'default',
                transition: `opacity 0.2s ${theme.easing.toss}`,
                '&:hover': onStatusClick ? { opacity: 0.85 } : {},
              }}
            />
          </Tooltip>
        ))}
      </Box>
      {/* 범례: 색점 + 라벨 + 건수 (시안 패턴 — bgcolor gray[50] + border) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
        {segments.map(seg => {
          const c = theme.status[seg.key] || statusColors[seg.key];
          return (
            <Box
              key={seg.key}
              onClick={() => onStatusClick?.(seg.key)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                cursor: onStatusClick ? 'pointer' : 'default',
                px: 1.25, py: 0.75,
                borderRadius: `${theme.radii.sm}px`,
                bgcolor: theme.gray[50],
                border: `1px solid ${theme.gray[200]}`,
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:hover': onStatusClick ? { bgcolor: alpha(c, 0.06), borderColor: alpha(c, 0.3) } : {},
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {statusToKorean[seg.key]}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {seg.count}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {onStatusClick && (
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1.5, display: 'block', textAlign: 'right' }}>
          상태 클릭 시 주문관리로 이동 →
        </Typography>
      )}
    </Box>
  );
};

// ─── Product Ranking List (사양 §Row 2 — 시안 정보량 채택 #8/#9) ───
// 1~3위 컬러 강조, sortBy에 따라 주/보조 자리 바뀜, ToggleButtonGroup
const RankingList = ({ items, color }) => {
  const theme = useTheme();
  const [sortBy, setSortBy] = useState('quantity');
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) =>
      sortBy === 'amount' ? (b.totalAmount || 0) - (a.totalAmount || 0) : (b.totalQuantity || 0) - (a.totalQuantity || 0)
    ),
    [items, sortBy]
  );
  const displayed = expanded ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
        판매 내역 없음
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          value={sortBy}
          exclusive
          onChange={(_, v) => v && setSortBy(v)}
          sx={{
            '& .MuiToggleButton-root': {
              ...theme.typography.caption,
              px: 1.25, py: 0.375, minHeight: 0,
              fontWeight: 700,
              border: `1px solid ${theme.gray[200]}`,
              color: 'text.secondary',
              borderRadius: `${theme.radii.sm}px !important`,
              '&.Mui-selected': { bgcolor: alpha(color, 0.1), color, borderColor: alpha(color, 0.3) },
              '&:first-of-type': { mr: 0.5 },
            },
          }}
        >
          <ToggleButton value="quantity">수량순</ToggleButton>
          <ToggleButton value="amount">금액순</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box>
        {displayed.map((item, i) => {
          const isTop3 = i < 3;
          return (
            <Box
              key={item.product_id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                py: 1.25,
                borderBottom: i === displayed.length - 1 ? 'none' : `1px solid ${theme.gray[100]}`,
              }}
            >
              <Box
                sx={{
                  width: 24, height: 24, flexShrink: 0,
                  borderRadius: `${theme.radii.sm}px`,
                  bgcolor: isTop3 ? alpha(color, 0.1) : theme.gray[50],
                  color: isTop3 ? color : theme.gray[500],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit', lineHeight: 1 }}>
                  {i + 1}
                </Typography>
              </Box>
              <Tooltip title={item.name} arrow placement="top">
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1, minWidth: 0,
                    fontWeight: isTop3 ? 700 : 500,
                    color: 'text.primary',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'default',
                  }}
                >
                  {item.name}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                {/* 주 라벨: 정렬 기준에 맞춰 강조 */}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: isTop3 ? color : 'text.primary',
                    letterSpacing: '-0.02em',
                    fontFeatureSettings: '"tnum" 1',
                  }}
                >
                  {sortBy === 'amount'
                    ? `${(item.totalAmount || 0).toLocaleString()}원`
                    : `${item.totalQuantity}부`}
                </Typography>
                {/* 보조 라벨: 반대 자릿값 */}
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {sortBy === 'amount'
                    ? `${item.totalQuantity}부`
                    : `${(item.totalAmount || 0).toLocaleString()}원`}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {hasMore && (
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${theme.gray[100]}`, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            onClick={() => setExpanded(e => !e)}
            endIcon={expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{
              ...theme.typography.caption,
              fontWeight: 700,
              color: 'text.secondary',
              minHeight: 0,
              '&:hover': { bgcolor: alpha(color, 0.06), color },
            }}
          >
            {expanded ? '접기' : `전체 보기 (${sorted.length})`}
          </Button>
        </Box>
      )}
    </Box>
  );
};


// ═══════════════════════════════════════
// ─── MAIN DASHBOARD ───
// ═══════════════════════════════════════
const DashboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [availableSocieties, setAvailableSocieties] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [products, setProducts] = useState([]);

  // Hierarchy Filters State (사양 §계층 필터 — 3단 캐스케이드 보존)
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSociety, setSelectedSociety] = useState('all');
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { hasPermission } = useAuth();
  const { addNotification } = useNotification();

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ─── Data Initialization (사양 §진입 흐름) ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const fetchAllProducts = async () => {
          let all = []; let from = 0; const ps = 1000;
          while (true) {
            const { data, error } = await supabase.from('products').select('*').range(from, from + ps - 1);
            if (error) throw error;
            all = all.concat(data);
            if (data.length < ps) break;
            from += ps;
          }
          return all;
        };

        const [eventsRes, societiesRes, allProds] = await Promise.all([
          supabase.from('events').select('id, name, start_date, end_date, tags, event_year, host_society, event_season').order('start_date', { ascending: false }),
          supabase.from('societies').select('id, name').order('name', { ascending: true }),
          fetchAllProducts(),
        ]);
        if (eventsRes.error) throw eventsRes.error;
        setEvents(eventsRes.data || []);
        if (!societiesRes.error && societiesRes.data) {
          setAvailableSocieties(societiesRes.data);
        }

        setProducts(allProds);
        setProductsMap(allProds.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    init();
  }, []);

  // ─── Derived Filters ───
  const years = useMemo(() => {
    const ySet = new Set(events.map(e => {
      if (e.event_year) return e.event_year.toString();
      return e.start_date ? new Date(e.start_date).getFullYear().toString() : null;
    }).filter(Boolean));
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [events]);

  const societies = useMemo(() => availableSocieties.map(s => s.name), [availableSocieties]);

  const filteredEventsForDropdown = useMemo(() => {
    return events.filter(e => {
      const eYear = e.event_year ? e.event_year.toString() : (e.start_date ? new Date(e.start_date).getFullYear().toString() : null);
      const matchYear = selectedYear === 'all' || eYear === selectedYear;
      const eSocietyMatches = e.host_society ? e.host_society === selectedSociety : (e.tags && e.tags.includes(selectedSociety));
      const matchSociety = selectedSociety === 'all' || eSocietyMatches;
      return matchYear && matchSociety;
    });
  }, [events, selectedYear, selectedSociety]);

  // 사양 §캐스케이드 리셋
  useEffect(() => { setSelectedEventIds([]); setSelectedDate(null); }, [selectedYear, selectedSociety]);
  useEffect(() => { setSelectedDate(null); }, [selectedEventIds]);

  // 사양 §일자 칩 — 행사 시작/종료 사이 일별 칩 생성
  // 일자 칩 = 단일 상세 행사에서 '실제 주문(매출)이 발생한 지난 날짜'만 (KST distinct).
  // 행사 기간(start~end) 전체를 채우면 안 됨 — 검수/테스트 행사는 1년 내내라 365일 폭주. 주문 있는 날만.
  // 넓은 범위(전체 합산/여러 행사) → [] → 일자 드릴다운 없이 전체 기간만.
  const [salesDates, setSalesDates] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (selectedEventIds.length !== 1) { setSalesDates([]); return; }
      const { data, error } = await supabase
        .from('orders')
        .select('created_at')
        .eq('event_id', selectedEventIds[0]);
      if (cancelled) return;
      if (error || !data) { setSalesDates([]); return; }
      const set = new Set(
        data.map(o => {
          // KST(UTC+9) 기준 날짜로 환산
          const d = new Date(new Date(o.created_at).getTime() + 9 * 3600 * 1000);
          return d.toISOString().slice(0, 10);
        })
      );
      setSalesDates([...set].sort());
    })();
    return () => { cancelled = true; };
  }, [selectedEventIds]);
  const availableDates = salesDates;

  // ─── Aggregate Data Fetching (사양 §집계 로직 — 보존 100%) ───
  const fetchDataForEventIds = async (eventIds, targetEventName = '전체(합계)') => {
    if (!eventIds || eventIds.length === 0) {
      setDashboardData({
        eventName: targetEventName, totalRevenue: 0, bookRevenue: 0, testRevenue: 0,
        totalOrders: 0, statusCounts: {}, bookTop5: [], testTop5: [], recentOrders: [], todayOrdersCount: 0, yoyPct: null,
      });
      return;
    }

    const dateFrom = selectedDate ? new Date(selectedDate + 'T00:00:00+09:00').toISOString() : null;
    const dateTo = selectedDate ? new Date(selectedDate + 'T23:59:59.999+09:00').toISOString() : null;

    // 매출 집계는 껍데기 부모(is_group_parent) 제외 — 실 매출은 자식 order_items 기반(설계 §7).
    let ordersQ = supabase.from('orders').select('id, final_payment, delivery_fee, status, created_at, is_group_parent, order_items(product_id, quantity, price_at_purchase, product_name, product_code, category, list_price)').eq('is_group_parent', false).in('event_id', eventIds);
    let recentQ = supabase.from('orders').select('*, events(name), order_items(*, products(*))').in('event_id', eventIds).order('created_at', { ascending: false }).limit(5);
    if (dateFrom) {
      ordersQ = ordersQ.gte('created_at', dateFrom).lte('created_at', dateTo);
      recentQ = recentQ.gte('created_at', dateFrom).lte('created_at', dateTo);
    }
    const [ordersRes, recentRes] = await Promise.all([ordersQ, recentQ]);
    if (ordersRes.error) throw ordersRes.error;

    // YoY 계산 — 사양 §확인 필요: selectedYear !== 'all' && selectedEventIds.length === 0 조건 보존
    let yoyPct = null;
    if (selectedYear !== 'all' && selectedEventIds.length === 0) {
      const prevYearStr = (parseInt(selectedYear) - 1).toString();
      const prevYearEvents = events.filter(e => {
        const eYear = e.event_year ? e.event_year.toString() : (e.start_date ? new Date(e.start_date).getFullYear().toString() : null);
        const matchYear = eYear === prevYearStr;
        const eSocietyMatches = e.host_society ? e.host_society === selectedSociety : (e.tags && e.tags.includes(selectedSociety));
        const matchSociety = selectedSociety === 'all' || eSocietyMatches;
        return matchYear && matchSociety;
      }).map(e => e.id);

      if (prevYearEvents.length > 0) {
        const { data: prevOrders } = await supabase.from('orders').select('final_payment, is_group_parent').eq('is_group_parent', false).in('event_id', prevYearEvents);
        if (prevOrders) {
          const prevTotal = prevOrders.reduce((sum, o) => sum + (o.final_payment || 0), 0);
          const currentTotal = ordersRes.data.reduce((sum, o) => sum + (o.final_payment || 0), 0);
          if (prevTotal > 0) {
            yoyPct = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
          }
        }
      }
    }

    const orders = ordersRes.data || [];
    const statusCounts = {};
    const productSales = {};

    const todayStart = formatISO(startOfToday());
    let todayOrdersCount = 0;

    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      if (order.created_at >= todayStart) todayOrdersCount++;

      // 랭킹도 매출과 동일 기준 — 결제완료(paid/completed)만 집계.
      // (이전엔 cancelled/refunded만 제외해 pending도 포함 → 매출 버킷과 불일치였음.
      //  매출이 computeRevenueByCategory(PAID_STATUSES)로 통일되며 랭킹도 정합.)
      if (!PAID_STATUSES.includes(order.status)) return;

      (order.order_items || []).forEach(item => {
        const prod = productsMap[item.product_id];
        const itemName = item.product_name || prod?.name;
        const itemCategory = item.category || prod?.category;
        if (!itemName && !prod) return;
        const qty = item.quantity || 0;
        const price = item.price_at_purchase || 0;

        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            product_id: item.product_id, name: itemName, category: itemCategory,
            totalQuantity: 0, totalAmount: 0,
          };
        }
        productSales[item.product_id].totalQuantity += qty;
        productSales[item.product_id].totalAmount += price * qty;
      });
    });

    // 매출 버킷 — 공용 유틸로 통일. 검사/도서/도구 3버킷(도구 독립, 2026-06-24 건우님).
    // 배송비를 검사>도구>도서 우선순위로 한 버킷에 귀속. util은 PAID_STATUSES만 합산.
    const {
      test: testRevenue, book: bookRevenue, tool: toolRevenue,
      total: totalRevenue, testShipping, bookShipping, toolShipping,
    } = computeRevenueByCategory(orders, { productsMap });

    const salesList = Object.values(productSales);
    const isBook = (c) => (c || '').includes('도서') || (c || '').toLowerCase().includes('book');
    const isTool = (c) => (c || '').includes('도구') || (c || '').toLowerCase().includes('tool');
    const isTest = (c) => (c || '').includes('검사') || (c || '').toLowerCase().includes('test');
    const bookTop5 = salesList
      .filter(p => isBook(p.category))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
    // 도구는 검사보다 먼저 판정(검사도구 라벨이 검사 그룹에 끼지 않도록 — 매출 버킷과 정합).
    const toolTop5 = salesList
      .filter(p => isTool(p.category))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
    const testTop5 = salesList
      .filter(p => !isTool(p.category) && !isBook(p.category) && isTest(p.category))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    setDashboardData({
      eventName: targetEventName, totalRevenue, bookRevenue, testRevenue, toolRevenue,
      testShipping, bookShipping, toolShipping, yoyPct,
      totalOrders: orders.length, statusCounts, bookTop5, testTop5, toolTop5, todayOrdersCount,
      recentOrders: recentRes.data || [],
    });
  };

  const fetchData = async () => {
    if (Object.keys(productsMap).length === 0) return;
    setLoading(true);
    try {
      if (selectedEventIds.length === 0) {
        const eventIds = filteredEventsForDropdown.map(e => e.id);
        const nameLabel = selectedSociety !== 'all'
          ? `${selectedYear !== 'all' ? selectedYear + '년 ' : ''}${selectedSociety} 누적 합계`
          : `${selectedYear !== 'all' ? selectedYear + '년 ' : '전체 기간 '}누적 합계`;
        await fetchDataForEventIds(eventIds, nameLabel);
      } else {
        const names = selectedEventIds.map(id => events.find(e => e.id === id)?.name).filter(Boolean);
        const label = names.length === 1 ? names[0] : `${names.length}개 행사 합계`;
        await fetchDataForEventIds(selectedEventIds, label);
      }
    } catch (e) {
      console.error(e);
      setDashboardData(null);
    }
    setLoading(false); setRefreshing(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [selectedEventIds, selectedYear, selectedSociety, productsMap, selectedDate]);

  // ─── Handlers ───
  const handleRefresh = () => { setRefreshing(true); fetchData(); };
  const handleRowClick = (order) => { setSelectedOrder(order); setIsModalOpen(true); };

  // ─── Render ───
  if (events.length === 0 && loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  const pendingCount = dashboardData?.statusCounts?.pending || 0;
  const paidCount = dashboardData?.statusCounts?.paid || 0;
  const hasAlerts = pendingCount > 0 || paidCount > 0;

  return (
    <Box sx={{ pb: 6 }}>
      {/* 사양 §페이지 헤더 — 시안 정합 #1/#2: subtitle에 eventName, action에 outlined "새로고침" 버튼 */}
      <PageHeader
        title="대시보드"
        subtitle={dashboardData?.eventName || ''}
        icon={DashboardIcon}
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            startIcon={
              <RefreshIcon
                sx={{
                  fontSize: 16,
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            }
          >
            새로고침
          </Button>
        }
      />

      {/* 사양 §계층 필터 카드 — SectionCard padding 20, 3단 Select + ChevronRight 디바이더 보존, 일자 칩 라벨 톤 시안 정합 #14 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.25, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' } }}>
          <FormControl fullWidth size="small">
            <InputLabel>연도 보기</InputLabel>
            <Select value={selectedYear} label="연도 보기" onChange={e => setSelectedYear(e.target.value)}>
              <MenuItem value="all"><em>전체 연도</em></MenuItem>
              {years.map(y => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
            </Select>
          </FormControl>
          <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
          <FormControl fullWidth size="small">
            <InputLabel>학회</InputLabel>
            <Select value={selectedSociety} label="학회" onChange={e => setSelectedSociety(e.target.value)}>
              <MenuItem value="all"><em>모든 학회</em></MenuItem>
              {societies.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
          <FormControl fullWidth size="small">
            <InputLabel>상세 행사</InputLabel>
            <Select
              multiple
              value={selectedEventIds}
              label="상세 행사"
              input={<OutlinedInput label="상세 행사" />}
              onChange={e => setSelectedEventIds(e.target.value)}
              renderValue={(selected) =>
                selected.length === 0
                  ? (filteredEventsForDropdown.length > 0 ? '전체 합산' : '관련 행사 없음')
                  : selected.length === 1
                    ? filteredEventsForDropdown.find(ev => ev.id === selected[0])?.name || ''
                    : `${selected.length}개 선택`
              }
            >
              {filteredEventsForDropdown.length === 0 ? (
                <MenuItem disabled><em>관련 행사 없음</em></MenuItem>
              ) : (
                (() => {
                  const { pinned, rest } = groupEventsForDropdown(filteredEventsForDropdown);
                  const renderItem = (ev) => (
                    <MenuItem key={ev.id} value={ev.id}>
                      <Checkbox checked={selectedEventIds.includes(ev.id)} size="small" />
                      <ListItemText
                        primary={ev.name}
                        secondary={formatEventStartDate(ev.start_date) || '시작일 미정'}
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
                })()
              )}
            </Select>
          </FormControl>
        </Box>
        {availableDates.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>일자</Typography>
            <Chip
              label="전체 기간"
              size="small"
              variant={selectedDate === null ? 'filled' : 'outlined'}
              color={selectedDate === null ? 'primary' : 'default'}
              onClick={() => setSelectedDate(null)}
              sx={{ fontWeight: selectedDate === null ? 700 : 500 }}
            />
            {availableDates.map((date, idx) => (
              <Chip
                key={date}
                // 시안 정합 #14: 라벨 톤 "N일차 · MM-DD"
                label={`${idx + 1}일차 · ${date.slice(5)}`}
                size="small"
                variant={selectedDate === date ? 'filled' : 'outlined'}
                color={selectedDate === date ? 'primary' : 'default'}
                onClick={() => setSelectedDate(prev => prev === date ? null : date)}
                sx={{ fontWeight: selectedDate === date ? 700 : 500 }}
              />
            ))}
          </Box>
        )}
      </SectionCard>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : dashboardData && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* ─── Row 1: 매출 카드 (시안 #3/#4 정합 — hero 총매출+YoY trend + 오늘 접수 박스 + sub 3장) ─── */}
          <SectionCard>
            <Box>
              <Box
                sx={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 2,
                  mb: 3, pb: 3,
                  borderBottom: `1px solid ${theme.gray[100]}`,
                }}
              >
                <StatCard
                  variant="hero"
                  label="총 매출액"
                  value={(dashboardData.totalRevenue || 0).toLocaleString()}
                  unit="원"
                  icon={ReceiptIcon}
                  color={theme.accent.revenue}
                  trend={dashboardData.yoyPct}
                />
                {/* 오늘 접수 박스 — 사양 §오늘 접수 내역. 부제 (누적 N건 중) 정보 보존. */}
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1,
                    borderRadius: `${theme.radii.md}px`,
                    bgcolor: theme.gray[50],
                  }}
                >
                  <Box
                    sx={{
                      width: 36, height: 36,
                      borderRadius: `${theme.radii.sm}px`,
                      bgcolor: alpha(theme.accent.attention, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <CartIcon sx={{ fontSize: 18, color: theme.accent.attention }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase',
                      }}
                    >
                      오늘 접수
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography
                        variant="h3"
                        sx={{
                          color: 'text.primary',
                          letterSpacing: '-0.03em',
                          fontFeatureSettings: '"tnum" 1',
                        }}
                      >
                        {dashboardData.todayOrdersCount || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>건</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                      누적 {dashboardData.totalOrders || 0}건 중 오늘
                    </Typography>
                  </Box>
                </Box>
              </Box>
              {/* 매출 합산 — 검사/도서/도구 3버킷(도구 독립, 2026-06-24 건우님).
                  0원 버킷은 숨겨 1~3열로 동적 분할(flex:1 균등). */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                {[
                  { key: 'test', label: '검사 판매', revenue: dashboardData.testRevenue || 0, shipping: dashboardData.testShipping || 0, icon: TestIcon, color: theme.accent.tests },
                  { key: 'book', label: '도서 판매', revenue: dashboardData.bookRevenue || 0, shipping: dashboardData.bookShipping || 0, icon: BookIcon, color: theme.accent.books },
                  { key: 'tool', label: '도구 판매', revenue: dashboardData.toolRevenue || 0, shipping: dashboardData.toolShipping || 0, icon: ToolIcon, color: CATEGORY_COLORS.tool },
                ]
                  .filter(b => b.revenue > 0)
                  .map(b => (
                    <Box key={b.key} sx={{ flex: 1, minWidth: 0 }}>
                      <StatCard
                        label={`${b.label} (배송비 ${b.shipping.toLocaleString()}원 포함)`}
                        value={b.revenue.toLocaleString()}
                        unit="원"
                        icon={b.icon}
                        color={b.color}
                      />
                    </Box>
                  ))}
              </Box>
            </Box>
          </SectionCard>

          {/* ─── Row 2: 주문 처리 현황 + 처리 필요 알림 (시안 #5/#6/#7) ─── */}
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionCard
                title="주문 처리 현황"
                subtitle={`누적 ${dashboardData.totalOrders || 0}건`}
              >
                <StatusBar
                  statusCounts={dashboardData.statusCounts || {}}
                  totalOrders={dashboardData.totalOrders || 0}
                  onStatusClick={(status) => navigate(`/admin/orders?status=${status}`)}
                />
              </SectionCard>
            </Box>
            <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
              {/* 사양 §처리 필요 알림 — 실 페이지 조건 보존(hasAlerts=true일 때만), 라벨 보존 #7 */}
              {hasAlerts ? (
                <SectionCard
                  interactive
                  onClick={() => navigate('/admin/orders')}
                  sx={{
                    borderColor: alpha(theme.accent.attention, 0.3),
                    bgcolor: alpha(theme.accent.attention, 0.04),
                    height: '100%',
                    '&:hover': {
                      borderColor: alpha(theme.accent.attention, 0.5),
                      bgcolor: alpha(theme.accent.attention, 0.08),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 32, height: 32,
                        borderRadius: `${theme.radii.sm}px`,
                        bgcolor: alpha(theme.accent.attention, 0.15),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <WarningIcon sx={{ fontSize: 18, color: theme.accent.attention }} />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: theme.accent.attention, letterSpacing: '-0.01em' }}
                    >
                      처리 필요 알림
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {pendingCount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>결제대기</Typography>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}
                        >
                          {pendingCount}건
                        </Typography>
                      </Box>
                    )}
                    {paidCount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* 실 페이지 라벨 보존 — "결제완료(출고대기)"는 운영자가 결제완료 상태와 매치 인식 중 */}
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>결제완료(출고대기)</Typography>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}
                        >
                          {paidCount}건
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </SectionCard>
              ) : (
                // 알림 없음 = 공백 대신 한적한 빈 상태(건우님 2026-06-01)
                <SectionCard sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    title="처리하실 주문이 없어요"
                    description="들어온 주문을 모두 처리했어요"
                  />
                </SectionCard>
              )}
            </Box>
          </Box>

          {/* ─── Row 3: 판매 순위 — 판매 있는 대분류만 동적 분할(검사/도서/도구) ─── */}
          {(() => {
            const rankingBuckets = [
              { key: 'test', title: '검사 판매 순위', items: dashboardData.testTop5 || [], color: theme.accent.tests },
              { key: 'book', title: '도서 판매 순위', items: dashboardData.bookTop5 || [], color: theme.accent.books },
              { key: 'tool', title: '도구 판매 순위', items: dashboardData.toolTop5 || [], color: CATEGORY_COLORS.tool },
            ];
            const shown = rankingBuckets.filter(b => b.items.length > 0);
            // 전부 0건이면 검사·도서 두 빈 카드를 기본 노출(회귀 방지 — 빈 행 방지).
            const visible = shown.length > 0 ? shown : rankingBuckets.slice(0, 2);
            return (
              <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                {visible.map(b => (
                  <Box key={b.key} sx={{ flex: 1, minWidth: 0 }}>
                    <SectionCard title={b.title} icon={TrophyIcon}>
                      <RankingList items={b.items} color={b.color} />
                    </SectionCard>
                  </Box>
                ))}
              </Box>
            );
          })()}

          {/* ─── Row 4: 현장 보고서 + 최근 주문 (시안 #10/#11) ─── */}
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionCard title="현장 보고서" icon={ReportIcon}>
                {/* 사양 §현장 보고서 — CRUD 전체 보존, 행사 미선택 시 시안 안내문 */}
                <FieldReportSection
                  eventId={selectedEventIds.length === 1 ? selectedEventIds[0] : null}
                  eventName={dashboardData.eventName}
                  revenueData={dashboardData}
                />
              </SectionCard>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionCard title="최근 주문" icon={HistoryIcon}>
                {(dashboardData.recentOrders || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    주문 내역이 없습니다
                  </Typography>
                ) : (
                  <Box>
                    {dashboardData.recentOrders.map((order, idx, arr) => (
                      <Box
                        key={order.id}
                        onClick={() => handleRowClick(order)}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          py: 1.5, px: 1.25, mx: -1.25,
                          borderRadius: `${theme.radii.md}px`,
                          cursor: 'pointer',
                          borderBottom: idx === arr.length - 1 ? 'none' : `1px solid ${theme.gray[100]}`,
                          '&:hover': { bgcolor: theme.gray[50] },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                          {/* 시안 #11: 이니셜 박스. 단순 시각 식별, 장식 없음. */}
                          <Box
                            sx={{
                              width: 36, height: 36, flexShrink: 0,
                              borderRadius: `${theme.radii.sm}px`,
                              bgcolor: theme.gray[100],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'text.secondary',
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'inherit', lineHeight: 1 }}>
                              {(order.customer_name || '?').slice(0, 1)}
                            </Typography>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                            >
                              {order.customer_name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                              <StatusBadge value={order.status} size="sm" />
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                {format(new Date(order.created_at), 'MM/dd HH:mm')}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 800,
                            letterSpacing: '-0.025em',
                            fontFeatureSettings: '"tnum" 1',
                            flexShrink: 0,
                            ml: 1,
                          }}
                        >
                          {(order.final_payment || 0).toLocaleString()}원
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </SectionCard>
            </Box>
          </Box>

        </Box>
      )}

      {/* ─── Order Detail Modal — 사양 §모달 연동 보존 ─── */}
      {selectedOrder && (
        <OrderDetailModal
          open={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedOrder(null); }}
          order={selectedOrder}
          events={events}
          hasPermission={hasPermission}
          statusToKorean={statusToKorean}
          products={products}
          productsMap={productsMap}
          addNotification={addNotification}
          onUpdate={fetchData}
          productsLoading={loading}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default DashboardPage;
