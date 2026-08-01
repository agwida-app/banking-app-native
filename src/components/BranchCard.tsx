import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { localized } from "@/lib/format";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import type { Branch } from "@/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { LocaleType } from "@/i18n/config";

export default function BranchCard({
  branch,
  locale,
  dict,
}: {
  branch: Branch;
  locale: LocaleType;
  dict: Dictionary;
}) {
  const name = localized(branch, "name", locale);
  const address = localized(branch, "address", locale);
  const hours = localized(branch, "hours", locale);
  const isAr = locale === "ar";
  const waMessage = isAr
    ? `مرحباً، لدي استفسار بخصوص فرع ${name}`
    : `Hello, I have a question about the ${name} branch`;

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-6">
      <h3 className="mb-4 text-lg font-bold text-ink">{name}</h3>
      <div className="flex flex-1 flex-col gap-3 text-sm text-ink-muted">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-dark" />
          <span>{address}</span>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-rose-dark" />
          <span>{hours}</span>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-rose-dark" />
          <span dir="ltr" className="text-right rtl:text-left">
            {branch.phone}
          </span>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={buildWhatsappUrl(branch.whatsapp, waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          {dict.branches.whatsapp}
        </a>
        {branch.map_url && (
          <a
            href={branch.map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-cream"
          >
            <MapPin className="h-4 w-4" />
            {dict.branches.directions}
          </a>
        )}
      </div>
    </div>
  );
}
