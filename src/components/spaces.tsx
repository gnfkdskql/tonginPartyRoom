import { SectionHeading } from "./section-heading";
import { ArrowRightIcon, CubeIcon } from "./icons";

const SPACES = [
  {
    title: "시그니처 스위트",
    desc: "4명부터 12명까지. 신부 파티와 와인 모임에 완벽합니다.",
    image: "/images/sweet.png",
    href: "/spaces/2f",
  },
  {
    title: "시그니처 컨벤션",
    desc: "20명에서 60명까지, 기업 워크숍과 세미나를 위한 공간입니다.",
    image: "/images/convention.png",
    href: "/spaces/4f",
  },
  {
    title: "시그니처 루프탑",
    desc: "6명부터 20명까지. 야외 테라스에서 저녁 네트워킹을 즐기세요.",
    image: "/images/rooftop.png",
    href: "/spaces/6f",
  },
];

export function Spaces() {
  return (
    <section id="spaces" className="mx-auto max-w-(--container-page) px-5 py-20 md:py-28 lg:px-8">
      <SectionHeading
        eyebrow="공간"
        title="세 가지 선택지"
        subtitle="각 공간은 당신의 필요에 맞게 설계되었습니다."
      />

      <div className="mt-12 grid gap-5 md:mt-16 md:grid-cols-3">
        {SPACES.map((space) => (
          <a
            key={space.title}
            href={space.href}
            className="group relative aspect-[392/272] overflow-hidden"
          >
            <img
              src={space.image}
              alt={space.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

            <div className="relative flex h-full flex-col justify-end p-7 text-white md:p-8">
              <CubeIcon className="mb-4 h-10 w-10 text-white/90" />
              <h3 className="text-2xl font-bold tracking-tight md:text-[1.7rem]">
                {space.title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-white/80">
                {space.desc}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium">
                보기
                <ArrowRightIcon className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
