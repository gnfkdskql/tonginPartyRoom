import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 닷홈 무료호스팅(정적 호스팅)에 올리기 위한 설정.
  // `npm run build` 시 out/ 폴더에 순수 HTML/CSS/JS가 생성됩니다.
  output: "export",

  // 정적 배포에서는 Next.js 이미지 최적화 서버를 못 쓰므로 비활성화.
  images: {
    unoptimized: true,
  },

  // 각 경로를 폴더/index.html 형태로 생성 → Apache에서 새로고침 404 방지.
  trailingSlash: true,
};

export default nextConfig;
