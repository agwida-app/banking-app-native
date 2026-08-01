import Link from "next/link";
import PlaceholderArt from "./PlaceholderArt";
import { localized } from "@/lib/format";
import type { Category } from "@/types";
import type { LocaleType } from "@/i18n/config";

export default function CategoryCard({
  category,
  locale,
}: {
  category: Category;
  locale: LocaleType;
}) {
  const name = localized(category, "name", locale);
  return (
    <Link
      href={`/${locale}/shop?category=${category.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg hover:shadow-ink/5"
    >
      <PlaceholderArt
        seed={category.slug}
        label={name}
        className="aspect-[4/3] w-full text-lg transition-transform duration-500 group-hover:scale-105"
      />
    </Link>
  );
}
