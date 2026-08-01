export const locales = ["ar", "en"] as const;
export type LocaleType = (typeof locales)[number];
export const defaultLocale: LocaleType = "ar";

export function isLocale(value: string): value is LocaleType {
  return (locales as readonly string[]).includes(value);
}
