// 토스페이먼츠 결제 승인 (Supabase Edge Function)
//
// 정적 사이트(닷홈)에는 서버가 없으므로 결제 "승인(confirm)"은 여기서 처리한다.
// 브라우저가 보낸 금액을 신뢰하지 않고 DB의 total_amount 와 대조한 뒤,
// 시크릿 키(TOSS_SECRET_KEY)로 토스 승인 API를 호출한다.
//
// 필요한 환경변수:
//   TOSS_SECRET_KEY            — 토스 시크릿 키 (test_sk_... / live_sk_...)  ※직접 설정
//   SUPABASE_URL               — (런타임 자동 주입)
//   SUPABASE_SERVICE_ROLE_KEY  — (런타임 자동 주입) RLS 우회용

const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// service_role 로 PostgREST 호출
async function rest(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  };
  // 쓰기 요청에만 Content-Type/Prefer 를 붙인다 (GET 에 붙이면 일부 게이트웨이가 오작동)
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`DB 오류(${res.status}): ${text}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, message: "POST only" }, 405);

  if (!TOSS_SECRET_KEY) {
    return json(
      { ok: false, message: "결제 서버 설정 오류(TOSS_SECRET_KEY 누락)" },
      500,
    );
  }

  let paymentKey = "", orderId = "", amount = 0;
  try {
    const body = await req.json();
    paymentKey = String(body.paymentKey ?? "");
    orderId = String(body.orderId ?? "");
    amount = Number(body.amount ?? 0);
  } catch {
    return json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, 400);
  }
  if (!paymentKey || !orderId || !amount) {
    return json({ ok: false, message: "필수 결제 정보가 없습니다." }, 400);
  }

  // 1) 예약 조회 (orderId = 예약번호 code)
  const rows = await rest(
    `reservations?code=eq.${encodeURIComponent(orderId)}` +
      `&select=id,code,total_amount,status,slot_code,unit_id`,
  );
  const reservation = Array.isArray(rows) ? rows[0] : null;
  if (!reservation) {
    return json({ ok: false, message: "예약을 찾을 수 없습니다." }, 404);
  }

  // 2) 이미 확정된 예약이면 멱등 처리 (중복 승인 방지)
  if (reservation.status === "confirmed") {
    const pays = await rest(
      `payments?order_id=eq.${encodeURIComponent(orderId)}&select=amount,method,approved_at`,
    );
    const p = Array.isArray(pays) ? pays[0] : null;
    return json({
      ok: true,
      reservation: {
        code: reservation.code,
        amount: p?.amount ?? reservation.total_amount,
        method: p?.method,
        approvedAt: p?.approved_at,
      },
    });
  }

  // 3) 금액 검증 — 브라우저가 보낸 금액을 신뢰하지 않는다
  if (Number(reservation.total_amount) !== amount) {
    return json(
      { ok: false, message: "결제 금액이 예약 정보와 일치하지 않습니다." },
      400,
    );
  }

  // 4) 토스 승인 호출
  const basic = btoa(`${TOSS_SECRET_KEY}:`);
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const toss = await tossRes.json();
  if (!tossRes.ok) {
    // 승인 실패 → 예약은 pending 유지(홀드 만료로 자동 해제)
    return json(
      { ok: false, message: toss?.message ?? "결제 승인에 실패했습니다.", code: toss?.code },
      400,
    );
  }

  // 5) 결제 기록 저장 + 예약 확정
  const method = toss.method ?? null; // 예: "카드"
  const approvedAt = toss.approvedAt ?? null;
  const receiptUrl = toss.receipt?.url ?? null;

  await rest(`payments`, {
    method: "POST",
    body: JSON.stringify({
      reservation_id: reservation.id,
      order_id: orderId,
      payment_key: paymentKey,
      amount,
      status: "approved",
      method,
      receipt_url: receiptUrl,
      approved_at: approvedAt,
      raw: toss,
    }),
  });

  await rest(`reservations?id=eq.${reservation.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "confirmed",
      deposit_state: "held",
      hold_expires_at: null,
    }),
  });

  return json({
    ok: true,
    reservation: {
      code: reservation.code,
      orderName: toss.orderName,
      amount,
      method,
      approvedAt,
    },
  });
});
