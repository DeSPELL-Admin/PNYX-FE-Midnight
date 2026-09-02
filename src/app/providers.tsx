"use client";

/**
 * 앱 프로바이더
 *
 * 인증/세션은 Midnight(Lace) 지갑 연결 + 서명 세션 기준.
 *
 * 구조:
 *   CustomMiniAppProvider     (mini-app SDK 컨텍스트 — 유지)
 *     └─ MidnightProvider     (Lace 연결 + react-query)
 *         └─ SessionProvider  (setOnSessionExpired 와이어링)
 *             └─ AutoConnect
 *             └─ TournamentProvider
 *                 └─ AuthGuard    (useAuthSession().status 기준)
 */

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { features, logFeatureFlags, currentWalletProvider } from "~/lib/feature-flags";
import { CustomMiniAppProvider } from "~/context/CustomMiniAppContext";
import { TournamentProvider } from "~/context/TournamentContext";
import { AuthGuard } from "~/components/auth/AuthGuard";
import { AutoConnect } from "~/components/auth/AutoConnect";
import { SessionProvider } from "~/components/auth/SessionProvider";

// midnight-js / onchain-runtime(WASM) 은 브라우저 전용 — SSR 에서 로드하지 않는다.
const MidnightProvider = dynamic(
  () => import("~/components/providers/MidnightProvider"),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (features.debugMode) {
      logFeatureFlags();
    }
  }, []);

  // 네이티브 드래그(ghost-drag) 전역 차단.
  // CSS 의 -webkit-user-drag 는 WebKit/Blink 전용이라 Firefox 등에서 무효이고, 컴포넌트별
  // draggable={false} 는 누락이 생긴다(Carousel/로고/아바타 등). 이 앱은 의도된 HTML5
  // 드래그-앤-드롭이 없으므로 dragstart 를 전부 막아도 안전하다(캐러셀 스와이프는 touch
  // 이벤트라 무관, 파일 업로드의 drop/dragover 와도 별개). 클릭/탭/스크롤은 영향 없음.
  useEffect(() => {
    const preventDrag = (e: DragEvent) => e.preventDefault();
    // 이미지 위 우클릭(컨텍스트 메뉴 → 이미지 저장/복사) 차단. IMG 대상만 막아
    // 텍스트/링크 등 다른 곳의 우클릭은 그대로 둔다. (캐주얼 방지용 — DevTools/네트워크/
    // 스크린샷으로는 여전히 저장 가능. 웹에서 완전한 이미지 보호는 불가능하다.)
    const preventImageContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'IMG') e.preventDefault();
    };
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('contextmenu', preventImageContextMenu);
    return () => {
      document.removeEventListener('dragstart', preventDrag);
      document.removeEventListener('contextmenu', preventImageContextMenu);
    };
  }, []);

  return (
    <CustomMiniAppProvider>
      <MidnightProvider>
        <SessionProvider>
          <AutoConnect />
          <TournamentProvider>
            <AuthGuard>{children}</AuthGuard>
          </TournamentProvider>
        </SessionProvider>
      </MidnightProvider>
    </CustomMiniAppProvider>
  );
}

export { currentWalletProvider };
