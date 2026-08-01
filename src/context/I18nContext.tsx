"use client";

import { createContext, useContext } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { LocaleType } from "@/i18n/config";

type I18nValue = {
  locale: LocaleType;
  dict: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: LocaleType;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
