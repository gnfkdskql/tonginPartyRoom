"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  adminSignIn,
  adminSignOut,
  getAdminSession,
  onAdminAuthChange,
} from "@/lib/admin";
import { ReservationsView } from "./reservations-view";
import { CalendarView } from "./calendar-view";
import { BlogView } from "./blog-view";

export function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getAdminSession().then(setSession);
    return onAdminAuthChange(setSession);
  }, []);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }
  if (!session) return <LoginForm />;
  return <Dashboard email={session.user.email ?? ""} />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await adminSignIn(email.trim(), pw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-soft px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-line bg-surface p-8"
      >
        <h1 className="text-lg font-bold tracking-tight text-ink">
          관리자 로그인
        </h1>
        <p className="mt-1 text-xs text-muted">서초 시그니처 파티룸</p>

        <label className="mt-6 block text-sm">
          <span className="text-ink/80">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full border border-line bg-surface p-2.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-ink/80">비밀번호</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full border border-line bg-surface p-2.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>

        {err && <p className="mt-4 bg-red-50 p-3 text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-11 w-full bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}

type Tab = "reservations" | "calendar" | "blog";

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("reservations");

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-tight text-ink">
              시그니처 관리자
            </span>
            <nav className="flex gap-1">
              <TabButton active={tab === "reservations"} onClick={() => setTab("reservations")}>
                예약 목록
              </TabButton>
              <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
                달력·차단
              </TabButton>
              <TabButton active={tab === "blog"} onClick={() => setTab("blog")}>
                블로그
              </TabButton>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            <button
              onClick={() => adminSignOut()}
              className="h-8 border border-line px-3 text-xs text-ink/80 transition-colors hover:bg-surface-soft"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "reservations" ? (
          <ReservationsView />
        ) : tab === "calendar" ? (
          <CalendarView />
        ) : (
          <BlogView />
        )}
      </main>
    </div>
  );
}

function TabButton({
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
      onClick={onClick}
      className={
        "h-8 px-3 text-sm font-medium transition-colors " +
        (active
          ? "border-b-2 border-ink text-ink"
          : "text-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
