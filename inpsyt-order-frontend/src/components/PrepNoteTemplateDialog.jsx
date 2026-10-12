import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, List, ListItem, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  AutoAwesomeMotion as TemplateIcon,
} from '@mui/icons-material';
import { useNotification } from '../hooks/useNotification';
import {
  getPrepNoteTemplates, createPrepNoteTemplate, updatePrepNoteTemplate, deletePrepNoteTemplate,
} from '../api/events';
import { EmptyState } from './ui';

const PrepNoteEditor = lazy(() => import('./PrepNoteEditor'));

// 기본 준비노트 초안(출처: A12_PrepNoteTemplates.md §3 — 2026-06 백업 노트 5건 공통 구조).
// 템플릿 0개에서 "새 템플릿"을 누르면 이 마크다운이 미리 채워진 편집 뷰로 열린다(UI 1회 저장, §3-1).
// 마크다운 원문 — 에디터 markdown 모드로 열어 getHTML()이 Viewer 호환 HTML로 변환.
const DEFAULT_PREP_NOTE_MARKDOWN = `## 진행 정보
- 진행 시간:
- 문의처:

## 준비사항

### 차량 · 단말기
- [ ] 차량협조 — 셀토스 (165루 6845)
- [ ] 차량협조 — 소나타 (180허 3613)
- [ ] 단말기 — 인싸이트

### 도서
- [ ] 도서 요청 (수령 예정일 기재):

### 검사 및 물품

**① 공통**
- [ ] [지하 창고] 백월 · 멀티탭
- [ ] [지하 창고] 배너 (수가내역 · 이벤트)
- [ ] [지하 창고] 테이블보
- [ ] [지하 창고] 워크숍 가방
- [ ] [지하 창고] 쇼핑백
- [ ] [지하 창고] 메모지 (증정품)
- [ ] [지하 창고] 도서 카탈로그
- [ ] [학지사] 도서 (5층)
- [ ] [학지사] 도서 카탈로그 (마인드비 옆 창고)
- [ ] [사무실] 개인 명함
- [ ] [사무실] 아크릴 거치대
- [ ] [사무실] 주문서 QR 인쇄

**② 검사** (학회별로 다름 — 해당 학회 품목을 추가하세요)
- [ ]

## 사후 업무
- [ ] 출고 및 입금 담당자 전달
- [ ] 대여품 반납

## 첨부
일정 · 프로그램 브로셔, 부스 배치도 등은 각 학회 준비 노트에서 직접 삽입하세요.`;

const fmtDate = (iso) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');

const EditorFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} /></Box>
);

/**
 * 준비노트 템플릿 관리 모달(A12) — 단일 Dialog, "목록 ↔ 편집" 모드 스왑.
 * L2 개요 "읽기 요약 ↔ 편집" idiom과 동일(학습 비용 0 · 모달 중첩 회피).
 *
 * props:
 *  - open, onClose
 *  - onChanged: () => void  (CRUD 후 호출 — 부모가 "템플릿으로 시작" 노출용 목록 갱신)
 */
const PrepNoteTemplateDialog = ({ open, onClose, onChanged }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { addNotification } = useNotification();

  const [mode, setMode] = useState('list'); // 'list' | 'edit'
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // 편집 뷰 상태
  const [editId, setEditId] = useState(null); // null = 신규
  const [name, setName] = useState('');
  const [editorSeed, setEditorSeed] = useState('');
  const [editorType, setEditorType] = useState(undefined); // 'markdown' | undefined(기본 로직)
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const getHtmlRef = React.useRef(() => null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      setTemplates(await getPrepNoteTemplates());
    } catch {
      addNotification('템플릿 목록을 불러오지 못했어요.', 'error');
      setTemplates([]);
    }
    setLoading(false);
  };

  // 열릴 때 목록 뷰로 초기화 + 재조회
  useEffect(() => {
    if (!open) return;
    setMode('list');
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enterEdit = ({ id, nextName, seed, type }) => {
    setEditId(id);
    setName(nextName);
    setEditorSeed(seed);
    setEditorType(type);
    setEditorKey((k) => k + 1);
    getHtmlRef.current = () => null;
    setMode('edit');
  };

  // 새 템플릿 — 0개면 기본 준비노트 초안을 미리 채운 편집 뷰(건우님 확인 후 1회 저장), 1개 이상이면 빈 편집 뷰.
  const handleNew = () => {
    if (templates.length === 0) {
      enterEdit({ id: null, nextName: '기본 준비노트', seed: DEFAULT_PREP_NOTE_MARKDOWN, type: 'markdown' });
    } else {
      enterEdit({ id: null, nextName: '', seed: '', type: undefined });
    }
  };

  const handleEdit = (t) => {
    enterEdit({ id: t.id, nextName: t.name || '', seed: t.body_html || '', type: undefined });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addNotification('템플릿 이름을 입력해주세요.', 'warning');
      return;
    }
    const html = getHtmlRef.current();
    if (html === null) return; // 에디터 준비 전 — 본문 유실 방지(no-op)
    setSaving(true);
    try {
      if (editId == null) {
        await createPrepNoteTemplate({ name: name.trim(), body_html: html });
      } else {
        await updatePrepNoteTemplate(editId, { name: name.trim(), body_html: html });
      }
      addNotification('템플릿을 저장했습니다.', 'success');
      setMode('list');
      await loadTemplates();
      onChanged?.();
    } catch {
      addNotification('템플릿 저장에 실패했어요.', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`'${t.name}' 템플릿을 삭제할까요? 이미 적용한 준비 노트에는 영향이 없습니다.`)) return;
    try {
      await deletePrepNoteTemplate(t.id);
      addNotification('삭제되었습니다.', 'success');
      await loadTemplates();
      onChanged?.();
    } catch {
      addNotification('템플릿 삭제에 실패했어요.', 'error');
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      {mode === 'list' ? (
        <>
          <DialogTitle sx={{ fontWeight: 700 }}>준비노트 템플릿</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              여기서 만든 템플릿을 학회 준비 노트에서 꺼내 쓸 수 있어요. 템플릿을 고쳐도 이미 작성한 노트에는 영향이 없습니다.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>새 템플릿</Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} /></Box>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={TemplateIcon}
                title="등록된 템플릿이 없어요"
                description="자주 쓰는 준비 뼈대를 템플릿으로 만들어 두면 학회마다 꺼내 쓸 수 있어요"
                action={{ label: '새 템플릿', onClick: handleNew, startIcon: <AddIcon /> }}
              />
            ) : (
              <List sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px`, py: 0 }}>
                {templates.map((t, i) => (
                  <ListItem
                    key={t.id}
                    divider={i < templates.length - 1}
                    secondaryAction={(
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" aria-label="수정" onClick={() => handleEdit(t)} sx={{ color: 'text.secondary' }}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton size="small" aria-label="삭제" onClick={() => handleDelete(t)} sx={{ color: 'error.main' }}>
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    )}
                  >
                    <ListItemText
                      primary={t.name}
                      secondary={`수정 ${fmtDate(t.updated_at)}`}
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption', sx: { fontFeatureSettings: '"tnum" 1' } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button variant="outlined" onClick={handleClose}>닫기</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" variant="text" startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />} onClick={() => setMode('list')} disabled={saving} sx={{ color: 'text.secondary', ml: -1 }}>
              목록으로
            </Button>
          </DialogTitle>
          <DialogContent dividers>
            <TextField
              label="템플릿 이름"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 기본 준비노트"
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <Suspense fallback={<EditorFallback />}>
              <PrepNoteEditor
                key={editorKey}
                idPrefix="template"
                initialValue={editorSeed}
                initialEditType={editorType}
                disableImage
                onReady={(getHtml) => { getHtmlRef.current = getHtml; }}
                onImageError={(msg) => addNotification(msg, 'warning')}
              />
            </Suspense>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, display: 'block' }}>
              Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setMode('list')} disabled={saving}>취소</Button>
            <Button variant="contained" onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? '저장중...' : '저장'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default PrepNoteTemplateDialog;
