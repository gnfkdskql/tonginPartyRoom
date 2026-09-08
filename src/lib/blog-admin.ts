/**
 * 블로그 관리 (사장님용) — 작성·수정·삭제·이미지 업로드.
 * 세션 유지 클라이언트(adminClient)를 재사용하므로 로그인해야 동작한다.
 */
import { adminClient } from "./admin";
import type { BlogPost, PostBlock } from "./blog";

const LIST_SELECT =
  "id,slug,title,excerpt,cover_url,status,published_at,created_at,updated_at";
const FULL_SELECT = LIST_SELECT + ",body";

/** 관리자 목록 — draft 포함 전체. */
export async function adminListPosts(): Promise<BlogPost[]> {
  const { data, error } = await adminClient
    .from("blog_posts")
    .select(FULL_SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as BlogPost),
    body: Array.isArray(r.body) ? (r.body as PostBlock[]) : [],
  }));
}

export type PostInput = {
  title: string;
  excerpt: string;
  cover_url: string | null;
  body: PostBlock[];
  status: "draft" | "published";
};

// 날짜+번호 형태의 안전한 slug 자동 생성 (예: 2026-08-24-1). KST 기준.
async function nextDateSlug(): Promise<string> {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const prefix = `${kst.getUTCFullYear()}-${String(
    kst.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
  const { data } = await adminClient
    .from("blog_posts")
    .select("slug")
    .like("slug", `${prefix}-%`);
  const nums = (data ?? [])
    .map((r) =>
      parseInt(String((r as { slug: string }).slug).slice(prefix.length + 1), 10),
    )
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${next}`;
}

/** 새 글 저장. status가 published면 published_at을 지금으로. */
export async function createPost(input: PostInput): Promise<BlogPost> {
  const published_at =
    input.status === "published" ? new Date().toISOString() : null;
  // slug는 자동 생성. 동시 작성 등으로 충돌하면 번호를 다시 매겨 재시도.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await nextDateSlug();
    const { data, error } = await adminClient
      .from("blog_posts")
      .insert({ ...input, slug, published_at })
      .select(FULL_SELECT)
      .single();
    if (!error) return data as unknown as BlogPost;
    const dup =
      error.message.includes("blog_posts_slug_key") ||
      error.message.toLowerCase().includes("duplicate");
    if (!dup) throw new Error(error.message);
  }
  throw new Error("글 주소 생성에 실패했습니다. 다시 시도해 주세요.");
}

/** 기존 글 수정. draft→published 승격 시 published_at 채움. */
export async function updatePost(
  id: string,
  input: PostInput,
  wasPublished: boolean,
): Promise<BlogPost> {
  const row: Record<string, unknown> = { ...input };
  if (input.status === "published" && !wasPublished) {
    row.published_at = new Date().toISOString();
  }
  const { data, error } = await adminClient
    .from("blog_posts")
    .update(row)
    .eq("id", id)
    .select(FULL_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as BlogPost;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await adminClient.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** 목록에서 발행/숨김 빠른 전환. draft→published 승격 시 published_at 채움. */
export async function setPostStatus(
  id: string,
  status: "draft" | "published",
  wasPublished: boolean,
): Promise<void> {
  const row: Record<string, unknown> = { status };
  if (status === "published" && !wasPublished) {
    row.published_at = new Date().toISOString();
  }
  const { error } = await adminClient
    .from("blog_posts")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** 이미지 업로드 → 공개 URL 반환. */
export async function uploadBlogImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  // 파일명 충돌 방지: 시간+랜덤. (Date.now/Math.random은 브라우저라 정상)
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await adminClient.storage
    .from("blog")
    .upload(key, file, { cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = adminClient.storage.from("blog").getPublicUrl(key);
  return data.publicUrl;
}


