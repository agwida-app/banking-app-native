import { notFound } from "next/navigation";
import { Phone, MessageCircle } from "lucide-react";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import ContactForm from "@/components/ContactForm";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { InstagramIcon, FacebookIcon } from "@/components/icons";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);

  return (
    <div className="container-app py-14">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{dict.contact.title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">{dict.contact.subtitle}</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-10 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-7">
          <ContactForm />
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-ink">{dict.contact.or}</p>
          <div className="flex flex-col gap-3">
            <a
              href={buildWhatsappUrl("218910000001", "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              <MessageCircle className="h-4 w-4 text-rose-dark" />
              WhatsApp
            </a>
            <a
              href="tel:+218910000001"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              <Phone className="h-4 w-4 text-rose-dark" />
              <span dir="ltr">+218 91-000-0001</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              <InstagramIcon className="h-4 w-4 text-rose-dark" />
              Instagram
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              <FacebookIcon className="h-4 w-4 text-rose-dark" />
              Facebook
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
