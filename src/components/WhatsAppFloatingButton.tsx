"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { buildWhatsappUrl } from "@/lib/whatsapp";

const STORE_WHATSAPP = "218910000001";

export default function WhatsAppFloatingButton() {
  const { locale } = useI18n();
  const message =
    locale === "ar" ? "مرحباً، لدي استفسار عن المتجر" : "Hello, I have a question about the store";

  return (
    <a
      href={buildWhatsappUrl(STORE_WHATSAPP, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/15 transition-transform hover:scale-105 rtl:left-5 ltr:right-5"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
