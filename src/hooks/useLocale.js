import { useCallback, useState } from "react";
import locales from "../i18n/locales";

const LOCALE_STORAGE_KEY = "skill-deck-locale";

function readStoredLocale() {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = window.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // Storage unavailable
  }
  return "zh";
}

function persistLocale(locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Best-effort
  }
}

export function useLocale() {
  const [locale, setLocaleState] = useState(readStoredLocale);

  const t = useCallback(
    (key, fallback) => {
      const dictionary = locales[locale] ?? locales.zh;
      const value = dictionary[key];
      if (value !== undefined) return value;
      if (fallback !== undefined) return fallback;
      // Fall through to the other language
      const otherLocale = locale === "zh" ? "en" : "zh";
      const otherValue = locales[otherLocale]?.[key];
      if (otherValue !== undefined) return otherValue;
      return key;
    },
    [locale],
  );

  const setLocale = useCallback((nextLocale) => {
    if (nextLocale !== "zh" && nextLocale !== "en") return;
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
  }, [locale, setLocale]);

  return { locale, setLocale, toggleLocale, t };
}
