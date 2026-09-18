import { SectionHeading } from "./section-heading";
import { CheckIcon } from "./icons";

// 요금은 Supabase price_rules(상품 상세페이지·예약 폼 기준)의 최저가와 맞춰 둔다.
// DB 요금을 바꾸면 여기 표기도 함께 수정할 것.
const PLANS = [
  {
    name: "시그니처 스위트",
    price: "₩50,000~",
    unit: "1시간 기준",
    notes: [
      "룸 시간당 50,000원 · 통대관 100,000원",
      "최소 2시간부터",
      "(회의 및 소규모파티용)",
    ],
    features: [
      "98인치 모니터 완비",
      "프라이빗 단독 이용",
      "감성 라운지형 파티 공간",
      "자쿠지 시설 보유",
      "개별 화장실 보유",
      "생일파티·브라이덜샤워 추천",
    ],
    cta: "예약하기",
  },
  {
    name: "시그니처 컨벤션",
    price: "₩300,000~",
    unit: "패키지 1회 기준",
    notes: [
      "3시간권 또는 오전·낮·밤 타임 패키지",
      "요일·시간대별 요금 상이",
      "(세미나 / 강의 / 연회용)",
    ],
    features: [
      "200인치 LED 스크린완비",
      "세미나·워크숍 전용 공간",
      "음향·마이크 사용 가능",
      "넓은 테이블 세팅 가능",
      "야간 대관 합리적 이용",
      "기업 행사 및 모임 추천",
    ],
    cta: "예약하기",
  },
  {
    name: "시그니처 루프탑",
    price: "₩70,000~",
    unit: "패키지 1회 기준",
    notes: [
      "3시간권 또는 낮·밤·올데이 패키지",
      "요일·시간대별 요금 상이",
      "(포토존 / BBQ파티 / 야외행사)",
    ],
    features: [
      "루프탑 단독 대관",
      "도심 야외 파티 공간",
      "낮부터 밤까지 여유로운 이용",
      "룸옵션 (80인치모니터 완비)",
      "단체 행사 및 특별한 날 추천",
      "바비큐·프라이빗 모임 추천",
    ],
    cta: "예약하기",
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-surface py-20 md:py-28"
    >
      <div className="mx-auto max-w-(--container-page) px-5 lg:px-8">
        <SectionHeading eyebrow="요금" title="명확한 가격" />

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col border border-line bg-surface p-8"
            >
              <h3 className="text-center text-lg font-bold text-ink">
                {plan.name}
              </h3>
              <p className="mt-4 text-center text-4xl font-bold tracking-tight text-ink md:text-3xl lg:text-4xl xl:text-5xl">
                {plan.price}
              </p>
              <p className="mt-1 text-center text-sm font-medium text-ink/70">
                {plan.unit}
              </p>
              <div className="mt-3 min-h-16 text-center md:min-h-[7.5rem] lg:min-h-16 text-sm leading-relaxed text-muted">
                {plan.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>

              <ul className="mt-8 flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-ink/90">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/booking/"
                className="mt-8 flex h-12 items-center justify-center bg-ink text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
