import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloorPricing } from "@/components/floor-pricing";

// 상세 이미지는 Safari/iOS의 대형 이미지(>16.7MP) 강제 축소를 피하려고
// 세로 1500px씩 잘라둔다 (public/images/floor-{key}-01.webp ~). 조각 수는 층마다 다름.
// 이미지의 "가격 및 이용 안내" 구간은 잘라내고 <FloorPricing>(DB 요금)이 대신 들어간다.
// tail: 요금 구간 뒤에 남는 이미지(6F 시설 안내 등) 조각 수 — floor-{key}-t01.webp ~
const FLOORS = {
  "2f": { floor: "2F", name: "시그니처 스위트", slices: 6, tail: 0 },
  "4f": { floor: "4F", name: "시그니처 컨벤션", slices: 7, tail: 0 },
  "6f": { floor: "6F", name: "시그니처 루프탑", slices: 5, tail: 1 },
} as const;

type FloorKey = keyof typeof FLOORS;

export function generateStaticParams() {
  return Object.keys(FLOORS).map((floor) => ({ floor }));
}

// 정적 export: 위 목록에 없는 경로는 404
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ floor: string }>;
}): Promise<Metadata> {
  const { floor } = await params;
  const data = FLOORS[floor as FloorKey];
  if (!data) return {};
  return {
    title: `서초파티룸 ${data.floor} · ${data.name} | 서초 시그니처 파티룸`,
    description: `서초파티룸 ${data.floor} ${data.name} — 공간 안내, 가격 및 이용 안내, 환불 규정.`,
  };
}

export default async function FloorPage({
  params,
}: {
  params: Promise<{ floor: string }>;
}) {
  const { floor } = await params;
  const data = FLOORS[floor as FloorKey];
  if (!data) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 상세 이미지: 고해상도 소스(2400px 슬라이스)라 1200px 폭으로 표시해도 선명.
            레티나(2x)에서 1200×2=2400 = 소스와 1:1 픽셀 매핑. */}
        <div className="mx-auto flex max-w-(--container-page) flex-col">
          {Array.from({ length: data.slices }, (_, i) => {
            const n = String(i + 1).padStart(2, "0");
            return (
              <img
                key={n}
                src={`/images/floor-${floor}-${n}.webp`}
                alt={
                  i === 0
                    ? `서초파티룸 ${data.floor} ${data.name} 상세 안내`
                    : ""
                }
                className="-mb-px block w-full"
                loading={i < 2 ? "eager" : "lazy"}
              />
            );
          })}
        </div>

        <FloorPricing spaceCode={floor} />

        {data.tail > 0 && (
          <div className="mx-auto flex max-w-(--container-page) flex-col">
            {Array.from({ length: data.tail }, (_, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <img
                  key={n}
                  src={`/images/floor-${floor}-t${n}.webp`}
                  alt=""
                  className="-mb-px block w-full"
                  loading="lazy"
                />
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
