export function Cta() {
  return (
    <section id="cta" className="bg-surface py-24 md:py-32">
      <div className="mx-auto flex max-w-(--container-page) flex-col items-center px-5 text-center lg:px-8">
        <h2 className="text-3xl font-bold leading-snug tracking-tight text-ink md:text-5xl">
          준비가 되셨나요
          <br />
          지금 예약하세요
        </h2>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted md:text-base">
          당신의 특별한 순간을 위해 공간을 확보하세요. 빠르고 간단합니다.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/booking/"
            className="inline-flex h-11 items-center justify-center bg-ink px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            온라인 예약
          </a>
          <a
            href="https://pf.kakao.com/_xiGLxkn/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center border border-ink px-8 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-white"
          >
            예약문의
          </a>
        </div>
      </div>
    </section>
  );
}
