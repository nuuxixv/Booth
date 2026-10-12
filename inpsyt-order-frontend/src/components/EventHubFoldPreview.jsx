import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Menu, ListItemIcon, ListItemText, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  EventNote as EventNoteIcon,
  FilterList as FilterListIcon,
  Add as AddIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  QrCode2 as QrCode2Icon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  LocalOffer as LocalOfferIcon,
  StarBorder as StarBorderIcon,
  ReceiptLong as ReceiptLongIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  HistoryToggleOff as HistoryIcon,
  AutoAwesomeMotion as TemplateIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/event-hub-fold.
 * A10 학회 통합 목록 — "종료 학회 하단 접힘 + 예정 전체 표시" 재구성 시안(2026-10-12 확정).
 * 정적 Preview (mock 데이터, 실 도메인 미연결). 건우님 마일스톤 검수용.
 *
 * 사양: design-system/specs/A10_EventHubList.md
 *  - 진행 중·예정 = 상단, 날짜 오름차순. 예정은 연도 무관 전부 표시(세이프가드).
 *  - 종료 = 하단 "종료된 학회 N건" 접힘 영역(기본 접힘 · 펼치면 최근 종료순).
 *  - 기간 필터 재정의: 기본값 "전체". 상단(예정·진행 중)은 기간 무관 항상 전부,
 *    기간 필터는 종료 영역에만 적용. 학회명·참석자·"나"는 양 영역 모두 적용.
 *  - 번호(#)는 상단/종료 각 영역에서 1부터 재시작(표시용, 영구 ID 아님).
 *  - ⋯ 메뉴에 지불증 내보내기 유지(입금결의서는 L2 상세에만).
 *  - §12-6 "상태 필터 토글 미부활" 결정과 별개(토글이 아니라 종료만 접는 단일 섹션).
 *
 * 톤·헬퍼·AttendeeCell·DiscountChip·QR = EventManagementPage/EventHubListPreview 정합.
 */

const ME = { id: 'u-me', name: '김현장', role: 'onsite' };

const STAFF = [
  { id: 'u-me',  name: '김현장', role: 'onsite' },
  { id: 'u-002', name: '이부스', role: 'onsite' },
  { id: 'u-003', name: '박운영', role: 'onsite' },
  { id: 'u-004', name: '정마스터', role: 'master' },
];
const STAFF_MAP = Object.fromEntries(STAFF.map((s) => [s.id, s]));

const TODAY = '2026-10-12'; // mock 기준일
const YEAR = 2026;

// 진행 중 + 예정(연도 무관) + 종료(작년 포함) 혼합
const MOCK_EVENTS = [
  { id: 'e1', hostSociety: '한국상담심리학회', season: '추계학술대회', name: '2026 한국상담심리학회 추계학술대회', startDate: '2026-10-11', endDate: '2026-10-13', venue: '부산 BEXCO 제1전시장', attendeeIds: ['u-me', 'u-002', 'u-004'], discountPercent: 15, urlSlug: 'kcpa-2026-fall' },
  { id: 'e2', hostSociety: '한국상담학회', season: '보수교육', name: '2026 한국상담학회 보수교육', startDate: '2026-11-08', endDate: '2026-11-08', venue: '코엑스 컨퍼런스룸 401', attendeeIds: ['u-me', 'u-003'], discountPercent: 0, urlSlug: 'kca-2026-edu' },
  { id: 'e3', hostSociety: '한국청소년상담학회', season: '세미나', name: '2026 한국청소년상담학회 세미나', startDate: '2026-12-05', endDate: '2026-12-06', venue: '서울 코엑스 그랜드볼룸', attendeeIds: ['u-me'], discountPercent: 10, urlSlug: 'kyc-2026-winter' },
  { id: 'e4', hostSociety: '한국심리학회', season: '연수강좌', name: '2027 한국심리학회 연수강좌', startDate: '2027-02-13', endDate: '2027-02-13', venue: '온라인 (Zoom)', attendeeIds: [], discountPercent: 0, urlSlug: 'kpa-2027-training' },
  { id: 'e5', hostSociety: '한국심리학회', season: '연차학술대회', name: '2026 한국심리학회 연차학술대회', startDate: '2026-09-13', endDate: '2026-09-15', venue: '대전 컨벤션센터', attendeeIds: ['u-me', 'u-003', 'u-004'], discountPercent: 20, urlSlug: 'kpa-2026-annual' },
  { id: 'e6', hostSociety: '한국임상심리학회', season: '하계워크숍', name: '2026 한국임상심리학회 하계워크숍', startDate: '2026-07-04', endDate: '2026-07-05', venue: '서울 세종대학교', attendeeIds: ['u-003'], discountPercent: 10, urlSlug: 'kcp-2026-summer' },
  { id: 'e7', hostSociety: '한국임상심리학회', season: '춘계학술대회', name: '2026 한국임상심리학회 춘계학술대회', startDate: '2026-05-08', endDate: '2026-05-10', venue: '대전 컨벤션센터', attendeeIds: ['u-003'], discountPercent: 20, urlSlug: 'kcp-2026-spring' },
  { id: 'e8', hostSociety: '한국상담학회', season: '보수교육', name: '2025 한국상담학회 보수교육', startDate: '2025-11-20', endDate: '2025-11-20', venue: '코엑스 컨퍼런스룸 402', attendeeIds: ['u-002'], discountPercent: 0, urlSlug: 'kca-2025-edu' },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');
const getTimeState = (start, end) => {
  if (!start || !end) return 'upcoming';
  if (end < TODAY) return 'ended';
  if (start > TODAY) return 'upcoming';
  return 'active';
};
const STATE_TO_STATUS = { active: 'paid', upcoming: 'pending', ended: 'completed' };
const STATE_TO_LABEL = { active: '진행 중', upcoming: '예정', ended: '종료' };

const EventStateBadge = ({ start, end }) => {
  const st = getTimeState(start, end);
  return <StatusBadge value={STATE_TO_STATUS[st]} label={STATE_TO_LABEL[st]} size="sm" />;
};

// 2차 예정 태그 — 점선 테두리로 "아직 비활성" 표시(룰 E: 가짜 기능 아님, 명시적 표기)
const SecondPhaseTag = () => {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 0.625, py: 0.125, flexShrink: 0,
        borderRadius: `${theme.radii.sm}px`, border: `1px dashed ${theme.gray[300]}`, bgcolor: theme.gray[50],
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, lineHeight: 1.4 }}>2차 예정</Typography>
    </Box>
  );
};

const DiscountChip = ({ percent }) => {
  const theme = useTheme();
  if (!percent || percent <= 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375, px: 0.75, py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.accent.revenue, 0.1),
        border: `1px solid ${alpha(theme.accent.revenue, 0.2)}`, flexShrink: 0,
      }}
    >
      <LocalOfferIcon sx={{ fontSize: 11, color: theme.accent.revenue }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.revenue, lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>
        {percent}%
      </Typography>
    </Box>
  );
};

const AttendeeCell = ({ ids = [] }) => {
  const theme = useTheme();
  if (!ids.length) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  const names = ids.map((id) => STAFF_MAP[id]?.name || '(삭제)');
  const mine = ids.includes(ME.id);

  const Pill = ({ label, accent }) => (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: accent ? alpha(theme.palette.primary.main, 0.08) : theme.gray[100],
        border: `1px solid ${accent ? alpha(theme.palette.primary.main, 0.24) : theme.gray[200]}`,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary', lineHeight: 1.3 }}>{label}</Typography>
    </Box>
  );

  if (names.length <= 3) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {names.map((nm, i) => <Pill key={`${nm}-${i}`} label={nm} accent={mine && ids[i] === ME.id} />)}
      </Box>
    );
  }
  const firstName = mine ? ME.name : names[0];
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Pill label={firstName} accent={mine} />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>외 {names.length - 1}명</Typography>
    </Box>
  );
};

// ─── ⋯ 행 액션 메뉴 (지불증 내보내기 포함 — 입금결의서는 L2에만) ──
const RowActionMenu = ({ anchorEl, onClose, onEdit, onOpenUrl, onCopyUrl, onShowQr, onReceipt, onDelete, canEdit, isMaster }) => {
  const theme = useTheme();
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 208, borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.md } } }}
    >
      {canEdit && (
        <MenuItem onClick={onEdit} sx={{ minHeight: 44 }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="수정" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
      )}
      <MenuItem onClick={onOpenUrl} sx={{ minHeight: 44 }}>
        <ListItemIcon><OpenInNewIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="주문 페이지 열기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      <MenuItem onClick={onCopyUrl} sx={{ minHeight: 44 }}>
        <ListItemIcon><ContentCopyIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="주문 URL 복사" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      <MenuItem onClick={onShowQr} sx={{ minHeight: 44 }}>
        <ListItemIcon><QrCode2Icon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="QR 코드" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      <MenuItem onClick={onReceipt} sx={{ minHeight: 44 }}>
        <ListItemIcon><ReceiptLongIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="지불증 내보내기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      {isMaster && <Divider sx={{ my: 0.5 }} />}
      {isMaster && (
        <MenuItem onClick={onDelete} sx={{ minHeight: 44, color: 'error.main' }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: theme.palette.error.main }} /></ListItemIcon>
          <ListItemText primary="삭제" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
      )}
    </Menu>
  );
};

// ─── 데스크톱 표 행 ─────────────────────────────────────────────
const EventRow = ({ index, event, isUpcoming, onOpenMenu, onRowClick }) => {
  const theme = useTheme();
  const ended = getTimeState(event.startDate, event.endDate) === 'ended';
  return (
    <TableRow
      hover
      onClick={() => onRowClick(event)}
      sx={{
        cursor: 'pointer',
        bgcolor: isUpcoming ? alpha(theme.palette.primary.main, 0.04) : ended ? theme.gray[50] : 'transparent',
        boxShadow: isUpcoming ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        '& td': ended ? { color: 'text.secondary' } : undefined,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
        transition: `background-color 0.15s ${theme.easing.toss}`,
      }}
    >
      <TableCell sx={{ width: 56, color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
        <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500 }}>{index}</Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 160 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isUpcoming && (
            <Tooltip title="내 참석 다음 학회" arrow placement="top">
              <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
            </Tooltip>
          )}
          <Typography variant="body2" sx={{ fontWeight: 700, color: ended ? 'text.secondary' : 'text.primary' }}>{event.hostSociety}</Typography>
        </Box>
        <Box sx={{ mt: 0.5 }}><EventStateBadge start={event.startDate} end={event.endDate} /></Box>
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{event.season}</Typography>
          <DiscountChip percent={event.discountPercent} />
        </Box>
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>{dot(event.startDate)}</Typography>
        {event.endDate && event.endDate !== event.startDate && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>~ {dot(event.endDate)}</Typography>
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 140 }}>
        {event.venue ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlaceIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: ended ? 'text.secondary' : 'text.primary' }}>{event.venue}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}><AttendeeCell ids={event.attendeeIds} /></TableCell>
      <TableCell align="right" sx={{ width: 56 }}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget, event); }}
          sx={{ color: 'text.secondary', '&:hover': { bgcolor: theme.gray[100], color: 'text.primary' } }}
          aria-label="행 메뉴 열기"
        >
          <MoreVertIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

// ─── 모바일 카드 ───────────────────────────────────────────────
const EventMobileCard = ({ event, isUpcoming, onOpenMenu, onRowClick }) => {
  const theme = useTheme();
  const ended = getTimeState(event.startDate, event.endDate) === 'ended';
  return (
    <Box
      onClick={() => onRowClick(event)}
      sx={{
        bgcolor: ended ? theme.gray[50] : 'background.paper',
        border: `1px solid ${isUpcoming ? alpha(theme.palette.primary.main, 0.3) : theme.gray[200]}`,
        borderLeft: isUpcoming ? `3px solid ${theme.palette.primary.main}` : `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.lg}px`, p: 2,
        display: 'flex', flexDirection: 'column', gap: 1.25, cursor: 'pointer',
        transition: `all 0.2s ${theme.easing.toss}`,
        '&:hover': { borderColor: theme.gray[300] },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventStateBadge start={event.startDate} end={event.endDate} />
        <DiscountChip percent={event.discountPercent} />
        <Box sx={{ ml: 'auto' }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget, event); }} sx={{ color: 'text.secondary' }} aria-label="행 메뉴 열기">
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {isUpcoming && <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
          <Typography variant="subtitle1" sx={{ color: ended ? 'text.secondary' : 'text.primary', lineHeight: 1.3 }}>{event.hostSociety}</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{event.season}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
            {dot(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` ~ ${dot(event.endDate)}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <PlaceIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.venue || '—'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <PersonIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0, mt: 0.25 }} />
          <AttendeeCell ids={event.attendeeIds} />
        </Box>
      </Box>
    </Box>
  );
};

// ─── 데스크톱 표 래퍼 ───────────────────────────────────────────
const EventTable = ({ events, upcomingId, onOpenMenu, onRowClick }) => (
  <TableContainer>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>#</TableCell>
          <TableCell>학회명</TableCell>
          <TableCell>행사명</TableCell>
          <TableCell>날짜</TableCell>
          <TableCell>장소</TableCell>
          <TableCell>참석자</TableCell>
          <TableCell align="right" sx={{ width: 56 }} />
        </TableRow>
      </TableHead>
      <TableBody>
        {events.map((event, i) => (
          <EventRow key={event.id} index={i + 1} event={event} isUpcoming={event.id === upcomingId} onOpenMenu={onOpenMenu} onRowClick={onRowClick} />
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── QR 다이얼로그(목록 기존 구성 — SVG + 학회명 + 주소 + 다운로드 + 닫기) ──
const QrDialog = ({ open, event, qrSvg, onClose, onDownload }) => {
  const url = event ? `${window.location.origin}/order?events=${event.urlSlug}` : '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>QR 코드</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, '& svg': { maxWidth: '100%', height: 'auto' } }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        {event && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{event.name}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, wordBreak: 'break-all', fontFeatureSettings: '"tnum" 1' }}>{url}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onDownload}>SVG 다운로드</Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────
const EventHubFoldPreview = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isMaster = ME.role === 'master';
  const canEdit = true;

  const [dateFilter, setDateFilter] = useState('all'); // all(기본) | year | h1 | h2 — 종료 영역에만 적용
  const [societyFilter, setSocietyFilter] = useState('all');
  const [attendeeFilter, setAttendeeFilter] = useState('all'); // all | me | staffId
  const [endedOpen, setEndedOpen] = useState(false); // 종료 접힘(기본 접힘)
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuEvent, setMenuEvent] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEvent, setQrEvent] = useState(null);
  const [qrSvg, setQrSvg] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const toast = (message) => setSnackbar({ open: true, message });

  // 학회명·참석자·"나" 공통 필터(양 영역 적용)
  const matchShared = useCallback((ev) => {
    if (societyFilter !== 'all' && ev.hostSociety !== societyFilter) return false;
    if (attendeeFilter === 'me' && !ev.attendeeIds.includes(ME.id)) return false;
    if (attendeeFilter !== 'all' && attendeeFilter !== 'me' && !ev.attendeeIds.includes(attendeeFilter)) return false;
    return true;
  }, [societyFilter, attendeeFilter]);

  // 상단(진행 중·예정) — 기간 무관, 항상 전부. 날짜 오름차순.
  const topEvents = useMemo(() => (
    MOCK_EVENTS
      .filter((ev) => getTimeState(ev.startDate, ev.endDate) !== 'ended')
      .filter(matchShared)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  ), [matchShared]);

  // 종료 — 기간 필터 적용. 최근 종료순(end desc).
  const endedEvents = useMemo(() => (
    MOCK_EVENTS
      .filter((ev) => getTimeState(ev.startDate, ev.endDate) === 'ended')
      .filter(matchShared)
      .filter((ev) => {
        if (dateFilter === 'year') return ev.endDate.slice(0, 4) === String(YEAR);
        if (dateFilter === 'h1') return Number(ev.endDate.slice(5, 7)) <= 6;
        if (dateFilter === 'h2') return Number(ev.endDate.slice(5, 7)) > 6;
        return true; // all
      })
      .sort((a, b) => (a.endDate > b.endDate ? -1 : 1))
  ), [matchShared, dateFilter]);

  // Upcoming 하이라이트 — 내 참석 미래 가장 가까운 1건(master=전체, 0건 폴백). 상단만.
  const upcomingId = useMemo(() => {
    const future = topEvents.filter((e) => e.startDate > TODAY);
    if (!future.length) return null;
    if (isMaster) return future[0].id;
    const mine = future.find((e) => e.attendeeIds.includes(ME.id));
    return (mine || future[0]).id;
  }, [topEvents, isMaster]);

  const distinctSocieties = useMemo(() => [...new Set(MOCK_EVENTS.map((e) => e.hostSociety))], []);
  const activeFilterCount = (dateFilter !== 'all' ? 1 : 0) + (societyFilter !== 'all' ? 1 : 0) + (attendeeFilter !== 'all' ? 1 : 0);

  const openMenu = (anchor, event) => { setMenuAnchor(anchor); setMenuEvent(event); };
  const closeMenu = () => setMenuAnchor(null);
  const handleRowClick = (event) => toast(`${event.name} → 학회 상세(L2) 진입 (mock)`);
  const handleEdit = () => { closeMenu(); toast(`${menuEvent?.name} 수정 (mock)`); };
  const handleOpenUrl = () => { closeMenu(); toast(`주문 페이지 새 창 · ${menuEvent?.urlSlug} (mock)`); };
  const handleCopyUrl = () => { closeMenu(); navigator.clipboard?.writeText(`${window.location.origin}/order?events=${menuEvent?.urlSlug}`); toast('주문 URL이 복사되었습니다'); };
  const handleReceipt = () => { closeMenu(); toast(`${menuEvent?.name} 지불증 내보내기 (mock)`); };
  const handleDelete = () => { closeMenu(); toast(`${menuEvent?.name} 삭제 (연결 주문 가드 후, mock)`); };
  const handleShowQr = async () => {
    const ev = menuEvent;
    closeMenu();
    if (!ev) return;
    try {
      const svg = await QRCode.toString(`${window.location.origin}/order?events=${ev.urlSlug}`, { type: 'svg', color: { dark: '#252525', light: '#FFFFFF' }, margin: 1, width: 300 });
      setQrSvg(svg); setQrEvent(ev); setQrOpen(true);
    } catch { toast('QR 생성 실패 (mock)'); }
  };

  const DATE_TOGGLES = [
    { key: 'all', label: '전체' },
    { key: 'year', label: `올해(${YEAR})` },
    { key: 'h1', label: '상반기' },
    { key: 'h2', label: '하반기' },
  ];

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      {canEdit && (
        <Button size="small" variant="outlined" startIcon={<SettingsIcon sx={{ fontSize: 16 }} />} onClick={() => toast('학회 목록 관리 (mock)')} sx={{ minHeight: 36 }}>학회 목록 관리</Button>
      )}
      {/* 준비노트 템플릿 — 2차(A12). events:edit만. "학회 목록 관리" 옆. */}
      {canEdit && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<TemplateIcon sx={{ fontSize: 16 }} />} onClick={() => toast('준비노트 템플릿 관리 (2차, mock)')} sx={{ minHeight: 36 }}>준비노트 템플릿</Button>
          <SecondPhaseTag />
        </Box>
      )}
      {canEdit && (
        <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => toast('학회 추가 (전용 페이지, mock)')} sx={{ minHeight: 36 }}>학회 추가</Button>
      )}
    </Box>
  );

  const resetFilters = () => { setDateFilter('all'); setSocietyFilter('all'); setAttendeeFilter('all'); };

  return (
    <PreviewShell activePath="/admin/events">
      <PageHeader
        title="학회"
        subtitle={`진행·예정 ${topEvents.length}건 · 종료 ${endedEvents.length}건 · 운영 대상 한눈에`}
        icon={EventNoteIcon}
        action={headerAction}
      />

      {/* 필터바 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>필터</Typography>
          {activeFilterCount > 0 && (
            <Chip label={activeFilterCount} size="small" sx={{ height: 18, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiChip-label': { ...theme.typography.caption } }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>기간</Typography>
          {DATE_TOGGLES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={dateFilter === key ? 'filled' : 'outlined'}
              color={dateFilter === key ? 'primary' : 'default'}
              onClick={() => setDateFilter(key)}
              sx={{ paddingX: 1.5, fontWeight: dateFilter === key ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1.5 }}>
          기간은 종료 학회에만 적용돼요. 진행 중·예정 학회는 연도와 무관하게 항상 모두 표시됩니다.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>학회명</InputLabel>
            <Select value={societyFilter} label="학회명" onChange={(e) => setSocietyFilter(e.target.value)}>
              <MenuItem value="all">전체 학회</MenuItem>
              {distinctSocieties.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>참석자</InputLabel>
            <Select value={attendeeFilter === 'me' ? 'all' : attendeeFilter} label="참석자" onChange={(e) => setAttendeeFilter(e.target.value)}>
              <MenuItem value="all">전체 참석자</MenuItem>
              {STAFF.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}{s.role === 'master' ? ' (마스터)' : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <Chip
            label="나"
            size="small"
            icon={<PersonIcon sx={{ fontSize: 14 }} />}
            variant={attendeeFilter === 'me' ? 'filled' : 'outlined'}
            color={attendeeFilter === 'me' ? 'primary' : 'default'}
            onClick={() => setAttendeeFilter(attendeeFilter === 'me' ? 'all' : 'me')}
            sx={{ fontWeight: attendeeFilter === 'me' ? 700 : 500, cursor: 'pointer' }}
          />
        </Box>
      </SectionCard>

      {/* 상단: 진행 중·예정 */}
      {topEvents.length === 0 ? (
        <SectionCard padding={20}>
          <EmptyState
            icon={EventNoteIcon}
            title="진행 중·예정 학회가 없어요"
            description="학회명·참석자 필터를 해제하거나 새 학회를 추가하세요"
            action={canEdit ? { label: '필터 해제', onClick: resetFilters } : undefined}
          />
        </SectionCard>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {topEvents.map((event) => (
            <EventMobileCard key={event.id} event={event} isUpcoming={event.id === upcomingId} onOpenMenu={openMenu} onRowClick={handleRowClick} />
          ))}
        </Box>
      ) : (
        <SectionCard padding={0}>
          <EventTable events={topEvents} upcomingId={upcomingId} onOpenMenu={openMenu} onRowClick={handleRowClick} />
        </SectionCard>
      )}

      {/* 하단: 종료 접힘 영역 */}
      <Box sx={{ mt: 3 }}>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => setEndedOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEndedOpen((v) => !v); } }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, px: 2, minHeight: 56,
            bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`,
            borderRadius: endedOpen ? `${theme.radii.lg}px ${theme.radii.lg}px 0 0` : `${theme.radii.lg}px`,
            cursor: 'pointer', transition: `background-color 0.15s ${theme.easing.toss}`,
            '&:hover': { bgcolor: theme.gray[50] },
            '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
          }}
        >
          <Box sx={{ width: 32, height: 32, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[50], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HistoryIcon sx={{ fontSize: 18, color: theme.gray[600] }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
              종료된 학회 <Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>{endedEvents.length}</Box>건
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {endedOpen ? '최근 종료순' : '펼쳐서 지난 학회 보기'}
            </Typography>
          </Box>
          {endedOpen ? <ExpandLessIcon sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
        </Box>

        {endedOpen && (
          endedEvents.length === 0 ? (
            <Box sx={{ border: `1px solid ${theme.gray[200]}`, borderTop: 'none', borderRadius: `0 0 ${theme.radii.lg}px ${theme.radii.lg}px`, overflow: 'hidden' }}>
              <EmptyState icon={HistoryIcon} title="해당 조건의 종료 학회가 없어요" description="기간·학회명·참석자 필터를 조정해 보세요" sx={{ py: 4 }} />
            </Box>
          ) : isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
              {endedEvents.map((event) => (
                <EventMobileCard key={event.id} event={event} isUpcoming={false} onOpenMenu={openMenu} onRowClick={handleRowClick} />
              ))}
            </Box>
          ) : (
            <Box sx={{ border: `1px solid ${theme.gray[200]}`, borderTop: 'none', borderRadius: `0 0 ${theme.radii.lg}px ${theme.radii.lg}px`, overflow: 'hidden' }}>
              <EventTable events={endedEvents} upcomingId={null} onOpenMenu={openMenu} onRowClick={handleRowClick} />
            </Box>
          )
        )}
      </Box>

      <RowActionMenu
        anchorEl={menuAnchor}
        onClose={closeMenu}
        onEdit={handleEdit}
        onOpenUrl={handleOpenUrl}
        onCopyUrl={handleCopyUrl}
        onShowQr={handleShowQr}
        onReceipt={handleReceipt}
        onDelete={handleDelete}
        canEdit={canEdit}
        isMaster={isMaster}
      />
      <QrDialog open={qrOpen} event={qrEvent} qrSvg={qrSvg} onClose={() => setQrOpen(false)} onDownload={() => toast('SVG 다운로드 (mock)')} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={<IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
      />
    </PreviewShell>
  );
};

export default EventHubFoldPreview;
