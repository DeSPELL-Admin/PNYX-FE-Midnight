"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setUserLocale } from "~/../i18n/locale";
import {
  SUPPORTED_LOCALES,
  type Locale,
  isLocale,
} from "~/../i18n/config";

export default function LanguageToggle() {
  const t = useTranslations("common");
  const active = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onSelect = (next: Locale) => {
    if (next === active) return;
    startTransition(async () => {
      await setUserLocale(next);
      // RSC만 다시 그리도록 — 풀 리로드 X, 클라이언트 상태(지갑 연결/스크롤) 유지.
      router.refresh();
    });
  };

  return (
    <div
      className="flex items-center gap-2"
      role="radiogroup"
      aria-label={t("language")}
    >
      {SUPPORTED_LOCALES.map((loc) => {
        if (!isLocale(loc)) return null;
        const isActive = loc === active;
        return (
          <button
            key={loc}
            role="radio"
            aria-checked={isActive}
            disabled={isPending}
            onClick={() => onSelect(loc)}
            className={`min-w-[64px] rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-white text-black"
                : "bg-transparent text-white border border-white/30 hover:border-white"
            }`}
          >
            {loc === "en" ? t("english") : t("japanese")}
          </button>
        );
      })}
    </div>
  );
}
