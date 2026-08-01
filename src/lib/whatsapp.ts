import type { CartItem } from "@/types";
import type { LocaleType } from "@/i18n/config";

export function buildWhatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildOrderMessage(
  items: CartItem[],
  locale: LocaleType,
  currencyLabel: string,
  branchName?: string
) {
  const isAr = locale === "ar";
  const lines: string[] = [];
  lines.push(isAr ? "مرحباً، أرغب بطلب التالي:" : "Hello, I'd like to order the following:");
  lines.push("");
  for (const item of items) {
    const name = isAr ? item.name_ar : item.name_en;
    const details = [
      item.size ? `${isAr ? "المقاس" : "Size"}: ${item.size}` : null,
      item.color ? `${isAr ? "اللون" : "Color"}: ${item.color}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    lines.push(
      `- ${name} x${item.quantity} — ${item.price * item.quantity} ${currencyLabel}${
        details ? ` (${details})` : ""
      }`
    );
  }
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  lines.push("");
  lines.push(`${isAr ? "الإجمالي" : "Total"}: ${total} ${currencyLabel}`);
  if (branchName) {
    lines.push(`${isAr ? "الفرع" : "Branch"}: ${branchName}`);
  }
  return lines.join("\n");
}

export function buildSingleProductMessage(
  name: string,
  locale: LocaleType,
  size?: string | null,
  color?: string | null
) {
  const isAr = locale === "ar";
  const details = [
    size ? `${isAr ? "المقاس" : "Size"}: ${size}` : null,
    color ? `${isAr ? "اللون" : "Color"}: ${color}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  return isAr
    ? `مرحباً، أرغب بالاستفسار عن هذا المنتج: ${name}${details ? ` (${details})` : ""}`
    : `Hello, I'd like to ask about this product: ${name}${details ? ` (${details})` : ""}`;
}
