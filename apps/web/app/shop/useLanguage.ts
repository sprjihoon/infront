"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lang } from "./translations";

const STORAGE_KEY = "shop_lang";

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "en" || saved === "ko") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === "ko" ? "en" : "ko");
  }, [lang, setLang]);

  return { lang, setLang, toggle };
}
