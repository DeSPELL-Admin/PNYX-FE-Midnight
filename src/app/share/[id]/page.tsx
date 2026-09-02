import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicBaseUrl } from '~/lib/url';

/**
 * 토너먼트 결과 공유 랜딩 + OG/twitter 메타 (0608 기획).
 *
 * X 인텐트에 첨부되는 URL(`/share/[id]?title=&pick=&pickName=&by=`)이 이 페이지로
 * 들어오면, generateMetadata 가 1200×675 카드(`/og/share`)를 og:image / twitter:image
 * 로 노출해 트윗 언퍼링을 담당한다. 페이지 본문은 결과/플레이로 유도하는 간단한 랜딩.
 */

interface SharePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function pickParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({
  params,
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const title = pickParam(sp, 'title') || 'PNYX';
  const pick = pickParam(sp, 'pick') || '';
  const pickName = pickParam(sp, 'pickName') || '';
  const by = pickParam(sp, 'by') || '';

  const baseUrl = getPublicBaseUrl();
  const og = new URL(`${baseUrl}/og/share`);
  og.searchParams.set('title', title);
  if (pick) og.searchParams.set('pick', pick);
  if (pickName) og.searchParams.set('pickName', pickName);
  if (by) og.searchParams.set('by', by);
  const ogImage = og.toString();

  const pageTitle = `${title} · PNYX`;
  const description = "Who's your winner? Pick & settle it. Endless tournaments, zero rules.";

  return {
    title: pageTitle,
    description,
    openGraph: {
      type: 'website',
      title: pageTitle,
      description,
      url: `${baseUrl}/share/${id}`,
      images: [{ url: ogImage, width: 1200, height: 675 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold text-white">PNYX</h1>
      <p className="text-[15px] text-brand-primary-300">
        Who&apos;s your winner? Pick &amp; settle it.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href={`/hall/${id}`}
          className="rounded-[8px] bg-point-yellow px-4 py-3 font-semibold text-brand-primary-900"
        >
          View result
        </Link>
        <Link
          href={`/tournament/${id}`}
          className="rounded-[8px] border border-brand-primary-600 px-4 py-3 font-semibold text-white"
        >
          Play this tournament
        </Link>
      </div>
    </div>
  );
}
