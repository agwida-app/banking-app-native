"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { localized } from "@/lib/format";
import type { Category } from "@/types";

export default function ShopFilters({ categories }: { categories: Category[] }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "newest";

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: q || null });
  }

  const hasFilters = activeCategory || searchParams.get("q");

  return (
    <div className="mb-10 space-y-5">
      <form onSubmit={handleSearchSubmit} className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted rtl:right-4 ltr:left-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={dict.shop.search}
          className="w-full rounded-full border border-line bg-surface py-3 text-sm outline-none transition-colors focus:border-rose rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4"
        />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateParams({ category: null })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !activeCategory ? "bg-ink text-white" : "border border-line text-ink-muted hover:bg-cream"
            }`}
          >
            {dict.shop.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateParams({ category: cat.slug })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.slug
                  ? "bg-ink text-white"
                  : "border border-line text-ink-muted hover:bg-cream"
              }`}
            >
              {localized(cat, "name", locale)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={() => {
                setQ("");
                router.push(pathname);
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              {dict.shop.clear}
            </button>
          )}
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted rtl:right-3 ltr:left-3" />
            <select
              value={activeSort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="cursor-pointer appearance-none rounded-full border border-line bg-surface py-2.5 text-sm outline-none focus:border-rose rtl:pr-9 rtl:pl-4 ltr:pl-9 ltr:pr-4"
            >
              <option value="newest">{dict.shop.sortNewest}</option>
              <option value="price_asc">{dict.shop.sortPriceAsc}</option>
              <option value="price_desc">{dict.shop.sortPriceDesc}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
