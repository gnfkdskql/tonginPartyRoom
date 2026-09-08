/** 섹션 상단 공통 헤더: 작은 라벨(eyebrow) + 큰 제목 + 보조 설명 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className = "",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      <span className="text-xs font-semibold tracking-[0.2em] text-muted">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}
