/** 로고 — public/images/logo.png (아이콘 + 워드마크 일체형, 정사각형) */
export function Logo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <img
      src="/images/logo.png"
      alt="서초 시그니처 파티룸"
      className={className}
    />
  );
}
