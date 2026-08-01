"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, MessageCircle, ShoppingBag } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase/client";
import { formatPrice, localized } from "@/lib/format";
import { buildWhatsappUrl, buildOrderMessage } from "@/lib/whatsapp";
import PlaceholderArt from "@/components/PlaceholderArt";
import type { Branch } from "@/types";

export default function CartPage() {
  const { locale, dict } = useI18n();
  const { items, removeItem, updateQuantity, totalPrice } = useCart();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");

  useEffect(() => {
    supabase
      .from("branches")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setBranches(data);
          if (data.length > 0) setBranchId(data[0].id);
        }
      });
  }, []);

  const selectedBranch = branches.find((b) => b.id === branchId);

  function handleCheckout() {
    const message = buildOrderMessage(
      items,
      locale,
      dict.product.currency,
      selectedBranch ? localized(selectedBranch, "name", locale) : undefined
    );
    const phone = selectedBranch?.whatsapp ?? "218910000001";
    window.open(buildWhatsappUrl(phone, message), "_blank", "noopener,noreferrer");
  }

  if (items.length === 0) {
    return (
      <div className="container-app flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cream">
          <ShoppingBag className="h-6 w-6 text-rose-dark" />
        </div>
        <h1 className="text-xl font-bold text-ink">{dict.cart.empty}</h1>
        <Link
          href={`/${locale}/shop`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {dict.cart.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-14">
      <h1 className="mb-10 text-2xl font-extrabold text-ink sm:text-3xl">{dict.cart.title}</h1>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item, index) => (
            <div
              key={`${item.productId}-${item.size}-${item.color}-${index}`}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <PlaceholderArt seed={item.slug} className="h-24 w-20 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    href={`/${locale}/shop/${item.slug}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {locale === "ar" ? item.name_ar : item.name_en}
                  </Link>
                  <p className="mt-1 text-xs text-ink-muted">
                    {[item.size, item.color].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full border border-line">
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-ink">
                    {formatPrice(item.price * item.quantity, locale, dict.product.currency)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeItem(index)}
                aria-label={dict.cart.remove}
                className="self-start text-ink-muted hover:text-rose-dark"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="font-semibold text-ink">{dict.cart.subtotal}</span>
            <span className="text-lg font-bold text-ink">
              {formatPrice(totalPrice, locale, dict.product.currency)}
            </span>
          </div>

          {branches.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-ink">{dict.cart.chooseBranch}</p>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-rose"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {localized(b, "name", locale)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleCheckout}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            {dict.cart.checkout}
          </button>
        </div>
      </div>
    </div>
  );
}
