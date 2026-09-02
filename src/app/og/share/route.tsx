import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { getPublicBaseUrl } from '~/lib/url';

/**
 * 토너먼트 결과 공유 카드 (1200×675, 16:9) — Figma 126:894 (다크 테마 리뉴얼).
 *
 * /share/[id] 페이지의 og:image / twitter:image 가 이 라우트를 가리킨다.
 * 쿼리: title(토너먼트 제목), pick(우승 아이템 imageName, 확장자 제외),
 *       pickName(우승 아이템 이름), by(PNYX 닉네임 — 현재는 지갑주소 폴백).
 *
 * 레이아웃(다크 테마, #191919 배경 + #202020 카드 + #464646 보더):
 *   좌측 ─ TOPIC 칩(상단) → 타이틀 박스 → "What's your No.1?" pill → PNYX 로고(하단)
 *   우측 ─ 큰 픽 이미지 + 그라데이션 오버레이 픽 이름(하단)
 *   상단 우측 ─ MY PICK 뱃지 + 작성자 주소를 한 보더 컨테이너(Use_Name)로 통합
 *   배경 중앙 ─ 은은한 warm-gray 글로우(Figma Union)를 radial-gradient 로 근사
 *
 * 경로를 의도적으로 `/og/*` 에 둔다(`/api/*` 가 아님): 프로덕션에서 `/api/*` 는
 * 백엔드로 프록시될 수 있어 Next 라우트가 가려질 위험이 있다.
 *
 * 폰트(AlbertSans=타이틀/뱃지, Roboto MediumItalic=픽 이름, Pretendard=주소/한국어)·로고는
 * 파일시스템에서 직접 로드해 네트워크 의존을 없앤다. 로고(public/logo.png)는 다크 UI용
 * 회색 실루엣이라 다크 카드에서 그대로 보인다 → 재색칠 없이 임베드(실패 시 "Pnyx" 텍스트).
 * 우승 아이템 이미지(BE webp)만 원격 fetch — Satori webp 미지원이라 sharp 로 png 트랜스코드.
 * 모든 외부 자원은 try/catch 로 감싸 실패해도 카드가 graceful 하게 렌더된다(절대 500 안 남).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 675;

// 브랜드 그라데이션(오렌지→퍼플) — TOPIC / MY PICK 뱃지 텍스트.
const BRAND_GRADIENT = 'linear-gradient(150deg, #FFBE69 9%, #AC7CFF 91%)';

function readPublic(rel: string) {
  return readFile(path.join(process.cwd(), 'public', rel));
}

/** 지갑 주소면 가운데 생략(0x1234…abcd). 닉네임이면 그대로. */
function shortenBy(raw: string): string {
  const v = raw.trim();
  if (/^0x[0-9a-fA-F]{8,}$/.test(v) && v.length > 28) {
    return `${v.slice(0, 24)}...${v.slice(-4)}`;
  }
  return v;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('title') || "What's your all-time favorite?").slice(0, 90);
  // pick 은 BE 가 생성한 이미지 파일 식별자(예: mock-1). 외부에서 임의 값이 들어올 수 있으므로
  // 길이 상한 + 허용 문자 화이트리스트로 검증한다. 불합격이면 픽 이미지 fetch 를 생략하고
  // 텍스트만 렌더해 SSRF/제어문자 주입·DoS 표면을 줄인다.
  const rawPick = searchParams.get('pick') || '';
  const pick = /^[A-Za-z0-9 ._-]{1,128}$/.test(rawPick) ? rawPick : '';
  const pickName = (searchParams.get('pickName') || '').slice(0, 40);
  const by = shortenBy((searchParams.get('by') || 'PNYX Player').slice(0, 60));

  // 우승 아이템 이미지는 BE(NEXT_PUBLIC_API_URL) 호스트에 있다 (공개 사이트 URL 아님).
  const imageBase = process.env.NEXT_PUBLIC_API_URL || getPublicBaseUrl();

  let albertData: Buffer | undefined;
  let pretendardData: Buffer | undefined;
  let robotoData: Buffer | undefined;
  let logoDataUri = '';
  let pickDataUri = '';

  // 폰트 3종을 병렬로 읽되 개별 실패는 허용한다(allSettled). 하나가 없어도
  // 나머지 폰트로 카드가 graceful 하게 렌더된다.
  const [albertRes, pretendardRes, robotoRes] = await Promise.allSettled([
    readPublic('fonts/AlbertSans-SemiBold.ttf'),
    readPublic('fonts/Pretendard-Regular.otf'),
    readPublic('fonts/Roboto-MediumItalic.ttf'),
  ]);
  if (albertRes.status === 'fulfilled') albertData = albertRes.value;
  else console.warn('[og/share] AlbertSans load failed', albertRes.reason);
  if (pretendardRes.status === 'fulfilled') pretendardData = pretendardRes.value;
  else console.warn('[og/share] Pretendard load failed', pretendardRes.reason);
  if (robotoRes.status === 'fulfilled') robotoData = robotoRes.value;
  else console.warn('[og/share] Roboto load failed', robotoRes.reason);

  // 로고: 다크 카드(#202020)에서 회색 실루엣이 그대로 보이므로 재색칠하지 않는다.
  // 원본 3916×1208 → 표시 크기(201×62)의 2배로 다운스케일(선명도 유지 + 임베드 용량 절감).
  // 실패 시 "Pnyx" 텍스트로 폴백.
  try {
    const logoBuf = await readPublic('logo.png');
    const sharp = (await import('sharp')).default;
    // limitInputPixels: 디코딩 픽셀 상한(압축폭탄 방어). 로컬 로고지만 일관성 위해 적용.
    const png = await sharp(logoBuf, { limitInputPixels: 50_000_000 })
      .resize(402, 124, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    logoDataUri = `data:image/png;base64,${png.toString('base64')}`;
  } catch (e) {
    console.warn('[og/share] logo load failed', e);
  }

  // 픽 이미지: BE 는 webp 만 제공하는데 Satori 는 webp 를 렌더하지 못한다.
  // → sharp 로 png 트랜스코드(+다운사이즈) 후 data URI 로 임베드. 실패 시 생략.
  if (pick) {
    try {
      const res = await fetch(
        `${imageBase}/api/v1/files/download/image/${encodeURIComponent(pick)}.webp`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const input = Buffer.from(await res.arrayBuffer());
        const sharp = (await import('sharp')).default;
        // 원격 fetch 한 바이트라 디코딩 픽셀 상한으로 압축폭탄 DoS 를 방어한다.
        const png = await sharp(input, { limitInputPixels: 50_000_000 })
          .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        pickDataUri = `data:image/png;base64,${png.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[og/share] pick image fetch/transcode failed', e);
    }
  }

  const fonts: { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' | 'italic' }[] = [];
  if (albertData) fonts.push({ name: 'AlbertSans', data: albertData, weight: 600, style: 'normal' });
  if (pretendardData) fonts.push({ name: 'Pretendard', data: pretendardData, weight: 400, style: 'normal' });
  if (robotoData) fonts.push({ name: 'Roboto', data: robotoData, weight: 500, style: 'italic' });

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#191919',
          fontFamily: 'AlbertSans, Pretendard, sans-serif',
        }}
      >
        {/* 카드 프레임 (#202020 + 회색 라운드 보더) */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 21,
            width: 1167,
            height: 633,
            display: 'flex',
            backgroundColor: '#202020',
            border: '2px solid #464646',
            borderRadius: 52,
          }}
        />

        {/* 배경 중앙: warm-gray 글로우 (Figma Union 근사) */}
        <div
          style={{
            position: 'absolute',
            left: 458,
            top: 82,
            width: 283,
            height: 442,
            display: 'flex',
            backgroundImage:
              'radial-gradient(ellipse at center, rgba(154,149,141,0.30) 0%, rgba(25,25,25,0) 72%)',
          }}
        />

        {/* 좌상단: TOPIC 칩 (오렌지 보더 + 그라데이션 텍스트) */}
        <div
          style={{
            position: 'absolute',
            left: 63,
            top: 83,
            height: 47,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#202020',
            border: '3px solid #FFBE69',
            borderRadius: 40,
            paddingLeft: 17,
            paddingRight: 17,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'AlbertSans',
              fontWeight: 600,
              fontSize: 23,
              letterSpacing: '-0.41px',
              backgroundImage: BRAND_GRADIENT,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            TOPIC
          </div>
        </div>

        {/* 상단 우측: MY PICK 뱃지 + 작성자 주소 (Use_Name 보더 컨테이너) */}
        <div
          style={{
            position: 'absolute',
            left: 587,
            top: 83,
            width: 561,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            border: '2px solid #464646',
            borderRadius: 40,
            paddingRight: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#202020',
              border: '3px solid #FFBE69',
              borderRadius: 40,
              paddingLeft: 17,
              paddingRight: 17,
              height: 47,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'AlbertSans',
                fontWeight: 600,
                fontSize: 23,
                letterSpacing: '-0.41px',
                backgroundImage: BRAND_GRADIENT,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              MY PICK
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 15,
              fontFamily: 'Pretendard',
              fontSize: 19,
              color: '#464646',
              letterSpacing: '-0.34px',
            }}
          >
            {by}
          </div>
        </div>

        {/* 좌측 컬럼: 타이틀 박스 (No.1 pill 은 로고 바로 위로 분리 배치) */}
        <div
          style={{
            position: 'absolute',
            left: 51,
            top: 151,
            width: 494,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 타이틀 (아웃라인 박스) */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              border: '3px solid #464646',
              borderRadius: 40,
              paddingLeft: 33,
              paddingRight: 33,
              paddingTop: 28,
              paddingBottom: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'AlbertSans, Pretendard',
                fontWeight: 600,
                fontSize: 35,
                lineHeight: 1.05,
                color: '#E5E5E5',
              }}
            >
              {title}
            </div>
          </div>
        </div>

        {/* "What's your No.1?" pill + 화살표 — PNYX 로고 바로 위에 붙여 배치 */}
        <div
          style={{
            position: 'absolute',
            left: 51,
            bottom: 145,
            width: 494,
            height: 74,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#464646',
            borderRadius: 40,
            paddingLeft: 33,
            paddingRight: 7,
          }}
        >
          <div
            style={{
              display: 'flex',
              flex: 1,
              fontFamily: 'AlbertSans, Pretendard',
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: '-0.43px',
              color: '#909090',
            }}
          >
            What&apos;s your No.1?
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#E5E5E5',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 L7.5 16.5 M7.5 16.5 L7.5 9.5 M7.5 16.5 L14.5 16.5"
                stroke="#464646"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* 하단 좌측: PNYX 로고 (logo.png 원본 회색 실루엣 그대로) */}
        {logoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUri}
            width={201}
            height={62}
            alt="PNYX"
            style={{ position: 'absolute', left: 65, bottom: 69 }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 65,
              bottom: 60,
              display: 'flex',
              fontFamily: 'AlbertSans',
              fontWeight: 600,
              fontSize: 56,
              color: '#E5E5E5',
            }}
          >
            Pnyx
          </div>
        )}

        {/* 우측: 픽 이미지 + MY PICK 이름 */}
        <div
          style={{
            position: 'absolute',
            left: 575,
            top: 151,
            width: 573,
            height: 441,
            display: 'flex',
            borderRadius: 29,
            overflow: 'hidden',
            backgroundColor: '#2C2C2C',
          }}
        >
          {pickDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pickDataUri}
              alt={pickName || 'pick'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 170,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: 36,
              backgroundImage: 'linear-gradient(to bottom, rgba(25,25,25,0) 0%, rgba(25,25,25,0.5) 100%)',
            }}
          >
            {pickName ? (
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Roboto, Pretendard',
                  fontWeight: 500,
                  fontStyle: 'italic',
                  fontSize: 46,
                  color: '#FFFFFF',
                  letterSpacing: '-0.83px',
                }}
              >
                {pickName}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts.length ? fonts : undefined,
      // 쿼리 파라미터에 대해 결정적인 이미지 → CDN/브라우저 캐시로 재계산 비용 분산
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
