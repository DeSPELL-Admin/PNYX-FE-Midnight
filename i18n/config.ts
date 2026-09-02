export const COOKIE_NAME = "NEXT_LOCALE";

export const SUPPORTED_LOCALES = ["en", "jp"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export const HTML_LANG: Record<Locale, string> = {
  en: "en",
  jp: "ja",
};
