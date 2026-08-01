import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories, getProducts } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import ShopFilters from "@/components/ShopFilters";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string; sort?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);
  const sp = await searchParams;

  const [categories, { products, total, page, pageCount }] = await Promise.all([
    getCategories(),
    getProducts({
      category: sp.category,
      q: sp.q,
      sort: sp.sort as "newest" | "price_asc" | "price_desc" | undefined,
      page: sp.page ? Number(sp.page) : 1,
    }),
  ]);

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    if (sp.category) params.set("category", sp.category);
    if (sp.q) params.set("q", sp.q);
    if (sp.sort) params.set("sort", sp.sort);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/${locale}/shop${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="container-app py-14">
      <SectionHeading
        title={dict.shop.title}
        subtitle={`${total} ${dict.shop.resultsCount}`}
      />
      <div className="mt-8">
        <Suspense fallback={null}>
          <ShopFilters categories={categories} />
        </Suspense>

        {products.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-10 text-center text-ink-muted">
            {dict.shop.noResults}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} dict={dict} />
            ))}
          </div>
        )}

        <Pagination page={page} pageCount={pageCount} buildHref={buildHref} locale={locale} />
      </div>
    </div>
  );
}
