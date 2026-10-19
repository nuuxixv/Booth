// 짧은 알림음 1회 — WebAudio 내장 beep(음원 파일·라이브러리 0).
// AdminLayout의 신규 주문 알림음과 동일 패턴. 그 함수는 모듈 로컬이라(비노출) 공유 유틸로 둔다.
// ctxRef = useRef(null) — 탭 수명 동안 AudioContext 1개 재사용.
export const playBeep = (ctxRef) => {
  try {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch { /* 자동재생 차단 등 — 무시(인앱 토스트가 fallback) */ }
};
