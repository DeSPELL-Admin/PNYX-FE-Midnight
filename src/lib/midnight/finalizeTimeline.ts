/**
 * finalize 타임라인 계측 — 게임 시작부터 포인트 반영까지 각 단계의 시각을 기록한다.
 *
 * 백그라운드 단계(prewarm, grant 선요청)는 UI 에 보이지 않으므로 여기서 남긴 기록이 "잘 돌았는지"를
 * 확인하는 유일한 수단이다. WASM 을 끌어오지 않는 순수 모듈이라 어디서든 정적 import 해도 된다.
 *
 *   - 개발 빌드: 매 단계가 `[finalize +12.3s] name {meta}` 로 console.log 에 찍힌다.
 *   - 프로덕션: 기본은 조용하다. DevTools 콘솔에서 `localStorage.setItem('pnyx:debug:finalize','1')` 뒤 새로고침하면 켜진다.
 *   - 언제든 `window.__pnyxFinalize.summary()` 로 표를 다시 볼 수 있고, `.events` 로 원본을 볼 수 있다.
 *   - `done` 시점에 자동으로 console.table 요약 + 핵심 구간(세션 준비, grant, 증명, 클릭→성공, 마무리) 소요 시간을 찍는다.
 */

export type TimelineEvent = {
  name: string;
  /** performance.now() 기준 절대 시각(ms) */
  at: number;
  /** 게임 시작(첫 mark) 이후 경과(ms) */
  sinceStart: number;
  /** 직전 이벤트 이후 경과(ms) */
  sincePrev: number;
  meta?: Record<string, unknown>;
};

const DEBUG_KEY = 'pnyx:debug:finalize';
const events: TimelineEvent[] = [];
let startAt: number | undefined;
let currentGame: string | undefined;

const isBrowser = () => typeof window !== 'undefined';
const enabled = (): boolean => {
  if (!isBrowser()) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    return window.localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

const sec = (ms: number) => Number((ms / 1000).toFixed(2));

/**
 * 이벤트 사이 구간 — 마지막 `to` 와 그 직전의 마지막 `from` 사이. 없으면 undefined.
 * 실패 후 재시도(같은 이름의 mark 가 여러 번)가 있으면 성공한 마지막 시도만 잰다.
 * (첫 `from`→첫 `to` 로 재면 실패한 시도의 시작과 성공한 시도의 끝이 섞여 구간이 부풀려진다.)
 */
function span(from: string, to: string): number | undefined {
  const b = events.findLast((e) => e.name === to);
  if (!b) return undefined;
  const a = events.findLast((e) => e.name === from && e.at <= b.at);
  return a ? b.at - a.at : undefined;
}

export function summary(): void {
  if (!isBrowser()) return;
  console.table(
    events.map((e) => ({
      step: e.name,
      'at(s)': sec(e.sinceStart),
      'Δ(s)': sec(e.sincePrev),
      ...(e.meta ?? {}),
    })),
  );
  const spans: Record<string, number | undefined> = {
    'session(WASM→join)': span('session:start', 'session:ready'),
    'prover-key prefetch': span('prefetch:start', 'prefetch:ready'),
    'grant(BE)': span('grant:request', 'grant:ready'),
    'click→grant awaited': span('click', 'grant:awaited'),
    'click→session awaited': span('click', 'session:awaited'),
    'leaf wait': span('leaf:wait', 'leaf:visible'),
    'prove+wallet+submit': span('prove:start', 'submitted'),
    '  ├ proof server': span('prove:server:start', 'prove:server:done'),
    '  ├ wallet (DUST proof + approve)': span('wallet:balance:start', 'wallet:balance:done'),
    '  └ submit': span('wallet:balance:done', 'submit:done'),
    'click→success screen': span('click', 'submitted'),
    'confirm(BE)': span('submitted', 'confirm:done'),
    'escrow(BE)': span('submitted', 'escrow:done'),
    'click→done': span('click', 'done'),
  };
  console.table(
    Object.fromEntries(Object.entries(spans).map(([k, v]) => [k, { seconds: v === undefined ? '-' : sec(v) }])),
  );
}

/** 새 게임이 활성화될 때 — 다른 토너먼트면 기록을 비우고 시작점을 다시 잡는다. */
export function startGame(gameKey: string): void {
  if (currentGame === gameKey) return;
  currentGame = gameKey;
  events.length = 0;
  startAt = undefined;
  mark('game:start', { game: gameKey });
}

export function mark(name: string, meta?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  const now = performance.now();
  if (startAt === undefined) startAt = now;
  const prev = events.length ? events[events.length - 1].at : now;
  const ev: TimelineEvent = { name, at: now, sinceStart: now - startAt, sincePrev: now - prev, meta };
  events.push(ev);
  (window as Window & { __pnyxFinalize?: unknown }).__pnyxFinalize = { events, summary };
  // console.debug 는 Chrome 기본 필터(Verbose 숨김)에서 안 보인다 — log 레벨로 찍는다.
  if (enabled()) console.log(`[finalize +${sec(ev.sinceStart)}s] ${name}`, meta ?? '');
  if (name === 'done' && enabled()) summary();
}

/** 실패 기록 — 에러의 식별 정보만 남긴다(스택/witness 는 남기지 않는다). Lace 에러는 {code, info} 모양이라 함께 잡는다. */
export function markError(name: string, error: unknown): void {
  type Loose = { name?: unknown; message?: unknown; code?: unknown; info?: unknown; cause?: unknown; failure?: unknown; _tag?: unknown; error?: unknown };
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).slice(0, 200));
  const e = (error ?? {}) as Loose;
  // Lace(wallet-sdk) 는 Effect 의 FiberFailure 로 실패를 돌려준다: { cause: { _tag:'Fail', failure: <실제 에러> } }.
  // cause → failure → cause … 를 따라 내려가며 처음 나오는 사람이 읽을 수 있는 메시지를 찾는다.
  let root: Loose | undefined = e;
  let detail: string | undefined;
  for (let depth = 0; root && depth < 6; depth++) {
    detail = str(root.message) || str(root.info) || str(root._tag !== 'Fail' ? root._tag : undefined);
    if (detail && root !== e) break;
    root = (root.failure ?? root.cause ?? root.error) as Loose | undefined;
  }
  mark(name, {
    error: str(e.message) || str(error) || '(empty)',
    errName: str(e.name),
    code: str(e.code),
    info: str(e.info),
    cause: detail,
  });
}
