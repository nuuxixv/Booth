
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material'; // Container 제거
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import DashboardPage from './DashboardPage';
import OrderManagementPage from './OrderManagementPage';
import EventManagementPage from './EventManagementPage';
import EventDetailPage from './EventDetailPage';
import EventCreatePage from './EventCreatePage';
import ProductManagementPage from './ProductManagementPage';
import UserManagementPage from './UserManagementPage'; // UserManagementPage 임포트
import FulfillmentPage from './FulfillmentPage';
import SettingsPage from './SettingsPage'; // SettingsPage 임포트
import FeedbackManagementPage from './FeedbackManagementPage';
import BulletinBoardPage from './BulletinBoardPage';
import AuditLogPage from './AuditLogPage';
import NotificationsDisplay from './NotificationsDisplay';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../supabaseClient';

// 브라우저 탭 title — 어드민 라우트 전용 페이지명 (BRAND_Booth.md §3).
// pathname 2번째 세그먼트(/admin/{seg}) 기준. 매칭 없으면 "Booth" 단독.
const ADMIN_PAGE_TITLES = {
  dashboard:   '대시보드',
  orders:      '주문 관리',
  events:      '학회 관리',
  products:    '상품 관리',
  fulfillment: '출고 관리',
  users:       '사용자 관리',
  feedback:    '피드백 관리',
  bulletins:   '게시판',
  'audit-log': '로그',
  settings:    '설정',
};

// /admin/events/:slug? — slug 있으면 L2 학회 상세, 없으면 L1 학회 목록
const EventsRoute = () => {
  const { slug } = useParams();
  return slug ? <EventDetailPage /> : <EventManagementPage />;
};

// 신규 주문 알림 설정 — localStorage 키 (탭 열린 동안만 동작, DB 영속 X)
const PREF_BROWSER_KEY = 'notif:newOrder:browser';
const PREF_SOUND_KEY = 'notif:newOrder:sound';

// 역할별 디폴트: 출고(fulfillment_*)는 학회 후 작업이라 신규주문 불필요 → 기본 OFF.
// 그 외(master·onsite 등)는 기본 ON. 저장값이 있으면 저장값 우선.
const resolvePref = (storageKey, role) => {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) return saved === 'true';
  return !(role && role.startsWith('fulfillment'));
};

// 현재 브라우저 알림 권한 상태. 미지원이면 'unsupported'.
const readPermission = () =>
  'Notification' in window ? Notification.permission : 'unsupported';

// 짧은 알림음 1회 — WebAudio 내장 beep (음원 파일·라이브러리 0).
const playBeep = (ctxRef) => {
  try {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch { /* 자동재생 차단 등 — 무시(인앱 토스트가 fallback) */ }
};

const AdminLayout = () => {
  const { hasPermission, permissions, profile } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const role = profile?.role;
  // 헤더 종: 놓친 신규 주문(세션 내 휘발성). 드롭다운 열면 0으로 리셋(=확인).
  const [newOrders, setNewOrders] = useState([]); // [{ id, customerName, amount, at }]
  const [unseenCount, setUnseenCount] = useState(0);
  // 토글 ON/OFF (역할 디폴트 + localStorage 저장값)
  const [browserNotif, setBrowserNotif] = useState(() => resolvePref(PREF_BROWSER_KEY, role));
  const [soundNotif, setSoundNotif] = useState(() => resolvePref(PREF_SOUND_KEY, role));
  // 브라우저 알림 권한 상태 (granted/denied/default/unsupported) — UI 표시·동기화용
  const [notifPermission, setNotifPermission] = useState(() => readPermission());

  // 토글 저장값이 켜져 있어도 권한이 granted가 아니면 OFF로 보이게(미스매치 방지).
  const browserNotifOn = browserNotif && notifPermission === 'granted';

  const audioCtxRef = useRef(null);
  // 콜백이 항상 최신 토글값을 읽도록 ref로 보관 (구독은 1회만 생성)
  const browserRef = useRef(browserNotif);
  const soundRef = useRef(soundNotif);
  browserRef.current = browserNotif;
  soundRef.current = soundNotif;

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // profile은 비동기 로드 → role이 늦게 도착할 수 있음. 저장값이 없을 때만
  // role 디폴트를 1회 재적용(출고 역할이 mount 시점 undefined로 ON 되는 것 방지).
  useEffect(() => {
    if (!role) return;
    if (localStorage.getItem(PREF_BROWSER_KEY) === null) setBrowserNotif(resolvePref(PREF_BROWSER_KEY, role));
    if (localStorage.getItem(PREF_SOUND_KEY) === null) setSoundNotif(resolvePref(PREF_SOUND_KEY, role));
  }, [role]);

  // 마운트 시 권한 재확인(다른 탭·OS 설정에서 바뀌었을 수 있음).
  useEffect(() => { setNotifPermission(readPermission()); }, []);

  // 브라우저 탭 title — 어드민 라우트에서만 Booth 노출 (BRAND_Booth.md §3).
  // 언마운트(고객 라우트 이동 등) 시 중립 문구 복원 → 고객 접점 누수 방지.
  useEffect(() => {
    const seg = location.pathname.split('/')[2];
    const label = ADMIN_PAGE_TITLES[seg];
    document.title = label ? `Booth — ${label}` : 'Booth';
    return () => { document.title = '인싸이트 주문서'; };
  }, [location.pathname]);

  // 브라우저 알림 토글 — ON 클릭 시점(사용자 제스처)에 권한 요청.
  const handleToggleBrowserNotif = useCallback(async () => {
    // 표시 기준(browserNotifOn)으로 동작 — 저장값이 켜져 있어도 권한이 없으면
    // 화면엔 OFF로 보이므로, 클릭은 "켜기" 시도로 처리.
    if (!browserNotifOn) {
      if (!('Notification' in window)) {
        setNotifPermission('unsupported');
        return; // 안내는 드롭다운 'unsupported' 분기에서 텍스트로 노출
      }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== 'granted') {
        // denied: 드롭다운 안 해제 안내가 노출됨(토스트 대신). default→denied도 동일.
        return;
      }
      setBrowserNotif(true);
      localStorage.setItem(PREF_BROWSER_KEY, 'true');
      // 켜진 즉시 테스트 알림 1회 — 실제 주문 없이 작동 확인.
      try {
        new Notification('알림이 켜졌어요', {
          body: '새 주문이 오면 이렇게 알려드릴게요',
          icon: '/LOGO.svg',
          tag: 'inpsyt-notif-test',
        });
      } catch { /* 알림 생성 실패 — 무시 */ }
    } else {
      setBrowserNotif(false);
      localStorage.setItem(PREF_BROWSER_KEY, 'false');
    }
  }, [browserNotifOn]);

  // 소리 토글 — ON 시 첫 상호작용에서 AudioContext 활성(자동재생 정책 대응).
  const handleToggleSoundNotif = useCallback(() => {
    setSoundNotif(prev => {
      const next = !prev;
      localStorage.setItem(PREF_SOUND_KEY, String(next));
      if (next) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
            audioCtxRef.current.resume();
          }
        } catch { /* noop */ }
        playBeep(audioCtxRef); // 켤 때 짧은 beep 1회로 작동 확인
      }
      return next;
    });
  }, []);

  // 종 드롭다운 열림 → 확인 처리(카운트 0) + 권한 재확인. 목록은 유지.
  const handleSeenNewOrders = useCallback(() => {
    setUnseenCount(0);
    setNotifPermission(readPermission());
  }, []);

  // 신규 주문 항목 클릭 → 주문관리 이동 + 확인 처리.
  const handleOpenNewOrder = useCallback(() => {
    setUnseenCount(0);
    navigate('/admin/orders');
  }, [navigate]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (import.meta.env.DEV) console.log('New order received:', payload);
          const row = payload.new || {};
          const customerName = row.customer_name || '고객';
          const amount = Number(row.final_payment) || 0;
          const entry = { id: row.id, customerName, amount, at: Date.now() };

          // ⓑ 인앱: 헤더 종 누적(놓쳐도 뱃지에 쌓임) + 토스트(즉시 인지) — 항상 동작
          setNewOrders(prev => [entry, ...prev].slice(0, 20));
          setUnseenCount(prev => prev + 1);
          addNotification('새로운 주문이 도착했습니다!', 'success');

          // ⓐ 브라우저 알림 (권한 허용 + 토글 ON)
          if (browserRef.current && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const n = new Notification('새 주문', {
                body: `${customerName} · ${amount.toLocaleString()}원`,
                icon: '/LOGO.svg',
                tag: 'inpsyt-new-order',
              });
              n.onclick = () => {
                window.focus();
                navigate('/admin/orders');
                n.close();
              };
            } catch { /* 알림 생성 실패 — 인앱 fallback로 충분 */ }
          }

          // ③ 소리 (토글 ON)
          if (soundRef.current) playBeep(audioCtxRef);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, navigate]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AdminSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
        }}
      >
        <AdminHeader
          onMenuToggle={() => setMobileOpen(prev => !prev)}
          newOrders={newOrders}
          unseenCount={unseenCount}
          onSeenNewOrders={handleSeenNewOrders}
          onOpenNewOrder={handleOpenNewOrder}
          browserNotif={browserNotifOn}
          notifPermission={notifPermission}
          soundNotif={soundNotif}
          onToggleBrowserNotif={handleToggleBrowserNotif}
          onToggleSoundNotif={handleToggleSoundNotif}
        />
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Box sx={{ width: '100%', maxWidth: 1280, px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard" element={hasPermission('dashboard:view') ? <DashboardPage /> : <Navigate to="/admin" replace />} />
            <Route path="/orders" element={hasPermission('orders:view') ? <OrderManagementPage /> : <Navigate to="/admin" replace />} />

            {/* 학회 생성 전용 페이지 — :slug? 보다 먼저 매칭(new가 slug로 해석되지 않게) */}
            <Route
              path="/events/new"
              element={hasPermission('events:edit') ? <EventCreatePage /> : <Navigate to="/admin" replace />}
            />

            {/* 학회 관리 (권한 필요) — slug 있으면 L2 상세, 없으면 L1 목록 */}
            <Route
              path="/events/:slug?"
              element={hasPermission('events:view') ? <EventsRoute /> : <Navigate to="/admin" replace />}
            />

            {/* 상품 관리 (권한 필요) */}
            <Route
              path="/products"
              element={hasPermission('products:view') ? <ProductManagementPage /> : <Navigate to="/admin" replace />}
            />

            {/* 출고 관리 */}
            <Route
              path="/fulfillment"
              element={hasPermission('orders:view') ? <FulfillmentPage /> : <Navigate to="/admin" replace />}
            />

            {/* 사용자 관리 (권한 필요) */}
            <Route
              path="/users"
              element={hasPermission('users:manage') ? <UserManagementPage /> : <Navigate to="/admin" replace />}
            />

            {/* 피드백 관리 (Master 권한 필요) */}
            <Route
              path="/feedback"
              element={permissions.includes('master') ? <FeedbackManagementPage /> : <Navigate to="/admin" replace />}
            />

            {/* 게시판 (모든 인증 사용자 접근 가능) */}
            <Route path="/bulletins" element={<BulletinBoardPage />} />

            {/* 감사 로그 (Master 권한 필요, 읽기 전용) */}
            <Route
              path="/audit-log"
              element={permissions.includes('master') ? <AuditLogPage /> : <Navigate to="/admin" replace />}
            />

            {/* 설정 (Master 권한 필요) */}
            <Route
              path="/settings"
              element={permissions.includes('master') ? <SettingsPage /> : <Navigate to="/admin" replace />}
            />
          </Routes>
          </Box>
        </Box>
        <NotificationsDisplay />
      </Box>
    </Box>
  );
};

export default AdminLayout;
