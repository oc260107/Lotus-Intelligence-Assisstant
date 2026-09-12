"use client";

import { useCallback, useEffect, useState } from "react";

export type Language = "en" | "vi";

const STORAGE_KEY = "lia-language";
const EVENT_NAME = "lia-language-change";

function initialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "vi") return stored;
  return window.navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const apply = (next: Language) => {
      setLanguageState(next);
      document.documentElement.lang = next;
    };

    apply(initialLanguage());

    const onLanguage = (event: Event) => {
      const next = (event as CustomEvent<Language>).detail;
      if (next === "en" || next === "vi") apply(next);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === "en" || event.newValue === "vi")) {
        apply(event.newValue);
      }
    };

    window.addEventListener(EVENT_NAME, onLanguage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onLanguage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent<Language>(EVENT_NAME, { detail: next }));
  }, []);

  const tr = useCallback(
    (en: string, vi: string) => (language === "vi" ? vi : en),
    [language],
  );

  return { language, setLanguage, tr };
}
