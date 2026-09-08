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
