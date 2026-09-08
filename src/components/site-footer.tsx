import { Logo } from "./logo";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from "./icons";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xiGLxkn/chat";

const NAV: { label: string; href: string; external?: boolean }[] = [
  { label: "온라인 예약", href: "/booking/" },
  { label: "공간 안내", href: "/#spaces" },
  { label: "이용 요금", href: "/products/" },
  { label: "블로그", href: "/blog/" },
  { label: "예약문의", href: KAKAO_CHANNEL_URL, external: true },
  { label: "연락처", href: "/#cta" },
];

const SOCIALS = [
  { label: "Facebook", href: "#", Icon: FacebookIcon },
  { label: "Instagram", href: "#", Icon: InstagramIcon },
  { label: "X", href: "#", Icon: XIcon },
  { label: "LinkedIn", href: "#", Icon: LinkedInIcon },
  { label: "YouTube", href: "#", Icon: YouTubeIcon },
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
  { label: "주소", value: "서울특별시 서초구 마방로 48, 2층(양재동, 통인빌딩)" },
  { label: "사업자번호", value: "294-46-01320" },
  { label: "고객센터", value: "1577-2123" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-(--container-page) px-5 py-12 lg:px-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <Logo className="h-14 w-auto" />

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-medium text-ink/90">
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

          <div className="flex items-center gap-4 text-ink">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="transition-opacity hover:opacity-60"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <hr className="my-8 border-line" />

        {/* 사업자 정보 */}
        <dl className="mb-6 flex flex-col items-center gap-x-5 gap-y-1.5 text-xs leading-relaxed text-muted md:flex-row md:flex-wrap md:justify-center">
          {BUSINESS.map((item) => (
            <div key={item.label} className="flex gap-1.5">
              <dt className="text-muted/70">{item.label}</dt>
              <dd className="text-ink/70">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col items-center gap-3 text-sm text-muted md:flex-row md:justify-center md:gap-6">
          <p>© 2025 Seocho Signature. All rights reserved.</p>
          <div className="flex items-center gap-6">
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
        </div>
      </div>
    </footer>
  );
}
