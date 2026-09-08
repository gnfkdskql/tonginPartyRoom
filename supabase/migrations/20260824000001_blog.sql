-- 블로그(게시글) 시스템
--
-- 본문은 "블록 배열"로 저장한다. (이미지+텍스트+이미지+텍스트 형태)
--   body = [
--     { "type": "text",  "content": "..." },
--     { "type": "image", "url": "...", "caption": "..." },
--     ...
--   ]
-- 관리자만 쓰기, 손님(anon)은 published 글만 읽기. (기존 RLS 패턴과 동일)

create table blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,               -- URL용 (예: 'party-tips-2026')
  title        text not null,
  excerpt      text,                               -- 목록/검색 요약 (SEO description)
  cover_url    text,                               -- 대표 이미지 (목록 썸네일·OG)
  body         jsonb not null default '[]'::jsonb, -- 블록 배열
  status       text not null default 'draft'
                 check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index blog_posts_published_idx
  on blog_posts (published_at desc)
  where status = 'published';

-- updated_at 자동 갱신
create or replace function touch_blog_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger blog_posts_touch
  before update on blog_posts
  for each row execute function touch_blog_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table blog_posts enable row level security;

-- 손님: 발행된 글만 읽기
create policy "public read published posts"
  on blog_posts for select
  to anon, authenticated
  using (status = 'published');

-- 관리자: 전체 CRUD (draft 포함)
create policy "admin all posts"
  on blog_posts for all
  to authenticated
  using (true) with check (true);

-- ── Storage 버킷 (블로그 이미지) ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('blog', 'blog', true)
on conflict (id) do nothing;

-- 공개 읽기
create policy "public read blog images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'blog');

-- 관리자만 업로드/수정/삭제
create policy "admin write blog images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog');

create policy "admin update blog images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blog');

create policy "admin delete blog images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'blog');
