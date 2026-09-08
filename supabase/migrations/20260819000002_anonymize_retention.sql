-- 개인정보 보유기간(1년) 경과분 자동 익명화
--
-- 개인정보처리방침: 예약 정보(이름·연락처)는 이용일로부터 1년 후 파기.
-- 단, 결제·거래 기록은 전자상거래법상 5년 보존 의무 → 행 자체는 남기고
-- 개인 식별정보(이름·연락처·요청사항)만 마스킹한다.

create or replace function anonymize_old_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update reservations
     set customer_name  = '(파기됨)',
         customer_phone = '(파기됨)',
         memo           = null
   where ends_at < now() - interval '1 year'
     and customer_name <> '(파기됨)';   -- 이미 파기된 건 건너뜀(멱등)
  get diagnostics n = row_count;
  return n;
end $$;

-- 매일 새벽 4시(KST 무관, UTC 기준) 1회 실행
do $$
begin
  perform cron.unschedule('anonymize-old-reservations');
exception when others then null;
end $$;

select cron.schedule(
  'anonymize-old-reservations',
  '0 4 * * *',
  $cron$ select anonymize_old_reservations(); $cron$
);
