/**
 * 전당(Hall) 상세 라우트 로딩 폴백.
 * 다크 UI 규칙: 배경 bg-primary, 스피너 text-white.
 */

import { Spinner } from '~/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <Spinner className="text-white" size={28} />
    </div>
  );
}
