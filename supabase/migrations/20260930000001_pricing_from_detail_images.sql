-- 2026-09-30 상세페이지 새 디자인 기준 요금·인원 정합 (4F/2F/6F 이미지)
-- 2F: 룸별 패키지(3시간/모닝/낮/저녁/12시간) + 시간제 unit 분리, 인원·보증금·추가인원 반영
-- 6F: 기준 6 / 최대 30
-- 4F: 변동 없음
-- 이미지 내 상충: 2F 보증금 10만원 채택, 4F 보증금 5만원 유지

-- 6F 인원
update spaces set base_capacity = 6, max_capacity = 30 where code = '6f';
update units  set base_capacity = 6, max_capacity = 30 where code = '6f-rooftop';

-- 2F 공간
update spaces set base_capacity = 6, max_capacity = 20, deposit_amount = 100000 where code = '2f';

-- 2F 기존 unit -> 패키지 unit
update units set booking_unit = 'package', min_hours = 1, base_capacity = 20, max_capacity = 20, name = '2F 통대관', sort_order = 1 where code = '2f-whole';
update units set booking_unit = 'package', min_hours = 1, base_capacity = 6,  max_capacity = 20, name = '그린룸',    sort_order = 2 where code = '2f-green';
update units set booking_unit = 'package', min_hours = 1, base_capacity = 10, max_capacity = 20, name = '우드룸',    sort_order = 3 where code = '2f-wood';
update units set booking_unit = 'package', min_hours = 1, base_capacity = 12, max_capacity = 20, name = '블랙룸',    sort_order = 4 where code = '2f-black';

-- 2F 시간제 unit 신설
insert into units (space_id, code, name, booking_unit, min_hours, base_capacity, max_capacity, sort_order)
select s.id, v.code, v.name, 'hourly', 2, v.base_cap, 20, v.ord
from spaces s
join (values
  ('2f-whole-h', '2F 통대관 (시간제)', 20, 5),
  ('2f-green-h', '그린룸 (시간제)',    6,  6),
  ('2f-wood-h',  '우드룸 (시간제)',    10, 7),
  ('2f-black-h', '블랙룸 (시간제)',    12, 8)
) as v(code, name, base_cap, ord) on true
where s.code = '2f'
on conflict (code) do nothing;

-- 시간제 unit <-> 물리 공간 연결
insert into unit_resources (unit_id, resource_id)
select u.id, r.id
from units u, resources r
where u.code = '2f-whole-h' and r.code in ('2f-green', '2f-black', '2f-wood')
on conflict do nothing;

insert into unit_resources (unit_id, resource_id)
select u.id, r.id
from units u
join resources r on r.code = replace(u.code, '-h', '')
where u.code in ('2f-green-h', '2f-black-h', '2f-wood-h')
on conflict do nothing;

-- 2F 요금 전체 재작성
delete from price_rules
where unit_id in (select u.id from units u join spaces s on s.id = u.space_id where s.code = '2f');

-- 시간제 (월~일 동일)
insert into price_rules (unit_id, slot_code, slot_name, weekdays, price, sort_order)
select u.id, null, '시간당', '{1,2,3,4,5,6,7}'::smallint[], v.price, 1
from (values
  ('2f-whole-h', 100000),
  ('2f-green-h',  30000),
  ('2f-wood-h',   40000),
  ('2f-black-h',  50000)
) as v(code, price)
join units u on u.code = v.code;

-- 패키지 (월~일 동일)
insert into price_rules (unit_id, slot_code, slot_name, weekdays, starts_at, ends_at, duration_h, price, sort_order)
select u.id, v.slot_code, v.slot_name, '{1,2,3,4,5,6,7}'::smallint[], v.starts_at::time, v.ends_at::time, v.duration_h, v.price, v.sort_order
from (values
  ('2f-green', '3h',      '3시간',  null,    null,    3.0,   90000, 1),
  ('2f-green', 'morning', '모닝',   '08:00', '12:00', 4.0,  100000, 2),
  ('2f-green', 'day',     '낮',     '12:00', '18:00', 6.0,  150000, 3),
  ('2f-green', 'evening', '저녁',   '18:00', '24:00', 6.0,  150000, 4),
  ('2f-green', '12h',     '12시간', null,    null,   12.0,  300000, 5),
  ('2f-wood',  '3h',      '3시간',  null,    null,    3.0,  120000, 1),
  ('2f-wood',  'morning', '모닝',   '08:00', '12:00', 4.0,  150000, 2),
  ('2f-wood',  'day',     '낮',     '12:00', '18:00', 6.0,  200000, 3),
  ('2f-wood',  'evening', '저녁',   '18:00', '24:00', 6.0,  200000, 4),
  ('2f-wood',  '12h',     '12시간', null,    null,   12.0,  400000, 5),
  ('2f-black', '3h',      '3시간',  null,    null,    3.0,  150000, 1),
  ('2f-black', 'morning', '모닝',   '08:00', '12:00', 4.0,  170000, 2),
  ('2f-black', 'day',     '낮',     '12:00', '18:00', 6.0,  250000, 3),
  ('2f-black', 'evening', '저녁',   '18:00', '24:00', 6.0,  250000, 4),
  ('2f-black', '12h',     '12시간', null,    null,   12.0,  500000, 5),
  ('2f-whole', '3h',      '3시간',  null,    null,    3.0,  300000, 1),
  ('2f-whole', 'morning', '모닝',   '08:00', '12:00', 4.0,  350000, 2),
  ('2f-whole', 'day',     '낮',     '12:00', '18:00', 6.0,  400000, 3),
  ('2f-whole', 'evening', '저녁',   '18:00', '24:00', 6.0,  500000, 4),
  ('2f-whole', '12h',     '12시간', null,    null,   12.0,  800000, 5)
) as v(code, slot_code, slot_name, starts_at, ends_at, duration_h, price, sort_order)
join units u on u.code = v.code;

-- 2F 추가 인원: 1인당 1만원 (시간 구간 없음)
delete from extra_person_rules
where unit_id in (select u.id from units u join spaces s on s.id = u.space_id where s.code = '2f');

insert into extra_person_rules (unit_id, slot_code, min_hours, max_hours, fee)
select u.id, null, null, null, 10000
from units u join spaces s on s.id = u.space_id
where s.code = '2f';
