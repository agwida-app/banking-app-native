"use client";

import { useState } from "react";
import { Minus, Plus, MessageCircle, ShoppingBag, Check } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { useCart } from "@/context/CartContext";
import { buildWhatsappUrl, buildSingleProductMessage } from "@/lib/whatsapp";
import { localized } from "@/lib/format";
import type { Product } from "@/types";

const STORE_WHATSAPP = "218910000001";

export default function ProductActions({ product }: { product: Product }) {
  const { locale, dict } = useI18n();
  const { addItem } = useCart();
  const [size, setSize] = useState<string | null>(product.sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const name = localized(product, "name", locale);
  const inStock = product.stock > 0;
  const price = product.sale_price ?? product.price;

  function handleAddToCart() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name_ar: product.name_ar,
      name_en: product.name_en,
      price,
      image: product.images[0] ?? null,
      size,
      color,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  const waMessage = buildSingleProductMessage(name, locale, size, color);

  return (
    <div className="space-y-6">
      {product.sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{dict.product.size}</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`min-w-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  size === s ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:bg-cream"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {product.colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{dict.product.color}</p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  color === c ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:bg-cream"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{dict.cart.quantity}</p>
        <div className="inline-flex items-center rounded-full border border-line">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-ink-muted hover:text-ink"
            aria-label="minus"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-10 w-10 items-center justify-center text-ink-muted hover:text-ink"
            aria-label="plus"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleAddToCart}
          disabled={!inStock}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          {dict.product.addToCart}
        </button>
        <a
          href={buildWhatsappUrl(STORE_WHATSAPP, waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          {dict.product.orderWhatsapp}
        </a>
      </div>
    </div>
  );
}
