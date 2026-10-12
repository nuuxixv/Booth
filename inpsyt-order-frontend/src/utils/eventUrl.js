// 주문서(고객 주문 페이지) URL 조립 + QR SVG 생성·다운로드 + 클립보드 복사 공용 유틸.
// 학회 목록(A10)·상세(L2)가 동일 동작으로 공유한다. 토스트 문구는 호출부(알림 컨텍스트)에서.
import QRCode from 'qrcode';

/** 고객 주문 페이지 URL. `${origin}/order?events={slug}` */
export const buildOrderUrl = (slug) => `${window.location.origin}/order?events=${slug}`;

/**
 * 텍스트를 클립보드에 복사한다.
 * navigator.clipboard 실패(비보안 컨텍스트·권한 등) 시 execCommand('copy') 폴백.
 * 호환성 규칙(feedback_cross_platform_compat) — 현장 태블릿·구형 브라우저 대비.
 * @returns {Promise<boolean>} 성공 여부
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 폴백으로 진행 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

/** 주문 URL → QR SVG 문자열(목록 기존 설정 정합). */
export const generateOrderQrSvg = (url) =>
  QRCode.toString(url, { type: 'svg', color: { dark: '#252525', light: '#FFFFFF' }, margin: 1, width: 300 });

/** QR SVG를 `qr-{slug}.svg` 파일로 다운로드한다. */
export const downloadQrSvg = (svg, slug) => {
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qr-${slug}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
