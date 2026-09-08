export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-(--container-page) px-5 pt-6 lg:px-8">
      <div className="relative h-[440px] overflow-hidden md:h-[520px]">
        {/* 배경 이미지 — public/images/hero.png */}
        <img
          src="/images/hero.png"
          alt="파티룸 내부 전경"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* 가독성용 어두운 오버레이 */}
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold leading-snug tracking-tight text-white md:text-5xl">
            모임 목적에 따라,
            <br />
            공간이 달라집니다
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/85 md:text-base">
            브런치부터 세미나까지, 당신의 순간을 위한 완벽한 공간이 여기 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/booking/"
              className="inline-flex h-11 items-center justify-center bg-white px-7 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              온라인 예약
            </a>
            <a
              href="#spaces"
              className="inline-flex h-11 items-center justify-center border border-white/70 px-7 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              공간 보기
            </a>
            <a
              href="https://pf.kakao.com/_xiGLxkn/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center border border-white/70 px-7 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              예약문의
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
