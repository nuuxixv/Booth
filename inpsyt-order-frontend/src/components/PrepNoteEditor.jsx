import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { supabase } from '../supabaseClient';
import { sanitizePrepNoteHTML } from './prepNoteSanitizer';
import { resolveForDisplay, createImageDisplayUrl } from '../utils/prepNoteImages';

/**
 * 통합 Toast UI 에디터 (바닐라) — L2 학회 준비 노트 + A7 게시판 공용.
 * React.lazy로 지연 로드(호출부에서 Suspense로 감쌈) → 초기/공개 번들 0 영향.
 * CSS import도 이 파일 안에 둬 lazy 청크에 포함시킴.
 *
 * ⚠️ @toast-ui/react-editor(React 17 전용)는 React 19와 비호환(findDOMNode 등) →
 *    바닐라 Editor를 ref로 직접 인스턴스화(프레임워크 무관).
 *
 * - 준비물 = 에디터 task-list 체크박스
 * - 이미지(프로그램·부스배치도) = addImageBlobHook → bucket 업로드 → 표시용 서명 URL 삽입
 *   (dropImage 플러그인·md paste 핸들러가 양 모드 공통이라 Markdown 모드에서도 동작)
 *   저장 시 호출부가 encodeForStorage(html, bucket)로 경로 플레이스홀더로 치환(만료 무관),
 *   진입 시 resolveForDisplay(html, bucket)로 새 서명 URL 재발급(utils/prepNoteImages.js).
 * - 학회 정보(설치/철거 등) = 자유 텍스트
 *
 * 모드: WYSIWYG에는 마크다운 입력 룰이 없어 `##`·`- [ ]` 자동변환 불가 →
 *   하단 Markdown/WYSIWYG 탭 노출. 신규(빈) 노트는 markdown 기본.
 *   기존 노트는 HTML 저장본이라 markdown 모드로 열면 raw HTML이 노출되므로 wysiwyg 기본
 *   (탭 전환 시 convertor가 마크다운으로 변환해 보여줌). 저장은 양 모드 모두 getHTML().
 *
 * props:
 *  - eventId: string             (L2 후방호환 — idPrefix 미전달 시 이미지 업로드 경로 prefix)
 *  - idPrefix: string            (이미지 업로드 경로 prefix override. 미전달 시 eventId 사용)
 *  - bucket: string              (이미지 업로드 버킷. 기본 'event-images' — L2 무영향)
 *  - initialEditType: string     ('wysiwyg' | 'markdown' override. 미전달 시 현행 로직:
 *                                 내용 있으면 wysiwyg, 빈 노트는 markdown)
 *  - initialValue: string        (저장 HTML — 마운트 시점 값으로 1회 주입)
 *  - onReady: (getHTML) => void  (저장 버튼이 본문을 읽을 수 있게 getHTML 접근자 전달.
 *                                 에디터 준비 전/해제 후 호출 시 null 반환 — 저장 가드용)
 *  - onImageError: (msg) => void (검증/업로드 실패 토스트)
 *  - onChange: (html) => void    (본문 변경 시 호출 — 임시저장(useFormDraft) 자동저장 연결용. 선택)
 *  - disableImage: boolean       (기본 false. 준비노트 템플릿(A12)용 — 툴바 image 제거 +
 *                                 업로드/붙여넣기/드래그 이미지 거부 + 안내 토스트. 기존 소비처는 미전달=이미지 활성)
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_BUCKET = 'event-images';
const IMAGE_DISABLED_MSG = '템플릿에는 이미지를 넣을 수 없어요. 이미지는 각 학회의 준비 노트에서 직접 삽입하세요.';

const PrepNoteEditor = ({ eventId, idPrefix, bucket = DEFAULT_BUCKET, initialEditType, initialValue, onReady, onImageError, onChange, disableImage = false }) => {
  const elRef = useRef(null);
  const instRef = useRef(null);
  // 최신 props를 마운트-1회 훅 안에서 참조하기 위한 ref (에디터 재생성 방지)
  const prefixRef = useRef(idPrefix ?? eventId);
  prefixRef.current = idPrefix ?? eventId;
  const bucketRef = useRef(bucket);
  bucketRef.current = bucket;
  const disableImageRef = useRef(disableImage);
  disableImageRef.current = disableImage;
  const onImageErrorRef = useRef(onImageError);
  onImageErrorRef.current = onImageError;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!elRef.current) return undefined;

    const addImageBlobHook = async (blob, callback) => {
      try {
        // 템플릿(disableImage) — 업로드/붙여넣기/드래그 이미지 모두 거부 + 안내 토스트(A12 §1-5).
        if (disableImageRef.current) {
          onImageErrorRef.current?.(IMAGE_DISABLED_MSG);
          return;
        }
        const type = blob.type || '';
        if (!ALLOWED_TYPES.includes(type)) {
          onImageErrorRef.current?.('JPG·PNG·WEBP 이미지만 업로드할 수 있어요.');
          return;
        }
        if (blob.size > MAX_BYTES) {
          onImageErrorRef.current?.('이미지는 5MB 이하만 업로드할 수 있어요.');
          return;
        }
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${prefixRef.current || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(bucketRef.current)
          .upload(path, blob, { contentType: type, upsert: false });
        if (upErr) {
          onImageErrorRef.current?.(`이미지 업로드 실패: ${upErr.message}`);
          return;
        }

        const signedUrl = await createImageDisplayUrl(path, bucketRef.current);
        if (!signedUrl) {
          onImageErrorRef.current?.('이미지 주소 생성에 실패했어요.');
          return;
        }
        callback(signedUrl, '학회 자료');
      } catch (e) {
        console.error(e);
        onImageErrorRef.current?.('이미지 업로드 중 오류가 발생했어요.');
      }
    };

    // getHTML 접근자는 호출 시점의 인스턴스를 참조 — 준비 전(재서명 중)/해제 후엔 null
    onReadyRef.current?.(() => (instRef.current ? instRef.current.getHTML() || '' : null));

    // 본문 내 경로 플레이스홀더(+레거시 서명 URL) → 새 서명 URL 재발급 후 에디터 생성
    let editor = null;
    let cancelled = false;
    resolveForDisplay(initialValue || '', bucketRef.current).then((resolved) => {
      if (cancelled || !elRef.current) return;
      editor = new Editor({
        el: elRef.current,
        initialValue: resolved,
        // override 우선. 미전달 시 현행 로직(내용 있으면 wysiwyg, 빈 노트는 markdown) — L2 무영향.
        initialEditType: initialEditType || (resolved ? 'wysiwyg' : 'markdown'),
        previewStyle: 'tab',
        height: '420px',
        usageStatistics: false,
        hideModeSwitch: false,
        autofocus: false,
        toolbarItems: [
          ['heading', 'bold', 'italic'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          // 템플릿(disableImage) = image 버튼 제거(링크는 유지). A12 §1-5.
          disableImageRef.current ? ['link'] : ['image', 'link'],
        ],
        events: {
          // 본문 변경 → 호출부 임시저장(useFormDraft) 연결. getHTML은 변경 직후 최신 본문 반환.
          change: () => { onChangeRef.current?.(editor?.getHTML() || ''); },
        },
        hooks: { addImageBlobHook },
        customHTMLSanitizer: sanitizePrepNoteHTML, // 최신 DOMPurify 주입(보안 검토 중2)
      });
      instRef.current = editor;
    });

    return () => {
      cancelled = true;
      editor?.destroy();
      instRef.current = null;
    };
    // 마운트 시 1회 생성(initialValue는 진입 시점 값). 콜백/eventId는 ref로 최신 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      ref={elRef}
      sx={(theme) => ({
        // Toast UI 자체 CSS가 font-family를 재선언하는 지점 전부를 Pretendard 토큰으로 교체
        // (폰트 패밀리만 — 크기·굵기 무수정. 02_DESIGN_TOKENS 모노스페이스 폐기 결정)
        '& .toastui-editor-defaultUI': { fontFamily: theme.typography.fontFamily },
        '& .ProseMirror': { fontFamily: theme.typography.fontFamily }, // WYSIWYG·markdown 편집영역 공통
        '& .toastui-editor-contents': { fontFamily: theme.typography.fontFamily }, // WYSIWYG 본문·md 미리보기
        '& .toastui-editor-contents code, & .toastui-editor-contents pre': {
          fontFamily: theme.typography.fontFamily,
        },
        '& .toastui-editor-md-code, & .toastui-editor-md-code-block': {
          fontFamily: theme.typography.fontFamily, // markdown 모드 코드 토큰
        },
      })}
    />
  );
};

export default PrepNoteEditor;
