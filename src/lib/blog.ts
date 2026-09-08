/**
 * 블로그 공개 조회 (손님용).
 *
 * 본문은 블록 배열: 이미지 블록과 텍스트 블록을 순서대로 쌓아
 * "이미지 + 텍스트 + 이미지 + 텍스트" 형태로 렌더링한다.
 * RLS 때문에 anon 클라이언트로는 status='published' 글만 읽힌다.
 */
import { supabase } from "./supabase";

export type BlockText = { type: "text"; content: string };
export type BlockImage = { type: "image"; url: string; caption?: string };
export type PostBlock = BlockText | BlockImage;

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  body: PostBlock[];
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const LIST_SELECT =
  "id,slug,title,excerpt,cover_url,published_at,created_at,updated_at";
const FULL_SELECT = LIST_SELECT + ",body,status";

/** 발행된 글 목록 (최신순). */
export async function listPublishedPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeMany(data);
}

/** slug로 발행된 글 1개. 없으면 null. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeOne(data as unknown as Record<string, unknown>) : null;
}

/** id로 발행된 글 1개 — 재배포 전 새 글을 바로 읽는 클라이언트 폴백용. */
export async function getPostById(id: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeOne(data as unknown as Record<string, unknown>) : null;
}

function normalizeOne(row: Record<string, unknown>): BlogPost {
  const body = row.body;
  return {
    ...(row as unknown as BlogPost),
    body: Array.isArray(body) ? (body as PostBlock[]) : [],
  };
}

function normalizeMany(rows: unknown): BlogPost[] {
  return ((rows ?? []) as Record<string, unknown>[]).map(normalizeOne);
}
