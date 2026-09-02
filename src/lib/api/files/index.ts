import { apiGet, API_BASE_URL, API_V1_PREFIX } from "../client";
import { mockGetImageFile, mockGetJsonFiles, mockImageUrl } from "../_mocks/files";
import { USE_MOCK } from "../config";

export async function getJsonFiles(originalName: string): Promise<{key: string, value: string}[]> {
  if (USE_MOCK) return mockGetJsonFiles(originalName);
  // 경로는 /files/... 만 넘긴다 — 클라이언트가 /api/v1 prefix 를 자동 부착(이중 /api 방지).
  // 공개 파일: credentials 없이 요청(이미지와 동일 정책).
  return apiGet(`/files/download/json/${originalName}`, { publicResource: true });
}

// 이미지 확장자(.webp) 처리와 Blob URL 수명 관리의 단일 소유자.
// - 확장자는 여기 한 곳에서만 붙인다(M13). 호출부는 확장자 없는 이름만 넘긴다.
// - 같은 이미지 이름에 대해 Blob URL 을 한 번만 만들고 참조 카운트로 공유한다(H1).
//   useImageFile(React Query) 와 게임 progressive loader 가 같은 캐시를 공유하므로
//   동일 이미지가 중복 Blob 을 만들지 않는다.
const IMAGE_EXT = '.webp';

interface BlobCacheEntry {
  url: string;
  refCount: number;
}

// imageName(확장자 제외) → { objectURL, refCount }
const imageBlobCache = new Map<string, BlobCacheEntry>();

// 확장자가 이미 붙어 있으면 떼어 캐시 키를 정규화한다.
function normalizeImageName(originalName: string): string {
  return originalName.replace(/\.(webp|jpg|jpeg|png)$/i, '');
}

/**
 * 이미지의 직접 접근 URL 을 만든다.
 *
 * 이미지 엔드포인트는 공개(인증 불필요 — client.ts 의 publicResource 주석 참고: BE 가
 * `Access-Control-Allow-Origin: '*'` 로 응답)이므로, Blob 으로 통째 다운로드하지 않고
 * URL 만으로 `next/image` 가 바로 최적화(리사이즈/포맷)·캐시할 수 있다.
 * 확장자 정규화는 getImageFile 과 동일하게 한 곳에서 처리한다(M13).
 */
export function buildImageUrl(originalName: string): string {
  const name = normalizeImageName(originalName);
  if (!name) return '';
  if (USE_MOCK) return mockImageUrl(`${name}${IMAGE_EXT}`);
  return `${API_BASE_URL}${API_V1_PREFIX}/files/download/image/${name}${IMAGE_EXT}`;
}

/**
 * 이미지 파일을 받아 Blob object URL 을 반환한다.
 * 동일 이름에 대해서는 캐시된 URL 을 재사용하고 참조 카운트를 늘린다.
 * 소비가 끝나면 반드시 releaseImageFile(name) 로 해제해야 누수가 없다.
 */
export async function getImageFile(originalName: string): Promise<string> {
  const name = normalizeImageName(originalName);
  if (USE_MOCK) return mockGetImageFile(name + IMAGE_EXT);
  if (typeof window === 'undefined') return '';

  const cached = imageBlobCache.get(name);
  if (cached) {
    cached.refCount += 1;
    return cached.url;
  }

  // 공개 이미지: BE 가 ACAO:'*' 로 응답하므로 credentials 를 빼야 CORS 통과(publicResource).
  const blob = await apiGet<Blob>(`/files/download/image/${name}${IMAGE_EXT}`, {
    responseType: 'blob',
    publicResource: true,
  });
  // await 중 다른 호출이 먼저 캐시를 채웠을 수 있으니 재확인 (중복 Blob 방지)
  const raced = imageBlobCache.get(name);
  if (raced) {
    raced.refCount += 1;
    return raced.url;
  }

  const url = URL.createObjectURL(blob);
  imageBlobCache.set(name, { url, refCount: 1 });
  return url;
}

/**
 * getImageFile 로 얻은 URL 소비를 끝낼 때 호출한다.
 * 참조 카운트가 0 이 되면 revokeObjectURL 로 Blob 을 해제하고 캐시에서 제거한다.
 */
export function releaseImageFile(originalName: string): void {
  if (USE_MOCK || typeof window === 'undefined') return;
  const name = normalizeImageName(originalName);
  const entry = imageBlobCache.get(name);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url);
    imageBlobCache.delete(name);
  }
}