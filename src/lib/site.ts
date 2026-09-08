/**
 * 사이트 절대 주소 — sitemap·robots·canonical·OG 이미지에 사용.
 * 실제 배포 도메인으로 .env.local의 NEXT_PUBLIC_SITE_URL을 설정하세요.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"
).replace(/\/$/, "");
