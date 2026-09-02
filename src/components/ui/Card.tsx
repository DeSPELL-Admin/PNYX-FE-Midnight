import ItemImage from '~/components/ui/ItemImage';
import { useImageFile } from '~/hooks';
import CategoryChip from '~/components/ui/CategoryChip';

interface CardProps {
  title: string;
  imageName1: string;
  imageName2: string;
  onClick?: () => void;
  className?: string;
  /** 상태 뱃지 텍스트 (라운드/결과/완료 등) */
  badge?: string;
  /** 'green' = 완료(Completed) 솔리드 그린 칩·우상단 / 그 외 기본 'yellow' = 라운드·결과 칩·좌상단 */
  badgeVariant?: 'yellow' | 'green';
  /** 토너먼트 category — 하단 좌측, 타이틀 위 컬러 아웃라인 칩 (Figma 27:739) */
  theme?: string;
  /** category 칩 액센트 컬러 직접 지정(hex). 미지정 시 카테고리명으로 자동 */
  themeColor?: string;
}

export default function Card({ title, imageName1, imageName2, imageUrl1: propImageUrl1, imageUrl2: propImageUrl2, onClick, className = '', badge, badgeVariant = 'yellow', theme, themeColor }: CardProps & { imageUrl1?: string; imageUrl2?: string }) {

  const { data: fetchedImageUrl1 } = useImageFile(imageName1);
  const { data: fetchedImageUrl2 } = useImageFile(imageName2);

  const finalImageUrl1 = fetchedImageUrl1;
  const finalImageUrl2 = fetchedImageUrl2;

  return (
    <div
      className={`relative bg-brand-primary-800 border border-brand-primary-700 rounded-xl overflow-hidden cursor-pointer hover:border-brand-primary-500 hover:shadow-md transition-all ${className}`}
      onClick={onClick}
    >
      {/* 좌상단: 라운드/결과 노랑 뱃지 (진행중 목록) */}
      {badge && badgeVariant !== 'green' && (
        <div className="absolute top-2 left-2 z-20 rounded-full bg-point-yellow px-2 py-0.5 text-[11px] font-[600] text-black">
          {badge}
        </div>
      )}
      {/* 우상단: 완료(Completed) 솔리드 그린 뱃지 */}
      {badge && badgeVariant === 'green' && (
        <CategoryChip label={badge} variant="completed" className="absolute top-2 right-2 z-20" />
      )}

      {/* 좌/우 이미지 2분할 (164:164 · 112h) */}
      <div className="grid grid-cols-2 w-full h-28">
        <div className="relative w-full h-full">
          <ItemImage src={finalImageUrl1} alt={title} spinnerSize={20} />
        </div>
        <div className="relative w-full h-full">
          <ItemImage src={finalImageUrl2} alt={title} spinnerSize={20} />
        </div>
      </div>

      {/* 하단 좌측: category 칩(블러 X, 이미지 위) → 타이틀(블러는 타이틀 영역까지만) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-1">
        {theme?.trim() && (
          <CategoryChip
            label={theme}
            variant="category"
            color={themeColor}
            className="ml-[9px] max-w-[calc(100%_-_18px)] overflow-hidden"
          />
        )}
        {title && (
          <div className="relative w-full">
            {/* backdrop-blur 는 토너먼트 타이틀 영역까지만 (카테고리 칩은 블러 제외) */}
            <div className="absolute inset-0 backdrop-blur-[5px] bg-gradient-to-t from-[rgba(22,22,22,0.85)] to-transparent" />
            <p className="relative line-clamp-2 px-[9px] pb-2 pt-1.5 text-[18px] font-medium leading-tight tracking-[-0.324px] text-white">
              {title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
