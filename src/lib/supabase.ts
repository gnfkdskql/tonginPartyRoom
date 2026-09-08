import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase 환경변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.",
  );
}

/**
 * 브라우저에서 쓰는 Supabase 클라이언트.
 *
 * 정적 export라 anon key가 그대로 노출되므로, 이 클라이언트로는
 * "요금표 읽기"와 "언제 찼는지 조회"만 가능하도록 RLS가 걸려 있다.
 * 예약 생성·결제 승인처럼 신뢰가 필요한 작업은 Edge Function에서 처리한다.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

// ── 도메인 타입 ────────────────────────────────────────────────────────────

export type BookingUnit = "hourly" | "package";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type Space = {
  id: string;
  code: string;
  name: string;
  base_capacity: number;
  max_capacity: number;
  deposit_amount: number;
  sort_order: number;
};

export type Unit = {
  id: string;
  space_id: string;
  code: string;
  name: string;
  booking_unit: BookingUnit;
  min_hours: number;
  base_capacity: number | null;
  max_capacity: number | null;
  sort_order: number;
};

export type PriceRule = {
  id: string;
  unit_id: string;
  slot_code: string | null;
  slot_name: string | null;
  weekdays: number[];
  starts_at: string | null;
  ends_at: string | null;
  duration_h: number | null;
  price: number;
  sort_order: number;
};

export type ExtraPersonRule = {
  id: string;
  unit_id: string;
  slot_code: string | null;
  min_hours: number | null;
  max_hours: number | null;
  fee: number;
};

/** get_availability RPC 반환 형태 — 점유 시간대만, 개인정보 없음 */
export type BusyRange = {
  resource_code: string;
  busy_from: string;
  busy_to: string;
};

// ── 조회 함수 ──────────────────────────────────────────────────────────────

/** 판매 단위 ↔ 물리 공간 매핑 (통대관 겹침 판정에 사용) */
export type UnitResource = { unit_id: string; resource_id: string };
export type Resource = { id: string; space_id: string; code: string; name: string };

/** 층별 공간 + 판매 단위 + 요금 규칙을 한 번에 가져온다. */
export async function fetchSpaceWithPricing(spaceCode: string) {
  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("*")
    .eq("code", spaceCode)
    .single();
  if (spaceError) throw spaceError;

  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("*")
    .eq("space_id", (space as Space).id)
    .order("sort_order");
  if (unitsError) throw unitsError;

  const unitIds = (units as Unit[]).map((u) => u.id);

  const { data: rules, error: rulesError } = await supabase
    .from("price_rules")
    .select("*")
    .in("unit_id", unitIds)
    .order("sort_order");
  if (rulesError) throw rulesError;

  const { data: extras, error: extrasError } = await supabase
    .from("extra_person_rules")
    .select("*")
    .in("unit_id", unitIds);
  if (extrasError) throw extrasError;

  const { data: resources, error: resError } = await supabase
    .from("resources")
    .select("*")
    .eq("space_id", (space as Space).id);
  if (resError) throw resError;

  const { data: unitRes, error: urError } = await supabase
    .from("unit_resources")
    .select("*")
    .in("unit_id", unitIds);
  if (urError) throw urError;

  // unit → 점유하는 resource code 목록
  const resourceById = new Map(
    (resources as Resource[]).map((r) => [r.id, r.code]),
  );
  const unitResourceCodes = new Map<string, string[]>();
  for (const ur of unitRes as UnitResource[]) {
    const code = resourceById.get(ur.resource_id);
    if (!code) continue;
    const list = unitResourceCodes.get(ur.unit_id) ?? [];
    list.push(code);
    unitResourceCodes.set(ur.unit_id, list);
  }

  return {
    space: space as Space,
    units: units as Unit[],
    priceRules: rules as PriceRule[],
    extraPersonRules: extras as ExtraPersonRule[],
    resources: resources as Resource[],
    unitResourceCodes,
  };
}

/** 특정 기간에 이미 찬 시간대를 가져온다. (개인정보 없음) */
export async function fetchAvailability(
  spaceCode: string,
  from: string, // 'YYYY-MM-DD'
  to: string,
): Promise<BusyRange[]> {
  const { data, error } = await supabase.rpc("get_availability", {
    p_space_code: spaceCode,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return (data ?? []) as BusyRange[];
}

export type CreatedReservation = {
  code: string;
  starts_at: string;
  ends_at: string;
  base_amount: number;
  extra_amount: number;
  deposit_amount: number;
  total_amount: number;
};

export type CreateReservationInput = {
  unitCode: string;
  date: string; // 'YYYY-MM-DD'
  slotCode: string | null;
  startTime: string | null; // 'HH:MM'
  endTime: string | null;
  headcount: number;
  name: string;
  phone: string;
  memo?: string;
};

/**
 * 예약 생성. 금액은 서버(DB 함수)에서 요금표를 다시 읽어 계산하므로,
 * 브라우저가 보낸 금액을 신뢰하지 않는다.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<CreatedReservation> {
  const { data, error } = await supabase.rpc("create_reservation", {
    p_unit_code: input.unitCode,
    p_date: input.date,
    p_slot_code: input.slotCode,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_headcount: input.headcount,
    p_name: input.name,
    p_phone: input.phone,
    p_memo: input.memo ?? null,
    p_privacy_agreed: true,
    p_terms_agreed: true,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CreatedReservation[];
  if (rows.length === 0) throw new Error("예약 생성에 실패했습니다.");
  return rows[0];
}

/**
 * 결제 미완료 홀드 즉시 해제.
 * 결제창을 닫거나 결제에 실패했을 때 호출해, 방금 잡아둔 시간대를
 * 바로 다시 예약 가능하게 만든다. (예약번호 + 전화번호가 맞고 pending일 때만)
 */
export async function releaseHold(code: string, phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("release_hold", {
    p_code: code,
    p_phone: phone,
  });
  if (error) return false;
  return Boolean(data);
}

/** 비회원 예약 조회 — 예약번호 + 전화번호가 모두 맞아야 조회된다. */
export async function lookupReservation(code: string, phone: string) {
  const { data, error } = await supabase.rpc("lookup_reservation", {
    p_code: code,
    p_phone: phone,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown[];
  return rows.length > 0 ? rows[0] : null;
}
