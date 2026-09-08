import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostBody } from "@/components/blog/post-body";
import { fetchPublishedPosts, fetchPostBySlug } from "@/lib/supabase-server";

// 빌드 시점에 알려진 slug만 정적 생성. 그 외(새 글)는 목록이 /blog/view 로 보냄.
export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await fetchPublishedPosts();
  // output: export 는 빈 배열을 "함수 없음"으로 오인해 빌드가 깨진다.
  // 발행 글이 하나도 없을 때는 버려지는 placeholder 하나만 생성한다.
  // (이 slug는 어디에도 링크·sitemap 되지 않고 상세에서 notFound 처리됨)
  if (posts.length === 0) return [{ slug: "__none__" }];
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPostBySlug(decodeURIComponent(slug));
  if (!post) return { title: "블로그 | 서초 시그니처 파티룸" };
  const desc =
    post.excerpt ||
    "서초 시그니처 파티룸 블로그 — 공간 이용 팁과 파티·모임 아이디어.";
  return {
    title: `${post.title} | 서초 시그니처 파티룸`,
    description: desc,
    alternates: { canonical: `/blog/${slug}/` },
    openGraph: {
      title: post.title,
      description: desc,
      type: "article",
      images: post.cover_url ? [{ url: post.cover_url }] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPostBySlug(decodeURIComponent(slug));
  if (!post) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 lg:px-8">
        <Link
          href="/blog/"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← 블로그
        </Link>
        <article className="mt-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink">
            {post.title}
          </h1>
          <time className="mt-3 block text-sm text-muted">
            {fmtDate(post.published_at ?? post.created_at)}
          </time>
          {post.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_url}
              alt=""
              className="mt-6 w-full rounded-xl object-cover"
            />
          )}
          <div className="mt-8">
            <PostBody blocks={post.body} />
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
