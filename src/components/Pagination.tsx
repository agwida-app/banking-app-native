import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LocaleType } from "@/i18n/config";

export default function Pagination({
  page,
  pageCount,
  buildHref,
  locale,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
  locale: LocaleType;
}) {
  if (pageCount <= 1) return null;
  const isRtl = locale === "ar";
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1
  );

  return (
    <nav className="mt-10 flex items-center justify-center gap-2">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-line ${
          page === 1 ? "pointer-events-none opacity-40" : "hover:bg-cream"
        }`}
      >
        <PrevIcon className="h-4 w-4" />
      </Link>
      {pages.map((p, idx) => (
        <span key={p} className="flex items-center gap-2">
          {idx > 0 && pages[idx - 1] !== p - 1 && <span className="text-ink-muted">…</span>}
          <Link
            href={buildHref(p)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
              p === page ? "bg-ink text-white" : "border border-line hover:bg-cream"
            }`}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={buildHref(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-line ${
          page === pageCount ? "pointer-events-none opacity-40" : "hover:bg-cream"
        }`}
      >
        <NextIcon className="h-4 w-4" />
      </Link>
    </nav>
  );
}
