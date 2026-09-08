"use client";

import { useEffect, useRef, useState } from "react";
import type { BlogPost, PostBlock } from "@/lib/blog";
import {
  adminListPosts,
  createPost,
  updatePost,
  deletePost,
  setPostStatus,
  uploadBlogImage,
  type PostInput,
} from "@/lib/blog-admin";

type Mode = { kind: "list" } | { kind: "edit"; post: BlogPost | null };

export function BlogView() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  if (mode.kind === "edit") {
    return (
      <Editor
        post={mode.post}
        onDone={() => setMode({ kind: "list" })}
      />
    );
  }
  return <PostList onNew={() => setMode({ kind: "edit", post: null })} onEdit={(p) => setMode({ kind: "edit", post: p })} />;
}

// ── 목록 ────────────────────────────────────────────────────────────────
function PostList({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (p: BlogPost) => void;
}) {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    adminListPosts()
      .then(setPosts)
      .catch((e) =>
        setErr(e instanceof Error ? e.message : "불러오기 실패"),
      );
  }, []);

  async function refresh() {
    try {
      setPosts(await adminListPosts());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오기 실패");
    }
  }

  async function togglePublish(p: BlogPost) {
    setBusyId(p.id);
    setErr("");
    try {
      await setPostStatus(
        p.id,
        p.status === "published" ? "draft" : "published",
        p.status === "published",
      );
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "변경 실패");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: BlogPost) {
    if (
      !window.confirm(
        `"${p.title || "제목 없음"}" 글을 삭제할까요? 되돌릴 수 없습니다.`,
      )
    )
      return;
    setBusyId(p.id);
    setErr("");
    try {
      await deletePost(p.id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">블로그 글</h2>
        <button
          onClick={onNew}
          className="h-9 bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + 새 글 쓰기
        </button>
      </div>

      {err && <p className="mb-4 bg-red-50 p-3 text-sm text-red-600">{err}</p>}
      {posts === null && <p className="text-sm text-muted">불러오는 중…</p>}
      {posts?.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          아직 글이 없습니다. “새 글 쓰기”로 첫 글을 작성해 보세요.
        </p>
      )}

      <div className="space-y-2">
        {posts?.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3"
          >
            {/* 클릭 영역: 수정 열기 */}
            <button
              onClick={() => onEdit(p)}
              className="flex min-w-0 flex-1 items-center gap-4 text-left"
            >
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded bg-surface-soft" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {p.title || "(제목 없음)"}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {p.excerpt || "요약 없음"}
                </p>
                <span className="mt-0.5 block text-[11px] text-muted/70">
                  {fmtDate(p.published_at ?? p.updated_at)}
                </span>
              </div>
            </button>

            {/* 행 액션: 보기 · 발행/숨김 · 수정 · 삭제 */}
            <div className="flex shrink-0 items-center gap-1">
              {p.status === "published" && (
                <a
                  href={`/blog/${p.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2.5 py-1.5 text-xs text-ink/70 transition-colors hover:bg-surface-soft"
                >
                  보기
                </a>
              )}
              <button
                disabled={busyId === p.id}
                onClick={() => togglePublish(p)}
                className="rounded border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-surface-soft disabled:opacity-40"
              >
                {p.status === "published" ? "숨기기" : "발행"}
              </button>
              <button
                onClick={() => onEdit(p)}
                className="rounded px-2.5 py-1.5 text-xs text-ink/70 transition-colors hover:bg-surface-soft"
              >
                수정
              </button>
              <button
                disabled={busyId === p.id}
                onClick={() => remove(p)}
                className="rounded px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium " +
        (published
          ? "bg-emerald-50 text-emerald-700"
          : "bg-surface-soft text-muted")
      }
    >
      {published ? "발행됨" : "임시저장"}
    </span>
  );
}

// ── 편집기 ──────────────────────────────────────────────────────────────
function Editor({
  post,
  onDone,
}: {
  post: BlogPost | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [cover, setCover] = useState<string | null>(post?.cover_url ?? null);
  const [blocks, setBlocks] = useState<PostBlock[]>(post?.body ?? []);
  // 발행 상태는 저장 버튼(발행/임시저장)이 직접 정하므로, 배지는 초기값만 표시
  const [status] = useState<"draft" | "published">(post?.status ?? "draft");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(nextStatus: "draft" | "published") {
    setErr("");
    if (!title.trim()) {
      setErr("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const input: PostInput = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        cover_url: cover,
        body: blocks,
        status: nextStatus,
      };
      if (post) {
        await updatePost(post.id, input, post.status === "published");
      } else {
        await createPost(input);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
      setBusy(false);
    }
  }

  async function remove() {
    if (!post) return;
    if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      await deletePost(post.id);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onDone}
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← 목록으로
        </button>
        <StatusBadge status={status} />
      </div>

      {err && <p className="mb-4 bg-red-50 p-3 text-sm text-red-600">{err}</p>}

      {/* 제목 */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="글 제목"
        className="w-full border-0 border-b border-line bg-transparent pb-2 text-2xl font-bold text-ink outline-none placeholder:text-muted/50 focus:border-ink"
      />
      {post && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            이 글 주소:{" "}
            <span className="text-ink/70">/blog/{post.slug}/</span>
          </span>
          {post.status === "published" && (
            <a
              href={`/blog/${post.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline underline-offset-2"
            >
              사이트에서 보기 ↗
            </a>
          )}
        </p>
      )}

      {/* 요약 */}
      <label className="mt-5 block text-sm">
        <span className="text-ink/80">요약 (목록·검색에 노출되는 한 줄 소개)</span>
        <input
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="예: 루프탑 파티 200% 즐기는 5가지 팁"
          className="mt-1 w-full border border-line bg-surface p-2 text-sm text-ink outline-none focus:border-ink"
        />
      </label>

      {/* 대표 이미지 */}
      <div className="mt-5">
        <span className="text-sm text-ink/80">대표 이미지 (목록 썸네일)</span>
        <div className="mt-2">
          {cover ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                className="h-40 rounded-lg object-cover"
              />
              <button
                onClick={() => setCover(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
              >
                제거
              </button>
            </div>
          ) : (
            <ImageUpload onDone={setCover} label="대표 이미지 업로드" />
          )}
        </div>
      </div>

      {/* 본문 블록 */}
      <div className="mt-8">
        <span className="text-sm font-medium text-ink">본문</span>
        <p className="mt-1 text-xs text-muted">
          텍스트와 이미지 블록을 순서대로 쌓아 글을 구성합니다.
        </p>

        <div className="mt-3 space-y-3">
          {blocks.map((b, i) => (
            <BlockEditor
              key={i}
              block={b}
              first={i === 0}
              last={i === blocks.length - 1}
              onChange={(nb) =>
                setBlocks((bs) => bs.map((x, j) => (j === i ? nb : x)))
              }
              onMove={(dir) =>
                setBlocks((bs) => move(bs, i, dir))
              }
              onDelete={() =>
                setBlocks((bs) => bs.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() =>
              setBlocks((bs) => [...bs, { type: "text", content: "" }])
            }
            className="h-9 rounded-lg border border-line px-4 text-sm text-ink transition-colors hover:bg-surface-soft"
          >
            + 텍스트 블록
          </button>
          <AddImageButton
            onDone={(url) =>
              setBlocks((bs) => [...bs, { type: "image", url, caption: "" }])
            }
          />
        </div>
      </div>

      {/* 저장 바 */}
      <div className="sticky bottom-0 mt-8 flex items-center gap-2 border-t border-line bg-surface-soft py-4">
        <button
          disabled={busy}
          onClick={() => save("published")}
          className="h-11 flex-1 bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "저장 중…" : "발행하기"}
        </button>
        <button
          disabled={busy}
          onClick={() => save("draft")}
          className="h-11 border border-line px-5 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-40"
        >
          임시저장
        </button>
        {post && (
          <button
            disabled={busy}
            onClick={remove}
            className="h-11 px-4 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

// ── 블록 편집 ───────────────────────────────────────────────────────────
function BlockEditor({
  block,
  first,
  last,
  onChange,
  onMove,
  onDelete,
}: {
  block: PostBlock;
  first: boolean;
  last: boolean;
  onChange: (b: PostBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">
          {block.type === "text" ? "텍스트" : "이미지"}
        </span>
        <div className="flex items-center gap-1">
          <IconBtn disabled={first} onClick={() => onMove(-1)} title="위로">
            ↑
          </IconBtn>
          <IconBtn disabled={last} onClick={() => onMove(1)} title="아래로">
            ↓
          </IconBtn>
          <IconBtn onClick={onDelete} title="삭제" danger>
            ✕
          </IconBtn>
        </div>
      </div>

      {block.type === "text" ? (
        <textarea
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
          placeholder="문단 내용을 입력하세요…"
          rows={4}
          className="w-full resize-y border border-line bg-surface p-2.5 text-sm leading-relaxed text-ink outline-none focus:border-ink"
        />
      ) : (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt=""
            className="max-h-72 w-full rounded object-contain"
          />
          <input
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="이미지 설명 (선택)"
            className="mt-2 w-full border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-ink"
          />
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "flex h-7 w-7 items-center justify-center rounded text-sm transition-colors disabled:opacity-25 " +
        (danger
          ? "text-red-500 hover:bg-red-50"
          : "text-muted hover:bg-surface-soft hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

// ── 이미지 업로드 위젯 ──────────────────────────────────────────────────
function ImageUpload({
  onDone,
  label,
}: {
  onDone: (url: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const url = await uploadBlogImage(file);
      onDone(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-line bg-surface text-sm text-muted transition-colors hover:bg-surface-soft disabled:opacity-40"
      >
        {busy ? "업로드 중…" : `📷 ${label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function AddImageButton({ onDone }: { onDone: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBlogImage(file);
      onDone(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="h-9 rounded-lg border border-line px-4 text-sm text-ink transition-colors hover:bg-surface-soft disabled:opacity-40"
      >
        {busy ? "업로드 중…" : "+ 이미지 블록"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
    </>
  );
}

// ── 유틸 ────────────────────────────────────────────────────────────────
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
