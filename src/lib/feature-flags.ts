/**
 * Feature Flags 설정
 * 
 * Farcaster → Startale 전환을 위한 기능 플래그입니다.
 * 환경변수를 통해 점진적으로 기능을 전환할 수 있습니다.
 */

/**
 * Feature Flag 타입
 */
export interface FeatureFlags {
  /** Google Analytics 4 활성화 여부 */
  analyticsEnabled: boolean;

  /** Startale 지갑 사용 여부 */
  useStartaleWallet: boolean;
  
  /** Startale 포인트 시스템 사용 여부 */
  useStartalePoints: boolean;
  
  /** Startale 계정 추상화 사용 여부 */
  useStartaleAccountAbstraction: boolean;

  /**
   * API 세대.
   * 'v1' = 신규 인증 BE(/api/v1), 'legacy' = 구 클라이언트로 롤백. 기본 'v1'.
   */
  apiGeneration: 'v1' | 'legacy';

  /** 디버그 모드 */
  debugMode: boolean;
}

/**
 * 환경변수 문자열을 boolean 으로 변환
 *
 * NEXT_PUBLIC_* 환경변수는 정적 리터럴 접근(process.env.NEXT_PUBLIC_XXX)일 때만
 * Next.js 가 번들에 값을 치환한다. 동적 인덱싱(process.env[key])은 클라이언트에서
 * 항상 undefined 가 되므로 사용하지 않는다. 따라서 각 플래그는 아래 features 에서
 * 정적으로 참조하고, 이 함수는 단순 문자열 → boolean 변환만 담당한다.
 */
function toBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  return value === 'true' || defaultValue;
}

/**
 * 현재 Feature Flags
 *
 * NEXT_PUBLIC_* 는 반드시 정적 리터럴로 참조해야 클라이언트 번들에 치환된다.
 */
export const features: FeatureFlags = {
  // Google Analytics 4 (측정 ID가 설정된 경우에만 활성화)
  analyticsEnabled: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,

  // Startale SDK 관련 플래그 (기본값: false - Wagmi 기본 사용)
  useStartaleWallet: toBoolean(process.env.NEXT_PUBLIC_USE_STARTALE_WALLET, false),
  useStartalePoints: toBoolean(process.env.NEXT_PUBLIC_USE_STARTALE_POINTS, false),
  useStartaleAccountAbstraction: toBoolean(process.env.NEXT_PUBLIC_USE_STARTALE_AA, false),

  // API 세대 (정적 리터럴 참조 필수). 'legacy' 이외는 모두 'v1' 로 흡수.
  apiGeneration:
    process.env.NEXT_PUBLIC_API_GENERATION === 'legacy' ? 'legacy' : 'v1',

  // 일반 플래그
  debugMode: toBoolean(process.env.NEXT_PUBLIC_DEBUG_MODE, false),
};

/**
 * 현재 지갑 프로바이더 타입
 */
export type WalletProviderType = 'wagmi' | 'startale';
export const currentWalletProvider: WalletProviderType = features.useStartaleWallet
  ? 'startale'
  : 'wagmi';

/**
 * Feature Flag 상태 로깅 (디버그용)
 */
export function logFeatureFlags(): void {
  if (features.debugMode && typeof console !== 'undefined') {
    console.group('🚩 Feature Flags');
    console.log('analyticsEnabled:', features.analyticsEnabled);
    console.log('useStartaleWallet:', features.useStartaleWallet);
    console.log('useStartalePoints:', features.useStartalePoints);
    console.log('useStartaleAccountAbstraction:', features.useStartaleAccountAbstraction);
    console.log('apiGeneration:', features.apiGeneration);
    console.log('debugMode:', features.debugMode);
    console.log('---');
    console.log('currentWalletProvider:', currentWalletProvider);
    console.groupEnd();
  }
}

