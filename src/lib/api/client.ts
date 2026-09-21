/**
 * API Client - 신규 인증 백엔드(`/api/v1`)를 향한 fetch 추상화 레이어
 *
 * 신규 BE 는 Midnight + JWT(HttpOnly 쿠키) 인증 게이트가 걸린 `/api/v1` 표면만 서빙한다.
 * 따라서 이 클라이언트는:
 *  - 기본적으로 `/api/v1` prefix 를 붙이고(`versioned` 옵션으로 끌 수 있음),
 *  - 모든 요청에 `credentials: 'include'`(쿠키)를 실어 보내며,
 *  - 401 응답 시 single-flight refresh → 1회 retry → 실패 시 세션 만료 핸들러 호출.
 *
 * 환경변수:
 * - NEXT_PUBLIC_API_URL: BE base URL. 비어 있으면 same-origin(빈 base).
 * - NEXT_PUBLIC_API_GENERATION: 'v1'(기본, 신규 인증 BE) | 'legacy'(롤백). 미설정 시 'v1'.
 * - NEXT_PUBLIC_API_KEY: 설정 시 `X-API-Key` 헤더로 부착(외부 BE 가 무시해도 무해).
 */

// 외부 백엔드 URL. 비어 있으면 same-origin(빈 base)으로 동작한다.
const EXTERNAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

// API 기본 URL 결정 (빈 base = same-origin)
export const API_BASE_URL = EXTERNAL_API_URL || '';

// 외부 백엔드 사용 여부 (X-API-Key 부착 조건)
export const isExternalBackend = !!EXTERNAL_API_URL;

/**
 * API 세대 플래그 — 롤백용.
 * 'v1'(기본) = 신규 인증 BE. 'legacy' = 구 클라이언트 동작으로 롤백.
 * BE 라우트가 전면 교체됐으므로 평소엔 'v1' 만 의미가 있다.
 */
const API_GENERATION = process.env.NEXT_PUBLIC_API_GENERATION ?? 'v1';
const isV1 = API_GENERATION === 'v1';

/**
 * 버전 prefix.
 * - versioned 요청: `/api/v1` (대부분의 도메인 라우트)
 * - non-versioned 요청: `/api` (BE health 는 VERSION_NEUTRAL → `/api/health`)
 */
export const API_V1_PREFIX = '/api/v1';
const API_NEUTRAL_PREFIX = '/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  responseType?: 'json' | 'blob' | 'text';
  /**
   * 버전 prefix 부착 여부 (기본 true → `/api/v1`).
   * false 면 `/api`(VERSION_NEUTRAL, 예: health)로 보낸다.
   */
  versioned?: boolean;
  /**
   * 401 시 자동 refresh 를 건너뛴다 (기본 false).
   * auth 엔드포인트(/auth/*)는 무한 루프 방지를 위해 강제로 skip 된다.
   */
  skipAuthRefresh?: boolean;
  /**
   * 공개(인증 불필요) 리소스 요청 (기본 false).
   *
   * 파일/이미지 엔드포인트는 BE 가 `Access-Control-Allow-Origin: '*'` + ACAC 제거로
   * 응답한다(어디서나 임베드 가능하도록). 이때 `credentials: 'include'`(쿠키)를 실으면
   * 브라우저가 "credentialed 요청엔 와일드카드 ACAO 불가" 규칙으로 CORS 차단한다.
   * 따라서 공개 리소스는 credentials 와 X-API-Key 를 빼고 simple GET 으로 보내
   * 와일드카드 ACAO 를 수용하게 한다(쿠키도 어차피 불필요).
   */
  publicResource?: boolean;
};

type NextFetchRequestConfig = {
  revalidate?: number | false;
  tags?: string[];
};

/**
 * 세션 만료 핸들러 훅.
 *
 * refresh 가 끝내 실패했을 때 단 한 번 호출된다. fetch 레이어가 React/router 를
 * import 하지 않도록, Phase 2 에서 `setOnSessionExpired` 로 redirect + 캐시 클리어를
 * 주입한다. 이 클라이언트는 직접 하드 리다이렉트하지 않는다.
 */
let onSessionExpired: (() => void) | null = null;

/**
 * 세션 만료 핸들러를 등록/해제한다. (null 로 해제)
 */
export function setOnSessionExpired(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/**
 * "실제 세션이 있었는가" 플래그.
 *
 * 핵심: 한 번도 인증한 적 없는 사용자(/login, 연결만 한 상태)의 `GET /me` 프로브는
 * 401 → refresh 401 이 정상 흐름이며, 여기서 onSessionExpired 를 발동하면
 * clear→재프로브→401→clear 루프에 빠진다. 따라서 onSessionExpired 는 "이전에
 * 성공(2xx)한 적이 있는" 진짜 만료에서만 발동한다. 미인증 401 은 단순히 throw 한다.
 *
 * 성공 응답마다 true, 신원 변경/로그아웃(bumpIdentityGeneration)·만료 발동 시 false.
 */
let hadSession = false;

/**
 * 신원(identity) 세대 토큰.
 *
 * 지갑 전환/로그아웃으로 캐시를 비운 뒤, 이전 신원의 in-flight 응답이 뒤늦게
 * 도착해 새 캐시를 오염시키는 레이스를 막는다. 요청 시작 시 현재 세대를 캡처하고,
 * await fetch 직후 세대가 바뀌었으면 무해한 abort(ApiError(0))로 던진다.
 */
let identityGeneration = 0;

/**
 * 신원 세대를 1 증가시킨다. (지갑 주소 변경/로그아웃 시 호출)
 */
export function bumpIdentityGeneration(): void {
  identityGeneration++;
  // 새 신원은 아직 세션이 확인되지 않았다 → 다음 401 이 만료로 오인되지 않게 리셋.
  hadSession = false;
}

/**
 * single-flight refresh 프로미스.
 *
 * 동시 다발 401 이 같은 refresh 를 공유하도록 모듈 레벨에 보관한다.
 * 성공 시 true, 실패 시 false 로 resolve 한다.
 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * `POST /api/v1/auth/refresh` 를 1회만 수행하고 결과를 공유한다(single-flight).
 * refresh 요청 자체는 자격증명만 싣고 보내 무한 루프를 막는다.
 */
function performRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${API_V1_PREFIX}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        // 다음 401 사이클을 위해 즉시 비운다.
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * /auth/* 엔드포인트는 refresh 사이클을 타면 안 된다(루프 방지).
 */
function isAuthEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/auth/') || endpoint === '/auth';
}

/**
 * API 요청을 보내는 기본 함수.
 *
 * v1 모드: `${API_BASE_URL}${prefix}${endpoint}` + credentials:'include'.
 * 401 시 single-flight refresh → 1회 retry. 실패하면 onSessionExpired 호출 + 401 throw.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    cache,
    next,
    responseType = 'json',
    versioned = true,
    skipAuthRefresh = false,
    publicResource = false,
  } = options;

  // v1 모드에서만 prefix/credentials 를 적용한다. legacy 롤백 시 구 동작 유지.
  const prefix = isV1 ? (versioned ? API_V1_PREFIX : API_NEUTRAL_PREFIX) : '';
  const url = `${API_BASE_URL}${prefix}${endpoint}`;

  // auth 엔드포인트는 자동 refresh 대상에서 강제 제외(루프 방지).
  const noRefresh = skipAuthRefresh || isAuthEndpoint(endpoint);

  const fetchOptions: RequestInit & { next?: NextFetchRequestConfig } = {
    method,
    headers: {
      ...(responseType === 'json' ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
      // 외부 백엔드 사용 시 인증 헤더 추가(BE 가 무시해도 무해).
      // 공개 리소스(publicResource)는 커스텀 헤더를 빼 preflight 없는 simple 요청으로 만든다.
      ...(isExternalBackend && process.env.NEXT_PUBLIC_API_KEY && !publicResource
        ? { 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY }
        : {}),
    },
    // 쿠키 기반 인증: v1 모드에서는 자격증명을 함께 보낸다.
    // 단, 공개 리소스(이미지 등 ACAO:'*' 응답)는 credentials 를 빼야 CORS 가 통과한다.
    ...(isV1 && !publicResource ? { credentials: 'include' as RequestCredentials } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(cache ? { cache } : {}),
    ...(next ? { next } : {}),
  };

  // 신원 세대 캡처: 응답이 돌아온 뒤 신원이 바뀌었으면 폐기한다.
  const gen = identityGeneration;
  const response = await fetch(url, fetchOptions);

  // 지갑 전환/로그아웃 등으로 캐시가 비워진 뒤 도착한 응답이면 무해하게 폐기.
  if (gen !== identityGeneration) {
    throw new ApiError(0, 'stale identity');
  }

  // 401: single-flight refresh → 1회 retry. (auth 엔드포인트/skip 요청은 제외)
  if (response.status === 401 && isV1 && !noRefresh) {
    const refreshed = await performRefresh();

    if (refreshed) {
      // refresh 성공: 원 요청을 정확히 1회만 재시도.
      const retryGen = identityGeneration;
      const retryResponse = await fetch(url, fetchOptions);

      if (retryGen !== identityGeneration) {
        throw new ApiError(0, 'stale identity');
      }

      if (retryResponse.status !== 401) {
        if (retryResponse.ok) hadSession = true;
        return parseResponse<T>(retryResponse, responseType);
      }
      // 재시도도 401 → 세션 만료로 간주.
    }

    // refresh 실패(또는 재시도 후에도 401).
    // "이전에 성공(2xx)한 세션이 있었을 때"만 만료 핸들러를 발동한다.
    // 한 번도 인증한 적 없는 미인증 401 은 단순히 throw → 루프/전역 clear 방지.
    if (hadSession) {
      hadSession = false;
      onSessionExpired?.();
    }
    throw new ApiError(401, 'Session expired');
  }

  if (response.ok) hadSession = true;
  return parseResponse<T>(response, responseType);
}

/**
 * 응답 본문 파싱 (json/blob/text). 에러 응답은 ApiError 로 변환.
 */
async function parseResponse<T>(
  response: Response,
  responseType: 'json' | 'blob' | 'text'
): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API Error' }));
    throw new ApiError(response.status, error.message || error.error || 'Unknown error');
  }

  if (responseType === 'blob') {
    return response.blob() as Promise<T>;
  }
  if (responseType === 'text') {
    return response.text() as Promise<T>;
  }

  // 204 No Content(예: POST /escrow) 또는 명시적 빈 본문은 성공이다 — 파싱할 것이 없다.
  // 이걸 json() 에 태우면 SyntaxError → "Invalid JSON response" 로 성공 요청이 실패로 보고된다.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  // 200 응답이라도 본문이 JSON 이 아닐 수 있다(게이트웨이 HTML, 빈 본문 등).
  // 보호 없이 파싱하면 uncaught SyntaxError 가 React Query 재시도 루프를 유발하므로
  // ApiError 로 변환해 기존 에러 처리 흐름에 태운다.
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, 'Invalid JSON response');
  }
}

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * GET 요청 헬퍼
 */
export function apiGet<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST 요청 헬퍼
 */
export function apiPost<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * PUT 요청 헬퍼
 */
export function apiPut<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(endpoint, { ...options, method: 'PUT', body });
}

/**
 * DELETE 요청 헬퍼
 */
export function apiDelete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}
