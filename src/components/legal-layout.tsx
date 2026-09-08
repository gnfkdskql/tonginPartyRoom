import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** 약관·정책 문서 공통 레이아웃 */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8 md:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted">시행일 {updatedAt}</p>
          <div className="mt-12 space-y-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Article({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/80">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 text-muted">{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
