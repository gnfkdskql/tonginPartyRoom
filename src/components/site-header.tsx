"use client";

import { useState } from "react";
import { Logo } from "./logo";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "./icons";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xiGLxkn/chat";
const BOOKING_URL = "/booking/";

type NavLink = { label: string; href: string; external?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: "공간 보기", href: "/#spaces" },
  { label: "블로그", href: "/blog/" },
  { label: "예약문의", href: KAKAO_CHANNEL_URL, external: true },
];

const GUIDE_LINKS: NavLink[] = [
  { label: "공간 안내", href: "/#spaces" },
  { label: "이용 요금", href: "/products/" },
  { label: "찾아오기", href: "/#location" },
  { label: "공간 활용의 지혜", href: "/#stories" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-(--container-page) items-center justify-between px-5 lg:px-8">
        {/* 좌측: 데스크탑 내비 / 모바일 햄버거 */}
        <div className="flex items-center">
          <button
            type="button"
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center text-ink md:hidden"
            aria-label="메뉴 열기"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>

          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-ink/80 transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            ))}

            {/* 안내 드롭다운 (hover) */}
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-ink/80 transition-colors hover:text-ink"
              >
                안내
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-10 w-44 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <ul className="overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg">
                  {GUIDE_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="block px-4 py-2.5 text-sm text-ink/80 transition-colors hover:bg-surface-soft hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* 가운데: 로고 (절대 중앙 정렬) */}
        <a
          href="/"
          className="absolute left-1/2 -translate-x-1/2"
          aria-label="홈으로"
        >
          <Logo className="h-14 w-auto" />
        </a>

        {/* 우측: 온라인 예약 + 예약문의 */}
        <div className="flex items-center gap-2">
          {/* 모바일: 온라인 예약 하나만 */}
          <a
            href={BOOKING_URL}
            className="inline-flex h-9 items-center justify-center bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 md:hidden"
          >
            예약
          </a>
          {/* 데스크탑: 온라인 예약(강조) + 예약문의(아웃라인) */}
          <a
            href={BOOKING_URL}
            className="hidden h-9 items-center justify-center bg-ink px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 md:inline-flex"
          >
            온라인 예약
          </a>
          <a
            href={KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-9 items-center justify-center border border-ink px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-soft md:inline-flex"
          >
            예약문의
          </a>
        </div>
      </div>

      {/* 모바일 슬라이드 메뉴 */}
      {open && (
        <nav className="border-t border-line bg-surface md:hidden">
          <ul className="flex flex-col px-5 py-2">
            {[...NAV_LINKS, ...GUIDE_LINKS].map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line/70 py-3.5 text-base font-medium text-ink/90 last:border-b-0"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 px-5 pb-5 pt-2">
            <a
              href={BOOKING_URL}
              onClick={() => setOpen(false)}
              className="flex h-11 flex-1 items-center justify-center bg-ink text-sm font-medium text-white"
            >
              온라인 예약
            </a>
            <a
              href={KAKAO_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex h-11 flex-1 items-center justify-center border border-ink text-sm font-medium text-ink"
            >
              예약문의
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
