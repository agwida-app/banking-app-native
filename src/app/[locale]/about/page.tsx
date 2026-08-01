import { notFound } from "next/navigation";
import { Gem, HandCoins, MapPinned } from "lucide-react";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);

  const values = [
    { icon: Gem, title: dict.about.value1Title, body: dict.about.value1Body },
    { icon: HandCoins, title: dict.about.value2Title, body: dict.about.value2Body },
    { icon: MapPinned, title: dict.about.value3Title, body: dict.about.value3Body },
  ];

  return (
    <div>
      <section className="border-b border-line bg-gradient-to-b from-cream to-bg py-16">
        <div className="container-app text-center">
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{dict.about.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">{dict.about.subtitle}</p>
        </div>
      </section>

      <section className="container-app py-16">
        <div className="mx-auto grid max-w-3xl gap-6 text-lg leading-relaxed text-ink-muted">
          <p>{dict.about.p1}</p>
          <p>{dict.about.p2}</p>
        </div>
      </section>

      <section className="container-app pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-ink">{dict.about.values}</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-2xl border border-line bg-surface p-7 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream text-rose-dark">
                <value.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-ink">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{value.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
