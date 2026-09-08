import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"),
  title: "서초 시그니처 파티룸 | 모임 목적에 맞는 프리미엄 공간",
  description:
    "브런치부터 세미나, 루프탑 파티까지. 양재시민의숲역 인근 프리미엄 파티룸 — 시그니처 스위트 · 컨벤션 · 루프탑.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
