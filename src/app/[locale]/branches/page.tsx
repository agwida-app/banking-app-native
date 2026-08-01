import { notFound } from "next/navigation";
import { isLocale, type LocaleType } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getBranches } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";
import BranchCard from "@/components/BranchCard";

export const dynamic = "force-dynamic";

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: LocaleType = rawLocale;
  const dict = getDictionary(locale);
  const branches = await getBranches();

  return (
    <div className="container-app py-14">
      <SectionHeading
        title={dict.branches.title}
        subtitle={dict.branches.subtitle}
        align="center"
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <BranchCard key={branch.id} branch={branch} locale={locale} dict={dict} />
        ))}
      </div>
    </div>
  );
}
