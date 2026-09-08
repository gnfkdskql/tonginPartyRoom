import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PaymentSuccess } from "@/components/booking/payment-result";

export const metadata: Metadata = {
  title: "결제 완료 | 서초 시그니처 파티룸",
  robots: { index: false, follow: false },
};

export default function BookingSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-(--container-page) px-5 py-16 lg:px-8">
        <PaymentSuccess />
      </main>
      <SiteFooter />
    </>
  );
}
