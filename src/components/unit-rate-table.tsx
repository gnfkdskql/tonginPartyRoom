import { formatWon } from "@/lib/pricing";
import type { PriceRule, Unit } from "@/lib/supabase";

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

/**
 * 판매 단위(unit) 하나의 요일별 요금표.
 * 상품 페이지와 층별 상세 페이지가 함께 쓴다 — 데이터는 Supabase price_rules.
 */
export function UnitRateTable({
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
