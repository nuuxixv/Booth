import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  InputAdornment,
  Select,
  MenuItem,
  Divider,
  FormControl,
  FormLabel,
  FormControlLabel,
  RadioGroup,
  Radio,
  InputLabel,
  Switch,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  QrCode2 as QrCodeIcon,
  Info as InfoIcon,
  Event as EventIcon,
  LocalShipping as ShippingIcon,
  WarningAmberRounded as WarningIcon,
  Payments as PaymentsIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { PageHeader, SectionCard, ActionSlot, InfoRow } from './ui';
import { sortEventsForDropdown, groupEventsForDropdown, formatEventStartDate } from '../utils/eventSort';
import { DEFAULT_VOUCHER_CONFIG, MAX_VOUCHER_DIGITS, normalizeVoucherConfig } from '../utils/voucherConfig';

// 이벤트 결제수단 설정 검증(A13 §①) — 저장 가능하면 null, 아니면 오류 문구. 숫자 버튼은 추가 시
// 이미 1~99 정수·중복 제거되므로 여기선 개수만 본다. 단위는 편집 중 빈 값이 가능해 값까지 본다.
const validateVoucherConfig = (cfg) => {
  const label = (cfg.label || '').trim();
  if (label.length < 1 || label.length > 10) return '용어는 1~10자로 입력하세요.';
  if (!cfg.digits?.length) return '숫자 버튼을 1개 이상 추가하세요.';
  if (cfg.digits.length > MAX_VOUCHER_DIGITS) return `숫자 버튼은 최대 ${MAX_VOUCHER_DIGITS}개까지예요.`;
  if (!cfg.units?.length) return '단위 버튼을 1개 이상 추가하세요.';
  for (const u of cfg.units) {
    const ul = (u.label || '').trim();
    if (ul.length < 1 || ul.length > 4) return '단위 라벨은 1~4자로 입력하세요.';
    const v = Number(u.value);
    if (!Number.isInteger(v) || v <= 0) return '단위 금액은 0보다 큰 정수로 입력하세요.';
  }
  return null;
};

// 사양 §발견 2: 리다이렉트 베이스는 VITE_APP_URL 우선, 없으면 현재 origin.
const APP_BASE_URL = import.meta.env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const REDIRECT_URL = `${APP_BASE_URL}/go`;

// 시스템 정보 — 빌드와 실제로 연동되는 환경 모드만 노출 (가짜 정적값 제거).
const APP_ENV = (import.meta.env?.MODE === 'production') ? 'production' : (import.meta.env?.MODE || 'development');

const SettingsPage = () => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
    active_event_slug: '',
    // 무료배송 판정 기준: 'list_price'(정가) | 'discounted'(할인가). 기본·폴백 = 정가(현행 동작).
    free_shipping_basis: 'list_price',
  });
  // 사양 §핵심 발견 1: active_event_slug 마이그레이션 누락 감지.
  // fetchSettings에서 select 결과에 컬럼이 없으면 true.
  const [activeSlugMissing, setActiveSlugMissing] = useState(false);
  // 이벤트 결제수단(바우처) 설정(A13 §①) — NULL·컬럼 미적용이면 기본값(normalizeVoucherConfig).
  const [voucherConfig, setVoucherConfig] = useState(() => normalizeVoucherConfig(DEFAULT_VOUCHER_CONFIG));
  const [digitInput, setDigitInput] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, order_url_slug, start_date')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setEvents(sortEventsForDropdown(data));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          free_shipping_threshold: data.free_shipping_threshold,
          shipping_cost: data.shipping_cost,
          active_event_slug: data.active_event_slug || '',
          // 컬럼 미적용 환경에선 응답에 키가 없어 undefined → 정가 폴백(graceful).
          free_shipping_basis: data.free_shipping_basis || 'list_price',
        });
        // 사양 §핵심 발견 1: 컬럼 자체가 응답에 없으면 운영 DB 마이그레이션 누락.
        setActiveSlugMissing(!Object.prototype.hasOwnProperty.call(data, 'active_event_slug'));
        // 컬럼 미적용이면 data.voucher_config 자체가 없어 undefined → 기본값(graceful).
        setVoucherConfig(normalizeVoucherConfig(data.voucher_config));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      addNotification('설정 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        free_shipping_threshold: parseInt(settings.free_shipping_threshold, 10),
        shipping_cost: parseInt(settings.shipping_cost, 10),
        active_event_slug: settings.active_event_slug || null,
        free_shipping_basis: settings.free_shipping_basis || 'list_price',
        voucher_config: normalizeVoucherConfig(voucherConfig),
        updated_at: new Date().toISOString(),
      };
      const save = (body) => supabase.from('site_settings').update(body).eq('id', 1);
      let { error } = await save(payload);
      // 가법 컬럼(free_shipping_basis·voucher_config) 미적용 환경 graceful — PGRST204(스키마 캐시에
      // 컬럼 없음) 시 오류 메시지가 가리키는 키만 빼고 재시도한다(ProductManagementPage 패턴 확장).
      while (error && error.code === 'PGRST204') {
        const missing = ['voucher_config', 'free_shipping_basis'].find(
          (k) => k in payload && error.message?.includes(k),
        );
        if (!missing) break;
        delete payload[missing];
        ({ error } = await save(payload));
      }

      if (error) throw error;
      addNotification('설정이 성공적으로 저장되었습니다.', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      addNotification(`설정 저장 실패: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(REDIRECT_URL);
    addNotification('URL이 클립보드에 복사되었습니다.', 'success');
  };

  const handleQrDownload = async () => {
    try {
      const svgStr = await QRCode.toString(REDIRECT_URL, {
        type: 'svg',
        color: { dark: '#252525', light: '#FFFFFF' },
        margin: 1,
        width: 300,
      });
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-inpsytorder-go.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification('QR 코드가 다운로드되었습니다.', 'success');
    } catch (err) {
      console.error('QR generation error:', err);
      addNotification('QR 코드 생성에 실패했습니다.', 'error');
    }
  };

  // 이벤트 결제수단 — 숫자 버튼 추가(1~99 정수·중복 불가·오름차순·최대 5개).
  const digitsFull = voucherConfig.digits.length >= MAX_VOUCHER_DIGITS;
  const addDigit = () => {
    if (digitsFull) return;
    const n = parseInt(digitInput, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return;
    setDigitInput('');
    if (voucherConfig.digits.includes(n)) return;
    setVoucherConfig({ ...voucherConfig, digits: [...voucherConfig.digits, n].sort((a, b) => a - b) });
  };
  const removeDigit = (d) =>
    setVoucherConfig({ ...voucherConfig, digits: voucherConfig.digits.filter((x) => x !== d) });
  const addUnit = () =>
    setVoucherConfig({ ...voucherConfig, units: [...voucherConfig.units, { label: '', value: '' }] });
  const removeUnit = (idx) =>
    setVoucherConfig({ ...voucherConfig, units: voucherConfig.units.filter((_, i) => i !== idx) });
  const updateUnit = (idx, key, value) =>
    setVoucherConfig({
      ...voucherConfig,
      units: voucherConfig.units.map((u, i) => (i === idx ? { ...u, [key]: value } : u)),
    });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeEventName = events.find((e) => e.order_url_slug === settings.active_event_slug)?.name;
  const threshold = parseInt(settings.free_shipping_threshold, 10) || 0;
  const shipping = parseInt(settings.shipping_cost, 10) || 0;
  const voucherError = validateVoucherConfig(voucherConfig);

  return (
    <Box>
      <PageHeader
        title="설정"
        subtitle="리다이렉트 학회 · 배송비 · 시스템 정보"
        icon={SettingsIcon}
      />

      {/* 블록 1 — 리다이렉트 학회 관리 */}
      <SectionCard
        title="리다이렉트 학회 관리"
        subtitle="/go 경로로 접속 시 자동으로 이동할 학회를 설정합니다. QR 코드를 인쇄물에 활용할 수 있습니다."
        icon={EventIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="active-event-label">활성 학회 선택</InputLabel>
            <Select
              labelId="active-event-label"
              value={settings.active_event_slug}
              label="활성 학회 선택"
              onChange={(e) => setSettings({ ...settings, active_event_slug: e.target.value })}
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  선택 안 함 (비활성)
                </Typography>
              </MenuItem>
              {(() => {
                const { pinned, rest } = groupEventsForDropdown(events);
                const renderItem = (event) => (
                  <MenuItem key={event.id} value={event.order_url_slug}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {event.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled' }}
                      >
                        {formatEventStartDate(event.start_date) || '시작일 미정'}
                      </Typography>
                    </Box>
                  </MenuItem>
                );
                return [
                  ...pinned.map(renderItem),
                  pinned.length > 0 && rest.length > 0 && <Divider key="event-group-divider" />,
                  ...rest.map(renderItem),
                ];
              })()}
            </Select>
          </FormControl>

          {/* URL 안내 카드 — 시안 답습 */}
          <Box
            sx={{
              p: 2,
              borderRadius: `${theme.radii.md}px`,
              bgcolor: theme.gray[50],
              border: `1px solid ${theme.gray[200]}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <QrCodeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                리다이렉트 URL
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                wordBreak: 'break-all',
                mb: 0.5,
              }}
            >
              {REDIRECT_URL}
            </Typography>
            {settings.active_event_slug ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {activeEventName ? `${activeEventName} 주문 페이지로 자동 이동` : '활성 학회 주문 페이지로 자동 이동'}
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                활성 학회 미설정 — /go 진입 시 안내 화면
              </Typography>
            )}

            <ActionSlot justify="flex-start" sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CopyIcon sx={{ fontSize: 16 }} />}
                onClick={handleCopyUrl}
                sx={{ minHeight: 36 }}
              >
                URL 복사
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={handleQrDownload}
                sx={{ minHeight: 36 }}
              >
                QR 다운로드 (SVG)
              </Button>
            </ActionSlot>
          </Box>

          {/* 사양 §핵심 발견 1: active_event_slug 마이그레이션 누락 감지 시 노출 */}
          {activeSlugMissing && (
            <Alert
              severity="warning"
              icon={<WarningIcon sx={{ fontSize: 18 }} />}
              sx={{ borderRadius: `${theme.radii.md}px`, py: 0.75 }}
            >
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, display: 'block' }}>
                잠재 부채: active_event_slug 컬럼 마이그레이션 누락
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                현재 환경의 site_settings 응답에 컬럼이 없습니다. 신규 환경 부트스트랩 시 진입 실패 가능 — supabase/migrations에 ALTER 추가 필요.
              </Typography>
            </Alert>
          )}
        </Box>
      </SectionCard>

      {/* 블록 2 — 배송비 정책 */}
      <SectionCard
        title="배송비 정책"
        subtitle="주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다."
        icon={ShippingIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="무료 배송 기준 금액"
            type="number"
            value={settings.free_shipping_threshold}
            onChange={(e) => setSettings({ ...settings, free_shipping_threshold: e.target.value })}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
            helperText="이 금액 이상 구매 시 배송비가 0원이 됩니다."
          />
          <TextField
            size="small"
            fullWidth
            label="배송비"
            type="number"
            value={settings.shipping_cost}
            onChange={(e) => setSettings({ ...settings, shipping_cost: e.target.value })}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
            helperText="기준 금액 미만 구매 시 부과되는 배송비입니다."
          />

          {/* 정책 요약 — 시안 답습. 입력값 즉시 반영 미리보기. */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}
            >
              현재 정책 요약
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.primary', lineHeight: 1.6, fontFeatureSettings: '"tnum" 1' }}
            >
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {threshold.toLocaleString()}원
              </Box>
              {' 이상 구매 시 무료 · 미만 구매 시 '}
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {shipping.toLocaleString()}원
              </Box>
              {' 부과'}
            </Typography>
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* 무료배송 적용 방식 — 정가/할인가 기준 라디오. 기본·폴백 = 정가(현행 동작). */}
          <FormControl>
            <FormLabel
              sx={{
                ...theme.typography.subtitle2,
                color: 'text.primary',
                fontWeight: 700,
                mb: 1,
                '&.Mui-focused': { color: 'text.primary' },
              }}
            >
              무료배송 적용 방식
            </FormLabel>
            <RadioGroup
              value={settings.free_shipping_basis || 'list_price'}
              onChange={(e) => setSettings({ ...settings, free_shipping_basis: e.target.value })}
            >
              <Box sx={{ mb: 1 }}>
                <FormControlLabel
                  value="list_price"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      정가 기준 <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>(기본)</Box>
                    </Typography>
                  }
                />
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', pl: 3.75 }}>
                  할인 전 금액이 {threshold.toLocaleString()}원 이상이면 무료배송
                </Typography>
              </Box>
              <Box>
                <FormControlLabel
                  value="discounted"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      할인가 기준
                    </Typography>
                  }
                />
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', pl: 3.75 }}>
                  실제 결제 금액이 {threshold.toLocaleString()}원 이상이면 무료배송
                </Typography>
              </Box>
            </RadioGroup>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1 }}>
              변경 즉시 새 주문부터 적용됩니다. 기존 주문의 배송비는 바뀌지 않습니다.
            </Typography>
          </FormControl>

          <Divider sx={{ my: 0.5 }} />

          {/* 이벤트 결제 시 배송비 면제 노출 — 저장은 voucher_config.shippingWaiverEnabled(A13 §①). 기본 꺼짐. */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={voucherConfig.shippingWaiverEnabled}
                  onChange={(e) => setVoucherConfig({ ...voucherConfig, shippingWaiverEnabled: e.target.checked })}
                />
              }
              label={<Typography variant="subtitle2">이벤트 결제 시 배송비 면제 사용</Typography>}
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', pl: 5.75 }}>
              켜면 이벤트 적용 학회의 결제완료 창에 배송비 면제 스위치가 보입니다.
            </Typography>
          </Box>
        </Box>
      </SectionCard>

      {/* 블록 2.5 — 이벤트 결제수단 (A13 §①) */}
      <SectionCard
        title="이벤트 결제수단"
        subtitle="이벤트 적용 학회에서 결제완료 처리 시 쓰는 결제수단과 금액 버튼입니다."
        icon={PaymentsIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {/* 용어 */}
          <TextField
            size="small"
            fullWidth
            label="용어"
            value={voucherConfig.label}
            onChange={(e) => setVoucherConfig({ ...voucherConfig, label: e.target.value })}
            inputProps={{ maxLength: 10 }}
            helperText="결제완료 창·고객 안내·입금결의서에 표시됩니다."
          />

          {/* 숫자 버튼 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              숫자 버튼
            </Typography>
            {voucherConfig.digits.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                {voucherConfig.digits.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    onDelete={() => removeDigit(d)}
                    sx={{ borderRadius: `${theme.radii.sm}px` }}
                  />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                size="small"
                type="number"
                placeholder="숫자 (1~99)"
                value={digitInput}
                onChange={(e) => setDigitInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDigit(); } }}
                inputProps={{ min: 1, max: 99, inputMode: 'numeric' }}
                disabled={digitsFull}
                sx={{ width: 140 }}
              />
              <Button variant="outlined" onClick={addDigit} disabled={digitsFull} sx={{ minHeight: 40 }}>추가</Button>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              최대 {MAX_VOUCHER_DIGITS}개까지 추가할 수 있어요.
            </Typography>
          </Box>

          {/* 단위 버튼 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              단위 버튼
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {voucherConfig.units.map((u, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="라벨"
                    value={u.label}
                    onChange={(e) => updateUnit(i, 'label', e.target.value)}
                    inputProps={{ maxLength: 4 }}
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="금액"
                    type="number"
                    value={u.value}
                    onChange={(e) => updateUnit(i, 'value', e.target.value)}
                    inputProps={{ min: 1, inputMode: 'numeric' }}
                    InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
                    sx={{ flex: 1 }}
                  />
                  <IconButton onClick={() => removeUnit(i)} aria-label="단위 삭제" sx={{ color: 'text.secondary' }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              ))}
              <Button
                variant="text"
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                onClick={addUnit}
                sx={{ alignSelf: 'flex-start', color: 'text.secondary', minHeight: 36 }}
              >
                단위 추가
              </Button>
            </Box>
          </Box>

          {/* 미리보기 — 결제완료 창에 보일 숫자·단위 버튼 줄(누르기 불가) */}
          <Box sx={{ p: 1.5, borderRadius: `${theme.radii.md}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}` }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontWeight: 600 }}>
              미리보기 — 결제완료 창
            </Typography>
            {/* 결제완료 창과 같은 배치 — 숫자 줄 5칸 고정, 단위 줄은 단위 개수로 나눠 넓게. */}
            <Box sx={{ maxWidth: 360 }}>
              {voucherConfig.digits.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${MAX_VOUCHER_DIGITS}, 1fr)`, gap: 0.75, mb: 0.75 }}>
                  {voucherConfig.digits.map((d) => (
                    <Chip key={d} label={d} variant="outlined" disabled sx={{ borderRadius: `${theme.radii.sm}px` }} />
                  ))}
                </Box>
              )}
              {voucherConfig.units.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${voucherConfig.units.length}, 1fr)`, gap: 0.75 }}>
                  {voucherConfig.units.map((u, i) => (
                    <Chip key={i} label={u.label || '?'} variant="outlined" disabled sx={{ borderRadius: `${theme.radii.sm}px` }} />
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {voucherError && (
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {voucherError}
            </Typography>
          )}
        </Box>
      </SectionCard>

      {/* 블록 3 — 시스템 정보 (시안 답습, readonly 노출) */}
      <SectionCard
        title="시스템 정보"
        subtitle="현재 환경의 빌드 정보입니다."
        icon={InfoIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ mt: 1 }}>
          <InfoRow
            label="환경"
            value={
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: `${theme.radii.sm}px`,
                  bgcolor: alpha(
                    APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                    0.1,
                  ),
                  border: `1px solid ${alpha(
                    APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                    0.25,
                  )}`,
                  color: APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                  ...theme.typography.caption,
                  fontWeight: 700,
                }}
              >
                {APP_ENV}
              </Box>
            }
          />
        </Box>
      </SectionCard>

      {/* 안내 Alert — 사양 §하단 안내 */}
      <Alert
        severity="info"
        icon={<InfoIcon sx={{ fontSize: 18 }} />}
        sx={{ borderRadius: `${theme.radii.md}px`, mb: 3 }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary' }}>
          설정 변경 사항은 즉시 적용됩니다. (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)
        </Typography>
      </Alert>

      {/* 액션 — 사양 §블록 3 */}
      <ActionSlot>
        <Button
          variant="outlined"
          onClick={fetchSettings}
          disabled={saving}
          sx={{ minHeight: 44 }}
        >
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || Boolean(voucherError)}
          sx={{ minHeight: 44, fontWeight: 700 }}
        >
          {saving ? <CircularProgress size={20} /> : '저장하기'}
        </Button>
      </ActionSlot>
    </Box>
  );
};

export default SettingsPage;
