"use client";

import { useState } from "react";
import { SectionHeading } from "./section-heading";
import { ArrowRightIcon } from "./icons";

const TABS = ["모두 보기", "행사 팁", "공간 선택", "예약 가이드", "준비 방법"] as const;
type Tab = (typeof TABS)[number];

type Post = {
  category: Exclude<Tab, "모두 보기">;
  readTime: string;
  title: string;
  excerpt: string;
  image: string;
};

const POSTS: Post[] = [
  {
    category: "공간 선택",
    readTime: "3분 읽기",
    title: "작은 모임을 위한 공간 선택 기준",
    excerpt: "4명부터 12명까지의 친밀한 자리. 어떤 공간이 맞을까",
    image: "/images/blog_1.png",
  },
  {
    category: "공간 선택",
    readTime: "4분 읽기",
    title: "세미나와 워크숍을 위한 완벽한 환경",
    excerpt: "20명 이상의 참석자를 위한 공간 구성과 시설 활용법",
    image: "/images/blog_2.png",
  },
  {
    category: "행사 팁",
    readTime: "5분 읽기",
    title: "야외 테라스에서의 저녁 네트워킹 성공 전략",
    excerpt: "루프탑 공간을 최대한 활용하는 방법과 주의사항",
    image: "/images/blog_3.png",
  },
  {
    category: "준비 방법",
    readTime: "3분 읽기",
    title: "예약 전 체크리스트와 필수 준비물",
    excerpt: "당신의 행사를 완벽하게 만드는 사전 준비 단계별 가이드",
    image: "/images/blog_4.png",
  },
  {
    category: "행사 팁",
    readTime: "4분 읽기",
    title: "음식과 음료 반입 규정 완벽 이해하기",
    excerpt: "외부 음식 반입부터 주류 정책까지 모든 것을 설명합니다",
    image: "/images/blog_5.png",
  },
  {
    category: "예약 가이드",
    readTime: "3분 읽기",
    title: "취소와 환불 정책을 미리 알아두세요",
    excerpt: "예약 후 계획이 바뀔 때 알아야 할 환불 조건과 절차",
    image: "/images/blog_6.png",
  },
];

export function Blog() {
  const [active, setActive] = useState<Tab>("모두 보기");

  const posts =
    active === "모두 보기"
      ? POSTS
      : POSTS.filter((post) => post.category === active);

  return (
    <section
      id="stories"
      className="mx-auto max-w-(--container-page) px-5 py-20 md:py-28 lg:px-8"
    >
      <SectionHeading
        eyebrow="이야기"
        title="공간 활용의 지혜"
        subtitle="예약 전에 읽어야 할 실용적인 조언들"
      />

      {/* 필터 탭 */}
      <div className="mt-8 flex flex-wrap justify-center gap-2 md:mt-10">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`h-9 px-4 text-sm font-medium transition-colors ${
              active === tab
                ? "bg-ink text-white"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 블로그 카드 그리드 */}
      <div className="mt-10 grid gap-x-6 gap-y-10 md:mt-14 md:grid-cols-3">
        {posts.map((post) => (
          <a key={post.title} href="#" className="group flex flex-col">
            <div className="aspect-[3/2] overflow-hidden">
              <img
                src={post.image}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs font-medium">
              <span className="rounded bg-neutral-100 px-2 py-1 text-ink/80">
                {post.category}
              </span>
              <span className="text-muted">{post.readTime}</span>
            </div>
            <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight text-ink">
              {post.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {post.excerpt}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              더 읽기
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
