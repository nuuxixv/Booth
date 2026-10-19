import React, { useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, Checkbox, Divider, Tooltip, IconButton, Switch,
  ToggleButton, ToggleButtonGroup, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Pagination, FormControl, InputLabel, Select, MenuItem, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Inventory2 as Inventory2Icon,
  Inventory as InventoryIcon,
  RestartAlt as RestartAltIcon,
  AccountTree as AccountTreeIcon,
  LocalOffer as TagIcon,
  Science as ScienceIcon,
  MenuBook as MenuBookIcon,
  Build as BuildIcon,
  HelpOutline as HelpOutlineIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Tune as TuneIcon,
  CheckBox as CheckBoxIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, ActionSlot, EmptyState } from './ui';
import ProductSearchBar from './ProductSearchBar';
import { MASTER_COLOR_FALLBACK } from '../constants/categoryColors';
import { rateToPercentNullable } from '../utils/pricing';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/product-filters.
 * A6 §필터 바 재설계(2026-10-19) 시안 — 단일값 productQuickFilter 카드 폐지,
 * 속성별 패싯 필터(카테고리·할인여부·개별할인·인기·신상품·이미지 등록·온라인코드 각 단일선택, 속성 간 AND)
 * + 태그(학회 ∪ 자유 태그) 체크박스 다중(OR). 옵션별 건수 미표시, "N개 표시 중" 합계만.
 * 실 ProductManagementPage.jsx는 미변경 — 이 파일은 필터 바만 떼어낸 미리보기.
 */

// ─── 학회 목록(societies.name 일부) + 자유 태그 ───────────────────
// 학회명을 앞쪽, 자유 태그를 뒤쪽에 정렬(§필터 바 태그 소스 규약).
const SOCIETY_TAGS = [
  'TEST',
  '대한개발자협회',
  '대한소아신경학회',
  '대한신경정신의학회',
  '오티즘',
  '한국심리학회',
];
const FREE_TAGS = ['아동·청소년', '임상', '신간'];
const TAG_OPTIONS = [...SOCIETY_TAGS, ...FREE_TAGS];
const SOCIETY_SET = new Set(SOCIETY_TAGS);

// ─── Mock 상품(24개) ──────────────────────────────────────────────
// category: 도서/검사/도구 + 미확인 1건(엑셀 오입력 세이프가드 재현).
// includes_online_code: null(미확인)/true/false — 비검사는 false 강제 반영.
// discount_override: null 또는 숫자(개별 할인).
// 2026-10-19: 실 상품 표 1:1 복원 위해 sub_category·list_price·notes·is_active·
//   test_group_id(검사 그룹 뷰)·option_label·option_name 필드 추가.
const MOCK_PRODUCTS = [
  { id: 1, name: '아동·청소년 임상총서 (전 4권)', category: '도서', sub_category: '임상총서', list_price: 128000, notes: '전 4권 세트 · 낱권 판매 안 함', is_active: true, is_discountable: true, discount_override: 0.3, is_popular: true, is_new: false, includes_online_code: false, tags: ['아동·청소년', '임상'], image_filename: 'b-001.jpg' },
  { id: 2, name: '심리치료의 기초 (제3판)', category: '도서', sub_category: '전문서적', list_price: 32000, notes: '', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: ['임상'] },
  { id: 3, name: '임상심리평가 핸드북', category: '도서', sub_category: '전문서적', list_price: 45000, notes: '학회 추천 도서', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: true, includes_online_code: false, tags: ['임상', '한국심리학회'], image_filename: 'b-003.jpg' },
  { id: 4, name: '상담심리학 개론 (제3판)', category: '도서', sub_category: '', list_price: 28000, notes: '', is_active: false, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: [] },
  { id: 5, name: '발달심리학 워크북', category: '도서', sub_category: '워크북', list_price: 19000, notes: '', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: true, includes_online_code: false, tags: ['아동·청소년', '신간'] },
  { id: 6, name: '심리평가 사례집', category: '도서', sub_category: '전문서적', list_price: 38000, notes: '', is_active: true, is_discountable: true, discount_override: 0.15, is_popular: true, is_new: false, includes_online_code: false, tags: ['임상'], image_filename: 'b-006.png' },
  { id: 7, name: '신경심리학 신간 가이드', category: '도서', sub_category: '신간코너', list_price: 42000, notes: '2026년 10월 출간', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: true, includes_online_code: false, tags: ['신간', '대한신경정신의학회'] },
  { id: 8, name: 'MMPI-2 검사지 (50매)', category: '검사', sub_category: '성격검사', list_price: 55000, notes: '50매 1묶음', is_active: true, is_discountable: false, discount_override: null, is_popular: true, is_new: false, includes_online_code: false, tags: ['대한신경정신의학회'], image_filename: 't-mmpi2.jpg', test_group_id: 101, option_label: '지필', option_name: '검사지 50매', sort_order: 1 },
  { id: 9, name: 'MMPI-2 온라인 코드', category: '검사', sub_category: '성격검사', list_price: 9000, notes: '1인 1회 실시', is_active: true, is_discountable: false, discount_override: null, is_popular: true, is_new: false, includes_online_code: true, tags: ['대한신경정신의학회'], image_filename: 't-mmpi2-code.jpg', test_group_id: 101, option_label: '온라인', option_name: '실시 코드', sort_order: 2 },
  { id: 10, name: 'K-WAIS-IV 채점판', category: '검사', sub_category: '지능검사', list_price: 72000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: [], test_group_id: 102, option_label: '지필', option_name: '채점판', sort_order: 1 },
  { id: 11, name: 'K-WAIS-IV 온라인 실시 코드', category: '검사', sub_category: '지능검사', list_price: 12000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: true, tags: ['한국심리학회'], test_group_id: 102, option_label: '온라인', option_name: '실시 코드', sort_order: 2 },
  { id: 12, name: 'CBCL 6-18 채점 (미분류)', category: '검사', sub_category: '아동검사', list_price: 15000, notes: '검사군 미지정', is_active: true, is_discountable: false, discount_override: null, is_popular: true, is_new: false, includes_online_code: null, tags: ['아동·청소년', '대한소아신경학회'] },
  { id: 13, name: 'BGT-2 온라인 코드 (미확인)', category: '검사', sub_category: '', list_price: 11000, notes: '온라인코드 포함 여부 확인 필요', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: true, includes_online_code: null, tags: ['임상'] },
  { id: 14, name: 'K-CDI 유아 검사지', category: '검사', sub_category: '아동검사', list_price: 18000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: ['아동·청소년', '대한소아신경학회'] },
  { id: 15, name: 'SCT 문장완성 검사지', category: '검사', sub_category: '투사검사', list_price: 8000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: [] },
  { id: 16, name: 'Holland 진로 온라인 코드', category: '검사', sub_category: '진로검사', list_price: 10000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: true, includes_online_code: true, tags: ['오티즘'] },
  { id: 17, name: '오티즘 선별 검사지 (ASD)', category: '검사', sub_category: '발달검사', list_price: 24000, notes: '선별용 · 진단 아님', is_active: true, is_discountable: false, discount_override: null, is_popular: true, is_new: true, includes_online_code: false, tags: ['오티즘', '대한소아신경학회'], image_filename: 't-asd.webp', test_group_id: 103, sort_order: 1 },
  { id: 18, name: '로르샤흐 카드 세트', category: '도구', sub_category: '투사도구', list_price: 180000, notes: '잉크반점 10매', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: ['임상'], image_filename: 'tool-rorschach.jpg' },
  { id: 19, name: 'TAT 도판 세트', category: '도구', sub_category: '투사도구', list_price: 95000, notes: '', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: ['임상'] },
  { id: 20, name: 'BGT 카드 세트', category: '도구', sub_category: '', list_price: 42000, notes: '', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: false, includes_online_code: false, tags: [] },
  { id: 21, name: '블록 디자인 도구함', category: '도구', sub_category: '수행도구', list_price: 68000, notes: '파손 주의', is_active: true, is_discountable: false, discount_override: 0.1, is_popular: false, is_new: true, includes_online_code: false, tags: ['신간'] },
  { id: 22, name: '개발자 역량 진단 코드', category: '검사', sub_category: '진로검사', list_price: 20000, notes: '', is_active: true, is_discountable: true, discount_override: null, is_popular: false, is_new: true, includes_online_code: true, tags: ['대한개발자협회', 'TEST'] },
  { id: 23, name: '테스트용 샘플 상품', category: '검사', sub_category: '기타', list_price: 1000, notes: '테스트 전용 — 노출 금지', is_active: false, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: null, tags: ['TEST'] },
  // 카테고리 미확인(category 공백) — 가시성 세이프가드 재현(평소 0건)
  { id: 24, name: '분류 누락 상품 (엑셀 오입력)', category: '', sub_category: '', list_price: 0, notes: '카테고리 누락 — 확인 필요', is_active: true, is_discountable: false, discount_override: null, is_popular: false, is_new: false, includes_online_code: null, tags: [] },
];

// ─── 검사군 마스터(그룹 뷰) — 실 testGroups 재현 ──────────────────
// abbr(약어)·name(검사명)·is_active(노출). 103(ASD)은 숨김 검사군(행 dim + "숨김" 칩).
const TEST_GROUPS = [
  { id: 101, abbr: 'MMPI-2', name: '다면적 인성검사 II', is_active: true },
  { id: 102, abbr: 'K-WAIS-IV', name: '한국 웩슬러 성인 지능검사 4판', is_active: true },
  { id: 103, abbr: 'ASD', name: '자폐스펙트럼 선별검사', is_active: false },
];
const TG_OPTION_COUNTS = { 101: 2, 102: 2, 103: 1 };

// 소분류 마스터 이름→색(등록된 것만). 미등록 소분류는 폴백 회색 "· 미등록" 칩.
const SUB_COLOR_BY_NAME = {
  '임상총서': '#C026D3',
  '전문서적': '#3B82F6',
  '신간코너': '#D97706',
  '성격검사': '#6366F1',
  '지능검사': '#2B398F',
  '아동검사': '#00A884',
  '발달검사': '#0764C7',
  '투사도구': '#6B7684',
  // '워크북'·'진로검사'·'투사검사'·'수행도구'·'기타'는 미등록 → 회색 "· 미등록"
};

const CORE_CATEGORIES = ['도서', '검사', '도구'];
const CATEGORY_META = {
  '도서': { icon: MenuBookIcon, tone: 'info' },
  '검사': { icon: ScienceIcon, tone: 'secondary' },
  '도구': { icon: BuildIcon, tone: 'gray' },
  '미확인': { icon: HelpOutlineIcon, tone: 'warning' },
};

// ─── 패싯 토글(라벨 + ToggleButtonGroup exclusive) ─────────────────
// Y/N 속성: [전체|Y|N] — '전체'가 명시 세그먼트(기본 선택).
// 온라인코드: [전체|Y|N|미확인] — 미확인은 항상 끝.
// 카테고리: clearable — 활성 버튼 재클릭 시 전체로 해제('미선택=전체').
const FacetToggle = ({ label, value, options, onChange, clearable = false }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 700, minWidth: 68, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        size="small"
        onChange={(_, next) => {
          if (next === null) {
            if (clearable) onChange('');
            return; // Y/N 그룹은 '전체'가 명시 세그먼트 → null 무시(현재 값 유지)
          }
          onChange(next);
        }}
        sx={{
          flexWrap: 'wrap',
          '& .MuiToggleButton-root': {
            ...theme.typography.body2,
            px: 1.5,
            py: 0.5,
            lineHeight: 1.4,
            textTransform: 'none',
            borderColor: theme.gray[300],
            color: 'text.secondary',
            '&.Mui-selected': {
              color: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              fontWeight: 700,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
            },
          },
        }}
      >
        {options.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

const YN_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'y', label: 'Y' },
  { value: 'n', label: 'N' },
];
const ONLINE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'y', label: 'Y' },
  { value: 'n', label: 'N' },
  { value: 'unknown', label: '미확인' }, // 미확인은 항상 끝
];

const DEFAULT_FACETS = {
  category: '',
  isDiscountable: 'all',
  discountOverride: 'all',
  isPopular: 'all',
  isNew: 'all',
  onlineCode: 'all',
  hasImage: 'all',
};

// ─── 상품 표 셀·행(실 ProductManagementPage 1:1 재현) ──────────────
// 프리뷰는 Supabase 버킷이 없어 실제 썸네일을 불러올 수 없다. 실 정책은
// "image_filename 있으면 썸네일, 없으면 빈 셀(플레이스홀더 없음)". 프리뷰에선
// image_filename 있는 상품만 40px 회색 썸네일 스탠드인(ImageIcon)으로 대체 표시,
// 없으면 실 정책대로 빈 셀. (버킷 연결 시 ProductThumb이 실제 <img>를 렌더)
const ProductThumb = ({ filename }) => {
  const theme = useTheme();
  if (!filename) return null; // 실 정책: 미등록이면 셀 비움(플레이스홀더 금지)
  return (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 1, overflow: 'hidden',
        bgcolor: theme.gray[200], flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ImageIcon sx={{ fontSize: 20, color: theme.gray[500] }} />
    </Box>
  );
};

// 소분류 소프트 틴트 칩(실 ColorChip 재현). 미등록·색없음은 회색 폴백.
const ColorChip = ({ label, color }) => {
  const c = color || MASTER_COLOR_FALLBACK;
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: alpha(c, 0.12), color: c, border: `1px solid ${alpha(c, 0.3)}`, fontWeight: 600 }}
    />
  );
};

// 상품명 이후 공통 셀(카테고리·하위카테고리·가격·비고·상태태그·태그·작업).
// 실 renderProductCells 1:1 — 평면 행과 검사군 옵션 하위 행이 동일 재사용.
const renderProductCells = (product, theme, onEdit) => (
  <>
    <TableCell><Chip label={product.category || '미확인'} size="small" color="primary" variant="outlined" /></TableCell>
    <TableCell>
      {product.sub_category
        ? (SUB_COLOR_BY_NAME[product.sub_category]
            ? <ColorChip label={product.sub_category} color={SUB_COLOR_BY_NAME[product.sub_category]} />
            : <ColorChip label={`${product.sub_category} · 미등록`} color={MASTER_COLOR_FALLBACK} />)
        : '-'}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1' }}>{(product.list_price || 0).toLocaleString()}원</TableCell>
    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.notes || '-'}</TableCell>
    <TableCell align="center">
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', minWidth: 80 }}>
        {product.is_active === false && (
          <Chip label="숨김" size="small" sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }} />
        )}
        {product.is_popular && <Chip label="인기" size="small" color="warning" />}
        {product.is_new && <Chip label="신상품" size="small" color="primary" />}
        {product.is_discountable && (
          <Chip label="할인" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', border: 0 }} />
        )}
        {product.discount_override != null && (
          <Chip label={`개별 ${rateToPercentNullable(product.discount_override)}%`} size="small" sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main', border: 0 }} />
        )}
        {product.includes_online_code === true && (
          <Chip label="온라인코드" size="small" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: 'secondary.main', border: 0 }} />
        )}
        {product.is_active !== false && !product.is_popular && !product.is_new && !product.is_discountable && product.discount_override == null && product.includes_online_code !== true && (
          <Typography variant="caption" color="text.secondary">-</Typography>
        )}
      </Box>
    </TableCell>
    <TableCell>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {(product.tags || []).slice(0, 2).map((tag, index) => (
          <Chip key={index} label={tag} size="small" variant="outlined" />
        ))}
        {(product.tags || []).length > 2 && (
          <Tooltip title={product.tags.slice(2).join(', ')} arrow>
            <Chip label={`+${product.tags.length - 2}`} size="small" sx={{ cursor: 'pointer' }} />
          </Tooltip>
        )}
      </Box>
    </TableCell>
    <TableCell align="center">
      <IconButton size="small" onClick={() => onEdit(product)} sx={{ color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
        <EditIcon fontSize="small" />
      </IconButton>
    </TableCell>
  </>
);

// 상품 표 한 행(평면 행 = 검사군 옵션 하위 행 공용). isOption이면 상품명 셀=말머리+형태명·들여쓰기.
const ProductRow = ({ product, selected, isOption, theme, onToggle, onEdit }) => {
  const nameLabel = isOption
    ? ([product.option_label, product.option_name].filter(Boolean).join(' ') || product.name)
    : product.name;
  return (
    <TableRow
      selected={selected}
      sx={{
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
        transition: 'background-color 0.2s',
        opacity: product.is_active === false ? 0.55 : 1,
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox size="small" checked={selected} onChange={() => onToggle(product.id)} />
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ProductThumb filename={product.image_filename} />
        </Box>
      </TableCell>
      <TableCell sx={{ fontWeight: 500, ...(isOption ? { pl: 4 } : null) }}>{nameLabel}</TableCell>
      {renderProductCells(product, theme, onEdit)}
    </TableRow>
  );
};

// ─── 메인 ─────────────────────────────────────────────────────────
const ProductFilterBarPreview = () => {
  const theme = useTheme();

  const [facets, setFacets] = useState(DEFAULT_FACETS);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resetKey, setResetKey] = useState(0);

  // 결과 표(실 화면 1:1) — 선택·페이지·그룹 펼침 상태
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const setFacet = (key, value) => setFacets((prev) => ({ ...prev, [key]: value }));

  const matchesYN = (state, truthy) => state === 'all' || (state === 'y' ? truthy : !truthy);

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return MOCK_PRODUCTS.filter((p) => {
      if (s && !p.name.toLowerCase().includes(s)) return false;

      // 카테고리(단일): 미확인 = 도서/검사/도구 어느 것도 아님
      if (facets.category) {
        const isCore = CORE_CATEGORIES.includes(p.category);
        if (facets.category === '미확인') { if (isCore) return false; }
        else if (p.category !== facets.category) return false;
      }

      // Y/N 속성(속성 간 AND)
      if (!matchesYN(facets.isDiscountable, !!p.is_discountable)) return false;
      if (!matchesYN(facets.discountOverride, p.discount_override != null)) return false;
      if (!matchesYN(facets.isPopular, !!p.is_popular)) return false;
      if (!matchesYN(facets.isNew, !!p.is_new)) return false;
      // 이미지 등록 = image_filename 값 있음(NULL·빈 문자열 = N)
      if (!matchesYN(facets.hasImage, !!(p.image_filename || '').trim())) return false;

      // 온라인코드(3상태 필드값 그대로)
      if (facets.onlineCode !== 'all') {
        if (facets.onlineCode === 'unknown' && p.includes_online_code !== null) return false;
        if (facets.onlineCode === 'y' && p.includes_online_code !== true) return false;
        if (facets.onlineCode === 'n' && p.includes_online_code !== false) return false;
      }

      // 태그(OR)
      if (selectedTags.length > 0 && !selectedTags.some((t) => (p.tags || []).includes(t))) return false;

      return true;
    });
  }, [searchTerm, facets, selectedTags]);

  const facetsActive = Object.keys(DEFAULT_FACETS).some((k) => facets[k] !== DEFAULT_FACETS[k]);
  const hasFilters = Boolean(searchTerm) || facetsActive || selectedTags.length > 0;
  const groupViewActive = facets.category === '검사';

  // ── 검사군 그룹 뷰(실 groupedView 재현): 검사군 헤더 + 소속 옵션, 미분류는 하단 ──
  const groupedView = useMemo(() => {
    if (!groupViewActive) return [];
    const byGroup = new Map();
    const unassigned = [];
    filtered.forEach((p) => {
      if (p.test_group_id != null) {
        if (!byGroup.has(p.test_group_id)) byGroup.set(p.test_group_id, []);
        byGroup.get(p.test_group_id).push(p);
      } else {
        unassigned.push(p);
      }
    });
    const sortOptions = (list) => [...list].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
    const rows = TEST_GROUPS
      .filter((g) => byGroup.has(g.id))
      .map((g) => ({ group: g, options: sortOptions(byGroup.get(g.id)) }));
    if (unassigned.length > 0) rows.push({ group: null, options: sortOptions(unassigned) });
    return rows;
  }, [groupViewActive, filtered]);

  // 페이지 슬라이싱 — 평면 뷰는 상품, 그룹 뷰는 검사군 헤더 기준
  const displayedProducts = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return filtered.slice(start, start + productsPerPage);
  }, [filtered, currentPage, productsPerPage]);
  const displayedGroups = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return groupedView.slice(start, start + productsPerPage);
  }, [groupedView, currentPage, productsPerPage]);

  const allPageSelected = displayedProducts.length > 0 && displayedProducts.every((p) => selectedIds.has(p.id));
  const somePageSelected = displayedProducts.some((p) => selectedIds.has(p.id));
  const selectedCount = selectedIds.size;

  const handleToggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) displayedProducts.forEach((p) => next.delete(p.id));
      else displayedProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const handleToggleGroupExpand = useCallback((key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const noop = useCallback(() => {}, []); // 시안: 편집 클릭은 시각 확인용

  const handleReset = () => {
    setFacets(DEFAULT_FACETS);
    setSelectedTags([]);
    setSearchTerm('');
    setSelectedIds(new Set());
    setCurrentPage(1);
    setResetKey((k) => k + 1);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const categoryOptions = [...CORE_CATEGORIES, '미확인'].map((c) => ({ value: c, label: c }));

  return (
    <PreviewShell activePath="/admin/products">
      <PageHeader
        title="상품 관리 — 필터 바 시안"
        subtitle="A6 §필터 바 재설계(2026-10-19) · 속성별 패싯 필터(속성 간 AND, 태그 OR)"
        icon={Inventory2Icon}
      />

      {/* ─── 필터 바 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        {/* 표시 건수 + 초기화 (우측 상단) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, mb: 1.5, minHeight: 36 }}>
          {hasFilters && (
            <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum" 1' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{filtered.length}</Box>개 표시 중
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={handleReset}
            disabled={!hasFilters}
            sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
          >
            필터 초기화
          </Button>
        </Box>

        {/* 카테고리 (+ 검사 선택 시 검사군 추가) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          <FacetToggle
            label="카테고리"
            value={facets.category || null}
            options={categoryOptions}
            onChange={(v) => setFacet('category', v)}
            clearable
          />
          {groupViewActive && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
              onClick={() => { /* 시안: 검사군 추가 모달 진입 */ }}
              sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
            >
              검사군 추가
            </Button>
          )}
        </Box>

        {/* 속성 패싯 2열 그리드 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            columnGap: 3,
            rowGap: 1.5,
          }}
        >
          <FacetToggle label="할인 여부" value={facets.isDiscountable} options={YN_OPTIONS} onChange={(v) => setFacet('isDiscountable', v)} />
          <FacetToggle label="개별 할인" value={facets.discountOverride} options={YN_OPTIONS} onChange={(v) => setFacet('discountOverride', v)} />
          <FacetToggle label="인기 상품" value={facets.isPopular} options={YN_OPTIONS} onChange={(v) => setFacet('isPopular', v)} />
          <FacetToggle label="신상품" value={facets.isNew} options={YN_OPTIONS} onChange={(v) => setFacet('isNew', v)} />
          <FacetToggle label="이미지 등록" value={facets.hasImage} options={YN_OPTIONS} onChange={(v) => setFacet('hasImage', v)} />
          <FacetToggle label="온라인코드" value={facets.onlineCode} options={ONLINE_OPTIONS} onChange={(v) => setFacet('onlineCode', v)} />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 태그(학회 ∪ 자유 태그, 다중 OR) */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 68, pt: 0.75, flexShrink: 0 }}>
            <TagIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>태그</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {TAG_OPTIONS.map((tag) => {
              const selected = selectedTags.includes(tag);
              const isSociety = SOCIETY_SET.has(tag);
              return (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  clickable
                  onClick={() => toggleTag(tag)}
                  icon={(
                    <Checkbox
                      checked={selected}
                      size="small"
                      tabIndex={-1}
                      disableRipple
                      sx={{ p: 0, ml: 0.5, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                    />
                  )}
                  sx={{
                    height: 28,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? theme.palette.primary.main : 'text.secondary',
                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.4) : theme.gray[300]}`,
                    // 학회 태그는 좌측 얇은 구분(자유 태그와 그룹 분리) — 색 인디케이터 아님, 중립 테두리만
                    ...(isSociety ? {} : { borderStyle: 'dashed' }),
                    '& .MuiChip-label': { ...theme.typography.caption, pl: 0.5 },
                    '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.12) : theme.gray[50] },
                  }}
                />
              );
            })}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1, ml: '80px' }}>
          학회 태그(실선) · 자유 태그(점선). 선택한 태그 중 하나라도 가진 상품을 보여줍니다(OR).
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* 상품명 검색 — 조건을 고른 뒤 마지막에 좁히는 단계라 맨 아래 */}
        <ProductSearchBar
          onSearch={setSearchTerm}
          resetKey={resetKey}
          size="small"
          placeholder="상품명으로 검색 (검사군명·약어 포함)"
          sx={{ mb: 0, width: '100%' }}
        />
      </SectionCard>

      {/* ─── 선택 시 액션바(실 화면 1:1) ─── */}
      {selectedCount > 0 && (
        <SectionCard
          padding={0}
          sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderColor: alpha(theme.palette.primary.main, 0.2) }}
        >
          <ActionSlot
            sx={{ px: 2, py: 1.5 }}
            leading={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckBoxIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {selectedCount}개 선택됨
                  </Typography>
                </Box>
                {groupViewActive && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    선택된 상품이 현재 화면에 보이지 않을 수 있습니다.
                  </Typography>
                )}
              </Box>
            }
          >
            <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={noop}>선택 항목 편집</Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={noop}>선택 삭제</Button>
            <Button size="small" variant="text" onClick={() => setSelectedIds(new Set())}>선택 해제</Button>
          </ActionSlot>
        </SectionCard>
      )}

      {/* ─── 결과 표(실 ProductManagementPage 상품 표 1:1) ─── */}
      <SectionCard padding={0}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell padding="checkbox" sx={{ width: 48 }}>
                  {/* 그룹 뷰에선 전체 선택 체크박스를 렌더하지 않는다(빈 셀로 정렬만 유지) — QA P0-3. */}
                  {!groupViewActive && (
                    <Checkbox
                      size="small"
                      checked={allPageSelected}
                      indeterminate={somePageSelected && !allPageSelected}
                      onChange={handleToggleAll}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">이미지</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>하위 카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">가격</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>비고</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">상태 태그</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupViewActive ? (
                groupedView.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ border: 0, py: 4 }}>
                      <EmptyState
                        icon={InventoryIcon}
                        title={hasFilters ? '검색 결과가 없습니다' : '표시할 검사가 없습니다'}
                        action={hasFilters ? { label: '필터 초기화', onClick: handleReset, startIcon: <RestartAltIcon /> } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedGroups.map(({ group, options }) => {
                    const key = group ? group.id : '__unassigned__';
                    const expanded = expandedGroups.has(key);
                    const hiddenGroup = group?.is_active === false;
                    return (
                      <React.Fragment key={key}>
                        {/* 검사군 그룹 헤더 행 — 약어·검사명·옵션N 요약(가격 은닉) + 검사군 단위 관리(노출/편집/⋮) */}
                        <TableRow
                          hover
                          onClick={() => handleToggleGroupExpand(key)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: alpha(theme.palette.primary.main, 0.03),
                            opacity: hiddenGroup ? 0.55 : 1,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                          }}
                        >
                          <TableCell padding="checkbox" />
                          <TableCell align="center" sx={{ width: 48 }}>
                            <IconButton size="small" tabIndex={-1}>
                              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell colSpan={group ? 6 : 8}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                              {group?.abbr && (
                                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{group.abbr}</Typography>
                              )}
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{group ? group.name : '미분류'}</Typography>
                              {hiddenGroup && (
                                <Chip label="숨김" size="small" sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }} />
                              )}
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                옵션 {(group ? TG_OPTION_COUNTS[group.id] : options.length) ?? options.length}개
                              </Typography>
                            </Box>
                          </TableCell>
                          {/* 검사군 단위 관리 셀 — 미분류(group===null)는 마스터 없어 액션 없음 */}
                          {group && (
                            <TableCell align="center" colSpan={2} onClick={(e) => e.stopPropagation()} sx={{ cursor: 'default' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                                <Switch size="small" checked={group.is_active} onChange={noop} />
                                <IconButton size="small" onClick={noop} title="검사군 상세 편집"><EditIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={noop} title="상세 편집·병합·삭제"><MoreVertIcon fontSize="small" /></IconButton>
                              </Box>
                            </TableCell>
                          )}
                        </TableRow>
                        {/* 옵션 하위 행 — 평면 셀 그대로, 상품명 셀만 들여쓰기 + 말머리·형태명 */}
                        {expanded && options.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            selected={selectedIds.has(product.id)}
                            isOption
                            theme={theme}
                            onToggle={handleToggleOne}
                            onEdit={noop}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })
                )
              ) : displayedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      icon={InventoryIcon}
                      title={hasFilters ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
                      action={hasFilters ? { label: '필터 초기화', onClick: handleReset, startIcon: <RestartAltIcon /> } : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayedProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selectedIds.has(product.id)}
                    isOption={false}
                    theme={theme}
                    onToggle={handleToggleOne}
                    onEdit={noop}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {(groupViewActive ? groupedView.length > 0 : displayedProducts.length > 0) && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: `1px solid ${theme.gray[100]}` }}>
            <FormControl size="small">
              <InputLabel>페이지당 항목 수</InputLabel>
              <Select
                value={productsPerPage}
                label="페이지당 항목 수"
                onChange={(event) => { setProductsPerPage(parseInt(event.target.value, 10)); setCurrentPage(1); }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Pagination
              count={Math.max(1, Math.ceil((groupViewActive ? groupedView.length : filtered.length) / productsPerPage))}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              color="primary"
            />
          </Box>
        )}
      </SectionCard>
    </PreviewShell>
  );
};

export default ProductFilterBarPreview;
