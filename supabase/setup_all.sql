-- 서초 시그니처 파티룸 예약 시스템 — 전체 설치 SQL
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- (init → rls → seed 순서로 합쳐진 파일입니다)

-- ═══════════════ 1. 스키마 ═══════════════
-- 서초 시그니처 파티룸 · 예약 시스템 기본 스키마
--
-- 핵심 설계
--  1) resources = 실제로 하나뿐인 물리 공간(그린룸, 블랙룸, 루프탑 …)
--     units     = 손님에게 파는 단위(2F 통대관, 2F 그린룸, 4F 전체 …)
--     통대관처럼 여러 방을 한꺼번에 쓰는 상품은 unit 1개 ↔ resource 여러 개로 연결한다.
--     → "통대관이 팔리면 개별 룸도 자동으로 막힘"이 데이터 구조 자체로 보장된다.
--  2) 모든 점유(예약/관리자 차단)는 occupancies 한 테이블에 모으고,
--     EXCLUDE 제약으로 같은 resource의 시간 겹침을 DB가 거부한다. (동시 예약 사고 방지)

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist"; -- EXCLUDE에서 (uuid =, tstzrange &&) 조합에 필요

-- ── 열거형 ────────────────────────────────────────────────────────────────
create type booking_unit as enum ('hourly', 'package');   -- 시간당 / 패키지
create type reservation_status as enum (
  'pending',    -- 결제 대기(임시 홀드)
  'confirmed',  -- 결제 완료
  'cancelled',  -- 취소됨
  'completed',  -- 이용 완료
  'no_show'
);
create type deposit_status as enum (
  'none',       -- 보증금 없음
  'held',       -- 예치 중
  'refunded',   -- 전액 환불
  'partial',    -- 일부 차감 후 환불
  'forfeited'   -- 전액 차감
);
create type occupancy_kind as enum ('reservation', 'block');

-- ── 공간(층) ──────────────────────────────────────────────────────────────
create table spaces (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,          -- '2f' | '4f' | '6f'
  name           text not null,
  base_capacity  int  not null,                 -- 기준 인원
  max_capacity   int  not null,                 -- 최대 인원
  deposit_amount int  not null default 0,       -- 청소 보증금
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── 물리 공간 ─────────────────────────────────────────────────────────────
create table resources (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  code       text not null unique,              -- '2f-green', '4f-hall' …
  name       text not null,
  created_at timestamptz not null default now()
);

-- ── 판매 단위 ─────────────────────────────────────────────────────────────
create table units (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces(id) on delete cascade,
  code          text not null unique,           -- '2f-whole', '2f-green', '6f-rooftop'
  name          text not null,
  booking_unit  booking_unit not null,          -- hourly | package
  min_hours     int not null default 1,         -- 시간당 상품의 최소 이용 시간
  base_capacity int,                            -- null이면 space 값 사용
  max_capacity  int,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 판매 단위 ↔ 물리 공간 (통대관 = 그린+블랙+우드)
create table unit_resources (
  unit_id     uuid not null references units(id) on delete cascade,
  resource_id uuid not null references resources(id) on delete cascade,
  primary key (unit_id, resource_id)
);

-- ── 요금 규칙 ─────────────────────────────────────────────────────────────
-- 패키지: slot_code + 시작/종료 시각이 정해짐 (낮타임, 밤타임, All Day, 3시간 …)
-- 시간당: slot_code = null, price = 시간당 단가
create table price_rules (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  slot_code   text,                             -- 'morning'|'day'|'night'|'allday'|'3h' | null(시간당)
  slot_name   text,                             -- 화면 표기용 '낮타임' 등
  weekdays    smallint[] not null,              -- ISO 요일 1=월 … 7=일
  starts_at   time,                             -- 패키지 시작 시각
  ends_at     time,                             -- 패키지 종료 시각
  duration_h  numeric(4,1),                     -- 패키지 이용 시간(3시간권 등)
  price       int not null,                     -- 패키지 총액 또는 시간당 단가(원)
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  constraint price_rules_slot_shape check (
    (slot_code is null and starts_at is null and ends_at is null)  -- 시간당
    or (slot_code is not null)                                     -- 패키지
  )
);
create index on price_rules (unit_id, slot_code);

-- 추가 인원 요금 (기준 인원 초과분, 1인당)
--   2F: 5시간 미만 1만 / 5시간 이상 2만  → min_hours/max_hours로 구간 표현
--   4F·6F: 슬롯 무관 1만원
create table extra_person_rules (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  slot_code  text,          -- null이면 모든 슬롯에 적용
  min_hours  numeric(4,1),  -- 이 시간 이상일 때 (null=제한없음)
  max_hours  numeric(4,1),  -- 이 시간 미만일 때 (null=제한없음)
  fee        int not null,  -- 1인당 요금
  created_at timestamptz not null default now()
);

-- 성수기·공휴일 등 날짜 기반 요금 조정
create table price_overrides (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid references units(id) on delete cascade, -- null = 전체 적용
  starts_on   date not null,
  ends_on     date not null,
  multiplier  numeric(4,2),  -- 예: 1.20 (20% 인상)
  fixed_price int,           -- 지정 시 multiplier 무시하고 이 금액 사용
  note        text,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- 공휴일: "공휴일 및 전날은 주말 요금 적용" 규칙에 사용
create table holidays (
  holiday_date date primary key,
  name         text not null
);

-- ── 예약 ──────────────────────────────────────────────────────────────────
create table reservations (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,            -- 손님 안내용 예약번호
  space_id     uuid not null references spaces(id),
  unit_id      uuid not null references units(id),
  slot_code    text,                            -- 패키지 예약이면 기록
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  headcount    int  not null,

  -- 금액 (원). total = base + extra_person + deposit
  base_amount         int not null default 0,
  extra_person_amount int not null default 0,
  deposit_amount      int not null default 0,
  total_amount        int not null default 0,

  -- 비회원 예약자 정보
  customer_name  text not null,
  customer_phone text not null,
  memo           text,

  status         reservation_status not null default 'pending',
  deposit_state  deposit_status     not null default 'none',
  hold_expires_at timestamptz,                  -- pending 임시 홀드 만료 시각

  cancelled_at   timestamptz,
  cancel_reason  text,
  refund_amount  int not null default 0,

  privacy_agreed_at timestamptz,                -- 개인정보 수집 동의
  terms_agreed_at   timestamptz,                -- 이용약관·환불규정 동의

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (headcount > 0)
);
create index on reservations (starts_at);
create index on reservations (status);
create index on reservations (customer_phone);

-- ── 점유(중복 예약 방지의 핵심) ──────────────────────────────────────────
-- 예약이든 관리자 차단이든 전부 여기에 한 줄씩. 같은 resource의 시간이 겹치면 DB가 거부한다.
create table occupancies (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references resources(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete cascade,
  kind           occupancy_kind not null default 'reservation',
  during         tstzrange not null,
  active         boolean not null default true,  -- 취소 시 false → 다시 예약 가능
  reason         text,                           -- kind='block'일 때 사유
  created_at     timestamptz not null default now(),

  -- ★ 동시에 같은 공간·같은 시간대 예약을 DB 차원에서 원천 차단
  constraint occupancies_no_overlap
    exclude using gist (resource_id with =, during with &&) where (active)
);
create index on occupancies using gist (during);
create index on occupancies (reservation_id);

-- ── 결제 ──────────────────────────────────────────────────────────────────
create table payments (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  order_id        text not null unique,          -- 토스에 넘기는 주문번호
  payment_key     text unique,                   -- 토스 결제키(승인 후)
  amount          int not null,
  status          text not null default 'ready', -- ready|approved|cancelled|partial_cancelled|failed
  method          text,
  receipt_url     text,
  approved_at     timestamptz,
  cancelled_at    timestamptz,
  cancelled_amount int not null default 0,
  raw             jsonb,                         -- 토스 응답 원본 보관
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on payments (reservation_id);

-- ── updated_at 자동 갱신 ──────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger reservations_updated_at before update on reservations
  for each row execute function set_updated_at();
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- ── 예약번호 생성 (예: R260811-4F7K2) ────────────────────────────────────
create or replace function generate_reservation_code() returns text
language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := 'R' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' ||
                 upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5));
    exit when not exists (select 1 from reservations where code = candidate);
  end loop;
  return candidate;
end $$;

-- ═══════════════ 2. 보안(RLS) ═══════════════
-- RLS(행 수준 보안) · 공개 조회용 뷰 · 조회 함수
--
-- 전제: 정적 사이트라 anon key가 브라우저에 그대로 노출된다.
--       따라서 "anon이 직접 만질 수 있는 것"을 최소로 묶는 것이 이 파일의 목적이다.
--
--  anon(손님)  : 요금표 읽기 + "언제 찼는지"만 조회 가능. 예약자 개인정보 접근 불가.
--  authenticated(관리자) : 전체 조회·수정.
--  service_role(Edge Function) : RLS 우회. 예약 생성·결제 승인은 전부 여기서 처리.

alter table spaces             enable row level security;
alter table resources          enable row level security;
alter table units              enable row level security;
alter table unit_resources     enable row level security;
alter table price_rules        enable row level security;
alter table extra_person_rules enable row level security;
alter table price_overrides    enable row level security;
alter table holidays           enable row level security;
alter table reservations       enable row level security;
alter table occupancies        enable row level security;
alter table payments           enable row level security;

-- ── 공개 읽기: 상품·요금 정보 (개인정보 아님) ────────────────────────────
create policy "public read spaces"        on spaces             for select to anon, authenticated using (is_active);
create policy "public read resources"     on resources          for select to anon, authenticated using (true);
create policy "public read units"         on units              for select to anon, authenticated using (is_active);
create policy "public read unit_res"      on unit_resources     for select to anon, authenticated using (true);
create policy "public read price_rules"   on price_rules        for select to anon, authenticated using (is_active);
create policy "public read extra_person"  on extra_person_rules for select to anon, authenticated using (true);
create policy "public read overrides"     on price_overrides    for select to anon, authenticated using (true);
create policy "public read holidays"      on holidays           for select to anon, authenticated using (true);

-- ── 관리자 전용: 예약·결제·점유 ──────────────────────────────────────────
-- authenticated = Supabase Auth로 로그인한 관리자
create policy "admin all reservations" on reservations for all to authenticated using (true) with check (true);
create policy "admin all payments"     on payments     for all to authenticated using (true) with check (true);
create policy "admin all occupancies"  on occupancies  for all to authenticated using (true) with check (true);

-- 관리자만 상품·요금 수정 가능
create policy "admin write spaces"      on spaces             for all to authenticated using (true) with check (true);
create policy "admin write units"       on units              for all to authenticated using (true) with check (true);
create policy "admin write resources"   on resources          for all to authenticated using (true) with check (true);
create policy "admin write unit_res"    on unit_resources     for all to authenticated using (true) with check (true);
create policy "admin write price"       on price_rules        for all to authenticated using (true) with check (true);
create policy "admin write extra"       on extra_person_rules for all to authenticated using (true) with check (true);
create policy "admin write overrides"   on price_overrides    for all to authenticated using (true) with check (true);
create policy "admin write holidays"    on holidays           for all to authenticated using (true) with check (true);

-- ※ reservations / payments / occupancies 에는 anon 정책을 "일부러" 만들지 않는다.
--    RLS가 켜져 있고 정책이 없으면 anon은 아무 행도 볼 수 없다. (기본 거부)

-- ── 공개 가용성 뷰: 점유 시간대만, 개인정보 없음 ─────────────────────────
create or replace view public_availability
with (security_invoker = false) as
select
  o.resource_id,
  r.space_id,
  r.code as resource_code,
  lower(o.during) as busy_from,
  upper(o.during) as busy_to
from occupancies o
join resources r on r.id = o.resource_id
where o.active;

revoke all on public_availability from anon, authenticated;
grant select on public_availability to anon, authenticated;

-- ── 특정 기간의 예약 가능 여부 조회 ──────────────────────────────────────
create or replace function get_availability(
  p_space_code text,
  p_from       date,
  p_to         date
)
returns table (
  resource_code text,
  busy_from     timestamptz,
  busy_to       timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.resource_code, a.busy_from, a.busy_to
  from public_availability a
  join spaces s on s.id = a.space_id
  where s.code = p_space_code
    and a.busy_from < (p_to + 1)::timestamptz
    and a.busy_to   > p_from::timestamptz
  order by a.busy_from;
$$;

grant execute on function get_availability(text, date, date) to anon, authenticated;

-- ── 비회원 예약 조회: 예약번호 + 전화번호가 모두 맞아야만 ────────────────
-- 전화번호만으론 조회되지 않게 해서 남의 예약 열람을 막는다.
create or replace function lookup_reservation(
  p_code  text,
  p_phone text
)
returns table (
  code           text,
  space_name     text,
  unit_name      text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  headcount      int,
  total_amount   int,
  deposit_amount int,
  status         reservation_status,
  customer_name  text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.code, s.name, u.name, r.starts_at, r.ends_at, r.headcount,
    r.total_amount, r.deposit_amount, r.status, r.customer_name
  from reservations r
  join spaces s on s.id = r.space_id
  join units  u on u.id = r.unit_id
  where r.code = p_code
    -- 하이픈·공백 차이를 무시하고 비교
    and regexp_replace(r.customer_phone, '[^0-9]', '', 'g')
      = regexp_replace(p_phone,          '[^0-9]', '', 'g')
  limit 1;
$$;

grant execute on function lookup_reservation(text, text) to anon, authenticated;

-- ── 만료된 임시 홀드 정리 ────────────────────────────────────────────────
-- 결제까지 안 간 pending 예약의 점유를 풀어 다시 예약 가능하게 만든다.
-- Supabase 스케줄러(pg_cron)나 Edge Function에서 주기적으로 호출.
create or replace function release_expired_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  released int;
begin
  with expired as (
    update reservations
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = '결제 시간 초과'
     where status = 'pending'
       and hold_expires_at is not null
       and hold_expires_at < now()
    returning id
  )
  update occupancies o
     set active = false
    from expired e
   where o.reservation_id = e.id;

  get diagnostics released = row_count;
  return released;
end $$;

-- ═══════════════ 3. 초기 데이터 ═══════════════
-- 초기 데이터 — 층별 상세페이지의 요금표를 그대로 옮긴 것
-- 요일 표기: ISO 기준 1=월 2=화 3=수 4=목 5=금 6=토 7=일
--
-- ⚠️ 패키지 이용 "시각"(낮타임 몇 시~몇 시 등)은 상세페이지에 없어서 일반적인 값으로 넣어두었다.
--    실제 운영 시간에 맞게 price_rules.starts_at / ends_at 을 조정할 것.

-- ── 공간 ──────────────────────────────────────────────────────────────────
insert into spaces (code, name, base_capacity, max_capacity, deposit_amount, sort_order) values
  ('2f', '시그니처 스위트',  6, 10, 50000, 1),
  ('4f', '시그니처 컨벤션', 15, 60, 50000, 2),
  ('6f', '시그니처 루프탑',  4,  6, 50000, 3);

-- ── 물리 공간 ─────────────────────────────────────────────────────────────
insert into resources (space_id, code, name)
select id, '2f-green', '그린룸'  from spaces where code = '2f'
union all select id, '2f-black', '블랙룸' from spaces where code = '2f'
union all select id, '2f-wood',  '우드룸' from spaces where code = '2f'
union all select id, '4f-hall',    '컨벤션홀' from spaces where code = '4f'
union all select id, '6f-rooftop', '루프탑'   from spaces where code = '6f';

-- ── 판매 단위 ─────────────────────────────────────────────────────────────
-- 2F: 시간당(통대관 / 개별 룸), 4F·6F: 패키지
insert into units (space_id, code, name, booking_unit, min_hours, base_capacity, max_capacity, sort_order)
select id, '2f-whole', '2F 통대관',  'hourly'::booking_unit,  2, 6, 10, 1 from spaces where code = '2f'
union all select id, '2f-green', '그린룸', 'hourly'::booking_unit, 2, 6, 10, 2 from spaces where code = '2f'
union all select id, '2f-black', '블랙룸', 'hourly'::booking_unit, 2, 6, 10, 3 from spaces where code = '2f'
union all select id, '2f-wood',  '우드룸', 'hourly'::booking_unit, 2, 6, 10, 4 from spaces where code = '2f'
union all select id, '4f-hall',    '4F 시그니처 컨벤션', 'package'::booking_unit, 1, 15, 60, 1 from spaces where code = '4f'
union all select id, '6f-rooftop', '6F 시그니처 루프탑', 'package'::booking_unit, 1,  4,  6, 1 from spaces where code = '6f';

-- ── 판매 단위 ↔ 물리 공간 연결 ───────────────────────────────────────────
-- 통대관은 3개 방을 모두 점유 → 통대관 예약 시 개별 룸도 자동으로 막힌다.
insert into unit_resources (unit_id, resource_id)
select u.id, r.id from units u, resources r
 where u.code = '2f-whole' and r.code in ('2f-green', '2f-black', '2f-wood');

insert into unit_resources (unit_id, resource_id)
select u.id, r.id from units u join resources r on r.code = u.code
 where u.code in ('2f-green', '2f-black', '2f-wood', '4f-hall', '6f-rooftop');

-- ── 2F 요금: 시간당 ───────────────────────────────────────────────────────
-- 통대관 10만원/시간, 개별 룸 5만원/시간 (월~금 · 토~일 동일)
insert into price_rules (unit_id, slot_code, slot_name, weekdays, price, sort_order)
select id, null, '시간당', '{1,2,3,4,5}'::smallint[], 100000, 1 from units where code = '2f-whole'
union all select id, null, '시간당', '{6,7}'::smallint[],       100000, 2 from units where code = '2f-whole'
union all select id, null, '시간당', '{1,2,3,4,5}'::smallint[],  50000, 1 from units where code in ('2f-green','2f-black','2f-wood')
union all select id, null, '시간당', '{6,7}'::smallint[],        50000, 2 from units where code in ('2f-green','2f-black','2f-wood');

-- ── 4F 요금: 패키지 ───────────────────────────────────────────────────────
insert into price_rules (unit_id, slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
select u.id, v.slot_code, v.slot_name, v.weekdays::smallint[], v.starts_at::time, v.ends_at::time, v.duration_h, v.price, v.sort_order
from units u,
(values
  ('morning', '오전타임', '{1,2,3,4}', '09:00', '13:00', 4.0, 350000, 1),
  ('morning', '오전타임', '{5}',       '09:00', '13:00', 4.0, 350000, 2),
  ('morning', '오전타임', '{6}',       '09:00', '13:00', 4.0, 400000, 3),
  ('morning', '오전타임', '{7}',       '09:00', '13:00', 4.0, 400000, 4),
  ('day',     '낮타임',   '{1,2,3,4}', '13:00', '18:00', 5.0, 350000, 5),
  ('day',     '낮타임',   '{5}',       '13:00', '18:00', 5.0, 400000, 6),
  ('day',     '낮타임',   '{6}',       '13:00', '18:00', 5.0, 450000, 7),
  ('day',     '낮타임',   '{7}',       '13:00', '18:00', 5.0, 400000, 8),
  ('night',   '밤타임',   '{1,2,3,4}', '18:00', '23:00', 5.0, 450000, 9),
  ('night',   '밤타임',   '{5}',       '18:00', '23:00', 5.0, 500000, 10),
  ('night',   '밤타임',   '{6}',       '18:00', '23:00', 5.0, 550000, 11),
  ('night',   '밤타임',   '{7}',       '18:00', '23:00', 5.0, 500000, 12),
  -- 3시간권은 월~목·일만 운영 (금·토 미운영)
  ('3h',      '3시간',    '{1,2,3,4}', null,    null,    3.0, 300000, 13),
  ('3h',      '3시간',    '{7}',       null,    null,    3.0, 400000, 14)
) as v(slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
where u.code = '4f-hall';

-- ── 6F 요금: 패키지 ───────────────────────────────────────────────────────
insert into price_rules (unit_id, slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
select u.id, v.slot_code, v.slot_name, v.weekdays::smallint[], v.starts_at::time, v.ends_at::time, v.duration_h, v.price, v.sort_order
from units u,
(values
  ('day',    '낮타임',  '{1,2,3,4}', '13:00', '18:00',  5.0,  70000, 1),
  ('day',    '낮타임',  '{5}',       '13:00', '18:00',  5.0,  70000, 2),
  ('day',    '낮타임',  '{6}',       '13:00', '18:00',  5.0,  90000, 3),
  ('day',    '낮타임',  '{7}',       '13:00', '18:00',  5.0,  90000, 4),
  ('night',  '밤타임',  '{1,2,3,4}', '18:00', '23:00',  5.0, 100000, 5),
  ('night',  '밤타임',  '{5}',       '18:00', '23:00',  5.0, 160000, 6),
  ('night',  '밤타임',  '{6}',       '18:00', '23:00',  5.0, 200000, 7),
  ('night',  '밤타임',  '{7}',       '18:00', '23:00',  5.0, 100000, 8),
  ('allday', 'All Day', '{1,2,3,4}', '11:00', '23:00', 12.0, 120000, 9),
  ('allday', 'All Day', '{5}',       '11:00', '23:00', 12.0, 150000, 10),
  ('allday', 'All Day', '{6}',       '11:00', '23:00', 12.0, 200000, 11),
  ('allday', 'All Day', '{7}',       '11:00', '23:00', 12.0, 150000, 12),
  ('3h',     '3시간',   '{1,2,3,4}', null,    null,     3.0,  80000, 13),
  ('3h',     '3시간',   '{7}',       null,    null,     3.0, 100000, 14)
) as v(slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
where u.code = '6f-rooftop';

-- ── 추가 인원 요금 (기준 인원 초과, 1인당) ───────────────────────────────
-- 2F: 5시간 미만 1만원 / 5시간 이상 2만원
insert into extra_person_rules (unit_id, slot_code, min_hours, max_hours, fee)
select id, null, null, 5.0, 10000 from units where space_id = (select id from spaces where code='2f')
union all
select id, null, 5.0, null, 20000 from units where space_id = (select id from spaces where code='2f');

-- 4F·6F: 슬롯 무관 1인당 1만원
insert into extra_person_rules (unit_id, slot_code, min_hours, max_hours, fee)
select id, null, null, null, 10000 from units where code in ('4f-hall', '6f-rooftop');

-- ── 성수기 (12~1월 요금 변동) ────────────────────────────────────────────
-- 상세페이지: "성수기(12~1월) 요금은 변동될 수 있습니다" → 배수는 운영 정책에 맞게 조정
insert into price_overrides (unit_id, starts_on, ends_on, multiplier, note)
values (null, '2026-12-01', '2027-01-31', 1.20, '성수기(12~1월)');
