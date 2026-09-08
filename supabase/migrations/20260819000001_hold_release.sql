-- 결제 미완료(홀드) 슬롯이 영구히 막히는 문제 해결
--
-- 배경: create_reservation 은 예약을 만들 때 10분짜리 임시 홀드(hold_expires_at)와
--       점유(occupancies.active=true)를 함께 만든다. 결제를 완료하지 않고 창을 닫으면
--       이 점유가 남아 그 시간대가 계속 막힌다. release_expired_holds() 는 있었지만
--       아무도 주기적으로 호출하지 않아 사실상 동작하지 않았다.
--
-- 해결:
--   (1) release_hold(code, phone)  — 결제 취소 즉시 해당 홀드를 풀어준다(프론트에서 호출)
--   (2) pg_cron                    — 만료된 홀드를 1분마다 자동 정리(명시적 취소를 못 한 경우 대비)

-- ── (1) 특정 예약 홀드 즉시 해제 ─────────────────────────────────────────
-- 결제창을 닫거나 결제에 실패했을 때, 방금 만든 pending 예약을 바로 취소해
-- 그 시간대를 즉시 다시 예약 가능하게 만든다.
-- 보안: 예약번호(code) + 전화번호가 모두 맞아야 하고, 'pending' 상태만 취소한다.
--       (이미 결제 완료된 예약은 절대 이 함수로 취소되지 않는다)
create or replace function release_hold(
  p_code  text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from reservations
   where code = p_code
     and regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
     and status = 'pending';

  if v_id is null then
    return false;  -- 없거나, 이미 확정/취소된 예약 → 아무것도 하지 않음
  end if;

  update reservations
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = '결제 취소'
   where id = v_id;

  update occupancies
     set active = false
   where reservation_id = v_id;

  return true;
end $$;

grant execute on function release_hold(text, text) to anon, authenticated;

-- ── (2) 만료 홀드 주기적 자동 정리 (pg_cron) ─────────────────────────────
create extension if not exists pg_cron;

-- 이미 등록돼 있으면 지우고 다시 등록 (멱등). 없으면 조용히 넘어간다.
do $$
begin
  perform cron.unschedule('release-expired-holds');
exception when others then
  null;
end $$;

select cron.schedule(
  'release-expired-holds',
  '* * * * *',                        -- 매 1분
  $cron$ select release_expired_holds(); $cron$
);
