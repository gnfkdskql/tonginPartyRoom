import { SectionHeading } from "./section-heading";
import { KakaoMap } from "./kakao-map";

const PLACE_URL = "https://place.map.kakao.com/414108667";
// 카카오맵 장소(통인빌딩) 좌표
const PLACE_LAT = 37.47650012830292;
const PLACE_LNG = 127.04260334403455;

const INFO = [
  {
    title: "서울",
    text: "서울시 서초구 마방로 48, 통인빌딩",
    link: "지도 보기",
    href: PLACE_URL,
  },
  {
    title: "접근성",
    text: "대중교통과 자동차 모두 편리한 위치입니다.",
    link: "상세 정보",
    href: "#",
  },
  {
    title: "주변 시설",
    text: "카페, 음식점, 편의점이 모두 인근에 있습니다.",
    link: "더 알아보기",
    href: "#",
  },
];

export function Location() {
  return (
    <section
      id="location"
      className="mx-auto max-w-(--container-page) px-5 py-20 md:py-28 lg:px-8"
    >
      <SectionHeading
        eyebrow="위치"
        title="찾아오기"
        subtitle="양재시민의숲역 인근에 위치해 편리하게 방문하실 수 있습니다."
        align="left"
      />

      <div className="mt-12 grid gap-10 md:mt-14 md:grid-cols-[minmax(0,0.8fr)_1.4fr] md:gap-14">
        <dl className="space-y-8">
          {INFO.map((item) => (
            <div key={item.title}>
              <dt className="text-lg font-bold text-ink">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                {item.text}
              </dd>
              <a
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="mt-2 inline-block text-sm font-semibold text-ink underline-offset-4 hover:underline"
              >
                {item.link}
              </a>
            </div>
          ))}
        </dl>

        <div className="h-72 overflow-hidden md:h-full md:min-h-80">
          <KakaoMap
            lat={PLACE_LAT}
            lng={PLACE_LNG}
            label="서초 시그니처 파티룸"
            placeUrl={PLACE_URL}
          />
        </div>
      </div>
    </section>
  );
}
