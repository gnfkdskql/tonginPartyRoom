import { fetchPricingCatalog } from "@/lib/supabase-server";
import { formatWon } from "@/lib/pricing";
import { UnitRateTable } from "./unit-rate-table";

/**
 * 층별 상세 페이지 하단 "가격 및 이용 안내".
 * 상세 이미지에서 요금 구간을 잘라내고 이 블록이 대신한다 — 요금은 빌드 시 Supabase에서 읽는다.
 */
export async function FloorPricing({ spaceCode }: { spaceCode: string }) {
  const { spaces, units, priceRules, extraPersonRules } =
    await fetchPricingCatalog();
  const space = spaces.find((s) => s.code === spaceCode);
  if (!space) return null;

  const spaceUnits = units.filter((u) => u.space_id === space.id);
  const unitIds = new Set(spaceUnits.map((u) => u.id));
  const extras = extraPersonRules.filter((e) => unitIds.has(e.unit_id));

  // 추가 인원 요금 문구: "1인 10,000원 · 시간제 3시간 20,000원"
  const extraLabels = Array.from(
    new Set(
      extras.map((e) => {
        const slotName = e.slot_code
          ? priceRules.find((r) => r.slot_code === e.slot_code && unitIds.has(r.unit_id))?.slot_name
          : null;
        const cond =
          e.max_hours !== null
            ? `${e.max_hours}시간 미만 `
            : e.min_hours !== null
              ? `${e.min_hours}시간 이상 `
              : "";
        return `${slotName ? `${slotName} ` : ""}${cond}${formatWon(e.fee)}`;
      }),
    ),
  );

  return (
    <section className="bg-surface py-16 md:py-20">
      <div className="mx-auto max-w-(--container-page) px-5 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <span className="text-xs font-semibold tracking-[0.2em] text-muted">
            요금
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">
            가격 및 이용 안내
          </h2>
          <p className="mt-3 text-sm text-muted">
            모든 금액은 부가세 포함 대관료입니다. 예약 시 인원과 시간을 선택하면
            최종 금액이 자동으로 계산됩니다.
          </p>
        </div>

        {/* 요금표 */}
        <div className="mt-10 space-y-8">
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
              <UnitRateTable unit={unit} rules={priceRules} />
            </div>
          ))}
        </div>

        {/* 인원·보증금 / 환불 규정 / 안내 */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <InfoCard title="인원 및 보증금 안내">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="기준 인원" value={`${space.base_capacity}명`} />
              <Stat label="최대 인원" value={`${space.max_capacity}명`} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">추가 인원 (1인당)</dt>
                <dd className="text-right font-medium text-ink">
                  {extraLabels.length > 0 ? extraLabels.join(" · ") : "없음"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">청소 보증금</dt>
                <dd className="font-medium text-ink">
                  {formatWon(space.deposit_amount)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              보증금은 차감 사유에 해당하지 않을 시 전액 환급됩니다. 차감 기준:
              퇴실 정리 미흡, 시설 오염·파손, 무단 입실·늦은 퇴실, 추가 인원
              미고지, 실내 흡연 및 냄새 심한 음식 취사.
            </p>
          </InfoCard>

          <InfoCard title="환불 규정">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-line pb-3">
                <dt className="text-muted">이용 8일 전</dt>
                <dd className="font-medium text-ink">100% 환불</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-line pb-3">
                <dt className="text-muted">이용 7일 전 ~ 당일</dt>
                <dd className="font-medium text-ink">환불 불가</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">
                  예약 후 2시간 이내 취소
                  <span className="block text-xs text-muted/70">
                    (이용 당일 제외)
                  </span>
                </dt>
                <dd className="font-medium text-ink">100% 환불</dd>
              </div>
            </dl>
            <a
              href="/refund/"
              className="mt-4 inline-block text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              취소·환불 규정 전문 보기
            </a>
          </InfoCard>

          <InfoCard title="이용 안내">
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              <li>· 성수기(12~1월) 요금은 변동될 수 있습니다.</li>
              <li>· 공휴일 및 전날은 주말 요금이 적용됩니다.</li>
              <li>· 선택한 시간대에는 정리·퇴실 시간이 포함됩니다.</li>
              <li>· 대관료와 청소 보증금이 함께 결제됩니다.</li>
            </ul>
            <a
              href="/booking/"
              className="mt-6 flex h-12 items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {space.code.toUpperCase()} {space.name} 예약하기
            </a>
          </InfoCard>
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border border-line p-6">
      <h3 className="mb-5 text-base font-bold text-ink">{title}</h3>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-soft px-4 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}
