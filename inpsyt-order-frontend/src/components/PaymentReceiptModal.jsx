import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Divider, useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, ListItemIcon, ListItemText, ListSubheader,
  Select, FormControl, InputLabel, TextField, Tooltip, Popover, Checkbox,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ReceiptLong as ReceiptLongIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  PersonAddAlt as PersonAddIcon,
  DeleteOutline as DeleteOutlineIcon,
  EventNote as EventNoteIcon,
  CalendarMonth as CalendarMonthIcon,
  WbSunny as WbSunnyIcon,
  Flight as FlightIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import { EmptyState, CalendarPopover } from './ui';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import {
  TRIP_RATE, POSITIONS,
  WEEKEND_SLOTS, DEFAULT_WEEKEND_SLOT_ID, getWeekendSlot,
  weekendUnit, tripWeekdays, perMemberAmount, blockTotal,
  blockDateSet, computeConflicts, sortMembers,
} from '../utils/allowanceRules';
import { exportPaymentReceipt } from '../utils/paymentReceipt';

/**
 * A10b 지불증(수당 영수증) 생성 모달 — 실 컴포넌트.
 * 사양: design-system/specs/A10_PaymentReceiptModal.md
 *  §2 수당규정(반일40k·종일70k·출장20k·범위 내 평일수) + 같은날짜 중복지급 금지
 *  §3 입력단위 = 「날짜/항목 블록」(엑셀 양식 블록과 1:1)
 *  §4 모달구조(블록 리스트 + 인원 + 하단 총합+한글)
 *  §5 직급(차장>과장>대리>사원 고정 드롭다운, 정렬축)
 *
 * 계산·중복검증은 utils/allowanceRules.js(순수 함수) 단일 진실 소스.
 * 다운로드는 utils/paymentReceipt.js(ExcelJS) — 양식 동적 행.
 * 캘린더는 공용 ui/DateField.jsx의 CalendarPopover(multi/range) — 이 파일에서 추출됨(2026-06-10).
 *
 * props:
 *  - open, onClose
 *  - event: { id, name, venue, start_date, end_date, attendee_ids }
 *  - staff: [{ id, name, role, position }] (참석자 후보 풀 — EventManagementPage가 position 포함 fetch)
 */

const WDAY = ['일', '월', '화', '수', '목', '금', '토'];
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const dow = (iso) => WDAY[parseISO(iso).getDay()];
const dot = (iso) => (iso ? iso.slice(5).replace('-', '.') : ''); // 2026-10-18 → 10.18
const won = (n) => `${(n || 0).toLocaleString()}원`;

let _bid = 0;
const nextBlockId = () => `blk-${++_bid}`;

// ════════════════════════════════════════════════════════════════
// 인원 추가 메뉴 (참석자 멀티선택 + 참관 직원 인라인)
// ════════════════════════════════════════════════════════════════
const AddMemberMenu = ({ anchorEl, open, onClose, candidatePool, existingIds, onAddAttendees, onAddObserver }) => {
  const theme = useTheme();
  const [picked, setPicked] = useState(new Set());
  const [obsName, setObsName] = useState('');
  const [obsPosition, setObsPosition] = useState('사원');

  const candidates = useMemo(
    () => sortMembers(candidatePool.filter((p) => !existingIds.has(p.id))),
    [candidatePool, existingIds],
  );

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const close = () => { setPicked(new Set()); setObsName(''); setObsPosition('사원'); onClose(); };

  const confirmAttendees = () => {
    const chosen = candidates.filter((c) => picked.has(c.id));
    if (chosen.length) onAddAttendees(chosen);
    close();
  };
  const confirmObserver = () => {
    if (obsName.trim()) onAddObserver(obsName.trim(), obsPosition);
    close();
  };

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { width: 320, borderRadius: `${theme.radii.md}px`, mt: 0.5 } } }}
    >
      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 0.5 }}>참석자</Typography>
        {candidates.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', px: 0.5, py: 1 }}>
            추가할 참석자가 없습니다. 아래에서 참관 직원을 추가하세요.
          </Typography>
        ) : (
          <Box sx={{ mt: 0.5, mb: 1, maxHeight: 240, overflowY: 'auto' }}>
            {candidates.map((c) => {
              const checked = picked.has(c.id);
              return (
                <Box
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 0.5, minHeight: 44, borderRadius: `${theme.radii.sm}px`, cursor: 'pointer',
                    '&:hover': { bgcolor: theme.gray[50] },
                  }}
                >
                  <Checkbox checked={checked} size="small" sx={{ p: 0.5 }} tabIndex={-1} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  {c.position && (
                    <Box sx={{ px: 0.75, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[100] }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{c.position}</Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
            <Button
              fullWidth size="small" variant="contained" disabled={picked.size === 0}
              onClick={confirmAttendees} sx={{ mt: 0.5, minHeight: 40 }}
            >
              {picked.size > 0 ? `${picked.size}명 추가` : '참석자 선택'}
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.attention, px: 0.5 }}>
          참관 직원 (저장 안 됨 · 1회성)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, px: 0.5 }}>
          <TextField
            size="small" placeholder="이름" value={obsName}
            onChange={(e) => setObsName(e.target.value)}
            sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: 44 } }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmObserver(); }}
          />
          <FormControl size="small" sx={{ flex: '0 0 84px' }}>
            <Select value={obsPosition} onChange={(e) => setObsPosition(e.target.value)} sx={{ minHeight: 44 }}>
              {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Button
          fullWidth size="small" variant="outlined" disabled={!obsName.trim()}
          startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
          onClick={confirmObserver} sx={{ mt: 1, minHeight: 40 }}
        >
          참관 직원 추가
        </Button>
      </Box>
    </Popover>
  );
};

// ════════════════════════════════════════════════════════════════
// 인원 행 (블록 내부 1명)
// ════════════════════════════════════════════════════════════════
const MemberRow = ({ member, amount, conflictDates, onRemove }) => {
  const theme = useTheme();
  const hasConflict = conflictDates && conflictDates.size > 0;
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.875,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: hasConflict ? alpha(theme.palette.error.main, 0.05) : 'transparent',
        border: hasConflict ? `1px solid ${alpha(theme.palette.error.main, 0.3)}` : '1px solid transparent',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{member.name}</Typography>
      {member.position && (
        <Box sx={{ px: 0.625, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[100] }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{member.position}</Typography>
        </Box>
      )}
      {member.adhoc && (
        <Box sx={{ px: 0.625, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.accent.attention, 0.12), border: `1px solid ${alpha(theme.accent.attention, 0.28)}` }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.attention }}>참관</Typography>
        </Box>
      )}
      {hasConflict && (
        <Tooltip title={`${[...conflictDates].map(dot).join(', ')} — 같은 날짜에 주말근무·출장 중복 지급 (한쪽을 빼주세요)`} arrow>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: theme.palette.error.main }}>
            <WarningIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>날짜 중복</Typography>
          </Box>
        </Tooltip>
      )}
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1', color: 'text.primary' }}>
          {won(amount)}
        </Typography>
        <IconButton size="small" onClick={onRemove} aria-label={`${member.name} 제거`} sx={{ width: 32, height: 32, color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.06) } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

// ════════════════════════════════════════════════════════════════
// 항목 블록 카드 (주말근무 / 출장)
// ════════════════════════════════════════════════════════════════
const BlockCard = ({ block, conflicts, candidatePool, monthBase, onUpdate, onRemove }) => {
  const theme = useTheme();
  const isWeekendBlk = block.type === 'weekend';
  const accent = isWeekendBlk ? theme.palette.error.main : theme.palette.info.main;
  const Icon = isWeekendBlk ? WbSunnyIcon : FlightIcon;

  const [calAnchor, setCalAnchor] = useState(null);
  const [addAnchor, setAddAnchor] = useState(null);

  const unit = isWeekendBlk ? weekendUnit(block) : TRIP_RATE;
  const weekdays = isWeekendBlk ? 0 : tripWeekdays(block);
  const per = perMemberAmount(block);
  const total = blockTotal(block);
  const slot = isWeekendBlk ? getWeekendSlot(block.slotId) : null;
  const existingIds = useMemo(() => new Set((block.members || []).map((m) => m.id)), [block.members]);

  const dateLabel = isWeekendBlk
    ? (block.dates?.length
        ? block.dates.map((d) => `${dot(d)}(${dow(d)})`).join(', ')
        : '날짜 선택 필요')
    : (block.start && block.end
        ? `${dot(block.start)}(${dow(block.start)})~${dot(block.end)}(${dow(block.end)})`
        : '기간 선택 필요');

  const memberConflict = (mid) => {
    const c = conflicts.get(mid);
    if (!c) return null;
    const set = blockDateSet(block);
    const overlap = new Set([...c].filter((d) => set.has(d)));
    return overlap.size ? overlap : null;
  };

  return (
    <Box sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${theme.gray[100]}`, bgcolor: alpha(accent, 0.04) }}>
        <Box sx={{ width: 30, height: 30, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(accent, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 18, color: accent }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.primary', lineHeight: 1.3 }}>
            {isWeekendBlk ? '주말출근비' : '출장비'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isWeekendBlk
              ? `${slot.category === 'full' ? '종일' : '반일'} ${won(unit)} × ${block.dates?.length || 0}일`
              : `${won(TRIP_RATE)} × ${weekdays}일`}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontFeatureSettings: '"tnum" 1', color: total > 0 ? 'text.primary' : 'text.disabled' }}>
            {won(total)}
          </Typography>
          <Tooltip title="블록 삭제" arrow>
            <IconButton size="small" onClick={onRemove} aria-label="블록 삭제" sx={{ width: 34, height: 34, color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.06) } }}>
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined" size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
            onClick={(e) => setCalAnchor(e.currentTarget)}
            sx={{ minHeight: 44, borderColor: theme.gray[300], color: 'text.primary', flexShrink: 0 }}
          >
            {isWeekendBlk ? '근무일 선택' : '출장 기간'}
          </Button>
          <Typography variant="body2" sx={{ fontWeight: 600, color: block.dates?.length || (block.start && block.end) ? 'text.primary' : 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
            {dateLabel}
          </Typography>
          <CalendarPopover
            anchorEl={calAnchor}
            open={Boolean(calAnchor)}
            onClose={() => setCalAnchor(null)}
            mode={isWeekendBlk ? 'multi' : 'range'}
            monthBase={isWeekendBlk ? (block.dates?.[0] || monthBase) : (block.start || monthBase)}
            value={isWeekendBlk ? block.dates : { start: block.start, end: block.end }}
            onChange={(v) =>
              isWeekendBlk
                ? onUpdate({ ...block, dates: v })
                : onUpdate({ ...block, start: v.start, end: v.end })
            }
          />
        </Box>

        {isWeekendBlk && (
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id={`slot-${block.id}`}>근무 시간대</InputLabel>
            <Select
              labelId={`slot-${block.id}`}
              label="근무 시간대"
              value={slot.id}
              onChange={(e) => onUpdate({ ...block, slotId: e.target.value })}
              sx={{ minHeight: 48, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 0.75 } }}
              renderValue={(id) => {
                const s = getWeekendSlot(id);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {s.category === 'full' ? '종일' : '반일'} {s.rate.toLocaleString()}
                    </Typography>
                  </Box>
                );
              }}
            >
              <ListSubheader sx={{ lineHeight: 2.2, fontWeight: 700, color: theme.palette.error.main }}>반일 · 40,000</ListSubheader>
              {WEEKEND_SLOTS.filter((s) => s.category === 'half').map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44, gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 'auto' }}>{s.meal ? '식사 O' : '식사 X'}</Typography>
                </MenuItem>
              ))}
              <ListSubheader sx={{ lineHeight: 2.2, fontWeight: 700, color: theme.palette.primary.main }}>종일 · 70,000</ListSubheader>
              {WEEKEND_SLOTS.filter((s) => s.category === 'full').map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44, gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 'auto' }}>식사 자유</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Divider sx={{ borderColor: theme.gray[100] }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            인원 {block.members?.length || 0}명 · 1인 {won(per)}
          </Typography>
        </Box>

        {(block.members?.length || 0) === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', py: 1, textAlign: 'center' }}>
            인원을 추가하세요. 각자 {won(per)}이 지급됩니다.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {sortMembers(block.members).map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                amount={per}
                conflictDates={memberConflict(m.id)}
                onRemove={() => onUpdate({ ...block, members: block.members.filter((x) => x.id !== m.id) })}
              />
            ))}
          </Box>
        )}

        <Button
          fullWidth variant="text" size="small"
          startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
          onClick={(e) => setAddAnchor(e.currentTarget)}
          sx={{ minHeight: 44, color: 'primary.main', justifyContent: 'center', border: `1px dashed ${theme.gray[300]}`, borderRadius: `${theme.radii.md}px` }}
        >
          인원 추가
        </Button>
        <AddMemberMenu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
          candidatePool={candidatePool}
          existingIds={existingIds}
          onAddAttendees={(arr) => onUpdate({ ...block, members: [...block.members, ...arr.map((a) => ({ id: a.id, name: a.name, position: a.position || '', adhoc: false }))] })}
          onAddObserver={(name, position) => onUpdate({ ...block, members: [...block.members, { id: `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, position, adhoc: true }] })}
        />
      </Box>
    </Box>
  );
};

// ════════════════════════════════════════════════════════════════
// 지불증 모달 본체
// ════════════════════════════════════════════════════════════════
const PaymentReceiptModal = ({ open, onClose, event, staff = [] }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { profile } = useAuth();
  const { addNotification } = useNotification();

  const [blocks, setBlocks] = useState([]);
  const [addBlockAnchor, setAddBlockAnchor] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // 참석자 후보 = event.attendee_ids → staff join(name·position).
  const candidatePool = useMemo(() => {
    const ids = new Set(event?.attendee_ids || []);
    return (staff || []).filter((s) => ids.has(s.id)).map((s) => ({ id: s.id, name: s.name, position: s.position || '' }));
  }, [event, staff]);

  const monthBase = event?.start_date || null;

  const conflicts = useMemo(() => computeConflicts(blocks), [blocks]);
  const conflictCount = conflicts.size;

  const grandTotalValue = useMemo(() => blocks.reduce((s, b) => s + blockTotal(b), 0), [blocks]);
  const koreanTotal = numberToKoreanCurrency(grandTotalValue);

  const paidMemberCountValue = useMemo(() => {
    const ids = new Set();
    blocks.forEach((b) => { if (perMemberAmount(b) > 0) (b.members || []).forEach((m) => ids.add(m.id)); });
    return ids.size;
  }, [blocks]);

  const updateBlock = (id, next) => setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  const removeBlock = (id) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const addBlock = (type) => {
    const base = type === 'weekend'
      ? { id: nextBlockId(), type: 'weekend', slotId: DEFAULT_WEEKEND_SLOT_ID, dates: [], members: [] }
      : { id: nextBlockId(), type: 'trip', start: null, end: null, members: [] };
    setBlocks((prev) => [...prev, base]);
    setAddBlockAnchor(null);
  };

  const empty = blocks.length === 0;
  const noMembers = !empty && blocks.every((b) => (b.members?.length || 0) === 0);
  const allZero = !empty && grandTotalValue === 0;
  const downloadDisabled = empty || allZero || conflictCount > 0 || downloading;

  const receiver = profile ? { name: profile.name || '', position: profile.position || '' } : null;

  const handleDownload = async () => {
    if (downloadDisabled) return;
    setDownloading(true);
    try {
      await exportPaymentReceipt({ event, blocks, receiver });
      addNotification(`지불증을 다운로드했습니다. (${won(grandTotalValue)})`, 'success');
      onClose();
    } catch (err) {
      console.error('지불증 export 실패:', err);
      addNotification(`지불증 다운로드 실패: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const eventDateRange = event?.start_date
    ? `${dot(event.start_date)}${event.end_date ? ` ~ ${dot(event.end_date)}` : ''}`
    : '';

  // 장소 표기 — 신규 저장분은 장소명(+홀·층 상세) 합성, 레거시는 venue 폴백(2026-10-12 2차).
  const venueLabel = [event?.venue_name, event?.venue_detail].filter(Boolean).join(' ') || event?.venue || '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      scroll="paper"
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : `${theme.radii.lg}px`, maxWidth: 640, width: '100%' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ReceiptLongIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="div" variant="h4" sx={{ letterSpacing: '-0.02em' }}>지불증 내보내기</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>참석 직원 수당(주말출근·출장비) 영수증</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="닫기" sx={{ width: 40, height: 40, color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: theme.gray[50] }}>
        <Box sx={{ mt: 0.5, mb: 2, p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}` }}>
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{event?.name || '행사'}</Typography>
          {(eventDateRange || venueLabel) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
              <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                {eventDateRange}{venueLabel ? ` · ${venueLabel}` : ''}
              </Typography>
            </Box>
          )}
        </Box>

        {conflictCount > 0 && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <WarningIcon sx={{ fontSize: 18, color: 'error.main', mt: 0.125 }} />
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, lineHeight: 1.5 }}>
              같은 날짜에 주말출근비·출장비가 중복 지급된 인원이 {conflictCount}명 있습니다.
              같은 날짜에는 한쪽만 지급할 수 있어요(중복 인원은 빨간 표시). 해결 전에는 다운로드할 수 없습니다.
            </Typography>
          </Box>
        )}

        {empty ? (
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px` }}>
            <EmptyState
              icon={ReceiptLongIcon}
              title="항목이 없습니다"
              description="주말출근비 또는 출장비 항목을 추가해 지불증을 작성하세요."
              action={{ label: '항목 추가', onClick: (e) => setAddBlockAnchor(e.currentTarget), startIcon: <AddIcon sx={{ fontSize: 18 }} /> }}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {blocks.map((b) => (
              <BlockCard
                key={b.id}
                block={b}
                conflicts={conflicts}
                candidatePool={candidatePool}
                monthBase={monthBase}
                onUpdate={(next) => updateBlock(b.id, next)}
                onRemove={() => removeBlock(b.id)}
              />
            ))}
          </Box>
        )}

        <Button
          fullWidth variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          onClick={(e) => setAddBlockAnchor(e.currentTarget)}
          sx={{
            mt: 1.5, minHeight: 48, borderStyle: 'dashed', borderColor: theme.gray[300],
            color: 'text.secondary', bgcolor: 'background.paper',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.03) },
          }}
        >
          항목 추가
        </Button>
        <Menu anchorEl={addBlockAnchor} open={Boolean(addBlockAnchor)} onClose={() => setAddBlockAnchor(null)}>
          <MenuItem onClick={() => addBlock('weekend')} sx={{ minHeight: 48, gap: 1 }}>
            <ListItemIcon><WbSunnyIcon sx={{ fontSize: 20, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="주말출근비" secondary="여러 날 선택 · 시간대 규정" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
          </MenuItem>
          <MenuItem onClick={() => addBlock('trip')} sx={{ minHeight: 48, gap: 1 }}>
            <ListItemIcon><FlightIcon sx={{ fontSize: 20, color: theme.palette.info.main }} /></ListItemIcon>
            <ListItemText primary="출장비" secondary="기간 선택 · 20,000원/평일" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
          </MenuItem>
        </Menu>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1.5, px: 3, py: 2.5 }}>
        <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: allZero || empty ? theme.gray[50] : alpha(theme.palette.primary.main, 0.04), border: `1px solid ${allZero || empty ? theme.gray[200] : alpha(theme.palette.primary.main, 0.16)}` }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              총 지급액
              {!empty && (
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 0.75 }}>
                  지급 인원 {paidMemberCountValue}명
                </Typography>
              )}
            </Typography>
            <Typography variant="h4" sx={{ color: allZero || empty ? 'text.disabled' : 'primary.main', fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' }}>
              {won(grandTotalValue)}
            </Typography>
          </Box>
          {!allZero && !empty && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.25 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                금 {koreanTotal}원정
              </Typography>
            </Box>
          )}
          {(empty || noMembers || allZero) && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {empty
                ? '항목을 추가하면 지급액이 계산됩니다.'
                : noMembers
                  ? '각 항목에 인원을 추가하세요.'
                  : '날짜·기간을 선택하면 지급액이 계산됩니다.'}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            영수인 <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{receiver?.name || '관리자'}{receiver?.position ? ` ${receiver.position}` : ''}</Box>
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={{ minHeight: 48, color: 'text.secondary' }}>취소</Button>
            <Tooltip title={conflictCount > 0 ? '날짜 중복을 먼저 해결하세요' : ''} arrow disableHoverListener={conflictCount === 0}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                  disabled={downloadDisabled}
                  onClick={handleDownload}
                  sx={{ minHeight: 48 }}
                >
                  {downloading ? '생성 중…' : '지불증 다운로드'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentReceiptModal;
