import { ImagePlaceholderIcon } from "./icons";

/**
 * 이미지 자리표시자.
 * 실제 이미지를 넣을 때는 이 컴포넌트를 <img> 또는 next/image 로 교체하세요.
 * variant="dark" 는 텍스트가 위에 올라가는 어두운 영역(히어로/카드)에 사용합니다.
 */
export function ImagePlaceholder({
  label = "이미지",
  variant = "light",
  className = "",
}: {
  label?: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const isDark = variant === "dark";
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${
        isDark ? "bg-neutral-800 text-white/35" : "bg-neutral-100 text-neutral-400"
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <ImagePlaceholderIcon className="h-7 w-7" />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
    </div>
  );
}
