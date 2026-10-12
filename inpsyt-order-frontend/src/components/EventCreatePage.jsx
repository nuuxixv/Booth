import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Collapse, IconButton, Link, Divider, useTheme,
} from '@mui/material';
import {
  EventNote as EventNoteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { useSlugCheck } from '../hooks/useSlugCheck';
import { getSocieties } from '../api/events';
import { fetchProductCountByCategory } from '../api/products';
import {
  emptyEvent, applyAutofill, normalizeEventPayload, isRequiredComplete,
} from '../utils/eventForm';
import { PageHeader, SectionCard } from './ui';
import EventAutofillFields from './EventAutofillFields';
import EventRequiredFields from './EventRequiredFields';
import EventOptionalFields from './EventOptionalFields';

const EventCreatePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [form, setForm] = useState(emptyEvent);
  const [societies, setSocieties] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  // 점진 노출 래치 — 한 번 열리면 값이 지워져도 다시 닫지 않는다.
  const [showRequired, setShowRequired] = useState(false); // 1→2단계
  const [showOptional, setShowOptional] = useState(false); // 2→3단계
  // 직접입력 경로 — 자동조립 3필드를 숨긴다(노이즈 제거). "자동으로 행사명 만들기"로 복귀 가능.
  const [manualMode, setManualMode] = useState(false);

  const slugState = useSlugCheck(form.order_url_slug, {});

  const handleChange = (name, value) => {
    setForm((prev) => applyAutofill(prev, name, value, { societies, isEditing: false }));
  };

  // 새 목록으로 자동조립 slug가 즉시 생성되도록 fresh 목록을 명시 전달(부모 원자 처리).
  const handleSocietyAdded = (newSociety) => {
    const nextSocieties = [...societies, newSociety].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    setSocieties(nextSocieties);
    setForm((prev) => applyAutofill(prev, 'host_society', newSociety.name, { societies: nextSocieties, isEditing: false }));
  };

  // 진입 1회 로드 — 주최 학회·참석자 후보·판매 대분류 카운트. 실패해도 생성은 진행.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [soc, staffRes] = await Promise.all([
        getSocieties().catch(() => []),
        supabase
          .from('user_profiles')
          .select('id, name, role, position, department')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      setSocieties(soc || []);
      if (!staffRes.error) setStaff(staffRes.data || []);
      setLoading(false);
    })();
    fetchProductCountByCategory()
      .then((c) => { if (!cancelled) setCategoryCounts(c); })
      .catch(() => { if (!cancelled) setCategoryCounts({}); });
    return () => { cancelled = true; };
  }, []);

  // 1→2단계: 자동조립 3필드가 모두 채워지면 필수 영역 노출(래치).
  const autofillComplete = Boolean(form.event_year && form.host_society && form.event_season);
  useEffect(() => { if (autofillComplete) setShowRequired(true); }, [autofillComplete]);

  const requiredOk = isRequiredComplete(form);
  // 2→3단계: 필수 4개가 모두 유효하면 선택 항목 블록 노출(래치).
  useEffect(() => { if (requiredOk) setShowOptional(true); }, [requiredOk]);

  const canSubmit = requiredOk && slugState.isAvailable && !saving;

  let disableReason = '';
  if (!canSubmit && !saving) {
    if (!form.name) disableReason = '행사명을 입력하세요.';
    else if (!form.order_url_slug) disableReason = '주문 URL을 입력하세요.';
    else if (slugState.formatBad) disableReason = '주문 URL 형식을 확인하세요.';
    else if (slugState.reserved) disableReason = "'new'는 사용할 수 없는 주소입니다.";
    else if (!form.start_date || !form.end_date) disableReason = '행사 기간을 선택하세요.';
    else if (!form.estimated_delivery_date) disableReason = '배송 예정일을 선택하세요.';
    else if (slugState.isBusy) disableReason = '주문 URL 중복 확인 중입니다.';
    else if (slugState.taken) disableReason = '이미 사용중인 주문 URL입니다.';
    else if (slugState.error) disableReason = '주문 URL 중복 검사에 실패했습니다. 다시 시도하세요.';
  }

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const payload = normalizeEventPayload(form);
    const { error } = await supabase.from('events').insert([payload]);
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
      setSaving(false);
    } else {
      addNotification('행사가 만들어졌습니다.', 'success');
      navigate(`/admin/events/${form.order_url_slug}`);
    }
  };

  const handleCancel = () => navigate('/admin/events');

  return (
    <Box>
      <PageHeader
        title="새 행사 만들기"
        icon={EventNoteIcon}
        action={
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            필수 4개만 채우면 완료
          </Typography>
        }
      />

      {/* 블록 1 — 「행사 정보」: 자동조립 3필드 + 필수 4필드 통합, 점진 노출 */}
      <SectionCard title="행사 정보" sx={{ mb: 2 }}>
        {!manualMode && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            아래 3가지를 고르면 행사명이 자동으로 만들어집니다.
          </Typography>
        )}

        {/* 1단계 — 연도 · 주최 학회 · 행사 구분 (자동조립 경로에서만 표시) */}
        {!manualMode && (
          <EventAutofillFields
            form={form}
            onChange={handleChange}
            societies={societies}
            onSocietyAdded={handleSocietyAdded}
            disabled={loading}
          />
        )}

        {/* 직접입력 경로 복귀 링크 — 자동조립을 다시 쓰고 싶을 때(유일한 자동조립 경로 상실 방지) */}
        {manualMode && (
          <Box sx={{ mb: 1 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => setManualMode(false)}
              sx={{ color: 'primary.main' }}
            >
              자동으로 행사명 만들기
            </Link>
          </Box>
        )}

        {!showRequired && (
          <Box sx={{ mt: 2 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => { setManualMode(true); setShowRequired(true); }}
              sx={{ color: 'primary.main' }}
            >
              행사명을 직접 입력할래요
            </Link>
          </Box>
        )}

        {showRequired && <Divider sx={{ my: 3 }} />}

        {/* 2단계 — 필수 4필드 2×2 (행사명·주문URL / 행사기간·배송예정일) */}
        <Box aria-live="polite">
          {showRequired && (
            <EventRequiredFields form={form} onChange={handleChange} slugState={slugState} />
          )}
        </Box>
      </SectionCard>

      {/* 블록 2 — 선택 항목 8개: 필수 4개 충족 후 노출, 접힘 헤더 */}
      <Box aria-live="polite">
        {showOptional && (
          <SectionCard padding={0} sx={{ mb: 2 }}>
            <Box
              onClick={() => setOptionalOpen((v) => !v)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: theme.gray[50] },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ color: 'text.primary', lineHeight: 1.3 }}>
                  선택 항목 8개
                </Typography>
              </Box>
              <IconButton size="small" aria-label={optionalOpen ? '선택 항목 접기' : '선택 항목 펼치기'}>
                {optionalOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={optionalOpen} unmountOnExit>
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <EventOptionalFields form={form} onChange={handleChange} staff={staff} categoryCounts={categoryCounts} />
              </Box>
            </Collapse>
          </SectionCard>
        )}
      </Box>

      {/* 하단 액션 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        {disableReason && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {disableReason}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleCancel} disabled={saving}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canSubmit}>
            행사 만들기
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default EventCreatePage;
