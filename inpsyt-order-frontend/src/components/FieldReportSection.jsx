import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  useTheme,
  Button,
  TextField,
  Collapse,
  Tooltip,
  ButtonBase,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Assignment as ReportIcon,
  ContentCopy as CopyIcon,
  Autorenew as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useFormDraft } from '../hooks/useFormDraft';
import { useNotification } from '../hooks/useNotification';
import { copyToClipboard } from '../utils/eventUrl';
import { buildSalesBlock, replaceSalesBlock, dayDateLabel } from '../utils/eventDaySales';
import { DraftBanner, DraftSavedHint } from './ui';

/**
 * 현장 보고서 섹션 — CRUD 전체 보존.
 * 대시보드(DashboardPage Row4)와 L2 학회 상세(EventDetailPage)에서 공용.
 *
 * 1차 plain text. 2차 리치 텍스트·이미지는 통합 준비 노트(prep_note) 쪽에서 다룸.
 *
 * props:
 *  - eventId: string | null  (null/'all' → 빈 안내)
 *  - eventName: string       (보고서 템플릿 머리말)
 *  - revenueData: { testRevenue, bookRevenue, toolRevenue, totalRevenue, testShipping, bookShipping, toolShipping }
 *      (누적 템플릿 자동 채움 — 일차별 props 없을 때(대시보드) 사용. 도구 매출은 있을 때만 한 줄 추가)
 *  - canEdit: boolean        (작성·수정·삭제 노출. 기본 true — 대시보드 정합)
 *  - orders, eventStartDate, eventEndDate, productsMap  (L2 전용·선택)
 *      넷이 유효하면 "0. 판매" 블록을 일차별(누적+일차)로 만들고 "금액 업데이트" 버튼을 노출.
 *      없으면(대시보드) 현행 누적 템플릿 그대로.
 */
const FieldReportSection = ({
  eventId,
  eventName,
  revenueData,
  canEdit = true,
  orders,
  eventStartDate,
  eventEndDate,
  productsMap,
}) => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false); // 신규 작성(상단 입력칸)
  const [editingId, setEditingId] = useState(null); // 제자리 편집(카드 안)
  const [editContent, setEditContent] = useState('');
  const [editDayNumber, setEditDayNumber] = useState(1);
  const [editAuthor, setEditAuthor] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedDays, setExpandedDays] = useState(() => new Set()); // 기본 모두 접힘

  // 일차별 판매(누적+일차·금액 업데이트)는 L2 전용 props가 모두 있을 때만.
  const canPerDaySales = Array.isArray(orders) && !!eventStartDate;

  // 임시저장 — 신규 작성(creating)만 대상. 기존 보고서 수정분은 DB에 원본이 있어 제외.
  const isNewDraft = creating && !editingId;
  const validEventId = eventId && eventId !== 'all' ? eventId : null;
  const { draft, hasDraft, savedLabel, saveDraft, clearDraft } = useFormDraft(
    'fieldReport',
    validEventId,
    { enabled: canEdit && !!validEventId },
  );
  useEffect(() => {
    if (!isNewDraft) return;
    if (!editContent.trim() && !editAuthor.trim()) return;
    saveDraft({ content: editContent, dayNumber: editDayNumber, author: editAuthor });
  }, [isNewDraft, editContent, editDayNumber, editAuthor, saveDraft]);

  const fetchReports = useCallback(async () => {
    if (!eventId || eventId === 'all') {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_reports')
        .select('*')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error) setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // 보고서가 있는 일차만 그룹(오름차순). 한 일차 여러 건은 그룹 안에 모두.
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of reports) {
      const d = r.day_number || 1;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [reports]);

  const toggleDay = (d) => setExpandedDays((prev) => {
    const next = new Set(prev);
    if (next.has(d)) next.delete(d); else next.add(d);
    return next;
  });

  // "0. 판매" 블록 — 일차별 props 있으면 누적+일차, 없으면 누적만(현행 revenueData).
  const buildSales = useCallback((day) => {
    if (canPerDaySales) {
      return buildSalesBlock({ orders, dayNumber: day, startDate: eventStartDate, endDate: eventEndDate, productsMap });
    }
    const testRev = (revenueData?.testRevenue || 0).toLocaleString();
    const bookRev = (revenueData?.bookRevenue || 0).toLocaleString();
    const totalRev = (revenueData?.totalRevenue || 0).toLocaleString();
    const testShip = (revenueData?.testShipping || 0).toLocaleString();
    const bookShip = (revenueData?.bookShipping || 0).toLocaleString();
    const toolRevNum = revenueData?.toolRevenue || 0;
    const toolLine = toolRevNum > 0
      ? `\n도구 판매: ${toolRevNum.toLocaleString()}원 (배송비 ${(revenueData?.toolShipping || 0).toLocaleString()}원 포함)`
      : '';
    return `0. 판매\n검사 판매: ${testRev}원 (배송비 ${testShip}원 포함)\n도서 판매: ${bookRev}원 (배송비 ${bookShip}원 포함)${toolLine}\n합계: ${totalRev}원`;
  }, [canPerDaySales, orders, eventStartDate, eventEndDate, productsMap, revenueData]);

  const buildTemplate = useCallback((day) => (
    `${eventName || '전체'} 현장마케팅 보고드립니다.\n\n${buildSales(day)}\n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.`
  ), [eventName, buildSales]);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      // supabase-js는 실패해도 throw하지 않고 { error }를 돌려준다 — 직접 확인해야 실패를 성공으로 오인하지 않는다.
      const { error } = editingId
        ? await supabase.from('field_reports').update({
          content: editContent,
          day_number: editDayNumber,
          author_name: editAuthor,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId)
        : await supabase.from('field_reports').insert({
          event_id: eventId,
          content: editContent,
          day_number: editDayNumber,
          author_name: editAuthor,
        });
      if (error) throw error;
      if (!editingId) clearDraft();
      // 저장한 카드가 접힌 그룹에 숨지 않도록 그 일차 그룹을 펼친다(일차를 바꿔 저장한 경우 포함).
      setExpandedDays((prev) => new Set(prev).add(editDayNumber));
      setCreating(false); setEditingId(null); fetchReports();
    } catch (e) {
      console.error(e);
      addNotification('보고서 저장에 실패했어요. 입력한 내용은 그대로 남아 있어요.', 'error');
    }
    setSaving(false);
  };

  const handleCancel = () => { setCreating(false); setEditingId(null); };

  const handleEdit = (report) => {
    setCreating(false);
    setEditingId(report.id);
    setEditContent(report.content);
    setEditDayNumber(report.day_number || 1);
    setEditAuthor(report.author_name || '');
  };

  const handleDelete = (id) => { setDeleteTarget(id); };

  const handleDeleteConfirm = async () => {
    await supabase.from('field_reports').delete().eq('id', deleteTarget);
    setDeleteTarget(null);
    fetchReports();
  };

  const handleNew = () => {
    setEditingId(null);
    setEditContent(buildTemplate(1));
    setEditDayNumber(1);
    setEditAuthor('');
    setCreating(true);
  };

  const handleCopy = async (content) => {
    const ok = await copyToClipboard(content);
    addNotification(ok ? '보고서 내용을 복사했어요.' : '복사에 실패했어요.', ok ? 'success' : 'error');
  };

  // "0. 판매" 블록만 현재 매출로 교체. 편집 중이면 입력칸 값만, 저장된 카드면 바로 DB 저장.
  const handleUpdateSales = async (report, { editing } = {}) => {
    const block = buildSales(editing ? editDayNumber : (report.day_number || 1));
    const base = editing ? editContent : report.content;
    const next = replaceSalesBlock(base, block);
    if (next === null) {
      addNotification('"0. 판매" 블록을 찾지 못해 금액을 업데이트하지 못했어요.', 'warning');
      return;
    }
    if (editing) { setEditContent(next); return; }
    try {
      const { error } = await supabase.from('field_reports').update({ content: next, updated_at: new Date().toISOString() }).eq('id', report.id);
      if (error) throw error;
      fetchReports();
      addNotification('금액을 업데이트했어요.', 'success');
    } catch (e) {
      console.error(e);
      addNotification('금액 업데이트에 실패했어요.', 'error');
    }
  };

  const handleResumeDraft = () => {
    setEditingId(null);
    setEditContent(draft?.content || '');
    setEditDayNumber(draft?.dayNumber || 1);
    setEditAuthor(draft?.author || '');
    setCreating(true);
  };

  // 공용 편집 입력칸(신규=상단 / 제자리=카드 안). onUpdateSales 있으면 "금액 업데이트" 노출.
  const renderEditBox = ({ showDraftHint, onUpdateSales }) => (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ width: 100 }}>
          <InputLabel>일차</InputLabel>
          <Select value={editDayNumber} label="일차" onChange={e => setEditDayNumber(e.target.value)}>
            {[1, 2, 3, 4, 5].map(d => <MenuItem key={d} value={d}>{d}일차</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="작성자"
          value={editAuthor}
          onChange={e => setEditAuthor(e.target.value)}
          sx={{ width: 140 }}
        />
      </Box>
      <TextField
        fullWidth multiline minRows={5} maxRows={15}
        value={editContent}
        onChange={e => setEditContent(e.target.value)}
        sx={{ mb: 1.5 }}
      />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {showDraftHint && <DraftSavedHint savedLabel={savedLabel} sx={{ mr: 'auto' }} />}
        {onUpdateSales && (
          <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 16 }} />} onClick={onUpdateSales}>
            금액 업데이트
          </Button>
        )}
        <Button size="small" onClick={handleCancel}>취소</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !editContent.trim()}>
          {saving ? '저장중...' : '저장'}
        </Button>
      </Box>
    </Box>
  );

  if (!eventId || eventId === 'all') {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <ReportIcon sx={{ fontSize: 40, color: theme.gray[300], mb: 1 }} />
        <Typography variant="body2">특정 행사를 선택하면 보고서를 작성할 수 있습니다</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {!creating && canEdit && hasDraft && (
        <DraftBanner savedLabel={savedLabel} onResume={handleResumeDraft} onDiscard={clearDraft} />
      )}

      {!creating && canEdit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={handleNew} variant="outlined">
            보고서 작성
          </Button>
        </Box>
      )}

      {creating && (
        <Box sx={{ mb: 2, p: 2, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
          {renderEditBox({
            showDraftHint: true,
            onUpdateSales: canPerDaySales ? () => handleUpdateSales({}, { editing: true }) : null,
          })}
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          생성된 보고서가 없습니다
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groups.map(([day, dayReports]) => {
            const expanded = expandedDays.has(day);
            const dateLabel = eventStartDate ? ` (${dayDateLabel(eventStartDate, day)})` : '';
            return (
              <Box key={day} sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px`, overflow: 'hidden' }}>
                <ButtonBase
                  onClick={() => toggleDay(day)}
                  sx={{
                    width: '100%', minHeight: 44, px: 2, py: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    bgcolor: theme.gray[50], textAlign: 'left',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {day}일차{dateLabel}
                    {dayReports.length > 1 && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {dayReports.length}건
                      </Typography>
                    )}
                  </Typography>
                  <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </ButtonBase>
                <Collapse in={expanded} unmountOnExit>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 1.5 }}>
                    {dayReports.map((report) => (
                      <Box
                        key={report.id}
                        sx={{ p: 2, bgcolor: '#fff', borderRadius: `${theme.radii.sm}px`, border: `1px solid ${theme.gray[200]}` }}
                      >
                        {editingId === report.id ? (
                          renderEditBox({
                            showDraftHint: false,
                            onUpdateSales: canPerDaySales ? () => handleUpdateSales(report, { editing: true }) : null,
                          })
                        ) : (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                <Chip label={`${report.day_number || 1}일차`} size="small" sx={{ fontWeight: 700 }} />
                                {report.author_name && (
                                  <Typography variant="caption" color="text.secondary" noWrap>{report.author_name}</Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="복사">
                                  <IconButton size="small" onClick={() => handleCopy(report.content)} aria-label="복사">
                                    <CopyIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                {canEdit && canPerDaySales && (
                                  <Tooltip title="금액 업데이트">
                                    <IconButton size="small" onClick={() => handleUpdateSales(report)} aria-label="금액 업데이트">
                                      <RefreshIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {canEdit && (
                                  <>
                                    <IconButton size="small" onClick={() => handleEdit(report)} aria-label="편집">
                                      <EditIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(report.id)} aria-label="삭제">
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </>
                                )}
                              </Box>
                            </Box>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                              {report.content}
                            </Typography>
                          </>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>보고서 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2">이 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldReportSection;
