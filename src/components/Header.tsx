"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ShoppingBag, Globe } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const { locale, dict } = useI18n();
  const { totalCount } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const otherLocale = locale === "ar" ? "en" : "ar";
  const segments = pathname.split("/");
  segments[1] = otherLocale;
  const switchedHref = segments.join("/") || "/";

  const navItems = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/shop`, label: dict.nav.shop },
    { href: `/${locale}/branches`, label: dict.nav.branches },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="container-app flex items-center justify-between py-4">
        <Link href={`/${locale}`} className="text-xl font-extrabold tracking-tight text-ink">
          {dict.brand.name}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={switchedHref}
            className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-cream sm:flex"
          >
            <Globe className="h-4 w-4" />
            {dict.common.language}
          </Link>
          <Link
            href={`/${locale}/cart`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line transition-colors hover:bg-cream"
            aria-label={dict.nav.cart}
          >
            <ShoppingBag className="h-4 w-4" />
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[11px] font-bold text-white">
                {totalCount}
              </span>
            )}
          </Link>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-bg md:hidden">
          <nav className="container-app flex flex-col gap-1 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink-muted hover:bg-cream hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={switchedHref}
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium text-ink-muted hover:bg-cream hover:text-ink"
            >
              <Globe className="h-4 w-4" />
              {dict.common.language}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
