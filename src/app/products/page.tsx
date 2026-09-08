import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchPricingCatalog } from "@/lib/supabase-server";
import { formatWon } from "@/lib/pricing";
import type { PriceRule, Unit } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "이용 요금 안내 | 서초 시그니처 파티룸",
  description:
    "서초 시그니처 파티룸 공간별 이용 요금 — 2F 시그니처 스위트, 4F 시그니처 컨벤션, 6F 시그니처 루프탑의 요일·시간대별 대관료 안내.",
};

/** 요금표 열 구성 — 요일 묶음 */
const DAY_COLUMNS = [
  { label: "월~목", days: [1, 2, 3, 4] },
  { label: "금", days: [5] },
  { label: "토", days: [6] },
  { label: "일", days: [7] },
];

/** 해당 요일 묶음에 적용되는 가격 (없으면 미운영) */
function priceFor(rules: PriceRule[], days: number[]): number | null {
  const rule = rules.find((r) => days.every((d) => r.weekdays.includes(d)));
  if (rule) return rule.price;
  // 월~목처럼 묶인 열에 부분만 걸리는 경우 대비
  const partial = rules.find((r) => days.some((d) => r.weekdays.includes(d)));
  return partial ? partial.price : null;
}

function UnitTable({
  unit,
  rules,
}: {
  unit: Unit;
  rules: PriceRule[];
}) {
  const unitRules = rules.filter((r) => r.unit_id === unit.id);
  if (unitRules.length === 0) return null;

  // 시간당 상품은 슬롯이 없으므로 한 줄, 패키지는 슬롯별로 한 줄
  const slotCodes = Array.from(
    new Set(unitRules.map((r) => r.slot_code ?? "__hourly__")),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-line bg-surface-soft">
            <th className="px-4 py-3 text-left font-medium text-ink">구분</th>
            {DAY_COLUMNS.map((c) => (
              <th
                key={c.label}
                className="px-4 py-3 text-center font-medium text-ink"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotCodes.map((code) => {
            const rowRules = unitRules.filter(
              (r) => (r.slot_code ?? "__hourly__") === code,
            );
            const first = rowRules[0];
            const isHourly = code === "__hourly__";
            const timeLabel =
              first.starts_at && first.ends_at
                ? `${first.starts_at.slice(0, 5)}–${first.ends_at.slice(0, 5)}`
                : first.duration_h
                  ? `${first.duration_h}시간`
                  : null;

            return (
              <tr key={code} className="border-b border-line">
                <td className="px-4 py-3.5">
                  <span className="font-medium text-ink">
                    {isHourly ? "시간당" : first.slot_name}
                  </span>
                  {timeLabel && !isHourly && (
                    <span className="ml-2 text-xs text-muted">{timeLabel}</span>
                  )}
                </td>
                {DAY_COLUMNS.map((c) => {
                  const price = priceFor(rowRules, c.days);
                  return (
                    <td
                      key={c.label}
                      className="px-4 py-3.5 text-center text-ink"
                    >
                      {price === null ? (
                        <span className="text-muted">–</span>
                      ) : (
                        <>
                          {formatWon(price)}
                          {isHourly && (
                            <span className="text-xs text-muted"> /시간</span>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ProductsPage() {
  const { spaces, units, priceRules, extraPersonRules } =
    await fetchPricingCatalog();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-(--container-page) px-5 py-14 lg:px-8 md:py-20">
          <header className="mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              이용 안내
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              공간별 이용 요금
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
              모든 금액은 부가세를 포함한 대관료입니다. 요일과 이용 시간대에
              따라 요금이 다르며, 예약 시 인원과 시간을 선택하면 최종 결제
              금액이 자동으로 계산됩니다.
            </p>
          </header>

          <div className="space-y-16">
            {spaces.map((space) => {
              const spaceUnits = units.filter((u) => u.space_id === space.id);
              const extra = extraPersonRules.filter((e) =>
                spaceUnits.some((u) => u.id === e.unit_id),
              );

              return (
                <section key={space.id}>
                  <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-ink">
                      {space.code.toUpperCase()} {space.name}
                    </h2>
                    <p className="text-sm text-muted">
                      기준 {space.base_capacity}명 · 최대 {space.max_capacity}명
                    </p>
                  </div>

                  <div className="space-y-8">
                    {spaceUnits.map((unit) => (
                      <div key={unit.id}>
                        {spaceUnits.length > 1 && (
                          <h3 className="mb-3 text-base font-bold text-ink">
                            {unit.name}
                            {unit.min_hours > 1 && (
                              <span className="ml-2 text-xs font-normal text-muted">
                                최소 {unit.min_hours}시간부터
                              </span>
                            )}
                          </h3>
                        )}
                        <UnitTable unit={unit} rules={priceRules} />
                      </div>
                    ))}
                  </div>

                  {/* 추가 요금 안내 */}
                  <ul className="mt-5 space-y-1.5 text-sm text-muted">
                    {extra.length > 0 && (
                      <li>
                        · 기준 인원 초과 시 추가 요금 (1인당){" "}
                        {Array.from(
                          new Set(
                            extra.map((e) => {
                              const cond =
                                e.max_hours !== null
                                  ? `${e.max_hours}시간 미만 `
                                  : e.min_hours !== null
                                    ? `${e.min_hours}시간 이상 `
                                    : "";
                              return `${cond}${formatWon(e.fee)}`;
                            }),
                          ),
                        ).join(" / ")}
                      </li>
                    )}
                    <li>
                      · 청소 보증금 {formatWon(space.deposit_amount)} — 이용 후
                      시설에 문제가 없으면 전액 환불됩니다.
                    </li>
                    <li>
                      · 성수기(12~1월) 및 공휴일·공휴일 전날은 요금이 다르게
                      적용될 수 있습니다.
                    </li>
                  </ul>
                </section>
              );
            })}
          </div>

          {/* 결제 및 이용 안내 */}
          <section className="mt-20 border-t border-line pt-12">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              결제 및 이용 안내
            </h2>
            <dl className="mt-6 grid gap-x-10 gap-y-6 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium text-ink">결제 방법</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">
                  예약 시 전액 선결제이며, 신용·체크카드 및 간편결제를 이용할 수
                  있습니다. 대관료와 청소 보증금이 함께 결제됩니다.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">청소 보증금</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">
                  이용 종료 후 시설 확인이 끝나면 전액 환불됩니다. 정리 미흡,
                  시설 파손, 실내 흡연 등이 확인되면 일부 또는 전액이 차감될 수
                  있습니다.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">이용 시간</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">
                  선택하신 시간대에는 정리·퇴실 시간이 포함됩니다. 시간 연장은
                  현장 상황에 따라 가능하며 별도 요금이 부과됩니다.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">취소 및 환불</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">
                  이용일 8일 전까지 100% 환불되며, 7일 전부터 당일까지는 환불이
                  불가합니다. 자세한 내용은{" "}
                  <a href="/refund/" className="underline hover:text-ink">
                    취소·환불 규정
                  </a>
                  을 확인해주세요.
                </dd>
              </div>
            </dl>

            <a
              href="/booking/"
              className="mt-10 inline-flex h-12 items-center justify-center bg-ink px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              예약하기
            </a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
