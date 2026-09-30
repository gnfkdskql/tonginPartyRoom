import { Logo } from "./logo";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xiGLxkn/chat";

const NAV: { label: string; href: string; external?: boolean }[] = [
  { label: "온라인 예약", href: "/booking/" },
  { label: "공간 안내", href: "/#spaces" },
  { label: "이용 요금", href: "/products/" },
  { label: "블로그", href: "/blog/" },
  { label: "예약문의", href: KAKAO_CHANNEL_URL, external: true },
  { label: "연락처", href: "/#cta" },
];

const LEGAL = [
  { label: "개인정보처리방침", href: "/privacy/" },
  { label: "이용약관", href: "/terms/" },
  { label: "취소·환불 규정", href: "/refund/" },
];

// 사업자 정보 (사업자등록증 기준)
const BUSINESS = [
  { label: "상호", value: "서초시그니처파티룸" },
  { label: "대표자", value: "오경옥" },
  { label: "사업자번호", value: "294-46-01320" },
  { label: "통신판매업신고", value: "제 2026-서울서초-3142 호" },
  { label: "주소", value: "서울특별시 서초구 마방로 48, 2층(양재동, 통인빌딩)" },
  { label: "고객센터", value: "1577-2123" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-(--container-page) px-5 py-10 lg:px-8 md:py-14">
        {/* 상단: 로고 + 메뉴. 모바일은 왼쪽 정렬로 촘촘하게, 데스크톱은 양끝 */}
        <div className="flex flex-col items-start gap-7 md:flex-row md:items-center md:justify-between">
          <Logo className="h-12 w-auto" />

          <nav className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm text-ink/90 md:flex md:flex-wrap md:gap-x-7">
            {NAV.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <hr className="my-8 border-line" />

        {/* 사업자 정보: 모바일은 라벨/값 2열 표, 데스크톱은 한 줄 나열 */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs leading-relaxed md:flex md:flex-wrap md:gap-x-5">
          {BUSINESS.map((item) => (
            <div key={item.label} className="contents md:flex md:gap-1.5">
              <dt className="text-muted/70">{item.label}</dt>
              <dd className="text-ink/70">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 flex flex-col gap-3 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="underline-offset-4 hover:text-ink hover:underline"
              >
                {item.label}
              </a>
            ))}
          </div>
          <p>© 2026 서초시그니처파티룸. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
