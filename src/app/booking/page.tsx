import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = {
  title: "예약하기 | 서초 시그니처 파티룸",
  description:
    "서초 시그니처 파티룸 온라인 예약 — 공간·날짜·시간대를 선택하고 바로 예약하세요.",
};

export default function BookingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-(--container-page) px-5 py-14 lg:px-8 md:py-20">
          <header className="mb-12">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              예약
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              공간을 예약하세요
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              원하는 공간과 시간을 선택하면 금액이 바로 계산됩니다.
            </p>
          </header>

          <BookingForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
