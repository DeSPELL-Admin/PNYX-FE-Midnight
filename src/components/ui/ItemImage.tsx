import Image from 'next/image';
import { Spinner } from '~/components/ui/Spinner';

interface ItemImageProps {
  /** 이미지 URL. falsy(아직 로딩 중이거나 누락) 면 스피너 폴백을 렌더한다. */
  src?: string;
  alt: string;
  /** 폴백 스피너 크기(px). 컨테이너 크기에 맞춰 지정. 기본 24. */
  spinnerSize?: number;
}

/**
 * 아이템 썸네일 이미지. 부모는 `relative`(+크기 지정) 여야 한다(next/image `fill` 요구사항).
 *
 * URL 이 없으면(아직 로딩 중이거나 누락) 플레이스홀더 이미지 대신 로딩 스피너를 보여 준다.
 * (이전에는 `/images/skeleton.png` 더미 이미지를 폴백으로 썼다.)
 */
export default function ItemImage({ src, alt, spinnerSize = 24 }: ItemImageProps) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-brand-primary-800">
        <Spinner className="text-brand-primary-300" size={spinnerSize} />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill className="object-cover" draggable={false} />;
}
