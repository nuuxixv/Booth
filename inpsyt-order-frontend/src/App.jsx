import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from './hooks/useAuth';
import { NotificationProvider } from './NotificationContext';
import GoRedirect from './components/GoRedirect';
import OrderPage from './components/OrderPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import theme from './theme'; // theme.js 파일 임포트
import {
  CssBaseline,
  CircularProgress,
  Box,
  ThemeProvider
} from '@mui/material';

// 초기 번들에는 공개 주문서(OrderPage)만 남긴다. 어드민 전체와 디자인 프리뷰
// 19개가 같은 청크에 있으면 부스에서 QR로 들어온 고객이 어드민 앱까지 통째로
// 내려받는다. (2026-07 저대역 로딩 지연 대응 — index 청크 2.5MB의 주 내용물)
const OrderStatusPage = lazy(() => import('./components/OrderStatusPage'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const LoginPage = lazy(() => import('./components/LoginPage'));

// DEV-ONLY 디자인 프리뷰 — 라우트는 그대로 두고 초기 번들에서만 뺀다.
const DashboardDesignPreview = lazy(() => import('./components/DashboardDesignPreview'));
const FulfillmentPreview = lazy(() => import('./components/FulfillmentPreview'));
const OrderManagementPreview = lazy(() => import('./components/OrderManagementPreview'));
const OrderManagementPreviewC1 = lazy(() => import('./components/OrderManagementPreviewC1'));
const OrderManagementPreviewC2 = lazy(() => import('./components/OrderManagementPreviewC2'));
const OrderManagementPreviewC3 = lazy(() => import('./components/OrderManagementPreviewC3'));
const OrderManagementPreviewC4 = lazy(() => import('./components/OrderManagementPreviewC4'));
const ProductManagementPreview = lazy(() => import('./components/ProductManagementPreview'));
const ProductFilterBarPreview = lazy(() => import('./components/ProductFilterBarPreview'));
const EventManagementPreview = lazy(() => import('./components/EventManagementPreview'));
const EventHubListPreview = lazy(() => import('./components/EventHubListPreview'));
const EventDetailPreview = lazy(() => import('./components/EventDetailPreview'));
const EventDetailFlowPreview = lazy(() => import('./components/EventDetailFlowPreview'));
const EventHubFoldPreview = lazy(() => import('./components/EventHubFoldPreview'));
const PinOrderCustomerPreview = lazy(() => import('./components/PinOrderCustomerPreview'));
const PinOrderAdminPreview = lazy(() => import('./components/PinOrderAdminPreview'));
const PaymentReceiptModalPreview = lazy(() => import('./components/PaymentReceiptModalPreview'));
const UserManagementPreview = lazy(() => import('./components/UserManagementPreview'));
const BulletinBoardPreview = lazy(() => import('./components/BulletinBoardPreview'));
const FeedbackManagementPreview = lazy(() => import('./components/FeedbackManagementPreview'));
const SettingsPreview = lazy(() => import('./components/SettingsPreview'));
const LoginPreview = lazy(() => import('./components/LoginPreview'));
const CustomerOrderPreview = lazy(() => import('./components/CustomerOrderPreview'));
const CustomerOrderStatusPreview = lazy(() => import('./components/CustomerOrderStatusPreview'));

// 인증 확인 중·지연 로드 대기 중 공통 화면.
const FullScreenSpinner = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

function AppRoutes() {
  const { user, loading, refreshing } = useAuth();

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <Router>
      <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/go" element={<GoRedirect />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/order/status/:token" element={<OrderStatusPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* DEV-ONLY: design preview without auth */}
        <Route path="/preview/dashboard" element={<DashboardDesignPreview />} />
        <Route path="/preview/fulfillment" element={<FulfillmentPreview />} />
        <Route path="/preview/products" element={<ProductManagementPreview />} />
        <Route path="/preview/product-filters" element={<ProductFilterBarPreview />} />
        <Route path="/preview/events" element={<EventManagementPreview />} />
        <Route path="/preview/event-hub" element={<EventHubListPreview />} />
        <Route path="/preview/event-detail" element={<EventDetailPreview />} />
        <Route path="/preview/event-detail-flow" element={<EventDetailFlowPreview />} />
        <Route path="/preview/event-hub-fold" element={<EventHubFoldPreview />} />
        <Route path="/preview/pin-order-customer" element={<PinOrderCustomerPreview />} />
        <Route path="/preview/pin-order-admin" element={<PinOrderAdminPreview />} />
        <Route path="/preview/payment-receipt" element={<PaymentReceiptModalPreview />} />
        <Route path="/preview/users" element={<UserManagementPreview />} />
        <Route path="/preview/bulletins" element={<BulletinBoardPreview />} />
        <Route path="/preview/feedback" element={<FeedbackManagementPreview />} />
        <Route path="/preview/settings" element={<SettingsPreview />} />
        <Route path="/preview/login" element={<LoginPreview />} />
        <Route path="/preview/orders" element={<OrderManagementPreview />} />
        <Route path="/preview/orders-c1" element={<OrderManagementPreviewC1 />} />
        <Route path="/preview/orders-c2" element={<OrderManagementPreviewC2 />} />
        <Route path="/preview/orders-c3" element={<OrderManagementPreviewC3 />} />
        <Route path="/preview/orders-c4" element={<OrderManagementPreviewC4 />} />
        <Route path="/preview/order" element={<CustomerOrderPreview />} />
        <Route path="/preview/order-status" element={<CustomerOrderStatusPreview />} />
        {/* Redirect /smartadmin to /admin */}
          <Route path="/smartadmin" element={<Navigate to="/admin" replace />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute user={user} refreshing={refreshing}>
                <AdminLayout />
              </ProtectedRoute>
            }
          />
      </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      {/* CssBaseline은 ErrorBoundary 바깥에 둔다. 폴백이 뜬 상태에서도 body
          배경이 유지돼야 화면이 어두워지지 않는다. */}
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
            <Analytics />
            <SpeedInsights />
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
