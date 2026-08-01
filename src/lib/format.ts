import type { LocaleType } from "@/i18n/config";

export function formatPrice(price: number, locale: LocaleType, currencyLabel: string) {
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-LY" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
  return `${number} ${currencyLabel}`;
}

export function localized<T extends Record<string, unknown>>(
  obj: T,
  field: string,
  locale: LocaleType
): string {
  const key = `${field}_${locale}` as keyof T;
  return (obj[key] as string) ?? "";
}
