"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createBlock,
  listBlocks,
  listReservations,
  listResources,
  removeBlock,
  type AdminReservation,
  type AdminResource,
} from "@/lib/admin";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

/** KST 기준 'YYYY-MM-DD' */
function kstDayKey(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}
function hm(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}
/** KST 날짜+시각 → UTC ISO */
function kstToIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00+09:00`).toISOString();
}

type BlockRow = Awaited<ReturnType<typeof listBlocks>>[number];

export function CalendarView() {
  const [anchor, setAnchor] = useState(() => {
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    return { y: now.getUTCFullYear(), m: now.getUTCMonth() }; // m: 0-11
  });
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const monthStart = useMemo(
    () => new Date(Date.UTC(anchor.y, anchor.m, 1)),
    [anchor],
  );
  const monthEnd = useMemo(
    () => new Date(Date.UTC(anchor.y, anchor.m + 1, 1)),
    [anchor],
  );

  async function reload() {
    setErr("");
    try {
      const [res, blk] = await Promise.all([
        listReservations({ status: "all" }),
        listBlocks(monthStart.toISOString(), monthEnd.toISOString()),
      ]);
      // 이번 달 + 취소 아닌 예약만
      setReservations(
        res.filter(
          (r) =>
            r.status !== "cancelled" &&
            new Date(r.starts_at) < monthEnd &&
            new Date(r.ends_at) > monthStart,
        ),
      );
      setBlocks(blk);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오기 실패");
    }
  }

  useEffect(() => {
    listResources().then(setResources).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  // 날짜별 그룹
  const byDay = useMemo(() => {
    const map: Record<string, { res: AdminReservation[]; blk: BlockRow[] }> = {};
    for (const r of reservations) {
      const key = kstDayKey(r.starts_at);
      (map[key] ??= { res: [], blk: [] }).res.push(r);
    }
    for (const b of blocks) {
      const key = kstDayKey(b.from);
      (map[key] ??= { res: [], blk: [] }).blk.push(b);
    }
    return map;
  }, [reservations, blocks]);

  // 달력 셀 (앞 공백 포함)
  const cells = useMemo(() => {
    const firstWd = new Date(Date.UTC(anchor.y, anchor.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(anchor.y, anchor.m + 1, 0)).getUTCDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < firstWd; i++) arr.push(null);
    for (let d = 1; d <= days; d++) {
      arr.push(
        `${anchor.y}-${String(anchor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
    return arr;
  }, [anchor]);

  function shift(delta: number) {
    setSelectedDay(null);
    setAnchor((a) => {
      const m = a.m + delta;
      return { y: a.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  const todayKey = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {/* 월 네비 */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {anchor.m + 1}월
            </h2>
            <span className="text-sm text-muted">{anchor.y}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setSelectedDay(null); const n = new Date(Date.now()+9*3600*1000); setAnchor({y:n.getUTCFullYear(),m:n.getUTCMonth()}); }}
              className="h-8 rounded-md border border-line px-3 text-xs font-medium text-ink/70 transition-colors hover:bg-surface-soft"
            >
              오늘
            </button>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center text-ink/60 transition-colors hover:bg-surface-soft">‹</button>
              <button onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center border-l border-line text-ink/60 transition-colors hover:bg-surface-soft">›</button>
            </div>
          </div>
        </div>

        {err && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600">{err}</p>}

        {/* 달력 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line">
            {WD.map((w, i) => (
              <div
                key={w}
                className={
                  "py-2 text-center text-[11px] font-semibold tracking-wide " +
                  (i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted")
                }
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const info = day ? byDay[day] : undefined;
              const dnum = day ? Number(day.slice(8)) : 0;
              const wd = i % 7;
              const isToday = day === todayKey;
              const isSel = day === selectedDay;
              const total = (info?.res.length ?? 0) + (info?.blk.length ?? 0);
              return (
                <button
                  key={i}
                  disabled={!day}
                  onClick={() => day && setSelectedDay(day)}
                  className={
                    "relative flex min-h-24 flex-col gap-1 border-b border-r border-line/70 p-1.5 text-left align-top transition-colors [&:nth-child(7n)]:border-r-0 " +
                    (!day
                      ? "bg-surface-soft/30 "
                      : isSel
                        ? "bg-ink/[0.04] ring-1 ring-inset ring-ink "
                        : "hover:bg-surface-soft ")
                  }
                >
                  {day && (
                    <>
                      <span
                        className={
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs " +
                          (isToday
                            ? "bg-ink font-semibold text-white "
                            : wd === 0
                              ? "text-red-500 "
                              : wd === 6
                                ? "text-blue-500 "
                                : "text-ink/70 ")
                        }
                      >
                        {dnum}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {info?.res.slice(0, 3).map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-1 truncate rounded bg-emerald-50 px-1 py-0.5 text-[10px] leading-tight text-emerald-700"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span className="truncate">
                              {hm(r.starts_at)} {r.units?.name?.replace(/^\dF /, "") ?? ""}
                            </span>
                          </div>
                        ))}
                        {info?.blk.slice(0, 3 - Math.min(info?.res.length ?? 0, 3)).map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center gap-1 truncate rounded bg-red-50 px-1 py-0.5 text-[10px] leading-tight text-red-600"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                            <span className="truncate">차단 {b.resource_code}</span>
                          </div>
                        ))}
                        {total > 3 && (
                          <span className="px-1 text-[10px] font-medium text-muted">
                            +{total - 3}건 더
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 선택 날짜 상세 */}
        {selectedDay && (
          <DaySummary day={selectedDay} info={byDay[selectedDay]} onUnblock={async (id) => { await removeBlock(id); reload(); }} />
        )}
      </div>

      {/* 차단 폼 */}
      <BlockForm resources={resources} onBlocked={reload} />
    </div>
  );
}

function DaySummary({
  day,
  info,
  onUnblock,
}: {
  day: string;
  info?: { res: AdminReservation[]; blk: BlockRow[] };
  onUnblock: (id: string) => void;
}) {
  const k = new Date(`${day}T00:00:00+09:00`);
  const label = `${day.slice(5).replace("-", "/")} (${WD[new Date(k.getTime()+9*3600*1000).getUTCDay()]})`;
  const empty = !info || (info.res.length === 0 && info.blk.length === 0);
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-ink">{label} 현황</h3>
      {empty && <p className="mt-3 text-sm text-muted">예약·차단이 없습니다.</p>}
      <ul className="mt-3 divide-y divide-line/60">
        {info?.res.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
            <span className="flex items-center gap-2 text-ink">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              {hm(r.starts_at)}–{hm(r.ends_at)} · {r.units?.name} · {r.headcount}명
            </span>
            <span className="text-xs text-muted">{r.customer_name}</span>
          </li>
        ))}
        {info?.blk.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
            <span className="flex items-center gap-2 text-red-600">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              {hm(b.from)}–{hm(b.to)} · 차단({b.resource_code}){b.reason ? ` · ${b.reason}` : ""}
            </span>
            <button
              onClick={() => onUnblock(b.id)}
              className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-ink/70 transition-colors hover:bg-surface-soft"
            >
              해제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlockForm({
  resources,
  onBlocked,
}: {
  resources: AdminResource[];
  onBlocked: () => void;
}) {
  // 공간별 그룹 + "전체" 프리셋
  const options = useMemo(() => {
    const bySpace: Record<string, AdminResource[]> = {};
    for (const r of resources) (bySpace[r.space_id] ??= []).push(r);
    const opts: { label: string; ids: string[] }[] = [];
    for (const list of Object.values(bySpace)) {
      const floor = list[0]?.code.match(/^\d+f/i)?.[0]?.toUpperCase() ?? "";
      if (list.length > 1) opts.push({ label: `${floor} 전체`, ids: list.map((r) => r.id) });
      for (const r of list) opts.push({ label: `${floor} ${r.name}`, ids: [r.id] });
    }
    return opts;
  }, [resources]);

  const [optIdx, setOptIdx] = useState(0);
  const [day, setDay] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("23:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    setMsg("");
    if (!day) return setErr("날짜를 선택해주세요.");
    if (end <= start) return setErr("종료 시각이 시작보다 빨라요.");
    setBusy(true);
    try {
      await createBlock(
        options[optIdx].ids,
        kstToIso(day, start),
        kstToIso(day, end),
        reason,
      );
      setMsg("차단되었습니다.");
      setReason("");
      onBlocked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "차단 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-fit rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-ink">시간대 차단</h3>
      <p className="mt-1 text-xs text-muted">정기휴무·정비 등으로 예약을 막습니다.</p>

      <label className="mt-4 block text-sm">
        <span className="text-ink/80">공간</span>
        <select
          value={optIdx}
          onChange={(e) => setOptIdx(Number(e.target.value))}
          className="mt-1 h-9 w-full border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
        >
          {options.map((o, i) => (
            <option key={i} value={i}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm">
        <span className="text-ink/80">날짜</span>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-1 h-9 w-full border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <label className="block flex-1 text-sm">
          <span className="text-ink/80">시작</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 h-9 w-full border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
          />
        </label>
        <label className="block flex-1 text-sm">
          <span className="text-ink/80">종료</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 h-9 w-full border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="text-ink/80">사유 (선택)</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="정기휴무, 내부 정비 등"
          className="mt-1 h-9 w-full border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
        />
      </label>

      {msg && <p className="mt-3 bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 bg-red-50 p-2 text-sm text-red-600">{err}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-4 h-10 w-full bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "차단 중…" : "차단하기"}
      </button>
    </div>
  );
}

