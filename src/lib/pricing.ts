/**
 * 예약 금액 계산 — 순수 함수 모음 (DB·화면과 무관하게 단독 테스트 가능)
 *
 * 최종 결제액 = 기본요금 + 추가인원 + 청소보증금
 *   · 기본요금  : 시간당 상품이면 단가×시간, 패키지면 슬롯 정액
 *   · 추가인원  : 기준 인원 초과분 × 1인당 요금(이용 시간에 따라 달라질 수 있음)
 *   · 보증금    : 이용 후 문제 없으면 환불되는 금액
 *
 * 모든 시각은 한국 시간(KST, +09:00) 기준으로 다룬다.
 */

import type {
  ExtraPersonRule,
  PriceRule,
  Space,
  Unit,
} from "./supabase";

export const KST_OFFSET = "+09:00";

/** 'YYYY-MM-DD' + 'HH:MM' → KST 기준 Date */
export function kstDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00${KST_OFFSET}`);
}

/** 'YYYY-MM-DD' → ISO 요일 (1=월 … 7=일). KST 기준으로 계산한다. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00${KST_OFFSET}`).getUTCDay(); // 0=일
  return day === 0 ? 7 : day;
}

/** 공휴일·공휴일 전날은 주말 요금을 적용한다 (holidays 테이블 기반) */
export function effectiveWeekday(date: string, holidays: Set<string>): number {
  const base = isoWeekday(date);
  const d = new Date(`${date}T12:00:00${KST_OFFSET}`);
  const next = new Date(d.getTime() + 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  // 당일이 공휴일이거나 다음날이 공휴일이면 일요일 요금표를 쓴다
  if (holidays.has(date) || holidays.has(next)) return 7;
  return base;
}

/** 해당 요일에 적용되는 요금 규칙 찾기 */
export function findRule(
  rules: PriceRule[],
  unitId: string,
  weekday: number,
  slotCode: string | null,
): PriceRule | null {
  return (
    rules.find(
      (r) =>
        r.unit_id === unitId &&
        r.slot_code === slotCode &&
        r.weekdays.includes(weekday),
    ) ?? null
  );
}

/** 특정 요일에 예약 가능한 슬롯 목록 (패키지 상품) */
export function slotsForWeekday(
  rules: PriceRule[],
  unitId: string,
  weekday: number,
): PriceRule[] {
  return rules
    .filter(
      (r) =>
        r.unit_id === unitId &&
        r.slot_code !== null &&
        r.weekdays.includes(weekday),
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** 추가 인원 1인당 요금 — 이용 시간대별 구간 규칙을 적용 */
export function extraPersonFee(
  rules: ExtraPersonRule[],
  unitId: string,
  hours: number,
  slotCode: string | null,
): number {
  const matched = rules.filter((r) => {
    if (r.unit_id !== unitId) return false;
    if (r.slot_code !== null && r.slot_code !== slotCode) return false;
    if (r.min_hours !== null && hours < r.min_hours) return false;
    if (r.max_hours !== null && hours >= r.max_hours) return false;
    return true;
  });
  // 조건이 더 구체적인(구간이 지정된) 규칙을 우선한다
  matched.sort((a, b) => {
    const score = (r: ExtraPersonRule) =>
      (r.min_hours !== null ? 1 : 0) + (r.max_hours !== null ? 1 : 0);
    return score(b) - score(a);
  });
  return matched[0]?.fee ?? 0;
}

export type QuoteInput = {
  space: Space;
  unit: Unit;
  priceRules: PriceRule[];
  extraPersonRules: ExtraPersonRule[];
  date: string; // 'YYYY-MM-DD'
  /** 패키지 예약이면 슬롯 코드, 시간당이면 null */
  slotCode: string | null;
  /** 시간당 예약일 때만 사용 */
  startTime?: string; // 'HH:MM'
  endTime?: string; // 'HH:MM'
  headcount: number;
  holidays?: Set<string>;
  /** 성수기 등 배수 (없으면 1) */
  multiplier?: number;
};

export type Quote = {
  ok: boolean;
  reason?: string;
  startsAt: Date;
  endsAt: Date;
  hours: number;
  baseAmount: number;
  extraPeople: number;
  extraPersonAmount: number;
  depositAmount: number;
  totalAmount: number;
  slotName: string | null;
};

const EMPTY_QUOTE = (reason: string): Quote => ({
  ok: false,
  reason,
  startsAt: new Date(0),
  endsAt: new Date(0),
  hours: 0,
  baseAmount: 0,
  extraPeople: 0,
  extraPersonAmount: 0,
  depositAmount: 0,
  totalAmount: 0,
  slotName: null,
});

/** 예약 견적 계산 — 화면 표시와 서버 검증에 같은 함수를 쓴다. */
export function quote(input: QuoteInput): Quote {
  const {
    space,
    unit,
    priceRules,
    extraPersonRules,
    date,
    slotCode,
    startTime,
    endTime,
    headcount,
    holidays = new Set<string>(),
    multiplier = 1,
  } = input;

  const weekday = effectiveWeekday(date, holidays);
  const maxCap = unit.max_capacity ?? space.max_capacity;
  const baseCap = unit.base_capacity ?? space.base_capacity;

  if (headcount < 1) return EMPTY_QUOTE("인원을 입력하세요.");
  if (headcount > maxCap)
    return EMPTY_QUOTE(`최대 ${maxCap}명까지 이용할 수 있습니다.`);

  let startsAt: Date;
  let endsAt: Date;
  let hours: number;
  let baseAmount: number;
  let slotName: string | null = null;

  if (unit.booking_unit === "hourly") {
    if (!startTime || !endTime)
      return EMPTY_QUOTE("이용 시간을 선택하세요.");

    startsAt = kstDateTime(date, startTime);
    endsAt = kstDateTime(date, endTime);
    hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;

    if (hours <= 0) return EMPTY_QUOTE("종료 시각이 시작 시각보다 빨라요.");
    if (hours < unit.min_hours)
      return EMPTY_QUOTE(`최소 ${unit.min_hours}시간부터 예약할 수 있습니다.`);

    const rule = findRule(priceRules, unit.id, weekday, null);
    if (!rule) return EMPTY_QUOTE("해당 요일 요금 정보가 없습니다.");

    baseAmount = Math.round(rule.price * hours);
    slotName = rule.slot_name;
  } else {
    if (!slotCode) return EMPTY_QUOTE("이용 시간대를 선택하세요.");

    const rule = findRule(priceRules, unit.id, weekday, slotCode);
    if (!rule)
      return EMPTY_QUOTE("이 요일에는 해당 시간대를 운영하지 않습니다.");

    hours = rule.duration_h ?? 0;
    slotName = rule.slot_name;

    if (rule.starts_at && rule.ends_at) {
      startsAt = kstDateTime(date, rule.starts_at);
      endsAt = kstDateTime(date, rule.ends_at);
      hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    } else {
      // 3시간권처럼 시작 시각이 정해지지 않은 상품 — 시작 시각을 별도로 받는다
      if (!startTime) return EMPTY_QUOTE("시작 시각을 선택하세요.");
      startsAt = kstDateTime(date, startTime);
      endsAt = new Date(startsAt.getTime() + hours * 3_600_000);
    }

    baseAmount = rule.price;
  }

  baseAmount = Math.round(baseAmount * multiplier);

  const extraPeople = Math.max(0, headcount - baseCap);
  const fee = extraPersonFee(extraPersonRules, unit.id, hours, slotCode);
  const extraPersonAmount = extraPeople * fee;
  const depositAmount = space.deposit_amount;

  return {
    ok: true,
    startsAt,
    endsAt,
    hours,
    baseAmount,
    extraPeople,
    extraPersonAmount,
    depositAmount,
    totalAmount: baseAmount + extraPersonAmount + depositAmount,
    slotName,
  };
}

/** 원 단위 → '350,000원' */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

// ── 예약 가능 여부 ─────────────────────────────────────────────────────────

export type BusyRange = { resource_code: string; busy_from: string; busy_to: string };

/**
 * 선택한 시간대가 비어 있는지 확인.
 * unit이 점유하는 모든 resource 중 하나라도 겹치면 예약 불가.
 */
export function isRangeFree(
  busy: BusyRange[],
  resourceCodes: string[],
  startsAt: Date,
  endsAt: Date,
): boolean {
  const s = startsAt.getTime();
  const e = endsAt.getTime();
  return !busy.some((b) => {
    if (!resourceCodes.includes(b.resource_code)) return false;
    const bs = new Date(b.busy_from).getTime();
    const be = new Date(b.busy_to).getTime();
    return bs < e && be > s; // 반개구간 겹침 판정
  });
}
