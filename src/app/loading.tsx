/**
 * 루트 로딩 폴백.
 *
 * 라우트 세그먼트 전환/서버 데이터 대기 중 백지 대신 스피너를 보여 준다.
 * 다크 UI 규칙: 배경 bg-primary, 스피너 색은 명시적으로 text-white.
 */

import { Spinner } from '~/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-primary">
      <Spinner className="text-white" size={28} />
    </div>
  );
}
