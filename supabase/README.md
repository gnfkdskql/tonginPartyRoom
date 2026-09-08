# 예약 시스템 DB (Supabase)

전액 선결제 + 청소 보증금, 시간당·패키지 예약을 모두 지원하는 스키마.
회원가입 없이(비회원) 예약하는 구조를 전제로 설계했다.

## 파일

| 파일 | 내용 |
|---|---|
| `migrations/20260811000001_init.sql` | 테이블·제약·인덱스 |
| `migrations/20260811000002_rls.sql` | RLS 정책, 공개 조회 뷰/함수 |
| `seed.sql` | 층별 요금표 초기 데이터 |

## 설계 핵심 2가지

### 1. unit(파는 단위) ↔ resource(실제 공간) 분리
2F는 **통대관**과 **개별 룸(그린/블랙/우드)** 을 따로 판다.
통대관 1개 unit이 방 3개 resource를 점유하도록 연결해서,
**통대관이 팔리면 개별 룸도 자동으로 막히도록** 데이터 구조 자체로 보장한다.

### 2. 중복 예약은 DB가 막는다
모든 점유(예약 + 관리자 차단)를 `occupancies` 한 테이블에 모으고
EXCLUDE 제약으로 같은 공간의 시간 겹침을 거부한다.

```sql
exclude using gist (resource_id with =, during with &&) where (active)
```

화면단 검사만으로는 **두 손님이 동시에 같은 시간을 누르는 경우**를 못 막는다.
취소 시에는 `active = false`로 바꾸면 그 시간이 다시 열린다.

## 보안(RLS) — 비회원 구조라 가장 중요

정적 사이트라 anon key가 브라우저에 그대로 노출된다. 따라서:

| 대상 | 권한 |
|---|---|
| **anon** (손님) | 요금표 읽기 + "언제 찼는지"만. **예약자 개인정보 접근 불가** |
| **authenticated** (관리자) | 전체 조회·수정 |
| **service_role** (Edge Function) | RLS 우회. 예약 생성·결제 승인은 전부 여기서 |

`reservations` / `payments` / `occupancies` 에는 **anon 정책을 일부러 만들지 않았다.**
RLS가 켜져 있고 정책이 없으면 기본 거부다.

손님용 조회 경로는 두 개뿐:
- `get_availability(space_code, from, to)` — 점유 시간대만, 개인정보 없음
- `lookup_reservation(code, phone)` — **예약번호 + 전화번호가 모두** 맞아야 조회

## 적용 방법

```bash
supabase link --project-ref <프로젝트-ref>
supabase db push          # 마이그레이션 적용
psql "$DATABASE_URL" -f supabase/seed.sql   # 초기 요금 데이터
```

## 검증 완료된 동작

로컬 Postgres 15로 실행해 확인했다.

- 같은 공간·같은 시간 중복 예약 → **거부됨**
- 통대관 예약 후 그린룸 단독 예약 → **거부됨** (교차 차단)
- 취소(`active=false`) 후 같은 시간 재예약 → **허용됨**
- `lookup_reservation` 전화번호 불일치 → **결과 없음** (하이픈 차이는 무시)
- anon으로 `reservations` 조회 → **0건**, 요금표는 정상 조회

## 확인·조정이 필요한 값

- **패키지 이용 시각** — 상세페이지에 "낮타임 몇 시~몇 시"가 없어서 일반적인 값으로 넣었다
  (오전 09–13 / 낮 13–18 / 밤 18–23 / All Day 11–23). 실제 운영 시간으로 수정할 것.
- **3시간권 시작 시각** — 자유 선택으로 보고 `starts_at`을 비워뒀다.
- **시간당 최소 이용 시간** — `units.min_hours = 2`로 가정.
- **성수기 배수** — 12~1월 1.2배로 임시 설정 (`price_overrides`).
- **공휴일** — "공휴일 및 전날은 주말 요금" 규칙용 `holidays` 테이블은 비어 있다.

## 다음 단계

1. Supabase 프로젝트 생성 → URL / anon key 발급
2. 예약 화면 (달력, 시간대 선택, 금액 계산)
3. Edge Function — 예약 생성(금액 서버 검증) + 토스 결제 승인
4. 관리자 페이지 — 예약 목록/달력, 시간대 차단, 취소·환불
