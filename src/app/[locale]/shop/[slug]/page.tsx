import { notFound } from "next/navigation";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getProductBySlug, getRelatedProducts } from "@/lib/data";
import { formatPrice, localized } from "@/lib/format";
import PlaceholderArt from "@/components/PlaceholderArt";
import ProductActions from "@/components/ProductActions";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.category_id, product.id, 4);

  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale);
  const onSale = product.sale_price != null && product.sale_price < product.price;

  return (
    <div className="container-app py-14">
      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        <PlaceholderArt seed={product.slug} className="aspect-[3/4] w-full rounded-3xl" />

        <div>
          {product.categories && (
            <p className="mb-2 text-sm font-semibold text-rose-dark">
              {localized(product.categories, "name", locale)}
            </p>
          )}
          <h1 className="text-3xl font-extrabold text-ink">{name}</h1>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-bold text-ink">
              {formatPrice(onSale ? product.sale_price! : product.price, locale, dict.product.currency)}
            </span>
            {onSale && (
              <span className="text-lg text-ink-muted line-through">
                {formatPrice(product.price, locale, dict.product.currency)}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                product.stock > 0 ? "bg-cream text-ink" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {product.stock > 0 ? dict.product.inStock : dict.product.outOfStock}
            </span>
          </div>

          {description && (
            <p className="mt-6 leading-relaxed text-ink-muted">{description}</p>
          )}

          <div className="mt-8">
            <ProductActions product={product} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <SectionHeading title={dict.product.related} />
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
