-- 2026-10-08 메인 페이지 요금 시안 기준으로 4F·6F 요금·보증금 정합
--   (2F는 2026-09-30 마이그레이션과 동일하므로 변경 없음)
--
-- 4F  · 보증금 5만 → 10만
--     · 오전 09–15시(6h) 월~금 35만 / 토·일 40만
--     · 낮   12–18시(6h) 35/40/45/40만,  밤 18–24시(6h) 45/50/55/50만
--     · 시간제(기본 3시간, 시작 시각 자유) 월~목 30만 · 일 40만 (금·토 미운영)
--     · 추가 인원 1인 1만, 시간제는 2만
-- 6F  · 보증금 5만 → 10만
--     · 데이 11–17시 20만 · 밤 18–24시 20만 · 올나잇 19시~익일 08시 30만 (요일 무관)
--     · 추가 인원 1인 1.5만
-- 공통 · create_reservation: 종료 시각이 시작보다 이르면 익일로 처리 (올나잇 대응)
--
-- 시안의 "1시간 추가"·"자쿠지/바베큐/룸 옵션"은 현재 스키마에 없어 이번에는 제외.

-- ── 보증금 ────────────────────────────────────────────────────────────────
update spaces set deposit_amount = 100000 where code in ('4f', '6f');

-- ── 4F 요금 ───────────────────────────────────────────────────────────────
delete from price_rules where unit_id = (select id from units where code = '4f-hall');

insert into price_rules (unit_id, slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
select u.id, v.slot_code, v.slot_name, v.weekdays::smallint[], v.starts_at::time, v.ends_at::time, v.duration_h, v.price, v.sort_order
from units u,
(values
  ('morning', '오전타임', '{1,2,3,4,5}', '09:00', '15:00', 6.0, 350000, 1),
  ('morning', '오전타임', '{6,7}',       '09:00', '15:00', 6.0, 400000, 2),
  ('day',     '낮타임',   '{1,2,3,4}',   '12:00', '18:00', 6.0, 350000, 3),
  ('day',     '낮타임',   '{5}',         '12:00', '18:00', 6.0, 400000, 4),
  ('day',     '낮타임',   '{6}',         '12:00', '18:00', 6.0, 450000, 5),
  ('day',     '낮타임',   '{7}',         '12:00', '18:00', 6.0, 400000, 6),
  ('night',   '밤타임',   '{1,2,3,4}',   '18:00', '24:00', 6.0, 450000, 7),
  ('night',   '밤타임',   '{5}',         '18:00', '24:00', 6.0, 500000, 8),
  ('night',   '밤타임',   '{6}',         '18:00', '24:00', 6.0, 550000, 9),
  ('night',   '밤타임',   '{7}',         '18:00', '24:00', 6.0, 500000, 10),
  ('3h',      '시간제 3시간', '{1,2,3,4}', null,  null,    3.0, 300000, 11),
  ('3h',      '시간제 3시간', '{7}',       null,  null,    3.0, 400000, 12)
) as v(slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
where u.code = '4f-hall';

delete from extra_person_rules where unit_id = (select id from units where code = '4f-hall');
insert into extra_person_rules (unit_id, slot_code, min_hours, max_hours, fee)
select id, null, null, null, 10000 from units where code = '4f-hall'
union all
select id, '3h', null, null, 20000 from units where code = '4f-hall';

-- ── 6F 요금 ───────────────────────────────────────────────────────────────
delete from price_rules where unit_id = (select id from units where code = '6f-rooftop');

insert into price_rules (unit_id, slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
select u.id, v.slot_code, v.slot_name, '{1,2,3,4,5,6,7}'::smallint[], v.starts_at::time, v.ends_at::time, v.duration_h, v.price, v.sort_order
from units u,
(values
  ('day',      '데이',   '11:00', '17:00',  6.0, 200000, 1),
  ('night',    '밤',     '18:00', '24:00',  6.0, 200000, 2),
  ('allnight', '올나잇', '19:00', '08:00', 13.0, 300000, 3)
) as v(slot_code, slot_name, starts_at, ends_at, duration_h, price, sort_order)
where u.code = '6f-rooftop';

delete from extra_person_rules where unit_id = (select id from units where code = '6f-rooftop');
insert into extra_person_rules (unit_id, slot_code, min_hours, max_hours, fee)
select id, null, null, null, 15000 from units where code = '6f-rooftop';

-- ── create_reservation: 자정을 넘기는 패키지(올나잇) 처리 ──────────────────
create or replace function create_reservation(
  p_unit_code       text,
  p_date            date,
  p_slot_code       text,
  p_start_time      time,
  p_end_time        time,
  p_headcount       int,
  p_name            text,
  p_phone           text,
  p_memo            text,
  p_privacy_agreed  boolean,
  p_terms_agreed    boolean
)
returns table (
  code           text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  base_amount    int,
  extra_amount   int,
  deposit_amount int,
  total_amount   int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit      units%rowtype;
  v_space     spaces%rowtype;
  v_rule      price_rules%rowtype;
  v_weekday   int;
  v_starts    timestamptz;
  v_ends      timestamptz;
  v_hours     numeric;
  v_base      int;
  v_extra_fee int;
  v_extra_cnt int;
  v_extra     int;
  v_deposit   int;
  v_total     int;
  v_mult      numeric := 1;
  v_base_cap  int;
  v_max_cap   int;
  v_code      text;
  v_res_id    uuid;
begin
  if not coalesce(p_privacy_agreed, false) or not coalesce(p_terms_agreed, false) then
    raise exception '개인정보 수집 및 이용약관에 동의해주세요.';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception '예약자 이름을 입력해주세요.';
  end if;
  if regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') !~ '^01[0-9]{8,9}$' then
    raise exception '휴대폰 번호를 정확히 입력해주세요.';
  end if;

  select * into v_unit from units where units.code = p_unit_code and is_active;
  if not found then
    raise exception '존재하지 않는 공간입니다.';
  end if;
  select * into v_space from spaces where id = v_unit.space_id;

  if p_date < (now() at time zone 'Asia/Seoul')::date then
    raise exception '지난 날짜는 예약할 수 없습니다.';
  end if;

  v_weekday := extract(isodow from p_date);
  if exists (select 1 from holidays where holiday_date in (p_date, p_date + 1)) then
    v_weekday := 7;
  end if;

  select * into v_rule
  from price_rules
  where unit_id = v_unit.id
    and slot_code is not distinct from p_slot_code
    and v_weekday = any(weekdays)
    and is_active
  limit 1;

  if not found then
    raise exception '해당 요일에는 이 시간대를 운영하지 않습니다.';
  end if;

  if v_unit.booking_unit = 'hourly' then
    if p_start_time is null or p_end_time is null then
      raise exception '이용 시간을 선택해주세요.';
    end if;
    v_starts := (p_date + p_start_time) at time zone 'Asia/Seoul';
    v_ends   := (p_date + p_end_time)   at time zone 'Asia/Seoul';
    v_hours  := extract(epoch from (v_ends - v_starts)) / 3600.0;

    if v_hours <= 0 then
      raise exception '종료 시각이 시작 시각보다 빠릅니다.';
    end if;
    if v_hours < v_unit.min_hours then
      raise exception '최소 % 시간부터 예약할 수 있습니다.', v_unit.min_hours;
    end if;

    v_base := round(v_rule.price * v_hours);
  else
    if v_rule.starts_at is not null and v_rule.ends_at is not null then
      v_starts := (p_date + v_rule.starts_at) at time zone 'Asia/Seoul';
      v_ends   := (p_date + v_rule.ends_at)   at time zone 'Asia/Seoul';
      -- 올나잇(19시~익일 08시)처럼 종료가 시작보다 이르면 다음 날로 넘긴다
      if v_ends <= v_starts then
        v_ends := v_ends + interval '1 day';
      end if;
    else
      if p_start_time is null then
        raise exception '시작 시각을 선택해주세요.';
      end if;
      v_starts := (p_date + p_start_time) at time zone 'Asia/Seoul';
      v_ends   := v_starts + (coalesce(v_rule.duration_h, 0) || ' hours')::interval;
    end if;
    v_hours := extract(epoch from (v_ends - v_starts)) / 3600.0;
    v_base  := v_rule.price;
  end if;

  select coalesce(multiplier, 1) into v_mult
  from price_overrides
  where (unit_id is null or unit_id = v_unit.id)
    and p_date between starts_on and ends_on
  order by unit_id nulls last
  limit 1;
  v_base := round(v_base * coalesce(v_mult, 1));

  v_base_cap := coalesce(v_unit.base_capacity, v_space.base_capacity);
  v_max_cap  := coalesce(v_unit.max_capacity,  v_space.max_capacity);
  if p_headcount < 1 then
    raise exception '인원을 입력해주세요.';
  end if;
  if p_headcount > v_max_cap then
    raise exception '최대 %명까지 이용할 수 있습니다.', v_max_cap;
  end if;

  select fee into v_extra_fee
  from extra_person_rules
  where unit_id = v_unit.id
    and (slot_code is null or slot_code = p_slot_code)
    and (min_hours is null or v_hours >= min_hours)
    and (max_hours is null or v_hours <  max_hours)
  order by (case when slot_code is not null then 1 else 0 end)
         + (case when min_hours is not null then 1 else 0 end)
         + (case when max_hours is not null then 1 else 0 end) desc
  limit 1;

  v_extra_cnt := greatest(0, p_headcount - v_base_cap);
  v_extra     := v_extra_cnt * coalesce(v_extra_fee, 0);
  v_deposit   := v_space.deposit_amount;
  v_total     := v_base + v_extra + v_deposit;

  v_code := generate_reservation_code();

  insert into reservations (
    code, space_id, unit_id, slot_code, starts_at, ends_at, headcount,
    base_amount, extra_person_amount, deposit_amount, total_amount,
    customer_name, customer_phone, memo,
    status, deposit_state, hold_expires_at,
    privacy_agreed_at, terms_agreed_at
  ) values (
    v_code, v_space.id, v_unit.id, p_slot_code, v_starts, v_ends, p_headcount,
    v_base, v_extra, v_deposit, v_total,
    btrim(p_name), regexp_replace(p_phone, '[^0-9]', '', 'g'), nullif(btrim(coalesce(p_memo,'')), ''),
    'pending'::reservation_status,
    (case when v_deposit > 0 then 'held' else 'none' end)::deposit_status,
    now() + interval '10 minutes',
    now(), now()
  )
  returning id into v_res_id;

  begin
    insert into occupancies (resource_id, reservation_id, during)
    select ur.resource_id, v_res_id, tstzrange(v_starts, v_ends)
    from unit_resources ur
    where ur.unit_id = v_unit.id;
  exception when exclusion_violation then
    raise exception '이미 예약된 시간대입니다. 다른 시간을 선택해주세요.';
  end;

  return query select v_code, v_starts, v_ends, v_base, v_extra, v_deposit, v_total;
end $$;

revoke all on function create_reservation from public;
grant execute on function create_reservation(
  text, date, text, time, time, int, text, text, text, boolean, boolean
) to anon, authenticated;
