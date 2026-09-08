"use client";

import { useEffect, useState } from "react";
import { listPublishedPosts, type BlogPost } from "@/lib/blog";

/**
 * 블로그 목록.
 * - 빌드 시점 글(initial)을 먼저 보여줘 SEO/초기렌더를 확보하고,
 * - 마운트 후 라이브 조회로 새 글까지 반영한다. (재배포 없이 목록 갱신)
 *
 * 링크 규칙:
 *  - 빌드에 포함된 글 → 정적 상세 `/blog/{slug}/` (깨끗한 URL·SEO)
 *  - 빌드 이후 새 글  → 클라이언트 폴백 `/blog/view/?id=` (재배포 전에도 열람)
 */
export function BlogListClient({ initial }: { initial: BlogPost[] }) {
  const [posts, setPosts] = useState<BlogPost[]>(initial);
  // 정적 상세페이지는 slug로 생성되므로, slug 기준으로 존재 여부 판단
  const [builtSlugs] = useState(() => new Set(initial.map((p) => p.slug)));

  useEffect(() => {
    listPublishedPosts()
      .then(setPosts)
      .catch(() => {
        /* 실패 시 빌드 시점 목록 유지 */
      });
  }, []);

  if (posts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-12 text-center text-sm text-muted">
        아직 등록된 글이 없습니다.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => {
        const href = builtSlugs.has(p.slug)
          ? `/blog/${encodeURIComponent(p.slug)}/`
          : `/blog/view/?id=${p.id}`;
        return (
          <a
            key={p.id}
            href={href}
            className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
          >
            <div className="aspect-[3/2] w-full overflow-hidden bg-surface-soft">
              {p.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="text-base font-semibold text-ink group-hover:underline">
                {p.title}
              </h2>
              {p.excerpt && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                  {p.excerpt}
                </p>
              )}
              <span className="mt-auto pt-3 text-xs text-muted">
                {fmtDate(p.published_at ?? p.created_at)}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
