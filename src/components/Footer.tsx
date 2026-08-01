"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { InstagramIcon, FacebookIcon } from "./icons";

export default function Footer() {
  const { locale, dict } = useI18n();

  const links = [
    { href: `/${locale}/shop`, label: dict.nav.shop },
    { href: `/${locale}/branches`, label: dict.nav.branches },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-cream/50">
      <div className="container-app grid gap-10 py-14 md:grid-cols-3">
        <div>
          <p className="text-xl font-extrabold text-ink">{dict.brand.name}</p>
          <p className="mt-1 text-sm text-rose-dark">{dict.brand.tagline}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
            {dict.footer.about}
          </p>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold text-ink">{dict.footer.links}</p>
          <ul className="flex flex-col gap-2.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold text-ink">{dict.footer.followUs}</p>
          <div className="flex gap-3">
            <a
              href="#"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-white hover:text-rose-dark"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-white hover:text-rose-dark"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-white hover:text-rose-dark"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} {dict.brand.name} — {dict.footer.rights}
      </div>
    </footer>
  );
}
