-- 예약 생성 함수
--
-- 왜 DB 함수인가:
--   브라우저가 보낸 금액을 그대로 믿으면 "1원 결제" 같은 조작이 가능하다.
--   이 함수는 요금표를 다시 읽어 금액을 서버에서 직접 계산하고,
--   인원·최소시간·운영요일을 모두 재검증한 뒤에만 예약을 만든다.
--   anon에게는 이 함수의 EXECUTE 권한만 주고 테이블 INSERT 권한은 주지 않는다.

create or replace function create_reservation(
  p_unit_code       text,
  p_date            date,
  p_slot_code       text,          -- 패키지면 슬롯 코드, 시간당이면 null
  p_start_time      time,          -- 시간당 / 시작시각 자유인 패키지
  p_end_time        time,          -- 시간당만
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
  -- 동의 확인 (전자상거래법상 필수)
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

  -- 지난 날짜 예약 방지 (한국 시간 기준 오늘부터)
  if p_date < (now() at time zone 'Asia/Seoul')::date then
    raise exception '지난 날짜는 예약할 수 없습니다.';
  end if;

  -- 요일 결정: 공휴일 또는 공휴일 전날이면 일요일 요금표 적용
  v_weekday := extract(isodow from p_date);
  if exists (select 1 from holidays where holiday_date in (p_date, p_date + 1)) then
    v_weekday := 7;
  end if;

  -- 요금 규칙 조회 (시간당이면 slot_code is null)
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

  -- 이용 시각 계산
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
    else
      -- 3시간권처럼 시작 시각을 손님이 고르는 상품
      if p_start_time is null then
        raise exception '시작 시각을 선택해주세요.';
      end if;
      v_starts := (p_date + p_start_time) at time zone 'Asia/Seoul';
      v_ends   := v_starts + (coalesce(v_rule.duration_h, 0) || ' hours')::interval;
    end if;
    v_hours := extract(epoch from (v_ends - v_starts)) / 3600.0;
    v_base  := v_rule.price;
  end if;

  -- 성수기 등 날짜 기반 조정
  select coalesce(multiplier, 1) into v_mult
  from price_overrides
  where (unit_id is null or unit_id = v_unit.id)
    and p_date between starts_on and ends_on
  order by unit_id nulls last
  limit 1;
  v_base := round(v_base * coalesce(v_mult, 1));

  -- 인원 검증
  v_base_cap := coalesce(v_unit.base_capacity, v_space.base_capacity);
  v_max_cap  := coalesce(v_unit.max_capacity,  v_space.max_capacity);
  if p_headcount < 1 then
    raise exception '인원을 입력해주세요.';
  end if;
  if p_headcount > v_max_cap then
    raise exception '최대 %명까지 이용할 수 있습니다.', v_max_cap;
  end if;

  -- 추가 인원 요금 (구간이 더 구체적인 규칙 우선)
  select fee into v_extra_fee
  from extra_person_rules
  where unit_id = v_unit.id
    and (slot_code is null or slot_code = p_slot_code)
    and (min_hours is null or v_hours >= min_hours)
    and (max_hours is null or v_hours <  max_hours)
  order by (case when min_hours is not null then 1 else 0 end)
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

  -- 점유 등록 — 통대관이면 방 3개가 한꺼번에 잠긴다.
  -- 시간이 겹치면 EXCLUDE 제약이 여기서 예외를 던진다.
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
