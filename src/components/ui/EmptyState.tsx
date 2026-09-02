import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 상단 안내 문구 (회색 톤) */
  message: ReactNode;
  /** 하단 강조 문구 (포인트 옐로우). 없으면 미표시 */
  hint?: ReactNode;
  className?: string;
}

/**
 * 토너먼트 목록 등에서 공통으로 쓰는 빈 상태 카드.
 * 다크 고정 UI 기준 색상을 명시적으로 지정한다.
 */
export default function EmptyState({ message, hint, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-16 px-6 rounded-xl border border-brand-primary-700 bg-brand-primary-800/40 ${className}`}
    >
      <p className="text-[14px] text-brand-primary-400">{message}</p>
      {hint && <p className="text-[16px] font-[600] text-point-yellow tracking-wide">{hint}</p>}
    </div>
  );
}
