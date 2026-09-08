import type { PostBlock } from "@/lib/blog";

/**
 * 블록 배열(이미지/텍스트)을 순서대로 렌더링.
 * 훅을 쓰지 않아 서버 컴포넌트(정적 상세)·클라이언트(폴백) 양쪽에서 재사용된다.
 */
export function PostBody({ blocks }: { blocks: PostBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) =>
        b.type === "text" ? (
          <div
            key={i}
            className="whitespace-pre-wrap text-[15px] leading-[1.9] text-ink/90"
          >
            {b.content}
          </div>
        ) : (
          <figure key={i} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.url}
              alt={b.caption || ""}
              className="w-full rounded-xl object-cover"
              loading="lazy"
            />
            {b.caption && (
              <figcaption className="text-center text-xs text-muted">
                {b.caption}
              </figcaption>
            )}
          </figure>
        ),
      )}
    </div>
  );
}
