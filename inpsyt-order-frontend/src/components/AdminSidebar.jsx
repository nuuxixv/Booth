
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Tooltip,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SettingsIcon from '@mui/icons-material/Settings';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import HistoryIcon from '@mui/icons-material/History';
import { useAuth } from '../hooks/useAuth';
import { getUnreadCount } from '../api/bulletins';

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard', permissionKey: 'dashboard:view' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders', permissionKey: 'orders:view' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events', permissionKey: 'events:view' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products', permissionKey: 'products:view' },
  { text: '출고 관리', icon: <LocalShippingIcon />, path: '/admin/fulfillment', permissionKey: 'orders:view' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/admin/users', permissionKey: 'users:manage' },
  { text: '피드백', icon: <RateReviewIcon />, path: '/admin/feedback', permissionKey: 'master' },
  { text: '게시판', icon: <AnnouncementIcon />, path: '/admin/bulletins', permissionKey: null },
  { text: '로그', icon: <HistoryIcon />, path: '/admin/audit-log', permissionKey: 'master' },
  { text: '설정', icon: <SettingsIcon />, path: '/admin/settings', permissionKey: 'master' },
];

const AdminSidebar = ({ open, onClose, collapsed = false, onToggleCollapse }) => {
  const { user, hasPermission, permissions } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [bulletinUnreadCount, setBulletinUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    getUnreadCount(user.id)
      .then(count => setBulletinUnreadCount(count))
      .catch(() => {});
  }, [user?.id]);

  const filteredMenuItems = allMenuItems.filter(item => {
    if (permissions.includes('master')) return true;
    if (item.permissionKey) return hasPermission(item.permissionKey);
    return true;
  });

  const navLinkStyles = {
    textDecoration: 'none',
    color: 'inherit',
    width: '100%',
  };

  const currentWidth = isDesktop && collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 사이드바 로고·서비스명 없음 — 서비스 표기는 헤더 좌상단 "Booth" 1곳(BRAND_Booth.md §3, 2026-10-12) */}

      {/* Menu items */}
      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1 }}>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ my: 0.5, minHeight: 52 }}>
            <NavLink to={item.path} style={navLinkStyles} onClick={!isDesktop ? onClose : undefined}>
              {({ isActive }) => (
                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                  <ListItemButton
                    disableRipple
                    sx={(t) => ({
                      // hit-area 52px 강제 (specificity issue 대비 height 명시)
                      minHeight: 52,
                      height: 52,
                      borderRadius: '8px',
                      mb: 0.5,
                      py: 0,
                      px: collapsed ? 1.25 : 1.5,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      backgroundColor: isActive ? t.gray[100] : 'transparent',
                      color: isActive ? t.gray[900] : t.gray[600],
                      '&:hover': {
                        backgroundColor: isActive ? t.gray[100] : t.gray[50],
                      },
                      transition: 'background-color 0.15s ease',
                    })}
                  >
                    <ListItemIcon sx={{
                      minWidth: collapsed ? 0 : 32,
                      color: isActive ? theme.gray[900] : theme.gray[500],
                      '& svg': { fontSize: 20 },
                      justifyContent: 'center',
                    }}>
                      {item.path === '/admin/bulletins' && bulletinUnreadCount > 0 ? (
                        <Badge badgeContent={bulletinUnreadCount} color="error" max={99}>
                          {item.icon}
                        </Badge>
                      ) : item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          variant: 'body1',
                          fontWeight: isActive ? 600 : 500,
                          whiteSpace: 'nowrap',
                          letterSpacing: '-0.01em',
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>

      {/* Collapse toggle button (desktop only) */}
      {isDesktop && onToggleCollapse && (
        <Box sx={{ p: 1.25, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton
            onClick={onToggleCollapse}
            disableRipple
            sx={{
              bgcolor: 'transparent',
              color: theme.gray[500],
              width: 44,
              height: 44,
              borderRadius: '8px',
              '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
            }}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop ? true : open}
      onClose={onClose}
      sx={{
        width: isDesktop ? currentWidth : 0,
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
        '& .MuiDrawer-paper': {
          width: isDesktop ? currentWidth : DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRight: `1px solid ${theme.gray[100]}`,
          boxShadow: 'none',
          transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
          overflowX: 'hidden',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default AdminSidebar;
