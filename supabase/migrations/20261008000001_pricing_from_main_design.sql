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
select id, null::text, null::numeric, null::numeric, 10000 from units where code = '4f-hall'
union all
select id, '3h'::text, null::numeric, null::numeric, 20000 from units where code = '4f-hall';

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
select id, null::text, null::numeric, null::numeric, 15000 from units where code = '6f-rooftop';
