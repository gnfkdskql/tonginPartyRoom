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
  effectiveWeekday,
  findRule,
  formatWon,
  isRangeFree,
  isoWeekday,
  quote,
  slotsForWeekday,
  type Quote,
} from "@/lib/pricing";
import { requestTossPayment } from "@/lib/toss";

const FLOORS = [
  { code: "2f", label: "2F 시그니처 스위트", short: "2F 스위트" },
  { code: "4f", label: "4F 시그니처 컨벤션", short: "4F 컨벤션" },
  { code: "6f", label: "6F 시그니처 루프탑", short: "6F 루프탑" },
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

/** '2026-09-30' → '9월 30일 (수)' */
function fmtDate(d: string): string {
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 (${WEEKDAY_LABEL[isoWeekday(d)]})`;
}

type SpaceData = Awaited<ReturnType<typeof fetchSpaceWithPricing>>;

/**
 * 룸 하나 = 패키지 unit + (있으면) 시간제 unit.
 * DB에는 '2f-green'(패키지)과 '2f-green-h'(시간제)가 따로 있지만
 * 손님에게는 "그린룸"을 고른 뒤 이용 방식만 바꾸는 것으로 보여준다.
 */
type Room = { code: string; name: string; pkg: Unit | null; hourly: Unit | null };

function groupRooms(units: Unit[]): Room[] {
  const map = new Map<string, Room>();
  for (const u of units) {
    const base = u.code.endsWith("-h") ? u.code.slice(0, -2) : u.code;
    const room = map.get(base) ?? {
      code: base,
      name: u.name.replace(/\s*\(시간제\)\s*$/, ""),
      pkg: null,
      hourly: null,
    };
    if (u.booking_unit === "hourly") room.hourly = u;
    else room.pkg = u;
    map.set(base, room);
  }
  // 개별 룸을 먼저, 통대관은 마지막에
  return Array.from(map.values()).sort(
    (a, b) => Number(a.code.endsWith("whole")) - Number(b.code.endsWith("whole")),
  );
}

type Mode = "package" | "hourly";
const STEPS = ["공간", "날짜", "이용 시간", "인원", "예약자 정보"] as const;

export function BookingForm() {
  const [floor, setFloor] = useState("2f");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("package");
  const [date, setDate] = useState(() => upcomingDates(1)[0]);
  const [slotCode, setSlotCode] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [headcount, setHeadcount] = useState(4);
  const [step, setStep] = useState(0);

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
        const rooms = groupRooms(d.units as Unit[]);
        const first = rooms[0] ?? null;
        setRoomCode(first?.code ?? null);
        setMode(first?.pkg ? "package" : "hourly");
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

  const rooms = useMemo(
    () => (data ? groupRooms(data.units as Unit[]) : []),
    [data],
  );
  const room = rooms.find((r) => r.code === roomCode) ?? null;
  const hasModeToggle = !!room?.pkg && !!room?.hourly;
  const unit: Unit | null =
    room === null
      ? null
      : mode === "hourly"
        ? (room.hourly ?? room.pkg)
        : (room.pkg ?? room.hourly);

  const weekday = isoWeekday(date);

  // 패키지 상품이면 해당 요일에 운영하는 시간대 목록
  const slots: PriceRule[] = useMemo(() => {
    if (!data || !unit || unit.booking_unit !== "package") return [];
    return slotsForWeekday(data.priceRules as PriceRule[], unit.id, weekday);
  }, [data, unit, weekday]);

  // 선택 가능한 슬롯이 바뀌면 첫 번째를 자동 선택
  useEffect(() => {
    if (slots.length > 0 && !slots.some((s) => s.slot_code === slotCode)) {
      setSlotCode(slots[0].slot_code);
    }
  }, [slots, slotCode]);

  /** 선택한 패키지 슬롯 — 시작 시각이 정해지지 않은 상품(3시간권·12시간)은 손님이 시작 시각을 고른다 */
  const selectedSlot = slots.find((s) => s.slot_code === slotCode) ?? null;
  const isHourly = unit?.booking_unit === "hourly";
  const needsStartTime =
    isHourly || (selectedSlot !== null && !selectedSlot.starts_at);

  const currentQuote: Quote | null = useMemo(() => {
    if (!data || !unit) return null;
    return quote({
      space: data.space as Space,
      unit,
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

  /**
   * 시간제로 고른 시간과 같은 길이의 패키지가 더 싸면 알려준다.
   * (예: 우드룸 12–18 시간제 240,000원 vs 낮 패키지 200,000원)
   */
  const cheaperPackage = useMemo(() => {
    if (!isHourly || !room?.pkg || !data || !currentQuote?.ok) return null;
    const wd = effectiveWeekday(date, new Set());
    const candidates = slotsForWeekday(
      data.priceRules as PriceRule[],
      room.pkg.id,
      wd,
    ).filter((s) => {
      const len = s.starts_at && s.ends_at
        ? toH(s.ends_at) - toH(s.starts_at)
        : Number(s.duration_h ?? 0);
      const sameLen = Math.abs(len - currentQuote.hours) < 0.01;
      const sameWindow =
        !s.starts_at ||
        (s.starts_at.slice(0, 5) === startTime && s.ends_at?.slice(0, 5) === endTime);
      return sameLen && sameWindow && s.price < currentQuote.baseAmount;
    });
    if (candidates.length === 0) return null;
    const best = candidates.sort((a, b) => a.price - b.price)[0];
    return { slot: best, saving: currentQuote.baseAmount - best.price };
  }, [isHourly, room, data, currentQuote, date, startTime, endTime]);

  const maxCap = unit?.max_capacity ?? data?.space.max_capacity ?? 10;
  const baseCap = unit?.base_capacity ?? data?.space.base_capacity ?? 1;

  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const phoneOk = /^01[0-9]{8,9}$/.test(phoneDigits);
  const infoOk = name.trim().length > 0 && phoneOk && agreed;
  const timeOk = !!currentQuote?.ok && isFree;
  const canSubmit = timeOk && !!unit && infoOk && !submitting;

  /** 단계별로 다음으로 넘어갈 수 있는지 */
  const stepReady = [true, true, timeOk, !!currentQuote?.ok, infoOk];

  function pickRoom(r: Room) {
    setRoomCode(r.code);
    if (!r.pkg) setMode("hourly");
    else if (!r.hourly) setMode("package");
    const u = mode === "hourly" && r.hourly ? r.hourly : (r.pkg ?? r.hourly);
    const cap = u?.max_capacity ?? data?.space.max_capacity ?? headcount;
    setHeadcount((n) => Math.min(n, cap));
  }

  function switchToPackage(slot: PriceRule) {
    setMode("package");
    setSlotCode(slot.slot_code);
    if (!slot.starts_at) setStartTime(startTime);
  }

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
        startTime: needsStartTime ? startTime : null,
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

  const floorLabel = FLOORS.find((f) => f.code === floor)?.short ?? floor;
  const timeSummary = currentQuote?.ok
    ? `${isHourly ? "시간제" : (currentQuote.slotName ?? "")} · ${fmtTime(currentQuote.startsAt)}–${fmtTime(currentQuote.endsAt)}`
    : "선택해주세요";

  const summaries = [
    rooms.length > 1 && room ? `${floorLabel} · ${room.name}` : floorLabel,
    fmtDate(date),
    timeSummary,
    `${headcount}명${
      currentQuote?.ok && currentQuote.extraPeople > 0
        ? ` · 추가 ${currentQuote.extraPeople}명`
        : " · 기준 인원 이내"
    }`,
    name.trim() ? `${name} · ${phone}` : "입력해주세요",
  ];

  const isLast = step === STEPS.length - 1;
  const primaryLabel = isLast
    ? submitting
      ? "결제창 여는 중…"
      : !isFree
        ? "예약 불가"
        : currentQuote?.ok
          ? `${formatWon(currentQuote.totalAmount)} 결제하기`
          : "결제하기"
    : `다음 · ${STEPS[step + 1]}`;
  const primaryDisabled = isLast ? !canSubmit : !stepReady[step];
  function onPrimary() {
    if (isLast) handleSubmit();
    else setStep((s) => s + 1);
  }

  return (
    <div className="grid gap-10 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
      {/* min-w-0: 날짜 가로 스크롤이 그리드 컬럼을 밀어내지 않도록 */}
      <div className="min-w-0 space-y-2">
        {STEPS.map((title, i) => {
          const state = i === step ? "active" : i < step ? "done" : "todo";
          if (state !== "active") {
            return (
              <StepRow
                key={title}
                title={title}
                summary={summaries[i]}
                state={state}
                onClick={() => setStep(i)}
              />
            );
          }
          return (
            <section
              key={title}
              className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-6"
            >
              <h2 className="text-base font-bold text-ink">{title}</h2>
              <div className="mt-4">
                {i === 0 && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {FLOORS.map((f) => (
                        <Pill
                          key={f.code}
                          active={floor === f.code}
                          onClick={() => setFloor(f.code)}
                        >
                          {f.label}
                        </Pill>
                      ))}
                    </div>

                    {rooms.length > 1 && (
                      <div>
                        <p className="mb-2 text-sm text-muted">룸</p>
                        <div className="divide-y divide-line border-y border-line">
                          {rooms.map((r) => {
                            const u = r.pkg ?? r.hourly!;
                            const cap = u.base_capacity ?? data?.space.base_capacity;
                            const from = r.hourly && data
                              ? findRule(data.priceRules as PriceRule[], r.hourly.id, weekday, null)?.price
                              : null;
                            const on = roomCode === r.code;
                            return (
                              <button
                                key={r.code}
                                type="button"
                                onClick={() => pickRoom(r)}
                                className="flex h-14 w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="flex items-center gap-3">
                                  <Radio on={on} />
                                  <span className={`text-[15px] ${on ? "font-bold" : ""}`}>
                                    {r.name}
                                  </span>
                                  <span className="text-xs text-muted">기준 {cap}명</span>
                                </span>
                                {from !== null && from !== undefined && (
                                  <span className="text-sm tabular-nums text-muted">
                                    {formatWon(from)}~ <span className="text-xs">/시간</span>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {i === 1 && (
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                    {dates.map((d) => {
                      const w = isoWeekday(d);
                      const isWeekend = w >= 6;
                      const on = date === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDate(d)}
                          className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                            on ? "bg-ink text-white" : "bg-surface-soft text-ink hover:bg-line"
                          }`}
                        >
                          <span
                            className={`text-[11px] ${
                              on ? "text-white/70" : isWeekend ? "text-red-500" : "text-muted"
                            }`}
                          >
                            {WEEKDAY_LABEL[w]}
                          </span>
                          <span className="font-medium">{Number(d.slice(8, 10))}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {i === 2 && (
                  <div className="space-y-4">
                    {hasModeToggle && (
                      <div className="flex justify-end">
                        <div className="flex rounded-full bg-surface-soft p-0.5">
                          <Seg on={mode === "package"} onClick={() => setMode("package")}>
                            패키지
                          </Seg>
                          <Seg on={mode === "hourly"} onClick={() => setMode("hourly")}>
                            시간제
                          </Seg>
                        </div>
                      </div>
                    )}

                    {!isHourly ? (
                      slots.length === 0 ? (
                        <p className="text-sm text-muted">
                          이 요일에는 운영하는 시간대가 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {slots.map((s) => {
                            const on = slotCode === s.slot_code;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setSlotCode(s.slot_code)}
                                className={`flex h-12 w-full items-center justify-between rounded-xl px-4 text-left transition-colors ${
                                  on ? "bg-ink text-white" : "bg-surface-soft text-ink hover:bg-line"
                                }`}
                              >
                                <span className="text-sm">
                                  <span className={on ? "font-medium" : ""}>{s.slot_name}</span>
                                  <span className={`ml-2 text-xs ${on ? "text-white/70" : "text-muted"}`}>
                                    {s.starts_at
                                      ? `${s.starts_at.slice(0, 5)}–${s.ends_at?.slice(0, 5)}`
                                      : "원하는 시각부터"}
                                  </span>
                                </span>
                                <span className={`text-sm tabular-nums ${on ? "font-bold" : ""}`}>
                                  {formatWon(s.price)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Select value={startTime} onChange={setStartTime} options={HOURS} />
                        <span className="text-muted">–</span>
                        <Select value={endTime} onChange={setEndTime} options={HOURS} />
                        <span className="text-sm text-muted">
                          최소 {unit?.min_hours ?? 1}시간
                          {currentQuote?.ok && ` · ${currentQuote.hours}시간 ${formatWon(currentQuote.baseAmount)}`}
                        </span>
                      </div>
                    )}

                    {!isHourly && selectedSlot && !selectedSlot.starts_at && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-muted">시작 시각</span>
                        <div className="flex items-center gap-3">
                          <Select value={startTime} onChange={setStartTime} options={HOURS} />
                          {currentQuote?.ok && (
                            <span className="text-sm text-muted">
                              → {fmtTime(currentQuote.endsAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {cheaperPackage && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <span>
                          같은 시간이면 <strong>{cheaperPackage.slot.slot_name} 패키지</strong>가{" "}
                          {formatWon(cheaperPackage.saving)} 저렴합니다
                        </span>
                        <button
                          type="button"
                          onClick={() => switchToPackage(cheaperPackage.slot)}
                          className="font-medium underline underline-offset-2"
                        >
                          패키지로 바꾸기
                        </button>
                      </div>
                    )}

                    {currentQuote && !currentQuote.ok && (
                      <p className="text-sm text-red-600">{currentQuote.reason}</p>
                    )}
                    {currentQuote?.ok && !isFree && (
                      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        이미 예약된 시간대입니다. 다른 시간을 선택해주세요.
                      </p>
                    )}
                  </div>
                )}

                {i === 3 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted">
                        기준 {baseCap}명 · 최대 {maxCap}명
                      </p>
                      <div className="flex items-center rounded-full bg-surface-soft">
                        <button
                          type="button"
                          onClick={() => setHeadcount((n) => Math.max(1, n - 1))}
                          className="h-11 w-11 rounded-full text-lg text-ink hover:bg-line"
                          aria-label="인원 줄이기"
                        >
                          −
                        </button>
                        <span className="w-14 text-center text-base font-bold tabular-nums">
                          {headcount}명
                        </span>
                        <button
                          type="button"
                          onClick={() => setHeadcount((n) => Math.min(maxCap, n + 1))}
                          className="h-11 w-11 rounded-full text-lg text-ink hover:bg-line"
                          aria-label="인원 늘리기"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {currentQuote?.ok && currentQuote.extraPeople > 0 && (
                      <p className="text-sm text-ink">
                        추가 {currentQuote.extraPeople}명 ·{" "}
                        {formatWon(currentQuote.extraPersonAmount)} 이 더해집니다
                      </p>
                    )}
                  </div>
                )}

                {i === 4 && (
                  <div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-muted">이름</span>
                        <input
                          id="booking-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="예약자 성함"
                          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-muted">연락처</span>
                        <input
                          id="booking-phone"
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="010-0000-0000"
                          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
                        />
                        {phone.length > 0 && !phoneOk && (
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
                        id="booking-memo"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={3}
                        placeholder="파티 목적, 준비물 등 알려주실 내용이 있으면 적어주세요."
                        className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm text-ink outline-none focus:border-ink"
                      />
                    </label>

                    <label className="mt-5 flex cursor-pointer items-start gap-3">
                      <input
                        id="booking-agree"
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                      />
                      <span className="text-sm leading-relaxed text-ink/90">
                        <strong className="font-medium">[필수]</strong>{" "}
                        <a href="/privacy/" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 hover:text-ink">
                          개인정보처리방침
                        </a>{" "}
                        및{" "}
                        <a href="/terms/" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 hover:text-ink">
                          이용약관
                        </a>
                        ·
                        <a href="/refund/" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 hover:text-ink">
                          취소·환불 규정
                        </a>
                        에 동의합니다.
                        <span className="mt-1 block text-xs text-muted">
                          수집 항목: 이름, 연락처 · 목적: 예약 확인 및 안내 · 보유 기간:
                          예약일로부터 1년
                        </span>
                      </span>
                    </label>

                    {submitError && (
                      <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {submitError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 데스크톱: 카드 안에 다음 버튼. 모바일은 하단 고정 바가 맡는다 */}
              <div className="mt-6 hidden justify-end lg:flex">
                <button
                  type="button"
                  onClick={onPrimary}
                  disabled={primaryDisabled}
                  className="h-11 rounded-full bg-ink px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {primaryLabel}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* 데스크톱 요약 */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="rounded-2xl bg-surface-soft p-6">
          <h3 className="text-base font-bold text-ink">예약 요약</h3>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="공간" value={summaries[0]} />
            <Row label="일시" value={`${date.slice(5).replace("-", "/")} · ${timeSummary}`} />
            <Row label="인원" value={`${headcount}명`} />
          </dl>
          <hr className="my-5 border-line" />
          {currentQuote?.ok ? (
            <>
              <dl className="space-y-3 text-sm">
                <Row
                  label={`기본 요금${currentQuote.hours ? ` (${currentQuote.hours}시간)` : ""}`}
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
            </>
          ) : (
            <p className="text-sm text-muted">
              {currentQuote?.reason ?? "예약 조건을 선택해주세요."}
            </p>
          )}
        </div>
      </aside>

      {/* 모바일 하단 고정 바 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-(--container-page) items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl font-bold tabular-nums tracking-tight text-ink">
              {currentQuote?.ok ? formatWon(currentQuote.totalAmount) : "—"}
            </p>
            <p className="truncate text-[11px] text-muted">
              {currentQuote?.ok
                ? `보증금 ${formatWon(currentQuote.depositAmount)} 포함 · 이용 후 환불`
                : (currentQuote?.reason ?? "조건을 선택해주세요")}
            </p>
          </div>
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="h-12 shrink-0 rounded-full bg-ink px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 작은 UI 조각들 ─────────────────────────────────────────────────────────

/** 접힌 단계 한 줄: 끝난 단계는 요약 + 변경, 아직인 단계는 흐리게 */
function StepRow({
  title,
  summary,
  state,
  onClick,
}: {
  title: string;
  summary: string;
  state: "done" | "todo";
  onClick: () => void;
}) {
  const done = state === "done";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!done}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl bg-surface-soft px-5 py-3.5 text-left transition-colors ${
        done ? "hover:bg-line" : "opacity-50"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] text-muted">{title}</span>
        <span className={`block truncate text-sm ${done ? "font-bold text-ink" : "text-ink/80"}`}>
          {done ? summary : "다음 단계"}
        </span>
      </span>
      {done && <span className="shrink-0 text-xs text-muted">변경</span>}
    </button>
  );
}

function Pill({
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
      className={`h-10 rounded-full px-4 text-sm transition-colors ${
        active ? "bg-ink text-white" : "bg-surface-soft text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function Seg({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
        on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] ${
        on ? "border-ink bg-ink" : "border-line"
      }`}
    />
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
      className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
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

/** 'HH:MM:SS' → 시(number) */
function toH(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}
