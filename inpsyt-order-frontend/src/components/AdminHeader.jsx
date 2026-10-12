import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, IconButton, Popover, List, ListItem, ListItemText,
  ListItemButton, Divider, Avatar, Menu, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Button, Chip, CircularProgress,
  Badge, Switch, useTheme,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';

const ROUTE_LABELS = {
  '/admin/dashboard':   '대시보드',
  '/admin/orders':      '주문 관리',
  '/admin/events':      '학회 관리',
  '/admin/products':    '상품 관리',
  '/admin/fulfillment': '출고 관리',
  '/admin/users':       '사용자 관리',
  '/admin/feedback':    '피드백 관리',
  '/admin/bulletins':   '게시판',
  '/admin/audit-log':   '로그',
  '/admin/settings':    '설정',
};

const FEEDBACK_TYPES = [
  { value: 'bug',        label: '오류' },
  { value: 'ux',         label: 'UI/UX 불편' },
  { value: 'suggestion', label: '개선 제안' },
];

const AdminHeader = ({
  onMenuToggle,
  newOrders = [],
  unseenCount = 0,
  onSeenNewOrders,
  onOpenNewOrder,
  browserNotif = false,
  notifPermission = 'default',
  soundNotif = false,
  onToggleBrowserNotif,
  onToggleSoundNotif,
}) => {
  const theme = useTheme();
  const { user, logout, profile } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [userAnchorEl, setUserAnchorEl] = useState(null);

  // Password change
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback
  const [openFeedback, setOpenFeedback] = useState(false);
  const [feedbackLocation, setFeedbackLocation] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const handleNotificationClick = (event) => {
    setNotificationAnchorEl(event.currentTarget);
    onSeenNewOrders?.(); // 드롭다운 열면 놓친 신규 주문 카운트 리셋(=확인)
  };
  const handleNotificationClose = () => setNotificationAnchorEl(null);

  const handleNewOrderItemClick = () => {
    handleNotificationClose();
    onOpenNewOrder?.();
  };
  const handleUserMenuClick = (event) => setUserAnchorEl(event.currentTarget);
  const handleUserMenuClose = () => setUserAnchorEl(null);

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const handleOpenPasswordModal = () => {
    handleUserMenuClose();
    setNewPassword('');
    setConfirmPassword('');
    setOpenPasswordModal(true);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      addNotification('비밀번호(PIN)는 최소 6자리 이상이어야 합니다.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addNotification('비밀번호가 일치하지 않습니다.', 'warning');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      addNotification('비밀번호가 성공적으로 변경되었습니다.', 'success');
      setOpenPasswordModal(false);
    } catch (err) {
      addNotification(`비밀번호 변경 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenFeedback = () => {
    const autoLabel = ROUTE_LABELS[location.pathname] || '';
    setFeedbackLocation(autoLabel);
    setFeedbackType('');
    setFeedbackContent('');
    setOpenFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackType) {
      addNotification('유형을 선택해주세요.', 'warning');
      return;
    }
    if (!feedbackContent.trim()) {
      addNotification('내용을 입력해주세요.', 'warning');
      return;
    }
    setFeedbackSaving(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email,
        user_name: profile?.name || user.email,
        location: feedbackLocation || '(미지정)',
        type: feedbackType,
        content: feedbackContent.trim(),
      });
      if (error) throw error;
      addNotification('피드백이 전달됐습니다. 감사합니다!', 'success');
      setOpenFeedback(false);
    } catch (err) {
      addNotification(`전송 실패: ${err.message}`, 'error');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const openNotification = Boolean(notificationAnchorEl);
  const openUserMenu = Boolean(userAnchorEl);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 64,
        px: { xs: 2, md: 3 },
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.gray[100]}`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* 좌측: (모바일) 햄버거 + Booth 워드마크 상시 앵커 (BRAND_Booth.md §4) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0 } }}>
        <IconButton
          onClick={onMenuToggle}
          size="medium"
          sx={{ display: { md: 'none' }, color: theme.gray[600] }}
          aria-label="메뉴 열기"
        >
          <MenuIcon />
        </IconButton>
        <Typography
          component="div"
          onClick={() => navigate('/admin/dashboard')}
          role="button"
          aria-label="Booth 대시보드로 이동"
          sx={{
            fontSize: { xs: 20, md: 22 },
            fontWeight: 800,
            color: 'text.primary',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Booth
        </Typography>
      </Box>

      {/* 우측 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>

        {/* 피드백 아이콘 */}
        <IconButton
          onClick={handleOpenFeedback}
          disableRipple
          sx={{
            color: theme.gray[500],
            minWidth: 44,
            minHeight: 44,
            borderRadius: '8px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
          aria-label="피드백 보내기"
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* 알림 (종 + 놓친 신규 주문 뱃지) */}
        <IconButton
          onClick={handleNotificationClick}
          disableRipple
          sx={{
            color: theme.gray[500],
            minWidth: 44,
            minHeight: 44,
            borderRadius: '8px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
          aria-label={unseenCount > 0 ? `신규 주문 ${unseenCount}건` : '알림'}
        >
          <Badge badgeContent={unseenCount} color="error" max={99}>
            <NotificationsIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
        <Popover
          open={openNotification}
          anchorEl={notificationAnchorEl}
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1.5, borderRadius: `${theme.radii.lg}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.10)', border: `1px solid ${theme.gray[100]}` } }}
        >
          <Box sx={{ width: 340 }}>
            <ListItem sx={{ py: 1.25 }}>
              <ListItemText primary="신규 주문" primaryTypographyProps={{ variant: 'subtitle2' }} />
            </ListItem>
            <Divider />

            {/* 신규 주문 목록 (세션 내 휘발성) */}
            <List sx={{ maxHeight: 320, overflow: 'auto', py: 0 }}>
              {newOrders.length === 0 ? (
                <ListItem sx={{ py: 3, justifyContent: 'center' }}>
                  <ListItemText
                    secondary="새로 들어온 주문이 없습니다."
                    secondaryTypographyProps={{ variant: 'body2', textAlign: 'center' }}
                  />
                </ListItem>
              ) : (
                newOrders.map((o) => (
                  <ListItemButton key={`${o.id}-${o.at}`} onClick={handleNewOrderItemClick} sx={{ py: 1.25, px: 2 }}>
                    <ShoppingBagOutlinedIcon sx={{ fontSize: 18, color: theme.gray[500], mr: 1.25 }} />
                    <ListItemText
                      primary={`${o.customerName} · ${o.amount.toLocaleString()}원`}
                      secondary={format(o.at, 'M월 d일 HH:mm', { locale: ko })}
                      primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 500 } }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))
              )}
            </List>

            <Divider />

            {/* 알림 설정 토글 */}
            <Box sx={{ px: 2, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>브라우저 알림</Typography>
                    <Typography variant="caption" color="text.secondary">화면 밖에 있어도 알려줍니다</Typography>
                  </Box>
                  {notifPermission === 'denied' && (
                    <Chip label="차단됨" size="small" sx={{ bgcolor: theme.gray[100], color: theme.gray[600], fontWeight: 600 }} />
                  )}
                </Box>
                <Switch
                  size="small"
                  checked={browserNotif}
                  onChange={onToggleBrowserNotif}
                  disabled={notifPermission === 'unsupported'}
                />
              </Box>

              {/* 권한 차단 시 해제 안내 (토스트 대신 인라인 텍스트) */}
              {notifPermission === 'denied' && (
                <Box sx={{ mt: 0.5, mb: 0.5, px: 1.25, py: 1, bgcolor: theme.gray[50], borderRadius: `${theme.radii.sm}px` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
                    브라우저가 알림을 차단한 상태입니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 새로고침해 주세요. (Windows는 설정 → 알림에서 Chrome·집중 지원도 확인)
                  </Typography>
                </Box>
              )}
              {notifPermission === 'unsupported' && (
                <Box sx={{ mt: 0.5, mb: 0.5, px: 1.25, py: 1, bgcolor: theme.gray[50], borderRadius: `${theme.radii.sm}px` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
                    이 브라우저는 알림을 지원하지 않습니다. 앱 내 알림(종·토스트)은 계속 동작합니다.
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>소리</Typography>
                  <Typography variant="caption" color="text.secondary">신규 주문 시 알림음</Typography>
                </Box>
                <Switch size="small" checked={soundNotif} onChange={onToggleSoundNotif} />
              </Box>
            </Box>
          </Box>
        </Popover>

        {/* 사용자 아바타 */}
        <IconButton onClick={handleUserMenuClick} disableRipple sx={{ p: 0.5, minWidth: 44, minHeight: 44 }}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: theme.gray[900], color: '#fff', fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {(profile?.name || user?.email)?.[0]?.toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={userAnchorEl}
          open={openUserMenu}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1.5, borderRadius: `${theme.radii.lg}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.10)', border: `1px solid ${theme.gray[100]}`, minWidth: 200 } }}
        >
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {profile?.name || user?.email?.split('@')[0] || '사용자'}
            </Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleOpenPasswordModal} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem' }}>비밀번호 변경</MenuItem>
          <MenuItem onClick={handleLogout} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem', color: 'error.main' }}>로그아웃</MenuItem>
        </Menu>
      </Box>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog open={openPasswordModal} onClose={() => setOpenPasswordModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>비밀번호(PIN) 변경</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField autoFocus label="새 비밀번호 (최소 6자리 숫자/영문)" type="password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <TextField label="새 비밀번호 확인" type="password" fullWidth value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPasswordModal(false)}>취소</Button>
          <Button onClick={handlePasswordChange} variant="contained">변경하기</Button>
        </DialogActions>
      </Dialog>

      {/* 피드백 다이얼로그 */}
      <Dialog open={openFeedback} onClose={() => setOpenFeedback(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          기능 개선 제안하기
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
            불편하셨나요? 더 나은 서비스를 위해 알려주세요.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

          {/* 위치 */}
          <TextField
            label="위치"
            fullWidth
            size="small"
            value={feedbackLocation}
            onChange={(e) => setFeedbackLocation(e.target.value)}
            helperText="현재 페이지가 자동 입력됩니다. 직접 수정할 수 있어요."
          />

          {/* 유형 */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>유형 *</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {FEEDBACK_TYPES.map(t => (
                <Chip
                  key={t.value}
                  label={t.label}
                  onClick={() => setFeedbackType(t.value)}
                  variant={feedbackType === t.value ? 'filled' : 'outlined'}
                  color={feedbackType === t.value ? 'primary' : 'default'}
                  sx={{ fontWeight: feedbackType === t.value ? 700 : 400, cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* 내용 */}
          <TextField
            label="내용 *"
            fullWidth
            multiline
            rows={4}
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            placeholder="구체적으로 적어주실수록 빠르게 개선할 수 있어요."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenFeedback(false)} disabled={feedbackSaving}>취소</Button>
          <Button
            onClick={handleSubmitFeedback}
            variant="contained"
            disabled={feedbackSaving}
            startIcon={feedbackSaving ? <CircularProgress size={14} /> : null}
          >
            {feedbackSaving ? '전송 중...' : '보내기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminHeader;
