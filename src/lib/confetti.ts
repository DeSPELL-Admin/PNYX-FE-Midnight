/**
 * 우승/온체인 제출 성공 시 화면 양쪽에서 터지는 축포 효과.
 *
 * canvas-confetti 는 동적 import 로 메인 번들에서 분리한다 (성공 시점에만 로드).
 */
export async function fireCelebrationConfetti(durationMs: number = 3 * 1000): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');

  const animationEnd = Date.now() + durationMs;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    // 파티클은 아래로 떨어지므로 랜덤보다 살짝 위에서 시작
    const particleCount = 50 * (timeLeft / durationMs);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}
