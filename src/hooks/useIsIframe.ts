"use client";

import { useEffect, useState } from "react";

/**
 * Startale 앱 등은 우리 페이지를 WebView (iframe) 안에서 로드한다.
 * iframe 안에선 MetaMask/WalletConnect 같은 외부 커넥터가 동작 못 하므로
 * 지갑 모달에서 외부 지갑 버튼을 숨기고 Startale 버튼만 노출해야 한다.
 *
 * SSR-safe: 초기 false 로 시작했다가 마운트 후 실제 값을 반영.
 * cross-origin block 으로 window.top 접근 자체가 막히면 안전하게 iframe 로 간주.
 */
export function useIsIframe(): boolean {
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  return isIframe;
}
