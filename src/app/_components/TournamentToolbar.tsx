"use client";

import { useTranslations } from "next-intl";
import Tabs from "~/components/ui/Tabs";

export type TournamentSort = "popular" | "recent";
export type TournamentFilter = "all" | "event" | "ongoing";

export const SORT_TO_ORDER_BY: Record<TournamentSort, "POPULARITY" | "LATEST"> =
  {
    popular: "POPULARITY",
    recent: "LATEST",
  };

// Figma 27:888 — Recent 가 좌측, Popular 가 우측 (좌측이 기본 활성)
const SORTS: TournamentSort[] = ["recent", "popular"];

interface Props {
  chainId: number | undefined;
  filter: TournamentFilter;
  onFilterChange: (id: TournamentFilter) => void;
  sort: TournamentSort;
  onSortChange: (id: TournamentSort) => void;
}

export default function TournamentToolbar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: Props) {
  const t = useTranslations("toolbar");
  return (
    <>
      <div className="sticky top-0 z-40 bg-primary pt-2">
        <Tabs
          variant="border"
          tabs={[
            { id: "all", label: t("all") },
            { id: "event", label: t("event") },
            { id: "ongoing", label: t("ongoing") },
          ]}
          activeTab={filter}
          onTabChange={(id) => onFilterChange(id as TournamentFilter)}
        />
      </div>

      {/* Recent / Popular 인라인 토글 (Figma 27:888) */}
      <div className="flex items-center gap-4 px-4 py-3">
        {SORTS.map((s) => {
          const active = sort === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSortChange(s)}
              className={`rounded-[8px] px-[7px] py-1.5 text-[15px] font-medium leading-5 tracking-[-0.27px] transition-colors ${
                active
                  ? "bg-point-yellow/20 text-point-yellow"
                  : "text-brand-primary-500 hover:text-brand-primary-300"
              }`}
            >
              {t(s)}
            </button>
          );
        })}
      </div>
    </>
  );
}
