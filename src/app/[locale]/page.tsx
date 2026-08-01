import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getBranches, getCategories, getFeaturedProducts, getNewProducts } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";
import CategoryCard from "@/components/CategoryCard";
import ProductCard from "@/components/ProductCard";
import BranchCard from "@/components/BranchCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);
  const isAr = locale === "ar";
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [categories, featured, newArrivals, branches] = await Promise.all([
    getCategories(),
    getFeaturedProducts(8),
    getNewProducts(4),
    getBranches(),
  ]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-cream to-bg">
        <div className="container-app grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-3 text-sm font-semibold tracking-wide text-rose-dark">
              {dict.hero.eyebrow}
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
              {dict.hero.title}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
              {dict.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/shop`}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                {dict.hero.cta}
                <ArrowIcon className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/branches`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
              >
                {dict.hero.ctaSecondary}
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="mt-8 aspect-[3/4] overflow-hidden rounded-3xl bg-gradient-to-br from-[#f0e2e6] via-[#e3c7cd] to-[#c79aa5]" />
              <div className="aspect-[3/4] overflow-hidden rounded-3xl bg-gradient-to-br from-[#f5ede0] via-[#e9d4b2] to-[#cfa96a]" />
            </div>
          </div>
        </div>
      </section>

      <section className="container-app py-16">
        <SectionHeading title={dict.sections.categories} align="center" />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} locale={locale} />
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="container-app py-16">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading title={dict.sections.featured} />
            <Link
              href={`/${locale}/shop`}
              className="hidden shrink-0 text-sm font-semibold text-rose-dark hover:underline sm:block"
            >
              {dict.common.viewAll}
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} dict={dict} />
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="bg-cream/40 py-16">
          <div className="container-app">
            <SectionHeading title={dict.sections.newArrivals} />
            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} dict={dict} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-app py-16">
        <div className="grid items-center gap-10 rounded-3xl border border-line bg-surface p-8 md:grid-cols-2 md:p-14">
          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-rose-dark">
              {dict.sections.story}
            </p>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">{dict.story.title}</h2>
            <p className="mt-4 leading-relaxed text-ink-muted">{dict.story.body}</p>
            <Link
              href={`/${locale}/about`}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-rose-dark hover:underline"
            >
              {dict.story.cta}
              <ArrowIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#eee3f0] via-[#dcc7e0] to-[#b99ac0]" />
        </div>
      </section>

      <section className="container-app pb-20">
        <SectionHeading title={dict.sections.branches} subtitle={dict.sections.branchesSubtitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} locale={locale} dict={dict} />
          ))}
        </div>
      </section>
    </div>
  );
}
