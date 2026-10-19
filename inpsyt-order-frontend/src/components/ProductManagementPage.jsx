import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ProductSearchBar from './ProductSearchBar';
import TestGroupEditorModal from './TestGroupEditorModal';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Menu, Autocomplete, Chip,
  Pagination, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  CircularProgress, LinearProgress, Switch, Collapse, ListItemIcon, Divider, alpha, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, FileDownload as DownloadIcon, FileUpload as UploadIcon,
  Edit as EditIcon, Search as SearchIcon, Inventory as InventoryIcon,
  Inventory2 as Inventory2Icon, LocalOffer as TagIcon,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon, CheckBox as CheckBoxIcon,
  RestartAlt as RestartAltIcon, Tune as TuneIcon,
  Description as DescriptionIcon,
  Category as CategoryIcon,
  AccountTree as AccountTreeIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PhotoLibrary as PhotoLibraryIcon,
  MergeType as MergeTypeIcon,
  MoreVert as MoreVertIcon,
  Tune as TuneOptionsIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchAllProducts } from '../api/products';
import { getProductImageUrl, uploadProductImage } from '../api/productImages';
import {
  fetchSubcategories,
  createSubcategory, updateSubcategory, deleteSubcategory,
  fetchMasterUsageCounts,
} from '../api/masters';
import {
  fetchTestGroups, updateTestGroup, deleteTestGroup,
  fetchTestGroupOptionCounts, mergeTestGroups, makeTestGroupResolver,
} from '../api/testGroups';
import { getSocieties } from '../api/events';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';
import { matchesSearch } from '../utils/search';
import { percentToRateNullable, rateToPercentNullable } from '../utils/pricing';
import { parseBool, parseProductSheet } from '../utils/productExcel';
import { exportProductList } from '../utils/productExcelExport';
import {
  DEFAULT_FACETS, UNKNOWN_CATEGORY, isFacetsActive,
  matchesCategory, matchesFacets, matchesTags, buildTagOptions,
} from '../utils/productFilters';
import { buildProductImageFilename, MAX_IMAGE_BYTES } from '../utils/productImageName';
import {
  MASTER_COLOR_FALLBACK, MASTER_COLOR_PRESETS,
} from '../constants/categoryColors';
import { PageHeader, SectionCard, ActionSlot, EmptyState } from './ui';
import TableSkeleton from './TableSkeleton';

const categories = ['도서', '검사', '도구'];
const PARENT_CATEGORIES = ['검사', '도서', '도구'];
const DELETE_ALL_CONFIRM_TEXT = '삭제합니다';

// ─── 필터 바(A6 §필터 바, 2026-10-19) — 판정 로직은 utils/productFilters ─────────
// 카테고리 '미확인' = 도서·검사·도구 어느 값도 아님(NULL·빈 문자열·그 외). 미확인은 항상 끝.
const CATEGORY_FILTER_OPTIONS = [...categories, UNKNOWN_CATEGORY].map((c) => ({ value: c, label: c }));
// Y/N 속성: [전체|Y|N] — '전체'가 명시 세그먼트(기본 선택).
const YN_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'y', label: 'Y' },
  { value: 'n', label: 'N' },
];
// 온라인코드: [전체|Y|N|미확인] — includes_online_code 3상태 그대로, 미확인은 항상 끝.
const ONLINE_CODE_OPTIONS = [
  ...YN_OPTIONS,
  { value: 'unknown', label: '미확인' },
];

// 이미지 파일명 안전 문자 — 영숫자·대시·언더스코어·점만. 한글·공백·특수문자는 Storage 키가 깨진다.
const SAFE_IMAGE_FILENAME = /^[A-Za-z0-9._-]+$/;

const createEmptyProduct = () => ({
  name: '',
  product_code: '',
  category: '',
  sub_category: '',
  list_price: 0,
  notes: '',
  is_discountable: false,
  discount_override: null,
  is_popular: false,
  is_new: false,
  is_active: true,
  // 온라인코드 포함 3상태: null(미확인)/true(포함)/false(미포함). 신규 상품은 미확인으로 시작 → 운영자가 확정.
  includes_online_code: null,
  tags: [],
});

// 필터 바 패싯 토글(라벨 + ToggleButtonGroup exclusive). A6 §필터 바 시안(ProductFilterBarPreview) 1:1.
// Y/N 속성은 '전체'가 명시 세그먼트 → 활성 버튼 재클릭(null)은 무시(현재 값 유지).
// 카테고리는 clearable — 활성 버튼 재클릭 시 전체('')로 해제(미선택=전체).
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
            return;
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

// 상품 표 썸네일(A6 §표 썸네일). 1:1 작은 정방형.
// 미등록·onError면 셀 비움(null) — 플레이스홀더 폐기(건우님 2026-06-29). 대부분 미등록(NULL)이 정상.
// memo: filename·name 같으면 skip(탭 전환·검색·행 재정렬 시 이미지 셀 재렌더 방지).
const ProductThumb = React.memo(({ filename, name }) => {
  const [failed, setFailed] = useState(false);
  const url = getProductImageUrl(filename);
  if (!url || failed) return null;
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'grey.100',
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </Box>
  );
});

// 개별 편집 다이얼로그의 현재 이미지 미리보기. 표 썸네일(ProductThumb)과 달리 로드 실패·미등록 시
// "이미지 없음" 문구를 노출(폼에선 첨부 상태 피드백이 필요 — 셀 비움 정책과 분리).
// 호출부에서 key={filename}로 파일명 바뀔 때 remount → 이전 에러 state가 새 이미지에 남지 않게 함.
const ProductImagePreview = ({ filename }) => {
  const [failed, setFailed] = useState(false);
  const url = getProductImageUrl(filename);
  if (!url || failed) {
    return <Typography variant="caption" color="text.secondary">이미지 없음</Typography>;
  }
  return (
    <Box
      component="img"
      src={url}
      alt="상품 이미지 미리보기"
      onError={() => setFailed(true)}
      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};

// 상품명 이후 공통 셀(카테고리·하위카테고리·가격·비고·상태태그·태그·작업).
// 평면 행과 검사군 옵션 하위 행이 동일하게 재사용(사양 §옵션 하위 행).
// ProductRow 내부 렌더로 흡수 — memo 대상이 셀 전체를 포함해야 재렌더가 온전히 skip됨.
const renderProductCells = (product, subColorByName, theme, canEdit, onEdit) => (
  <>
    <TableCell><Chip label={product.category} size="small" color="primary" variant="outlined" /></TableCell>
    <TableCell>
      {product.sub_category
        ? (subColorByName[product.sub_category]
            ? <ColorChip label={product.sub_category} color={subColorByName[product.sub_category]} />
            : <ColorChip label={`${product.sub_category} · 미등록`} color={MASTER_COLOR_FALLBACK} />)
        : '-'}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1' }}>{(product.list_price || 0).toLocaleString()}원</TableCell>
    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.notes || '-'}</TableCell>
    <TableCell align="center">
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', minWidth: 80 }}>
        {/* 숨김 칩 — is_active=false만 표시(노출 중은 기본 상태라 무표시, 노이즈 방지). gray 소프트 틴트. */}
        {product.is_active === false && (
          <Chip
            label="숨김"
            size="small"
            sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }}
          />
        )}
        {product.is_popular && <Chip label="인기" size="small" color="warning" />}
        {product.is_new && <Chip label="신상품" size="small" color="primary" />}
        {product.is_discountable && (
          <Chip
            label="할인"
            size="small"
            sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', border: 0 }}
          />
        )}
        {product.discount_override != null && (
          <Chip
            label={`개별 ${rateToPercentNullable(product.discount_override)}%`}
            size="small"
            sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main', border: 0 }}
          />
        )}
        {product.includes_online_code === true && (
          <Chip
            label="온라인코드"
            size="small"
            sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: 'secondary.main', border: 0 }}
          />
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
    {canEdit && (
      <TableCell align="center">
        <IconButton
          size="small"
          onClick={() => onEdit(product)}
          sx={{ color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </TableCell>
    )}
  </>
);

// 상품 표 한 행(평면 뷰 행 = 검사군 옵션 하위 행 공용). memo — product·selected·canEdit·subColorByName가
// 안 바뀌면 재렌더 skip. 핸들러(onToggle·onEdit)는 상위에서 useCallback으로 안정화해야 memo 효과가 남.
// isOption=true면 검사군 옵션 하위 행(상품명 셀=말머리+형태명, 들여쓰기). 셀 구성은 renderProductCells 공용.
const ProductRow = React.memo(({ product, selected, canEdit, isOption, subColorByName, theme, onToggle, onEdit }) => {
  const nameLabel = isOption
    ? ([product.option_label, product.option_name].filter(Boolean).join(' ') || product.name)
    : product.name;
  return (
    <TableRow
      selected={selected}
      sx={{
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
        transition: 'background-color 0.2s',
        // is_active=false(숨김) 행 dim. 표에서 사라지지 않고 잔류(재판매·이관 대비).
        // graceful: 컬럼 미적용(undefined)은 노출로 취급.
        opacity: product.is_active === false ? 0.55 : 1,
      }}
    >
      {canEdit && (
        <TableCell padding="checkbox">
          <Checkbox size="small" checked={selected} onChange={() => onToggle(product.id)} />
        </TableCell>
      )}
      <TableCell align="center">
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ProductThumb filename={product.image_filename} name={product.name} />
        </Box>
      </TableCell>
      <TableCell sx={{ fontWeight: 500, ...(isOption ? { pl: 4 } : null) }}>{nameLabel}</TableCell>
      {renderProductCells(product, subColorByName, theme, canEdit, onEdit)}
    </TableRow>
  );
});

// 소분류 소프트 틴트 칩. 미등록·색없음은 회색 폴백.
const ColorChip = ({ label, color }) => {
  const c = color || MASTER_COLOR_FALLBACK;
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: alpha(c, 0.12),
        color: c,
        border: `1px solid ${alpha(c, 0.3)}`,
        fontWeight: 600,
      }}
    />
  );
};

// 색 프리셋 선택 — 자유 hex 금지(AA 대비·토큰 정합). 견본 클릭으로만 선택.
const ColorPresetPicker = ({ value, onChange }) => (
  <Box>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
      색
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {MASTER_COLOR_PRESETS.map((preset) => {
        const selected = value === preset.value;
        return (
          <Tooltip key={preset.value} title={preset.label} arrow>
            <Box
              onClick={() => onChange(preset.value)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: preset.value,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: selected ? '2px solid' : '2px solid transparent',
                borderColor: selected ? 'text.primary' : 'transparent',
                transition: 'transform 0.1s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              {selected && <CheckIcon sx={{ fontSize: 18, color: '#fff' }} />}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  </Box>
);

const TriStateToggle = ({ label, value, onChange }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
      {label}
    </Typography>
    <ToggleButtonGroup
      value={value === null ? 'none' : value ? 'on' : 'off'}
      exclusive
      size="small"
      onChange={(_, nextValue) => {
        if (!nextValue) return;
        onChange(nextValue === 'none' ? null : nextValue === 'on');
      }}
    >
      <ToggleButton value="none" sx={{ px: 1.5, fontSize: '0.75rem' }}>변경 없음</ToggleButton>
      <ToggleButton value="on" sx={{ px: 1.5, fontSize: '0.75rem' }}>ON</ToggleButton>
      <ToggleButton value="off" sx={{ px: 1.5, fontSize: '0.75rem' }}>OFF</ToggleButton>
    </ToggleButtonGroup>
  </Box>
);

const ProductManagementPage = () => {
  const theme = useTheme();
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const productImageInputRef = useRef(null); // 개별 편집 폼의 단일 이미지 첨부 input

  // 개별 상품 이미지 첨부 진행 상태(다이얼로그)
  const [imageAttaching, setImageAttaching] = useState(false);

  // 이미지 일괄 업로드(product-images 공개 버킷)
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState({ current: 0, total: 0, running: false });
  const [imageUploadResults, setImageUploadResults] = useState([]); // [{ name, ok, error }]

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: 'idle' });
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadLog, setUploadLog] = useState([]);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);

  const [allProducts, setAllProducts] = useState([]);
  const [subcategories, setSubcategories] = useState([]); // 소분류 마스터(상품관리에서 관리)
  const [societies, setSocieties] = useState([]);          // 학회 목록(학회 관리 모달과 동일 소스)

  // ── 소분류 마스터 CRUD (즉시 저장 — 상품관리 헤더에서 펼침/접이) ──
  const [masterPanelOpen, setMasterPanelOpen] = useState(false);
  const [masterUsage, setMasterUsage] = useState({ subCounts: {} });
  const [subDialog, setSubDialog] = useState(null);   // null | { id?, name, parent_category, color, sort_order, is_active }
  const [masterSaving, setMasterSaving] = useState(false);

  // ── 검사군 관리 (test_groups) — '검사' 그룹 뷰 안에서 인라인 관리. 위험 액션(분리/병합/삭제)은 확인 스텝 ──
  const [testGroups, setTestGroups] = useState([]);
  const [tgOptionCounts, setTgOptionCounts] = useState({}); // { [test_group_id]: 소속 상품 수 }
  const [tgDeleteTarget, setTgDeleteTarget] = useState(null); // 삭제 확인 대상 검사군
  const [tgMergeKeep, setTgMergeKeep] = useState(null);      // 병합 대표(keep) 검사군 — 헤더 메뉴에서 진입
  const [tgMergeAbsorb, setTgMergeAbsorb] = useState(new Set()); // 대표로 흡수될 다른 검사군 id들
  const [tgActionRunning, setTgActionRunning] = useState(false);
  // 검사군 상세 편집 모달 — { group: null(신규) | 객체(기존) } 이면 열림
  const [tgEditor, setTgEditor] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // debounce된 검색어(ProductSearchBar가 세팅)
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // 펼친 검사군 id(및 '미분류')
  const [tgMenuAnchor, setTgMenuAnchor] = useState(null); // 검사군 헤더 행 액션 메뉴 { el, group }
  const [facets, setFacets] = useState(DEFAULT_FACETS); // 속성별 Y/N 필터(A6 §필터 바)
  const [selectedTags, setSelectedTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(createEmptyProduct());
  const [categoryInvalid, setCategoryInvalid] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkIsPopular, setBulkIsPopular] = useState(null);
  const [bulkIsNew, setBulkIsNew] = useState(null);
  const [bulkOnlineCode, setBulkOnlineCode] = useState(null); // null=변경 없음 / true=포함 / false=미포함
  const [bulkTags, setBulkTags] = useState([]);
  const [bulkTagsMode, setBulkTagsMode] = useState('append');
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProducts();
      setAllProducts(data || []);
      setSelectedIds(new Set());
    } catch (error) {
      addNotification(`상품 목록을 불러오지 못했습니다: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // 소분류 마스터 + 사용 카운트 로드. CRUD 후에도 재호출.
  // 마이그레이션 미적용 시 빈 배열 → 기존 자유입력 폴백.
  const loadMasters = useCallback(async () => {
    try {
      const [subs, counts] = await Promise.all([
        fetchSubcategories(),
        fetchMasterUsageCounts(),
      ]);
      setSubcategories(subs);
      setMasterUsage(counts);
    } catch (error) {
      console.error('Error loading masters:', error);
    }
  }, []);

  // 검사군 마스터 + 옵션 카운트 로드. CRUD 후 재호출. 마이그레이션 미적용 시 빈 목록 graceful.
  const loadTestGroups = useCallback(async () => {
    try {
      const [groups, counts] = await Promise.all([
        fetchTestGroups(),
        fetchTestGroupOptionCounts(),
      ]);
      setTestGroups(groups);
      setTgOptionCounts(counts);
    } catch (error) {
      console.error('Error loading test groups:', error);
    }
  }, []);

  useEffect(() => {
    loadMasters();
    loadTestGroups();
    getSocieties().then(setSocieties).catch(() => {});
  }, [loadMasters, loadTestGroups]);

  // 활성 소분류 이름 옵션(현재 폼 대분류에 소속된 것만). is_active=false는 신규 선택지에서 숨김.
  const subOptionsForCategory = useMemo(() => {
    const cat = currentProduct.category;
    return subcategories
      .filter((s) => s.is_active && (!cat || s.parent_category === cat))
      .map((s) => s.name);
  }, [subcategories, currentProduct.category]);

  // 소분류 이름 → 색 룩업(미등록·색없음은 폴백 회색).
  const subColorByName = useMemo(() => {
    const m = {};
    subcategories.forEach((s) => { m[s.name] = s.color || MASTER_COLOR_FALLBACK; });
    return m;
  }, [subcategories]);

  // 검색어·카테고리·속성·태그 변경 시 1페이지로 리셋
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, facets, selectedTags]);

  // 태그 옵션 = 학회 목록(societies.name) ∪ 상품 자유 태그(products.tags). 학회명 앞쪽, 자유 태그 뒤쪽.
  // 학회 관리 탭에 등록한 학회명을 검색 편의로 태그 옵션에 항상 노출(건우님 피드백 #3).
  const { availableTags, societyTagSet } = useMemo(
    () => buildTagOptions(allProducts, societies),
    [allProducts, societies],
  );

  // 검사군 id → 메타(약어·검사명) 맵 — 검색 대상에 검사군 abbr·name 포함용.
  const tgById = useMemo(() => {
    const m = new Map();
    for (const g of testGroups) m.set(g.id, g);
    return m;
  }, [testGroups]);

  // 필터: 검색 + 카테고리 + 속성(Y/N, 속성 간 AND) + 태그(OR)
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    // 검색 대상 = 상품명(name) + 소속 검사군의 검사명(name)·약어(abbr).
    // 약어(예 K-WISC-V)가 상품명에 없어도 검사군 약어로 검색되도록 마스터 메타를 함께 매칭.
    if (searchTerm.trim()) {
      list = list.filter((p) => {
        if (matchesSearch(p.name, searchTerm)) return true;
        if (p.test_group_id != null) {
          const g = tgById.get(p.test_group_id);
          if (g && (matchesSearch(g.name, searchTerm) || matchesSearch(g.abbr, searchTerm))) return true;
        }
        return false;
      });
    }
    list = list.filter((p) => (
      matchesCategory(p, selectedCategory)
      && matchesFacets(p, facets)
      && matchesTags(p, selectedTags)
    ));
    return [...list].sort((a, b) => {
      const popDiff = (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      if (popDiff !== 0) return popDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allProducts, searchTerm, selectedCategory, facets, selectedTags, tgById]);

  const totalFiltered = filteredProducts.length;

  // 검사군 그룹 뷰 활성 여부 — '검사' 카테고리 선택 시 무조건 그룹 뷰(디폴트이자 유일 뷰).
  // 도서·도구·전체는 평면. '전체'에서 검사 상품이 평면에 섞이는 현행은 유지(전체 조망).
  const groupViewActive = selectedCategory === '검사';

  // 검사군 그룹 뷰용 그룹핑(신규 API 없이 filteredProducts + testGroups 재사용).
  // 검사군 헤더 행(sort_order 순) + 소속 옵션. test_group_id NULL 검사 상품은 하단 "미분류" 그룹.
  const groupedView = useMemo(() => {
    if (!groupViewActive) return [];
    const byGroup = new Map();
    const unassigned = [];
    filteredProducts.forEach((p) => {
      if (p.test_group_id != null) {
        if (!byGroup.has(p.test_group_id)) byGroup.set(p.test_group_id, []);
        byGroup.get(p.test_group_id).push(p);
      } else {
        unassigned.push(p);
      }
    });
    const sortOptions = (list) => [...list].sort((a, b) => {
      const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });
    // testGroups는 이미 sort_order → name 정렬(fetchTestGroups). 옵션이 있는 검사군만 진열.
    const rows = testGroups
      .filter((g) => byGroup.has(g.id))
      .map((g) => ({ group: g, options: sortOptions(byGroup.get(g.id)) }));
    if (unassigned.length > 0) {
      rows.push({ group: null, options: sortOptions(unassigned) });
    }
    return rows;
  }, [groupViewActive, filteredProducts, testGroups]);

  // 그룹 뷰 페이지 슬라이싱 — 검사군 214개 헤더 전량 렌더 시 헤더 MUI 폭증으로 렉 → 페이지 분할
  const displayedGroups = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return groupedView.slice(start, start + productsPerPage);
  }, [groupedView, currentPage, productsPerPage]);

  const handleToggleGroupExpand = useCallback((key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 페이지 슬라이싱 (평면 뷰 전용 — 그룹 뷰는 헤더 전량 렌더)
  const displayedProducts = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, currentPage, productsPerPage]);

  const allPageSelected = displayedProducts.length > 0 && displayedProducts.every((product) => selectedIds.has(product.id));
  const somePageSelected = displayedProducts.some((product) => selectedIds.has(product.id));
  const selectedCount = selectedIds.size;
  const hasFilters = Boolean(searchTerm || selectedCategory || isFacetsActive(facets) || selectedTags.length > 0);

  const handleOpen = useCallback((product = null) => {
    setIsEditing(Boolean(product));
    setCurrentProduct(product ? { ...product } : createEmptyProduct());
    setCategoryInvalid(false);
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setCurrentProduct(createEmptyProduct());
    setCategoryInvalid(false);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'category' && value) setCategoryInvalid(false);
    setCurrentProduct((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!hasPermission('products:edit')) {
      addNotification('상품 수정 권한이 없습니다.', 'error');
      return;
    }

    if (!categories.includes(currentProduct.category)) {
      setCategoryInvalid(true);
      addNotification('카테고리를 검사/도서/도구 중에서 선택해 주세요.', 'warning');
      return;
    }

    try {
      const payload = { ...currentProduct, list_price: Math.round(Number(currentProduct.list_price) || 0) };
      // image_filename 정규화:
      //  - '' (개별 폼에서 '제거') → 편집이면 NULL로 명시 저장(기존 이미지 지움), 추가면 보낼 값 없어 키 제외.
      //  - null/undefined → 키 제외(컬럼 미적용 환경 graceful, 불필요 왕복 방지).
      // 값이 있는데 컬럼이 없으면 아래 mutate가 PGRST204 감지 후 해당 키 빼고 재시도.
      if (payload.image_filename === '') {
        if (isEditing) payload.image_filename = null;
        else delete payload.image_filename;
      } else if (payload.image_filename == null) {
        delete payload.image_filename;
      }

      const mutate = async (data) => {
        const run = async (body) => {
          if (isEditing) {
            const { id, ...updates } = body;
            return supabase.from('products').update(updates).eq('id', id);
          }
          return supabase.from('products').insert([body]);
        };
        let { error } = await run(data);
        // 신규 가법 컬럼(image_filename·is_active·discount_override·includes_online_code) 미적용 환경 graceful — PGRST204 시 해당 키 빼고 재시도.
        if (error && error.code === 'PGRST204' && ('image_filename' in data || 'is_active' in data || 'discount_override' in data || 'includes_online_code' in data)) {
          const rest = { ...data };
          delete rest.image_filename;
          delete rest.is_active;
          delete rest.discount_override;
          delete rest.includes_online_code;
          ({ error } = await run(rest));
        }
        if (error) throw error;
      };
      await mutate(payload);

      addNotification('상품이 저장되었습니다.', 'success');
      handleClose();
      fetchProducts();
    } catch (error) {
      addNotification(`상품 저장 실패: ${error.message}`, 'error');
    }
  };

  // 개별 편집 폼의 이미지 첨부(단일 파일). 일괄 업로드와 달리 파일명을 안전하게 새로 지어(buildProductImageFilename)
  // 한글 파일명 사진도 그대로 받는다. 첨부 즉시 버킷에 업로드하되 image_filename 반영은 폼 상태로만 —
  // 저장을 취소하면 DB엔 반영되지 않는다. 단, 업로드된 파일 자체는 버킷에 남는다(다른 상품이 같은 파일을
  // 참조할 수 있어 롤백하지 않음. 고아 파일은 무해하므로 정리 로직 없음 — 오버엔지니어링 방어).
  const handleAttachProductImage = async (event) => {
    if (!hasPermission('products:edit')) return;
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      addNotification('이미지가 너무 큽니다. 1MB 이하 파일을 첨부해 주세요 (200KB 이하 권장).', 'warning');
      return;
    }

    const safeName = buildProductImageFilename({
      originalName: file.name,
      productCode: currentProduct.product_code,
      productId: currentProduct.id,
    });
    if (!safeName) {
      addNotification('지원하지 않는 형식입니다. JPG·PNG·WEBP·GIF 파일만 첨부할 수 있습니다.', 'warning');
      return;
    }

    setImageAttaching(true);
    try {
      // 안전한 새 파일명으로 업로드(uploadProductImage는 file.name을 Storage 키로 씀).
      const renamed = new File([file], safeName, { type: file.type || undefined });
      const { error } = await uploadProductImage(renamed);
      if (error) throw error;
      setCurrentProduct((prev) => ({ ...prev, image_filename: safeName }));
      addNotification('이미지를 첨부했습니다. 저장을 눌러야 반영됩니다.', 'success');
    } catch (error) {
      addNotification(`이미지 첨부 실패: ${error.message}`, 'error');
    } finally {
      setImageAttaching(false);
    }
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) displayedProducts.forEach((product) => next.delete(product.id));
      else displayedProducts.forEach((product) => next.add(product.id));
      return next;
    });
  };

  const handleToggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;

      addNotification(`${ids.length}개 상품을 삭제했습니다.`, 'success');
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      fetchProducts();
    } catch (error) {
      addNotification(`선택 삭제 실패: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirmText !== DELETE_ALL_CONFIRM_TEXT) {
      addNotification(`"${DELETE_ALL_CONFIRM_TEXT}"를 정확히 입력해 주세요.`, 'warning');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from('products').delete().not('id', 'is', null);
      if (error) throw error;

      addNotification('전체 상품을 삭제했습니다.', 'success');
      setDeleteAllDialogOpen(false);
      setDeleteAllConfirmText('');
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      addNotification(`전체 삭제 실패: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenBulkEdit = () => {
    setBulkIsPopular(null);
    setBulkIsNew(null);
    setBulkOnlineCode(null);
    setBulkTags([]);
    setBulkTagsMode('append');
    setBulkEditOpen(true);
  };

  const handleBulkSave = async () => {
    if (bulkIsPopular === null && bulkIsNew === null && bulkOnlineCode === null && bulkTags.length === 0) {
      addNotification('변경할 항목이 없습니다.', 'warning');
      return;
    }

    setBulkSaving(true);
    try {
      const ids = Array.from(selectedIds);

      // includes_online_code 컬럼 미적용 환경 graceful — PGRST204면 해당 키 빼고 1회 재시도.
      const applyUpdate = async (update, target) => {
        let { error } = await target(update);
        if (error && error.code === 'PGRST204' && 'includes_online_code' in update) {
          const rest = { ...update };
          delete rest.includes_online_code;
          ({ error } = await target(rest));
        }
        if (error) throw error;
      };

      if (bulkTags.length > 0 && bulkTagsMode === 'append') {
        const { data: existingRows, error: fetchError } = await supabase
          .from('products')
          .select('id, tags')
          .in('id', ids);
        if (fetchError) throw fetchError;

        for (const row of existingRows || []) {
          const update = {};
          if (bulkIsPopular !== null) update.is_popular = bulkIsPopular;
          if (bulkIsNew !== null) update.is_new = bulkIsNew;
          if (bulkOnlineCode !== null) update.includes_online_code = bulkOnlineCode;
          update.tags = Array.from(new Set([...(row.tags || []), ...bulkTags]));

          await applyUpdate(update, (u) => supabase.from('products').update(u).eq('id', row.id));
        }
      } else {
        const update = {};
        if (bulkIsPopular !== null) update.is_popular = bulkIsPopular;
        if (bulkIsNew !== null) update.is_new = bulkIsNew;
        if (bulkOnlineCode !== null) update.includes_online_code = bulkOnlineCode;
        if (bulkTags.length > 0) update.tags = bulkTags;

        await applyUpdate(update, (u) => supabase.from('products').update(u).in('id', ids));
      }

      addNotification(`${ids.length}개 상품을 일괄 수정했습니다.`, 'success');
      setBulkEditOpen(false);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      addNotification(`일괄 수정 실패: ${error.message}`, 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const CHUNK_SIZE = 100;

  const handleFileUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('엑셀 업로드 권한이 없습니다.', 'error');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setUploadErrors([]);
    setUploadLog([]);
    setUploadSuccessCount(0);
    setUploadDialogOpen(true);
    setUploadProgress({ current: 0, total: 0, phase: 'parsing' });

    try {
      // Phase 1: Parse Excel — 양식 v2(1행 안내문·2행 헤더·괄호 설명) + 구양식(1행 헤더) 모두 흡수.
      // 헤더 행 탐지·괄호 헤더 정규화·열 존재 게이트(온라인코드·판매여부)·검사 외 온라인코드 false 강제는
      // utils/productExcel.parseProductSheet 에서 처리(단위 테스트 대상).
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const { products: allProducts } = parseProductSheet(worksheet);

      // Phase 2: Client-side validation
      const validationErrors = [];
      const seenCodes = new Map();
      const validProducts = [];

      for (const product of allProducts) {
        const rowNum = product._rowNum;
        if (!product.product_code) {
          validationErrors.push({ row: rowNum, product_code: '(빈값)', name: product.name || '-', error: '상품코드 필수' });
          continue;
        }
        if (!product.name) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: '(빈값)', error: '상품명 필수' });
          continue;
        }
        if (!categories.includes(product.category)) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: product.name, error: '카테고리는 검사/도서/도구만 허용' });
          continue;
        }
        if (seenCodes.has(product.product_code)) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: product.name, error: `엑셀 내 중복 (${seenCodes.get(product.product_code)}행과 동일)` });
          continue;
        }
        seenCodes.set(product.product_code, rowNum);
        // Remove internal _rowNum before sending to server
        const { _rowNum, ...cleanProduct } = product;
        validProducts.push({ ...cleanProduct, _rowNum: rowNum });
      }

      if (validationErrors.length > 0) {
        setUploadErrors(prev => [...prev, ...validationErrors]);
        setUploadLog(prev => [...prev, `사전 검증: ${validationErrors.length}건 오류 발견`]);
      }

      if (validProducts.length === 0) {
        setUploadProgress({ current: 0, total: 0, phase: 'error' });
        setUploadLog(prev => [...prev, '유효한 상품이 없습니다.']);
        return;
      }

      // Phase 2.5: 검사 위계 매칭 — (검사군약어, 검사군명)으로 test_group_id 해결(없으면 생성).
      // 빈 열은 미변경(payload에서 제외 → 기존 값 보존). 구양식(위계 열 없음)이면 이 단계가 사실상 no-op.
      // seed_hierarchy.py 와 동일 dedup((abbr, name)). 검사군 매칭은 검사 상품에만 의미.
      const existingGroups = await fetchTestGroups().catch(() => []);
      const resolveGroup = makeTestGroupResolver(existingGroups);
      let hierApplied = 0;
      for (const product of validProducts) {
        const h = product._hier || {};
        const hasGroup = h.groupName != null && String(h.groupName).trim() !== '';
        // 검사군 연결 — 검사군명이 있을 때만. (약어는 nullable) 검사 카테고리만 실질 대상.
        if (hasGroup) {
          const gid = await resolveGroup(h.abbr, h.groupName);
          if (gid != null) product.test_group_id = gid;
        }
        // 옵션 필드 — 열이 채워진 것만 반영(빈 열 = 미변경, 기존 값 보존).
        if (h.option_name != null && String(h.option_name).trim() !== '') product.option_name = String(h.option_name).trim();
        if (h.option_label != null && String(h.option_label).trim() !== '') product.option_label = String(h.option_label).trim();
        if (h.is_common != null && String(h.is_common).trim() !== '') product.is_common = parseBool(h.is_common);
        if (h.sort_order != null && String(h.sort_order).trim() !== '') {
          const so = parseInt(h.sort_order, 10);
          if (Number.isFinite(so)) product.sort_order = so;
        }
        // is_active(판매여부)는 검사 전용이 아니라 H열(공통 구역) — parseProductSheet 에서 최상위 필드로 이미 반영됨.
        if (hasGroup || product.option_name !== undefined || product.option_label !== undefined || product.is_common !== undefined || product.sort_order !== undefined) hierApplied++;
      }
      if (hierApplied > 0) {
        setUploadLog(prev => [...prev, `검사 위계 열 반영: ${hierApplied}건 (검사군 매칭·옵션 표기)`]);
      }

      // Phase 3: Chunked upload
      const totalValid = validProducts.length;
      setUploadProgress({ current: 0, total: totalValid, phase: 'uploading' });

      const chunks = [];
      for (let i = 0; i < validProducts.length; i += CHUNK_SIZE) {
        chunks.push(validProducts.slice(i, i + CHUNK_SIZE));
      }

      let totalSuccess = 0;
      const serverErrors = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStart = i * CHUNK_SIZE;
        // Strip 내부 필드(_rowNum·_hier) 후 전송. image_filename 빈값은 제외(미적용 환경 회귀 방지).
        // 검사 위계 컬럼(test_group_id·option_name·option_label·is_common·sort_order·is_active)은
        // Phase 2.5에서 채워진 것만 남아 있음(빈 열=미포함=기존 값 보존).
        const buildPayload = (withHierarchy) => chunk.map((p) => {
          const rest = { ...p };
          delete rest._rowNum;
          delete rest._hier;
          if (rest.image_filename == null) delete rest.image_filename;
          if (!withHierarchy) {
            // 마이그레이션 미적용(컬럼 없음) 환경 graceful — 신규 컬럼(위계·개별할인율·온라인코드) 제거 후 재시도.
            delete rest.test_group_id;
            delete rest.option_name;
            delete rest.option_label;
            delete rest.is_common;
            delete rest.sort_order;
            delete rest.is_active;
            delete rest.discount_override;
            delete rest.includes_online_code;
          }
          return rest;
        });
        let payload = buildPayload(true);

        try {
          let { data, error } = await supabase.functions.invoke('upload-products-excel', {
            body: { products: payload },
          });

          // 신규 위계 컬럼 미적용 환경 — 컬럼 미존재 오류면 위계 열 빼고 1회 재시도(구스키마 회귀 0).
          // Edge Fn은 배치 실패 시 행별 폴백으로 200+errors[]를 돌려줄 수 있어, data.errors 도 함께 감지.
          const columnMissing = (msg) => /column|does not exist|PGRST204|schema cache/i.test(msg || '');
          const newColsSent = payload.some((p) => 'test_group_id' in p || 'option_name' in p || 'option_label' in p || 'is_common' in p || 'sort_order' in p || 'is_active' in p || 'discount_override' in p || 'includes_online_code' in p);
          const dataColErr = data?.error_count > 0 && (data.errors || []).some((e) => columnMissing(e.error));
          if (newColsSent && ((error && columnMissing(error.message)) || dataColErr)) {
            payload = buildPayload(false);
            ({ data, error } = await supabase.functions.invoke('upload-products-excel', { body: { products: payload } }));
            if (!error) setUploadLog(prev => [...prev, `청크 ${i + 1}: 신규 컬럼(위계·개별할인율·온라인코드) 미적용 환경 — 기본 열만 반영`]);
          }

          if (error) {
            // Entire chunk failed
            chunk.forEach((p) => {
              serverErrors.push({ row: p._rowNum, product_code: p.product_code, name: p.name, error: error.message });
            });
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 실패: ${error.message}`]);
          } else if (data?.error_count > 0) {
            // Partial failure
            totalSuccess += data.success_count || 0;
            (data.errors || []).forEach((e) => {
              const originalProduct = chunk[e.row_index];
              serverErrors.push({
                row: originalProduct?._rowNum || chunkStart + e.row_index + 2,
                product_code: e.product_code,
                name: e.name,
                error: e.error,
              });
            });
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length}: ${data.success_count}건 성공, ${data.error_count}건 실패`]);
          } else {
            totalSuccess += data?.success_count || chunk.length;
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 완료 (${chunk.length}건)`]);
          }
        } catch (err) {
          chunk.forEach((p) => {
            serverErrors.push({ row: p._rowNum, product_code: p.product_code, name: p.name, error: err.message });
          });
          setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 오류: ${err.message}`]);
        }

        setUploadProgress({ current: Math.min((i + 1) * CHUNK_SIZE, totalValid), total: totalValid, phase: 'uploading' });
      }

      // Done
      setUploadSuccessCount(totalSuccess);
      if (serverErrors.length > 0) {
        setUploadErrors(prev => [...prev, ...serverErrors]);
      }
      setUploadProgress(prev => ({ ...prev, phase: 'done' }));
      fetchProducts();

    } catch (error) {
      setUploadProgress({ current: 0, total: 0, phase: 'error' });
      setUploadLog(prev => [...prev, `파싱 오류: ${error.message}`]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 이미지 일괄 업로드 — 다중 파일을 product-images 공개 버킷에 파일명 그대로 올린다.
  // 와박팀 엑셀 "이미지" 열과 파일명이 일치하면 카드에 즉시 매칭된다.
  const handleImageUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('이미지 업로드 권한이 없습니다.', 'error');
      return;
    }
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImageUploadResults([]);
    setImageUploadProgress({ current: 0, total: files.length, running: true });
    setImageUploadOpen(true);

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 업로드 전 파일명 검증 — 한글·공백·특수문자면 Storage 키가 깨진다. 위반 파일은 시도 없이 실패 기록.
      if (!SAFE_IMAGE_FILENAME.test(file.name)) {
        results.push({ name: file.name, ok: false, error: '파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장' });
      } else {
        const { error } = await uploadProductImage(file);
        results.push({ name: file.name, ok: !error, error: error?.message });
      }
      setImageUploadResults([...results]);
      setImageUploadProgress({ current: i + 1, total: files.length, running: true });
    }

    setImageUploadProgress((prev) => ({ ...prev, running: false }));
    const failCount = results.filter((r) => !r.ok).length;
    if (failCount === 0) {
      addNotification(`이미지 ${results.length}개 업로드 완료`, 'success');
    } else {
      addNotification(`이미지 업로드 완료 — 성공 ${results.length - failCount}, 실패 ${failCount}`, 'warning');
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // 정적 양식 파일을 그대로 내려준다(건우님이 다듬은 안내문·색상·틀고정·상품 예시 9행 1:1 보존).
  // json_to_sheet 하드코딩 폐기 — 서식 보존이 목적. 선례: utils/depositResolution·paymentReceipt 정적 양식.
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/templates/product-upload-template.xlsx');
      if (!res.ok) throw new Error(`양식 파일을 불러오지 못했습니다 (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '상품_업로드_양식.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification('업로드 양식을 다운로드했습니다.', 'success');
    } catch (error) {
      addNotification(`양식 다운로드 실패: ${error.message}`, 'error');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const [products, groups] = await Promise.all([fetchAllProducts(), fetchTestGroups()]);
      // 확정 양식 v2 서식(안내문·색상 헤더·검사 전용 열 색·틀고정 A3·자동필터) 그대로 전체 상품을 채워 내보낸다.
      // 열 순서·값 포맷은 업로드 파서(parseProductSheet)와 라운드트립 정합. util로 분리(단위 테스트).
      await exportProductList({ products, groups });
      addNotification('상품 목록을 다운로드했습니다.', 'success');
    } catch (error) {
      addNotification(`엑셀 다운로드 실패: ${error.message}`, 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSearchResetKey(k => k + 1);
    setSelectedCategory('');
    setCurrentPage(1);
    setFacets(DEFAULT_FACETS);
    setSelectedTags([]);
  };

  const setFacet = (key, value) => setFacets((prev) => ({ ...prev, [key]: value }));

  // ── 소분류 마스터 CRUD (즉시 DB 반영) ──
  const handleSaveSub = async () => {
    const d = subDialog;
    if (!d.name?.trim()) {
      addNotification('소분류 이름을 입력해 주세요.', 'warning');
      return;
    }
    if (!PARENT_CATEGORIES.includes(d.parent_category)) {
      addNotification('소속 대분류를 선택해 주세요.', 'warning');
      return;
    }
    const dup = subcategories.some(
      (s) => s.parent_category === d.parent_category && s.name.trim() === d.name.trim() && s.id !== d.id,
    );
    if (dup) {
      addNotification('같은 대분류에 동일한 이름의 소분류가 이미 있습니다.', 'warning');
      return;
    }
    setMasterSaving(true);
    try {
      const payload = {
        name: d.name.trim(),
        parent_category: d.parent_category,
        color: d.color,
        sort_order: Number(d.sort_order) || 0,
        is_active: d.is_active,
      };
      if (d.id) await updateSubcategory(d.id, payload);
      else await createSubcategory(payload);
      addNotification('소분류가 저장되었습니다.', 'success');
      setSubDialog(null);
      loadMasters();
    } catch (error) {
      addNotification(`소분류 저장 실패: ${error.message}`, 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteSub = async (sub) => {
    const count = masterUsage.subCounts[sub.name] || 0;
    if (count > 0) {
      addNotification(`이 소분류를 쓰는 상품 ${count}개가 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    try {
      await deleteSubcategory(sub.id);
      addNotification('소분류를 삭제했습니다.', 'success');
      loadMasters();
    } catch (error) {
      addNotification(`소분류 삭제 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleSubActive = async (sub) => {
    try {
      await updateSubcategory(sub.id, { is_active: !sub.is_active });
      loadMasters();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  // ── 검사군 관리 (test_groups) — '검사' 그룹 뷰 안에서 인라인 진입 ──
  const handleToggleTgActive = async (group) => {
    // 현행 확정(R4): 검사군 is_active는 카드 노출만 제어(옵션 개별 불변), 진열 일관 — 전파 안 함.
    try {
      await updateTestGroup(group.id, { is_active: !group.is_active });
      loadTestGroups();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  // 검사군 삭제 (위험 액션 — 확인 스텝). 마스터만 제거, 소속 상품은 FK SET NULL 로 보존.
  const handleDeleteTestGroup = async () => {
    if (!tgDeleteTarget) return;
    setTgActionRunning(true);
    try {
      await deleteTestGroup(tgDeleteTarget.id);
      addNotification('검사군을 삭제했습니다 (소속 옵션은 낱개로 풀림).', 'success');
      setTgDeleteTarget(null);
      loadTestGroups();
    } catch (error) {
      addNotification(`검사군 삭제 실패: ${error.message}`, 'error');
    } finally {
      setTgActionRunning(false);
    }
  };

  // 병합 진입 — 그룹 헤더 메뉴에서 이 검사군을 대표(keep)로 지정하고, 흡수할 다른 검사군을 다이얼로그에서 선택.
  const handleOpenMerge = (keepGroup) => {
    setTgMergeKeep(keepGroup);
    setTgMergeAbsorb(new Set());
  };

  const handleToggleMergeAbsorb = (id) => {
    setTgMergeAbsorb((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 병합 (N→1 위험 액션 — 확인 스텝). 흡수 검사군 옵션을 대표로 이관 후 빈 검사군 삭제.
  const handleMerge = async () => {
    if (!tgMergeKeep || tgMergeAbsorb.size === 0) return;
    setTgActionRunning(true);
    try {
      await mergeTestGroups(tgMergeKeep.id, [tgMergeKeep.id, ...Array.from(tgMergeAbsorb)]);
      addNotification('검사군을 병합했습니다.', 'success');
      setTgMergeKeep(null);
      setTgMergeAbsorb(new Set());
      loadTestGroups();
      fetchProducts();
    } catch (error) {
      addNotification(`병합 실패: ${error.message}`, 'error');
    } finally {
      setTgActionRunning(false);
    }
  };

  // 모달 저장/이동/삭제 후 상위 리로드 — 검사군 목록·카운트·상품 전량 재동기화.
  const handleTgEditorSaved = useCallback(() => {
    loadTestGroups();
    fetchProducts();
  }, [loadTestGroups, fetchProducts]);

  if (!user || !hasPermission('products:view')) {
    return <Box sx={{ p: 3 }}><Typography>상품 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  const canEdit = hasPermission('products:edit');
  const tableColumnCount = canEdit ? 10 : 9;

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Tooltip title="엑셀 양식 다운로드">
        <IconButton onClick={handleDownloadTemplate} sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
          <DescriptionIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="상품 목록 다운로드">
        <IconButton onClick={handleDownloadExcel} sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      {hasPermission('products:edit') && (
        <>
          <Tooltip title="엑셀 업로드 (product_code 기준 upsert)">
            <IconButton component="label" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <UploadIcon />
              <input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </IconButton>
          </Tooltip>
          <Tooltip title="상품 이미지 일괄 업로드 (파일명 그대로 — 엑셀 '이미지' 열과 일치 · 권장: 파일명을 상품코드로(영문/숫자))">
            <IconButton component="label" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
              <PhotoLibraryIcon />
              <input ref={imageInputRef} hidden type="file" accept="image/*" multiple onChange={handleImageUpload} />
            </IconButton>
          </Tooltip>
          <Tooltip title="소분류 관리">
            <Button
              variant="outlined"
              size="small"
              startIcon={<CategoryIcon />}
              endIcon={masterPanelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setMasterPanelOpen((prev) => !prev)}
            >
              소분류 관리
            </Button>
          </Tooltip>
          <Tooltip title="전체 삭제">
            <IconButton
              onClick={() => {
                setDeleteAllConfirmText('');
                setDeleteAllDialogOpen(true);
              }}
              sx={{ bgcolor: alpha(theme.palette.error.main, 0.08), color: 'error.main' }}
            >
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            상품 추가
          </Button>
        </>
      )}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="상품 관리"
        icon={Inventory2Icon}
        action={headerAction}
      />

      {/* 소분류 마스터 관리 — 헤더 액션부에서 펼침/접이. 즉시 저장(하단 저장버튼 없음). */}
      {hasPermission('products:edit') && (
        <Collapse in={masterPanelOpen} unmountOnExit>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {/* 소분류 관리 */}
            <SectionCard
              title="소분류 관리"
              subtitle="대분류(검사/도서/도구) 하위의 분류입니다. 고객 주문서에서 칩으로 노출되며 탐색에 쓰입니다. (매출 집계에는 영향 없음 · 추가·수정·삭제 즉시 적용)"
              icon={AccountTreeIcon}
              padding={24}
              sx={{ flex: '1 1 360px', minWidth: 300 }}
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setSubDialog({ name: '', parent_category: '', color: MASTER_COLOR_PRESETS[0].value, sort_order: 0, is_active: true })}
                >
                  소분류 추가
                </Button>
              }
            >
              <Box sx={{ mt: 1 }}>
                {subcategories.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}>
                    등록된 소분류가 없습니다 · 추가해 시작하세요
                  </Typography>
                ) : (
                  subcategories.map((sub) => {
                    const count = masterUsage.subCounts[sub.name] || 0;
                    return (
                      <Box
                        key={sub.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 1,
                          borderBottom: `1px solid ${theme.gray[100]}`,
                          opacity: sub.is_active ? 1 : 0.5,
                        }}
                      >
                        <ColorChip label={sub.name} color={sub.color} />
                        <Chip label={sub.parent_category} size="small" variant="outlined" color="primary" />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>순서 {sub.sort_order}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>· 상품 {count}개</Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title={sub.is_active ? '활성 (신규 선택지에 노출)' : '비활성 (숨김)'} arrow>
                          <Switch size="small" checked={sub.is_active} onChange={() => handleToggleSubActive(sub)} />
                        </Tooltip>
                        <IconButton size="small" onClick={() => setSubDialog({ ...sub })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={count > 0 ? `상품 ${count}개 연결 — 삭제 불가` : '삭제'} arrow>
                          <span>
                            <IconButton size="small" onClick={() => handleDeleteSub(sub)} disabled={count > 0} sx={{ color: count > 0 ? 'text.disabled' : 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })
                )}
              </Box>
            </SectionCard>
          </Box>
        </Collapse>
      )}

      {/* ─── 필터 바(A6 §필터 바 2026-10-19) — 속성별 단일 선택(속성 간 AND) + 태그 다중(OR) ─── */}
      <SectionCard sx={{ mb: 2 }} padding={20}>
        {/* 표시 건수 + 필터 초기화(우측 상단, 상시 노출·필터 없으면 disabled) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, mb: 1.5, minHeight: 36 }}>
          {hasFilters && (
            <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum" 1' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{totalFiltered}</Box>개 표시 중
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={handleResetFilters}
            disabled={!hasFilters}
            sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
          >
            필터 초기화
          </Button>
        </Box>

        {/* 카테고리 — '검사' 선택 시 그룹 뷰가 디폴트이자 유일 뷰. 검사군 추가는 이 뷰에서만 노출. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          <FacetToggle
            label="카테고리"
            value={selectedCategory || null}
            options={CATEGORY_FILTER_OPTIONS}
            onChange={setSelectedCategory}
            clearable
          />
          {groupViewActive && canEdit && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
              onClick={() => setTgEditor({ group: null })}
              sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
            >
              검사군 추가
            </Button>
          )}
        </Box>

        {/* 속성(Y/N) 2열 그리드 */}
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
          <FacetToggle label="온라인코드" value={facets.onlineCode} options={ONLINE_CODE_OPTIONS} onChange={(v) => setFacet('onlineCode', v)} />
        </Box>

        {availableTags.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />

            {/* 태그(학회 ∪ 자유 태그, 다중 OR) */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 68, pt: 0.75, flexShrink: 0 }}>
                <TagIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>태그</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                {availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      clickable
                      onClick={() => setSelectedTags((prev) => (
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      ))}
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
                        // 학회 태그 실선 · 자유 태그 점선(그룹 구분용 중립 테두리 — 색 인디케이터 아님)
                        ...(societyTagSet.has(tag) ? {} : { borderStyle: 'dashed' }),
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
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* 상품명 검색 — 조건을 고른 뒤 마지막에 좁히는 단계라 맨 아래. 로컬 state+debounce(검색 input 격리). */}
        <ProductSearchBar
          onSearch={setSearchTerm}
          delay={60}
          label="상품명 검색"
          placeholder="상품명으로 검색 (검사군명·약어 포함)"
          size="small"
          sx={{ mb: 0, width: '100%' }}
          resetKey={searchResetKey}
        />
      </SectionCard>

      {selectedCount > 0 && hasPermission('products:edit') && (
        <SectionCard
          padding={0}
          sx={{
            mb: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderColor: alpha(theme.palette.primary.main, 0.2),
          }}
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
                {/* 그룹 뷰엔 전체 선택 체크박스가 없어 선택은 평면 뷰에서 넘어온 잔여분일 수 있다.
                    접힌 검사군의 안 보이는 선택 항목 오삭제를 막기 위한 안내 1줄. */}
                {groupViewActive && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    선택된 상품이 현재 화면에 보이지 않을 수 있습니다.
                  </Typography>
                )}
              </Box>
            }
          >
            <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={handleOpenBulkEdit}>
              선택 항목 편집
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteDialogOpen(true)}>
              선택 삭제
            </Button>
            <Button size="small" variant="text" onClick={() => setSelectedIds(new Set())}>
              선택 해제
            </Button>
          </ActionSlot>
        </SectionCard>
      )}

      <SectionCard padding={0}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                {hasPermission('products:edit') && (
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    {/* 그룹 뷰에선 전체 선택 체크박스를 렌더하지 않는다(빈 셀로 정렬 유지).
                        평면 슬라이스(displayedProducts)를 선택하면 접힌 검사군의 안 보이는 상품이
                        선택돼 오삭제로 이어질 수 있어서. 그룹-aware 선택은 팬아웃 편집 트랙에서 다룬다. */}
                    {!groupViewActive && (
                      <Checkbox
                        size="small"
                        checked={allPageSelected}
                        indeterminate={somePageSelected && !allPageSelected}
                        onChange={handleToggleAll}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 'bold' }} align="center">이미지</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>하위 카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">가격</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>비고</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">상태 태그</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
                {hasPermission('products:edit') && <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={10} columns={tableColumnCount} />
              ) : groupViewActive ? (
                groupedView.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} sx={{ border: 0, py: 4 }}>
                      <EmptyState
                        icon={InventoryIcon}
                        title={hasFilters ? '검색 결과가 없습니다' : '표시할 검사가 없습니다'}
                        description={hasFilters ? '다른 검색어나 필터를 시도해 보세요' : '검사 상품을 추가하거나 검사군을 정리해 주세요'}
                        action={hasFilters ? { label: '필터 초기화', onClick: handleResetFilters, startIcon: <RestartAltIcon /> } : undefined}
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
                        {/* 검사군 그룹 헤더 행 — 약어·검사명·옵션N 요약(가격 은닉) + 검사군 단위 인라인 관리(노출/편집/메뉴).
                            묶음 편집(검사명·약어·노출·분리·병합·삭제)은 여기서, 옵션(상품) 편집은 하위 행 편집 버튼에서. */}
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
                          {canEdit && <TableCell padding="checkbox" />}
                          <TableCell align="center" sx={{ width: 48 }}>
                            <IconButton size="small" tabIndex={-1}>
                              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell colSpan={tableColumnCount - 1 - (canEdit ? 1 : 0) - (canEdit && group ? 2 : 0)}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                              {group?.abbr && (
                                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                  {group.abbr}
                                </Typography>
                              )}
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {group ? group.name : '미분류'}
                              </Typography>
                              {hiddenGroup && (
                                <Chip label="숨김" size="small" sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }} />
                              )}
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                옵션 {(group ? tgOptionCounts[group.id] : options.length) ?? options.length}개
                              </Typography>
                            </Box>
                          </TableCell>
                          {/* 검사군 단위 인라인 관리 — 미분류(group===null)는 마스터가 없으므로 액션 없음 */}
                          {canEdit && group && (
                            <TableCell align="center" colSpan={2} onClick={(e) => e.stopPropagation()} sx={{ cursor: 'default' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                                <Switch size="small" checked={group.is_active} onChange={() => handleToggleTgActive(group)} title={group.is_active ? '노출 중 (끄면 검사군 카드 숨김)' : '숨김'} />
                                <IconButton size="small" onClick={() => setTgEditor({ group })} title="검사군 상세 편집">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => setTgMenuAnchor({ el: e.currentTarget, group })} title="상세 편집·병합·삭제">
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          )}
                        </TableRow>
                        {/* 옵션 하위 행 — 평면 표 셀 구성 그대로 재사용(ProductRow isOption). 상품명 셀만 들여쓰기 + 말머리·형태명. */}
                        {expanded && options.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            selected={selectedIds.has(product.id)}
                            canEdit={canEdit}
                            isOption
                            subColorByName={subColorByName}
                            theme={theme}
                            onToggle={handleToggleOne}
                            onEdit={handleOpen}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })
                )
              ) : displayedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasPermission('products:edit') ? 10 : 9} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      icon={InventoryIcon}
                      title={hasFilters ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
                      description={hasFilters ? '다른 검색어나 필터를 시도해 보세요' : '새 상품을 추가해 시작하세요'}
                      action={
                        hasFilters
                          ? { label: '필터 초기화', onClick: handleResetFilters, startIcon: <RestartAltIcon /> }
                          : hasPermission('products:edit')
                          ? { label: '상품 추가', onClick: () => handleOpen(), startIcon: <AddIcon /> }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayedProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selectedIds.has(product.id)}
                    canEdit={canEdit}
                    isOption={false}
                    subColorByName={subColorByName}
                    theme={theme}
                    onToggle={handleToggleOne}
                    onEdit={handleOpen}
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
                onChange={(event) => {
                  setProductsPerPage(parseInt(event.target.value, 10));
                  setCurrentPage(1);
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Pagination count={Math.max(1, Math.ceil((groupViewActive ? groupedView.length : totalFiltered) / productsPerPage))} page={currentPage} onChange={(_, page) => setCurrentPage(page)} color="primary" />
          </Box>
        )}
      </SectionCard>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEditing ? '상품 수정' : '새 상품 추가'}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField autoFocus name="name" label="상품명" fullWidth value={currentProduct.name} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <TextField name="product_code" label="상품 코드" fullWidth value={currentProduct.product_code} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth required error={categoryInvalid} disabled={!hasPermission('products:edit')}>
                <InputLabel id="product-category-label">카테고리</InputLabel>
                <Select
                  labelId="product-category-label"
                  name="category"
                  label="카테고리"
                  value={currentProduct.category || ''}
                  onChange={handleChange}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                freeSolo
                fullWidth
                options={subOptionsForCategory}
                value={currentProduct.sub_category || ''}
                onInputChange={(_, value) => setCurrentProduct((prev) => ({ ...prev, sub_category: value }))}
                disabled={!hasPermission('products:edit')}
                renderInput={(params) => {
                  const v = (currentProduct.sub_category || '').trim();
                  const unregistered = Boolean(v) && !subOptionsForCategory.includes(v) && !subcategories.some((s) => s.name === v);
                  return (
                    <TextField
                      {...params}
                      label="하위 카테고리"
                      placeholder="소분류 선택 또는 입력"
                      helperText={unregistered ? '마스터에 미등록된 소분류입니다 (설정에서 추가 가능)' : ' '}
                      FormHelperTextProps={{ sx: { color: unregistered ? 'text.disabled' : 'transparent' } }}
                    />
                  );
                }}
              />
            </Box>
            <TextField name="list_price" label="가격" type="number" fullWidth value={currentProduct.list_price} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <TextField name="notes" label="비고" fullWidth multiline rows={3} value={currentProduct.notes || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            {/* 상품 이미지 — 개별 첨부(단일 파일). 일괄 업로드와 달리 파일명을 안전하게 새로 지어(buildProductImageFilename)
                한글 파일명 사진도 그대로 받는다. 첨부 즉시 버킷 업로드, image_filename 반영은 저장 시(폼 상태). */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>상품 이미지</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'grey.100',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <ProductImagePreview
                    key={currentProduct.image_filename || 'none'}
                    filename={currentProduct.image_filename}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  {hasPermission('products:edit') && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={imageAttaching ? <CircularProgress size={16} /> : <PhotoLibraryIcon />}
                        onClick={() => productImageInputRef.current?.click()}
                        disabled={imageAttaching}
                      >
                        {imageAttaching ? '첨부 중…' : '이미지 첨부'}
                      </Button>
                      {currentProduct.image_filename && (
                        <Button
                          variant="text"
                          size="small"
                          color="error"
                          onClick={() => setCurrentProduct((prev) => ({ ...prev, image_filename: '' }))}
                          disabled={imageAttaching}
                        >
                          제거
                        </Button>
                      )}
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    JPG·PNG·WEBP·GIF, 1MB 이하(200KB 이하 권장). 파일명은 자동으로 정리됩니다.
                  </Typography>
                </Box>
              </Box>
              <input
                ref={productImageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAttachProductImage}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel control={<Checkbox checked={currentProduct.is_discountable} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_discountable: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="할인 가능" />
              <TextField
                name="discount_override"
                label="개별 할인율 (%)"
                type="number"
                size="small"
                sx={{ width: 170 }}
                value={rateToPercentNullable(currentProduct.discount_override)}
                onChange={(event) => {
                  const rate = percentToRateNullable(event.target.value);
                  // auto-T: 개별 할인율(>0) 지정 시 '할인 가능'을 자동으로 켠다.
                  // 공식상 override가 이겨서 가격은 이미 맞지만, 데이터 정합·UI 명료성(할인 상품으로 노출·필터)을 위해 맞춤.
                  // 비우거나 0으로 되돌리면 강제 유지하지 않는다.
                  const shouldAutoOn = rate != null && rate > 0 && !currentProduct.is_discountable;
                  setCurrentProduct((prev) => ({
                    ...prev,
                    discount_override: rate,
                    is_discountable: shouldAutoOn ? true : prev.is_discountable,
                  }));
                  if (shouldAutoOn) {
                    addNotification("개별 할인율을 지정해 '할인 가능'을 자동으로 켰습니다.", 'info');
                  }
                }}
                disabled={!hasPermission('products:edit')}
                inputProps={{ min: 0, max: 100 }}
                helperText="비우면 행사 할인율 적용"
              />
              <FormControlLabel control={<Checkbox checked={currentProduct.is_popular} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_popular: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="인기 상품" />
              <FormControlLabel control={<Checkbox checked={currentProduct.is_new} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_new: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="신상품" />
              {/* 온라인코드 포함 — 3상태(미확인/포함/미포함). 체크박스로 뭉개지 않고 NULL(미확인)을 명시 보존. */}
              <FormControl size="small" sx={{ minWidth: 180 }} disabled={!hasPermission('products:edit')}>
                <InputLabel>온라인코드 포함</InputLabel>
                <Select
                  label="온라인코드 포함"
                  value={currentProduct.includes_online_code == null ? 'unknown' : currentProduct.includes_online_code ? 'yes' : 'no'}
                  onChange={(event) => {
                    const v = event.target.value;
                    setCurrentProduct((prev) => ({
                      ...prev,
                      includes_online_code: v === 'unknown' ? null : v === 'yes',
                    }));
                  }}
                >
                  <MenuItem value="unknown">미확인</MenuItem>
                  <MenuItem value="yes">포함</MenuItem>
                  <MenuItem value="no">미포함</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {/* 노출 여부 — 진열 즉영향 전역 스위치(체크박스와 시각 구분). 되돌리기 가능이라 확인 스텝 없음. */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>고객 주문서 노출</Typography>
                  {currentProduct.is_active === false && (
                    <Chip label="숨김" size="small" sx={{ bgcolor: theme.gray[200], color: 'text.secondary', border: 0, fontWeight: 600 }} />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  끄면 주문서에서 숨겨집니다 (데이터는 보존 — 삭제 아님)
                </Typography>
              </Box>
              <Switch
                checked={currentProduct.is_active !== false}
                onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_active: event.target.checked }))}
                disabled={!hasPermission('products:edit')}
              />
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={currentProduct.tags || []}
              onChange={(_, value) => setCurrentProduct((prev) => ({ ...prev, tags: value }))}
              renderTags={(value, getTagProps) => value.map((option, index) => (
                <Chip key={index} variant="outlined" label={option} {...getTagProps({ index })} />
              ))}
              renderInput={(params) => <TextField {...params} label="태그 (검색 편의)" placeholder="태그 추가" fullWidth />}
              disabled={!hasPermission('products:edit')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          {hasPermission('products:edit') && <Button onClick={handleSave} variant="contained">저장</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>선택 상품 삭제</DialogTitle>
        <DialogContent>
          <Typography>선택한 <strong>{selectedCount}개</strong> 상품을 삭제합니다.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteSelected} variant="contained" color="error" disabled={deleting} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllDialogOpen} onClose={() => setDeleteAllDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>전체 상품 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>등록된 <strong>모든 상품</strong>을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            계속하려면 아래에 <strong>{DELETE_ALL_CONFIRM_TEXT}</strong> 를 입력하세요.
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder={DELETE_ALL_CONFIRM_TEXT}
            value={deleteAllConfirmText}
            onChange={(event) => setDeleteAllConfirmText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleDeleteAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteAllDialogOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteAll} variant="contained" color="error" disabled={deleting || deleteAllConfirmText !== DELETE_ALL_CONFIRM_TEXT} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            전체 삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          선택 항목 편집
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.25 }}>
            선택한 {selectedCount}개 상품에 적용됩니다.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <TriStateToggle label="인기 상품 (is_popular)" value={bulkIsPopular} onChange={setBulkIsPopular} />
          <TriStateToggle label="신상품 (is_new)" value={bulkIsNew} onChange={setBulkIsNew} />
          {/* 온라인코드 포함 — ON=포함 / OFF=미포함 / 변경 없음=건드리지 않음(미확인 보존). */}
          <TriStateToggle label="온라인코드 포함 (includes_online_code)" value={bulkOnlineCode} onChange={setBulkOnlineCode} />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">태그</Typography>
              <ToggleButtonGroup value={bulkTagsMode} exclusive size="small" onChange={(_, value) => { if (value) setBulkTagsMode(value); }}>
                <ToggleButton value="append" sx={{ px: 1.25, fontSize: '0.7rem' }}>추가</ToggleButton>
                <ToggleButton value="replace" sx={{ px: 1.25, fontSize: '0.7rem' }}>덮어쓰기</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={bulkTags}
              onChange={(_, value) => setBulkTags(value)}
              renderTags={(value, getTagProps) => value.map((option, index) => (
                <Chip key={index} variant="outlined" label={option} {...getTagProps({ index })} size="small" />
              ))}
              renderInput={(params) => <TextField {...params} size="small" placeholder={bulkTagsMode === 'append' ? '추가할 태그 입력' : '새 태그 목록 입력'} />}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkEditOpen(false)} disabled={bulkSaving}>취소</Button>
          <Button onClick={handleBulkSave} variant="contained" disabled={bulkSaving} startIcon={bulkSaving ? <CircularProgress size={14} /> : null}>
            {bulkSaving ? '적용 중...' : '적용'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 일괄 업로드 진행/결과 다이얼로그 */}
      <Dialog
        open={imageUploadOpen}
        onClose={imageUploadProgress.running ? undefined : () => setImageUploadOpen(false)}
        disableEscapeKeyDown={imageUploadProgress.running}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {imageUploadProgress.running ? '이미지 업로드 중' : '이미지 업로드 완료'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {imageUploadProgress.current} / {imageUploadProgress.total}
              </Typography>
              {!imageUploadProgress.running && (
                <Typography variant="body2" color="text.secondary">
                  실패 {imageUploadResults.filter((r) => !r.ok).length}건
                </Typography>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={imageUploadProgress.total ? (imageUploadProgress.current / imageUploadProgress.total) * 100 : 0}
            />
          </Box>
          {imageUploadResults.some((r) => !r.ok) && (
            <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
              {imageUploadResults.filter((r) => !r.ok).map((r) => (
                <Typography key={r.name} variant="caption" color="error.main" sx={{ display: 'block' }}>
                  {r.name}: {r.error || '실패'}
                </Typography>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
            권장: 파일명을 상품코드로(영문/숫자). 한글·공백·특수문자 파일명은 업로드되지 않습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageUploadOpen(false)} disabled={imageUploadProgress.running}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Progress Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={uploadProgress.phase === 'done' || uploadProgress.phase === 'error' ? () => setUploadDialogOpen(false) : undefined}
        disableEscapeKeyDown={uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing'}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {uploadProgress.phase === 'parsing' && '엑셀 파싱 중...'}
          {uploadProgress.phase === 'uploading' && '상품 업로드 중'}
          {uploadProgress.phase === 'done' && '업로드 완료'}
          {uploadProgress.phase === 'error' && '업로드 오류'}
        </DialogTitle>
        <DialogContent>
          {/* Progress bar */}
          {(uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing') && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress.phase === 'parsing' ? '파싱 중...' : `${uploadProgress.current.toLocaleString()} / ${uploadProgress.total.toLocaleString()}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress.total > 0 ? `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` : ''}
                </Typography>
              </Box>
              <LinearProgress
                variant={uploadProgress.phase === 'parsing' ? 'indeterminate' : 'determinate'}
                value={uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {/* Summary (done phase) */}
          {uploadProgress.phase === 'done' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', mb: 0.5 }}>
                성공: {uploadSuccessCount.toLocaleString()}건
              </Typography>
              {uploadErrors.length > 0 && (
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                  실패: {uploadErrors.length}건
                </Typography>
              )}
            </Box>
          )}

          {/* Log */}
          {uploadLog.length > 0 && (
            <Box sx={{ maxHeight: 150, overflow: 'auto', mb: 2, bgcolor: 'grey.50', borderRadius: 1, p: 1.5 }}>
              {uploadLog.map((line, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', color: line.includes('실패') || line.includes('오류') ? 'error.main' : 'text.secondary' }}>
                  {line}
                </Typography>
              ))}
            </Box>
          )}

          {/* Error table */}
          {uploadErrors.length > 0 && (uploadProgress.phase === 'done' || uploadProgress.phase === 'error') && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>오류 내역</Typography>
              <TableContainer sx={{ maxHeight: 200, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>행</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>상품코드</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>상품명</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>사유</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadErrors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ py: 0.5 }}>{err.row}</TableCell>
                        <TableCell sx={{ py: 0.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.product_code}</TableCell>
                        <TableCell sx={{ py: 0.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.name}</TableCell>
                        <TableCell sx={{ py: 0.5, color: 'error.main' }}>{err.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Note during upload */}
          {(uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing') && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
              업로드 중에는 창을 닫을 수 없습니다
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {uploadErrors.length > 0 && (uploadProgress.phase === 'done' || uploadProgress.phase === 'error') && (
            <Button
              size="small"
              onClick={() => {
                const text = uploadErrors.map(e => `${e.row}행\t${e.product_code}\t${e.name}\t${e.error}`).join('\n');
                navigator.clipboard.writeText(`행\t상품코드\t상품명\t사유\n${text}`);
                addNotification('오류 내역이 복사되었습니다.', 'info');
              }}
            >
              오류 내역 복사
            </Button>
          )}
          <Button
            variant="contained"
            disabled={uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing'}
            onClick={() => setUploadDialogOpen(false)}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 소분류 추가/수정 다이얼로그 (즉시 저장) */}
      <Dialog open={Boolean(subDialog)} onClose={() => setSubDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{subDialog?.id ? '소분류 수정' : '소분류 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            autoFocus
            label="소분류 이름"
            size="small"
            fullWidth
            value={subDialog?.name || ''}
            onChange={(e) => setSubDialog((p) => ({ ...p, name: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="sub-parent-label">소속 대분류</InputLabel>
            <Select
              labelId="sub-parent-label"
              label="소속 대분류"
              value={subDialog?.parent_category || ''}
              onChange={(e) => setSubDialog((p) => ({ ...p, parent_category: e.target.value }))}
            >
              {PARENT_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <ColorPresetPicker value={subDialog?.color} onChange={(c) => setSubDialog((p) => ({ ...p, color: c }))} />
          <TextField
            label="정렬 순서"
            type="number"
            size="small"
            fullWidth
            value={subDialog?.sort_order ?? 0}
            onChange={(e) => setSubDialog((p) => ({ ...p, sort_order: e.target.value }))}
            helperText="고객 화면 칩 노출 순서 (작을수록 먼저)"
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>미리보기</Typography>
            <ColorChip label={subDialog?.name || '소분류'} color={subDialog?.color} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSubDialog(null)} disabled={masterSaving}>취소</Button>
          <Button variant="contained" onClick={handleSaveSub} disabled={masterSaving}>
            {masterSaving ? <CircularProgress size={18} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 검사군 상세 편집 모달 — 검사군 + 옵션 CRUD·순서·이동·삭제 통합. state 격리(214행 렌더 무영향). */}
      <TestGroupEditorModal
        open={Boolean(tgEditor)}
        group={tgEditor?.group ?? null}
        allProducts={allProducts}
        testGroups={testGroups}
        canEdit={canEdit}
        canDelete={hasPermission('master')}
        onClose={() => setTgEditor(null)}
        onSaved={handleTgEditorSaved}
        addNotification={addNotification}
      />

      {/* 검사군 삭제 확인 (위험 액션). 마스터만 제거, 소속 상품은 보존(test_group_id NULL). */}
      <Dialog open={Boolean(tgDeleteTarget)} onClose={() => setTgDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>검사군 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            검사군 <strong>{tgDeleteTarget?.name}</strong>을 삭제합니다. 소속 옵션 <strong>{tgDeleteTarget ? (tgOptionCounts[tgDeleteTarget.id] || 0) : 0}개</strong>는 검사군에서 풀려 낱개로 진열됩니다(상품 자체는 삭제되지 않음).
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            절판·판매중지 상품은 삭제 대신 상품별 "고객 주문서 노출"을 꺼서 숨기는 편이 안전합니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTgDeleteTarget(null)} disabled={tgActionRunning}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTestGroup} disabled={tgActionRunning} startIcon={tgActionRunning ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 병합 확인 (위험 액션 N→1). 헤더 메뉴에서 이 검사군을 대표(keep)로 진입 → 흡수할 다른 검사군 선택. */}
      <Dialog open={Boolean(tgMergeKeep)} onClose={() => setTgMergeKeep(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>검사군 병합</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            대표 검사군 <strong>{tgMergeKeep?.name}</strong>{tgMergeKeep?.abbr ? ` (${tgMergeKeep.abbr})` : ''} 하나로 합칩니다.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            아래에서 고른 검사군의 옵션이 대표로 이관되고, 빈 검사군은 삭제됩니다. 되돌리려면 다시 분리해야 합니다.
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
            대표로 흡수할 검사군 ({tgMergeAbsorb.size}개 선택)
          </Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.md}px` }}>
            {testGroups.filter((g) => g.id !== tgMergeKeep?.id).map((g) => (
              <Box
                key={g.id}
                onClick={() => handleToggleMergeAbsorb(g.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: `1px solid ${theme.gray[100]}`, cursor: 'pointer' }}
              >
                <Checkbox size="small" checked={tgMergeAbsorb.has(g.id)} onChange={() => handleToggleMergeAbsorb(g.id)} />
                <Typography variant="body2">
                  <strong>{g.name}</strong>{g.abbr ? ` (${g.abbr})` : ''} · 옵션 {tgOptionCounts[g.id] || 0}개
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTgMergeKeep(null)} disabled={tgActionRunning}>취소</Button>
          <Button variant="contained" color="error" onClick={handleMerge} disabled={tgActionRunning || tgMergeAbsorb.size === 0} startIcon={tgActionRunning ? <CircularProgress size={14} /> : null}>
            {tgMergeAbsorb.size}개를 대표로 병합
          </Button>
        </DialogActions>
      </Dialog>

      {/* 검사군 헤더 행 액션 메뉴 — 상세 편집·병합·삭제. 옵션 편집/분리/이동/순서/개별삭제는 상세 편집 모달로 흡수. */}
      <Menu
        anchorEl={tgMenuAnchor?.el}
        open={Boolean(tgMenuAnchor)}
        onClose={() => setTgMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setTgEditor({ group: tgMenuAnchor.group });
            setTgMenuAnchor(null);
          }}
        >
          <ListItemIcon><TuneOptionsIcon fontSize="small" /></ListItemIcon>
          검사군 상세 편집
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleOpenMerge(tgMenuAnchor.group);
            setTgMenuAnchor(null);
          }}
        >
          <ListItemIcon><MergeTypeIcon fontSize="small" /></ListItemIcon>
          병합 (다른 검사군을 흡수)
        </MenuItem>
        <MenuItem
          onClick={() => {
            setTgDeleteTarget(tgMenuAnchor.group);
            setTgMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          삭제
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProductManagementPage;
