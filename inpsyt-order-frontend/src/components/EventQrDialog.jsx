import React from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

/**
 * 주문서 QR 다이얼로그 — 학회 목록(A10)·상세(L2) 공용.
 * 실 SVG + 학회명 + 주소(URL) + "SVG 다운로드" + "닫기".
 * @param {{ open:boolean, name:string, url:string, qrSvg:string, onClose:Function, onDownload:Function }} props
 */
const EventQrDialog = ({ open, name, url, qrSvg, onClose, onDownload }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>QR 코드</DialogTitle>
    <DialogContent>
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mb: 2, '& svg': { maxWidth: '100%', height: 'auto' } }}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      {name && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{name}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, wordBreak: 'break-all', fontFeatureSettings: '"tnum" 1' }}>
            {url}
          </Typography>
        </Box>
      )}
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onDownload}>SVG 다운로드</Button>
      <Button onClick={onClose}>닫기</Button>
    </DialogActions>
  </Dialog>
);

export default EventQrDialog;
