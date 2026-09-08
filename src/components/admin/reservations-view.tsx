"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cancelUnpaidReservation,
  listReservations,
  refundReservation,
  type AdminReservation,
} from "@/lib/admin";
import { formatWon } from "@/lib/pricing";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

function fmtKst(iso: string, withTime = true): string {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const mm = String(k.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(k.getUTCDate()).padStart(2, "0");
  const wd = WD[k.getUTCDay()];
  if (!withTime) return `${mm}/${dd}(${wd})`;
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mi = String(k.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd}(${wd}) ${hh}:${mi}`;
}

function hm(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "결제대기",
  confirmed: "확정",
  cancelled: "취소",
  completed: "이용완료",
  no_show: "노쇼",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
  completed: "bg-surface-soft text-ink/70",
  no_show: "bg-red-50 text-red-600",
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "confirmed", label: "확정" },
  { key: "pending", label: "결제대기" },
  { key: "cancelled", label: "취소" },
  { key: "completed", label: "이용완료" },
];

export function ReservationsView() {
  const [rows, setRows] = useState<AdminReservation[] | null>(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminReservation | null>(null);

  async function reload() {
    setError("");
    try {
      setRows(await listReservations({ status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
  }

  useEffect(() => {
    setRows(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(term) ||
        r.customer_phone.replace(/[^0-9]/g, "").includes(term.replace(/[^0-9]/g, "")) ||
        r.code.toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <div>
      {/* 필터 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={
                "h-8 px-3 text-sm transition-colors " +
                (status === f.key
                  ? "bg-ink text-white"
                  : "border border-line text-ink/70 hover:bg-surface")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·전화·예약번호 검색"
          className="h-8 w-56 border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
        />
      </div>

      {error && <p className="mt-4 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {/* 목록 */}
      <div className="mt-4 overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-soft text-left text-xs text-muted">
              <th className="px-3 py-2.5 font-medium">일시</th>
              <th className="px-3 py-2.5 font-medium">공간</th>
              <th className="px-3 py-2.5 font-medium">인원</th>
              <th className="px-3 py-2.5 font-medium">예약자</th>
              <th className="px-3 py-2.5 font-medium">연락처</th>
              <th className="px-3 py-2.5 font-medium text-right">금액</th>
              <th className="px-3 py-2.5 font-medium">상태</th>
              <th className="px-3 py-2.5 font-medium">예약번호</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted">
                  불러오는 중…
                </td>
              </tr>
            )}
            {rows !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted">
                  예약이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="cursor-pointer border-b border-line/60 last:border-b-0 hover:bg-surface-soft"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-ink">
                  {fmtKst(r.starts_at)}–{hm(r.ends_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink/80">
                  {r.units?.name ?? "-"}
                </td>
                <td className="px-3 py-2.5 text-ink/80">{r.headcount}명</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink">
                  {r.customer_name}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink/80">
                  {r.customer_phone}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink">
                  {formatWon(r.total_amount)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={"inline-block px-2 py-0.5 text-xs " + (STATUS_STYLE[r.status] ?? "")}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted">
                  {r.code}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <DetailModal
          r={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function DetailModal({
  r,
  onClose,
  onChanged,
}: {
  r: AdminReservation;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const pay = r.payments?.find((p) => p.status === "approved") ?? r.payments?.[0];
  const isPaid = r.status === "confirmed" && !!pay?.payment_key;
  const canCancel = r.status === "pending" || r.status === "confirmed";

  async function doCancel() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (isPaid) {
        const res = await refundReservation(r.id, reason || "관리자 취소");
        if (!res.ok) throw new Error(res.message ?? "환불 실패");
        setMsg(res.message ?? "처리되었습니다.");
      } else {
        await cancelUnpaidReservation(r.id, reason || "관리자 취소");
        setMsg("예약을 취소했습니다.");
      }
      setTimeout(onChanged, 900);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-muted">{r.code}</p>
            <h2 className="mt-1 text-lg font-bold text-ink">{r.units?.name}</h2>
          </div>
          <span className={"px-2 py-0.5 text-xs " + (STATUS_STYLE[r.status] ?? "")}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <Row label="일시" value={`${fmtKst(r.starts_at)}–${hm(r.ends_at)}`} />
          <Row label="인원" value={`${r.headcount}명`} />
          <Row label="예약자" value={r.customer_name} />
          <Row label="연락처" value={r.customer_phone} />
          {r.memo && <Row label="요청사항" value={r.memo} />}
          <Row label="기본요금" value={formatWon(r.base_amount)} />
          {r.extra_person_amount > 0 && (
            <Row label="추가인원" value={formatWon(r.extra_person_amount)} />
          )}
          <Row label="청소보증금" value={formatWon(r.deposit_amount)} />
          <Row label="총액" value={formatWon(r.total_amount)} strong />
          {pay && (
            <Row
              label="결제"
              value={`${pay.method ?? "-"} · ${pay.status}${pay.cancelled_amount ? ` (취소 ${formatWon(pay.cancelled_amount)})` : ""}`}
            />
          )}
          {r.cancel_reason && <Row label="취소사유" value={r.cancel_reason} />}
        </dl>

        {pay?.receipt_url && (
          <a
            href={pay.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-ink underline underline-offset-2"
          >
            영수증 보기 →
          </a>
        )}

        {msg && <p className="mt-4 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="mt-4 bg-red-50 p-3 text-sm text-red-600">{err}</p>}

        {canCancel && !msg && (
          <div className="mt-5 border-t border-line pt-5">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="취소 사유 (선택)"
              className="h-9 w-full border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
            />
            <button
              onClick={doCancel}
              disabled={busy}
              className="mt-3 h-11 w-full bg-red-600 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy
                ? "처리 중…"
                : isPaid
                  ? `전액 환불 및 예약 취소 (${formatWon(r.total_amount)})`
                  : "예약 취소"}
            </button>
            {isPaid && (
              <p className="mt-2 text-center text-xs text-muted">
                토스 결제가 취소되고 시간대가 다시 열립니다.
              </p>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 h-10 w-full border border-line text-sm text-ink/70 transition-colors hover:bg-surface-soft"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={"text-right " + (strong ? "font-bold text-ink" : "text-ink/90")}>
        {value}
      </dd>
    </div>
  );
}
