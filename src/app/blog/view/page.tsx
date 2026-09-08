import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostViewClient } from "@/components/blog/post-view-client";

export const metadata: Metadata = {
  title: "블로그 | 서초 시그니처 파티룸",
  // 클라이언트 폴백 페이지 자체는 색인 제외 (정본은 /blog/{slug}/)
  robots: { index: false, follow: true },
};

export default function BlogViewPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-5 py-16 lg:px-8">
        <PostViewClient />
      </main>
      <SiteFooter />
    </>
  );
}
