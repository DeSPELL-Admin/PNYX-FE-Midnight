/**
 * 카테고리 / 상태 칩 — Figma node 42:7113
 *
 * • variant="category"  : 카테고리명별 네온 컬러 아웃라인 pill
 *   (Crypto·노랑 / Anime·핑크 / Game·그린 / Nonsense·시안, 그 외 라벨은 해시로 결정적 매핑)
 * • variant="completed" : 솔리드 그린(#17b579) 상태 뱃지
 *
 * 공통 스펙: bg rgba(25,25,25,.5) · 1px border <accent>/50% · text <accent>
 *           rounded-4px · px-6 py-2 · Pretendard Medium 11px
 *           (completed 는 솔리드 배경 / 12px / white)
 *
 * NOTE: category 색은 인라인 style 로 적용해 런타임 지정(color prop / CATEGORY_COLORS 맵)을
 *       지원한다. (Tailwind arbitrary value 는 런타임 변수로 만들 수 없기 때문)
 */

// 카테고리명(소문자) → 액센트 컬러(hex). 여기에 항목을 추가/수정하면 해당 카테고리 색이 고정된다.
export const CATEGORY_COLORS: Record<string, string> = {
  crypto: "#ffed2b",
  animation: "#ff6ef3",
  game: "#2bff95",
  nonsense: "#1afbff",
};

// 매핑에 없는 카테고리는 라벨 해시로 팔레트에서 결정적으로 선택 → 같은 이름엔 항상 같은 색
const PALETTE = Object.values(CATEGORY_COLORS);

function colorForCategory(label: string): string {
  const key = label.trim().toLowerCase();
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++)
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** #rrggbb → rgba(r,g,b,alpha). 파싱 실패 시 입력 색을 그대로 반환. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

interface CategoryChipProps {
  label: string;
  /** 'category' = 컬러 아웃라인 칩 / 'completed' = 솔리드 그린 상태 뱃지 */
  variant?: "category" | "completed";
  /** category 액센트 컬러 직접 지정(hex). 미지정 시 라벨로 자동 결정 */
  color?: string;
  className?: string;
}

export default function CategoryChip({
  label,
  variant = "category",
  color,
  className = "",
}: CategoryChipProps) {
  const base =
    "inline-flex items-center justify-center rounded-[4px] px-1.5 py-0.5 font-medium leading-normal whitespace-nowrap";

  if (variant === "completed") {
    return (
      <span
        className={`${base} bg-[#17b579] text-[12px] text-white ${className}`}
      >
        {label}
      </span>
    );
  }

  const accent = color?.trim() || colorForCategory(label);
  return (
    <span
      className={`${base} border border-solid text-[11px] ${className}`}
      style={{
        backgroundColor: "rgba(25,25,25,0.5)",
        borderColor: withAlpha(accent, 0.5),
        color: accent,
      }}
    >
      {label}
    </span>
  );
}
