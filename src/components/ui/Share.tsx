'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import { useMiniApp } from '~/context/CustomMiniAppContext';
import { useToast } from '~/hooks/use-toast';

interface ShareButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  buttonText?: string;
  /** X(트위터)에 자동 입력될 본문 텍스트 */
  text: string;
  /** 트윗에 첨부될 URL (보통 /share/[id] OG 페이지). 비우면 URL 미첨부 */
  url?: string;
}

/**
 * X(트위터) 공유 버튼.
 *
 * 0608 기획: 공유 채널을 Farcaster composeCast → X 포스팅으로 전환.
 * x.com/intent/post 인텐트를 연다. 미니앱(Farcaster/Startale WebView)
 * 컨텍스트에선 SDK openUrl 로, 일반 웹에선 새 탭으로 연다.
 * 첨부 url 의 OG/twitter 메타(`/share/[id]`)가 1200×675 카드 언퍼링을 담당한다.
 */
export function ShareButton({ buttonText, text, url, className = '', isLoading = false, children, ...props }: ShareButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { context, actions } = useMiniApp();
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const buildIntentUrl = useCallback(() => {
    const intent = new URL('https://x.com/intent/post');
    intent.searchParams.set('text', text);
    if (url) intent.searchParams.set('url', url);
    return intent.toString();
  }, [text, url]);

  const handleShare = useCallback(async () => {
    const target = buildIntentUrl();
    try {
      setIsProcessing(true);
      // 미니앱 컨텍스트면 호스트 SDK 로 외부 URL 열기, 아니면 새 탭
      if (context) {
        await actions.openUrl(target);
      } else {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      // 폴백: 새 탭 직접 열기
      try {
        window.open(target, '_blank', 'noopener,noreferrer');
      } catch (fallbackError) {
        // 이중 폴백마저 실패(팝업 차단 등) → 사용자에게 공유 실패 알림
        console.error('Share fallback failed:', fallbackError);
        toast({ variant: 'destructive', title: tCommon('shareFailed') });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [buildIntentUrl, context, actions, toast, tCommon]);

  return (
    <Button
      onClick={handleShare}
      className={className}
      isLoading={isLoading || isProcessing}
      {...props}
    >
      {children || buttonText}
    </Button>
  );
}
