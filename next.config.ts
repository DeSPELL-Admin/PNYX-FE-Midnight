import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * NEXT_PUBLIC_API_URL 이 절대 URL 이면 next/image remotePatterns 항목으로 변환한다.
 * (비어 있으면 BE 가 같은 오리진이라 패턴이 필요 없다.)
 */
function apiRemotePattern(): { protocol: 'http' | 'https'; hostname: string; port?: string }[] {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const protocol = url.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') return [];
    return [{ protocol, hostname: url.hostname, ...(url.port ? { port: url.port } : {}) }];
  } catch {
    console.warn(`[next.config] NEXT_PUBLIC_API_URL 이 URL 형식이 아닙니다: ${raw}`);
    return [];
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  // Docker 런타임 스테이지가 .next/standalone + `node server.js` 로 구동하므로
  // standalone 산출물을 생성한다. (없으면 Dockerfile 의 COPY .next/standalone 실패)
  output: 'standalone',
  // sharp(네이티브 모듈)는 번들하지 않고 외부 패키지로 둬서 standalone 트레이싱에 포함시킨다.
  // (OG 카드 라우트 src/app/og/share 에서 webp→png 트랜스코드에 사용)
  serverExternalPackages: ['sharp'],
  // 타입체크는 빌드에서 제외하고 pre-push 훅(pnpm typecheck)에서 강제한다.
  // 빌드(특히 CI/Docker)는 타입 에러로 실패하지 않는다.
  typescript: { ignoreBuildErrors: true },
  // ESLint도 빌드에서 제외해 빌드 시간을 줄인다(타입체크와 동일 정책).
  // 린트는 pre-push 훅/별도 CI 잡에서 돌리는 것을 권장.
  eslint: { ignoreDuringBuilds: true },
  // 빌드(next build --turbopack)와 dev(next dev --turbopack) 모두 Turbopack 을
  // 사용하므로 SVG 처리를 여기서 정의한다. Turbopack 은 아래 webpack() 규칙을
  // 무시하기 때문에, @svgr/webpack 을 동일한 svgoConfig(currentColor) 로 적용해
  // webpack 경로(build:raw)와 SVG 렌더링 동작을 일치시킨다.
  // Next 15.3+ 부터 top-level `turbopack` 키가 안정화(experimental.turbo 대체).
  turbopack: {
    rules: {
      '*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        convertColors: { currentColor: true },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
        as: '*.js',
      },
    },
  },
  images: {
    remotePatterns: [
      // images.unsplash.com / picsum.photos 는 아직 라이브 폴백 경로에 남아 있어 유지한다.
      //   - unsplash: Result.tsx, TournamentSelectedModal.tsx, SearchModal.tsx 폴백 이미지
      //   - picsum:   useGameLogic.ts mock 후보 이미지(개발/폴백 경로)
      // imagedelivery.net 은 src/ 전체에서 실제 사용처가 0건이라 제거했다.
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      // BE 공개 이미지 직접 URL — Blob 다운로드 대신 next/image 최적화 경로로 받는다(dev/prod 호스트).
      {
        protocol: 'https',
        hostname: 'pnyx.fun',
      },
      {
        protocol: 'https',
        hostname: 'dev.pnyx.fun',
      },
      // 로컬 BE(예: http://localhost:3001)를 가리킬 때도 next/image 가 통과하도록,
      // NEXT_PUBLIC_API_URL 의 호스트를 그대로 허용한다. 호스트를 하드코딩하지 않으므로
      // 포트를 바꾸거나 다른 백엔드를 붙여도 설정을 다시 만질 필요가 없다.
      ...apiRemotePattern(),
    ],
  },
  // 보안 헤더 — 커밋 f0eb575 리팩터에서 헤더가 전부 사라진 이력이 있어 재도입한다.
  // 주의: COOP/COEP 는 의도적으로 넣지 않는다(과거 제거 이력 — iframe/지갑 SDK 호환성 깨짐).
  // CSP 는 전체 적용 시 Next 인라인 스크립트 이슈가 있어 이번엔 frame-ancestors 만 우선 적용한다.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // 클릭재킹 방어: 이 앱은 Startale WebView iframe 안에서 동작해야 하므로
          // X-Frame-Options: DENY 대신 CSP frame-ancestors 화이트리스트를 쓴다.
          // TODO: 배포 전 실제 임베드 호스트를 확인해 화이트리스트를 좁힐 것.
          //       현재 코드베이스에서 확인된 Startale 도메인은 startale.com 뿐이라
          //       보수적으로 'self' + *.startale.com 와일드카드로 넓게 잡아 둔다.
          //       (Farcaster/다른 미니앱 컨테이너가 임베드한다면 해당 origin 추가 필요)
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.startale.com",
          },
        ],
      },
    ];
  },
  webpack(config, { isServer }) {
    // midnight-js → compact-runtime → onchain-runtime-v3 는 WASM + top-level await 를 쓴다.
    // (Turbopack 은 이 조합을 아직 안정적으로 다루지 못해 dev/build 모두 webpack 을 쓴다.)
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true, layers: true };
    // asyncWebAssembly 가 생성하는 async/await 를 타깃이 지원한다고 명시(모던 브라우저) — 빌드 경고 제거
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false, stream: false };
      // isomorphic-ws 의 browser 엔트리엔 `WebSocket` named export 가 없다 → 전역 WebSocket 을 재수출하는 shim
      config.resolve.alias = { ...config.resolve.alias, 'isomorphic-ws': require.resolve('./src/lib/midnight/shims/isomorphic-ws.ts') };
    }
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg'),
    )

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        convertColors: { currentColor: true },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    )

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i

    return config
  },
};

export default withNextIntl(nextConfig);
