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
