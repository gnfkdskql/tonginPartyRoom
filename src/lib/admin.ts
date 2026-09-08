/**
 * 관리자(사장님) 전용 데이터 계층.
 *
 * - 공개 사이트용 supabase 클라이언트(persistSession:false)와 별도로,
 *   로그인 세션을 유지하는 관리자 클라이언트를 둔다.
 * - 로그인하면 RLS의 `authenticated` 정책으로 예약·결제·점유 전체에 접근 가능.
 * - 환불(토스 결제취소)은 시크릿 키가 필요하므로 Edge Function(cancel-payment)으로 처리.
 */
import { createClient, type Session } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const adminClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "signature-admin-auth",
  },
});

// ── 인증 ────────────────────────────────────────────────────────────────
export async function adminSignIn(email: string, password: string) {
  const { data, error } = await adminClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data.session;
}

export async function adminSignOut() {
  await adminClient.auth.signOut();
}

export async function getAdminSession(): Promise<Session | null> {
  const { data } = await adminClient.auth.getSession();
  return data.session;
}

export function onAdminAuthChange(cb: (session: Session | null) => void) {
  const { data } = adminClient.auth.onAuthStateChange((_e, session) =>
    cb(session),
  );
  return () => data.subscription.unsubscribe();
}

// ── 타입 ────────────────────────────────────────────────────────────────
export type AdminPayment = {
  status: string;
  method: string | null;
  amount: number;
  approved_at: string | null;
  cancelled_amount: number;
  receipt_url: string | null;
  payment_key: string | null;
};

export type AdminReservation = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  headcount: number;
  base_amount: number;
  extra_person_amount: number;
  deposit_amount: number;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  memo: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  deposit_state: string;
  cancel_reason: string | null;
  created_at: string;
  units: { name: string } | null;
  spaces: { name: string; code: string } | null;
  payments: AdminPayment[];
};

export type AdminResource = {
  id: string;
  code: string;
  name: string;
  space_id: string;
};

export type AdminBlock = {
  id: string;
  resource_id: string;
  reason: string | null;
  from: string; // ISO
  to: string; // ISO
};

// ── 예약 목록 ──────────────────────────────────────────────────────────────
const RES_SELECT =
  "id,code,starts_at,ends_at,headcount,base_amount,extra_person_amount," +
  "deposit_amount,total_amount,customer_name,customer_phone,memo,status," +
  "deposit_state,cancel_reason,created_at," +
  "units(name),spaces(name,code)," +
  "payments(status,method,amount,approved_at,cancelled_amount,receipt_url,payment_key)";

export async function listReservations(opts?: {
  status?: string; // 'all' | reservation_status
  spaceCode?: string;
}): Promise<AdminReservation[]> {
  let q = adminClient
    .from("reservations")
    .select(RES_SELECT)
    .order("starts_at", { ascending: false })
    .limit(500);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminReservation[];
}

// ── 취소 (미결제 홀드/pending — 토스 취소 불필요) ────────────────────────
export async function cancelUnpaidReservation(id: string, reason: string) {
  const { error: e1 } = await adminClient
    .from("reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || "관리자 취소",
    })
    .eq("id", id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await adminClient
    .from("occupancies")
    .update({ active: false })
    .eq("reservation_id", id);
  if (e2) throw new Error(e2.message);
}

// ── 환불 취소 (결제된 예약 — 토스 결제취소 Edge Function) ──────────────────
export async function refundReservation(
  reservationId: string,
  cancelReason: string,
  cancelAmount?: number, // 미지정 시 전액
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await adminClient.functions.invoke("cancel-payment", {
    body: { reservationId, cancelReason, cancelAmount },
  });
  if (error) return { ok: false, message: error.message };
  return data as { ok: boolean; message?: string };
}

// ── 자원(룸) 목록 — 차단 UI용 ──────────────────────────────────────────────
export async function listResources(): Promise<AdminResource[]> {
  const { data, error } = await adminClient
    .from("resources")
    .select("id,code,name,space_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminResource[];
}

// ── 시간대 차단 ────────────────────────────────────────────────────────────
// tstzrange 문자열: ["2026-08-20T05:00:00+00:00","2026-08-20T09:00:00+00:00")
function rangeLiteral(fromISO: string, toISO: string): string {
  return `["${fromISO}","${toISO}")`;
}

export async function createBlock(
  resourceIds: string[],
  fromISO: string,
  toISO: string,
  reason: string,
): Promise<void> {
  const rows = resourceIds.map((rid) => ({
    resource_id: rid,
    reservation_id: null,
    kind: "block",
    during: rangeLiteral(fromISO, toISO),
    active: true,
    reason: reason || "관리자 차단",
  }));
  const { error } = await adminClient.from("occupancies").insert(rows);
  if (error) {
    // 겹치는 예약/차단이 있으면 exclusion_violation
    if (error.message.includes("occupancies_no_overlap")) {
      throw new Error("이미 예약되었거나 차단된 시간대가 포함되어 있습니다.");
    }
    throw new Error(error.message);
  }
}

/** tstzrange 문자열 파싱 → {from, to} ISO */
function parseRange(during: string): { from: string; to: string } {
  // 형태: ["2026-08-20 05:00:00+00","2026-08-20 09:00:00+00")
  const m = during.match(/[\[(]"?([^",]+)"?,"?([^"\)]+)"?[\])]/);
  if (!m) return { from: "", to: "" };
  const norm = (s: string) => {
    // "2026-08-20 05:00:00+00" → "2026-08-20T05:00:00+00:00"
    let t = s.trim().replace(" ", "T");
    // 오프셋이 +HH (콜론 없음)이면 +HH:00 으로 보정 (일부 JS 엔진이 파싱 실패)
    t = t.replace(/([+-]\d{2})$/, "$1:00");
    const d = new Date(t);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  };
  return { from: norm(m[1]), to: norm(m[2]) };
}

/** 관리자 차단 목록 (달력에서 표시·해제용) */
export async function listBlocks(
  fromISO: string,
  toISO: string,
): Promise<(AdminBlock & { resource_code: string })[]> {
  const { data, error } = await adminClient
    .from("occupancies")
    .select("id,resource_id,reason,during,resources(code)")
    .eq("kind", "block")
    .eq("active", true);
  if (error) throw new Error(error.message);
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return (data ?? [])
    .map((o: Record<string, unknown>) => {
      const r = parseRange(o.during as string);
      return {
        id: o.id as string,
        resource_id: o.resource_id as string,
        reason: (o.reason as string) ?? null,
        from: r.from,
        to: r.to,
        resource_code:
          ((o.resources as { code?: string } | null)?.code) ?? "",
      };
    })
    .filter((b) => {
      const bf = new Date(b.from).getTime();
      const bt = new Date(b.to).getTime();
      return bf < to && bt > from; // 기간 겹침
    });
}

export async function removeBlock(id: string): Promise<void> {
  const { error } = await adminClient
    .from("occupancies")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
