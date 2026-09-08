// 관리자 결제취소·환불 (Supabase Edge Function)
//
// 관리자 페이지에서만 호출한다. 토스 결제취소는 시크릿 키가 필요하므로 여기서 처리.
// 보안: Verify JWT ON + 아래에서 role='authenticated'(로그인 사용자)인지 재확인.
//
// 필요 환경변수: TOSS_SECRET_KEY, SUPABASE_URL(자동), SUPABASE_SERVICE_ROLE_KEY(자동)

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

async function rest(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  };
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

/** 호출자가 로그인 사용자인지 확인 (anon 차단) */
function isAuthedUser(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return payload.role === "authenticated";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, message: "POST only" }, 405);
  if (!isAuthedUser(req)) {
    return json({ ok: false, message: "관리자 로그인이 필요합니다." }, 401);
  }
  if (!TOSS_SECRET_KEY) {
    return json({ ok: false, message: "TOSS_SECRET_KEY 누락" }, 500);
  }

  let reservationId = "", cancelReason = "", cancelAmount: number | null = null;
  try {
    const b = await req.json();
    reservationId = String(b.reservationId ?? "");
    cancelReason = String(b.cancelReason ?? "관리자 취소");
    cancelAmount = b.cancelAmount != null ? Number(b.cancelAmount) : null;
  } catch {
    return json({ ok: false, message: "요청 형식 오류" }, 400);
  }
  if (!reservationId) return json({ ok: false, message: "예약 ID가 없습니다." }, 400);

  // 예약 조회
  const rows = await rest(
    `reservations?id=eq.${reservationId}&select=id,status,total_amount`,
  );
  const r = Array.isArray(rows) ? rows[0] : null;
  if (!r) return json({ ok: false, message: "예약을 찾을 수 없습니다." }, 404);
  if (r.status === "cancelled") {
    return json({ ok: true, message: "이미 취소된 예약입니다." });
  }

  // 결제 조회
  const pays = await rest(
    `payments?reservation_id=eq.${reservationId}&status=eq.approved&select=id,payment_key,amount,cancelled_amount`,
  );
  const pay = Array.isArray(pays) ? pays[0] : null;

  // 결제가 없으면(미결제 홀드) 토스 없이 취소만
  if (!pay || !pay.payment_key) {
    await rest(`occupancies?reservation_id=eq.${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    await rest(`reservations?id=eq.${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason,
      }),
    });
    return json({ ok: true, message: "미결제 예약을 취소했습니다." });
  }

  // 토스 결제취소
  const basic = btoa(`${TOSS_SECRET_KEY}:`);
  const body: Record<string, unknown> = { cancelReason };
  if (cancelAmount != null) body.cancelAmount = cancelAmount; // 부분취소
  const tossRes = await fetch(
    `https://api.tosspayments.com/v1/payments/${pay.payment_key}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const toss = await tossRes.json();
  if (!tossRes.ok) {
    return json(
      { ok: false, message: toss?.message ?? "결제 취소에 실패했습니다.", code: toss?.code },
      400,
    );
  }

  // 부분취소 여부
  const fullyCancelled = toss.status === "CANCELED"; // 전액취소면 CANCELED
  const cancelledTotal =
    (pay.cancelled_amount ?? 0) + (cancelAmount ?? pay.amount);

  await rest(`payments?id=eq.${pay.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: fullyCancelled ? "cancelled" : "partial_cancelled",
      cancelled_amount: cancelledTotal,
      cancelled_at: new Date().toISOString(),
      raw: toss,
    }),
  });

  // 전액취소일 때만 예약 취소 + 시간대 해제
  if (fullyCancelled) {
    await rest(`occupancies?reservation_id=eq.${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    await rest(`reservations?id=eq.${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason,
        deposit_state: "refunded",
        refund_amount: cancelledTotal,
      }),
    });
  }

  return json({
    ok: true,
    message: fullyCancelled
      ? "전액 환불 및 예약 취소가 완료되었습니다."
      : "부분 환불이 완료되었습니다.",
    cancelledAmount: cancelledTotal,
  });
});
