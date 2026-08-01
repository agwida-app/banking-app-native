import Link from "next/link";
import PlaceholderArt from "./PlaceholderArt";
import { formatPrice, localized } from "@/lib/format";
import type { Product } from "@/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { LocaleType } from "@/i18n/config";

export default function ProductCard({
  product,
  locale,
  dict,
}: {
  product: Product;
  locale: LocaleType;
  dict: Dictionary;
}) {
  const name = localized(product, "name", locale);
  const onSale = product.sale_price != null && product.sale_price < product.price;

  return (
    <Link
      href={`/${locale}/shop/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg hover:shadow-ink/5"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <PlaceholderArt
          seed={product.slug}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 flex gap-2 rtl:right-3 ltr:left-3">
          {product.is_new && (
            <span className="rounded-full bg-ink/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {dict.product.new}
            </span>
          )}
          {onSale && (
            <span className="rounded-full bg-rose px-3 py-1 text-xs font-semibold text-white">
              {dict.product.sale}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {product.categories && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {localized(product.categories, "name", locale)}
          </p>
        )}
        <h3 className="mb-2 line-clamp-1 font-semibold text-ink">{name}</h3>
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink">
            {formatPrice(onSale ? product.sale_price! : product.price, locale, dict.product.currency)}
          </span>
          {onSale && (
            <span className="text-sm text-ink-muted line-through">
              {formatPrice(product.price, locale, dict.product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
