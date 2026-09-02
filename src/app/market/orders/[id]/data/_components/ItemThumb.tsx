'use client';

/**
 * 데이터셋 대시보드용 아이템 썸네일.
 * `imageName` 은 구매자 전용 카탈로그(참고 정보)에서만 나오므로 없을 수 있다 —
 * 그때는 스피너를 무한히 돌리지 않고 이름 이니셜 플레이스홀더를 보여 준다.
 */

import ItemImage from '~/components/ui/ItemImage';
import { useImageFile } from '~/hooks';

interface ItemThumbProps {
  imageName?: string;
  alt: string;
  /** 컨테이너 크기 클래스. 기본 32px. */
  className?: string;
  spinnerSize?: number;
}

export default function ItemThumb({ imageName, alt, className = 'h-8 w-8', spinnerSize = 12 }: ItemThumbProps) {
  const { data: imageUrl } = useImageFile(imageName);

  if (!imageName) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-primary-900 text-[9px] font-[600] uppercase text-brand-primary-500 ${className}`}
        aria-hidden
      >
        {alt.replace(/^#/, '').slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 overflow-hidden rounded-md bg-brand-primary-900 ${className}`}>
      <ItemImage src={imageUrl} alt={alt} spinnerSize={spinnerSize} />
    </div>
  );
}
