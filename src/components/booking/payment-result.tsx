"use client";

import { useEffect, useRef, useState } from "react";
import { formatWon } from "@/lib/pricing";
import { confirmPaymentEndpoint } from "@/lib/toss";

const KAKAO = "https://pf.kakao.com/_xiGLxkn/chat";

type ConfirmResult = {
  code: string;
  orderName?: string;
  amount: number;
  method?: string;
  approvedAt?: string;
};

/** 결제 성공 리다이렉트 처리 — Edge Function으로 최종 승인 요청 */
export function PaymentSuccess() {
  const [state, setState] = useState<"confirming" | "done" | "error">(
    "confirming",
  );
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode 이중 실행 방지
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));

    if (!paymentKey || !orderId || !amount) {
      setState("error");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    fetch(confirmPaymentEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          throw new Error(body?.message ?? "결제 승인에 실패했습니다.");
        }
        setResult(body.reservation as ConfirmResult);
        setState("done");
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : "결제 승인에 실패했습니다.");
        setState("error");
      });
  }, []);

  if (state === "confirming") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-ink" />
        <p className="mt-6 text-sm text-muted">결제를 확인하고 있습니다…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-lg border border-line p-8 text-center md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
          !
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
          결제 확인에 실패했습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{errorMsg}</p>
        <p className="mt-4 text-xs text-muted">
          결제가 이미 이루어졌다면 카카오톡 채널로 문의해주세요. 예약번호와
          함께 안내드리겠습니다.
        </p>
        <a
          href={KAKAO}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-12 w-full items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          카카오톡으로 문의하기
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg border border-line p-8 text-center md:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-2xl text-white">
        ✓
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
        결제가 완료되었습니다
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        예약이 확정되었습니다. 예약번호를 저장해주세요.
      </p>

      <div className="mt-7 bg-surface-soft p-5">
        <p className="text-xs text-muted">예약번호</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {result?.code}
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-left text-sm">
        {result?.orderName && (
          <Row label="상품" value={result.orderName} />
        )}
        <Row label="결제금액" value={formatWon(result?.amount ?? 0)} />
        {result?.method && <Row label="결제수단" value={result.method} />}
      </dl>

      <a
        href="/"
        className="mt-8 inline-flex h-12 w-full items-center justify-center border border-ink text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
      >
        홈으로
      </a>
    </div>
  );
}

/** 결제 실패 리다이렉트 처리 */
export function PaymentFail() {
  const [msg, setMsg] = useState("결제가 취소되었거나 실패했습니다.");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("message");
    if (m) setMsg(m);
  }, []);

  return (
    <div className="mx-auto max-w-lg border border-line p-8 text-center md:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-600">
        !
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
        결제가 완료되지 않았습니다
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{msg}</p>
      <p className="mt-4 text-xs text-muted">
        선택하신 시간은 잠시 보류되며, 결제가 없으면 곧 자동으로 해제됩니다.
      </p>
      <a
        href="/booking/"
        className="mt-6 inline-flex h-12 w-full items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        다시 예약하기
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
