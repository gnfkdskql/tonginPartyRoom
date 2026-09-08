"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPostById, type BlogPost } from "@/lib/blog";
import { PostBody } from "./post-body";

/**
 * 클라이언트 폴백 뷰어 — `/blog/view/?id=`.
 * 빌드 이후 작성돼 아직 정적 상세페이지가 없는 새 글도 여기서 바로 읽힌다.
 * 정적 상세(`/blog/{slug}/`)가 생기면 canonical로 검색을 그쪽에 몰아준다.
 */
export function PostViewClient() {
  const [state, setState] = useState<
    | { s: "loading" }
    | { s: "ok"; post: BlogPost }
    | { s: "missing" }
  >({ s: "loading" });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    const load = id ? getPostById(id) : Promise.resolve(null);
    load
      .then((post) =>
        setState(post ? { s: "ok", post } : { s: "missing" }),
      )
      .catch(() => setState({ s: "missing" }));
  }, []);

  // 정적 상세페이지가 존재하면 검색엔진에 그쪽을 정본으로 알림
  useEffect(() => {
    if (state.s !== "ok") return;
    const link = document.createElement("link");
    link.rel = "canonical";
    link.href = `${window.location.origin}/blog/${encodeURIComponent(
      state.post.slug,
    )}/`;
    document.head.appendChild(link);
    document.title = `${state.post.title} | 서초 시그니처 파티룸`;
    return () => {
      document.head.removeChild(link);
    };
  }, [state]);

  if (state.s === "loading") {
    return <p className="py-20 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (state.s === "missing") {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted">글을 찾을 수 없습니다.</p>
        <Link
          href="/blog/"
          className="mt-4 inline-block text-sm text-ink underline underline-offset-4"
        >
          블로그 목록으로
        </Link>
      </div>
    );
  }

  const post = state.post;
  return (
    <div className="mx-auto max-w-2xl">
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
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
