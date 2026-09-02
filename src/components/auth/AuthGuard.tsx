'use client';

/**
 * AuthGuard
 *
 * 인증 기준: Midnight 세션 상태(`useAuthSession().status`).
 * 더 이상 지갑 연결 상태만으로 게이팅하지 않는다 — 연결됐어도 미인증이면
 * 데이터가 전부 401 이므로, "연결됨"이 아니라 "인증됨"을 통과 기준으로 삼는다.
 *
 * 게이팅 규칙(공개 라우트 제외):
 *   - status === 'authenticating' → 중앙 Spinner (리다이렉트/빈 화면 금지)
 *   - status === 'unauthenticated' →
 *       · iframe(Startale WebView): AutoConnect + 자동 인증이 처리하므로 리다이렉트하지
 *         않고 Spinner 를 보여 준다(조용한 빈 홈 절대 금지).
 *       · 일반 브라우저: `/login` 으로 리다이렉트(그동안 Spinner).
 *   - status === 'authenticated' → children 렌더
 *
 * Public routes: `/login`(완전 공개), `/share`(prefix, 미인증 방문자도 접근).
 * 공개 라우트는 인증 없이 그대로 렌더한다(API-free 진입점).
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useIsIframe } from '~/hooks/useIsIframe';
import { useAuthSession } from '~/hooks/auth/useAuthSession';
import { Spinner } from '~/components/ui/Spinner';

const PUBLIC_ROUTES = ['/login'];
// 외부 공유 링크 진입점(미인증 방문자도 접근 가능해야 함) — prefix 매칭
const PUBLIC_PREFIXES = ['/share'];

function isPublicRoute(pathname: string): boolean {
    if (PUBLIC_ROUTES.includes(pathname)) return true;
    return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 인증 진행 중/리다이렉트 대기 중 표시하는 중앙 정렬 스피너 */
function CenteredSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-primary">
            <Spinner className="text-white" size={32} />
        </div>
    );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const isIframe = useIsIframe();
    const { status } = useAuthSession();

    const publicRoute = isPublicRoute(pathname);

    useEffect(() => {
        if (publicRoute) return;
        // iframe 안에선 AutoConnect + 자동 인증이 재인증을 담당하므로 리다이렉트하지 않는다.
        if (isIframe) return;
        // 인증 판별 중에는 아직 결정하지 않는다(authenticating → Spinner).
        if (status === 'unauthenticated') {
            router.replace('/login');
        }
    }, [publicRoute, isIframe, status, router]);

    // 공개 라우트는 인증 상태와 무관하게 그대로 렌더한다.
    if (publicRoute) return <>{children}</>;

    // 인증 완료 → 보호 콘텐츠 노출.
    if (status === 'authenticated') return <>{children}</>;

    // 그 외(authenticating, 또는 unauthenticated 상태에서 리다이렉트 대기/iframe 재인증 대기):
    // 절대 조용한 빈 홈을 보여 주지 않는다 — 항상 Spinner.
    return <CenteredSpinner />;
}
