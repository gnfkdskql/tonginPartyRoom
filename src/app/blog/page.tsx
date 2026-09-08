import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogListClient } from "@/components/blog/blog-list-client";
import { fetchPublishedPosts } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "블로그 | 서초 시그니처 파티룸",
  description:
    "서초 시그니처 파티룸의 공간 이용 팁, 파티·모임 아이디어, 이벤트 소식을 전합니다.",
  alternates: { canonical: "/blog/" },
};

export default async function BlogPage() {
  const posts = await fetchPublishedPosts();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-5 py-16 lg:px-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">블로그</h1>
          <p className="mt-2 text-sm text-muted">
            공간 이용 팁부터 파티·모임 아이디어까지.
          </p>
        </header>
        <BlogListClient initial={posts} />
      </main>
      <SiteFooter />
    </>
  );
}
