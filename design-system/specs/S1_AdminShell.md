# 사양 시트 — S1 어드민 공통 셸 (AdminLayout · AdminSidebar · AdminHeader)

> 이 시트는 어드민 공통 셸(사이드바·헤더·레이아웃)의 정보·기능·시각 토큰의 단일 진실 소스다.
> 이번 작업은 **신규 디자인이 아니라** 이미 검증된 시안(`PreviewShell.jsx`)의 시각을 실 컴포넌트 3종에 이식하는 것이다.
> 정보·기능은 실코드 그대로 보존한다(추가·삭제·통합 금지). **시각 토큰만** 시안에 정합한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-06-01 신설 (M3 어드민 셸 정합 위임 사전 — PreviewShell 시각 이식 목적).

## 참조 파일

- 실 컴포넌트(기능 소스):
  - `inpsyt-order-frontend/src/components/AdminLayout.jsx` (123줄) — 레이아웃 골격, 라우팅, 실시간 신규주문 구독
  - `inpsyt-order-frontend/src/components/AdminSidebar.jsx` (199줄) — 사이드바(로고·메뉴 9종·collapse·모바일 drawer)
  - `inpsyt-order-frontend/src/components/AdminHeader.jsx` (318줄) — 헤더(햄버거·피드백·알림·아바타·비밀번호 변경·로그아웃)
- 시안(시각 소스): `inpsyt-order-frontend/src/components/preview/PreviewShell.jsx` (307줄, DEV-ONLY) — `/preview/*` 라우트에서 13개 페이지 위에서 검증됨
- 토큰 소스: `inpsyt-order-frontend/src/theme.js` (`theme.gray[*]`, `theme.radii`, `theme.customShadows`, `typography`)
- 의존 hook/api: `src/hooks/useAuth.js` (`user`·`profile`·`permissions`·`hasPermission`), `src/hooks/useNotification.js` (`addNotification`·`notifications`), `src/api/bulletins.js` (`getUnreadCount`), `src/supabaseClient.js` (`supabase.auth.updateUser`·`feedback insert`·`realtime-orders` 채널)
- 설계 근거 문서: `design-system/02_DESIGN_TOKENS.md`(색·타이포·라운드·그림자 약속), `01_DESIGN_PRINCIPLES.md`(원칙 2·6), `09_ACCESSIBILITY.md`(가시성 세이프가드), `Appendix_Spec.md`(§5 타이포 / §7 라운드 / §8 그림자 / §9 터치영역 / §13 z-index), `04_CLAUDE_DESIGN_PROMPTS.md`(셸 프롬프트 line 545-574)

## 사용자 시나리오

어드민(master·editor·viewer)이 데스크톱 또는 태블릿(갤럭시탭/아이패드)으로 어드민 전 화면을 본다. 셸은 모든 어드민 페이지를 감싸는 공통 골격이다 — 좌측 사이드바로 화면을 이동하고, 상단 헤더로 알림·피드백·계정을 다룬다. 학회 종료 후 사무실(데스크톱, 사이드바 펼침)과 학회 중 부스(태블릿, 사이드바 접힘 또는 모바일 drawer) 양쪽에서 쓴다. 셸 자체는 정보 표시보다 "여기가 어디인지(원칙 2·6)"와 "전 화면 이동"이 핵심 역할이다.

**현재 문제:** M3 디자인 시스템 리뉴얼에서 셸이 누락돼, 새 페이지 콘텐츠(시안 정합 완료) 위에 옛 셸(토스 답습 잔재 보유)이 얹혀 한 화면에 두 디자인 언어가 혼재한다. PreviewShell이 셸의 완성 시안이므로, 그 시각을 실 3종에 이식한다.

---

## 1. 표시 정보 전체 목록 (라벨 단위, 누락 금지)

### 1-A. AdminSidebar — 로고/브랜딩 → **제거(2026-10-12 건우님)**
- [x] ~~로고 이미지 `/LOGO.svg`~~ · ~~서비스명 "인싸이트 현장주문"~~ · ~~브랜딩 아래 구분선~~ **모두 제거.** 사이드바는 메뉴 목록부터 시작한다. 서비스 표기는 헤더 좌상단 "Booth" 워드마크 1곳(`BRAND_Booth.md` §3·§4), 인싸이트 소속은 로그인 화면 로고로 표현.
- [x] 아래 §6-R 결정 4(사이드바 브랜딩 높이 64px)·결정 7(브랜드 색 포인트는 사이드바 로고에만)은 브랜딩 영역이 없어져 더 이상 적용 대상이 없음(기록으로 보존).

### 1-B. AdminSidebar — 메뉴 9종 (AdminSidebar.jsx:37-47, `allMenuItems`)
순서·라벨·아이콘·path·권한키 1:1 추출:
- [ ] **대시보드** — `DashboardIcon` — `/admin/dashboard` — 권한 `dashboard:view`
- [ ] **주문 관리** — `ShoppingCartIcon` — `/admin/orders` — 권한 `orders:view`
- [ ] **학회 관리** — `EventIcon` — `/admin/events` — 권한 `events:view`
- [ ] **상품 관리** — `CategoryIcon` — `/admin/products` — 권한 `products:view`
- [ ] **출고 관리** — `LocalShippingIcon` — `/admin/fulfillment` — 권한 `orders:view` (2026-06-12 "출고 현황"에서 개칭)
- [ ] **사용자 관리** — `PeopleIcon` — `/admin/users` — 권한 `users:manage`
- [ ] **피드백** — `RateReviewIcon` — `/admin/feedback` — 권한 `master`
- [ ] **게시판** — `AnnouncementIcon` — `/admin/bulletins` — 권한 `null`(모든 인증 사용자)
- [ ] **설정** — `SettingsIcon` — `/admin/settings` — 권한 `master`
- [ ] **주의:** 메뉴 라벨은 사이드바 기준 "피드백"이지만, 헤더 `ROUTE_LABELS`(아래 1-F)에는 "피드백 관리"로 다름. 라벨 불일치 — §6 확인 필요 항목

### 1-C. AdminSidebar — 게시판 안읽음 뱃지 (AdminSidebar.jsx:129-133)
- [ ] **게시판 메뉴의 아이콘에만** `<Badge badgeContent={bulletinUnreadCount} color="error" max={99}>` 표시
- [ ] `bulletinUnreadCount > 0`일 때만 노출. `getUnreadCount(user.id)`로 mount 시 1회 조회 (line 55-60)
- [ ] 본인 기준 안읽음 수 (게시판 사양 A7과 연동)
- [ ] **시안에는 이 뱃지가 없음** — 시안은 `badge: 3` 하드코딩을 라벨 우측 회색 pill로 표시(PreviewShell.jsx:39, 153-173). 위치·형태 모두 다름 → §6 확인 필요

### 1-D. AdminSidebar — collapse 토글 버튼 (AdminSidebar.jsx:154-168)
- [ ] 데스크톱(`md` 이상)에서만 노출. `collapsed` 상태에 따라 아이콘 전환:
  - 펼침 상태 → `ChevronLeftIcon` (접기)
  - 접힘 상태 → `ChevronRightIcon` (펼치기)
- [ ] 사이드바 하단 정렬 (펼침 시 우측, 접힘 시 중앙)

### 1-E. AdminHeader — 좌측 (AdminHeader.jsx:153-161)
- [ ] 모바일 햄버거 버튼: `MenuIcon` — `display: { md: 'none' }` (모바일에서만), `aria-label="메뉴 열기"`
- [ ] **주의:** 04 프롬프트(line 551)는 헤더 좌측에 "로고 + 현재 페이지 제목"을 두라 했으나, **실코드 헤더에는 페이지 제목 표시가 없음** (`ROUTE_LABELS`는 피드백 자동입력에만 사용). 시안도 페이지 제목 없음 → §6 확인 필요

### 1-F. AdminHeader — `ROUTE_LABELS` (AdminHeader.jsx:17-27)
피드백 위치 자동입력 + (잠재적) 페이지 제목용. 라벨 1:1:
- [ ] `/admin/dashboard` → "대시보드"
- [ ] `/admin/orders` → "주문 관리"
- [ ] `/admin/events` → "학회 관리"
- [ ] `/admin/products` → "상품 관리"
- [ ] `/admin/fulfillment` → "출고 관리"
- [ ] `/admin/users` → "사용자 관리"
- [ ] `/admin/feedback` → **"피드백 관리"** (사이드바는 "피드백")
- [ ] `/admin/bulletins` → "게시판"
- [ ] `/admin/settings` → "설정"

### 1-G. AdminHeader — 우측 아이콘 행 (AdminHeader.jsx:164-237)
- [ ] 피드백 아이콘 버튼: `ChatBubbleOutlineIcon`, `aria-label="피드백 보내기"`
- [ ] 알림 아이콘 버튼: `NotificationsIcon`
- [ ] 사용자 아바타 버튼: `<Avatar>` — 내용은 **이니셜** `(profile?.name || user?.email)?.[0]?.toUpperCase()` (line 217)

### 1-H. AdminHeader — 종 아이콘 + 뱃지 + 알림 드롭다운 (2026-06-15 재구성)
- [ ] 종 아이콘 `NotificationsIcon`에 `<Badge badgeContent={unseenCount} color="error" max={99}>` — 놓친 신규 주문 N건
- [ ] 드롭다운 폭 340px. 제목 "신규 주문"(subtitle2) → Divider
- [ ] **신규 주문 목록**(maxHeight 320, `newOrders`): 각 항목 `ShoppingBagOutlinedIcon` + "{고객명} · {금액}원"(body2 500) + `format(at, 'M월 d일 HH:mm', ko)`(caption). 클릭 시 `/admin/orders` 이동 + 드롭다운 닫힘
- [ ] 빈 상태: "새로 들어온 주문이 없습니다." (body2, center, py 3)
- [ ] **하단 알림 설정 토글 2종**: "브라우저 알림"(부제 "화면 밖에 있어도 알려줍니다") / "소리"(부제 "신규 주문 시 알림음") — 각 `Switch size="small"`
- [ ] **브라우저 알림 권한 상태 표시·동기화** (2026-06-15 추가):
  - 권한 `denied`: "브라우저 알림" 라벨 옆에 회색 **"차단됨" Chip**(gray[100]/gray[600]) + 그 아래 인라인 해제 안내 영역(gray[50] 배경, caption) — "브라우저가 알림을 차단한 상태입니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 새로고침해 주세요. (Windows는 설정 → 알림에서 Chrome·집중 지원도 확인)". **텍스트만(룰 E)**, 토스트 대신 드롭다운 내 노출
  - 권한 `unsupported`(`Notification` 미지원): Switch `disabled` + 인라인 안내 "이 브라우저는 알림을 지원하지 않습니다. 앱 내 알림(종·토스트)은 계속 동작합니다."
  - 권한 `default`: 토글 켜면 `requestPermission()` 요청
  - **Switch 표시-권한 동기화**: AdminLayout이 `browserNotifOn = browserNotif && notifPermission==='granted'`를 계산해 헤더 `browserNotif` prop으로 전달 → localStorage가 'true'여도 권한이 granted가 아니면 **OFF로 표시**(미스매치 방지: 켜진 줄 알았는데 안 오는 상황 차단)
  - **권한 재확인 시점**: 마운트 시(effect) + 종 드롭다운 열 때(`handleSeenNewOrders` → `readPermission()`)
- [ ] **토글 ON 성공 시 테스트 알림 1회**: 권한 granted로 켜지면 `new Notification('알림이 켜졌어요', { body:'새 주문이 오면 이렇게 알려드릴게요', icon:'/LOGO.svg', tag:'inpsyt-notif-test' })`. 실패 시 catch 무시
- [ ] **소리 토글 ON 시 beep 1회**: AudioContext resume 후 `playBeep` 1회로 작동 즉시 확인
- [ ] **드롭다운 열면 `unseenCount` 0으로 리셋**(= 확인). 목록은 유지
- [ ] **변경 전**: 토스트 히스토리(`useNotification.notifications`) 표시였음 → 신규 주문 전용 드롭다운으로 교체. 토스트 히스토리는 `NotificationsDisplay`(우하단 Snackbar)가 담당

### 1-I. AdminHeader — 사용자 메뉴 (AdminHeader.jsx:220-237)
- [ ] 상단 정보 블록: 이름 `profile?.name || user?.email?.split('@')[0] || '사용자'` (subtitle2 bold) + 이메일 `user?.email` (caption secondary)
- [ ] 구분선
- [ ] 메뉴 항목 1: "비밀번호 변경" (line 235)
- [ ] 메뉴 항목 2: "로그아웃" (`color: error.main`, line 236)

### 1-J. AdminHeader — 비밀번호(PIN) 변경 다이얼로그 (AdminHeader.jsx:241-251)
- [ ] 제목: "비밀번호(PIN) 변경"
- [ ] 입력 1: "새 비밀번호 (최소 6자리 숫자/영문)" (type password)
- [ ] 입력 2: "새 비밀번호 확인" (type password)
- [ ] 버튼: "취소" / "변경하기"(contained)

### 1-K. AdminHeader — 피드백 다이얼로그 (AdminHeader.jsx:254-312)
- [ ] 제목: "기능 개선 제안하기" + 부제 "불편하셨나요? 더 나은 서비스를 위해 알려주세요."
- [ ] 위치 입력(`location`): 라벨 "위치", helperText "현재 페이지가 자동 입력됩니다. 직접 수정할 수 있어요."
- [ ] 유형 칩 3종(`FEEDBACK_TYPES`, line 29-33): **"오류"**(bug) / **"UI/UX 불편"**(ux) / **"개선 제안"**(suggestion) + 라벨 "유형 *"
- [ ] 내용 입력(`content`): 라벨 "내용 *", multiline rows 4, placeholder "구체적으로 적어주실수록 빠르게 개선할 수 있어요."
- [ ] 버튼: "취소" / "보내기"(contained, 전송 중 "전송 중..." + CircularProgress)

### 1-L. AdminLayout — 콘텐츠 영역 (AdminLayout.jsx:68-69)
- [ ] 메인 콘텐츠 래퍼: `maxWidth 1280`, `px: { xs: 2, md: 3 }`, `py: { xs: 2, md: 3 }` (중앙 정렬)
- [ ] `NotificationsDisplay` (토스트 표시 영역, line 116)

---

## 2. 액션·기능 전체 목록 (누락 금지)

### 2-A. 권한 필터링 (AdminSidebar.jsx:62-66)
- [ ] `filteredMenuItems`: `permissions.includes('master')`면 전체 노출 / `permissionKey` 있으면 `hasPermission(key)` 통과분만 / `permissionKey` null이면 무조건 노출
- [ ] **이식 시 시각만 바꾸고 이 필터 로직은 보존** (시안 MENU는 권한 분기 없이 9종 전부 — PreviewShell.jsx:31-41)

### 2-B. 사이드바 collapse 토글 (AdminLayout.jsx:25-29 + AdminSidebar.jsx:74)
- [ ] `sidebarCollapsed` state — `onToggleCollapse`로 토글
- [ ] 폭 전환: **펼침 DRAWER_WIDTH 240px ↔ 접힘 COLLAPSED_WIDTH 64px** (양쪽 동일 상수)
- [ ] 접힘 시: 서비스명·라벨·텍스트 숨김, 아이콘만 중앙 정렬, 메뉴에 Tooltip(우측 arrow)으로 라벨 노출 (AdminSidebar.jsx:101)
- [ ] 데스크톱(`md` 이상)에서만 collapse 가능

### 2-C. 모바일 drawer 토글 (AdminLayout.jsx:67 + AdminSidebar.jsx:172-176)
- [ ] 모바일(`md` 미만): `variant="temporary"` Drawer, `mobileOpen` state로 열고닫음
- [ ] 헤더 햄버거(`onMenuToggle`)로 토글, 메뉴 클릭 시 `onClose`로 자동 닫힘 (AdminSidebar.jsx:99)
- [ ] 데스크톱: `variant="permanent"`, 항상 열림

### 2-D. NavLink isActive (AdminSidebar.jsx:99-122)
- [ ] `<NavLink>`의 `isActive` 콜백으로 현재 경로 메뉴를 강조
- [ ] active 시각 표현은 §3·§4에서 변경 (좌측 컬러바 제거 → 회색 배경)

### 2-E. 알림 Popover 열기 (AdminHeader.jsx:56-57, 176-212)
- [ ] 벨 클릭 → `notificationAnchorEl` 설정 → Popover 오픈. **읽음 처리 로직은 현재 없음** (notifications는 useNotification 휘발성 목록) — §6 확인 필요

### 2-F. 비밀번호(PIN) 변경 (AdminHeader.jsx:74-91)
- [ ] 검증: **`newPassword.length < 6`이면 거부** ("최소 6자리 이상") + 확인 불일치 거부
- [ ] `supabase.auth.updateUser({ password })` 호출, 성공/실패 토스트

### 2-G. 피드백 제출 (AdminHeader.jsx:93-128)
- [ ] 열 때: `feedbackLocation`에 **현재 `location.pathname`의 `ROUTE_LABELS` 자동 입력** (line 94)
- [ ] 검증: 유형 미선택·내용 공백 거부
- [ ] `supabase.from('feedback').insert({ user_id, user_email, user_name, location, type, content })`
- [ ] 유형 칩: 단일 선택, 선택 시 filled+primary / 미선택 outlined+default

### 2-H. 로그아웃 (AdminHeader.jsx:61-65)
- [ ] `logout()` 후 `navigate('/login')`

### 2-I. 실시간 신규주문 구독 (AdminLayout.jsx)
- [ ] `realtime-orders` 채널 INSERT 구독. **단일 콜백에서 4종 처리** (2026-06-15 강화):
  1. **인앱 토스트** — "새로운 주문이 도착했습니다!" (success). 기존 동작 유지(즉시 인지)
  2. **헤더 종 누적** — `newOrders`(세션 휘발성, 최근 20건) push + `unseenCount` +1. 놓쳐도 뱃지에 쌓임
  3. **브라우저 알림** — 토글 ON + `Notification.permission === 'granted'`일 때 `new Notification('새 주문', { body: '고객명 · 금액원', icon: '/LOGO.svg', tag })`, `onclick` → `window.focus()` + `/admin/orders`
  4. **소리** — 토글 ON일 때 WebAudio 내장 beep 1회(880Hz sine, 0.35s). 음원 파일·라이브러리 0
- [ ] payload 필드: `payload.new.customer_name`, `payload.new.final_payment`, `payload.new.id` (orders 테이블)
- [ ] 구독은 **1회만 생성**(deps `[addNotification, navigate]`), 토글 최신값은 ref(`browserRef`·`soundRef`)로 읽음
- [ ] **시각 무관 — 토스트 메시지 자체는 건드리지 말 것**

### 2-J. 신규 주문 알림 설정 (AdminLayout.jsx + AdminHeader.jsx, 2026-06-15 신설)
- [ ] **localStorage 키 2종**: `notif:newOrder:browser`, `notif:newOrder:sound`
- [ ] **역할별 디폴트**(`resolvePref`): `profile.role`이 `fulfillment*`로 시작하면 기본 **OFF**(학회 후 작업), 그 외(master·onsite)는 기본 **ON**. localStorage 저장값이 있으면 저장값 우선
- [ ] **브라우저 알림 토글 ON 클릭 시**(사용자 제스처) `default`면 `Notification.requestPermission()`. 결과를 `notifPermission` state에 반영. **`granted`만 토글 ON + localStorage 'true' + 테스트 알림 1회**. `denied`/`default(거부)`/`unsupported`는 토글 OFF 유지 + **드롭다운 내 인라인 안내**(토스트 아님, 1-H 참조). 한 번 denied면 JS `requestPermission()`이 재요청 불가(브라우저 정책)라 해제 안내가 유일한 경로
- [ ] **권한 상태는 AdminLayout이 단일 소스**(`notifPermission`): `readPermission()`(= `'Notification' in window ? Notification.permission : 'unsupported'`). 마운트 + 드롭다운 열 때 재확인. 헤더엔 동기화된 `browserNotifOn`을 전달
- [ ] **소리 토글 ON 시** AudioContext `resume()`(자동재생 정책 대응) + `playBeep` 1회(작동 확인)
- [ ] **Service Worker/Web Push 미사용** — 탭 열린 동안만 동작(학회 현장 시나리오 OK). 알림 DB 영속·풀 알림센터 없음

---

## 3. Before(현 실코드) → After(PreviewShell 시안) 시각 토큰 대조표

> 원칙: **정보·기능은 그대로, 시각 토큰만 After로.** raw-hex·인라인 fontSize·인라인 fontWeight를 토큰/variant로 흡수(02 §운영 조항 1·2).

### 3-A. 사이드바 컨테이너

| 항목 | Before (AdminSidebar.jsx) | After (PreviewShell 시안) | 근거 |
|---|---|---|---|
| 배경색 | raw-hex `#ffffff` (line 184) | `#ffffff` 유지 (시안 line 52) | surface-0. raw-hex지만 흰색은 토큰 동일값 — `theme.palette.background.paper` 경유 권장(02 조항 1) |
| 우측 경계 | `borderRight: 'none'` + 그림자 `4px 0 24px rgba(0,0,0,0.02)` (line 186-187) | `borderRight: 1px solid ${theme.gray[100]}` + **그림자 없음** (시안 line 53) | 옅은 그림자로 경계 표현 → 1px 보더로. 02 §그림자 "안 보이는 그림자는 버그" |
| 브랜딩 높이 | 80px (line 85) | 64px (시안 line 65) | **헤더 높이와 정렬** — §6 확인 필요 |
| 브랜딩 패딩 | `p: collapsed ? 1.5 : 3` (line 80) | `px: collapsed ? 0 : 2.5` (시안 line 64) | space 토큰 정합 |
| 메뉴 영역 패딩 | `px: collapsed ? 1 : 2` (line 96) | `px: 1.25, py: 1.5` (시안 line 108) | 4배수 근접 정합 |
| 브랜딩 아래 구분선 | 없음 | `1px bgcolor gray[100]` 추가 (시안 line 105) | 시안 패턴 |

### 3-B. 사이드바 메뉴 항목 (ListItemButton)

| 항목 | Before | After (시안 기준, 단 ★는 정본 별도) | 근거 |
|---|---|---|---|
| 항목 높이 | minHeight/height 52px (line 105-106) | 시안 44px (line 119-120) → **★52px 유지가 정본** | §5 확정 결정 |
| 라운드 | `borderRadius: '12px'` (line 107) | `borderRadius: '8px'` (시안 line 120) | radius-sm(태그/메뉴 아이템). Appendix §7 |
| active 배경 | `alpha(primary.main, 0.08)` (line 113) | `theme.gray[100]` (시안 line 124) | §4 — 색을 의미 없는 강조에 쓰지 않음(01 원칙 2) |
| active 좌측 컬러바 | **`borderLeft: 4px solid primary.main`** (line 112) | **없음** (시안에 없음) | §4 제거 대상 |
| active 텍스트색 | `primary.main` (line 114) | `theme.gray[900]` (시안 line 125) | §4 — 회색 위계로 표현 |
| inactive 텍스트색 | `text.secondary`(=gray[500]) (line 114) | `theme.gray[600]` (시안 line 125) | 한 단계 진하게(가시성, 09) |
| inactive 아이콘색 | `inherit`(텍스트색 따라감) (line 125) | `theme.gray[500]` / active `gray[900]` (시안 line 135) | 아이콘 위계 분리 |
| hover 배경 | active면 `alpha(primary,0.12)` / 아니면 `alpha(text.primary,0.04)` (line 115-119) | active면 `gray[100]` / 아니면 `gray[50]` (시안 line 126-128) | 회색 위계 |
| 아이콘 크기 | `fontSize: 22` (line 126) | `fontSize: 20` (시안 line 136) | 시안 정합 |
| 라벨 타이포 | 인라인 `fontWeight: isActive?700:500, fontSize: '0.95rem'` (line 138-142) | `variant="body1"` + `fontWeight: active?600:500` (시안 line 146-151) | 02 §타이포 약속 2·3. **인라인 fontSize 제거**, body1(16px) variant로 |
| 항목 사이 간격 | `my: 0.5, mb: 0.5` (line 98, 108) | `mb: 0.5` (시안 line 112) | 정합 |
| transition | `all 0.2s ease-in-out` (line 120) | `background-color 0.15s ease` (시안 line 129) | transition-fast(§12). `all` → `background-color`만 |
| ripple | 기본 ripple | `disableRipple` (시안 line 115) | 시안 정합(차분한 톤) |

### 3-C. 사이드바 collapse 토글 버튼

| 항목 | Before | After (시안) | 근거 |
|---|---|---|---|
| 배경 | `alpha(primary.main, 0.06)` hover `0.12` (line 159-160) | `transparent` hover `gray[50]` (시안 line 189-194) | §4 — primary 알파 강조 제거, 회색 |
| 크기 | 44×44 (line 161-162) | 36×36 (시안 line 191-192) | **★44 유지 권장**(터치영역, §9) — §6 확인 필요 |
| 라운드 | 기본(theme radii.md=12) | `borderRadius: '8px'` (시안 line 193) | radius 정합 |
| 아이콘색 | 기본 | `gray[500]` hover `gray[900]` (시안 line 191-194) | 회색 위계 |

### 3-D. 헤더 컨테이너 (AdminHeader.jsx)

| 항목 | Before | After (시안) | 근거 |
|---|---|---|---|
| 높이 | 64px (line 140) | 60px (시안 line 213) | **확인 필요** — 사이드바 브랜딩 높이와 함께 64로 통일 검토. §6 |
| 배경 | raw-hex `#ffffff` (line 143) | `#ffffff` (시안 line 215) | `background.paper` 경유 권장 |
| 하단 경계 | `1px solid rgba(0,0,0,0.08)` (line 144) | `1px solid theme.gray[100]` (시안 line 216) | gray 토큰 |
| 그림자 | `0 4px 20px rgba(0,0,0,0.02)` (line 145) | **없음** (시안엔 그림자 없음) | §4 제거 — borderBottom으로 경계 충분 |
| **hover 그림자 확대** | **`'&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }`** (line 150) | **없음** | §4 제거 대상 — 헤더는 hover 대상 아님(AI 시그니처) |
| mb (콘텐츠 간격) | `mb: 3` (line 142) | 없음(레이아웃 padding으로 처리) | **확인 필요** — 이중 간격 가능성. §6 |
| transition | `all 0.3s ease` (line 149) | 없음 | hover 제거와 함께 불필요 |
| z-index | 100 (line 148) | 100 (시안 line 219) | z-sticky(§13) 일치 |

### 3-E. 헤더 우측 아이콘 버튼

| 항목 | Before | After (시안) | 근거 |
|---|---|---|---|
| 크기 | `minWidth/minHeight 44` (line 169 등) | `width/height 40` (시안 line 251) | **★44 유지가 정본**(터치영역 §9). 시안 40은 미달 → §5 정본 적용 |
| 색 | `text.secondary`(gray[500]) | `gray[500]` hover bg `gray[50]`+`gray[900]` (시안 line 250-253) | hover 시 배경+색 위계 추가 |
| 라운드 | 기본 radii.md=12 | `borderRadius: '8px'` (시안 line 250) | radius 정합 |
| 아이콘 크기 | 기본 | `fontSize: 20` (시안 line 256) | 사이드바와 일치 |

### 3-F. 헤더 아바타

| 항목 | Before | After (시안) | 근거 |
|---|---|---|---|
| 크기 | 32×32 (line 216) | 30×30 (시안 line 271) | 시안 정합(미세) |
| 배경 | `primary.main`(brand-700) (line 216) | `theme.gray[900]` (시안 line 273) | **확인 필요** — 시안은 회색 아바타, 실코드는 브랜드색. 아바타는 "본인 식별" 신호라 brand 유지 가능성. §6 |
| 내용 | 이니셜(실 데이터) | 이니셜 "I"(시안 더미) | 이니셜 로직 보존(1-G) |
| 버튼 hover | `border 1px primary.light` (line 215) | 없음(시안 IconButton p:0.5) | §4 — 미세 강조 제거 |

### 3-G. Popover / Menu 컨테이너 (알림·사용자)

| 항목 | Before | After | 근거 |
|---|---|---|---|
| 라운드 | `'16px'`(알림)·`'16px'`(메뉴) (line 188, 226) | radius-lg(14px) 정합 권장 | Appendix §7 radius-lg=14. 16 → 14 |
| 그림자 | `0 10px 40px rgba(0,0,0,0.1)` (line 188, 226) | shadow-pop `0 4px 12px rgba(0,0,0,0.10)` (Appendix §8) | 드롭다운/플로팅 = shadow-pop. 과한 40px blur 축소 |
| 보더 | `1px solid rgba(0,0,0,0.05)` | `1px solid gray[100]` 권장 | gray 토큰 |
| **참고** | 시안에 Popover/Menu 콘텐츠 자체가 없음 | 위 토큰만 정합, 구조는 실코드 보존 | §6 — 시안 미커버 영역 |

### 3-H. 레이아웃 배경 (AdminLayout.jsx)

| 항목 | Before | After (시안) | 근거 |
|---|---|---|---|
| 전체 배경 | `bgcolor: 'background.default'`(=gray[100]) (line 50) | `theme.gray[50]` (시안 line 292) | **확인 필요** — 시안은 gray[50](더 옅음), 실코드 gray[100]. 카드 대비 위해 어느 쪽? §6 |
| 콘텐츠 maxWidth | 1280 (line 69) | 1280 (시안 line 297) | 일치 |
| 콘텐츠 padding | `px/py {xs:2, md:3}` (line 69) | 동일 + `pb: 6`(시안만, line 297) | 시안 하단 여백 추가 검토 |

---

## 4. 명시적 제거 대상 (토스 잔재 / AI 시그니처)

> 디자인 시스템이 금지한 패턴. After에서 **제거** 확정.

- [ ] **사이드바 active "좌측 4px 컬러바"** (`borderLeft: 4px solid primary.main`, AdminSidebar.jsx:112)
  - 제거 근거: 01 원칙 2 "색은 의미가 있을 때만 나타나야 한다. 색을 장식으로 쓰는 것"(line 91), 02 §색 "장식으로 쓰지 않는다"(line 19). active는 **회색 배경(gray[100]) + 굵기/색 위계**로 표현(시안 검증). 좌측 컬러바는 토스 답습기 잔재.
  - **주의 — 문서 충돌:** 04 프롬프트 line 568은 "활성 강조(좌측 brand-primary 라인 + brand-primary-soft 배경)"을 명시. 그러나 실제 채택·검증된 시안(PreviewShell)은 이 라인을 폐기하고 회색 배경만 사용. **검증된 시안이 우선**이나, 04 프롬프트와의 충돌은 §6에 확인 필요로 등재.

- [ ] **헤더 hover 시 그림자 확대** (`'&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }`, AdminHeader.jsx:150)
  - 제거 근거: 02 §그림자 "의료 학회 화면이 슈퍼 히어로 영화 포스터처럼 보일 이유가 없다 — 눈에 보이는 만큼만, 무겁지 않은 만큼만". 헤더는 hover 대상이 아닌 고정 셸이라 hover 그림자 자체가 무의미한 장식(AI 시그니처, CLAUDE.md E절). 시안은 헤더에 그림자 없음.

- [ ] **헤더 기본 그림자** (`0 4px 20px rgba(0,0,0,0.02)`, AdminHeader.jsx:145)
  - 제거 근거: 02 §그림자 "그림자가 너무 옅으면 그냥 안 보인다 — 안 보이는 그림자는 그림자가 아니라 버그다". alpha 0.02는 안 보이는 그림자. borderBottom 1px으로 경계 표현 충분(시안 패턴).

- [ ] **사이드바 옅은 그림자** (`4px 0 24px rgba(0,0,0,0.02)`, AdminSidebar.jsx:187)
  - 제거 근거: 위와 동일. borderRight 1px gray[100]로 대체(시안 line 53).

- [ ] **active/toggle의 primary 알파 배경** (`alpha(primary.main, 0.08/0.12/0.06)`, AdminSidebar.jsx:113,116-118,159-160)
  - 제거 근거: 01 원칙 2. 강조 의미가 약한 자리(메뉴 hover·toggle hover)에 brand 알파를 쓰면 색이 장식이 된다. 회색 위계(gray[50]/gray[100])로 대체(시안 검증).

- [ ] **아바타 버튼 hover 보더** (`'&:hover': { borderColor: 'primary.light' }`, AdminHeader.jsx:215)
  - 제거 근거: 의미 없는 미세 강조. 시안은 아바타 버튼에 hover 보더 없음.

- [ ] **`transition: all`** (사이드바 메뉴 line 120, 헤더 line 149)
  - 제거 근거: `all`은 의도치 않은 속성까지 애니메이트해 부산스러움. 시안은 `background-color`만(line 129). 02 §간격 정신("의도된 차이인지 실수인지 알 수 없으면 더 피곤하다") 연장.

---

## 5. 확정 결정 반영 (정본)

> 시안 수치와 다르더라도 아래는 **정본**으로 적용한다. 시안의 44/40/36px이 아니라 **터치영역 우선 상향**.

- [ ] **사이드바 메뉴 항목 높이 = 52px (정본).**
  - 시안은 44px(PreviewShell.jsx:119-120). 정본은 **52px 유지**(AdminSidebar.jsx:105-106 현행 그대로).
  - 근거: 태블릿(갤럭시탭/아이패드) 터치영역. Appendix §9 최소 44 위에 한 단계 상향. 현행 main이 이미 만족 상태(현장 OK). **시안 44 대비 +8px 상향이 정본.**
  - 이식 지침: 시안의 시각 토큰(라운드 8px·회색 active·body1 variant 등)은 가져오되, **높이만 52 유지**.

- [ ] **헤더 우측 아이콘 버튼 = 44×44 (정본).**
  - 시안은 40×40(PreviewShell.jsx:251). 정본은 **44 유지**(AdminHeader.jsx:169 현행 `minWidth/minHeight 44`).
  - 근거: Appendix §9 터치영역 최소 44. 시안 40은 미달. 시각 토큰(라운드 8·회색 hover·아이콘 20px)만 가져오고 hit-area 44 유지.

- [ ] **사이드바 collapse 토글 버튼 = 44×44 (정본 권장).**
  - 시안 36×36(PreviewShell.jsx:191-192)은 터치영역 미달. 현행 44(AdminSidebar.jsx:161-162) 유지 권장. 단 데스크톱 전용 보조 버튼이라 §6에서 최종 확인.

- [ ] **DRAWER_WIDTH 240 / COLLAPSED_WIDTH 64 (양쪽 동일, 정본).**
  - 실코드·시안 동일 상수. 변경 없음.

---

## 6. "확인 필요" 항목 (frontend·메인 Claude가 push 전 검증)

> 시안과 실 기능이 충돌하거나, 시안에 없는 기능, 또는 정본 결정이 필요한 항목. push 전 sampling check 대상.

1. **게시판 안읽음 뱃지 위치·형태 충돌.** 실코드는 게시판 *아이콘에* `Badge`(빨강 숫자, error색). 시안은 메뉴 라벨 *우측에* 회색 pill(badge:3 더미). **둘 중 정본 결정 필요.** 권장: 실 기능(아이콘 위 빨강 뱃지)이 "안읽음"의 의미(긴급/주목)에 맞음. 단 collapsed 시 아이콘 위 뱃지가 정상 동작하는지 확인. (1-C / 3-B 연관)

2. **알림 Popover 디자인 — 시안 미커버.** 시안은 벨 아이콘만 있고 Popover 콘텐츠·읽음 처리 없음. 실코드 Popover(320px, 알림 목록)는 시안 가이드가 없어 §3-G 토큰(radius-lg·shadow-pop·gray 보더)만 정합. **알림 항목 카드 스타일·빈 상태 시각은 별도 결정 필요.** (1-H / 2-E)

3. **사용자 메뉴 디자인 — 시안 미커버.** 알림과 동일. 구조 보존 + 컨테이너 토큰만 정합. 메뉴 항목 hover·hit-area 44 확인 필요. (1-I)

4. **헤더 높이 60 vs 64 + 사이드바 브랜딩 높이 80 vs 64.** 시안 헤더 60·브랜딩 64. 실코드 헤더 64·브랜딩 80. **헤더와 사이드바 상단이 같은 높이로 가지런해야 시각 정합.** 권장: 셋 다 64로 통일(헤더 64 + 브랜딩 64). 단 시안은 60/64라 어느 값이 정본인지 확정 필요. (3-A / 3-D)

5. **헤더 `mb: 3` 중복 간격 가능성.** 실코드 헤더에 `mb: 3`(line 142) + 레이아웃 콘텐츠 `py`(line 69)가 겹쳐 헤더와 콘텐츠 사이 간격이 이중일 수 있음. 시안은 헤더 mb 없이 레이아웃 padding만. **이식 시 mb 제거 여부 + 실제 간격 확인.** (3-D / 3-H)

6. **레이아웃 배경 gray[50] vs gray[100].** 시안 gray[50](옅음), 실코드 gray[100]. 카드(흰색)와 배경 대비가 충분한 쪽으로. 02 §색 "너무 옅게 가지 않는다(원칙 5)" 고려하면 gray[100]이 안전. **확정 필요.** (3-H)

7. **아바타 배경 brand vs gray.** 시안 gray[900] 회색 아바타, 실코드 primary.main 브랜드색. 아바타는 "본인 식별" 신호라 brand 유지 의견 있음. 단 셸 전체가 회색 위계로 가면 brand 아바타가 유일한 색 포인트가 됨(의미 OK일 수도). **정본 결정 필요.** (3-F)

8. **헤더 페이지 제목 표시 부재.** 04 프롬프트(line 551)·02 Primitives §Nav("헤더에 페이지 이름이 항상 있고, 0.5초 안에 여기가 어디인지 풀려야 한다")는 헤더 좌측에 현재 페이지 제목을 요구. 그러나 실코드·시안 **둘 다 페이지 제목 없음**. 사이드바 active로 "여기가 어디"는 풀리지만, 헤더 제목 부재는 디자인 시스템 권고와 불일치. **추가할지 결정 필요**(추가 시 `ROUTE_LABELS[location.pathname]`로 헤더 좌측에 title-section). 이건 정보 추가이므로 건우님 승인 영역. (1-E / 1-F)

9. **사이드바 메뉴 라벨 "피드백" vs ROUTE_LABELS "피드백 관리" 불일치.** 사이드바(1-B)는 "피드백", 헤더 ROUTE_LABELS(1-F)는 "피드백 관리". 둘 다 같은 `/admin/feedback`. 정보 불일치 — 통일 여부 결정(정보 변경이므로 임의 통일 금지, 확인 후). (1-B / 1-F)

10. **collapse 토글 36 vs 44.** §5에서 44 권장했으나 데스크톱 전용 보조 버튼이라 시안 36 허용 여부 최종 확인. 터치영역 원칙(§9)은 44 권장. (3-C / 5)

---

## 6-R. §6 결정 확정 (2026-06-01, 건우님 승인 — 이식 시 이 표를 정본으로)

> §6의 모든 "확인 필요" 항목을 아래로 확정한다. frontend는 이 표를 단일 진실 소스로 따른다.

| §6 # | 항목 | **확정 결정** |
|---|---|---|
| 1 | 게시판 안읽음 뱃지 | **실 기능 유지** — 게시판 아이콘 위 빨강 `Badge`(error색, max 99). 시안 회색 pill 채택 안 함. collapsed 상태에서도 아이콘 위 뱃지 정상 노출 확인 |
| 2 | 알림 Popover (시안 미커버) | **구조·콘텐츠 전부 실코드 보존.** §3-G 컨테이너 토큰만 정합(radius 16→14 lg, 그림자→shadow-pop, 보더→gray[100]). 항목 카드·빈상태 문구·읽음로직 변경 없음 |
| 3 | 사용자 메뉴 (시안 미커버) | **구조 보존 + §3-G 컨테이너 토큰만.** 메뉴 항목 hit-area 44 유지 |
| 4 | 헤더/브랜딩 높이 | **64px로 통일.** 헤더 64 유지, 사이드바 브랜딩 80→**64**. 헤더 상단과 사이드바 로고 영역이 가지런하게 |
| 5 | 헤더 `mb: 3` 중복 간격 | **`mb:3` 제거.** 헤더-콘텐츠 간격은 레이아웃 padding만으로. 제거 후 실제 간격이 비지 않는지 빌드 확인 |
| 6 | 레이아웃 배경 | **gray[100] 유지** (현행). 시안 gray[50] 채택 안 함 — 카드(흰색) 대비 안전(원칙 5) |
| 7 | 아바타 배경색 | **회색 `gray[900]`** (건우님 결정, 시안대로). 셸 전체 회색 위계 통일, 브랜드 색 포인트는 사이드바 로고에만. 이니셜 로직(1-G)은 보존 |
| 8 | 헤더 페이지 제목 | **추가 안 함** (건우님 결정, 현상 유지). 헤더 좌측은 모바일 햄버거만. "여기가 어디"는 사이드바 active로 해결 |
| 9 | "피드백" vs "피드백 관리" 라벨 | **둘 다 그대로 유지** (통일 안 함). 사이드바 메뉴="피드백", 헤더 ROUTE_LABELS="피드백 관리". 서로 다른 맥락이라 임의 통일 금지(룰 D) |
| 10 | collapse 토글 크기 | **44×44 유지** (터치영역 §9). 시안 36 채택 안 함 |
| §4 충돌 | 04 프롬프트 line 568 "좌측 brand-primary 라인" vs 검증 시안(컬러바 폐기) | **컬러바 제거 확정** — 검증된 PreviewShell 우선, 디자인 시스템 원칙2 부합. `04_CLAUDE_DESIGN_PROMPTS.md` line 568은 추후 갱신 대상(별도 정리) |

## 변경 이력

- 2026-06-15 **브라우저 알림 "차단됨" 개선** (frontend) — 라이브에서 `Notification.permission==='denied'`로 토글이 안 켜지던 문제. ① AdminLayout에 `notifPermission` state(granted/denied/default/unsupported, `readPermission()`로 산출, 마운트+드롭다운 열 때 재확인) 신설. ② `browserNotifOn = browserNotif && permission==='granted'`로 Switch 표시-권한 동기화(localStorage 'true'여도 권한 없으면 OFF 표시 → 미스매치 차단). ③ 토글 핸들러: granted만 ON+테스트 알림 1회(`'알림이 켜졌어요'`), denied/default거부/unsupported는 OFF 유지 + 드롭다운 내 인라인 안내(토스트 폐기, 룰 E 텍스트만). ④ 소리 토글 ON 시 `playBeep` 1회 추가. ⑤ AdminHeader: "차단됨" Chip(gray) + denied/unsupported 해제 안내 영역(gray[50], caption) + unsupported 시 Switch disabled. Service Worker/Web Push 미도입, 신규 라이브러리 0, theme 토큰만. 변경 파일: AdminLayout.jsx·AdminHeader.jsx만. **lint/build는 환경상 메인 Claude가 실행 검증 필요**(이 세션 Bash 차단).
- 2026-06-15 **신규 주문 알림 강화** (frontend) — 기존 `realtime-orders` INSERT 콜백(토스트만)을 4종 처리로 확장(§2-I). 헤더 종에 놓친 신규주문 뱃지 + 신규주문 드롭다운 + 알림설정 토글 2종 신설(§1-H). 브라우저 알림(ⓐ, `notif:newOrder:browser`)·소리(WebAudio beep, `notif:newOrder:sound`)·역할별 디폴트(fulfillment* 기본 OFF) 추가(§2-J). 변경 파일: AdminLayout.jsx(state 단일 소스·구독 콜백·토글 핸들러)·AdminHeader.jsx(종 뱃지·드롭다운·토글 UI, props 수신). Service Worker/Web Push 미도입, 신규 라이브러리 0. lint(touched 0 error)·build green.
- 2026-06-01 **이식 완료** (frontend) — §3 After·§4 제거·§5/§6-R 정본대로 AdminSidebar·AdminHeader 시각 토큰 이식. AdminLayout은 §6-R #6(배경 gray[100] 유지)·maxWidth 1280 유지로 변경 없음(헤더 `mb:3` 제거는 AdminHeader에서 처리, 헤더-콘텐츠 간격은 레이아웃 `py`로 일원화). lint·build green.
  - **코드 vs 사양 diff (룰 F) — 메인 Claude 룰 C 리뷰에서 수정:** frontend가 임시로 쓴 `borderRadius: '14px'` 매직넘버 리터럴을 **`theme.radii.lg`(=16) 토큰 호출로 교체**(Popover·Menu). 16은 앱 전체 Card/Dialog/Drawer 컨벤션·이식 전 원래 헤더 값과도 일치 — 매직넘버 회피 + 플로팅 표면 일관성. **theme.radii.lg=16 ↔ Appendix radius-lg=14 불일치는 별도 토큰 정합 부채(CTO 영역).** 알림 Popover 본문 `fontSize: '0.9rem'/'0.75rem'` → `body2`/`caption` variant로 토큰화. MenuItem(비번/로그아웃) `fontSize`는 드롭다운 관용 표기라 유지.
  - 사이드바 메뉴 hover에서 시안의 t.gray[*]를 ListItemButton의 `sx={(t)=>...}` 콜백 인자(`t`=theme)로 접근 — 기존 코드 패턴 유지.
- 2026-06-01 §6-R 추가 — 확인 필요 10건 + 04 프롬프트 충돌 전부 건우님 승인 하에 확정. 정보 변경 2건(헤더 제목 추가 안 함 / 라벨 통일 안 함)은 현상 유지로 결정. 아바타 회색 채택.
- 2026-06-01 신설 — M3 어드민 셸 정합 위임 사전 작성. PreviewShell(시각 소스) vs AdminSidebar·AdminHeader·AdminLayout(기능 소스) 1:1 추출. 표시 정보 12군(1-A~1-L)·액션 9종(2-A~2-I)·시각 토큰 대조 8영역(3-A~3-H)·제거 대상 7건(§4)·정본 4건(§5)·확인 필요 10건(§6) 기록. 04 프롬프트 line 568(좌측 컬러바)과 검증 시안의 충돌을 §4·§6에 등재.
