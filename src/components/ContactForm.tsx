"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { buildWhatsappUrl } from "@/lib/whatsapp";

const STORE_WHATSAPP = "218910000001";

export default function ContactForm() {
  const { locale, dict } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isAr = locale === "ar";
    const text = [
      isAr ? `الاسم: ${name}` : `Name: ${name}`,
      phone ? (isAr ? `الهاتف: ${phone}` : `Phone: ${phone}`) : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.open(buildWhatsappUrl(STORE_WHATSAPP, text), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">{dict.contact.name}</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">{dict.contact.phone}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">{dict.contact.message}</label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
      >
        <MessageCircle className="h-4 w-4" />
        {dict.contact.send}
      </button>
    </form>
  );
}
