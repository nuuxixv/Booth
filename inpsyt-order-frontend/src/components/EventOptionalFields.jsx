import React, { useState } from 'react';
import {
  Box, Typography, TextField, Chip, Autocomplete, Checkbox, ListItemText, InputAdornment,
  Button, Modal, useTheme,
} from '@mui/material';
import {
  PlaceOutlined as PlaceIcon,
  Search as SearchIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import DaumPostcode from 'react-daum-postcode';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { copyToClipboard } from '../utils/eventUrl';
import { useNotification } from '../hooks/useNotification';
import { VISIBLE_CATEGORY_OPTIONS, rateToPercent, percentToRate } from '../utils/eventForm';

/**
 * 행사 선택 8그룹(판매대분류·할인율·설치/철거 시간·장소 3분리·참가비용·참석자·비고) — 생성 페이지·L2 편집 공용.
 * 2026-10-12 학회 개선 트랙 2차: 설치 시간·철거 시간 자유 텍스트 2칸 + 장소 3입력(장소명·주소·홀/층 상세).
 *   - 주소는 읽기전용 + "주소 검색"(react-daum-postcode) — 도로명 주소만 저장(우편번호·좌표 미저장).
 *   - 입력 폼에는 주소 복사 버튼만 둔다(지도 버튼은 읽기 화면 L2 개요에만 — A11 §장소 보조 액션).
 *
 * props:
 *  - form, onChange(name, value)
 *  - staff: [{ id, name, department, ... }] 참석자 후보(master/onsite)
 *  - categoryCounts: { 검사: N, 도서: M, 도구: K } | null (실 집계 미리보기)
 */
const EventOptionalFields = ({ form, onChange, staff = [], categoryCounts }) => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const cats = form?.visible_categories || [];
  const costNum = form?.marketing_cost ? Number(form.marketing_cost) : 0;
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const selectedAttendees = (form?.attendee_ids || []).map((id) => staffById[id]).filter(Boolean);

  // 기존 venue만 있는(백필된) 학회 — 주소가 아직 비어 있으면 정리 안내.
  const isLegacyVenue = Boolean(form?.venue && !form?.venue_address);

  // 다음 우편번호 완료 — 도로명 주소만 저장. 건물명은 장소명이 비어 있을 때만 자동 채움.
  const handleAddressComplete = (data) => {
    onChange('venue_address', data.roadAddress || '');
    if (!form?.venue_name && data.buildingName) onChange('venue_name', data.buildingName);
    setPostcodeOpen(false);
  };

  const handleCopyAddress = async () => {
    if (!form?.venue_address) return;
    const ok = await copyToClipboard(form.venue_address);
    addNotification(ok ? '주소를 복사했어요' : '주소 복사에 실패했어요', ok ? 'success' : 'error');
  };

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 480,
    bgcolor: 'background.paper',
    boxShadow: theme.customShadows.lg,
    borderRadius: `${theme.radii.lg}px`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 1행 — 판매 대분류 · 할인율 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* 판매 대분류 — 고객 주문서 노출 필터(검사/도서/도구 다중 토글) */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
            판매 대분류
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {VISIBLE_CATEGORY_OPTIONS.map((cat) => {
              const selected = cats.includes(cat);
              return (
                <Chip
                  key={cat}
                  label={cat}
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'primary' : 'default'}
                  onClick={() =>
                    onChange('visible_categories', selected ? cats.filter((c) => c !== cat) : [...cats, cat])}
                  sx={{ fontWeight: selected ? 700 : 500, borderRadius: `${theme.radii.sm}px` }}
                />
              );
            })}
          </Box>
          {cats.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              선택하지 않으면 전체 상품이 노출됩니다.
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              선택한 대분류 상품만 이 행사의 주문서에 노출됩니다.
              {categoryCounts && (() => {
                const parts = cats.map((c) => `${c} ${categoryCounts[c] ?? 0}개`);
                const total = cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0);
                return ` 노출 대상: ${parts.join(' · ')} (총 ${total}개)`;
              })()}
            </Typography>
          )}
        </Box>

        <TextField
          label="할인율 (%)"
          type="number"
          fullWidth
          value={rateToPercent(form?.discount_rate)}
          onChange={(e) => onChange('discount_rate', percentToRate(e.target.value))}
          inputProps={{ step: '1', min: '0', max: '100' }}
          InputLabelProps={{ shrink: true }}
          helperText="예: 15 = 15% 할인"
        />
      </Box>

      {/* 2행 — 설치 시간 · 철거 시간 (자유 텍스트, 피커 금지 — 모호 표현 수용) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <TextField
          label="설치 시간"
          fullWidth
          value={form?.setup_time || ''}
          onChange={(e) => onChange('setup_time', e.target.value)}
          placeholder="예: 4/15(수) 21시~23시, 당일 07:30 쯤"
          helperText="날짜·시간을 자유롭게 적으세요(모호한 표현도 OK)."
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="철거 시간"
          fullWidth
          value={form?.teardown_time || ''}
          onChange={(e) => onChange('teardown_time', e.target.value)}
          placeholder="예: 둘째 날 13시 이후, 종료 직후"
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* 3행 — 장소 (전폭 그룹, 3입력 분리 저장). 도로명+상세 통합 금지. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          label="장소명"
          fullWidth
          value={form?.venue_name || ''}
          onChange={(e) => onChange('venue_name', e.target.value)}
          placeholder="예) 서울 코엑스 / 그랜드볼룸"
          helperText={isLegacyVenue ? '예전 장소 정보가 장소명에 들어가 있어요. 주소 검색으로 정리할 수 있습니다.' : undefined}
          InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
          InputLabelProps={{ shrink: true }}
        />

        <Box>
          <TextField
            label="주소"
            fullWidth
            value={form?.venue_address || ''}
            onClick={() => setPostcodeOpen(true)}
            placeholder="주소 검색을 눌러 도로명 주소를 선택하세요"
            InputProps={{
              readOnly: true,
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setPostcodeOpen(true); }} sx={{ minHeight: 32 }}>
                    주소 검색
                  </Button>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiOutlinedInput-root': { cursor: 'pointer' }, '& input': { cursor: 'pointer' } }}
          />
          {form?.venue_address && (
            <Button
              size="small"
              variant="text"
              startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
              onClick={handleCopyAddress}
              sx={{ mt: 0.5, color: 'text.secondary', minHeight: 32 }}
            >
              주소 복사
            </Button>
          )}
        </Box>

        <TextField
          label="홀·층 상세"
          fullWidth
          value={form?.venue_detail || ''}
          onChange={(e) => onChange('venue_detail', e.target.value)}
          placeholder="예) 3층 그랜드볼룸 A홀, 부스 B-12"
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* 4행 — 참가비용 (좌 반폭) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box>
          <TextField
            label="참가비용 (원)"
            fullWidth
            value={costNum ? costNum.toLocaleString('ko-KR') : ''}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              onChange('marketing_cost', digits === '' ? null : Number(digits));
            }}
            placeholder="0"
            inputProps={{ inputMode: 'numeric' }}
            InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            InputLabelProps={{ shrink: true }}
          />
          {costNum > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 1.75, display: 'block' }}>
              {numberToKoreanCurrency(costNum)}원
            </Typography>
          )}
        </Box>
      </Box>

      {/* 5행 — 참석자 (전폭). 후보 = user_profiles role IN (master, onsite) */}
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={staff}
        value={selectedAttendees}
        onChange={(_, v) => onChange('attendee_ids', v.map((o) => o.id))}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderOption={(props, option, { selected }) => (
          <li {...props} key={option.id}>
            <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
            <ListItemText
              primary={option.name}
              secondary={option.department || ''}
              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </li>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              label={option.name}
              size="small"
              variant="outlined"
              sx={{ borderColor: theme.gray[300] }}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="참석자"
            placeholder={selectedAttendees.length ? '' : '현장 담당자 선택'}
            InputLabelProps={{ shrink: true }}
            helperText="현장 마케팅 · 마스터 중 선택"
          />
        )}
      />

      {/* 6행 — 비고 (전폭) */}
      <TextField
        label="비고"
        fullWidth
        multiline
        minRows={2}
        value={form?.note || ''}
        onChange={(e) => onChange('note', e.target.value)}
        placeholder="부스 위치, 진열 메모 등"
        InputLabelProps={{ shrink: true }}
      />

      {/* 주소 검색 모달 — CustomerInfoStep 선례 재사용 */}
      <Modal open={postcodeOpen} onClose={() => setPostcodeOpen(false)}>
        <Box sx={modalStyle}>
          <DaumPostcode onComplete={handleAddressComplete} style={{ height: '60vh' }} />
        </Box>
      </Modal>
    </Box>
  );
};

export default EventOptionalFields;
