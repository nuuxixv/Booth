import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Modal,
  Backdrop,
  Fade,
  Drawer,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { supabase } from '../supabaseClient';
import { SectionCard, ActionSlot } from './ui';
import OrderSections from './OrderSections';
import LinkPreviewDialog from './LinkPreviewDialog';

// 사양 시트: design-system/specs/A2_OrderDetailModal.md
// 비연계 단일 주문 상세·편집 모달. 섹션 본문은 OrderSections 공유 컴포넌트로 위임.
// (합배송 그룹은 GroupOrderModal이 담당 — 목록 클릭은 그룹이면 GroupOrderModal로 분기)

const OrderDetailModal = ({ order, open, onClose, statusToKorean, productsMap, products, events, addNotification, onUpdate, productsLoading, hasPermission, onLocalPromote }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', order.id);
      if (itemsError) throw itemsError;
      const { error: orderError } = await supabase.from('orders').delete().eq('id', order.id);
      if (orderError) throw orderError;
      addNotification('주문이 삭제되었습니다.', 'success');
      setDeleteConfirmOpen(false);
      onUpdate();
      onClose();
    } catch (err) {
      addNotification(`삭제 실패: ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!order) return null;

  const canEdit = hasPermission('orders:edit');
  const isMaster = hasPermission('master');
  // 이미 그룹의 일부(자식)면 연계 연결 불가
  const canLink = canEdit && !order.parent_order_id && !order.is_group_parent;

  const WrapperComponent = isMobile ? Drawer : Modal;
  const wrapperProps = isMobile
    ? { anchor: 'bottom', open, onClose, PaperProps: { sx: { borderRadius: `${theme.radii.lg}px ${theme.radii.lg}px 0 0`, maxHeight: '95vh' } } }
    : { open, onClose, closeAfterTransition: true, BackdropComponent: Backdrop, BackdropProps: { timeout: 500 } };

  const modalStyle = isMobile
    ? { p: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }
    : {
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: 800, bgcolor: 'background.paper', boxShadow: theme.customShadows.lg,
        p: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        borderRadius: `${theme.radii.lg}px`, overflow: 'hidden',
      };

  const content = (
    <Box sx={modalStyle}>
      {/* Header */}
      <Box
        sx={{
          p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: theme.gray[50], borderBottom: `1px solid ${theme.gray[200]}`,
        }}
      >
        <Typography variant="h5">상품주문정보 조회</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {(order.access_token || isMaster) && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: theme.gray[500] }} aria-label="더보기">
              <MoreVertIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
          <IconButton aria-label="close" onClick={onClose} sx={{ color: theme.gray[500] }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minHeight: 0, p: isMobile ? 2 : 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, '& > *': { flexShrink: 0 } }}>
        <OrderSections
          order={order}
          statusToKorean={statusToKorean}
          productsMap={productsMap}
          products={products}
          events={events}
          addNotification={addNotification}
          onUpdate={onUpdate}
          productsLoading={productsLoading}
          hasPermission={hasPermission}
          onLocalPromote={onLocalPromote}
        />

        {/* 연계 주문 연결 — 비연계 단일 주문만 (미리보기 다이얼로그로 합배송 생성) */}
        {canLink && (
          <SectionCard
            title="합배송 연계"
            padding={20}
            action={(
              <Button size="small" variant="outlined" startIcon={<LinkIcon sx={{ fontSize: 16 }} />} onClick={() => setLinkDialogOpen(true)}>
                합배송 만들기
              </Button>
            )}
          >
            <Typography variant="body2" color="text.secondary">
              같은 학회의 다른 주문과 묶어 한 주소로 함께 배송할 수 있습니다. 합배송한 뒤에는 다시 나눌 수 없습니다.
            </Typography>
          </SectionCard>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${theme.gray[200]}` }}>
        <ActionSlot justify={isMobile ? 'flex-start' : 'flex-end'} sx={{ width: '100%' }}>
          <Button onClick={onClose} variant="outlined" size="large" fullWidth={isMobile}>닫기</Button>
        </ActionSlot>
      </Box>
    </Box>
  );

  return (
    <>
      <WrapperComponent {...wrapperProps}>
        {isMobile ? content : <Fade in={open}>{content}</Fade>}
      </WrapperComponent>

      {/* 헤더 ⋮ 메뉴 */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.md } } }}
      >
        {order.access_token && (
          <MenuItem
            component="a"
            href={`/order/status/${order.access_token}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuAnchor(null)}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon><OpenInNewIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="고객 주문서 열기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
        {order.access_token && isMaster && <Divider sx={{ my: 0.5 }} />}
        {isMaster && (
          <MenuItem onClick={() => { setMenuAnchor(null); setDeleteConfirmOpen(true); }} sx={{ minHeight: 44, color: 'error.main' }}>
            <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="주문건 삭제" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
      </Menu>

      {/* 합배송 연계 미리보기 다이얼로그 */}
      <LinkPreviewDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        baseOrder={order}
        events={events}
        addNotification={addNotification}
        onLinked={() => { setLinkDialogOpen(false); onUpdate(); onClose(); }}
      />

      {/* Delete Confirm */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>주문 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            주문 <strong>#{order?.id}</strong> ({order?.customer_name})을 삭제합니다.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OrderDetailModal;
