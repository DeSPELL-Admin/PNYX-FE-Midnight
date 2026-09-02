import { APP_URL } from './constants';

/**
 * 공개(공유/OG)용 베이스 URL.
 *
 * 환경변수 `NEXT_PUBLIC_URL` 을 1순위로 사용한다 (env 별로 다름: prod=https://pnyx.fun,
 * dev=https://dev.pnyx.fun). 미설정 시 클라이언트는 현재 origin, 서버는 APP_URL 상수로 폴백.
 *
 * 공유 링크/OG 메타가 배포 도메인을 정확히 가리키도록 하기 위함 — 상수 하드코딩 금지.
 */
export function getPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return APP_URL;
}
