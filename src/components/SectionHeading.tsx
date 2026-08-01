export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "start",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold tracking-wide text-rose-dark">{eyebrow}</p>
      )}
      <h2 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      {subtitle && (
        <p
          className={`mt-3 max-w-2xl text-ink-muted ${align === "center" ? "mx-auto" : ""}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
