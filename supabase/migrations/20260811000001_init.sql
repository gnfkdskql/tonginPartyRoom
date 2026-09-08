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
