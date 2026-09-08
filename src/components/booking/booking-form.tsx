"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createReservation,
  fetchAvailability,
  fetchSpaceWithPricing,
  releaseHold,
  type BusyRange,
  type CreatedReservation,
  type ExtraPersonRule,
  type PriceRule,
  type Space,
  type Unit,
} from "@/lib/supabase";
import {
  formatWon,
  isRangeFree,
  isoWeekday,
  quote,
  slotsForWeekday,
  type Quote,
} from "@/lib/pricing";
import { requestTossPayment } from "@/lib/toss";

const FLOORS = [
  { code: "2f", label: "2F 시그니처 스위트" },
  { code: "4f", label: "4F 시그니처 컨벤션" },
  { code: "6f", label: "6F 시그니처 루프탑" },
];

const WEEKDAY_LABEL = ["", "월", "화", "수", "목", "금", "토", "일"];

/** 오늘부터 N일치 날짜 목록 (KST 기준) */
function upcomingDates(days: number): string[] {
  const now = new Date();
  const kstToday = new Date(now.getTime() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const base = new Date(`${kstToday}T12:00:00+09:00`);
  return Array.from({ length: days }, (_, i) =>
    new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10),
  );
}

/** 'HH:MM' 목록 — 시간당 예약의 시작/종료 선택지 */
const HOURS = Array.from({ length: 15 }, (_, i) =>
  `${String(i + 9).padStart(2, "0")}:00`,
);

type SpaceData = Awaited<ReturnType<typeof fetchSpaceWithPricing>>;

export function BookingForm() {
  const [floor, setFloor] = useState("2f");
  const [date, setDate] = useState(() => upcomingDates(1)[0]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [slotCode, setSlotCode] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [headcount, setHeadcount] = useState(4);

  const [data, setData] = useState<SpaceData | null>(null);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 예약자 정보
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<CreatedReservation | null>(null);

  const dates = useMemo(() => upcomingDates(30), []);

  // 층이 바뀌면 요금·공간 정보를 다시 불러온다
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSpaceWithPricing(floor)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setUnitId(d.units[0]?.id ?? null);
        setSlotCode(null);
        setHeadcount(d.space.base_capacity);
      })
      .catch((e) => !cancelled && setError(e.message ?? "불러오지 못했습니다."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [floor]);

  // 날짜·층이 바뀌면 점유 현황을 다시 조회
  useEffect(() => {
    let cancelled = false;
    fetchAvailability(floor, date, date)
      .then((b) => !cancelled && setBusy(b))
      .catch(() => !cancelled && setBusy([]));
    return () => {
      cancelled = true;
    };
  }, [floor, date]);

  const unit = data?.units.find((u) => u.id === unitId) ?? null;
  const weekday = isoWeekday(date);

  // 패키지 상품이면 해당 요일에 운영하는 시간대 목록
  const slots: PriceRule[] = useMemo(() => {
    if (!data || !unit || unit.booking_unit !== "package") return [];
    return slotsForWeekday(data.priceRules, unit.id, weekday);
  }, [data, unit, weekday]);

  // 선택 가능한 슬롯이 바뀌면 첫 번째를 자동 선택
  useEffect(() => {
    if (slots.length > 0 && !slots.some((s) => s.slot_code === slotCode)) {
      setSlotCode(slots[0].slot_code);
    }
  }, [slots, slotCode]);

  const currentQuote: Quote | null = useMemo(() => {
    if (!data || !unit) return null;
    return quote({
      space: data.space as Space,
      unit: unit as Unit,
      priceRules: data.priceRules as PriceRule[],
      extraPersonRules: data.extraPersonRules as ExtraPersonRule[],
      date,
      slotCode: unit.booking_unit === "package" ? slotCode : null,
      startTime,
      endTime,
      headcount,
    });
  }, [data, unit, date, slotCode, startTime, endTime, headcount]);

  // 선택한 시간대가 이미 찼는지
  const isFree = useMemo(() => {
    if (!currentQuote?.ok || !unit || !data) return true;
    const codes = data.unitResourceCodes.get(unit.id) ?? [];
    return isRangeFree(busy, codes, currentQuote.startsAt, currentQuote.endsAt);
  }, [currentQuote, unit, data, busy]);

  const maxCap = unit?.max_capacity ?? data?.space.max_capacity ?? 10;
  const baseCap = unit?.base_capacity ?? data?.space.base_capacity ?? 1;

  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const canSubmit =
    !!currentQuote?.ok &&
    isFree &&
    !!unit &&
    name.trim().length > 0 &&
    /^01[0-9]{8,9}$/.test(phoneDigits) &&
    agreed &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !unit) return;
    setSubmitting(true);
    setSubmitError(null);
    let result: CreatedReservation;
    try {
      result = await createReservation({
        unitCode: unit.code,
        date,
        slotCode: unit.booking_unit === "package" ? slotCode : null,
        startTime: unit.booking_unit === "hourly" ? startTime : null,
        endTime: unit.booking_unit === "hourly" ? endTime : null,
        headcount,
        name,
        phone,
        memo,
      });
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "예약에 실패했습니다. 다시 시도해주세요.",
      );
      // 실패 원인이 중복 예약일 수 있으니 점유 현황을 갱신한다
      fetchAvailability(floor, date, date)
        .then(setBusy)
        .catch(() => {});
      setSubmitting(false);
      return;
    }

    // 예약(임시 홀드) 생성 성공 → 토스 결제창 호출.
    // 결제창이 뜨면 성공/실패 시 각각 /booking/success · /booking/fail 로
    // 리다이렉트되므로 아래 코드는 정상 흐름에서 반환되지 않는다.
    try {
      await requestTossPayment({
        orderId: result.code,
        orderName: `서초 시그니처 파티룸 · ${unit.name}`,
        amount: result.total_amount,
        customerName: name,
        customerMobilePhone: phoneDigits,
      });
      // (리다이렉트로 페이지 전환)
    } catch (payErr) {
      const msg = payErr instanceof Error ? payErr.message : String(payErr);
      // 결제 모듈이 아직 설정되지 않은 경우(키 없음) → 기존 안내 화면으로 폴백
      if (msg.includes("NEXT_PUBLIC_TOSS_CLIENT_KEY")) {
        setDone(result);
      } else {
        // 사용자가 결제창을 닫았거나 결제 오류 → 잡아둔 홀드를 즉시 풀어
        // 그 시간대를 바로 다시 예약할 수 있게 한다.
        releaseHold(result.code, phone)
          .catch(() => {})
          .finally(() => {
            fetchAvailability(floor, date, date)
              .then(setBusy)
              .catch(() => {});
          });
        setSubmitError(
          "결제가 완료되지 않았습니다. 다시 시도하시거나 카카오톡으로 문의해주세요.",
        );
      }
      setSubmitting(false);
    }
  }

  // 예약 완료 화면
  if (done) {
    return (
      <div className="mx-auto max-w-lg border border-line p-8 text-center md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-2xl text-white">
          ✓
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink">
          예약이 접수되었습니다
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          아래 예약번호를 꼭 저장해주세요.
          <br />
          예약 확인·취소 시 번호와 연락처가 필요합니다.
        </p>

        <div className="mt-7 bg-surface-soft p-5">
          <p className="text-xs text-muted">예약번호</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {done.code}
          </p>
        </div>

        <dl className="mt-6 space-y-3 text-left text-sm">
          <Row label="공간" value={unit?.name ?? "-"} />
          <Row
            label="일시"
            value={`${date.slice(5).replace("-", "/")} ${fmtTime(new Date(done.starts_at))}–${fmtTime(new Date(done.ends_at))}`}
          />
          <Row label="인원" value={`${headcount}명`} />
          <Row label="결제 예정 금액" value={formatWon(done.total_amount)} />
        </dl>

        <p className="mt-7 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900">
          아직 <strong>결제가 완료되지 않았습니다.</strong> 현재 결제 시스템
          준비 중이라, 확정을 위해 카카오톡 채널로 연락드립니다.
        </p>

        <a
          href="https://pf.kakao.com/_xiGLxkn/chat"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-12 w-full items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          카카오톡으로 문의하기
        </a>
      </div>
    );
  }

  if (loading && !data) {
    return <p className="py-20 text-center text-muted">불러오는 중…</p>;
  }
  if (error) {
    return (
      <p className="py-20 text-center text-muted">
        예약 정보를 불러오지 못했습니다. ({error})
      </p>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* min-w-0: 날짜 가로 스크롤이 그리드 컬럼을 밀어내지 않도록 */}
      <div className="min-w-0 space-y-9">
        {/* 1. 공간 */}
        <Step no={1} title="공간 선택">
          <div className="flex flex-wrap gap-2">
            {FLOORS.map((f) => (
              <Chip
                key={f.code}
                active={floor === f.code}
                onClick={() => setFloor(f.code)}
              >
                {f.label}
              </Chip>
            ))}
          </div>

          {/* 2F처럼 통대관·개별룸이 나뉘는 경우 */}
          {data && data.units.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.units.map((u) => (
                <Chip
                  key={u.id}
                  active={unitId === u.id}
                  onClick={() => setUnitId(u.id)}
                >
                  {u.name}
                </Chip>
              ))}
            </div>
          )}
        </Step>

        {/* 2. 날짜 */}
        <Step no={2} title="날짜 선택">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((d) => {
              const w = isoWeekday(d);
              const isWeekend = w >= 6;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center border text-sm transition-colors ${
                    date === d
                      ? "border-ink bg-ink text-white"
                      : "border-line text-ink hover:border-ink"
                  }`}
                >
                  <span
                    className={`text-[11px] ${
                      date === d
                        ? "text-white/70"
                        : isWeekend
                          ? "text-red-500"
                          : "text-muted"
                    }`}
                  >
                    {WEEKDAY_LABEL[w]}
                  </span>
                  <span className="font-medium">{Number(d.slice(8, 10))}</span>
                </button>
              );
            })}
          </div>
        </Step>

        {/* 3. 시간 */}
        <Step no={3} title="이용 시간">
          {unit?.booking_unit === "package" ? (
            slots.length === 0 ? (
              <p className="text-sm text-muted">
                이 요일에는 운영하는 시간대가 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <Chip
                    key={s.id}
                    active={slotCode === s.slot_code}
                    onClick={() => setSlotCode(s.slot_code)}
                  >
                    <span className="font-medium">{s.slot_name}</span>
                    {s.starts_at && (
                      <span className="ml-1.5 text-xs opacity-70">
                        {s.starts_at.slice(0, 5)}–{s.ends_at?.slice(0, 5)}
                      </span>
                    )}
                  </Chip>
                ))}
              </div>
            )
          ) : (
            <div className="flex items-center gap-3">
              <Select value={startTime} onChange={setStartTime} options={HOURS} />
              <span className="text-muted">–</span>
              <Select value={endTime} onChange={setEndTime} options={HOURS} />
              <span className="text-sm text-muted">
                최소 {unit?.min_hours ?? 1}시간
              </span>
            </div>
          )}
        </Step>

        {/* 4. 인원 */}
        <Step no={4} title="인원">
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-line">
              <button
                type="button"
                onClick={() => setHeadcount((n) => Math.max(1, n - 1))}
                className="h-11 w-11 text-lg text-ink hover:bg-surface-soft"
                aria-label="인원 줄이기"
              >
                −
              </button>
              <span className="w-14 text-center text-base font-medium">
                {headcount}명
              </span>
              <button
                type="button"
                onClick={() => setHeadcount((n) => Math.min(maxCap, n + 1))}
                className="h-11 w-11 text-lg text-ink hover:bg-surface-soft"
                aria-label="인원 늘리기"
              >
                +
              </button>
            </div>
            <p className="text-sm text-muted">
              기준 {baseCap}명 · 최대 {maxCap}명
              {headcount > baseCap && (
                <span className="ml-1 text-ink">
                  (추가 {headcount - baseCap}명)
                </span>
              )}
            </p>
          </div>
        </Step>

        {/* 5. 예약자 정보 */}
        <Step no={5} title="예약자 정보">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">이름</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예약자 성함"
                className="h-11 w-full border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">연락처</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="h-11 w-full border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
              />
              {phone.length > 0 && !/^01[0-9]{8,9}$/.test(phoneDigits) && (
                <span className="mt-1 block text-xs text-red-500">
                  휴대폰 번호를 정확히 입력해주세요.
                </span>
              )}
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm text-muted">
              요청사항 <span className="text-muted/60">(선택)</span>
            </span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="파티 목적, 준비물 등 알려주실 내용이 있으면 적어주세요."
              className="w-full resize-none border border-line bg-surface p-3 text-sm text-ink outline-none focus:border-ink"
            />
          </label>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span className="text-sm leading-relaxed text-ink/90">
              <strong className="font-medium">[필수]</strong>{" "}
              <a
                href="/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline underline-offset-2 hover:text-ink"
              >
                개인정보처리방침
              </a>{" "}
              및{" "}
              <a
                href="/terms/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline underline-offset-2 hover:text-ink"
              >
                이용약관
              </a>
              ·
              <a
                href="/refund/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline underline-offset-2 hover:text-ink"
              >
                취소·환불 규정
              </a>
              에 동의합니다.
              <span className="mt-1 block text-xs text-muted">
                수집 항목: 이름, 연락처 · 목적: 예약 확인 및 안내 · 보유 기간:
                예약일로부터 1년
              </span>
            </span>
          </label>
        </Step>
      </div>

      {/* 요금 요약 */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line p-6">
          <h3 className="text-base font-bold text-ink">예약 요약</h3>

          <dl className="mt-5 space-y-3 text-sm">
            <Row label="공간" value={unit?.name ?? "-"} />
            <Row
              label="일시"
              value={`${date.slice(5).replace("-", "/")} (${WEEKDAY_LABEL[weekday]}) ${
                currentQuote?.ok
                  ? `${fmtTime(currentQuote.startsAt)}–${fmtTime(currentQuote.endsAt)}`
                  : ""
              }`}
            />
            <Row label="인원" value={`${headcount}명`} />
          </dl>

          <hr className="my-5 border-line" />

          {currentQuote?.ok ? (
            <>
              <dl className="space-y-3 text-sm">
                <Row
                  label={`기본 요금${
                    currentQuote.hours ? ` (${currentQuote.hours}시간)` : ""
                  }`}
                  value={formatWon(currentQuote.baseAmount)}
                />
                {currentQuote.extraPeople > 0 && (
                  <Row
                    label={`추가 인원 ${currentQuote.extraPeople}명`}
                    value={formatWon(currentQuote.extraPersonAmount)}
                  />
                )}
                <Row
                  label="청소 보증금"
                  value={formatWon(currentQuote.depositAmount)}
                  hint="이용 후 문제 없으면 전액 환불"
                />
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
                <span className="text-sm font-medium text-ink">총 결제금액</span>
                <span className="text-2xl font-bold tracking-tight text-ink">
                  {formatWon(currentQuote.totalAmount)}
                </span>
              </div>

              {!isFree && (
                <p className="mt-4 bg-red-50 p-3 text-sm text-red-600">
                  이미 예약된 시간대입니다. 다른 시간을 선택해주세요.
                </p>
              )}

              {submitError && (
                <p className="mt-4 bg-red-50 p-3 text-sm text-red-600">
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-5 h-12 w-full bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "결제창 여는 중…"
                  : !isFree
                    ? "예약 불가"
                    : `${formatWon(currentQuote.totalAmount)} 결제하기`}
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                {!agreed || !name.trim() || !phoneDigits
                  ? "예약자 정보를 입력해주세요"
                  : "결제 완료 시 예약이 확정됩니다"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              {currentQuote?.reason ?? "예약 조건을 선택해주세요."}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── 작은 UI 조각들 ─────────────────────────────────────────────────────────

function Step({
  no,
  title,
  children,
}: {
  no: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-ink">
        <span className="flex h-6 w-6 items-center justify-center bg-ink text-xs text-white">
          {no}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 border px-4 text-sm transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 border border-line bg-surface px-3 text-sm text-ink"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">
        {label}
        {hint && <span className="block text-xs text-muted/70">{hint}</span>}
      </dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(d);
}
