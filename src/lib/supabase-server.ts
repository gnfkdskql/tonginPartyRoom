/**
 * 빌드 시점(서버 컴포넌트)에서 Supabase를 읽기 위한 헬퍼.
 *
 * supabase-js는 realtime이 native WebSocket을 요구해 Node 20 빌드에서 죽는다.
 * 여기서는 PostgREST를 fetch로 직접 호출해 그 문제를 피한다.
 * 읽는 값은 요금표처럼 공개된 정보뿐이라 anon key로 충분하다.
 */

import type {
  ExtraPersonRule,
  PriceRule,
  Space,
  Unit,
} from "./supabase";
import type { BlogPost, PostBlock } from "./blog";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rest<T>(path: string): Promise<T[]> {
  if (!URL || !KEY) throw new Error("Supabase 환경변수가 없습니다.");
  // 정적 export이므로 빌드 시점에 값을 구워 넣는다.
  // (no-store를 쓰면 동적 렌더링으로 간주되어 export가 실패한다)
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    cache: "force-cache",
  });
  if (!res.ok) {
    throw new Error(`Supabase 조회 실패 (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

export type PricingCatalog = {
  spaces: Space[];
  units: Unit[];
  priceRules: PriceRule[];
  extraPersonRules: ExtraPersonRule[];
};

/** 전체 요금표 — 상품 안내 페이지를 빌드 시점에 정적으로 만들 때 사용 */
export async function fetchPricingCatalog(): Promise<PricingCatalog> {
  const [spaces, units, priceRules, extraPersonRules] = await Promise.all([
    rest<Space>("spaces?select=*&order=sort_order"),
    rest<Unit>("units?select=*&order=sort_order"),
    rest<PriceRule>("price_rules?select=*&order=sort_order"),
    rest<ExtraPersonRule>("extra_person_rules?select=*"),
  ]);
  return { spaces, units, priceRules, extraPersonRules };
}

// ── 블로그 (빌드 시점 정적 생성용) ─────────────────────────────────────────
function normalizePost(row: Record<string, unknown>): BlogPost {
  return {
    ...(row as unknown as BlogPost),
    body: Array.isArray(row.body) ? (row.body as PostBlock[]) : [],
  };
}

/** 발행된 글 전체 — /blog 목록 및 generateStaticParams용. */
export async function fetchPublishedPosts(): Promise<BlogPost[]> {
  try {
    const rows = await rest<Record<string, unknown>>(
      "blog_posts?select=*&status=eq.published&order=published_at.desc",
    );
    return rows.map(normalizePost);
  } catch (e) {
    // blog_posts 마이그레이션 전이거나 일시적 오류 → 빈 목록으로 빌드 진행
    console.warn("[blog] fetchPublishedPosts 실패, 빈 목록으로 진행:", e);
    return [];
  }
}

/** slug로 발행된 글 1개 (빌드 시점). */
export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const rows = await rest<Record<string, unknown>>(
      `blog_posts?select=*&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    );
    return rows[0] ? normalizePost(rows[0]) : null;
  } catch (e) {
    console.warn("[blog] fetchPostBySlug 실패:", e);
    return null;
  }
}
