import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  CssBaseline,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Dialpad as DialpadIcon,
  Shield as ShieldIcon,
  LocalShipping as ShippingIcon,
  Storefront as StoreIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { sortMembers } from '../utils/allowanceRules';
import { useAuth } from '../hooks/useAuth';

// 세션 적용 대기 한도(ms): signInWithPassword 성공 후 onAuthStateChange가
// user를 채울 때까지 기다리는 최대 시간. 초과 시 조용한 무한대기 대신 에러 표시.
const SESSION_WAIT_TIMEOUT_MS = 4000;

// 사양 §표시 정보 — Step 1 역할 큰 버튼 라벨/아이콘
const ROLE_LABELS = {
  master:      { label: '마스터',       icon: ShieldIcon },
  onsite:      { label: '현장 마케팅',  icon: StoreIcon },
  fulfillment: { label: '출고',         icon: ShippingIcon },
};

const AVAILABLE_ROLES = ['master', 'onsite', 'fulfillment'];

// 담당자 버튼: 이 인원을 넘으면 데스크톱에서만 2열. 그 이하/모바일은 1열.
const STEP2_TWO_COL_THRESHOLD = 8;

// ─── 숫자 단축키 배지 (kbd) ─────────────────────────────────────
const KbdBadge = ({ children, sx }) => {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        width: 18,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: `${theme.radii.xs}px`,
        bgcolor: theme.gray[100],
        color: theme.gray[600],
        border: `1px solid ${theme.gray[200]}`,
        fontFeatureSettings: '"tnum" 1',
        fontSize: '0.6875rem',
        fontWeight: 700,
        lineHeight: 1,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// ─── 스텝 인디케이터 (시안 답습) ─────────────────────────────────
const StepIndicator = ({ currentStep }) => {
  const theme = useTheme();
  const steps = [
    { idx: 0, label: '역할' },
    { idx: 1, label: '담당자' },
    { idx: 2, label: 'PIN' },
  ];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
      {steps.map((s, i) => {
        const done = currentStep > s.idx;
        const active = currentStep === s.idx;
        const color = done
          ? theme.palette.primary.main
          : active
            ? theme.palette.primary.main
            : theme.gray[300];
        return (
          <React.Fragment key={s.idx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: done ? color : 'transparent',
                  border: `1.5px solid ${color}`,
                  color: done ? 'common.white' : color,
                  transition: `all 0.2s ${theme.easing.toss}`,
                }}
              >
                {done ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'common.white' }} />
                ) : (
                  <Typography variant="caption" sx={{ fontWeight: 700, color, lineHeight: 1 }}>
                    {s.idx + 1}
                  </Typography>
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: active ? 'text.primary' : 'text.secondary',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {s.label}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box sx={{ width: 20, height: 1, bgcolor: theme.gray[300] }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

const LoginPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // signInWithPassword 성공 후 AuthContext의 user가 채워지기를 기다리는 중인지 여부.
  // navigate를 즉시 호출하면 ProtectedRoute가 user=null로 평가해 /login으로 회귀하는 race를 막는다.
  const [awaitingSession, setAwaitingSession] = useState(false);
  // 사양 §발견 7: 100ms 자동 제출 중복 발화 방지(7번째 키스트로크 회피)
  const handlingSubmitRef = useRef(false);
  // PIN 입력 필드 참조 — 로그인 실패 후 즉시 재입력 가능하도록 포커스 복원용.
  const pinInputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // user_profiles RLS 적용(20260601) — anon은 직접 SELECT 차단. 로그인 셀렉터용 최소 컬럼(id/name/role/email)만 RPC로.
        const { data, error: fetchError } = await supabase.rpc('get_login_directory');
        if (fetchError) throw fetchError;
        setProfiles(data || []);
      } catch (err) {
        console.error('Error fetching user profiles:', err);
        setError('사용자 목록을 불러오지 못했습니다. 관리자에게 문의하세요.');
      } finally {
        setLoadingProfiles(false);
      }
    };
    fetchProfiles();
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser || !password) return;
    if (handlingSubmitRef.current) return;
    handlingSubmitRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      });

      if (signInError) throw signInError;

      // 인증 성공. 즉시 navigate하지 않고 user가 채워질 때까지 대기(아래 useEffect가 navigate).
      // loading/handlingSubmitRef는 navigate 또는 타임아웃 시점까지 유지(중복 제출·버튼 활성화 방지).
      setAwaitingSession(true);
    } catch (err) {
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('비밀번호(PIN)가 일치하지 않습니다.');
      } else {
        // err.message가 빈 값/undefined여도 빈 Alert가 뜨지 않도록 fallback 메시지.
        setError(err.message || '로그인 중 오류가 발생했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.');
      }
      setPassword('');
      setLoading(false);
      handlingSubmitRef.current = false;
      // 포커스 복원은 아래 useEffect에서 처리(loading 해제·DOM 커밋 후여야 disabled 풀린 input에 focus됨).
    }
  };

  // 세션 진입 감시: 인증 성공(awaitingSession) 후 AuthContext의 user가 채워지면 /admin으로 이동.
  // 이미 로그인된 상태로 /login에 직접 들어온 경우(awaitingSession 없이 user 존재)도 /admin으로 보낸다.
  useEffect(() => {
    if (!user) return;
    navigate('/admin', { replace: true });
  }, [user, navigate]);

  // 타임아웃 가드: 인증은 성공했는데 일정 시간 내 user가 안 채워지면 조용한 무한대기 대신 에러 표시.
  useEffect(() => {
    if (!awaitingSession) return;
    const timer = setTimeout(() => {
      setError('세션 적용에 실패했습니다. 새로고침 후 다시 시도해주세요.');
      setAwaitingSession(false);
      setLoading(false);
      handlingSubmitRef.current = false;
    }, SESSION_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [awaitingSession]);

  const handleBack = useCallback(() => {
    if (selectedUser) {
      setSelectedUser(null);
      setPassword('');
      setError(null);
    } else if (selectedRole) {
      setSelectedRole(null);
      setError(null);
    }
  }, [selectedUser, selectedRole]);

  // 사양 §필터: '출고' 역할은 fulfillment_book/fulfillment_test 두 슬러그를 묶어 노출
  // 정렬: 직급순(차장>과장>대리>사원) → 이름순 (allowanceRules.sortMembers 재사용)
  const usersForRole = useMemo(() => {
    if (!selectedRole) return [];
    const filtered = selectedRole === 'fulfillment'
      ? profiles.filter(p => p.role === 'fulfillment_book' || p.role === 'fulfillment_test')
      : profiles.filter(p => p.role === selectedRole);
    return sortMembers(filtered);
  }, [profiles, selectedRole]);

  const currentStep = selectedUser ? 2 : selectedRole ? 1 : 0;

  const headingText = useMemo(() => {
    if (!selectedRole) return '역할을 선택해주세요';
    if (!selectedUser) return `${ROLE_LABELS[selectedRole]?.label} 선택`;
    return `${selectedUser.name} 님, 환영합니다`;
  }, [selectedRole, selectedUser]);

  const handlePinChange = (e) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPassword(pin);
    if (pin.length === 6 && selectedUser) {
      // 사양 §발견 2: 6자리 도달 시 100ms 후 자동 제출 (React 18 비동기 업데이트 안전 마진)
      setTimeout(() => {
        document.querySelector('form')?.requestSubmit();
      }, 100);
    }
  };

  // 단축키 — Esc: 뒤로(모든 단계, PIN 입력 중에도) / 숫자: 선택(step 0·1만, input 비포커스).
  // preventDefault로 같은 키가 새로 포커스되는 PIN input에 흘러드는 누출 차단.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedRole || selectedUser) {
          e.preventDefault();
          handleBack();
        }
        return;
      }
      if (currentStep === 2) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key < '1' || e.key > '9') return;
      const k = Number(e.key);
      if (currentStep === 0) {
        if (k <= AVAILABLE_ROLES.length) {
          e.preventDefault();
          setSelectedRole(AVAILABLE_ROLES[k - 1]);
        }
      } else if (currentStep === 1) {
        if (k <= Math.min(9, usersForRole.length)) {
          e.preventDefault();
          setSelectedUser(usersForRole[k - 1]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStep, usersForRole, selectedRole, selectedUser, handleBack]);

  // 로그인 실패 시 PIN 입력 필드로 포커스 복원 — 재클릭 없이 즉시 재입력.
  // useEffect는 DOM 커밋(loading=false로 disabled 해제 반영) 이후 실행돼 focus가 확실히 걸린다.
  useEffect(() => {
    if (error && !loading && currentStep === 2) {
      pinInputRef.current?.focus();
    }
  }, [error, loading, currentStep]);

  // 브라우저 탭 title — 어드민 진입점이므로 Booth 노출 (BRAND_Booth.md §3).
  // 언마운트 시 고객 기준 중립 문구로 복원(고객 라우트 누수 방지).
  useEffect(() => {
    document.title = 'Booth — 로그인';
    return () => { document.title = '인싸이트 주문서'; };
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <CssBaseline />
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          bgcolor: 'background.paper',
          borderRadius: `${theme.radii.lg}px`,
          border: `1px solid ${theme.gray[200]}`,
          boxShadow: theme.customShadows.lg,
          p: { xs: 3, sm: 4 },
          position: 'relative',
        }}
      >
        {/* 뒤로가기 (사양 line 119-127) */}
        {(selectedRole || selectedUser) && (
          <IconButton
            onClick={handleBack}
            aria-label="뒤로가기"
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              color: theme.gray[600],
              '&:hover': { bgcolor: theme.gray[50] },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}

        {/* 브랜드 — 소속(인싸이트 로고) + 서비스명(Booth 워드마크) 세로 2단 스택.
            BRAND_Booth.md §4: 소속=인싸이트 로고, 서비스=Booth 텍스트 타이포. 태그라인 미표시. */}
        <Box sx={{ textAlign: 'center', mb: 3, mt: (selectedRole || selectedUser) ? 1 : 0 }}>
          <Box
            component="img"
            src="/LOGO.svg"
            alt="인싸이트"
            sx={{ height: 32, mb: 1, display: 'block', mx: 'auto' }}
          />
          <Typography
            component="div"
            sx={{
              fontSize: 28,
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Booth
          </Typography>
        </Box>

        {/* 스텝 인디케이터 (시안 답습) */}
        <StepIndicator currentStep={currentStep} />

        {/* 헤딩 — 사양 §컨테이너 */}
        <Typography
          component="h1"
          variant="h4"
          sx={{ textAlign: 'center', color: 'text.primary', mb: 2.5 }}
        >
          {headingText}
        </Typography>

        {/* 에러 알림 (사양 line 135) */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${theme.radii.md}px` }}>
            {error}
          </Alert>
        )}

        {/* 스텝 콘텐츠 공통 래퍼 — minHeight 290px 안정 + 세로 중앙 (담당자 많을 때만 아래 확장) */}
        <Box
          sx={{
            minHeight: 290,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
        {loadingProfiles ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : currentStep === 0 ? (
          /* Step 1 — 역할 선택 (사양 line 139-167) */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {AVAILABLE_ROLES.map((role, i) => {
              const meta = ROLE_LABELS[role];
              const Icon = meta.icon;
              return (
                <Button
                  key={role}
                  variant="outlined"
                  fullWidth
                  size="large"
                  onClick={() => setSelectedRole(role)}
                  sx={{
                    position: 'relative',
                    py: 2,
                    flexDirection: 'column',
                    gap: 0.75,
                    borderColor: theme.gray[200],
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <KbdBadge sx={{ position: 'absolute', top: 8, left: 8 }}>{i + 1}</KbdBadge>
                  <Icon sx={{ fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ color: 'inherit', lineHeight: 1 }}>
                    {meta.label}
                  </Typography>
                </Button>
              );
            })}
          </Box>
        ) : currentStep === 1 ? (
          /* Step 2 — 담당자 선택 (사양 line 168-189) — 기본 1열, 데스크톱 인원 초과 시 2열 */
          usersForRole.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: `${theme.radii.md}px` }}>
              등록된 담당자가 없습니다.
            </Alert>
          ) : (
            (() => {
              const cols = isMobile ? 1 : (usersForRole.length > STEP2_TWO_COL_THRESHOLD ? 2 : 1);
              return (
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1 }}>
                  {usersForRole.map((user, i) => (
                    <Button
                      key={user.id}
                      variant="contained"
                      fullWidth
                      size="large"
                      color="primary"
                      onClick={() => setSelectedUser(user)}
                      sx={{ position: 'relative', py: 1.5, px: 3.5, justifyContent: 'center', gap: 0.5, minWidth: 0 }}
                    >
                      {i < 9 && (
                        <KbdBadge sx={{ position: 'absolute', top: 8, left: 8, bgcolor: alpha('#fff', 0.22), color: 'common.white', borderColor: alpha('#fff', 0.35) }}>
                          {i + 1}
                        </KbdBadge>
                      )}
                      <Typography variant="subtitle1" component="span" sx={{ color: 'inherit', lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {user.name}
                      </Typography>
                      {user.position && (
                        <Typography variant="caption" component="span" sx={{ color: alpha('#fff', 0.7), flexShrink: 0 }}>
                          {user.position}
                        </Typography>
                      )}
                    </Button>
                  ))}
                </Box>
              );
            })()
          )
        ) : (
          /* Step 3 — PIN 입력 (사양 line 190-249) */
          <Box component="form" noValidate onSubmit={handleLogin}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                mb: 2,
                color: 'text.secondary',
              }}
            >
              <DialpadIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: 'inherit' }}>
                비밀번호(PIN)를 입력하세요
              </Typography>
            </Box>
            <TextField
              fullWidth
              required
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              autoFocus
              inputRef={pinInputRef}
              placeholder="••••••"
              value={password}
              onChange={handlePinChange}
              disabled={loading}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                maxLength: 6,
                style: {
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFeatureSettings: '"tnum" 1',
                },
              }}
              helperText={
                <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>숫자 6자리</span>
                  <Box
                    component="span"
                    sx={{
                      fontFeatureSettings: '"tnum" 1',
                      color: password.length === 6 ? theme.palette.primary.main : 'text.disabled',
                      fontWeight: 700,
                    }}
                  >
                    {password.length} / 6
                  </Box>
                </Box>
              }
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || password.length !== 6}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </Button>
          </Box>
        )}
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
