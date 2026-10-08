import { SectionHeading } from "./section-heading";
import { CheckIcon } from "./icons";
import {
  PRICE_CARDS,
  PRICE_FOOTNOTE,
  PRICE_TABLES,
  type Cell,
  type PriceTable,
} from "@/lib/pricing-tables";

// 요금 숫자·문구는 src/lib/pricing-tables.ts 에서 관리한다.

export function Pricing() {
  return (
    <section id="pricing" className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-(--container-page) px-5 lg:px-8">
        <SectionHeading eyebrow="요금" title="명확한 가격" />

        {/* 요금 카드 3개 */}
        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
          {PRICE_CARDS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col border border-line bg-surface p-8"
            >
              <h3 className="text-center text-lg font-bold text-ink">
                {plan.name}
              </h3>
              <p className="mt-4 text-center text-4xl font-bold tracking-tight text-ink md:text-3xl lg:text-4xl xl:text-5xl">
                {plan.price}
              </p>
              <div className="mt-3 min-h-12 text-center text-sm leading-relaxed text-muted">
                {plan.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>

              <ul className="mt-8 flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-ink/90"
                  >
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/booking/"
                className="mt-8 flex h-12 items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                예약하기
              </a>
            </div>
          ))}
        </div>

        {/* 공간별 상세 요금표 */}
        <div className="mt-16 space-y-12 md:mt-20">
          {PRICE_TABLES.map((table) => (
            <RateTable key={table.name} table={table} />
          ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted md:text-sm">
          {PRICE_FOOTNOTE}
        </p>
      </div>
    </section>
  );
}

function cellText(c: Cell): string {
  return typeof c === "string" ? c : c.text;
}
function cellSpan(c: Cell): number {
  return typeof c === "string" ? 1 : (c.span ?? 1);
}

function RateTable({ table }: { table: PriceTable }) {
  // 상단 요약은 항상 7칸(공간명 + 라벨/값 3쌍). 본문이 그보다 좁으면 행 머리칸을 넓혀 맞춘다.
  const bodyCols = table.columns.reduce((s, c) => s + cellSpan(c), 0);
  const totalCols = Math.max(7, bodyCols);
  const labelSpan = totalCols - bodyCols + 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-center text-sm">
        <tbody>
          {/* 상단 요약: 공간명(세로 병합) + 보증금/인원/옵션/면적 */}
          {table.meta.map((row, i) => (
            <tr key={i} className="border border-line">
              {i === 0 && (
                <th
                  rowSpan={table.meta.length}
                  scope="rowgroup"
                  className="w-[18%] whitespace-nowrap border border-line bg-surface-soft px-3 py-3 text-base font-bold text-ink"
                >
                  {table.name}
                </th>
              )}
              {row.map((m) => (
                <MetaPair key={m.label} label={m.label} value={m.value} wide={row.length === 2 && m.label === "옵션"} />
              ))}
            </tr>
          ))}

          {/* 머리글 */}
          <tr className="border border-line bg-surface-soft">
            {table.columns.map((c, i) => (
              <th
                key={i}
                colSpan={i === 0 ? labelSpan : cellSpan(c)}
                scope="col"
                className="whitespace-nowrap border border-line px-3 py-3 font-bold text-ink"
              >
                {cellText(c)}
              </th>
            ))}
          </tr>

          {/* 본문 */}
          {table.rows.map((r) => (
            <tr key={r.label} className="border border-line">
              <th
                scope="row"
                colSpan={labelSpan}
                className="whitespace-nowrap border border-line bg-surface-soft px-3 py-3 font-bold text-ink"
              >
                {r.label}
              </th>
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  colSpan={cellSpan(c)}
                  className="border border-line px-3 py-3 tabular-nums text-ink"
                >
                  {cellText(c)}
                </td>
              ))}
            </tr>
          ))}

          {/* 주석 */}
          {table.notes?.map((n) => (
            <tr key={n} className="border border-line">
              <td
                colSpan={totalCols}
                className="border border-line px-3 py-3 text-xs text-muted md:text-sm"
              >
                {n}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 라벨 칸 + 값 칸 한 쌍. 옵션처럼 긴 값은 여러 칸을 차지한다. */
function MetaPair({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <>
      <th
        scope="row"
        className="whitespace-nowrap border border-line bg-surface-soft px-3 py-3 font-bold text-ink"
      >
        {label}
      </th>
      <td
        colSpan={wide ? 3 : 1}
        className="border border-line px-3 py-3 text-ink"
      >
        {value}
      </td>
    </>
  );
}
