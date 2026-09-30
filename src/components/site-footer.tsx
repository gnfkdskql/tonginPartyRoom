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

// 사업자 정보 (사업자등록증·통신판매업신고증 기준) — 줄 단위로 묶어서 표시
const BUSINESS_LINES: { label: string; value: string }[][] = [
  [
    { label: "상호", value: "서초시그니처파티룸" },
    { label: "대표", value: "오경옥" },
    { label: "고객센터", value: "1577-2123" },
  ],
  [
    { label: "사업자등록번호", value: "294-46-01320" },
    { label: "통신판매업신고", value: "2026-서울서초-3142" },
  ],
  [{ label: "주소", value: "서울특별시 서초구 마방로 48, 2층 (양재동, 통인빌딩)" }],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-soft">
      <div className="mx-auto max-w-(--container-page) px-5 py-10 lg:px-8 md:py-12">
        {/* 메뉴: 작은 글자로 한 줄 흘림 */}
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink/80 md:gap-x-6 md:text-sm">
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

        <div className="mt-8 flex flex-col items-start gap-6 md:flex-row md:justify-between md:gap-10">
          <Logo className="h-10 w-auto shrink-0" />

          {/* 사업자 정보: 점으로 이어진 문장 3줄 */}
          <div className="min-w-0 text-[11px] leading-[1.9] text-muted md:flex-1 md:text-xs">
            {BUSINESS_LINES.map((line, i) => (
              <p key={i} className="flex flex-wrap gap-x-2">
                {line.map((item, j) => (
                  <span key={item.label} className="whitespace-nowrap">
                    {j > 0 && <span className="mr-2 text-line">|</span>}
                    <span className="text-muted/70">{item.label}</span>{" "}
                    <span className="text-ink/70">{item.value}</span>
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-[11px] text-muted md:flex-row md:items-center md:justify-between md:text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
          <p>© 2026 서초시그니처파티룸</p>
        </div>
      </div>
    </footer>
  );
}
